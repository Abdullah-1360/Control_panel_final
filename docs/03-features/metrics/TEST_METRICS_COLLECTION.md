# Testing Metrics Collection

## Issue
CPU, RAM, Disk metrics are not updating in the frontend.

## Root Cause
Metrics need to be collected first! The system doesn't automatically collect metrics yet (BullMQ background jobs not implemented).

## Solution
Manually trigger metrics collection for your servers.

## Steps to Test

### 1. Check if you have servers
```bash
# Login first to get a token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsmanager.local","password":"Admin@123"}'

# Save the accessToken from the response
export TOKEN="your-access-token-here"

# List servers
curl http://localhost:3001/api/v1/servers \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Collect metrics for a server
```bash
# Replace {serverId} with actual server ID
curl -X POST http://localhost:3001/api/v1/servers/{serverId}/metrics/collect \
  -H "Authorization: Bearer $TOKEN"
```

### 3. View collected metrics
```bash
# Get latest metrics
curl http://localhost:3001/api/v1/servers/{serverId}/metrics/latest \
  -H "Authorization: Bearer $TOKEN"

# Get aggregated metrics (for dashboard)
curl http://localhost:3001/api/v1/servers/metrics/aggregate \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Check frontend
- Refresh the Servers page
- Metrics should now appear on server cards
- Wait 30 seconds for automatic refresh

## Expected Response

### Successful Collection:
```json
{
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
  "kernelVersion": "5.15.0-91-generic"
}
```

### Failed Collection:
```json
{
  "error": "Failed to execute metrics command: ...",
  "statusCode": 500
}
```

## Common Issues

### 1. "Server not found"
- Server ID is incorrect
- Server was deleted

### 2. "Metrics collection disabled"
- Server has `metricsEnabled: false`
- Update server to enable metrics

### 3. "Failed to execute metrics command"
- Server credentials are incorrect
- Server is not reachable
- SSH connection failed
- Test the server connection first: `POST /api/v1/servers/{id}/test`

### 4. "Authentication failed"
- Token expired (24 hours)
- Login again to get a new token

## Automation (Phase 3)

Currently, metrics must be collected manually. In Phase 3, we'll add:
- BullMQ background jobs
- Automatic collection every 15 minutes (configurable per server)
- Retry logic for failed collections
- Redis caching for latest metrics

## Quick Fix: Collect All Server Metrics

Create a simple script to collect metrics for all servers:

```bash
#!/bin/bash

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsmanager.local","password":"Admin@123"}' \
  | jq -r '.accessToken')

# Get all servers
SERVERS=$(curl -s http://localhost:3001/api/v1/servers \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[].id')

# Collect metrics for each server
for SERVER_ID in $SERVERS; do
  echo "Collecting metrics for $SERVER_ID..."
  curl -s -X POST http://localhost:3001/api/v1/servers/$SERVER_ID/metrics/collect \
    -H "Authorization: Bearer $TOKEN" \
    | jq '.'
  echo ""
done

echo "Done! Metrics collected for all servers."
```

Save as `collect-metrics.sh`, make executable (`chmod +x collect-metrics.sh`), and run.

## Frontend Behavior

### With Metrics:
- Grid view: Shows CPU/RAM/Disk progress bars
- Table view: Shows metrics in columns
- Colors: Green (normal), Yellow (warning), Red (critical)
- Updates every 30 seconds

### Without Metrics:
- Grid view: Shows platform/environment/auth info
- Table view: Shows "-" in metrics columns
- No errors displayed

## Verification

After collecting metrics, verify in the database:

```sql
-- Check if metrics were collected
SELECT 
  s.name,
  sm.cpu_usage_percent,
  sm.memory_usage_percent,
  sm.disk_usage_percent,
  sm.collected_at,
  sm.collection_success
FROM server_metrics sm
JOIN servers s ON s.id = sm.server_id
ORDER BY sm.collected_at DESC
LIMIT 10;
```

---

**Status:** Metrics collection working, but requires manual trigger  
**Next:** Implement BullMQ background jobs for automatic collection
