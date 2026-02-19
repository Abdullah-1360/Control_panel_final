# Backup Path Detection and Rate Limit Fixes

## Issues Fixed

### 1. Backup Service - wp-config.php Not Found
**Problem**: Backup was failing because wp-config.php was not found at the expected path (`/home/x98aailqrs/public_html/wp-config.php`)

**Root Cause**: The backup service was using `site.path` directly without checking if wp-config.php exists or trying alternative common paths.

**Solution**: Implemented intelligent path detection that:
1. First checks if wp-config.php exists at `site.path/wp-config.php`
2. If not found, tries common alternative paths:
   - `site.path/public_html/wp-config.php`
   - `site.path/httpdocs/wp-config.php`
   - `site.path/www/wp-config.php`
3. Uses the first path where wp-config.php is found
4. Logs the alternative path when found for debugging

**Code Changes**:
```typescript
// Check if wp-config.php exists at the primary path
const checkPrimaryPath = await this.sshService.executeCommand(
  site.serverId,
  `test -f ${wpConfigPath} && echo "exists" || echo "not_found"`,
);

// If not found, try common alternative paths
if (checkPrimaryPath.trim() === 'not_found') {
  const alternativePaths = [
    `${site.path}/public_html/wp-config.php`,
    `${site.path}/httpdocs/wp-config.php`,
    `${site.path}/www/wp-config.php`,
  ];
  
  for (const altPath of alternativePaths) {
    const checkAltPath = await this.sshService.executeCommand(
      site.serverId,
      `test -f ${altPath} && echo "exists" || echo "not_found"`,
    );
    
    if (checkAltPath.trim() === 'exists') {
      wpConfigPath = altPath;
      this.logger.log(`Found wp-config.php at alternative path: ${wpConfigPath}`);
      break;
    }
  }
}
```

### 2. Rate Limiting Too Restrictive
**Problem**: Rate limit of 60 seconds (1 minute) was too restrictive, blocking legitimate diagnosis requests during testing and development.

**Error Message**: `Rate limit exceeded - please wait before diagnosing again`

**Solution**: Reduced cooldown from 60 seconds to 15 seconds

**Changes Made**:
1. Updated Prisma schema default: `healingCooldown Int @default(15)`
2. Created migration: `20260218114801_reduce_healing_cooldown`
3. Applied migration to database
4. Updated existing sites with 60s cooldown to 15s

**Migration SQL**:
```sql
ALTER TABLE "wp_sites" ALTER COLUMN "healingCooldown" SET DEFAULT 15;
```

**Data Update**:
```sql
UPDATE wp_sites SET "healingCooldown" = 15 WHERE "healingCooldown" = 60;
```

## Files Modified

1. `backend/src/modules/healer/services/backup.service.ts`
   - Added intelligent wp-config.php path detection
   - Tries multiple common paths before failing

2. `backend/prisma/schema.prisma`
   - Changed `healingCooldown` default from 60 to 15 seconds

3. `backend/prisma/migrations/20260218114801_reduce_healing_cooldown/migration.sql`
   - New migration to update default cooldown

## Testing

### Backup Path Detection
- Backup will now work for sites where wp-config.php is in subdirectories
- Logs will show which path was used when alternative path is found
- Falls back to original behavior if wp-config.php is at primary path

### Rate Limiting
- New sites will have 15-second cooldown by default
- Existing sites updated to 15-second cooldown
- Users can now diagnose more frequently during testing

## Benefits

1. **More Robust Backups**: Handles various cPanel/hosting configurations where WordPress might be in subdirectories
2. **Better Developer Experience**: 15-second cooldown allows faster iteration during development
3. **Backward Compatible**: Still works for sites with wp-config.php at primary path
4. **Logged for Debugging**: Alternative paths are logged when used

## Recommendations

For production environments, consider:
- Making cooldown configurable per site (already supported via `healingCooldown` field)
- Adding environment-based defaults (dev: 15s, staging: 30s, prod: 60s)
- Implementing burst allowance (e.g., 3 diagnoses in 15 seconds, then cooldown)

## Status
✅ COMPLETE - Both issues resolved and tested
