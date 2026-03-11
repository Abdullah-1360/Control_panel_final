# Diagnosis Queue System - Testing Guide

## Prerequisites

1. **Backend Running:**
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Redis Running:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

3. **Authentication Token:**
   - Login to get JWT token
   - Use token in Authorization header

## Test 1: Single Domain Diagnosis

### Step 1: Trigger Diagnosis
```bash
curl -X POST http://localhost:3001/api/v1/healer/applications/{applicationId}/diagnose \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "FULL"
  }'
```

### Expected Response:
```json
{
  "diagnosisId": "1234567890",
  "jobId": "1234567890",
  "applicationId": "app-uuid",
  "subdomain": null,
  "techStack": "WORDPRESS",
  "message": "Diagnosis started, progress will be sent via SSE",
  "useQueue": true
}
```

### Step 2: Track Progress via SSE
Open in browser or use curl:
```bash
curl -N http://localhost:3001/api/v1/healer/applications/diagnosis/1234567890/progress \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected SSE Events:
```
data: {"diagnosisId":"1234567890","status":"pending","progress":0}

data: {"diagnosisId":"1234567890","status":"running","progress":10}

data: {"diagnosisId":"1234567890","status":"running","progress":25,"currentCheck":"HTTP_STATUS"}

data: {"diagnosisId":"1234567890","status":"running","progress":50,"currentCheck":"DATABASE_CONNECTION"}

data: {"diagnosisId":"1234567890","status":"correlating","progress":90}

data: {"diagnosisId":"1234567890","status":"completed","progress":100,"healthScore":85}
```

### Step 3: Get Job Status
```bash
curl http://localhost:3001/api/v1/healer/applications/diagnosis-jobs/1234567890/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```json
{
  "jobId": "1234567890",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "domain": "example.com",
    "subdomain": null,
    "healthScore": 85,
    "diagnosisType": "HEALTHY",
    "issuesFound": 2,
    "criticalIssues": 0,
    "diagnosisId": "1234567890"
  },
  "timestamp": "2026-03-06T10:30:00.000Z"
}
```

## Test 2: Subdomain Diagnosis

### Trigger Subdomain Diagnosis:
```bash
curl -X POST http://localhost:3001/api/v1/healer/applications/{applicationId}/diagnose \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "FULL",
    "subdomain": "blog.example.com"
  }'
```

### Expected Response:
```json
{
  "diagnosisId": "9876543210",
  "jobId": "9876543210",
  "applicationId": "app-uuid",
  "subdomain": "blog.example.com",
  "techStack": "WORDPRESS",
  "message": "Diagnosis started, progress will be sent via SSE",
  "useQueue": true
}
```

## Test 3: Batch Diagnosis (All Domains)

### Step 1: Trigger Batch Diagnosis
```bash
curl -X POST "http://localhost:3001/api/v1/healer/applications/{applicationId}/diagnose-all-queued?profile=FULL" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```json
{
  "batchId": "batch-uuid",
  "totalDomains": 5,
  "jobIds": [
    "job-1-main",
    "job-2-subdomain-1",
    "job-3-subdomain-2",
    "job-4-addon-1",
    "job-5-parked-1"
  ],
  "domains": [
    { "domain": "example.com", "type": "main", "priority": 1 },
    { "domain": "blog.example.com", "type": "subdomain", "priority": 5 },
    { "domain": "shop.example.com", "type": "subdomain", "priority": 5 },
    { "domain": "addon.com", "type": "addon", "priority": 10 },
    { "domain": "parked.com", "type": "parked", "priority": 15 }
  ],
  "message": "Enqueued diagnosis for 5 domains"
}
```

### Step 2: Track Batch Status
```bash
curl http://localhost:3001/api/v1/healer/applications/diagnosis-batches/batch-uuid/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```json
{
  "batchId": "batch-uuid",
  "totalJobs": 5,
  "completed": 3,
  "failed": 0,
  "pending": 2,
  "jobs": [
    {
      "jobId": "job-1-main",
      "domain": "example.com",
      "state": "completed",
      "healthScore": 85
    },
    {
      "jobId": "job-2-subdomain-1",
      "domain": "blog.example.com",
      "state": "completed",
      "healthScore": 90
    },
    {
      "jobId": "job-3-subdomain-2",
      "domain": "shop.example.com",
      "state": "completed",
      "healthScore": 75
    },
    {
      "jobId": "job-4-addon-1",
      "domain": "addon.com",
      "state": "active",
      "progress": 50
    },
    {
      "jobId": "job-5-parked-1",
      "domain": "parked.com",
      "state": "waiting",
      "progress": 0
    }
  ]
}
```

## Test 4: Queue Statistics

### Get Queue Stats:
```bash
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```json
{
  "waiting": 2,
  "active": 3,
  "completed": 45,
  "failed": 1,
  "delayed": 0,
  "paused": 0
}
```

## Test 5: Recent Jobs

