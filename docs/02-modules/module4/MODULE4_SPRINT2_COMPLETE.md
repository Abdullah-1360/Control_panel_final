# Module 4: Universal Asset Registry - Sprint 2 Complete

## Sprint 2: Discovery Scanners ✅

**Status:** COMPLETE  
**Date:** February 10, 2026  
**Duration:** ~2 hours  
**Test Coverage:** Pending (Sprint 2 Phase 2)

---

## Implemented Features

### 1. Scanner Framework ✅

**Base Infrastructure:**
- `AssetScanner` interface - Contract for all scanners
- `BaseScanner` abstract class - Common functionality
- `ScannerRegistryService` - Scanner management and discovery
- `ScanResult` interface - Standardized scan results
- `DiscoveredAsset` interface - Asset data before database creation

**Key Features:**
- Pluggable scanner architecture
- Automatic asset creation/update (upsert)
- Dry-run mode for testing
- Error handling and reporting
- Scan duration tracking

---

### 2. BullMQ Job Scheduling ✅

**Scan Queue Service:**
- Bull queue integration (`asset-scans` queue)
- Async job processing
- Retry logic (3 attempts with exponential backoff)
- Job status tracking
- Queue statistics
- Queue management (pause/resume/clean)

**Features:**
- Background scan execution
- Job progress tracking
- Automatic retry on failure
- Audit logging for all scans
- Queue health monitoring

---

### 3. WHM Scanner ✅

**Functionality:**
- Discovers cPanel accounts from WHM API
- Creates `SITE_GENERIC` assets
- Syncs metadata (disk usage, domains, suspended status)
- Links assets to server and integration
- Detects stale assets (in DB but not in WHM)
- Marks stale assets as WARNING status

**Metadata Extracted:**
- Username
- Domain
- Disk used/limit
- Suspended status
- Owner
- IP address
- Hosting plan
- Additional domains

**Tags Applied:**
- `whm-sync`
- `suspended` (if applicable)
- `server:{serverName}`

---

### 4. SSH WordPress Scanner ✅

**Functionality:**
- Discovers WordPress installations via SSH
- Searches for `wp-config.php` files
- Parses WordPress configuration
- Detects WordPress version
- Detects PHP version
- Calculates disk usage
- Extracts database credentials (encrypted)
- Creates `SITE_WORDPRESS` assets

**Metadata Extracted:**
- WordPress version
- PHP version
- Installation path
- Disk usage
- Database host/name
- Table prefix

**Secrets Encrypted:**
- Database user
- Database password
- Auth keys (if found)

**Tags Applied:**
- `wordpress`
- `ssh-scan`
- `server:{serverName}`
- `wp:{version}`

**Search Paths:**
- `/var/www`
- `/home`
- Max depth: 6 levels

---

### 5. Auto-Inferred Relationships ✅

**Implemented:**
- Assets automatically linked to servers via `serverId`
- Assets automatically linked to integrations via `integrationId`
- Discovery source tracked (`WHM_SYNC`, `SSH_SCAN`, `MANUAL`)

**Ready for Sprint 3:**
- Site → Database relationships (from wp-config.php)
- Domain → Site relationships (from DNS/config)
- SSL → Domain relationships (from certificate data)

---

### 6. API Endpoints ✅

**Scan Management:**
- `POST /api/v1/assets/scan` - Trigger discovery scan
- `GET /api/v1/assets/scan/scanners` - List available scanners
- `GET /api/v1/assets/scan/jobs/:jobId` - Get scan job status
- `GET /api/v1/assets/scan/queue/stats` - Get queue statistics
- `POST /api/v1/assets/scan/queue/pause` - Pause scan queue
- `POST /api/v1/assets/scan/queue/resume` - Resume scan queue
- `POST /api/v1/assets/scan/queue/clean` - Clean up old jobs

**Scan Request Body:**
```json
{
  "scannerName": "whm-scanner" | "wordpress-scanner",
  "targetId": "server-uuid" | "integration-uuid",
  "targetType": "server" | "integration",
  "fullScan": true,  // Optional: detect stale assets
  "dryRun": false    // Optional: test without creating assets
}
```

**Scan Response:**
```json
{
  "jobId": "12345",
  "status": "QUEUED"
}
```

---

## Scanner Details

### WHM Scanner

**Target:** Integration (WHM/cPanel)  
**Asset Type:** SITE_GENERIC  
**Discovery Source:** WHM_SYNC

**Process:**
1. Validate WHM integration exists and is active
2. Get WHM client from Module 3
3. Call `listAccounts()` API
4. Map each cPanel account to asset
5. Create or update assets in database
6. Detect stale assets (fullScan mode)
7. Mark stale assets as WARNING

**Stale Asset Detection:**
- Compares DB assets with WHM API results
- Assets in DB but not in WHM are marked WARNING
- Adds note with timestamp
- Does not auto-delete (manual review required)

---

### WordPress Scanner

**Target:** Server (SSH)  
**Asset Type:** SITE_WORDPRESS  
**Discovery Source:** SSH_SCAN

**Process:**
1. Validate server exists and is accessible
2. Get server SSH credentials (decrypted)
3. Search for `wp-config.php` files
4. For each WordPress installation:
   - Parse wp-config.php (DB credentials)
   - Detect WordPress version
   - Detect PHP version
   - Calculate disk usage
   - Extract domain from path
5. Create or update assets in database
6. Encrypt database credentials

**Security:**
- Database passwords encrypted with libsodium
- SSH credentials never logged
- Command injection validation
- Sanitized output

---

## Integration Points

### Module 2 (Servers)
- WordPress scanner uses SSH connection service
- Server credentials decrypted for scanning
- Command execution via `executeCommand()`
- Assets linked to servers via `serverId`

