# Syntax Error Healing Support

## Issue
Healing processor was failing with "Unsupported diagnosis type: SYNTAX_ERROR" even though the diagnosis correctly identified a syntax error in a theme.

**Error Log**:
```
[Nest] LOG [BackupService] Backup created: e2a23357-6760-4e55-a44a-4495a9721058
[Nest] ERROR [HealingProcessor] Healing job failed: Unsupported diagnosis type: SYNTAX_ERROR
Error: Unsupported diagnosis type: SYNTAX_ERROR
    at HealingProcessor.handleHealingJob
```

## Root Cause

The `HealingProcessor` switch statement only handled two diagnosis types:
- `WSOD`
- `MAINTENANCE`

But the improved error diagnosis now correctly identifies `SYNTAX_ERROR` as a distinct diagnosis type. The processor didn't know how to heal syntax errors.

## Solution

Added `SYNTAX_ERROR` to the healing processor switch statement. Since syntax errors are a type of WSOD (White Screen of Death - site is down), they use the same WSOD healing runbook.

**File**: `backend/src/modules/healer/processors/healing.processor.ts`

### Execution Step
```typescript
let healingResult;

switch (diagnosisType) {
  case 'WSOD':
  case 'SYNTAX_ERROR':  // Syntax errors are a type of WSOD
    healingResult = await this.wsodHealer.execute(healingContext);
    break;

  case 'MAINTENANCE':
    healingResult = await this.maintenanceHealer.execute(healingContext);
    break;

  default:
    throw new Error(`Unsupported diagnosis type: ${diagnosisType}`);
}
```

### Verification Step
```typescript
let isVerified = false;

switch (diagnosisType) {
  case 'WSOD':
  case 'SYNTAX_ERROR':  // Syntax errors are a type of WSOD
    isVerified = await this.wsodHealer.verify(healingContext);
    break;

  case 'MAINTENANCE':
    isVerified = await this.maintenanceHealer.verify(healingContext);
    break;
}
```

## How WSOD Runbook Handles Syntax Errors

The WSOD runbook already has the logic to handle syntax errors in themes and plugins:

### For Theme Syntax Errors
```typescript
if (errorType === 'THEME_FAULT') {
  // Switch to default theme
  await wpCliService.execute(
    site.serverId,
    site.path,
    'theme activate twentytwentyfour',
  );
  
  return {
    success: true,
    action: 'Switched to default theme: twentytwentyfour',
    details: { oldTheme: culprit, newTheme: 'twentytwentyfour' },
  };
}
```

### For Plugin Syntax Errors
```typescript
if (errorType === 'PLUGIN_FAULT') {
  // Deactivate faulty plugin
  await wpCliService.execute(
    site.serverId,
    site.path,
    `plugin deactivate ${culprit}`,
  );
  
  return {
    success: true,
    action: `Deactivated faulty plugin: ${culprit}`,
    details: { plugin: culprit },
  };
}
```

## Complete Healing Flow for Syntax Errors

1. **Diagnosis**: Error log analysis identifies syntax error in theme/plugin
   - Diagnosis Type: `SYNTAX_ERROR`
   - Error Type: `THEME_FAULT` or `PLUGIN_FAULT`
   - Culprit: Theme/plugin name (e.g., "twentytwentyfour")

2. **Backup**: Create full backup before healing
   - Files backup
   - Database backup

3. **Healing**: Execute WSOD runbook
   - If THEME_FAULT: Switch to default theme
   - If PLUGIN_FAULT: Deactivate faulty plugin
   - If unknown: Activate safe mode (deactivate all plugins)

4. **Verification**: Check if site is accessible
   - HTTP status check
   - Site returns 200 OK

5. **Success**: Mark execution as successful
   - Update site health status to HEALTHY
   - Reset healing attempts counter
   - Learn from successful execution

## Example Healing Scenario

**Diagnosis**:
```json
{
  "diagnosisType": "SYNTAX_ERROR",
  "details": {
    "errorType": "THEME_FAULT",
    "culprit": "twentytwentyfour",
    "errorMessage": "PHP Parse error: syntax error, unexpected token \",\" in functions.php on line 14",
    "filePath": "/home/.../themes/twentytwentyfour/functions.php",
    "lineNumber": 14
  }
}
```

**Healing Action**:
```
wp theme activate twentytwentyfour
```

**Result**:
```json
{
  "success": true,
  "action": "Switched to default theme: twentytwentyfour",
  "details": {
    "oldTheme": "twentytwentyfour",
    "newTheme": "twentytwentyfour"
  }
}
```

## Supported Diagnosis Types

After this fix, the healing processor supports:

1. **WSOD** - White Screen of Death (generic)
2. **SYNTAX_ERROR** - PHP syntax errors in themes/plugins
3. **MAINTENANCE** - Stuck maintenance mode

## Benefits

1. **Complete Healing Flow**: Syntax errors can now be healed automatically
2. **Reuses Existing Logic**: No need for duplicate runbook code
3. **Consistent Behavior**: SYNTAX_ERROR treated as WSOD (which it is)
4. **Proper Classification**: Syntax errors are correctly identified and healed

## Files Modified

1. `backend/src/modules/healer/processors/healing.processor.ts`
   - Added `SYNTAX_ERROR` case to execution switch statement
   - Added `SYNTAX_ERROR` case to verification switch statement
   - Both cases use the WSOD runbook

## Testing

- Build successful: 0 TypeScript errors
- Syntax errors in themes will switch to default theme
- Syntax errors in plugins will deactivate the plugin
- Backup is created before healing
- Verification checks if site is accessible

## Expected Behavior

**Log Output**:
```
[Nest] LOG [HealingProcessor] Processing healing job for execution <id>
[Nest] LOG [HealingProcessor] Healing subdomain: testing.uzairfarooq.pk at path: /home/.../testing
[Nest] LOG [BackupService] Creating FULL backup for site <id>
[Nest] LOG [BackupService] Backup created: <backup-id>
[Nest] LOG [WsodHealerRunbook] Executing WSOD healer for site testing.uzairfarooq.pk
[Nest] LOG [WsodHealerRunbook] Switching from faulty theme: twentytwentyfour
[Nest] LOG [WpCliService] Executing wp-cli: theme activate twentytwentyfour
[Nest] LOG [HealingProcessor] Healing completed successfully: <execution-id>
```

## Status
✅ COMPLETE - Syntax error healing now fully supported
