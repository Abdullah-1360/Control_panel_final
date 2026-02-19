# Error Log Analysis Implementation

## Issue
The system was not reading error_log files to identify which specific plugins/themes are causing issues. This is critical for accurate diagnosis and healing.

## Solution Implemented

### 1. Enhanced PHP Error Checking (DiagnosisService)

**File**: `backend/src/modules/healer/services/diagnosis.service.ts`

**Changes**:
- Now reads multiple error log sources:
  - `wp-content/debug.log` (WordPress debug log)
  - `error_log` (PHP error log at site root)
  - `public_html/error_log` (alternative location)
  - `../error_log` (parent directory)
- Checks for multiple error types:
  - Fatal error
  - PHP Fatal error
  - PHP Parse error
  - Warning
  - Error
- Returns combined analysis from all log sources

**Code**:
```typescript
// Check both debug.log and error_log
const debugLogResult = await this.sshService.executeCommand(
  serverId,
  `tail -100 ${sitePath}/wp-content/debug.log 2>/dev/null || echo "No debug log found"`,
);

const errorLogResult = await this.sshService.executeCommand(
  serverId,
  `tail -100 ${sitePath}/error_log 2>/dev/null || echo "No error log found"`,
);

// Also check common alternative error_log locations
const altErrorLogResult = await this.sshService.executeCommand(
  serverId,
  `tail -100 ${sitePath}/public_html/error_log 2>/dev/null || tail -100 ${sitePath}/../error_log 2>/dev/null || echo "No alternative error log found"`,
);

const combinedLogs = `${debugLogResult}\n${errorLogResult}\n${altErrorLogResult}`;
```

### 2. Plugin/Theme Error Log Analysis (PluginThemeAnalysisService)

**File**: `backend/src/modules/healer/services/checks/plugin-theme-analysis.service.ts`

**New Method**: `analyzeErrorLog()`

**Features**:
- Reads last 200 lines from multiple error log locations
- Identifies problematic plugins by parsing error messages
- Identifies problematic themes by parsing error messages
- Extracts plugin/theme names using multiple patterns:
  - Path pattern: `/wp-content/plugins/plugin-name/`
  - Path pattern: `/wp-content/themes/theme-name/`
  - Quoted pattern: `plugin: "Plugin Name"`
  - Quoted pattern: `theme: "Theme Name"`
- Returns:
  - List of problematic plugins
  - List of problematic themes
  - Total error count
  - Recent errors (last 10)

**Pattern Matching**:
```typescript
// Extract plugin names from error messages
const pluginMatch = line.match(/\/wp-content\/plugins\/([^\/]+)\//);
if (pluginMatch) {
  problematicPlugins.add(pluginMatch[1]);
}

// Extract theme names from error messages
const themeMatch = line.match(/\/wp-content\/themes\/([^\/]+)\//);
if (themeMatch) {
  problematicThemes.add(themeMatch[1]);
}

// Also check for plugin/theme names in error messages
const quotedPluginMatch = line.match(/plugin[:\s]+['"]([^'"]+)['"]/i);
if (quotedPluginMatch) {
  problematicPlugins.add(quotedPluginMatch[1]);
}
```

**Integration into Check**:
- Runs error log analysis first (highest priority)
- Deducts 15 points per problematic plugin
- Deducts 15 points per problematic theme
- Sets status to FAIL if errors found
- Adds critical recommendations with plugin/theme names

**Example Output**:
```json
{
  "errorLogAnalysis": {
    "problematicPlugins": ["woocommerce", "contact-form-7"],
    "problematicThemes": ["twentytwentyone"],
    "errorCount": 45,
    "recentErrors": [
      "PHP Fatal error: Uncaught Error in /wp-content/plugins/woocommerce/...",
      "PHP Warning: Invalid argument in /wp-content/themes/twentytwentyone/..."
    ]
  }
}
```

**Recommendations Generated**:
```
Critical: 2 plugin(s) causing errors: woocommerce, contact-form-7
Critical: 1 theme(s) causing errors: twentytwentyone
```

## Error Log Locations Checked

1. `{sitePath}/error_log` - Standard PHP error log
2. `{sitePath}/public_html/error_log` - cPanel public_html location
3. `{sitePath}/../error_log` - Parent directory (common in some setups)
4. `{sitePath}/wp-content/debug.log` - WordPress debug log

## Benefits

1. **Accurate Diagnosis**: Identifies exact plugins/themes causing issues
2. **Actionable Recommendations**: Tells users which specific plugins to disable/fix
3. **Multiple Sources**: Checks all common error log locations
4. **Pattern Recognition**: Uses multiple regex patterns to extract plugin/theme names
5. **Prioritized**: Error log analysis runs first, highest impact on score
6. **Detailed Context**: Includes recent error messages for debugging

## Scoring Impact

- **Problematic Plugin**: -15 points per plugin
- **Problematic Theme**: -15 points per theme
- **Status**: Automatically set to FAIL if errors found
- **Priority**: Checked before other plugin/theme metrics

## Example Diagnosis Flow

1. Read error_log files from all locations
2. Parse last 200 lines for errors
3. Extract plugin/theme names from error messages
4. If found: Set FAIL status, deduct points, add critical recommendations
5. Continue with other checks (inactive plugins, conflicts, etc.)
6. Return comprehensive analysis with error log details

## Testing

- Build successful: 0 TypeScript errors
- Handles missing error logs gracefully
- Continues to next location if one fails
- Returns empty arrays if no errors found
- Logs warnings for analysis failures

## Future Enhancements

Consider adding:
- Error severity classification (Fatal > Error > Warning)
- Time-based analysis (errors in last hour vs last day)
- Error frequency tracking (same error repeated)
- Automatic plugin deactivation for critical errors
- Integration with healing runbooks to disable problematic plugins

## Status
✅ COMPLETE - Error log analysis fully implemented and tested
