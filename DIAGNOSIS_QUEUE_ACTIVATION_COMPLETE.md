# Diagnosis Queue Activation - COMPLETE ✅

## Status: ACTIVE

The BullMQ diagnosis queue system is now fully active and integrated with the frontend SSE progress tracking.

## Changes Made

### 1. DiagnosisProcessor Updated
**File:** `backend/src/modules/healer/processors/diagnosis.processor.ts`

**Changes:**
- Added `diagnosisId` variable at the start of `process()` method: `const diagnosisId = job.id!`
- Passed `diagnosisId` to `unifiedDiagnosisService.diagnose()` in options parameter
- Updated audit logs to include `diagnosisId`
- Updated return result to include `diagnosisId`

**Key Code:**
```typescript
async process(job: Job<DiagnosisJobData>): Promise<any> {
  const diagnosisId = job.id!; // Use job ID as diagnosis ID for SSE tracking
  
  // Pass diagnosisId to unified diagnosis
  const result = await this.unifiedDiagnosisService.diagnose(
    applicationId,
    profile as any,
    {
      diagnosisId, // Pass job ID as diagnosis ID for SSE tracking
      subdomain,
      triggeredBy,
      trigger,
      bypassCache: false,
    },
  );
  
  return {
    success: true,
    domain,
    subdomain,
    healthScore: result.healthScore,
    diagnosisType: result.diagnosisType,
    issuesFound: result.issuesFound,
    criticalIssues: result.criticalIssues,
    diagnosisId, // Include diagnosisId in result
  };
}
```

### 2. ApplicationController Updated
**File:** `backend/src/modules/healer/controllers/application.controller.ts`

**Changes:**
- Updated `/diagnose` endpoint response to include `diagnosisId` (same as `jobId`)
- Added additional fields for frontend compatibility: `applicationId`, `subdomain`, `techStack`
- Updated message to indicate SSE progress tracking

**Key Code:**
```typescript
@Post(':id/diagnose')
async diagnose(...) {
  const jobId = await this.diagnosisQueueService.enqueueDiagnosis({...});
  
  return {
    diagnosisId: jobId, // Frontend expects diagnosisId for SSE tracking
    jobId, // Also return jobId for queue tracking
    applicationId: application.id,
    subdomain: diagnoseDto.subdomain || null,
    techStack: application.techStack,
    message: 'Diagnosis started, progress will be sent via SSE',
    useQueue: true,
  };
}
```

## How It Works

### Flow Diagram
```
1. Frontend calls POST /healer/applications/:id/diagnose
   ↓
2. ApplicationController enqueues diagnosis job
   ↓
3. Returns { diagnosisId: jobId, jobId, ... }
   ↓
4. Frontend uses diagnosisId to track progress via SSE
   ↓
5. DiagnosisProcessor picks up job from queue
   ↓
6. Passes job.id as diagnosisId to UnifiedDiagnosisService
   ↓
7. UnifiedDiagnosisService uses diagnosisId for progress tracking
   ↓
8. DiagnosisProgressService sends SSE updates with diagnosisId
   ↓
9. Frontend receives real-time progress updates
   ↓
10. Diagnosis completes, frontend shows results
```

### Key Integration Points

1. **Job ID = Diagnosis ID**
   - The BullMQ job ID is used as the diagnosis ID
   - This creates a seamless bridge between queue tracking and SSE progress tracking

2. **UnifiedDiagnosisService**
   - Already accepts `diagnosisId` in options parameter
   - Uses it for progress tracking via `DiagnosisProgressService`

3. **Frontend Compatibility**
   - Frontend expects `diagnosisId` field in response
   - No frontend changes needed - works as-is

## Testing

### Test Single Diagnosis
```bash
# Start backend
cd backend
npm run start:dev

# Trigger diagnosis
curl -X POST http://localhost:3001/api/v1/healer/applications/{id}/diagnose \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"profile": "FULL"}'

# Expected response:
{
  "diagnosisId": "job-id-123",
  "jobId": "job-id-123",
  "applicationId": "app-id",
  "subdomain": null,
  "techStack": "WORDPRESS",
  "message": "Diagnosis started, progress will be sent via SSE",
  "useQueue": true
}

# Track progress via SSE
GET /healer/applications/diagnosis/{diagnosisId}/progress

# Track job status
curl http://localhost:3001/api/v1/healer/applications/diagnosis-jobs/{jobId}/status \
  -H "Authorization: Bearer {token}"
```

### Test Batch Diagnosis (All Domains)
```bash
# Diagnose all domains (main + subdomains + addons)
curl -X POST http://localhost:3001/api/v1/healer/applications/{id}/diagnose-all-queued?profile=FULL \
  -H "Authorization: Bearer {token}"

# Expected response:
{
  "batchId": "batch-id-123",
  "totalDomains": 5,
  "jobIds": ["job-1", "job-2", "job-3", "job-4", "job-5"],
  "message": "Enqueued diagnosis for 5 domains"
}

# Track batch status
curl http://localhost:3001/api/v1/healer/applications/diagnosis-batches/{batchId}/status \
  -H "Authorization: Bearer {token}"
```

