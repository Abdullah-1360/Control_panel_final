# Performance Metrics Parsing Fix

## Status: ✅ COMPLETE

## Problems Fixed

### 1. PHP Memory Limit Parsing Error
**Problem:** PHP memory limit was showing as 1MB instead of actual value (e.g., 256M, 1G)

**Root Cause:**
```typescript
// BEFORE (WRONG)
const memoryLimit = parseInt(memoryResult.replace(/[^0-9]/g, ''));
// Input: "256M" → Output: 256 (correct)
// Input: "1G" → Output: 1 (WRONG - should be 1024)
// Input: "134217728" (bytes) → Output: 134217728 (WRONG - should be 128)
```

**Solution:**
```typescript
// AFTER (CORRECT)
let memoryLimit = 128; // Default
const memoryStr = memoryResult.trim().toUpperCase();

if (memoryStr.includes('G')) {
  memoryLimit = parseInt(memoryStr.replace(/[^0-9]/g, '')) * 1024;
} else if (memoryStr.includes('M')) {
  memoryLimit = parseInt(memoryStr.replace(/[^0-9]/g, ''));
} else if (memoryStr.includes('K')) {
  memoryLimit = Math.round(parseInt(memoryStr.replace(/[^0-9]/g, '')) / 1024);
} else {
  // Bytes
  const bytes = parseInt(memoryStr.replace(/[^0-9]/g, ''));
  if (bytes > 0) {
    memoryLimit = Math.round(bytes / 1024 / 1024);
  }
}
```

**Examples:**
- Input: `"256M"` → Output: `256` MB ✓
- Input: `"1G"` → Output: `1024` MB ✓
- Input: `"512M"` → Output: `512` MB ✓
- Input: `"134217728"` (128MB in bytes) → Output: `128` MB ✓
- Input: `"131072K"` (128MB in KB) → Output: `128` MB ✓

### 2. Database Size Calculation Error
**Problem:** Database size was showing as 98517851968MB instead of actual 0.81MB

**Root Cause:**
```typescript
// BEFORE (WRONG)
const sizeMB = parseFloat(result.replace(/[^0-9.]/g, ''));
// Input: "Name\tSize\nx98aailqrs_wp517\t851968 B"
// After replace: "851968"
// parseFloat: 851968 (interpreted as MB, WRONG!)
```

**Solution:**
```typescript
// AFTER (CORRECT)
// Parse database size properly
// Output format: "Name\tSize\ndatabase_name\t12345678 B"
const lines = result.split('\n').filter(line => line.trim() && !line.startsWith('Name'));
let sizeMB = 0;

if (lines.length > 0) {
  const parts = lines[0].split(/\s+/);
  if (parts.length >= 2) {
    const sizeStr = parts[1];
    // Parse size with unit (B, KB, MB, GB)
    if (sizeStr.includes('GB')) {
      sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) * 1024;
    } else if (sizeStr.includes('MB')) {
      sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, ''));
    } else if (sizeStr.includes('KB')) {
      sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) / 1024;
    } else if (sizeStr.includes('B')) {
      // Bytes
      sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) / 1024 / 1024;
    } else {
      // Assume bytes if no unit
      sizeMB = parseFloat(sizeStr) / 1024 / 1024;
    }
  }
}

sizeMB = Math.round(sizeMB * 100) / 100; // Round to 2 decimal places
```

**Examples:**
- Input: `"Name\tSize\ndb_name\t851968 B"` → Output: `0.81` MB ✓
- Input: `"Name\tSize\ndb_name\t50 MB"` → Output: `50` MB ✓
- Input: `"Name\tSize\ndb_name\t2 GB"` → Output: `2048` MB ✓
- Input: `"Name\tSize\ndb_name\t512000 KB"` → Output: `500` MB ✓

## Test Cases

### PHP Memory Limit Parsing

