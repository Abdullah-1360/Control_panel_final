# Multi-Webserver Support Implementation

## Problem
Different servers in the infrastructure use different web servers:
- Some servers use **LiteSpeed** (lshttpd or lsws)
- Some servers use **Apache** (httpd or apache2)
- Some servers use **Nginx**

The system needs to automatically detect and monitor whichever web server is installed on each server.

## Solution

### Automatic Detection
The system now monitors **all common web servers** and only displays the ones that are actually installed on each server:

1. **LiteSpeed HTTP Server** (lshttpd)
2. **LiteSpeed Web Server** (lsws)
3. **Apache HTTP Server** (httpd/apache2)
4. **Nginx**
5. **MySQL/MariaDB** (mysqld/mysql/mariadb)

### How It Works

#### 1. Backend Detection Logic
**File:** `backend/src/modules/servers/parse-service-metrics.ts`

Each service is checked, but only added to the results if it's actually installed:

```typescript
// Only add if service is actually installed (not just inactive)
if (status !== 'inactive' || pid > 0 || enabled) {
  services.push({
    name: 'apache',
    displayName: 'Apache HTTP Server',
    status: status === 'active' ? 'running' : 'stopped',
    enabled,
    // ... other metrics
  });
}
```

**Detection Criteria:**
- Service status is NOT "inactive" (meaning systemd knows about it)
- OR service has a process ID (it's running or was running)
- OR service is enabled for auto-start

This ensures we only show services that are actually installed, not just checked.

#### 2. Service Commands
**File:** `backend/src/modules/servers/server-metrics.service.ts`

The system checks for multiple service names to handle different Linux distributions:

**Apache:**
```bash
systemctl is-active httpd 2>/dev/null || systemctl is-active apache2 2>/dev/null
```
- `httpd` - Red Hat/CentOS/Fedora
- `apache2` - Debian/Ubuntu

**MySQL:**
```bash
systemctl is-active mysqld 2>/dev/null || systemctl is-active mysql 2>/dev/null || systemctl is-active mariadb 2>/dev/null
```
- `mysqld` - Red Hat/CentOS
- `mysql` - Debian/Ubuntu
- `mariadb` - MariaDB installations

**Nginx:**
```bash
systemctl is-active nginx 2>/dev/null
```
- `nginx` - Standard across all distributions

**LiteSpeed:**
```bash
systemctl is-active lshttpd 2>/dev/null  # LiteSpeed HTTP Server
systemctl is-active lsws 2>/dev/null     # LiteSpeed Web Server
```

#### 3. Frontend Display
**Files:** 
- `frontend/components/dashboard/services-overview.tsx`
- `frontend/components/servers/server-services-tab.tsx`

The UI automatically groups services by type and only displays what's detected:

```typescript
// Services are grouped by type
const servicesByType = allServices.reduce((acc, service) => {
  const type = service.name
  if (!acc[type]) {
    acc[type] = []
  }
  acc[type].push(service)
  return acc
}, {} as Record<string, typeof allServices>)
```

## Example Scenarios

### Scenario 1: Server with LiteSpeed
**Server:** web-server-01
**Installed:** LiteSpeed Web Server (lsws)

**Result:**
```
Services Detected:
✓ LiteSpeed Web Server (running)
✓ MySQL/MariaDB (running)
```

### Scenario 2: Server with Apache
**Server:** web-server-02
**Installed:** Apache HTTP Server (httpd)

**Result:**
```
Services Detected:
✓ Apache HTTP Server (running)
✓ MySQL/MariaDB (running)
```

### Scenario 3: Server with Nginx
**Server:** web-server-03
**Installed:** Nginx

**Result:**
```
Services Detected:
✓ Nginx (running)
✓ MySQL/MariaDB (running)
```

### Scenario 4: Server with Multiple Web Servers
**Server:** web-server-04
**Installed:** Apache (stopped), Nginx (running)

**Result:**
```
Services Detected:
○ Apache HTTP Server (stopped)
✓ Nginx (running)
✓ MySQL/MariaDB (running)
```

## Dashboard Display

The dashboard **Services Overview** section will show:

1. **Total Services:** Count of all detected services across all servers
2. **Running:** Count of services currently running
3. **Stopped:** Count of services that are stopped
4. **Failed:** Count of services in failed state

Then grouped cards for each service type:
- **LiteSpeed HTTP Server** - Shows all servers with lshttpd
- **LiteSpeed Web Server** - Shows all servers with lsws
- **Apache HTTP Server** - Shows all servers with Apache
- **Nginx** - Shows all servers with Nginx
- **MySQL/MariaDB** - Shows all servers with MySQL

## Server Details Display

The **Services Tab** on server details page shows:
- All services detected on that specific server
- Detailed metrics for each service
- Color-coded status indicators
- Service-specific information (connections for MySQL, etc.)

## Benefits

1. **Automatic Detection:** No manual configuration needed
2. **Flexible:** Works with any combination of web servers
3. **Clean UI:** Only shows what's actually installed
4. **Accurate:** Uses systemd to detect installed services
5. **Cross-Distribution:** Handles different service names across Linux distributions

## Supported Services

### Web Servers
- ✅ LiteSpeed HTTP Server (lshttpd)
- ✅ LiteSpeed Web Server (lsws)
- ✅ Apache HTTP Server (httpd/apache2)
- ✅ Nginx

### Database Servers
- ✅ MySQL (mysqld/mysql)
- ✅ MariaDB (mariadb)

### Future Additions (Easy to Add)
- PostgreSQL (postgresql)
- Redis (redis-server)
- PHP-FPM (php-fpm)
- Memcached (memcached)
- Varnish (varnish)

## Adding New Services

To add a new service, follow this pattern:

### 1. Add Command in `server-metrics.service.ts`
```bash
echo "===SERVICE_NEWSERVICE_START==="
systemctl is-active newservice 2>/dev/null || echo "inactive"
systemctl is-enabled newservice 2>/dev/null || echo "disabled"
systemctl show newservice --property=ExecMainPID --value 2>/dev/null || echo "0"
systemctl show newservice --property=MemoryCurrent --value 2>/dev/null | awk '{print int($1/1024/1024)}' || echo "0"
systemctl show newservice --property=NRestarts --value 2>/dev/null || echo "0"
ps -p $(systemctl show newservice --property=ExecMainPID --value 2>/dev/null) -o etimes= 2>/dev/null | tr -d ' ' || echo "0"
echo "===SERVICE_NEWSERVICE_END==="
```

### 2. Add Parser in `parse-service-metrics.ts`
```typescript
// Parse New Service
const newserviceStartIndex = lines.findIndex(line => line.includes('===SERVICE_NEWSERVICE_START==='));
const newserviceEndIndex = lines.findIndex(line => line.includes('===SERVICE_NEWSERVICE_END==='));
if (newserviceStartIndex !== -1 && newserviceEndIndex !== -1) {
  const serviceLines = lines.slice(newserviceStartIndex + 1, newserviceEndIndex);
  if (serviceLines.length >= 6) {
    const status = serviceLines[0].trim();
    const enabled = serviceLines[1].trim() === 'enabled';
    const pid = parseInt(serviceLines[2].trim()) || 0;
    const memoryMB = parseInt(serviceLines[3].trim()) || 0;
    const restarts = parseInt(serviceLines[4].trim()) || 0;
    const serviceUptime = parseInt(serviceLines[5].trim()) || 0;

    if (status !== 'inactive' || pid > 0 || enabled) {
      services.push({
        name: 'newservice',
        displayName: 'New Service',
        status: status === 'active' ? 'running' : status === 'failed' ? 'failed' : 'stopped',
        enabled,
        uptime: serviceUptime,
        memoryUsageMB: memoryMB,
        restartCount: restarts,
        pid: pid > 0 ? pid : undefined,
      });
    }
  }
}
```

### 3. Update Frontend Icon (Optional)
```typescript
function ServiceIcon({ name }: { name: string }) {
  if (name.includes('newservice')) {
    return <YourIcon className="h-4 w-4" />
  }
  // ... existing icons
}
```

## Testing

### Test Different Server Configurations

1. **LiteSpeed Server:**
   ```bash
   # Collect metrics from a server with LiteSpeed
   curl -X POST http://localhost:3001/api/v1/servers/{server-id}/metrics/collect
   ```

2. **Apache Server:**
   ```bash
   # Collect metrics from a server with Apache
   curl -X POST http://localhost:3001/api/v1/servers/{server-id}/metrics/collect
   ```

3. **Nginx Server:**
   ```bash
   # Collect metrics from a server with Nginx
   curl -X POST http://localhost:3001/api/v1/servers/{server-id}/metrics/collect
   ```

4. **Mixed Environment:**
   - Collect metrics from all servers
   - Check dashboard shows correct services for each server
   - Verify no duplicate or missing services

### Expected Results

- Each server shows only its installed services
- Dashboard aggregates all services correctly
- No errors for missing services
- Clean, organized display by service type

## Performance Impact

- **Minimal:** Each service check adds ~10-20ms to metrics collection
- **Efficient:** All checks run in single SSH session
- **Scalable:** Works with any number of services
- **Optimized:** Only installed services are displayed

## Troubleshooting

### Service Not Detected

**Problem:** Service is installed but not showing up

**Solution:**
1. Check if service is managed by systemd:
   ```bash
   systemctl status servicename
   ```

2. Check if service name is correct:
   ```bash
   systemctl list-units --type=service | grep servicename
   ```

3. Verify service has been started at least once:
   ```bash
   systemctl enable servicename
   systemctl start servicename
   ```

### Wrong Service Name

**Problem:** Service uses different name on your distribution

**Solution:** Add alternative name to the command:
```bash
systemctl is-active service1 2>/dev/null || systemctl is-active service2 2>/dev/null
```

## Summary

The system now **automatically detects and monitors** all common web servers:
- ✅ LiteSpeed (lshttpd, lsws)
- ✅ Apache (httpd, apache2)
- ✅ Nginx
- ✅ MySQL/MariaDB

**Key Features:**
- Automatic detection (no configuration needed)
- Only shows installed services
- Works across different Linux distributions
- Clean, organized UI
- Easy to extend with new services

**Result:** Each server shows exactly which services it has, making it easy to manage mixed environments with different web servers.
