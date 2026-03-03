# Diagnosis Trigger Fix - Infinite Loop & Backend Not Triggering

## Issues Identified

### 1. Environment Variable Not Loaded
**Problem**: Frontend is connecting to `/undefined/api/v1/events/stream` instead of `http://localhost:3001/api/v1/events/stream`

**Root Cause**: `NEXT_PUBLIC_API_URL` environment variable is not being read by Next.js

**Solution**: 
- The `.env.local` file exists with correct value: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`
- **MUST restart frontend server** for Next.js to pick up the new environment variable
- Next.js only reads `.env` files at startup, not during hot reload

**Action Required**:
```bash
# Stop frontend server (Ctrl+C)
cd frontend
npm run dev
# or
pnpm dev
```

### 2. Diagnosis Not Starting (diagnosisStartedRef Issue)
**Problem**: `diagnosisStartedRef` is preventing diagnosis from starting, showing "Skipping duplicate onConnectionReady call"

**Root Cause**: The ref might be getting set to `true` somewhere before the actual diagnosis starts, or not being reset properly between attempts

**Solution**: Added comprehensive logging to track the ref state:
- Log when ref is reset to `false` in `handleDiagnose` and `handleDiagnoseSubdomain`
- Log when ref is checked in `handleConnectionReady`
- Log when ref is set to `true` before starting diagnosis
- Log when ref is reset to `false` on modal close

**Files Modified**:
- `frontend/components/healer/UniversalHealerView.tsx` - Added detailed logging to diagnosis handlers
- `frontend/hooks/use-diagnosis-progress.ts` - Added detailed logging to SSE connection flow

### 3. Infinite SSE Reconnection Loop
**Problem**: SSE connection might be reconnecting infinitely, causing "Establishing connections" to loop

**Root Cause**: 
- SSE `onerror` handler closes the connection
- But the effect might be re-running due to dependency changes
- Or the connection is failing and retrying automatically

**Solution**: 
- Added logging to track connection lifecycle
- Ensured `autoConnect` is the only dependency in the useEffect
- Added cleanup logging to see when connections are closed

## Changes Made

### 1. Enhanced Logging in UniversalHealerView.tsx

**handleDiagnose**:
```typescript
console.log('[UniversalHealerView] handleDiagnose called for:', selectedApplication.domain);
console.log('[UniversalHealerView] Reset diagnosisStartedRef to false');
console.log('[UniversalHealerView] Set pendingDiagnosis:', { applicationId: selectedApplicationId });
console.log('[UniversalHealerView] Showing progress modal');
```

**handleDiagnoseSubdomain**:
```typescript
console.log('[UniversalHealerView] handleDiagnoseSubdomain called with:', subdomain);
console.log('[UniversalHealerView] Reset diagnosisStartedRef to false');
console.log('[UniversalHealerView] Set pendingDiagnosis:', { applicationId: selectedApplicationId, subdomain });
console.log('[UniversalHealerView] Showing progress modal');
```

**handleConnectionReady**:
```typescript
console.log('[UniversalHealerView] handleConnectionReady called');
console.log('[UniversalHealerView] diagnosisStartedRef.current:', diagnosisStartedRef.current);
console.log('[UniversalHealerView] pendingDiagnosis:', pendingDiagnosis);
console.log('[UniversalHealerView] Skipping duplicate onConnectionReady call - diagnosisStartedRef is true');
console.log('[UniversalHealerView] Skipping onConnectionReady call - no pendingDiagnosis');
console.log('[UniversalHealerView] Set diagnosisStartedRef to true, starting diagnosis');
console.log('[UniversalHealerView] SSE connection ready, starting diagnosis:', pendingDiagnosis);
console.log('[UniversalHealerView] Diagnosis started, result:', result);
console.log('[UniversalHealerView] Setting diagnosisId:', result.diagnosisId);
console.log('[UniversalHealerView] No diagnosisId in result, closing modal');
```

### 2. Enhanced Logging in use-diagnosis-progress.ts

**useEffect**:
```typescript
console.log('[useDiagnosisProgress] autoConnect is false, not connecting');
console.log('[useDiagnosisProgress] Starting SSE connection setup');
console.log('[useDiagnosisProgress] Reset connectionReadyCalledRef to false');
console.log('[useDiagnosisProgress] Component unmounted, skipping connect');
console.log('[useDiagnosisProgress] Connecting to SSE:', sseUrl);
console.log('[useDiagnosisProgress] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('[useDiagnosisProgress] EventSource.onopen fired');
console.log('[useDiagnosisProgress] EventSource readyState:', eventSource?.readyState);
console.log('[useDiagnosisProgress] Setting 3-second fallback timeout');
console.log('[useDiagnosisProgress] Fallback timeout triggered');
console.log('[useDiagnosisProgress] connectionReadyCalledRef.current:', connectionReadyCalledRef.current);
console.log('[useDiagnosisProgress] onConnectionReadyRef.current exists:', !!onConnectionReadyRef.current);
console.log('[useDiagnosisProgress] Fallback: Triggering onConnectionReady after timeout');
console.log('[useDiagnosisProgress] Fallback: Skipping onConnectionReady (already called or no callback)');
console.log('[useDiagnosisProgress] Cleaning up SSE connection');
```

## Testing Steps

### Step 1: Restart Frontend Server
```bash
# Stop frontend server (Ctrl+C)
cd frontend
npm run dev  # or pnpm dev
```

### Step 2: Verify Environment Variable
Open browser console and check the logs:
```
[useDiagnosisProgress] NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
```

If it shows `undefined`, the server wasn't restarted properly.

### Step 3: Click "Run Diagnosis"
Watch the browser console for the following sequence:

**Expected Flow**:
1. `[UniversalHealerView] handleDiagnose called for: example.com`
2. `[UniversalHealerView] Reset diagnosisStartedRef to false`
3. `[UniversalHealerView] Set pendingDiagnosis: { applicationId: "..." }`
4. `[UniversalHealerView] Showing progress modal`
5. `[useDiagnosisProgress] Starting SSE connection setup`
6. `[useDiagnosisProgress] Connecting to SSE: http://localhost:3001/api/v1/events/stream?token=...`
7. `[useDiagnosisProgress] EventSource.onopen fired`
8. `[useDiagnosisProgress] Setting 3-second fallback timeout`
9. (After 3 seconds) `[useDiagnosisProgress] Fallback timeout triggered`
10. `[useDiagnosisProgress] Fallback: Triggering onConnectionReady after timeout`
11. `[UniversalHealerView] handleConnectionReady called`
12. `[UniversalHealerView] diagnosisStartedRef.current: false`
13. `[UniversalHealerView] pendingDiagnosis: { applicationId: "...", subdomain: undefined }`
14. `[UniversalHealerView] Set diagnosisStartedRef to true, starting diagnosis`
15. `[UniversalHealerView] SSE connection ready, starting diagnosis: { applicationId: "..." }`
16. `[UniversalHealerView] Diagnosis started, result: { diagnosisId: "..." }`
17. `[UniversalHealerView] Setting diagnosisId: ...`

### Step 4: Check Backend Logs
Backend should show:
```
[ApplicationController] Starting diagnosis for application ...
[ApplicationController] diagnoseDto: { subdomain: undefined }
[ApplicationService] Starting diagnosis for application ...
[UnifiedDiagnosisService] Starting diagnosis for site ...
[DiagnosisProgressService] Diagnosis progress: ... - STARTED - 0%
```

## Debugging Guide

### If Environment Variable Still Shows `undefined`:
1. Verify `.env.local` file exists in `frontend/` directory
2. Verify file contains: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`
3. Completely stop and restart frontend server (not just hot reload)
4. Clear browser cache and reload page

### If diagnosisStartedRef is Already `true`:
Look for logs showing:
```
[UniversalHealerView] diagnosisStartedRef.current: true
[UniversalHealerView] Skipping duplicate onConnectionReady call - diagnosisStartedRef is true
```

This means:
- The ref was set to `true` in a previous attempt
- The modal was not properly closed (ref not reset)
- Or the callback is being called multiple times

**Solution**: Close the modal completely and try again. The modal's `onClose` handler should reset the ref.

### If SSE Connection Keeps Reconnecting:
Look for repeated logs:
```
[useDiagnosisProgress] Starting SSE connection setup
[useDiagnosisProgress] Connecting to SSE: ...
[useDiagnosisProgress] EventSource.onopen fired
[useDiagnosisProgress] Cleaning up SSE connection
[useDiagnosisProgress] Starting SSE connection setup  // <- Repeating
```

This means the useEffect is re-running. Check:
- Is `autoConnect` changing?
- Is the component re-rendering?
- Is there an error causing the connection to close?

### If Backend Not Receiving Request:
1. Check browser Network tab for the POST request to `/healer/applications/{id}/diagnose`
2. If request is not being sent, the `diagnoseMutation.mutateAsync` is not being called
3. Check if `handleConnectionReady` is being called at all
4. Check if `pendingDiagnosis` is set correctly

## Expected Outcome

After restarting the frontend server:
1. Click "Run Diagnosis" button
2. Modal opens showing "Connecting to Diagnosis Stream"
3. After 3 seconds, SSE connection is established
4. `handleConnectionReady` is called
5. Backend diagnosis endpoint is called
6. Backend starts diagnosis and emits SSE progress events
7. Frontend receives progress events and updates modal
8. Modal shows real-time progress with checks
9. When complete, modal shows "View Results" button

## Files Modified

1. `frontend/components/healer/UniversalHealerView.tsx` - Added comprehensive logging
2. `frontend/hooks/use-diagnosis-progress.ts` - Added comprehensive logging
3. `frontend/.env.local` - Already exists with correct value (no changes needed)

## Next Steps

1. **RESTART FRONTEND SERVER** (most critical)
2. Click "Run Diagnosis" and watch browser console logs
3. Share the complete console log output if issue persists
4. Check backend logs to see if diagnosis endpoint is being called
5. If still not working, we'll analyze the logs to identify the exact point of failure
