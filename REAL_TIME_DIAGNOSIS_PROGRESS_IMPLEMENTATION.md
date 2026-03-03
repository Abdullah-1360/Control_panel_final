# Real-Time Diagnosis Progress Tracking - Implementation Guide

**Date:** March 1, 2026  
**Status:** IMPLEMENTATION IN PROGRESS  
**Priority:** HIGH - UX Enhancement

---

## Overview

Implement real-time diagnosis progress tracking with Server-Sent Events (SSE) to provide users with live feedback during diagnosis execution, including:
- Current check being executed
- Progress percentage
- Estimated time remaining
- Check results as they complete
- Professional, clean UI/UX

---

## Architecture

### Backend Components

1. **DiagnosisProgressService** ✅ CREATED
   - Tracks diagnosis progress in memory
   - Emits SSE events for real-time updates
   - Calculates progress percentage and ETA
   - Manages check status (PENDING, RUNNING, PASS, FAIL, WARNING, ERROR)

2. **SystemEvent Enum** ✅ UPDATED
   - Added `DIAGNOSIS_PROGRESS` event type
   - Added `DIAGNOSIS_STARTED`, `DIAGNOSIS_COMPLETED`, `DIAGNOSIS_FAILED`

3. **EventStreamController** ✅ UPDATED
   - Added diagnosis progress events to SSE stream
   - Broadcasts to authenticated users

4. **UnifiedDiagnosisService** ⏳ NEEDS UPDATE
   - Integrate DiagnosisProgressService
   - Emit progress events during diagnosis
   - Track each check execution

### Frontend Components

1. **DiagnosisProgressModal** ⏳ TO CREATE
   - Real-time progress display
   - Check list with status indicators
   - Progress bar with percentage
   - Estimated time remaining
   - Command output display

2. **useDiagnosisProgress Hook** ⏳ TO CREATE
   - Subscribe to SSE diagnosis events
   - Manage progress state
   - Handle connection errors

3. **DiagnosisCheckList Component** ⏳ TO CREATE
   - Display all checks with status
   - Show check duration
   - Display check messages
   - Color-coded status indicators

---

## Implementation Steps

### Step 1: Register DiagnosisProgressService ✅ COMPLETED

**File:** `backend/src/modules/healer/healer.module.ts`

```typescript
import { DiagnosisProgressService } from './services/diagnosis-progress.service';

@Module({
  providers: [
    // ... existing providers
    DiagnosisProgressService,
  ],
})
export class HealerModule {}
```

### Step 2: Update UnifiedDiagnosisService ✅ COMPLETED

**File:** `backend/src/modules/healer/services/unified-diagnosis.service.ts`

```typescript
import { DiagnosisProgressService } from './diagnosis-progress.service';

constructor(
  // ... existing dependencies
  private readonly diagnosisProgress: DiagnosisProgressService,
) {}

async diagnose(siteId: string, profile: DiagnosisProfile, options = {}) {
  const diagnosisId = uuidv4();
  const site = await this.prisma.wp_sites.findUnique({ where: { id: siteId } });
  
  // Start progress tracking
  this.diagnosisProgress.startDiagnosis(
    diagnosisId,
    siteId,
    site.domain,
    config.checks.length,
  );
  
  this.diagnosisProgress.setRunning(diagnosisId);
  
  // Execute checks with progress tracking
  for (const checkType of config.checks) {
    const service = this.checkServices.get(checkType);
    if (!service) continue;
    
    // Notify check started
    this.diagnosisProgress.checkStarted(
      diagnosisId,
      checkType,
      service.getName(),
      this.getCategoryForCheck(checkType),
    );
    
    const startTime = Date.now();
    try {
      const result = await service.check(serverId, sitePath, domain);
      const duration = Date.now() - startTime;
      
      // Notify check completed
      this.diagnosisProgress.checkCompleted(
        diagnosisId,
        checkType,
        result.status,
        result.message,
        duration,
      );
    } catch (error) {
      this.diagnosisProgress.checkCompleted(
        diagnosisId,
        checkType,
        'ERROR',
        error.message,
        Date.now() - startTime,
      );
    }
  }
  
  // Correlation phase
  this.diagnosisProgress.setCorrelating(diagnosisId);
  const correlation = await this.correlationEngine.analyze(checkResults);
  
  // Complete
  this.diagnosisProgress.completeDiagnosis(diagnosisId, healthScore);
  
  return result;
}
```

### Step 3: Create Frontend Hook ✅ COMPLETED

**File:** `frontend/hooks/use-diagnosis-progress.ts`

✅ Created with SSE connection, progress tracking, and error handling

### Step 4: Create Progress Modal Component ✅ COMPLETED

**File:** `frontend/components/healer/diagnosis-progress-modal.tsx`

✅ Created with real-time progress display, check list, and professional UI/UX

### Step 5: Add formatDuration Utility ✅ COMPLETED

**File:** `frontend/lib/utils.ts`

✅ Added formatDuration function for human-readable time display

### Step 6: Integrate into Application Page ⏳ NEXT STEP

