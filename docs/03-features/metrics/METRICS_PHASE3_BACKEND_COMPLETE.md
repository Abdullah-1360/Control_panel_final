# Server Metrics Phase 3 - Backend Complete

## Overview
Implemented BullMQ background jobs and Redis caching for automatic metrics collection.

## Implementation Summary

### 1. Dependencies Installed
```bash
npm install bullmq ioredis
```

**Packages:**
- `bullmq` - Redis-based job queue for background processing
- `ioredis` - Redis client for caching

### 2. MetricsQueueService Created

**File:** `backend/src/modules/servers/metrics-queue.service.ts`

**Features:**
- ✅ **Automatic Scheduling** - Schedules metrics collection for all enabled servers on startup
- ✅ **Configurable Intervals** - Per-server `metricsInterval` (default 900s / 15 minutes)
- ✅ **Retry Logic** - 3 attempts with exponential backoff (5s, 10s, 20s)
- ✅ **Concurrency** - Processes 5 servers concurrently
- ✅ **Manual Triggers** - `collectAllMetricsNow()` for immediate collection
- ✅ **Queue Management** - Pause, resume, clean operations
- ✅ **Queue Statistics** - Waiting, active, completed, failed, delayed counts
- ✅ **Redis Caching** - Latest metrics (1h TTL), aggregated metrics (1min TTL)

**Key Methods:**
```typescript
// Scheduling
scheduleAllServers() - Schedule all enabled servers
scheduleServer(id, name, interval) - Schedule specific server
unscheduleServer(id) - Remove schedule

// Manual Collection
collectAllMetricsNow() - Trigger immediate collection for all

// Queue Management
getQueueStats() - Get queue statistics
pauseQueue() - Pause processing
resumeQueue() - Resume processing
cleanQueue() - Clean old jobs

// Redis Caching
cacheLatestMetrics(serverId, metrics) - Cache latest metrics (1h TTL)
getCachedMetrics(serverId) - Get cached metrics
cacheAggregatedMetrics(data) - Cache aggregated (1min TTL)
getCachedAggregatedMetrics() - Get cached aggregated
invalidateAggregatedCache() - Clear aggregated cache
clearAllCache() - Clear all metrics cache
```

**Job Processing:**
- Triggered by: SCHEDULED, MANUAL, RETRY
- Collects metrics via ServerMetricsService
- Caches results in Redis
- Invalidates aggregated cache
- Logs success/failure

**Lifecycle:**
- `onModuleInit()` - Schedules all servers on startup
- `onModuleDestroy()` - Gracefully shuts down queue and Redis connections

### 3. MetricsQueueModule Created

**File:** `backend/src/modules/servers/metrics-queue.module.ts`

**Imports:**
- PrismaModule
- EncryptionModule
- AuditModule

**Providers:**
- MetricsQueueService
- ServerMetricsService
- SSHConnectionService

**Exports:**
- MetricsQueueService

### 4. ServersModule Updated

**File:** `backend/src/modules/servers/servers.module.ts`

**Changes:**
- ✅ Imported MetricsQueueModule
- ✅ Module now has access to queue service

### 5. ServersController Updated

**File:** `backend/src/modules/servers/servers.controller.ts`

**Added Queue Management Endpoints:**

```typescript
POST /api/v1/servers/metrics/collect-all
- Trigger immediate collection for all servers
- Returns: { queued: number, servers: [...] }

GET /api/v1/servers/metrics/queue/stats
- Get queue statistics
- Returns: { waiting, active, completed, failed, delayed, scheduled, repeatableJobs }

POST /api/v1/servers/metrics/queue/pause
- Pause metrics collection queue
- Returns: { message: "Queue paused" }

POST /api/v1/servers/metrics/queue/resume
- Resume metrics collection queue
- Returns: { message: "Queue resumed" }

POST /api/v1/servers/metrics/queue/clean
- Clean up old completed and failed jobs
- Returns: { completedCleaned, failedCleaned }
```

### 6. Redis Caching Strategy

**Latest Metrics Cache:**
- Key: `metrics:latest:{serverId}`
- TTL: 1 hour (3600s)
- Updated: After each successful collection
- Purpose: Fast retrieval without database query

**Aggregated Metrics Cache:**
- Key: `metrics:aggregated`
- TTL: 1 minute (60s)
- Invalidated: After any server collection
- Purpose: Fast dashboard stats

**Cache Flow:**
```
1. Job collects metrics
2. Stores in PostgreSQL
3. Caches in Redis (latest)
4. Invalidates aggregated cache
5. Next aggregated request recalculates and caches
```

## Configuration

### Environment Variables

**Required:**
```env
REDIS_URL="redis://localhost:6379"
```

**Optional (with defaults):**
```env
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"
```

### Server Configuration

**Database Fields:**
- `metricsEnabled` (boolean) - Enable/disable collection
- `metricsInterval` (integer) - Collection interval in seconds (default: 900 = 15 min)
- `alertCpuThreshold` (integer) - CPU alert threshold % (default: 90)
- `alertRamThreshold` (integer) - RAM alert threshold % (default: 95)
- `alertDiskThreshold` (integer) - Disk alert threshold % (default: 90)

## How It Works

### Automatic Collection Flow

```
1. Backend starts
   ↓
2. MetricsQueueService.onModuleInit()
   ↓
3. scheduleAllServers()
   ↓
4. For each server with metricsEnabled=true:
   - Create repeatable job with metricsInterval
   - Job runs every X seconds
   ↓
5. Worker processes job:
   - Calls ServerMetricsService.collectMetrics()
   - Stores in PostgreSQL
   - Caches in Redis
   - Invalidates aggregated cache
   ↓
6. Repeat every metricsInterval
```

