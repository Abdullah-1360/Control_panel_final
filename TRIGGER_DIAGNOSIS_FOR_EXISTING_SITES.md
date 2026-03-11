# Trigger Diagnosis for Existing WordPress Sites

## Problem

You have WordPress sites that were discovered BEFORE the auto-diagnosis feature was implemented. These sites have:
- ✅ Tech stack detected as WORDPRESS
- ✅ Subdomains detected
- ❌ Health score = 0 (never diagnosed)

## Solution

Two ways to trigger diagnosis for existing sites:

### Option 1: API Endpoint (Recommended - Easy)

Call the new API endpoint to trigger diagnosis for all existing WordPress sites:

```bash
curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What it does:**
- Finds all WordPress applications
- Checks if they have multiple domains (2+)
- Triggers diagnosis ONLY if:
  - Never diagnosed before OR
  - Health score is 0

**Response:**
```json
{
  "summary": {
    "totalWordPressSites": 25,
    "triggered": 18,
    "skipped": 7
  },
  "results": [
    {
      "domain": "example.com",
      "totalDomains": 3,
      "status": "triggered",
      "batchId": "batch-1234567890-app-uuid",
      "jobCount": 3
    },
    {
      "domain": "single-domain.com",
      "totalDomains": 1,
      "status": "skipped",
      "reason": "Only 1 domain"
    },
    {
      "domain": "already-diagnosed.com",
      "totalDomains": 5,
      "status": "skipped",
      "reason": "Already diagnosed"
    }
  ],
  "message": "Triggered diagnosis for 18 WordPress sites with multiple domains"
}
```

#### Force Diagnose All (Even Already Diagnosed)

To re-diagnose ALL WordPress sites (even those already diagnosed):

```bash
curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites?forceAll=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Option 2: CLI Script (Advanced)

Run the TypeScript script directly:

```bash
cd backend
npx ts-node src/scripts/trigger-diagnosis-for-existing-wp-sites.ts
```

**Output:**
```
🚀 Starting diagnosis trigger for existing WordPress sites...

Found 25 WordPress applications

📋 example.com:
   - Total domains: 3 (1 main + 2 subdomains)
   - Current health score: 0
   - Last diagnosed: Never
   ✅ Triggering diagnosis for all 3 domains...
   ✅ Enqueued: batch-1234567890-app-uuid (3 jobs)

📋 single-domain.com:
   - Total domains: 1 (1 main + 0 subdomains)
   - Current health score: 0
   - Last diagnosed: Never
   ⏭️  Skipped: Only 1 domain (no subdomains)

============================================================

📊 Summary:
   - Total WordPress sites: 25
   - Diagnosis triggered: 18
   - Skipped: 7

✅ Script completed successfully!

📈 Diagnosis Queue Stats:
   - Waiting: 45
   - Active: 3
   - Completed: 0
   - Failed: 0

💡 Tip: Monitor queue progress with:
   GET /api/v1/healer/applications/diagnosis-queue/stats
```

## Monitoring Progress

### Check Queue Stats

```bash
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "waiting": 45,
  "active": 3,
  "completed": 12,
  "failed": 0,
  "delayed": 0,
  "paused": 0
}
```

### Check Recent Jobs

```bash
curl "http://localhost:3001/api/v1/healer/applications/diagnosis-queue/recent?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Monitor Specific Batch

```bash
curl "http://localhost:3001/api/v1/healer/applications/diagnosis-batches/{batchId}/status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Timeline

With rate limiting (max 3 concurrent, 10/minute):

- **10 WordPress sites with 3 domains each = 30 diagnoses**
  - Time: ~15-20 minutes
  
- **50 WordPress sites with 5 domains each = 250 diagnoses**
  - Time: ~2-3 hours

- **100 WordPress sites with 3 domains each = 300 diagnoses**
  - Time: ~3-4 hours

## Verification

### Check Health Scores Updated

```bash
# Get all WordPress applications
curl "http://localhost:3001/api/v1/healer/applications?techStack=WORDPRESS" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Look for:
- `healthScore` > 0 (was 0 before)
- `lastDiagnosedAt` has a recent timestamp
- `healthStatus` is set (HEALTHY, WARNING, CRITICAL)

### Check Diagnosis History

```bash
# Get diagnosis history for a specific application
curl "http://localhost:3001/api/v1/healer/applications/{applicationId}/diagnostics?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Issue: No sites triggered

**Check 1: Are there WordPress sites with multiple domains?**
```bash
# Check if WordPress sites exist
curl "http://localhost:3001/api/v1/healer/applications?techStack=WORDPRESS" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check 2: Do they have subdomains?**
Look at the `metadata.availableSubdomains` field in the response.

### Issue: Jobs not processing

**Check:** Queue is active
```bash
# Check queue stats
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats

# Check if Redis is running
redis-cli ping
```

### Issue: Diagnoses failing

**Check:** Recent failed jobs
```bash
curl "http://localhost:3001/api/v1/healer/applications/diagnosis-queue/recent?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.[] | select(.state == "failed")'
```

## Best Practices

### 1. Run During Off-Peak Hours
Trigger diagnosis when server load is low to avoid impacting production traffic.

### 2. Monitor Queue Backlog
If queue backlog grows too large (>100), consider:
- Increasing concurrency (from 3 to 5)
- Increasing rate limit (from 10/min to 20/min)

### 3. Verify Results
After all diagnoses complete, spot-check a few sites to ensure health scores are accurate.

### 4. Schedule Regular Checks
Set up a cron job to periodically check for undiagnosed WordPress sites:
```bash
# Every day at 2 AM
0 2 * * * curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites" -H "Authorization: Bearer $TOKEN"
```

## Future: Automatic Diagnosis

Going forward, newly discovered WordPress sites with multiple domains will be automatically diagnosed thanks to the auto-diagnosis feature in the subdomain detection processor.

This endpoint is only needed for:
1. **One-time migration** - Diagnosing existing sites
2. **Manual re-diagnosis** - Force re-diagnose all sites (forceAll=true)
3. **Recovery** - Diagnose sites that failed auto-diagnosis

---

**Last Updated:** March 6, 2026
**Status:** ✅ READY TO USE
**Endpoint:** `POST /api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites`
it robust for further 