**File:** `frontend/app/(dashboard)/healer/applications/[id]/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { DiagnosisProgressModal } from '@/components/healer/diagnosis-progress-modal';

export default function ApplicationPage({ params }: { params: { id: string } }) {
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  
  const handleDiagnose = async () => {
    const response = await fetch(`/api/v1/healer/applications/${params.id}/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: null }),
    });
    
    const data = await response.json();
    setDiagnosisId(data.diagnosisId);
    setShowProgress(true);
  };
  
  return (
    <div>
      <Button onClick={handleDiagnose}>Run Diagnosis</Button>
      
      {diagnosisId && (
        <DiagnosisProgressModal
          open={showProgress}
          onClose={() => setShowProgress(false)}
          diagnosisId={diagnosisId}
          siteName={application.domain}
        />
      )}
    </div>
  );
}
```

---

## UI/UX Design Specifications

### Progress Modal

**Layout:**
- Full-screen modal (max-width: 1024px)
- Header with site name and status badge
- Progress bar with percentage
- Stats row (checks completed, passed, warnings, failed)
- Time indicators (elapsed, estimated remaining)
- Scrollable check list
- Action buttons (Close, View Results)

**Color Scheme:**
- PENDING: Gray (#6B7280)
- RUNNING: Blue (#3B82F6) with spinner
- PASS: Green (#10B981)
- WARNING: Yellow (#F59E0B)
- FAIL/ERROR: Red (#EF4444)

**Animations:**
- Smooth progress bar animation
- Spinner for running checks
- Fade-in for completed checks
- Pulse effect for current check

**Responsive:**
- Mobile: Full screen, reduced padding
- Tablet: 90% width, scrollable
- Desktop: Max 1024px width, optimal spacing

---

## API Response Format

### Diagnosis Endpoint Response

```json
{
  "diagnosisId": "uuid-v4",
  "siteId": "site-uuid",
  "status": "QUEUED",
  "message": "Diagnosis queued for execution"
}
```

### SSE Event Format

```json
{
  "type": "diagnosis.progress",
  "data": {
    "diagnosisId": "uuid-v4",
    "siteId": "site-uuid",
    "siteName": "example.com",
    "status": "CHECK_COMPLETED",
    "progress": 45,
    "currentCheck": "PERFORMANCE_METRICS",
    "checkName": "Performance Metrics",
    "checkCategory": "PERFORMANCE",
    "checkStatus": "WARNING",
    "checkMessage": "Page load time: 3.2s (threshold: 3.0s)",
    "checkDuration": 5234,
    "totalChecks": 19,
    "completedChecks": 8,
    "failedChecks": 1,
    "warningChecks": 2,
    "passedChecks": 5,
    "elapsedTime": 42000,
    "estimatedTimeRemaining": 58000,
    "message": "Completed: Performance Metrics - WARNING",
    "timestamp": "2026-03-01T14:30:45.123Z"
  },
  "timestamp": "2026-03-01T14:30:45.123Z"
}
```

---

## Testing Checklist

### Backend Testing

- [ ] DiagnosisProgressService tracks progress correctly
- [ ] SSE events are emitted for all progress updates
- [ ] Progress percentage calculated accurately
- [ ] ETA calculation is reasonable
- [ ] Memory cleanup after diagnosis completion
- [ ] Error handling for failed checks
- [ ] Multiple concurrent diagnoses supported

### Frontend Testing

- [ ] SSE connection established successfully
- [ ] Progress updates received in real-time
- [ ] UI updates smoothly without flickering
- [ ] Check list scrolls properly
- [ ] Modal closes only when diagnosis complete
- [ ] Error states handled gracefully
- [ ] Responsive on mobile, tablet, desktop

### Integration Testing

- [ ] End-to-end diagnosis with progress tracking
- [ ] Multiple users can track their diagnoses
- [ ] Connection recovery after network interruption
- [ ] Progress persists across page refreshes (optional)

---

## Performance Considerations

1. **Memory Management:**
   - Clean up progress data after 5 minutes
   - Limit concurrent diagnoses per user
   - Use Map for O(1) lookups

2. **Network Efficiency:**
   - SSE heartbeat every 30 seconds
   - Compress event data
   - Batch multiple check updates if needed

3. **UI Performance:**
   - Virtual scrolling for large check lists
   - Debounce progress bar updates
   - Memoize check components

---

## Next Steps

1. ✅ Create DiagnosisProgressService
2. ✅ Update SystemEvent enum
3. ✅ Update EventStreamController
4. ✅ Register DiagnosisProgressService in HealerModule
5. ✅ Update UnifiedDiagnosisService to emit progress
6. ✅ Create useDiagnosisProgress hook
7. ✅ Create DiagnosisProgressModal component
8. ✅ Add formatDuration utility function
9. ⏳ Integrate into application page
10. ⏳ Test end-to-end flow
11. ⏳ Polish UI/UX

---

**Status:** BACKEND COMPLETE ✅ | FRONTEND COMPONENTS COMPLETE ✅  
**Next:** Integrate into application page and test end-to-end  
**Priority:** HIGH - Significant UX improvement  
**Estimated Time:** 1-2 hours remaining (integration + testing)