### Manual Collection Flow

```
1. User clicks "Collect All" or "Collect Metrics"
   ↓
2. POST /api/v1/servers/metrics/collect-all
   ↓
3. MetricsQueueService.collectAllMetricsNow()
   ↓
4. Adds high-priority jobs for all servers
   ↓
5. Worker processes jobs immediately
   ↓
6. Results cached and stored
```

### Retry Logic

```
Attempt 1: Immediate
   ↓ (fails)
Attempt 2: Wait 5 seconds
   ↓ (fails)
Attempt 3: Wait 10 seconds
   ↓ (fails)
Job marked as failed
```

## Queue Statistics

**Metrics Tracked:**
- `waiting` - Jobs waiting to be processed
- `active` - Jobs currently being processed
- `completed` - Successfully completed jobs
- `failed` - Failed jobs (after all retries)
- `delayed` - Jobs scheduled for future
- `scheduled` - Number of repeatable jobs

**Job Retention:**
- Completed: 1 hour (max 100 jobs)
- Failed: 24 hours (max 500 jobs)

## Testing

### Manual Testing

**1. Start Redis:**
```bash
docker run -d -p 6379:6379 redis:7
# OR
redis-server
```

**2. Start Backend:**
```bash
cd backend
npm run start:dev
```

**3. Check Logs:**
```
[MetricsQueueService] Metrics queue service initialized
[MetricsQueueService] Scheduling metrics collection for X servers
[MetricsQueueService] Scheduled metrics collection for server-name every 900s
```

**4. Test Manual Collection:**
```bash
curl -X POST http://localhost:3001/api/v1/servers/metrics/collect-all \
  -H "Authorization: Bearer $TOKEN"
```

**5. Check Queue Stats:**
```bash
curl http://localhost:3001/api/v1/servers/metrics/queue/stats \
  -H "Authorization: Bearer $TOKEN"
```

**6. Verify Metrics Collected:**
```bash
curl http://localhost:3001/api/v1/servers/metrics/aggregate \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Behavior

**On Startup:**
- All servers with `metricsEnabled=true` are scheduled
- First collection happens immediately
- Subsequent collections every `metricsInterval` seconds

**Manual Collection:**
- Jobs queued with high priority
- Processed immediately (within seconds)
- Results visible in API within 30s (frontend polling)

**Caching:**
- First request: Database query + cache
- Subsequent requests: Cache hit (fast)
- Cache invalidated after new collection

## Performance Impact

### Before (Phase 2):
- Manual collection only
- No background processing
- Database query every request
- No caching

### After (Phase 3):
- Automatic collection every 15 minutes
- Background processing (non-blocking)
- Redis cache (1h TTL for latest, 1min for aggregated)
- Reduced database load

### Resource Usage:
- **Redis Memory**: ~1KB per server (latest metrics)
- **Queue Memory**: Minimal (jobs cleaned regularly)
- **CPU**: Negligible (5 concurrent workers)
- **Network**: 1 SSH connection per server per interval

## Troubleshooting

### Issue: Queue not processing jobs

**Check:**
1. Redis is running: `redis-cli ping` (should return PONG)
2. Backend logs for errors
3. Queue stats: `GET /api/v1/servers/metrics/queue/stats`

**Solution:**
- Restart Redis
- Restart backend
- Check REDIS_URL in .env

### Issue: Metrics not updating

**Check:**
1. Server has `metricsEnabled=true`
2. Queue stats show active/completed jobs
3. Check backend logs for collection errors

**Solution:**
- Enable metrics for server
- Test server connection first
- Check SSH credentials

### Issue: High Redis memory usage

**Check:**
- Number of servers
- Cache TTL settings
- Old keys not expiring

**Solution:**
- Reduce TTL if needed
- Run `clearAllCache()` to reset
- Monitor with `redis-cli info memory`

## Next Steps

### Frontend Updates (Remaining):
1. ✅ Dashboard - Replace mock data with real metrics
2. ✅ Server Detail - Add dashboard tab with metrics
3. ✅ Server Form - Add metrics configuration UI
4. ✅ Queue Management UI - Pause/resume/stats display

### Future Enhancements:
- Metrics history charts (time series)
- Alert notifications (when Module 8 ready)
- Incident creation (when Module 6 ready)
- Custom metrics collection scripts
- Metrics export (CSV, JSON)

## Files Created/Modified

### Created:
- `backend/src/modules/servers/metrics-queue.service.ts`
- `backend/src/modules/servers/metrics-queue.module.ts`
- `METRICS_PHASE3_BACKEND_COMPLETE.md`

### Modified:
- `backend/src/modules/servers/servers.module.ts` (imported MetricsQueueModule)
- `backend/src/modules/servers/servers.controller.ts` (added queue endpoints)
- `backend/package.json` (added bullmq, ioredis)

### Deleted:
- `backend/src/modules/servers/metrics-queue.processor.ts` (replaced by Worker in service)

## Status

✅ **Phase 1 Complete** - Backend metrics collection and storage
✅ **Phase 2 Complete** - Frontend metrics display and real-time updates
✅ **Phase 3 Backend Complete** - BullMQ + Redis + Automatic collection
⏳ **Phase 3 Frontend Pending** - Dashboard updates, configuration UI

---

**Date:** February 9, 2026  
**Module:** Module 2 - Server Connection Management (Metrics Phase 3)  
**Priority:** P1 (High - enables automatic monitoring)
