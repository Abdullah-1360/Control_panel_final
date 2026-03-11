# Diagnosis Queue Activation Guide

## Current Status

✅ **Backend Implementation Complete**
- DiagnosisQueueService created
- DiagnosisProcessor created  
- API endpoints added
- Queue registered in HealerModule

❌ **Not Yet Active**
- The `/diagnose` endpoint now returns `jobId` instead of `diagnosisId`
- Frontend still expects `diagnosisId` for SSE progress tracking
- Need to bridge the gap between queue jobs and SSE progress

## The Problem

The current flow:
1. Frontend calls `POST /healer/applications/:id/diagnose`
2. Backend NOW returns: `{ jobId, message, useQueue: true }`
3. Frontend expects: `{ diagnosisId, message }`
4. Frontend uses `diagnosisId` to track progress via SSE

## Solution Options

### Option 1: Use Job ID as Diagnosis ID (Recommended)
Make the queue job ID the same as the diagnosis ID for seamless integration.

**Changes Needed:**

#### Backend Changes:

1. **Update DiagnosisProcessor** to generate diagnosisId before processing:
```typescript
async process(job: Job<DiagnosisJobData>): Promise<any> {
  const diagnosisId = job.id!; // Use job ID as diagnosis ID
  
  // Pass diagnosisId to unified diagnosis
  const result = await this.unifiedDiagnosisService.diagnose(
    applicationId,
    profile as any,
    {
      diagnosisId, // Pass job ID as diagnosis ID
      subdomain,
      triggeredBy,
      trigger,
      bypassCache: false,
    },
  );
  
  return result;
}
```

2. **Update ApplicationController** to return diagnosisId:
```typescript
@Post(':id/diagnose')
async diagnose(...) {
  const jobId = await this.diagnosisQueueService.enqueueDiagnosis({...});
  
  return {
    diagnosisId: jobId, // Return jobId as diagnosisId
    jobId, // Also return jobId for tracking
    message: 'Diagnosis job enqueued successfully',
    useQueue: true,
  };
}
```

#### Frontend Changes:
No changes needed! The frontend will receive `diagnosisId` and track progress as before.

---

### Option 2: Separate Job Tracking and Diagnosis Progress
Keep job tracking separate from diagnosis progress.

**Changes Needed:**

#### Frontend Changes:

1. **Update useDiagnoseApplication hook** to handle queue response:
```typescript
export function useDiagnoseApplication() {
  return useMutation({
    mutationFn: async ({ applicationId, subdomain }: { applicationId: string; subdomain?: string }) => {
      const response = await apiClient.post(`/healer/applications/${applicationId}/diagnose`, {
        subdomain,
      });
      
      // Check if using queue
      if (response.data.useQueue && response.data.jobId) {
        // Poll job status until we get diagnosisId
        const diagnosisId = await pollForDiagnosisId(response.data.jobId);
        return { ...response.data, diagnosisId };
      }
      
      return response.data;
    },
  });
}

async function pollForDiagnosisId(jobId: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds
  
  while (attempts < maxAttempts) {
    const status = await apiClient.get(`/healer/applications/diagnosis-jobs/${jobId}/status`);
    
    if (status.data.result?.diagnosisId) {
      return status.data.result.diagnosisId;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  throw new Error('Timeout waiting for diagnosis to start');
}
```

2. **Update UniversalHealerView** to handle the new flow:
```typescript
const handleConnectionReady = useCallback(async () => {
  if (!pendingDiagnosis) return;
  
  try {
    const result = await diagnoseMutation.mutateAsync(pendingDiagnosis);
    
    // result now contains diagnosisId from polling
    if (result && result.diagnosisId) {
      setDiagnosisId(result.diagnosisId);
      setPendingDiagnosis(null);
    }
  } catch (error: any) {
    // Handle error
  }
}, [pendingDiagnosis, diagnoseMutation]);
```

---

## Recommended Implementation: Option 1

Option 1 is simpler and requires minimal changes. Here's the complete implementation:

### Step 1: Update DiagnosisProcessor