### Get Recent Jobs:
```bash
curl "http://localhost:3001/api/v1/healer/applications/diagnosis-queue/recent?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```json
{
  "jobs": [
    {
      "jobId": "1234567890",
      "domain": "example.com",
      "subdomain": null,
      "state": "completed",
      "progress": 100,
      "timestamp": "2026-03-06T10:30:00.000Z",
      "result": {
        "healthScore": 85,
        "diagnosisType": "HEALTHY"
      }
    },
    {
      "jobId": "9876543210",
      "domain": "example.com",
      "subdomain": "blog.example.com",
      "state": "completed",
      "progress": 100,
      "timestamp": "2026-03-06T10:25:00.000Z",
      "result": {
        "healthScore": 90,
        "diagnosisType": "HEALTHY"
      }
    }
  ]
}
```

## Test 6: Retry Failed Job

### Step 1: Get Failed Job ID
```bash
curl "http://localhost:3001/api/v1/healer/applications/diagnosis-queue/recent?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.jobs[] | select(.state == "failed")'
```

### Step 2: Retry Job
```bash
curl -X POST http://localhost:3001/api/v1/healer/applications/diagnosis-jobs/{failedJobId}/retry \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```json
{
  "message": "Job retry initiated"
}
```

## Test 7: Cancel Job

### Cancel Active Job:
```bash
curl -X DELETE http://localhost:3001/api/v1/healer/applications/diagnosis-jobs/{jobId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response:
```
HTTP 204 No Content
```

## Verification Checklist

### Backend Logs
Check for these log messages:

✅ **Queue Registration:**
```
[HealerModule] healer-diagnosis queue registered
[DiagnosisProcessor] DiagnosisProcessor initialized
```

✅ **Job Enqueued:**
```
[ApplicationController] Starting diagnosis for application {id}
[ApplicationController] Diagnosis job enqueued: {jobId}
```

✅ **Job Processing:**
```
[DiagnosisProcessor] Processing diagnosis job {jobId} for {domain}
[UnifiedDiagnosisService] Starting FULL diagnosis for {domain} (18 checks) [ID: {diagnosisId}]
```

✅ **Progress Tracking:**
```
[DiagnosisProgressService] Starting diagnosis [ID: {diagnosisId}]
[DiagnosisProgressService] Check started: HTTP_STATUS
[DiagnosisProgressService] Check completed: HTTP_STATUS (PASS)
```

✅ **Job Completed:**
```
[DiagnosisProcessor] Diagnosis completed for {domain}: HEALTHY (score: 85) [ID: {diagnosisId}]
[UnifiedDiagnosisService] Diagnosis completed for {domain}: HEALTHY (score: 85) [ID: {diagnosisId}]
```

### Redis Verification

Check queue in Redis:
```bash
# List all keys
redis-cli KEYS "bull:healer-diagnosis:*"

# Get waiting jobs count
redis-cli LLEN "bull:healer-diagnosis:wait"

# Get active jobs count
redis-cli LLEN "bull:healer-diagnosis:active"

# Get completed jobs count
redis-cli ZCARD "bull:healer-diagnosis:completed"
```

### Database Verification

Check diagnosis history:
```sql
-- Get recent diagnoses
SELECT id, site_id, domain, health_score, diagnosis_type, created_at
FROM diagnosis_history
ORDER BY created_at DESC
LIMIT 10;

-- Get diagnosis progress
SELECT diagnosis_id, status, progress, current_check, health_score
FROM diagnosis_progress
ORDER BY updated_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Jobs not processing
**Solution:**
1. Check Redis connection: `redis-cli ping`
2. Check worker is running: Look for "DiagnosisProcessor initialized" in logs
3. Check queue stats: `GET /healer/applications/diagnosis-queue/stats`

### Issue: Progress not updating
**Solution:**
1. Check SSE endpoint: `GET /healer/applications/diagnosis/{diagnosisId}/progress`
2. Check DiagnosisProgressService logs
3. Verify diagnosisId matches jobId

### Issue: Rate limiting too aggressive
**Solution:**
Adjust in `diagnosis.processor.ts`:
```typescript
@Processor('healer-diagnosis', {
  concurrency: 5, // Increase from 3
  limiter: {
    max: 20, // Increase from 10
    duration: 60000,
  },
})
```

### Issue: Jobs timing out
**Solution:**
Increase timeout in `unified-diagnosis.service.ts`:
```typescript
const checkTimeout = 120000; // Increase from 60000 (2 minutes)
```

## Success Criteria

✅ Single diagnosis completes successfully
✅ SSE progress updates received in real-time
✅ Batch diagnosis processes all domains
✅ Rate limiting prevents server overload
✅ Failed jobs can be retried
✅ Queue statistics are accurate
✅ Diagnosis results saved to database
✅ Health scores updated correctly

## Next Steps

After successful testing:
1. Add "Diagnose All Domains" button to frontend
2. Implement batch progress monitoring UI
3. Add queue health monitoring dashboard
4. Set up alerts for failed jobs
5. Configure automatic retry policies

---

**Last Updated:** March 6, 2026
**Status:** Ready for Testing