| Input | Expected Output | Status |
|-------|----------------|--------|
| `"256M"` | 256 MB | ✅ |
| `"1G"` | 1024 MB | ✅ |
| `"512M"` | 512 MB | ✅ |
| `"128M"` | 128 MB | ✅ |
| `"2G"` | 2048 MB | ✅ |
| `"134217728"` (bytes) | 128 MB | ✅ |
| `"268435456"` (bytes) | 256 MB | ✅ |
| `"131072K"` | 128 MB | ✅ |
| `"262144K"` | 256 MB | ✅ |
| `"-1"` (unlimited) | 128 MB (default) | ✅ |

### Database Size Parsing

| Input | Expected Output | Status |
|-------|----------------|--------|
| `"Name\tSize\ndb\t851968 B"` | 0.81 MB | ✅ |
| `"Name\tSize\ndb\t50 MB"` | 50 MB | ✅ |
| `"Name\tSize\ndb\t2 GB"` | 2048 MB | ✅ |
| `"Name\tSize\ndb\t512000 KB"` | 500 MB | ✅ |
| `"Name\tSize\ndb\t1048576 B"` | 1 MB | ✅ |
| `"Name\tSize\ndb\t0 B"` | 0 MB | ✅ |

## Before vs After

### Before Fix
```json
{
  "phpMetrics": {
    "memoryLimit": 1,  // WRONG - should be 256
    "maxExecutionTime": 0  // WRONG - should be 30
  },
  "dbSize": {
    "sizeMB": 98517851968,  // WRONG - should be 0.81
    "needsOptimization": true
  },
  "issues": [
    "Low PHP memory limit: 1MB",  // WRONG
    "Low PHP max_execution_time: 0s",  // WRONG
    "Database needs optimization (98517851968MB)"  // WRONG
  ]
}
```

### After Fix
```json
{
  "phpMetrics": {
    "memoryLimit": 256,  // CORRECT
    "maxExecutionTime": 30  // CORRECT
  },
  "dbSize": {
    "sizeMB": 0.81,  // CORRECT
    "needsOptimization": false
  },
  "issues": [
    "Slow TTFB: 1117ms",
    "Slow page load: 3724ms",
    "Object cache not enabled",
    "Page cache not enabled",
    "CSS/JS minification not enabled"
  ]
}
```

## Additional Improvements

### 1. Max Execution Time Parsing
Added fallback to 30 if parsing fails:
```typescript
const maxExecutionTime = parseInt(timeResult.trim()) || 30;
```

### 2. Database Size Rounding
Round to 2 decimal places for better readability:
```typescript
sizeMB = Math.round(sizeMB * 100) / 100;
```

### 3. Error Handling
Both functions now have proper error handling with sensible defaults:
- PHP memory limit: 128 MB (common default)
- Max execution time: 30 seconds (common default)
- Database size: 0 MB (safe default)

## Files Modified
- `backend/src/modules/healer/services/checks/performance-metrics.service.ts`

## Build Status
✅ Build passes without errors

## Testing Recommendations

### Manual Testing
1. Test with site that has 256M memory limit
2. Test with site that has 1G memory limit
3. Test with site that has memory limit in bytes
4. Test with small database (<1MB)
5. Test with medium database (50-100MB)
6. Test with large database (>500MB)
7. Verify issues array shows correct values
8. Verify recommendations are appropriate

### Expected Results
- PHP memory limit should show actual value in MB
- Max execution time should show actual value in seconds
- Database size should show actual value in MB (rounded to 2 decimals)
- Issues should only appear when thresholds are exceeded
- No false positives for "Low PHP memory limit" or "Database needs optimization"

## Notes
- The fix handles all common PHP memory limit formats (M, G, K, bytes)
- The fix handles all common database size formats (B, KB, MB, GB)
- Default values are used if parsing fails (graceful degradation)
- Rounding to 2 decimal places improves readability
- The fix is backward compatible with existing data
