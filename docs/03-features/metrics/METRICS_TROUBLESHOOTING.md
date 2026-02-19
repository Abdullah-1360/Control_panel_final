# Metrics Not Updating - Troubleshooting Guide

## Issue
CPU, RAM, and Disk metrics are not displaying or updating in the frontend.

## Root Causes

### 1. No Metrics Collected Yet ✅ MOST LIKELY
**Symptom:** Metrics show "-" or fallback to platform/environment info  
**Cause:** No metrics have been collected from servers yet  
**Solution:** Collect metrics manually (see below)

### 2. Metrics Collection Failing
**Symptom:** Metrics collection returns errors  
**Cause:** SSH connection issues, credential problems, or server unreachable  
**Solution:** Test server connection first, verify credentials

### 3. Frontend Not Polling
**Symptom:** Metrics collected but not showing in UI  
**Cause:** React Query polling not working  
**Solution:** Check browser console for errors, verify API responses

## Quick Fix: Collect Metrics Now

### Option 1: Use the Backend Script (RECOMMENDED)

```bash
cd backend
npm run metrics:collect
```

This will:
- Connect to all servers with `metricsEnabled: true`
- Collect CPU, RAM, Disk, and other metrics
- Store them in the database
- Display results in the terminal

### Option 2: Use the API Directly