### Module 3 (Integrations)
- WHM scanner uses integration adapters
- Client factory provides WHM client
- Assets linked to integrations via `integrationId`
- Integration health status tracked

### Module 1 (Auth & Audit)
- All scans require `assets.create` permission
- Scan jobs audited (queued, completed, failed)
- User ID tracked for all operations
- Audit logs include scan results

---

## Queue Management

### Bull Queue Configuration
- Queue name: `asset-scans`
- Redis-backed job queue
- Retry: 3 attempts with exponential backoff
- Completed jobs: Auto-removed
- Failed jobs: Kept for debugging

### Job States
- `QUEUED` - Waiting to be processed
- `ACTIVE` - Currently processing
- `COMPLETED` - Successfully finished
- `FAILED` - Failed after retries
- `DELAYED` - Scheduled for later

### Queue Operations
- **Pause:** Stop processing new jobs
- **Resume:** Continue processing jobs
- **Clean:** Remove old completed/failed jobs
- **Stats:** View queue health metrics

---

## API Examples

### Trigger WHM Scan
```bash
POST /api/v1/assets/scan
Authorization: Bearer <token>

{
  "scannerName": "whm-scanner",
  "targetId": "integration-uuid",
  "targetType": "integration",
  "fullScan": true
}
```

**Response:**
```json
{
  "jobId": "12345",
  "status": "QUEUED"
}
```

### Trigger WordPress Scan
```bash
POST /api/v1/assets/scan
Authorization: Bearer <token>

{
  "scannerName": "wordpress-scanner",
  "targetId": "server-uuid",
  "targetType": "server",
  "dryRun": false
}
```

### Check Scan Status
```bash
GET /api/v1/assets/scan/jobs/12345
Authorization: Bearer <token>
```

**Response:**
```json
{
  "jobId": "12345",
  "state": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "assetsFound": 15,
    "assetsCreated": 10,
    "assetsUpdated": 5,
    "errors": [],
    "warnings": ["Found 2 stale assets"],
    "duration": 5432,
    "scannedAt": "2026-02-10T23:21:49.000Z"
  }
}
```

### List Available Scanners
```bash
GET /api/v1/assets/scan/scanners
Authorization: Bearer <token>
```

**Response:**
```json
{
  "scanners": [
    {
      "name": "whm-scanner",
      "assetTypes": ["SITE_GENERIC"]
    },
    {
      "name": "wordpress-scanner",
      "assetTypes": ["SITE_WORDPRESS"]
    }
  ]
}
```

### Get Queue Statistics
```bash
GET /api/v1/assets/scan/queue/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "waiting": 2,
  "active": 1,
  "completed": 45,
  "failed": 3,
  "delayed": 0,
  "total": 51
}
```

---

## Files Created

### Scanner Framework
- `backend/src/modules/assets/scanners/scanner.interface.ts`
- `backend/src/modules/assets/scanners/base-scanner.ts`
- `backend/src/modules/assets/scanners/scanner-registry.service.ts`

### Scanners
- `backend/src/modules/assets/scanners/whm-scanner.ts`
- `backend/src/modules/assets/scanners/wordpress-scanner.ts`

### Queue Service
- `backend/src/modules/assets/scan-queue.service.ts`

### Updated Files
- `backend/src/modules/assets/assets.controller.ts` - Added scan endpoints
- `backend/src/modules/assets/assets.module.ts` - Added Bull queue and scanners

---

## What's Next: Sprint 3 - Health Monitoring

### Planned Features:
1. **Health Check Framework**
   - HealthCheckService
   - Check scheduler (Bull queue)
   - Check result storage
   - Alert integration

2. **Site Health Checks**
   - HTTP/HTTPS availability
   - Response time monitoring
   - Status code validation
   - Content verification

3. **SSL Health Checks**
   - Certificate expiry checking
   - Certificate chain validation
   - Domain coverage verification

4. **Domain Health Checks**
   - DNS resolution verification
   - WHOIS expiry checking

5. **State Machine**
   - Lifecycle states (PENDING → ACTIVE → WARNING → ERROR)
   - State transition logic
   - State change notifications
   - State history tracking

---

## Success Criteria

### Completed ✅
- [x] Scanner framework with pluggable architecture
- [x] Bull queue for async job processing
- [x] WHM scanner (cPanel account discovery)
- [x] WordPress scanner (SSH-based discovery)
- [x] Auto-inferred relationships (Server, Integration)
- [x] Stale asset detection (WHM)
- [x] Secrets encryption (database passwords)
- [x] Scan API endpoints
- [x] Queue management endpoints
- [x] Audit logging for all scans

### Pending ⏳
- [ ] Unit tests for scanners (>80% coverage)
- [ ] Integration tests with mock data
- [ ] Performance testing (1000+ assets)
- [ ] SSL scanner (Sprint 2 extension)
- [ ] Domain scanner (Sprint 2 extension)
- [ ] Database scanner (Sprint 2 extension)

---

## Tech Stack Alignment

✅ **Backend:**
- NestJS with TypeScript
- Bull (Redis-based job queue)
- Prisma ORM
- Integration with Module 1 (Auth, Audit, Encryption)
- Integration with Module 2 (SSH Service)
- Integration with Module 3 (Integration Adapters)

✅ **Queue:**
- Bull v3 (consistent with existing queue module)
- Redis for job storage
- Retry logic with exponential backoff
- Job state tracking

✅ **Security:**
- Secrets encrypted with libsodium
- SSH credentials decrypted on-demand
- Command injection validation
- Audit logging for all operations

---

**Status:** Sprint 2 Discovery Scanners - COMPLETE ✅  
**Next:** Sprint 3 Health Monitoring (Site, SSL, Domain checks + State Machine)  
**Estimated Time:** 1-2 days

