# Queue-Based Discovery Enhancement - Complete

## Overview

Enhanced the discovery system to be fully queue-based from the start, eliminating the need for manual "View Details" to trigger metadata/subdomain/tech stack detection. Also added automatic cleanup of queued jobs when a server is deleted.

## What Was Implemented

### 1. Tech Stack Detection Queue ✅

**Problem:** Tech stack was detected during initial discovery (synchronous), not queued for background processing.

**Solution:**
- Created `TechStackDetectionProcessor` to handle tech stack detection in background
- Uses existing `detectTechStack()` method from ApplicationService
- Processes 10 applications concurrently
- Higher priority than metadata collection (priority: 1)

**Files:**
- Created: `backend/src/modules/healer/processors/techstack-detection.processor.ts`
- Modified: `backend/src/modules/healer/services/discovery-queue.service.ts` (added `enqueueTechStackDetection()`)
- Modified: `backend/src/modules/healer/processors/discovery.processor.ts` (enqueues tech stack jobs)
- Modified: `backend/src/modules/healer/healer.module.ts` (registered processor)

### 2. Automatic Queue Cleanup on Server Deletion ✅

**Problem:** When a server is deleted, queued jobs for that server's applications continue to run, wasting resources and potentially causing errors.

**Solution:**
- Added `removeServerJobs()` method to DiscoveryQueueService
- Removes jobs from all three queues (discovery, metadata, subdomain)
- Event-driven architecture using EventBusService
- Servers service emits `SERVER_DELETED` event
- DiscoveryQueueService listens and cleans up automatically

**Files:**
- Modified: `backend/src/modules/healer/services/discovery-queue.service.ts` (added cleanup method and event listener)
- Modified: `backend/src/modules/servers/servers.service.ts` (emits SERVER_DELETED event)

## How It Works Now

### Discovery Flow (Fully Queue-Based)

```
1. User clicks "Discover Applications"
   ↓
2. Discovery job enqueued → DiscoveryProcessor
   ↓
3. Fast discovery (finds domains/paths)
   ↓
4. Creates applications with UNKNOWN tech stack
   ↓
5. For each application, enqueues 3 background jobs:
   - Tech Stack Detection (priority 1) ← NEW
   - Metadata Collection (priority 2)
   - Subdomain Detection (priority 3)
   ↓
6. Background processors handle everything:
   - TechStackDetectionProcessor → detects tech stack
   - MetadataCollectionProcessor → collects metadata
   - SubdomainDetectionProcessor → finds subdomains/addons
   ↓
7. User sees applications immediately with "UNKNOWN" tech stack
   ↓
8. Tech stack updates automatically within seconds
   ↓
9. Metadata and subdomains populate in background
```

### Server Deletion Flow (Automatic Cleanup)

```
1. User deletes server
   ↓
2. ServersService.remove() called
   ↓
3. Server soft-deleted in database
   ↓
4. EventBusService emits SERVER_DELETED event
   ↓
5. DiscoveryQueueService listens to event
   ↓
6. removeServerJobs() called automatically
   ↓
7. Scans all three queues:
   - healer-discovery
   - healer-metadata-collection
   - healer-subdomain-detection
   ↓
8. Removes all jobs matching serverId
   ↓
9. Logs cleanup result
```

## Benefits

### 1. Fully Automated Discovery
- No manual "View Details" needed
- Everything happens in background
- Users see results as they become available
- Better UX with progressive enhancement

### 2. Resource Efficiency
- Queued jobs are cleaned up when server deleted
- No wasted processing on deleted servers
- Prevents errors from processing non-existent servers

### 3. Scalability
- All detection happens in parallel
- Queue concurrency controls resource usage
- Can handle hundreds of applications simultaneously

### 4. Reliability
- Event-driven cleanup is automatic
- No manual intervention needed
- Audit logging for all cleanup operations

## Technical Details

### Queue Configuration

