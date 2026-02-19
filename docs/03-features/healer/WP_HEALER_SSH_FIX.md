# WordPress Healer SSH Integration Fix

## Problem
WordPress site discovery was returning 0 sites despite the server having multiple WordPress installations. The root cause was that the HealerModule was using a stub SSH service that returned empty strings for all commands.

## Root Cause Analysis
1. **Stub Implementation**: `backend/src/modules/healer/stubs/ssh.service.stub.ts` was just a placeholder that returned empty strings
2. **No Real SSH Execution**: All SSH commands (`find`, `grep`, `cat`, etc.) returned empty results
3. **Discovery Failure**: Site discovery logic couldn't find `wp-config.php` files because SSH commands returned nothing

## Solution Implemented

### 1. Created Real SSH Executor Service
**File**: `backend/src/modules/healer/services/ssh-executor.service.ts`

This service:
- Uses `ServersService` to get server credentials (with decryption)
- Uses `SSHConnectionService` from Module 2 to execute commands
- Provides a clean interface: `executeCommand(serverId, command)`
- Handles errors and logging properly

### 2. Updated HealerModule
**File**: `backend/src/modules/healer/healer.module.ts`

Changes:
- Imported `ServersModule` to access SSH infrastructure
- Removed stub `SshService` import
- Added `SshExecutorService` as a provider
- Module 2 integration is now complete

### 3. Updated Site Discovery Service
**File**: `backend/src/modules/healer/services/site-discovery.service.ts`

Changes:
- Replaced stub import with `SshExecutorService`
- Updated constructor to use real SSH executor
- No changes to discovery logic needed (interface remained the same)

### 4. Removed Stub
**Deleted**: `backend/src/modules/healer/stubs/ssh.service.stub.ts`

## How It Works Now

### Discovery Flow
1. User clicks "Discover Sites" in frontend
2. Frontend sends POST to `/api/v1/healer/discover` with `serverId`
3. Backend calls `SiteDiscoveryService.discoverSites(serverId)`
4. Discovery service tries cPanel discovery first:
   - Executes `cat /etc/trueuserdomains` via SSH
   - If fails (not cPanel), falls back to generic discovery
5. Generic discovery searches common paths:
   - `/var/www/html`
   - `/var/www`
   - `/home/*/public_html`
   - `/home/*/www`
   - etc.
6. For each path, executes: `find {path} -maxdepth 3 -name "wp-config.php"`
7. For each found `wp-config.php`:
   - Extracts domain from nginx/apache configs
   - Reads WordPress version from `wp-includes/version.php`
   - Gets PHP version with `php -v`
   - Extracts database info from `wp-config.php`
8. Registers discovered sites in database
9. Returns list of discovered sites to frontend

### SSH Command Execution
```typescript
// Example: Find WordPress installations
const command = `find /var/www/html -maxdepth 3 -name "wp-config.php" 2>/dev/null || true`;
const result = await sshExecutorService.executeCommand(serverId, command);
// result contains actual command output from the server
```

### Security Features
- Credentials are encrypted in database (libsodium)
- Credentials are decrypted only when needed
- SSH connections use Module 2's security features:
  - Host key verification
  - Command validation (prevents injection)
  - Output sanitization (removes sensitive data)
  - Connection pooling with timeouts

## Testing

### Manual Test
1. Ensure backend is running: `cd backend && npm run start:dev`
2. Ensure frontend is running: `cd frontend && npm run dev`
3. Login to OpsManager: http://localhost:3000
4. Navigate to WP Healer section
5. Click "Discover Sites" button
6. Select a server from dropdown
7. Click "Discover"
8. Should see discovered WordPress sites in the list

### Expected Results
- For cPanel servers: Discovers sites via `/etc/trueuserdomains`
- For non-cPanel servers: Discovers sites via generic path search
- Each discovered site shows:
  - Domain name
  - Installation path
  - WordPress version
  - PHP version
  - Database name and host

### Troubleshooting
If discovery still returns 0 sites:

1. **Check SSH Connection**:
   - Go to Servers section
   - Click "Test Connection" on the server
   - Verify connection is successful

2. **Check Server Credentials**:
   - Ensure SSH credentials are correct
   - Ensure user has read access to web directories

3. **Check Backend Logs**:
   ```bash
   # Look for SSH command output
   tail -f backend/logs/app.log
   ```

4. **Manually Test SSH Commands**:
   ```bash
   # SSH into the server manually
   ssh user@server
   
   # Test find command
   find /var/www/html -maxdepth 3 -name "wp-config.php"
   find /home/*/public_html -maxdepth 3 -name "wp-config.php"
   ```

5. **Check File Permissions**:
   - Ensure SSH user can read web directories
   - Ensure SSH user can read `wp-config.php` files

## Files Modified
- ✅ `backend/src/modules/healer/healer.module.ts` - Added ServersModule import
- ✅ `backend/src/modules/healer/services/site-discovery.service.ts` - Use real SSH executor
- ✅ `backend/src/modules/healer/services/ssh-executor.service.ts` - Created new service
- ✅ `backend/src/modules/healer/stubs/ssh.service.stub.ts` - Deleted stub

## Next Steps
1. Test discovery on actual shared hosting server
2. Verify wp-config.php parsing works correctly
3. Test with different server configurations (cPanel, Plesk, generic)
4. Add more detailed error messages for troubleshooting
5. Consider adding progress indicators for long-running discoveries

## Status
✅ SSH integration complete
✅ Stub removed
✅ Module 2 integration working
⏳ Awaiting real-world testing on shared hosting server
