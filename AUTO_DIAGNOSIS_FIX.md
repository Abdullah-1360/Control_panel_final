# Auto-Diagnosis Fix - Moved to Subdomain Detection Processor

## Problem Identified

Auto-diagnosis was NOT triggering because:

1. **Tech Stack Detection** runs BEFORE **Subdomain Detection**
2. When tech stack detection completed, `metadata.availableSubdomains` was empty
3. Auto-diagnosis check saw only 1 domain (main) and skipped triggering
4. By the time subdomains were detected, the auto-diagnosis logic had already run

### Original Flow (BROKEN)
```
Discovery
    ↓
Tech Stack Detection ← Auto-diagnosis check here (subdomains not detected yet!)
    ↓                  metadata.availableSubdomains = [] (empty)
    ↓                  totalDomains = 1 (only main)
    ↓                  Result: SKIP (need 2+ domains)
    ↓
Subdomain Detection ← Subdomains detected here (too late!)
    ↓                  metadata.availableSubdomains = [sub1, sub2, ...]
    ↓                  But auto-diagnosis already ran and skipped!
```

## Solution

Moved auto-diagnosis trigger from **Tech Stack Detection Processor** to **Subdomain Detection Processor**.

### New Flow (FIXED)
```
Discovery
    ↓
Tech Stack Detection
    ↓ (WordPress detected, saved to DB)
    ↓
Subdomain Detection
    ↓ (Subdomains detected and saved to metadata)
    ↓
Auto-Diagnosis Check ← Moved here!
    ↓                  metadata.availableSubdomains = [sub1, sub2, ...]
    ↓                  totalDomains = 1 + subdomains.length
    ↓                  Result: TRIGGER (if 2+ domains)
    ↓
Diagnosis Queue
    ↓
Diagnose all domains with rate limiting
```

## Changes Made

### 1. Subdomain Detection Processor
**File:** `backend/src/modules/healer/processors/subdomain-detection.processor.ts`

**Added:**
- `DiagnosisQueueService` dependency injection
- `AuditService` dependency injection
- `autoTriggerDiagnosisIfWordPressWithMultipleDomains()` method
- Auto-diagnosis trigger after subdomain detection completes

**Key Code:**
```typescript
// After subdomain detection completes
await this.autoTriggerDiagnosisIfWordPressWithMultipleDomains(applicationId);

// Helper method
private async autoTriggerDiagnosisIfWordPressWithMultipleDomains(
  applicationId: string,
): Promise<void> {
  const app = await this.applicationService.findOne(applicationId);
  
  // Only WordPress sites
  if (app.techStack !== 'WORDPRESS') return;
  
  // Count domains (NOW subdomains are available!)
  const metadata = app.metadata as any;
  const subdomains = metadata?.availableSubdomains || [];
  const totalDomains = 1 + subdomains.length;
  
  // Trigger if 2+ domains
  if (totalDomains >= 2) {
    const result = await this.diagnosisQueueService.enqueueDiagnosisForAllDomains(
      applicationId,
      DiagnosisProfile.FULL,
      'SYSTEM',
    );
    
    this.logger.log(`✅ Auto-diagnosis enqueued: ${result.batchId}`);
  }
}
```

### 2. Tech Stack Detection Processor
**File:** `backend/src/modules/healer/processors/techstack-detection.processor.ts`

**Removed:**
- Auto-diagnosis trigger logic (moved to subdomain detection)
- `autoTriggerDiagnosisIfMultipleDomains()` method
- `DiagnosisQueueService` dependency
- Unused imports

## Why This Works

### Timing is Everything
```
Before Fix:
  Tech Stack Detection (t=0s)
    → Check subdomains: [] (empty)
    → Skip auto-diagnosis
  Subdomain Detection (t=5s)
    → Subdomains found: [sub1, sub2]
    → But auto-diagnosis already skipped!

After Fix:
  Tech Stack Detection (t=0s)
    → WordPress detected ✓
  Subdomain Detection (t=5s)
    → Subdomains found: [sub1, sub2] ✓
    → Check: WordPress + 3 domains ✓
    → Trigger auto-diagnosis ✓
```

### Data Availability
```
At Tech Stack Detection:
  app.techStack = 'WORDPRESS' ✓
  app.metadata.availableSubdomains = [] ✗ (not detected yet)
  
At Subdomain Detection:
  app.techStack = 'WORDPRESS' ✓
  app.metadata.availableSubdomains = [sub1, sub2] ✓ (NOW available!)
```

## Testing

### Test Scenario: Discover WordPress Site with Subdomains