```typescript
// backend/src/modules/healer/processors/diagnosis.processor.ts

async process(job: Job<DiagnosisJobData>): Promise<any> {
  const { applicationId, domain, subdomain, profile, triggeredBy, trigger } = job.data;
  const diagnosisId = job.id!; // Use job ID as diagnosis ID

  this.logger.log(
    `Processing diagnosis job ${diagnosisId} for ${domain}${subdomain ? ` (subdomain: ${subdomain})` : ''}`,
  );

  try {
    await job.updateProgress(10);

    // Run diagnosis using unified diagnosis service with diagnosisId
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

    await job.updateProgress(90);

    // Create audit log
    await this.auditService.log({
      action: 'DIAGNOSE_SITE',
      resource: 'APPLICATION',
      resourceId: applicationId,
      description: `Diagnosis completed for ${domain}${subdomain ? ` (${subdomain})` : ''} via queue`,
      metadata: {
        domain,
        subdomain,
        profile,
        healthScore: result.healthScore,
        diagnosisType: result.diagnosisType,
        issuesFound: result.issuesFound,
        criticalIssues: result.criticalIssues,
        jobId: job.id,
        diagnosisId,
      },
      severity: result.criticalIssues > 0 ? 'HIGH' : result.issuesFound > 0 ? 'WARNING' : 'INFO',
      actorType: 'SYSTEM',
    });

    await job.updateProgress(100);

    this.logger.log(
      `Diagnosis completed for ${domain}: ${result.diagnosisType} (score: ${result.healthScore})`,
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
  } catch (error) {
    const err = error as Error;
    this.logger.error(
      `Diagnosis failed for ${domain}: ${err.message}`,
      err.stack,
    );

    // Create audit log for failure
    await this.auditService.log({
      action: 'DIAGNOSE_SITE',
      resource: 'APPLICATION',
      resourceId: applicationId,
      description: `Diagnosis failed for ${domain}${subdomain ? ` (${subdomain})` : ''}: ${err.message}`,
      metadata: {
        domain,
        subdomain,
        profile,
        error: err.message,
        jobId: job.id,
        diagnosisId,
      },
      severity: 'HIGH',
      actorType: 'SYSTEM',
    });

    throw error;
  }
}
```

### Step 2: Update ApplicationController

```typescript
// backend/src/modules/healer/controllers/application.controller.ts

@Post(':id/diagnose')
@RequirePermissions('healer', 'diagnose')
async diagnose(
  @Param('id') id: string,
  @Body() diagnoseDto: DiagnoseApplicationDto,
  @CurrentUser() user: JwtPayload,
) {
  try {
    console.log(`[ApplicationController] Starting diagnosis for application ${id}`);
    
    const application = await this.applicationService.findOne(id);

    const jobId = await this.diagnosisQueueService.enqueueDiagnosis({
      applicationId: id,
      serverId: application.serverId,
      domain: application.domain,
      path: application.path,
      subdomain: diagnoseDto.subdomain,
      profile: (diagnoseDto.profile as DiagnosisProfile) || DiagnosisProfile.FULL,
      triggeredBy: user.userId,
      trigger: 'MANUAL',
      priority: 1,
    });

    console.log('[ApplicationController] Diagnosis job enqueued:', jobId);
    
    // Return diagnosisId (same as jobId) for SSE tracking
    return {
      diagnosisId: jobId, // Frontend expects diagnosisId
      jobId, // Also return jobId for queue tracking
      applicationId: application.id,
      subdomain: diagnoseDto.subdomain || null,
      techStack: application.techStack,
      message: 'Diagnosis started, progress will be sent via SSE',
      useQueue: true,
    };
  } catch (error) {
    console.error('[ApplicationController] Diagnosis error:', error);
    throw error;
  }
}
```

### Step 3: Test the Implementation

1. **Start the backend:**
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Trigger a diagnosis:**
   ```bash
   curl -X POST http://localhost:3001/api/v1/healer/applications/{id}/diagnose \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"profile": "FULL"}'
   ```

3. **Expected response:**
   ```json
   {
     "diagnosisId": "job-id-123",
     "jobId": "job-id-123",
     "applicationId": "app-id",
     "subdomain": null,
     "techStack": "WORDPRESS",
     "message": "Diagnosis started, progress will be sent via SSE",
     "useQueue": true
   }
   ```

4. **Track progress via SSE:**
   ```
   GET /healer/applications/diagnosis/{diagnosisId}/progress
   ```

5. **Track job status:**
   ```bash
   curl http://localhost:3001/api/v1/healer/applications/diagnosis-jobs/{jobId}/status \
     -H "Authorization: Bearer {token}"
   ```

---

## Adding "Diagnose All Domains" Button

### Backend (Already Done)
✅ Endpoint exists: `POST /healer/applications/:id/diagnose-all-queued`

### Frontend Changes Needed

1. **Add API function:**
```typescript
// frontend/lib/api/healer.ts

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

2. **Add button to ApplicationDetailView:**
```typescript
// In the Actions Card section

<Button 
  onClick={onDiagnoseAll} 
  disabled={isLoading}
  variant="default"
>
  <Activity className="h-4 w-4 mr-2" />
  Diagnose All Domains
</Button>
```

3. **Add handler in UniversalHealerView:**
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

---

## Summary

To activate the diagnosis queue:

1. ✅ Backend queue system is implemented
2. ✅ API endpoints are ready
3. ⚠️ Need to update DiagnosisProcessor to use job ID as diagnosis ID
4. ⚠️ Need to update ApplicationController response format
5. ⚠️ Frontend works as-is once backend changes are made

**Next Steps:**
1. Apply the changes from Step 1 and Step 2 above
2. Test single diagnosis
3. Test batch diagnosis
4. Add "Diagnose All Domains" button to UI
5. Add batch progress monitoring UI

The queue is ready to use - just need these small adjustments to bridge the job ID and diagnosis ID!