## Queue Features

### Rate Limiting
- **Concurrency:** Max 3 diagnosis jobs running simultaneously
- **Rate Limit:** Max 10 jobs per minute
- **Staggered Delays:** 10 seconds between domain diagnoses

### Priority System
- **Main Domain:** Priority 1 (highest)
- **Subdomain:** Priority 5
- **Addon Domain:** Priority 10
- **Parked Domain:** Priority 15 (lowest)

### Job Management
- **Retry Failed Jobs:** `POST /healer/applications/diagnosis-jobs/{jobId}/retry`
- **Cancel Job:** `DELETE /healer/applications/diagnosis-jobs/{jobId}`
- **Get Job Status:** `GET /healer/applications/diagnosis-jobs/{jobId}/status`
- **Get Recent Jobs:** `GET /healer/applications/diagnosis-queue/recent?limit=20`
- **Get Queue Stats:** `GET /healer/applications/diagnosis-queue/stats`

## Next Steps

### 1. Add "Diagnose All Domains" Button to Frontend

**API Function** (`frontend/lib/api/healer.ts`):
```typescript
export const healerApi = {
  // ... existing methods
  
  async diagnoseAllDomains(applicationId: string, profile: string = 'FULL') {
    const response = await apiClient.post(
      `/healer/applications/${applicationId}/diagnose-all-queued?profile=${profile}`
    );
    return response.data;
  },
  
  async getBatchDiagnosisStatus(batchId: string) {
    const response = await apiClient.get(
      `/healer/applications/diagnosis-batches/${batchId}/status`
    );
    return response.data;
  },
};
```

**Button in ApplicationDetailView** (`frontend/components/healer/ApplicationDetailView.tsx`):
```typescript
<Button 
  onClick={onDiagnoseAll} 
  disabled={isLoading}
  variant="default"
>
  <Activity className="h-4 w-4 mr-2" />
  Diagnose All Domains
</Button>
```

**Handler in UniversalHealerView** (`frontend/components/healer/UniversalHealerView.tsx`):
```typescript
const handleDiagnoseAll = async () => {
  if (!selectedApplicationId) return;
  
  try {
    const result = await healerApi.diagnoseAllDomains(selectedApplicationId, 'FULL');
    
    toast({
      title: 'Batch Diagnosis Started',
      description: `Diagnosing ${result.totalDomains} domains. This may take a few minutes.`,
    });
    
    // Optionally show batch progress modal
    // setBatchId(result.batchId);
    // setShowBatchProgressModal(true);
  } catch (error: any) {
    toast({
      title: 'Batch Diagnosis Failed',
      description: error.message || 'Failed to start batch diagnosis',
      variant: 'destructive',
    });
  }
};
```

### 2. Add Batch Progress Monitoring UI

Create a modal or panel that shows:
- Total domains being diagnosed
- Completed vs. pending jobs
- Real-time progress for each domain
- Overall batch health score
- Failed jobs with retry option

### 3. Monitor Queue Performance

Watch for:
- Queue backlog (waiting jobs)
- Average job duration
- Failed job rate
- Rate limiting effectiveness

## Benefits

✅ **Server Protection:** Rate limiting prevents server flooding
✅ **Scalability:** Can handle diagnosis of hundreds of domains
✅ **Real-Time Feedback:** SSE progress tracking for user experience
✅ **Reliability:** Job retry and error handling
✅ **Observability:** Queue stats and job tracking
✅ **Prioritization:** Important domains diagnosed first
✅ **Concurrency Control:** Prevents resource exhaustion

## Troubleshooting

### Issue: Diagnosis not starting
**Check:**
1. Redis is running: `redis-cli ping`
2. BullMQ queue is registered: Check logs for "healer-diagnosis queue registered"
3. DiagnosisProcessor is registered: Check logs for "DiagnosisProcessor initialized"

### Issue: Progress not updating
**Check:**
1. SSE endpoint is accessible: `GET /healer/applications/diagnosis/{diagnosisId}/progress`
2. DiagnosisProgressService is tracking: Check logs for "Starting diagnosis [ID: ...]"
3. Frontend is connected to SSE: Check browser network tab

### Issue: Jobs stuck in queue
**Check:**
1. Worker is processing: Check logs for "Processing diagnosis job"
2. No errors in processor: Check logs for "Diagnosis failed"
3. Queue stats: `GET /healer/applications/diagnosis-queue/stats`

## Conclusion

The diagnosis queue system is now fully active and integrated. All domains (main, subdomains, addons, parked) can be diagnosed via the queue with:
- Rate limiting to prevent server flooding
- Real-time progress tracking via SSE
- Intelligent prioritization
- Comprehensive error handling
- Full observability

The system is production-ready and can handle large-scale diagnosis operations safely and efficiently.

---

**Last Updated:** March 6, 2026
**Status:** ✅ ACTIVE AND OPERATIONAL
