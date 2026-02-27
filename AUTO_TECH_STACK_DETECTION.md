# Automatic Tech Stack Detection Implementation

## Overview
Implemented automatic tech stack detection that triggers when viewing application details. The system now detects tech stacks for the main application and all subdomains automatically.

## Changes Made

### Backend Changes

#### 1. New Service Method: `detectAllTechStacks()`
**File:** `backend/src/modules/healer/services/application.service.ts`

Added a new method that detects tech stack for both the main application and all its subdomains in a single operation:

```typescript
async detectAllTechStacks(applicationId: string): Promise<{
  main: {
    techStack: TechStack;
    version?: string;
    confidence: number;
  };
  subdomains: Array<{
    domain: string;
    techStack: TechStack;
    version?: string;
    confidence: number;
  }>;
}>
```

**Features:**
- Detects main application tech stack
- Iterates through all subdomains and detects their tech stacks
- Updates database with detection results
- Continues processing even if one subdomain fails
- Returns comprehensive results for all domains

#### 2. New Controller Endpoint
**File:** `backend/src/modules/healer/controllers/application.controller.ts`

Added endpoint:
```
POST /api/v1/healer/applications/:id/detect-all-tech-stacks
```

**Permissions:** Requires `healer.read` permission

### Frontend Changes

#### 1. Updated API Client
**File:** `frontend/lib/api/healer.ts`

Added three new API methods:
- `detectTechStack(id)` - Detect main application tech stack
- `detectSubdomainTechStack(id, subdomain)` - Detect single subdomain tech stack
- `detectAllTechStacks(id)` - Detect all tech stacks at once

#### 2. Auto-Detection on Page Load
**File:** `frontend/app/(dashboard)/healer/[id]/page.tsx`

Implemented automatic detection using `useEffect`:

**Trigger Conditions:**
- Main application has `UNKNOWN` tech stack
- Any subdomain has `UNKNOWN` or missing tech stack

**Behavior:**
- Runs automatically when application detail page loads
- Shows toast notification during detection
- Shows success/failure toast after completion
- Refreshes application data to show updated tech stacks
- Only runs once per page load (prevents infinite loops)

**User Experience:**
1. User clicks "View Details" on an application
2. Page loads and checks tech stack status
3. If UNKNOWN detected, automatically starts detection
4. Toast shows "Detecting Tech Stacks..."
5. Detection runs for main app + all subdomains
6. Toast shows completion status
7. Page refreshes with updated tech stacks

## Benefits

### 1. Improved User Experience
- No manual "Detect Tech Stack" button needed
- Automatic detection on first view
- Clear progress feedback via toasts
- Seamless integration into existing workflow

### 2. Better Data Quality
- Ensures tech stacks are detected before diagnosis
- Prevents "UNKNOWN" tech stack errors
- Comprehensive detection for all domains at once

### 3. Reduced User Actions
- One less step for users to perform
- Automatic detection on page load
- Batch processing for efficiency

## Technical Details

### Detection Flow
```
1. User navigates to /healer/:id
2. Page loads application data
3. useEffect checks tech stack status
4. If UNKNOWN found:
   a. Set isDetectingTechStack = true
   b. Show "Detecting..." toast
   c. Call detectAllTechStacks API
   d. Wait for completion
   e. Show result toast
   f. Refetch application data
   g. Set isDetectingTechStack = false
5. Page displays updated tech stacks
```

### Error Handling
- Individual subdomain failures don't stop the process
- Error toasts show user-friendly messages
- Console logs detailed error information
- Detection state properly reset on error

### Performance Considerations
- Detection only runs when needed (UNKNOWN status)
- Single API call for all domains (batch processing)
- Prevents duplicate detections with state flag
- Efficient dependency array in useEffect

## Testing Checklist

- [x] Backend TypeScript compilation passes
- [x] Frontend TypeScript compilation passes
- [ ] Test auto-detection on page load
- [ ] Test with UNKNOWN main application
- [ ] Test with UNKNOWN subdomains
- [ ] Test with mixed known/unknown domains
- [ ] Test error handling
- [ ] Test toast notifications
- [ ] Test data refresh after detection

## Future Enhancements

1. **Progress Indicator**: Show which subdomain is being detected
2. **Parallel Detection**: Detect subdomains in parallel for speed
3. **Caching**: Cache detection results to avoid re-detection
4. **Manual Trigger**: Add button to manually re-detect if needed
5. **Detection History**: Track detection attempts and results

## Related Files

### Backend
- `backend/src/modules/healer/services/application.service.ts`
- `backend/src/modules/healer/controllers/application.controller.ts`

### Frontend
- `frontend/app/(dashboard)/healer/[id]/page.tsx`
- `frontend/lib/api/healer.ts`

## Status
✅ Implementation Complete
✅ TypeScript Compilation Passing
⏳ Awaiting User Testing
