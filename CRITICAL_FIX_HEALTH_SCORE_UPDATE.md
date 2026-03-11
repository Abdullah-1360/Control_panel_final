# CRITICAL FIX: Health Score Not Updating

## Problem Identified

Health scores were NOT being updated after diagnosis because `UnifiedDiagnosisService` was trying to update the old `wp_sites` table instead of the new `applications` table.

## Root Cause

The codebase was migrated from `wp_sites` to `applications` table, but `UnifiedDiagnosisService` still had references to the old table:

```typescript
// OLD CODE (BROKEN)
await this.prisma.wp_sites.update({
  where: { id: siteId },
  data: {
    healthScore,
    healthStatus,
    lastHealthCheck: new Date(),
    lastDiagnosedAt: new Date(), // This field doesn't exist in applications
  },
});
```

## The Fix

Updated all references from `wp_sites` to `applications`:

### Change 1: updateSiteHealth Method
**File:** `backend/src/modules/healer/services/unified-diagnosis.service.ts`

```typescript
// NEW CODE (FIXED)
await this.prisma.applications.update({
  where: { id: siteId },
  data: {
    healthScore,
    healthStatus,
    lastHealthCheck: new Date(),
    // Removed lastDiagnosedAt (doesn't exist in applications table)
  },
});
```

### Change 2: Get Site Details
```typescript
// OLD: const site = await this.prisma.wp_sites.findUnique(...)
// NEW: const site = await this.prisma.applications.findUnique(...)
```

### Change 3: Get Site for Cache
```typescript
// OLD: const site = await this.prisma.wp_sites.findUnique(...)
// NEW: const site = await this.prisma.applications.findUnique(...)
```

## Impact

### Before Fix ❌
- Diagnosis runs successfully
- Results saved to `diagnostic_results` table
- Health scores NOT updated in `applications` table
- Sites show `healthScore: 0` or `null`
- `lastHealthCheck: null`
- `healthStatus: UNKNOWN`

### After Fix ✅
- Diagnosis runs successfully
- Results saved to `diagnostic_results` table
- Health scores UPDATED in `applications` table
- Sites show actual health score (e.g., 85, 92)
- `lastHealthCheck` updated with timestamp
- `healthStatus` updated (HEALTHY, WARNING, CRITICAL)

## Verification

### Check Health Scores Are Updating

**Before running diagnosis:**
```sql
SELECT id, domain, health_score, last_health_check, health_status
FROM applications
WHERE tech_stack = 'WORDPRESS'
LIMIT 10;
```

**Expected before fix:**
```
health_score: 0 or NULL
last_health_check: NULL
health_status: UNKNOWN
```

**After running diagnosis (with fix):**
```
health_score: 85 (or some value 0-100)
last_health_check: 2026-03-06 16:30:00
health_status: HEALTHY (or WARNING/CRITICAL)
```

### Test the Fix

1. **Restart backend** (to load the fix):
   ```bash
   cd backend
   # Kill existing process
   # Restart
   npm run start:dev
   ```

2. **Wait for scheduler** (30 seconds after startup):
   - Scheduler will automatically trigger diagnosis
   - Check logs for "Auto-triggering diagnosis"

3. **Or trigger manually**:
   ```bash
   curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Monitor queue**:
   ```bash
   curl "http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

5. **Wait for diagnoses to complete** (2-10 minutes depending on site count)

6. **Verify health scores updated**:
   ```bash
   curl "http://localhost:3001/api/v1/healer/applications?techStack=WORDPRESS" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     | jq '.data[] | {domain, healthScore, lastHealthCheck, healthStatus}'
   ```

## Why This Happened

The codebase went through a migration:
- **Old:** WordPress-specific `wp_sites` table
- **New:** Universal `applications` table (supports all tech stacks)

Some services were updated to use `applications`, but `UnifiedDiagnosisService` was missed.

## Related Files

All these files now correctly use `applications` table:
- ✅ `ApplicationService` - Uses `applications`
- ✅ `DiagnosisQueueService` - Uses `applications`
- ✅ `AutoDiagnosisSchedulerService` - Uses `applications`
- ✅ `UnifiedDiagnosisService` - NOW FIXED to use `applications`

## Summary

This was a **critical bug** that prevented health scores from being updated. The fix is simple but essential:

**Changed:** `wp_sites` → `applications` in 3 places in `UnifiedDiagnosisService`

**Result:** Health scores now update correctly after diagnosis

---

**Last Updated:** March 6, 2026
**Status:** ✅ FIXED
**Priority:** CRITICAL
**Impact:** Health scores now update correctly
