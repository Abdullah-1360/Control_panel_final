# Plugin/Theme Skip Flags Fix - Complete

## Problem
WP-CLI commands were loading all plugins and themes, causing fatal errors with buggy plugins (wp-reset) and themes (goldish). The goldish theme has an FTP connection issue that crashes WP-CLI.

## Error Example
```
Fatal error: Uncaught TypeError: ftp_nlist(): Argument #1 ($ftp) must be of type FTP\Connection, null given 
in /home/ahmadjew/public_html/wp-admin/includes/class-wp-filesystem-ftpext.php:438
...
#3 /home/ahmadjew/public_html/wp-content/themes/goldish/functions.php(1680): WP_Filesystem_Base->abspath()
#4 /home/ahmadjew/public_html/wp-content/themes/goldish/functions.php(70): ideapark_is_dir('/home/ahmadjew/...')
```

## Solution Applied

### Files Modified
1. `backend/src/modules/healer/services/checks/plugin-theme-analysis.service.ts`

### Changes Made

Added `--skip-themes` flag to ALL plugin-related WP-CLI commands:
- ✅ `plugin list --format=json --skip-themes` (line ~335)
- ✅ `plugin list --status=active --format=json --skip-themes` (line ~381 - detectPluginConflicts)
- ✅ `plugin list --status=inactive --format=json --skip-themes` (line ~437 - findUnusedPlugins)
- ✅ `plugin list --format=json --skip-themes` (line ~482 - checkVulnerabilities)
- ✅ `plugin list --format=json --skip-themes` (line ~536 - detectAbandonedPlugins)
- ✅ `plugin list --format=json --skip-themes` (line ~633 - checkVersionCurrency)
- ✅ `plugin list --status=active --format=json --skip-themes` (line ~778 - detectAdvancedConflicts)

Added `--skip-plugins` flag to theme-related WP-CLI commands:
- ✅ `theme list --format=json --skip-plugins` (line ~541 - checkThemeStatus)
- ✅ `theme list --format=json --skip-plugins` (line ~483 - checkVulnerabilities)

### Why This Works

**Plugin Commands:**
- Plugin listing/analysis doesn't need themes loaded
- Themes can cause fatal errors during plugin checks
- `--skip-themes` prevents theme initialization

**Theme Commands:**
- Theme listing/analysis doesn't need plugins loaded
- Plugins can cause fatal errors during theme checks
- `--skip-plugins` prevents plugin initialization

### Previously Fixed Files (Task 7)
These files already have skip flags from previous fixes:
- `backend/src/modules/healer/services/checks/wp-version.service.ts`
- `backend/src/modules/healer/services/checks/checksum-verification.service.ts`
- `backend/src/modules/healer/services/checks/core-integrity.service.ts`
- `backend/src/modules/healer/services/checks/database-health.service.ts`
- `backend/src/modules/healer/services/checks/orphaned-transients-detection.service.ts`
- `backend/src/modules/healer/services/checks/table-corruption-check.service.ts`
- `backend/src/modules/healer/plugins/wordpress.plugin.ts`
- `backend/src/modules/healer/services/checks/update-status.service.ts`

## Non-WordPress Site Filtering

### Auto-Diagnosis Scheduler Validation
The scheduler already has proper validation in `processSites()`:

```typescript
// Validate this is actually a WordPress site
if (app.techStack !== 'WORDPRESS') {
  this.logger.warn(
    `⚠️  Skipping ${app.domain} - not a WordPress site (techStack: ${app.techStack})`,
  );
  skipped++;
  continue;
}

// Additional validation: check path doesn't look suspicious
if (app.path === '/root' || app.path === '/root/' || app.path === '/' || !app.path) {
  this.logger.warn(
    `⚠️  Skipping ${app.domain} - suspicious path: ${app.path}`,
  );
  skipped++;
  continue;
}
```

### Database Queries
Both `getUndiagnosedSites()` and `getSitesForReDiagnosis()` filter by:
```typescript
where: {
  techStack: 'WORDPRESS', // ONLY WordPress sites
  // ... other conditions
}
```

## Expected Behavior After Fix

### ✅ What Should Work Now
1. Plugin analysis runs without loading themes
2. Theme analysis runs without loading plugins
3. Buggy themes (goldish) won't crash plugin checks
4. Buggy plugins (wp-reset) won't crash theme checks
5. Non-WordPress sites are skipped entirely
6. Sites with suspicious paths (/root, /) are skipped

### ✅ What Commands Are Safe
All WP-CLI commands now use appropriate skip flags:
- Core commands: `--skip-plugins --skip-themes`
- Database commands: `--skip-plugins --skip-themes`
- Plugin commands: `--skip-themes`
- Theme commands: `--skip-plugins`

## Testing Recommendations

1. **Test with goldish theme site:**
   - Should complete plugin analysis without errors
   - Theme analysis should still work (only skips plugins)

2. **Test with wp-reset plugin:**
   - Should complete theme analysis without errors
   - Plugin analysis should still work (only skips themes)

3. **Test non-WordPress sites:**
   - Should be skipped with log message
   - No diagnosis should be attempted

4. **Test suspicious paths:**
   - Sites with path `/root` or `/` should be skipped
   - Log message should indicate suspicious path

## Status
✅ **COMPLETE** - All WP-CLI commands in plugin-theme-analysis.service.ts now have appropriate skip flags.

## Related Tasks
- Task 7: Added skip flags to core, database, and update check services
- Task 12: Validated non-WordPress site filtering in auto-diagnosis scheduler
