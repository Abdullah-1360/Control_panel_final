# Backup Subdomain Path Fix

## Issue
When healing a subdomain, the backup service was using the wrong path. It was looking for wp-config.php at the base site path instead of the subdomain path.

**Example**:
- Subdomain path: `/home/x98aailqrs/public_html/testing`
- Backup was looking at: `/home/x98aailqrs/public_html/wp-config.php` ❌
- Should look at: `/home/x98aailqrs/public_html/testing/wp-config.php` ✅

**Error Log**:
```
[Nest] LOG [HealingProcessor] Healing subdomain: testing.uzairfarooq.pk at path: /home/x98aailqrs/public_html/testing
[Nest] LOG [BackupService] Creating FULL backup for site ffea1186-3b62-4188-aa1c-cf7e1cd31fe5
[Nest] ERROR [BackupService] Database backup failed: Command exited with code 1: cat: /home/x98aailqrs/public_html/wp-config.php: No such file or directory
```

## Root Cause

The `HealingProcessor` was correctly determining the subdomain path and creating a `healingSite` object with the correct path:

```typescript
const healingPath = diagnosisDetails.diagnosisPath || site.path;
const healingSite = {
  ...site,
  path: healingPath,  // Correct subdomain path
  domain: healingDomain,
};
```

However, it was then calling:
```typescript
await this.backupService.createBackup(siteId, 'FULL');  // ❌ Passes only siteId
```

The `BackupService.createBackup()` method would then fetch the site from the database using the `siteId`, which returned the base site path, not the subdomain path.

## Solution

Modified `BackupService.createBackup()` to accept either a `siteId` (string) or a `site` object:

**File**: `backend/src/modules/healer/services/backup.service.ts`

```typescript
async createBackup(
  siteIdOrSite: string | any,  // Accept both siteId and site object
  backupType: 'FILE' | 'DATABASE' | 'FULL',
): Promise<any> {
  // Support both siteId (string) and site object
  const site = typeof siteIdOrSite === 'string' 
    ? await this.prisma.wpSite.findUnique({ where: { id: siteIdOrSite } })
    : siteIdOrSite;

  if (!site) {
    throw new Error(`Site not found`);
  }

  const siteId = site.id;
  
  this.logger.log(`Creating ${backupType} backup for site ${siteId}`);
  // ... rest of the method uses the site object
}
```

**File**: `backend/src/modules/healer/processors/healing.processor.ts`

```typescript
// Step 1: Create backup
await this.addExecutionLog(executionId, 'INFO', 'Creating backup...');
const backup = await this.backupService.createBackup(healingSite, 'FULL');  // ✅ Pass site object
await this.addExecutionLog(
  executionId,
  'SUCCESS',
  `Backup created: ${backup.id}`,
);
```

## Benefits

1. **Backward Compatible**: Still accepts `siteId` string for existing code
2. **Flexible**: Can pass site object with custom path for subdomains
3. **Correct Path**: Backup now uses the actual diagnosed path
4. **No Database Refetch**: When site object is passed, no need to query database again

## How It Works

### For Main Domain (existing behavior)
```typescript
await backupService.createBackup(siteId, 'FULL');
// Fetches site from database, uses site.path
```

### For Subdomain (new behavior)
```typescript
const healingSite = {
  ...site,
  path: '/home/x98aailqrs/public_html/testing',  // Subdomain path
  domain: 'testing.uzairfarooq.pk',
};
await backupService.createBackup(healingSite, 'FULL');
// Uses the provided site object with subdomain path
```

## Files Modified

1. `backend/src/modules/healer/services/backup.service.ts`
   - Modified `createBackup()` to accept `siteIdOrSite: string | any`
   - Added type check to handle both string and object

2. `backend/src/modules/healer/processors/healing.processor.ts`
   - Changed `createBackup(siteId, 'FULL')` to `createBackup(healingSite, 'FULL')`
   - Now passes the modified site object with correct subdomain path

## Testing

- Build successful: 0 TypeScript errors
- Backward compatible with existing code
- Subdomain healing will now use correct path for backups
- wp-config.php will be found at the correct location

## Expected Behavior After Fix

**Log Output**:
```
[Nest] LOG [HealingProcessor] Healing subdomain: testing.uzairfarooq.pk at path: /home/x98aailqrs/public_html/testing
[Nest] LOG [BackupService] Creating FULL backup for site ffea1186-3b62-4188-aa1c-cf7e1cd31fe5
[Nest] LOG [BackupService] Using mysqldump for database backup
[Nest] LOG [BackupService] Found wp-config.php at: /home/x98aailqrs/public_html/testing/wp-config.php
[Nest] LOG [BackupService] Backup created: <backup-id>
```

## Status
✅ COMPLETE - Backup now uses correct subdomain path
