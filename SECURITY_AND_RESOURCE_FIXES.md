# Security Audit & Resource Monitoring Fixes

## Issues Fixed

### 1. Malware Scan Showing 0 Files Scanned

**Problem:**
The security audit's malware scan was running but not counting the total number of files scanned, resulting in `totalScanned: 0` in the output.

**Root Cause:**
The `scanForMalwareSignatures()` method was not calculating the total number of PHP files scanned before running the pattern matching.

**Solution:**
Added a file count command at the beginning of the scan:

```typescript
// Count total PHP files to scan
const countCommand = `find ${sitePath}/wp-content -name "*.php" -type f 2>/dev/null | wc -l`;
const countResult = await this.sshExecutor.executeCommand(serverId, countCommand, 15000);
const totalScanned = parseInt(countResult.trim() || '0');
```

**Result:**
- ✅ Now shows actual count of PHP files scanned
- ✅ Provides better context for malware scan results
- ✅ Users can see scan coverage (e.g., "Scanned 1,234 files")

---

### 2. Resource Usage Showing Server Resources Instead of User Quota

**Problem:**
The resource monitoring check was showing server-wide resources (entire server's disk, memory, CPU) instead of the specific cPanel user's quota and usage.

**Root Cause:**
Commands like `df`, `free`, and `uptime` return server-wide statistics, not user-specific quotas.

**Solution:**
Implemented cPanel user quota detection with fallback:

1. **Extract cPanel username from path:**
   ```typescript
   // From path like /home/username/public_html
   const pathParts = sitePath.split('/');
   const homeIndex = pathParts.indexOf('home');
   const username = pathParts[homeIndex + 1];
   ```

2. **Get user-specific disk quota:**
   ```typescript
   const quotaCommand = `quota -s ${username} 2>/dev/null | tail -1 | awk '{print $2, $3}'`;
   ```

3. **Parse quota output:**
   - Handles sizes like "1.5G", "500M", "1024K"
   - Converts to GB for consistency
   - Calculates usage percentage

4. **Fallback to filesystem stats:**
   - If quota command fails or user not found
   - Falls back to directory-specific disk usage

**Result:**
- ✅ Shows user-specific disk quota (e.g., "5GB used of 10GB")
- ✅ Accurate usage percentage for the user's account
- ✅ Graceful fallback if quota command unavailable
- ✅ Distinguishes between user-quota and filesystem stats

---

## Files Modified

### 1. Security Audit Service
**File:** `backend/src/modules/healer/services/checks/security-audit.service.ts`

**Changes:**
- Added file count command before malware scan
- Returns `totalScanned` count in scan results
- Improved error handling for scan failures

### 2. Resource Monitoring Service
**File:** `backend/src/modules/healer/services/checks/resource-monitoring.service.ts`

**Changes:**
- Added `getCpanelUsername()` method to extract username from path
- Added `parseSize()` method to parse quota sizes (K/M/G/T)
- Modified `checkDiskSpace()` to use user quota first, then fallback
- Added `type` field to indicate quota source (user-quota vs filesystem)

---

## Expected Output Changes

### Before (Malware Scan)
```json
{
  "malwareScan": {
    "totalScanned": 0,  // ❌ Always 0
    "suspiciousFiles": []
  }
}
```

### After (Malware Scan)
```json
{
  "malwareScan": {
    "totalScanned": 1234,  // ✅ Actual count
    "suspiciousFiles": []
  }
}
```

### Before (Resource Usage)
```json
{
  "diskSpace": {
    "usagePercent": 45,  // ❌ Server-wide
    "available": "500GB"  // ❌ Entire server
  }
}
```

### After (Resource Usage)
```json
{
  "diskSpace": {
    "usagePercent": 89,  // ✅ User-specific
    "available": "1.2GB",  // ✅ User's remaining quota
    "used": "8.8GB",
    "limit": "10GB",
    "type": "user-quota"  // ✅ Indicates source
  }
}
```

---

## Testing Recommendations

### Test Malware Scan
1. Run security audit on a WordPress site
2. Verify `totalScanned` shows actual PHP file count
3. Check that count matches: `find /path/to/site/wp-content -name "*.php" | wc -l`

### Test Resource Monitoring
1. Run resource check on cPanel hosting
2. Verify disk usage matches cPanel quota display
3. Test on non-cPanel hosting (should fallback gracefully)
4. Verify `type` field indicates quota source

---

## Additional Improvements

### Malware Scan
- Now provides scan coverage visibility
- Helps users understand scan scope
- Better for reporting and compliance

### Resource Monitoring
- More accurate for shared hosting environments
- Prevents false alarms from server-wide stats
- Better aligns with user's actual limits
- Useful for capacity planning

---

## Backward Compatibility

Both changes are backward compatible:
- Malware scan still returns same structure, just with accurate count
- Resource monitoring still returns same fields, with additional metadata
- Fallback mechanisms ensure no breaking changes

---

## Future Enhancements

### Malware Scan
- Add scan duration tracking
- Implement incremental scanning for large sites
- Add whitelist for known false positives
- Integrate with external malware databases

### Resource Monitoring
- Add bandwidth usage tracking
- Monitor email quota
- Track database size limits
- Add MySQL process monitoring
- Implement resource usage trends
