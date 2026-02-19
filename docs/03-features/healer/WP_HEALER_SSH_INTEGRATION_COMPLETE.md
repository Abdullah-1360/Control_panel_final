# WordPress Healer SSH Integration - COMPLETE ✅

## Summary
Successfully replaced all SSH stub references with real SSH execution using Module 2's infrastructure. The HealerModule now has full SSH command execution capabilities for WordPress site discovery and management.

## Changes Made

### 1. Created SSH Executor Service
**File**: `backend/src/modules/healer/services/ssh-executor.service.ts`
- Wraps Module 2's ServersService and SSHConnectionService
- Provides clean interface: `executeCommand(serverId, command)`
- Handles credential decryption automatically
- Includes proper error handling and logging

### 2. Updated HealerModule Configuration
**File**: `backend/src/modules/healer/healer.module.ts`
- Imported `ServersModule` from Module 2
- Removed stub `SshService` import
- Added `SshExecutorService` as provider
- Module 2 integration complete

### 3. Updated All Service Files
Replaced SSH stub imports with `SshExecutorService` in:
- ✅ `backend/src/modules/healer/services/site-discovery.service.ts`
- ✅ `backend/src/modules/healer/services/diagnosis.service.ts`
- ✅ `backend/src/modules/healer/services/log-analysis.service.ts`
- ✅ `backend/src/modules/healer/services/backup.service.ts`
- ✅ `backend/src/modules/healer/services/wp-cli.service.ts`

### 4. Updated Runbook Files
- ✅ `backend/src/modules/healer/runbooks/wsod-healer.runbook.ts`
- ✅ `backend/src/modules/healer/runbooks/maintenance-healer.runbook.ts`

### 5. Removed Stub
- ✅ Deleted `backend/src/modules/healer/stubs/ssh.service.stub.ts`

## Technical Details

### SSH Command Execution Flow
```
Frontend → HealerController → SiteDiscoveryService
                                      ↓
                              SshExecutorService
                                      ↓
                    ServersService.getServerForConnection()
                    (decrypts credentials from database)
                                      ↓
                    SSHConnectionService.executeCommand()
                    (establishes SSH connection, executes command)
                                      ↓
                              Returns output
```

### Security Features
- Credentials encrypted in database (libsodium)
- Credentials decrypted only when needed
- SSH connections use Module 2's security:
  - Host key verification
  - Command validation (prevents injection)
  - Output sanitization (removes sensitive data)
  - Connection pooling with timeouts

### Discovery Process
1. User clicks "Discover Sites" in frontend
2. Frontend sends POST to `/api/v1/healer/discover` with `serverId`
3. Backend tries cPanel discovery:
   - Executes `cat /etc/trueuserdomains` via SSH
   - If fails (not cPanel), falls back to generic discovery
4. Generic discovery searches common paths:
   - `/var/www/html`
   - `/var/www`
   - `/home/*/public_html`
   - `/home/*/www`
   - etc.
5. For each path: `find {path} -maxdepth 3 -name "wp-config.php"`
6. For each found `wp-config.php`:
   - Extracts domain from nginx/apache configs
   - Reads WordPress version
   - Gets PHP version
   - Extracts database info
7. Registers discovered sites in database
8. Returns list to frontend

## Compilation Status
✅ All TypeScript files compiled successfully
✅ No diagnostics errors
✅ Backend running in watch mode
✅ Changes picked up automatically

## Files Modified (Total: 11)
1. `backend/src/modules/healer/healer.module.ts`
2. `backend/src/modules/healer/services/ssh-executor.service.ts` (NEW)
3. `backend/src/modules/healer/services/site-discovery.service.ts`
4. `backend/src/modules/healer/services/diagnosis.service.ts`
5. `backend/src/modules/healer/services/log-analysis.service.ts`
6. `backend/src/modules/healer/services/backup.service.ts`
7. `backend/src/modules/healer/services/wp-cli.service.ts`
8. `backend/src/modules/healer/runbooks/wsod-healer.runbook.ts`
9. `backend/src/modules/healer/runbooks/maintenance-healer.runbook.ts`
10. `backend/src/modules/healer/stubs/ssh.service.stub.ts` (DELETED)
11. `WP_HEALER_SSH_FIX.md` (Documentation)

## Testing Instructions

### 1. Verify Backend is Running
```bash
ps aux | grep "nest start --watch"
```

### 2. Test Discovery via Frontend
1. Open http://localhost:3000/healer
2. Click "Discover Sites" button
3. Select server from dropdown
4. Click "Discover"
5. Should see discovered WordPress sites

### 3. Test Discovery via API
```bash
# Get access token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsmanager.local","password":"hv+keOpFsSUWNbkP"}' \
  | jq -r '.accessToken')

# Discover sites
curl -X POST http://localhost:3001/api/v1/healer/discover \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"serverId":"cmlm2yik5000b82j1y28twbpz"}' | jq
```

### 4. Check Backend Logs
```bash
# If backend logs to file
tail -f backend/logs/app.log

# Or check terminal where backend is running
```

## Expected Results

### For cPanel Servers
- Discovers sites via `/etc/trueuserdomains`
- Lists all WordPress installations per cPanel user
- Shows domain, path, WP version, PHP version, DB info

### For Non-cPanel Servers (Shared Hosting)
- Falls back to generic discovery
- Searches common web root locations
- Finds `wp-config.php` files
- Extracts domain from nginx/apache configs
- Shows discovered sites with metadata

### If Discovery Returns 0 Sites
Check:
1. SSH connection is working (test in Servers section)
2. SSH user has read access to web directories
3. WordPress installations exist in searched paths
4. `wp-config.php` files are readable by SSH user

## Troubleshooting

### Issue: "No servers available"
**Solution**: Add a server in the Servers section first

### Issue: Discovery returns 0 sites
**Possible causes**:
1. SSH credentials incorrect
2. SSH user lacks permissions
3. WordPress not in searched paths
4. Server is cPanel but `/etc/trueuserdomains` not accessible

**Debug steps**:
```bash
# SSH into server manually
ssh user@server

# Test find command
find /var/www/html -maxdepth 3 -name "wp-config.php"
find /home/*/public_html -maxdepth 3 -name "wp-config.php"

# Check permissions
ls -la /var/www/html
ls -la /home/*/public_html
```

### Issue: Backend not picking up changes
**Solution**: 
```bash
# Restart backend
cd backend
npm run start:dev
```

### Issue: TypeScript compilation errors
**Solution**:
```bash
# Check for errors
cd backend
npm run build

# If errors, check diagnostics
npx tsc --noEmit
```

## Next Steps
1. ✅ SSH integration complete
2. ⏳ Test discovery on actual shared hosting server
3. ⏳ Verify wp-config.php parsing works correctly
4. ⏳ Test with different server configurations
5. ⏳ Add progress indicators for long-running discoveries
6. ⏳ Implement caching for discovered sites
7. ⏳ Add manual site registration option

## Status
✅ **SSH Integration: COMPLETE**
✅ **Compilation: SUCCESS**
✅ **Backend: RUNNING**
⏳ **Real-World Testing: PENDING**

## Notes
- All stub references removed
- Module 2 integration working
- Ready for real-world testing
- Backend auto-restarts on file changes
- Frontend must run in dev mode (`npm run dev`)

---
**Last Updated**: February 15, 2026, 6:40 PM
**Status**: READY FOR TESTING
