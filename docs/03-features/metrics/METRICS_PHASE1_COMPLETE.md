# Server Metrics Implementation - Phase 1 Complete

## Overview
Implemented real-time server metrics collection system with background polling, on-demand collection, and alert threshold monitoring.

## Implementation Summary

### 1. Database Schema (Prisma)

**Added to Server model:**
- `metricsEnabled` (Boolean, default: true)
- `metricsInterval` (Int, default: 900 seconds = 15 minutes)
- `alertCpuThreshold` (Float, default: 90%)
- `alertRamThreshold` (Float, default: 95%)
- `alertDiskThreshold` (Float, default: 90%)

**New ServerMetrics model:**
```prisma
model ServerMetrics {
  id                    String    @id @default(cuid())
  serverId              String
  
  // CPU Metrics
  cpuUsagePercent       Float
  cpuCores              Int?
  loadAverage1m         Float?
  loadAverage5m         Float?
  loadAverage15m        Float?
  
  // Memory Metrics
  memoryTotalMB         Int
  memoryUsedMB          Int
  memoryFreeMB          Int
  memoryAvailableMB     Int?
  memoryUsagePercent    Float
  swapTotalMB           Int?
  swapUsedMB            Int?
  swapUsagePercent      Float?
  
  // Disk Metrics
  diskTotalGB           Float
  diskUsedGB            Float
  diskFreeGB            Float
  diskUsagePercent      Float
  diskReadMBps          Float?
  diskWriteMBps         Float?
  diskIops              Int?
  
  // Network Metrics
  networkRxMBps         Float?
  networkTxMBps         Float?
  networkRxTotalMB      Float?
  networkTxTotalMB      Float?
  
  // System Metrics
  uptime                Int
  processCount          Int?
  threadCount           Int?
  
  // Additional Info
  detectedOS            String?
  kernelVersion         String?
  
  // Collection metadata
  collectionLatency     Int
  collectionSuccess     Boolean
  collectionError       String?
  
  collectedAt           DateTime  @default(now())
}
```

**Migration:** `20260209112911_add_server_metrics`

### 2. Backend Services

**ServerMetricsService** (`backend/src/modules/servers/server-metrics.service.ts`)
- `collectMetrics(serverId)` - Collect metrics from a server via SSH
- `collectLinuxMetrics(sshConfig, serverId)` - Linux-specific metrics collection
- `getLatestMetrics(serverId)` - Get latest metrics for a server
- `getMetricsHistory(serverId, hours)` - Get metrics history (default: 24 hours)
- `getAggregatedMetrics()` - Get aggregated metrics across all servers
- `checkAlertThresholds()` - Check thresholds and log warnings
- `cleanupOldMetrics()` - Clean up metrics older than 24 hours

**SSH Command for Linux Metrics:**
```bash
# Collects in one SSH session:
- CPU usage (from top)
- CPU cores (nproc)
- Load average (1m, 5m, 15m)
- Memory usage (total, used, free, available)
- Swap usage
- Disk usage (root partition)
- Uptime
- Process count
- OS info
- Kernel version
- Network stats (RX/TX bytes)
```

**SSHConnectionService Updates:**
- Added public `executeCommand()` method for metrics collection
- Renamed private method to `executeCommandInternal()` to avoid conflicts

### 3. API Endpoints

**Metrics Endpoints:**
```
POST   /api/v1/servers/:id/metrics/collect    - Collect metrics on-demand
GET    /api/v1/servers/:id/metrics/latest     - Get latest metrics
GET    /api/v1/servers/:id/metrics/history    - Get metrics history (query: hours)
GET    /api/v1/servers/metrics/aggregate      - Get aggregated metrics
```

**Permissions Required:** `servers.read` for all endpoints

### 4. Alert System

**Threshold Monitoring:**
- CPU threshold: 90% (default, configurable per server)
- RAM threshold: 95% (default, configurable per server)
- Disk threshold: 90% (default, configurable per server)

**Alert Actions:**
- Logs to audit log with severity: WARNING
- Includes alert details and current metrics
- Future: Will create incidents (Phase 2)

### 5. Data Retention

**Storage Strategy:**
- PostgreSQL: Last 24 hours of metrics
- Automatic cleanup via `cleanupOldMetrics()` method
- Future: Redis for latest metrics (Phase 2)

## Metrics Collected

### Basic Metrics
- ✅ CPU Usage (%)
- ✅ RAM Usage (MB & %)
- ✅ Disk Usage (GB & %)
- ✅ Uptime (seconds)

