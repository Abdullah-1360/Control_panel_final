# Diagnosis Display Troubleshooting Guide

## Issue
Frontend still showing "No Diagnostic Results" after implementing the fix, even though backend logs show `Diagnosis complete: 7 checks executed`.

## Root Cause
The frontend code changes haven't been picked up by the browser yet. This can happen due to:
1. Browser cache holding old JavaScript files
2. Frontend dev server not reloading the changes
3. React Query cache holding stale data

## Solution Steps

### Step 1: Hard Refresh the Browser
**This is the most likely fix!**

**Chrome/Edge/Brave:**
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Firefox:**
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Safari:**
- Mac: `Cmd + Option + R`

### Step 2: Clear Browser Cache
If hard refresh doesn't work:

1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Step 3: Restart Frontend Dev Server
If the above doesn't work, restart the dev server:

```bash
# Stop the current dev server (Ctrl+C)
cd frontend
npm run dev
# or
pnpm dev
# or
yarn dev
```

### Step 4: Clear React Query Cache
If still not working, clear React Query DevTools cache:

1. Open React Query DevTools (usually bottom-left icon)
2. Click "Clear Cache" button
3. Refresh the page

### Step 5: Verify Changes Were Applied

Check the browser console for debug logs:

```javascript
// After clicking "Run Diagnosis", you should see:
Diagnosis result: { checksExecuted: 7, results: [...] }
Refetch result: { data: { results: [...] } }
Diagnostics data updated: { results: [...] }
Results count: 7
```

If you don't see these logs, the code changes haven't loaded yet.

### Step 6: Check Network Tab

1. Open DevTools → Network tab
2. Click "Run Diagnosis"
3. Look for these requests:
   - `POST /api/v1/healer/applications/:id/diagnose` → Should return 200 with `checksExecuted: 7`
   - `GET /api/v1/healer/applications/:id/diagnostics` → Should return 200 with `results: [...]`

If the GET request returns empty results, there's a backend issue.

## Additional Debugging

### Check if Results Are in Database

```sql
-- Connect to PostgreSQL
psql -U opsmanager -d opsmanager_dev

-- Check diagnostic results for the application
SELECT 
  id, 
  "applicationId", 
  "checkName", 
  status, 
  severity, 
  message,
  "createdAt"
FROM diagnostic_results
WHERE "applicationId" = 'e93dfb35-901b-49fe-8458-97494a6f75b1'
ORDER BY "createdAt" DESC
LIMIT 10;
```

If results exist in the database but aren't returned by the API, there's a backend issue.

### Check Backend Logs

Look for these log entries:
```
[ApplicationService] Diagnosis complete: 7 checks executed
[ApplicationService] Finding applications with filters: {"page":1,"limit":50}
```

If you see the first but not API calls to `/diagnostics`, the frontend isn't calling the API.

### Verify API Endpoint

Test the diagnostics endpoint directly (requires authentication):

```bash
# Get auth token from browser DevTools → Application → Cookies
TOKEN="your-jwt-token"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/healer/applications/e93dfb35-901b-49fe-8458-97494a6f75b1/diagnostics?limit=10"
```

Should return:
```json
{
  "applicationId": "e93dfb35-901b-49fe-8458-97494a6f75b1",
  "results": [
    {
      "checkName": "wp_core_update",
      "checkCategory": "DEPENDENCIES",
      "status": "PASS",
      "severity": "LOW",
      "message": "WordPress core is up to date",
      ...
    },
    ...
  ]
}
```

## Changes Made to Fix

### 1. Fixed Mutation Parameters
**File**: `frontend/src/components/healer/DiagnosePage.tsx`

```typescript
// Before (WRONG)
await diagnoseMutation.mutateAsync({
  id: application.id,
  data: {},
});

// After (CORRECT)
await diagnoseMutation.mutateAsync({
  applicationId: application.id,
  subdomain: undefined,
});
```

### 2. Added React Query Cache Settings
**File**: `frontend/hooks/use-healer.ts`

```typescript
export function useDiagnostics(id: string, limit?: number) {
  return useQuery({
    queryKey: healerKeys.diagnostics(id),
    queryFn: () => healerApi.getDiagnostics(id, limit),
    enabled: !!id,
    staleTime: 0, // Always consider data stale
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}
```

### 3. Added Debug Logging
**File**: `frontend/src/components/healer/DiagnosePage.tsx`

```typescript
// Logs diagnosis result
console.log('Diagnosis result:', result);

// Logs refetch result
console.log('Refetch result:', refetchResult);

// Logs when results update
useEffect(() => {
  console.log('Diagnostics data updated:', diagnosticsData);
  console.log('Results count:', results.length);
}, [diagnosticsData, results.length]);
```

## Expected Behavior After Fix

1. Click "Run Diagnosis"
2. Toast: "Diagnosis Started"
3. Backend executes 7 checks (see logs)
4. Frontend receives response with `checksExecuted: 7`
5. Frontend immediately refetches diagnostics
6. Results appear in UI
7. Toast: "Diagnosis Complete - 7 checks executed"
8. Statistics cards show: Total: 7, Passed: X, Failed: Y, etc.

## If Still Not Working

### Check for TypeScript Errors

```bash
cd frontend
npx tsc --noEmit
```

If there are errors in `DiagnosePage.tsx` or `use-healer.ts`, the code might not be compiling.

### Check for Runtime Errors

Open browser console and look for:
- Red error messages
- Failed network requests
- React errors

### Verify File Paths

Ensure you're editing the correct files:
- `frontend/src/components/healer/DiagnosePage.tsx` (main file)
- `frontend/components/healer/DiagnosePage.tsx` (duplicate, also fixed)
- `frontend/hooks/use-healer.ts`

### Check React Query Version

Ensure React Query v5 is installed:

```bash
cd frontend
npm list @tanstack/react-query
```

Should show version 5.x.x. If using v4, the API is different (`cacheTime` instead of `gcTime`).

## Quick Checklist

- [ ] Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] Clear browser cache
- [ ] Restart frontend dev server
- [ ] Check browser console for debug logs
- [ ] Check Network tab for API calls
- [ ] Verify results exist in database
- [ ] Check for TypeScript errors
- [ ] Check for runtime errors in console

## Success Indicators

✅ Console shows: `Diagnosis result: { checksExecuted: 7 }`  
✅ Console shows: `Results count: 7`  
✅ Network tab shows successful GET to `/diagnostics`  
✅ UI displays diagnostic results  
✅ Statistics cards show correct counts  
✅ No "No Diagnostic Results" message

## Contact

If none of these steps work, there may be a deeper issue. Check:
1. Backend logs for errors during diagnosis
2. Database for diagnostic_results entries
3. API endpoint response format
4. Frontend component rendering logic

---

**Last Updated**: February 27, 2026  
**Status**: Troubleshooting Guide  
**Related**: DIAGNOSIS_DISPLAY_FIX.md