```typescript
Tech Stack Detection:
- Queue: healer-metadata-collection
- Job Name: detect-techstack
- Concurrency: 10
- Priority: 1 (highest)
- Attempts: 2
- Backoff: Exponential (5s, 10s)

Metadata Collection:
- Queue: healer-metadata-collection
- Job Name: collect-metadata
- Concurrency: 10
- Priority: 2 (default)
- Attempts: 2
- Backoff: Exponential (5s, 10s)

Subdomain Detection:
- Queue: healer-subdomain-detection
- Job Name: detect-subdomains
- Concurrency: 10
- Priority: 3 (default)
- Attempts: 2
- Backoff: Exponential (5s, 10s)
```

### Event System

```typescript
Event: SystemEvent.SERVER_DELETED
Payload: {
  serverId: string;
  serverName: string;
  deletedBy: string;
  force: boolean;
}

Listener: DiscoveryQueueService.onModuleInit()
Action: removeServerJobs(serverId)
```

## API Changes

### New Methods

**DiscoveryQueueService:**
```typescript
// Enqueue tech stack detection
async enqueueTechStackDetection(applicationId: string, serverId: string): Promise<void>

// Remove all jobs for a server
async removeServerJobs(serverId: string): Promise<{ removed: number }>
```

### Modified Methods

**DiscoveryProcessor.process():**
- Now enqueues tech stack detection jobs
- Order: Tech Stack → Metadata → Subdomains

**ServersService.remove():**
- Emits SERVER_DELETED event after soft delete
- Triggers automatic queue cleanup

## Testing

### Manual Testing Steps

1. **Test Queue-Based Discovery:**
   ```bash
   # Start discovery
   POST /api/v1/healer/applications/discover-queued
   Body: { serverId: "uuid" }
   
   # Watch applications appear with UNKNOWN tech stack
   GET /api/v1/healer/applications
   
   # Wait 5-10 seconds
   # Tech stacks should update automatically
   GET /api/v1/healer/applications
   
   # Wait 30-60 seconds
   # Metadata and subdomains should populate
   GET /api/v1/healer/applications/:id
   ```

2. **Test Server Deletion Cleanup:**
   ```bash
   # Start discovery for a server
   POST /api/v1/healer/applications/discover-queued
   Body: { serverId: "uuid" }
   
   # Check queue stats (should have jobs)
   GET /api/v1/healer/applications/discovery/stats
   
   # Delete the server
   DELETE /api/v1/servers/:id
   
   # Check queue stats again (jobs should be removed)
   GET /api/v1/healer/applications/discovery/stats
   
   # Check logs for cleanup message
   ```

## Files Modified

### Created
1. `backend/src/modules/healer/processors/techstack-detection.processor.ts`

### Modified
1. `backend/src/modules/healer/services/discovery-queue.service.ts`
   - Added `enqueueTechStackDetection()`
   - Added `removeServerJobs()`
   - Added event listener in `onModuleInit()`

2. `backend/src/modules/healer/processors/discovery.processor.ts`
   - Enqueues tech stack detection jobs

3. `backend/src/modules/healer/healer.module.ts`
   - Registered TechStackDetectionProcessor

4. `backend/src/modules/servers/servers.service.ts`
   - Emits SERVER_DELETED event in `remove()`

## Compilation Status

✅ Backend compiles successfully
✅ All TypeScript errors resolved
✅ Event system properly integrated

## Next Steps (Optional Enhancements)

1. **Progress Tracking for Individual Jobs**
   - Track tech stack detection progress
   - Show "Detecting..." status in UI

2. **Retry Failed Jobs**
   - Add UI to retry failed tech stack detections
   - Bulk retry for all failed jobs

3. **Queue Monitoring**
   - Add tech stack detection to queue stats
   - Show breakdown by job type

4. **Performance Optimization**
   - Cache tech stack detection results
   - Batch process similar applications

---

**Status:** COMPLETE ✅
**Date:** 2026-02-28
**Impact:** High - Fully automated discovery, better UX, resource efficiency
