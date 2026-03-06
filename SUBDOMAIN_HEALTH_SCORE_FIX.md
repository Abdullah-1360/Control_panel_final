# Subdomain Health Score Fix

## Status: ✅ COMPLETE

## Problem
When running diagnosis on a subdomain, the health score was being saved to the main domain instead of the subdomain's metadata. This caused:
1. Main domain showing subdomain's health score
2. Subdomain not showing its own health score
3. Confusion about which domain was actually diagnosed

## Root Cause
In `diagnoseWordPress()` method, the health score update logic always updated the main application record:

```typescript
// BEFORE (WRONG)
await this.prisma.applications.update({
  where: { id: application.id },  // ← Always main application
  data: {
    healthScore: diagnosis.healthScore,
    healthStatus: this.mapHealthStatus(diagnosis.healthScore),
  },
});
```

This happened regardless of whether `subdomain` parameter was provided.

## Solution
Added conditional logic to check if diagnosis is for a subdomain:

```typescript
// AFTER (CORRECT)
if (subdomain) {
  // For subdomain diagnosis, update subdomain metadata
  const metadata = (application.metadata as any) || {};
  const subdomains = metadata.availableSubdomains || [];
  const subdomainIndex = subdomains.findIndex((s: any) => s.domain === subdomain);
  
  if (subdomainIndex !== -1) {
    subdomains[subdomainIndex].healthScore = diagnosis.healthScore;
    subdomains[subdomainIndex].healthStatus = this.mapHealthStatus(diagnosis.healthScore);
    subdomains[subdomainIndex].lastHealthCheck = new Date().toISOString();
    
    await this.prisma.applications.update({
      where: { id: application.id },
      data: {
        metadata: {
          ...metadata,
          availableSubdomains: subdomains,
        },
      },
    });
    
    this.logger.log(`Updated subdomain ${subdomain} health score: ${diagnosis.healthScore}`);
  }
} else {
  // For main domain diagnosis, update application health score
  await this.prisma.applications.update({
    where: { id: application.id },
    data: {
      healthScore: diagnosis.healthScore,
      healthStatus: this.mapHealthStatus(diagnosis.healthScore),
    },
  });
  
  this.logger.log(`Updated main domain health score: ${diagnosis.healthScore}`);
}
```

## How It Works

### Main Domain Diagnosis
1. User clicks "Run Diagnosis" on main domain
2. `subdomain` parameter is `undefined`
3. Health score saved to `applications.healthScore`
4. Health status saved to `applications.healthStatus`

### Subdomain Diagnosis
1. User clicks "Run Diagnosis" on subdomain
2. `subdomain` parameter is set (e.g., "testing.uzairfarooq.pk")
3. Find subdomain in `applications.metadata.availableSubdomains` array
4. Update subdomain's `healthScore`, `healthStatus`, `lastHealthCheck`
5. Save updated metadata back to database

## Data Structure

### Main Domain
```json
{
  "id": "app-123",
  "domain": "uzairfarooq.pk",
  "healthScore": 85,
  "healthStatus": "HEALTHY",
  "metadata": {
    "availableSubdomains": [...]
  }
}
```

### Subdomain in Metadata
```json
{
  "metadata": {
    "availableSubdomains": [
      {
        "domain": "testing.uzairfarooq.pk",
        "path": "/home/x98aailqrs/public_html/testing",
        "type": "subdomain",
        "techStack": "WORDPRESS",
        "healthScore": 65,
        "healthStatus": "DEGRADED",
        "lastHealthCheck": "2026-03-03T18:00:00.000Z"
      }
    ]
  }
}
```

## Frontend Display

The frontend already reads subdomain health scores from metadata:

```typescript
// ApplicationDetailView-v2.tsx
const subdomain = {
  domain: subdomain.domain,
  type: subdomain.type,
  techStack: subdomain.techStack || 'PHP_GENERIC',
  healthScore: subdomain.healthScore || 0,  // ← Now correctly shows subdomain score
  healthStatus: subdomain.healthStatus || 'UNKNOWN',
  isHealerEnabled: subdomain.isHealerEnabled || false
};
```

## Testing Checklist

### Manual Testing Required
- [ ] Run diagnosis on main domain → health score updates on main domain only
- [ ] Run diagnosis on subdomain → health score updates on subdomain only
- [ ] Verify main domain score doesn't change when subdomain is diagnosed
- [ ] Verify subdomain score doesn't change when main domain is diagnosed
- [ ] Check that `lastHealthCheck` timestamp is updated correctly
- [ ] Verify health status badge shows correct color for each domain

### Expected Behavior

**Scenario 1: Diagnose Main Domain**
- Before: Main domain health score = null, Subdomain health score = null
- Action: Run diagnosis on main domain (score = 85)
- After: Main domain health score = 85, Subdomain health score = null ✓

**Scenario 2: Diagnose Subdomain**
- Before: Main domain health score = 85, Subdomain health score = null
- Action: Run diagnosis on subdomain (score = 65)
- After: Main domain health score = 85, Subdomain health score = 65 ✓

**Scenario 3: Diagnose Both**
- Before: Main domain health score = null, Subdomain health score = null
- Action 1: Run diagnosis on main domain (score = 85)
- After 1: Main domain health score = 85, Subdomain health score = null ✓
- Action 2: Run diagnosis on subdomain (score = 65)
- After 2: Main domain health score = 85, Subdomain health score = 65 ✓

## Files Modified
- `backend/src/modules/healer/services/application.service.ts`

## Build Status
✅ Build passes without errors

## Related Issues

### Issue 1: Tech Stack Detection for Subdomains
**Status:** Already handled correctly
- Subdomain tech stack is stored in `metadata.availableSubdomains[].techStack`
- Diagnosis uses subdomain's tech stack if available
- Falls back to main domain's tech stack if subdomain tech stack is UNKNOWN

### Issue 2: UNKNOWN Tech Stack Diagnosis Prevention
**Status:** Already handled correctly
- Code checks `if (diagnosisApp.techStack === TechStack.UNKNOWN)` and throws error
- Only WordPress tech stack can run diagnosis currently
- Other tech stacks will be supported later

## Next Steps
1. Test with real WordPress sites (main domain + subdomains)
2. Verify health score persistence across page refreshes
3. Add visual indicator in UI to show which domain was last diagnosed
4. Consider adding diagnosis history per subdomain
5. Add ability to compare health scores across subdomains

## Notes
- Subdomain metadata is stored in JSONB field for flexibility
- Each subdomain can have independent health score and status
- Main domain and subdomains are diagnosed independently
- Health scores don't affect each other
- Frontend already supports displaying subdomain health scores
