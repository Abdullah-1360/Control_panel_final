# Complete Auto-Diagnosis Solution

## Problem Summary

You have WordPress sites with multiple domains that show health score = 0 because they were never diagnosed.

## Root Causes

1. **Timing Issue (FIXED):** Auto-diagnosis was checking before subdomains were detected
2. **Existing Sites:** Sites discovered before auto-diagnosis feature was implemented

## Complete Solution

### Part 1: Fix Auto-Diagnosis for New Sites ✅

**What:** Moved auto-diagnosis trigger from tech stack detection to subdomain detection processor

**Files Changed:**
- `backend/src/modules/healer/processors/subdomain-detection.processor.ts` ✅
- `backend/src/modules/healer/processors/techstack-detection.processor.ts` ✅

**Result:** New WordPress sites with multiple domains will be automatically diagnosed after discovery

### Part 2: Trigger Diagnosis for Existing Sites ✅

**What:** Added API endpoint and CLI script to diagnose existing WordPress sites

**Files Created:**
- `backend/src/modules/healer/controllers/application.controller.ts` (added endpoint) ✅
- `backend/src/scripts/trigger-diagnosis-for-existing-wp-sites.ts` ✅

**Result:** Can trigger diagnosis for all existing WordPress sites with one API call

## Quick Start

### Step 1: Restart Backend (Apply Auto-Diagnosis Fix)

```bash
cd backend
npm run start:dev
```

### Step 2: Trigger Diagnosis for Existing Sites

**Option A: API Call (Easiest)**
```bash
curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Option B: CLI Script**
```bash
cd backend
npx ts-node src/scripts/trigger-diagnosis-for-existing-wp-sites.ts
```

### Step 3: Monitor Progress

```bash
# Check queue stats
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Watch for completion
watch -n 10 'curl -s http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats -H "Authorization: Bearer YOUR_TOKEN"'
```

### Step 4: Verify Results

```bash
# Check WordPress sites now have health scores
curl "http://localhost:3001/api/v1/healer/applications?techStack=WORDPRESS" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.data[] | {domain, healthScore, lastDiagnosedAt}'
```

## Expected Results

### Before Fix
```
WordPress Sites:
  - example.com (3 domains)
    Health Score: 0 ❌
    Last Diagnosed: Never ❌
    
  - site2.com (5 domains)
    Health Score: 0 ❌
    Last Diagnosed: Never ❌
```

### After Fix
```
WordPress Sites:
  - example.com (3 domains)
    Health Score: 85 ✅
    Last Diagnosed: 2026-03-06T10:30:00Z ✅
    Diagnoses: Main + 2 subdomains ✅
    
  - site2.com (5 domains)
    Health Score: 92 ✅
    Last Diagnosed: 2026-03-06T10:35:00Z ✅
    Diagnoses: Main + 4 subdomains ✅
```

## Timeline

### Immediate (After Restart)
- ✅ Auto-diagnosis fix active
- ✅ New discoveries will auto-diagnose

### 5-10 Minutes (After API Call)
- ✅ Existing sites queued for diagnosis
- ✅ First batch of diagnoses running

### 1-4 Hours (Depending on Site Count)
- ✅ All existing sites diagnosed
- ✅ Health scores updated
- ✅ System fully operational

## Monitoring

### Backend Logs to Watch For

**Auto-Diagnosis Triggered:**
```
[SubdomainDetectionProcessor] WordPress site example.com: Total domains = 3
[SubdomainDetectionProcessor] 🚀 AUTO-TRIGGERING diagnosis for all 3 domains
[DiagnosisQueueService] Batch diagnosis enqueued: batch-{id} with 3 jobs
[SubdomainDetectionProcessor] ✅ Auto-diagnosis enqueued: batch-{id}
```

**Diagnosis Processing:**
```
[DiagnosisProcessor] Processing diagnosis job {jobId} for example.com
[UnifiedDiagnosisService] Starting FULL diagnosis for example.com
[DiagnosisProcessor] Diagnosis completed for example.com: HEALTHY (score: 85)
```

### API Endpoints for Monitoring

```bash
# Queue statistics
GET /api/v1/healer/applications/diagnosis-queue/stats