```bash
# 1. Login to get access token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsmanager.local","password":"Admin@123"}' \
  | jq -r '.accessToken'

# Save the token
export TOKEN="your-access-token-here"

# 2. Get list of servers
curl http://localhost:3001/api/v1/servers \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | {id, name, host}'

# 3. Collect metrics for each server
curl -X POST http://localhost:3001/api/v1/servers/{SERVER_ID}/metrics/collect \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

### Option 3: Use Frontend UI (Coming Soon)
A "Collect Metrics" button will be added to the UI in Phase 3.

## Verification Steps

### 1. Check if Metrics Were Collected

```bash
# Get latest metrics for a server
curl http://localhost:3001/api/v1/servers/{SERVER_ID}/metrics/latest \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "id": "...",
  "serverId": "...",
  "cpuUsagePercent": 45.2,
  "memoryUsagePercent": 68.5,
  "diskUsagePercent": 72.3,
  "collectionSuccess": true,
  "collectedAt": "2026-02-09T12:34:56.789Z"
}
```

### 2. Check Aggregated Metrics

```bash
curl http://localhost:3001/api/v1/servers/metrics/aggregate \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "avgCpuUsage": 45.2,
  "avgMemoryUsage": 68.5,
  "avgDiskUsage": 72.3,
  "totalServers": 3,
  "serversWithMetrics": 3,
  "servers": [
    {
      "serverId": "...",
      "serverName": "prod-web-01",
      "metrics": {
        "cpuUsagePercent": 45.2,
        "memoryUsagePercent": 68.5,
        "diskUsagePercent": 72.3,
        ...
      }
    }
  ]
}
```

### 3. Check Frontend Display

1. Open http://localhost:3000
2. Navigate to Servers page
3. **Grid View:** Should show CPU/RAM/Disk progress bars
4. **Table View:** Should show metrics in columns
5. **Wait 30 seconds** for automatic refresh

## Common Issues & Solutions

### Issue 1: "Server not found"
**Cause:** Server ID is incorrect or server was deleted  
**Solution:** List servers first to get correct IDs

### Issue 2: "Metrics collection disabled for server"
**Cause:** Server has `metricsEnabled: false`  
**Solution:** Update server to enable metrics:
```bash
curl -X PATCH http://localhost:3001/api/v1/servers/{SERVER_ID} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metricsEnabled": true}'
```

### Issue 3: "Failed to execute metrics command"
**Cause:** SSH connection failed, credentials invalid, or server unreachable  
**Solution:**
1. Test server connection first:
   ```bash
   curl -X POST http://localhost:3001/api/v1/servers/{SERVER_ID}/test \
     -H "Authorization: Bearer $TOKEN"
   ```
2. Check server credentials are correct
3. Verify server is reachable from backend
4. Check SSH key permissions (should be 600)

### Issue 4: "Authentication failed" or "Unauthorized"
**Cause:** Access token expired (24-hour expiry)  
**Solution:** Login again to get a new token

### Issue 5: Metrics Collected But Not Showing in UI
**Cause:** Frontend polling not working or browser cache  
**Solution:**
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Check browser console for errors
3. Verify API response in Network tab
4. Wait 30 seconds for next poll

### Issue 6: Metrics Show Old Data
**Cause:** Metrics not being re-collected  
**Solution:** Run metrics collection script again

## Understanding the Metrics System

### Current State (Phase 2)
- ✅ Backend metrics collection working
- ✅ Frontend display working
- ✅ React Query polling (30s interval)
- ❌ **Manual collection required** (no automatic background jobs)

### How It Works
1. **Collection:** Backend connects via SSH, runs Linux commands, parses output
2. **Storage:** Metrics stored in PostgreSQL `server_metrics` table
3. **Retrieval:** Frontend polls `/servers/metrics/aggregate` every 30 seconds
4. **Display:** Metrics shown as progress bars with color-coded thresholds

### Thresholds
- **CPU:** Green (<70%), Yellow (70-90%), Red (≥90%)
- **RAM:** Green (<75%), Yellow (75-95%), Red (≥95%)
- **Disk:** Green (<70%), Yellow (70-90%), Red (≥90%)

### Data Retention
- **Latest:** Always available via `/metrics/latest`
- **History:** Last 24 hours via `/metrics/history`
- **Cleanup:** Automatic deletion of metrics older than 24 hours

## Next Steps (Phase 3)

### Automatic Collection with BullMQ
- Background job runs every 15 minutes (configurable per server)
- Retry logic for failed collections
- Redis caching for latest metrics
- Dashboard overview with real-time updates

### UI Improvements
- "Collect Now" button on each server card
- "Collect All" button in toolbar
- Last collection timestamp display
- Collection status indicator (collecting, success, failed)

## Testing Checklist

- [ ] Backend is running (`cd backend && npm run start:dev`)
- [ ] Frontend is running (`cd frontend && npm run dev`)
- [ ] At least one server exists in the database
- [ ] Server has `metricsEnabled: true`
- [ ] Server connection test passes
- [ ] Metrics collection script runs successfully
- [ ] API returns metrics data
- [ ] Frontend displays metrics (after 30s refresh)
- [ ] Metrics update when re-collected

## Debug Commands

### Check Backend Logs
```bash
cd backend
# Watch logs for metrics collection
tail -f logs/app.log | grep -i metrics
```

### Check Database
```sql
-- Check if metrics exist
SELECT 
  s.name,
  sm.cpu_usage_percent,
  sm.memory_usage_percent,
  sm.disk_usage_percent,
  sm.collection_success,
  sm.collected_at
FROM server_metrics sm
JOIN servers s ON s.id = sm.server_id
ORDER BY sm.collected_at DESC
LIMIT 10;

-- Check server metrics configuration
SELECT 
  name,
  metrics_enabled,
  metrics_interval,
  alert_cpu_threshold,
  alert_ram_threshold,
  alert_disk_threshold
FROM servers
WHERE deleted_at IS NULL;
```

### Check Frontend Network Requests
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "metrics"
4. Refresh page
5. Check if `/servers/metrics/aggregate` is called
6. Verify response contains metrics data

## Support

If metrics still not working after following this guide:

1. Check backend logs for errors
2. Verify server SSH connection works
3. Test metrics collection manually via API
4. Check browser console for frontend errors
5. Verify React Query is polling (Network tab)

---

**Last Updated:** 2026-02-09  
**Status:** Metrics collection working, manual trigger required  
**Next:** Implement BullMQ for automatic collection (Phase 3)