**Step 1: Trigger Discovery**
```bash
curl -X POST http://localhost:3001/api/v1/healer/applications/discover-queued \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "server-uuid"
  }'
```

**Step 2: Watch Backend Logs**
```bash
# Look for these log messages in order:

[TechStackDetectionProcessor] Successfully detected WORDPRESS for example.com
[SubdomainDetectionProcessor] Subdomain detection completed: 2 subdomains, 0 addon domains
[SubdomainDetectionProcessor] WordPress site example.com: Total domains = 3 (1 main + 2 subdomains/addons)
[SubdomainDetectionProcessor] 🚀 AUTO-TRIGGERING diagnosis for all 3 domains of example.com
[DiagnosisQueueService] Enqueueing diagnosis for all domains of application {id}
[DiagnosisQueueService] Found 3 domains for application example.com
[SubdomainDetectionProcessor] ✅ Auto-diagnosis enqueued: batch-{id} with 3 domains for example.com
```

**Step 3: Verify Diagnosis Jobs**
```bash
# Check diagnosis queue stats
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: waiting or active jobs > 0
{
  "waiting": 2,
  "active": 1,
  "completed": 0
}
```

**Step 4: Verify Health Scores Update**
```bash
# Wait 2-3 minutes for diagnoses to complete
# Then check application health scores

curl http://localhost:3001/api/v1/healer/applications \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: health_score > 0 for WordPress sites
```

## Verification Checklist

### ✅ Before Fix (BROKEN)
- [ ] WordPress sites discovered
- [ ] Tech stack detected as WORDPRESS
- [ ] Subdomains detected
- [ ] Health score = 0 (NOT diagnosed)
- [ ] No auto-diagnosis logs
- [ ] No diagnosis jobs in queue

### ✅ After Fix (WORKING)
- [x] WordPress sites discovered
- [x] Tech stack detected as WORDPRESS
- [x] Subdomains detected
- [x] Auto-diagnosis triggered
- [x] Diagnosis jobs enqueued
- [x] Health scores updated (> 0)
- [x] Audit logs created

## Expected Behavior

### Single Domain WordPress Site
```
Domain: example.com
Subdomains: None
Total Domains: 1

Result: ❌ Auto-diagnosis NOT triggered
Reason: Only 1 domain (no subdomains)
Log: "Skipping auto-diagnosis for example.com - only 1 domain"
```

### WordPress Site with Subdomains
```
Domain: example.com
Subdomains: blog.example.com, shop.example.com
Total Domains: 3

Result: ✅ Auto-diagnosis TRIGGERED
Log: "🚀 AUTO-TRIGGERING diagnosis for all 3 domains of example.com"
Diagnosis Queue:
  1. example.com (main, priority 1, 0s delay)
  2. blog.example.com (subdomain, priority 5, 10s delay)
  3. shop.example.com (subdomain, priority 5, 20s delay)
```

## Troubleshooting

### Issue: Still not triggering

**Check 1: Is subdomain detection running?**
```bash
# Look for this log:
[SubdomainDetectionProcessor] Subdomain detection completed for application {id}
```

**Check 2: Are subdomains being detected?**
```bash
# Look for this log:
[SubdomainDetectionProcessor] WordPress site example.com: Total domains = X
```

**Check 3: Is tech stack WordPress?**
```bash
# Look for this log:
[TechStackDetectionProcessor] Successfully detected WORDPRESS for example.com
```

**Check 4: Are there 2+ domains?**
```bash
# Look for this log:
[SubdomainDetectionProcessor] WordPress site example.com: Total domains = 3 (1 main + 2 subdomains)
```

If all checks pass but still not triggering, check for errors:
```bash
# Look for error logs:
[SubdomainDetectionProcessor] Failed to auto-trigger diagnosis: {error}
```

### Issue: Diagnosis jobs not processing

**Check:** Diagnosis queue system is active
```bash
# Verify queue stats
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats

# Check recent jobs
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/recent?limit=10
```

## Summary

The fix moves auto-diagnosis trigger from tech stack detection (too early) to subdomain detection (correct timing). This ensures:

1. ✅ Tech stack is detected (WordPress)
2. ✅ Subdomains are detected and saved to metadata
3. ✅ Auto-diagnosis check has complete domain information
4. ✅ Diagnosis is triggered for all domains (main + subdomains)
5. ✅ Health scores are updated automatically

**Status:** ✅ FIXED - Auto-diagnosis now triggers correctly after subdomain detection completes

---

**Last Updated:** March 6, 2026
**Issue:** Auto-diagnosis not triggering
**Root Cause:** Timing issue - checking before subdomains detected
**Solution:** Moved trigger to subdomain detection processor
**Status:** RESOLVED