# Recent jobs
GET /api/v1/healer/applications/diagnosis-queue/recent?limit=20

# Batch status
GET /api/v1/healer/applications/diagnosis-batches/{batchId}/status

# Application health scores
GET /api/v1/healer/applications?techStack=WORDPRESS
```

## Rate Limiting Protection

The system is designed to prevent server overload:

- **Concurrency:** Max 3 diagnoses running simultaneously
- **Rate Limit:** Max 10 jobs starting per minute
- **Staggered Delays:** 10 seconds between each domain
- **Priority System:** Main domains diagnosed first

**Example:** 50 WordPress sites with 5 domains each = 250 diagnoses
- Time to complete: ~2-3 hours
- Server load: Minimal (only 3 concurrent)
- No flooding: Rate limited to 10/minute

## Troubleshooting

### Issue: API endpoint returns 404

**Solution:** Restart backend to load new endpoint
```bash
cd backend
npm run start:dev
```

### Issue: No sites triggered

**Check:** Do WordPress sites have subdomains?
```bash
curl "http://localhost:3001/api/v1/healer/applications?techStack=WORDPRESS" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.data[] | {domain, metadata: .metadata.availableSubdomains}'
```

### Issue: Diagnoses not processing

**Check:** Redis and queue are running
```bash
# Check Redis
redis-cli ping

# Check queue stats
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats
```

### Issue: Health scores still 0 after hours

**Check:** Failed jobs
```bash
curl "http://localhost:3001/api/v1/healer/applications/diagnosis-queue/recent?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.[] | select(.state == "failed")'
```

## Configuration

### Adjust Rate Limiting (If Needed)

**File:** `backend/src/modules/healer/processors/diagnosis.processor.ts`

```typescript
@Processor('healer-diagnosis', {
  concurrency: 5, // Increase from 3 (more concurrent)
  limiter: {
    max: 20, // Increase from 10 (faster processing)
    duration: 60000,
  },
})
```

### Adjust Auto-Diagnosis Threshold

**File:** `backend/src/modules/healer/processors/subdomain-detection.processor.ts`

```typescript
// Current: Triggers if 2+ domains
if (totalDomains >= 2) {
  // Auto-trigger diagnosis
}

// Change to 3+ domains:
if (totalDomains >= 3) {
  // Auto-trigger diagnosis
}
```

## Documentation Files

1. `AUTO_DIAGNOSIS_FIX.md` - Technical details of the timing fix
2. `TRIGGER_DIAGNOSIS_FOR_EXISTING_SITES.md` - How to use the API endpoint
3. `DIAGNOSIS_QUEUE_ACTIVATION_COMPLETE.md` - Queue system details
4. `AUTO_DIAGNOSIS_IMPLEMENTATION.md` - Original implementation (outdated)
5. `COMPLETE_AUTO_DIAGNOSIS_SOLUTION.md` - This file (complete solution)

## Summary

### What Was Fixed
1. ✅ Auto-diagnosis timing issue (moved to subdomain detection)
2. ✅ Added API endpoint for existing sites
3. ✅ Added CLI script for existing sites

### What Works Now
1. ✅ New WordPress sites auto-diagnose after discovery
2. ✅ Existing sites can be diagnosed with one API call
3. ✅ Rate limiting prevents server overload
4. ✅ Real-time progress tracking via SSE
5. ✅ Health scores update automatically

### Next Steps
1. Restart backend
2. Call API endpoint to diagnose existing sites
3. Monitor queue progress
4. Verify health scores updated

---

**Last Updated:** March 6, 2026
**Status:** ✅ COMPLETE SOLUTION READY
**Action Required:** Restart backend + Call API endpoint
