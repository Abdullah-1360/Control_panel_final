# Diagnosis State Reset Fix

## Issue
After healing completes or subdomain changes, the diagnosis UI should reset to allow new diagnosis. Previously, diagnosis state persisted after healing completion.

## Solution
Added two `useEffect` hooks to `SiteDetailView.tsx`:

### 1. Reset on Healing Completion
```typescript
useEffect(() => {
  if (execution?.status === 'SUCCESS' || execution?.status === 'FAILED' || execution?.status === 'ROLLED_BACK') {
    setDiagnosis(null);
    setExecutionId(null);
    
    // Show appropriate message based on status
    if (execution.status === 'SUCCESS') {
      toast.success('Healing completed successfully. Ready for new diagnosis.');
    } else if (execution.status === 'FAILED') {
      toast.error('Healing failed. Ready for new diagnosis.');
    } else if (execution.status === 'ROLLED_BACK') {
      toast.info('Changes rolled back. Ready for new diagnosis.');
    }
  }
}, [execution?.status]);
```

### 2. Reset on Subdomain Change
```typescript
useEffect(() => {
  setDiagnosis(null);
  setExecutionId(null);
}, [selectedSubdomain]);
```

## Changes Made
- Added `useEffect` to imports from 'react'
- Added useEffect hook to watch `execution?.status` and reset state when healing completes
- Added useEffect hook to watch `selectedSubdomain` and reset state when it changes
- Added appropriate toast notifications for each healing completion status

## Files Modified
- `frontend/components/healer/SiteDetailView.tsx`

## Testing
- No TypeScript errors
- Diagnosis UI will now reset after healing completes
- Diagnosis UI will reset when switching between domains/subdomains
- User receives feedback via toast notifications

## Status
✅ COMPLETE