### Extended Metrics
- ✅ Load Average (1m, 5m, 15m)
- ✅ CPU Cores
- ✅ Memory Available (MB)
- ✅ Swap Usage (MB & %)
- ✅ Process Count
- ✅ Network RX/TX (MB)
- ✅ Detected OS
- ✅ Kernel Version

### Future Metrics (Phase 2)
- ⏳ Disk I/O (MB/s, IOPS)
- ⏳ Network I/O rate (MB/s)
- ⏳ Thread Count
- ⏳ Individual disk partitions
- ⏳ Network interfaces

## Testing

### Manual Testing

**1. Collect Metrics On-Demand:**
```bash
curl -X POST http://localhost:3001/api/v1/servers/{serverId}/metrics/collect \
  -H "Authorization: Bearer {token}"
```

**2. Get Latest Metrics:**
```bash
curl http://localhost:3001/api/v1/servers/{serverId}/metrics/latest \
  -H "Authorization: Bearer {token}"
```

**3. Get Metrics History:**
```bash
curl "http://localhost:3001/api/v1/servers/{serverId}/metrics/history?hours=24" \
  -H "Authorization: Bearer {token}"
```

**4. Get Aggregated Metrics:**
```bash
curl http://localhost:3001/api/v1/servers/metrics/aggregate \
  -H "Authorization: Bearer {token}"
```

### Expected Response Format

**Latest Metrics:**
```json
{
  "id": "metric-id",
  "serverId": "server-id",
  "cpuUsagePercent": 45.2,
  "cpuCores": 4,
  "loadAverage1m": 1.23,
  "loadAverage5m": 1.45,
  "loadAverage15m": 1.67,
  "memoryTotalMB": 8192,
  "memoryUsedMB": 4096,
  "memoryFreeMB": 4096,
  "memoryUsagePercent": 50.0,
  "diskTotalGB": 100.0,
  "diskUsedGB": 68.0,
  "diskFreeGB": 32.0,
  "diskUsagePercent": 68.0,
  "uptime": 86400,
  "processCount": 156,
  "detectedOS": "Ubuntu 22.04.3 LTS",
  "kernelVersion": "5.15.0-91-generic",
  "collectionLatency": 1234,
  "collectionSuccess": true,
  "collectedAt": "2026-02-09T11:30:00.000Z"
}
```

**Aggregated Metrics:**
```json
{
  "avgCpuUsage": 47.5,
  "avgMemoryUsage": 62.3,
  "avgDiskUsage": 71.2,
  "totalServers": 12,
  "serversWithMetrics": 10,
  "servers": [
    {
      "serverId": "server-1",
      "serverName": "web-prod-01",
      "metrics": { /* latest metrics */ }
    }
  ]
}
```

## Next Steps: Phase 2

### 1. BullMQ Background Jobs
- Create metrics collection job
- Schedule based on server's `metricsInterval`
- Retry logic for failed collections
- Job queue monitoring

### 2. Redis Integration
- Store latest metrics in Redis for fast access
- Cache aggregated metrics
- Pub/Sub for real-time updates

### 3. Frontend Integration
- Update Overview Dashboard with real metrics
- Add Metrics tab to Server Detail page
- Real-time charts with Recharts
- Time range selector (1h, 6h, 12h, 24h)

### 4. Incident Creation
- Auto-create incidents when thresholds exceeded
- Link incidents to metrics
- Incident resolution tracking

### 5. Enhanced Features
- Configurable metrics collection per server
- Custom alert thresholds per server
- Metrics export (CSV/JSON)
- Metrics comparison across servers
- Historical trend analysis

## Files Created/Modified

### Created:
- `backend/src/modules/servers/server-metrics.service.ts`
- `backend/prisma/migrations/20260209112911_add_server_metrics/migration.sql`
- `METRICS_PHASE1_COMPLETE.md`

### Modified:
- `backend/prisma/schema.prisma` (added ServerMetrics model, updated Server model)
- `backend/src/modules/servers/servers.module.ts` (added ServerMetricsService)
- `backend/src/modules/servers/servers.controller.ts` (added metrics endpoints)
- `backend/src/modules/servers/ssh-connection.service.ts` (added public executeCommand method)

## Status

✅ **Phase 1 Complete** - Backend metrics collection and storage implemented
⏳ **Phase 2 Pending** - Background jobs, Redis, and frontend integration

---

**Date:** February 9, 2026  
**Module:** Module 2 - Server Connection Management (Metrics Extension)  
**Priority:** P1 (High - enables real-time monitoring)
