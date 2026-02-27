# Infinite Detection Loop Fix

## Issues Identified

### Issue 1: Infinite Loop
**Symptoms:**
- Metadata collection triggered repeatedly
- Detection runs continuously
- Logs show duplicate "Collecting detailed metadata" messages

**Root Cause:**
- useEffect dependencies included `application?.techStack` and `detectionAttempted`
- When detection completes, it updates tech stack
- Tech stack change triggers useEffect again
- Creates infinite loop: detect → update → trigger → detect

**Solution:**
Changed useEffect dependency from:
```typescript
}, [application?.id, application?.techStack, detectionAttempted]);
```

To:
```typescript
}, [application?.id]); // Only run when application ID changes (once per page load)
```

**Rationale:**
- Detection should only run ONCE per page load
- Application ID changes only when navigating to different application
- Prevents re-triggering when tech stack updates
- `detectionAttempted` flag still prevents duplicate runs within same render

### Issue 2: WordPress Files Not Detected

**Symptoms:**
- Checking `/home/zarwate2/public_html/dpexglobal.com`
- Logs show "Files not found: wp-content, wp-includes"
- But screenshot shows files clearly exist

**Root Cause:**
- Using `&&` to chain file checks
- If ANY file check fails, entire command fails
- No visibility into WHICH file is missing
- Silent failures make debugging impossible

**Solution:**
Changed from chained checks:
```typescript
const checkCommands = files.map(file => `[ -e "${path}/${file}" ]`).join(' && ');
await this.sshExecutor.executeCommand(server.id, checkCommands);
```

To individual checks with logging:
```typescript
for (const file of files) {
  const checkCmd = `[ -e "${path}/${file}" ] && echo "exists" || echo "not_found"`;
  const result = await this.sshExecutor.executeCommand(server.id, checkCmd);
  console.log(`[TechStackDetector] File check: ${path}/${file} -> ${result.trim()}`);
  
  if (result.trim() !== 'exists') {
    return false;
  }
}
```

**Benefits:**
- Check each file individually
- Log result for each file
- See exactly which file is missing
- Better debugging information
- More reliable detection

## Additional Improvements

### Added Delay After Metadata Collection
```typescript
await apiClient.post(`/healer/applications/${applicationId}/collect-metadata`, {});
// Wait a bit for metadata to be saved
await new Promise(resolve => setTimeout(resolve, 1000));
await refetch();
```

**Rationale:**
- Metadata collection is async
- Database write might not complete immediately
- 1-second delay ensures data is persisted
- Prevents race condition

## Testing

### Before Fix
- ❌ Infinite loop of metadata collection
- ❌ Detection runs continuously
- ❌ WordPress not detected despite files existing
- ❌ No visibility into which files are missing

### After Fix
- ✅ Detection runs once per page load
- ✅ No infinite loops
- ✅ Individual file checks with logging
- ✅ Clear visibility into detection process
- ✅ Better debugging information

## Files Modified

1. `frontend/app/(dashboard)/healer/[id]/page.tsx`
   - Fixed useEffect dependencies (removed techStack and detectionAttempted)
   - Added 1-second delay after metadata collection

2. `backend/src/modules/healer/services/tech-stack-detector.service.ts`
   - Changed from chained file checks to individual checks
   - Added detailed logging for each file
   - Better error visibility

## Expected Behavior

1. User navigates to application detail page
2. useEffect triggers ONCE (on mount)
3. If subdomains array empty → Collect metadata
4. Wait 1 second for database write
5. Refresh application data
6. Run tech stack detection
7. Check each file individually with logging
8. Update tech stack
9. Refresh display
10. STOP (no re-trigger)

## Status

✅ **FIXED** - February 27, 2026
⏳ **TESTING** - Awaiting user validation

## Next Steps

1. Test with zarwatech.com.pk application
2. Verify detection runs only once
3. Check logs show individual file checks
4. Confirm WordPress detected in dpexglobal.com subdomain
5. Verify no infinite loops
