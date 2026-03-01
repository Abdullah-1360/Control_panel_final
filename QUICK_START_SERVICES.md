# Quick Start: Service Monitoring

## What's New?

Your OpsManager now automatically monitors web servers and databases across all your servers:
- ✅ **LiteSpeed** (lshttpd, lsws)
- ✅ **Apache** (httpd, apache2)
- ✅ **Nginx**
- ✅ **MySQL/MariaDB**

## How to Use

### 1. Enable Metrics Collection

When creating or editing a server, make sure **"Enable Metrics Collection"** is checked.

### 2. Collect Metrics

**Option A: Manual Collection**
- Go to Servers page
- Click the three dots (⋮) on any server
- Select "Collect Metrics Now"

**Option B: Automatic Collection**
- Metrics are automatically collected every 5 minutes for servers with metrics enabled

### 3. View Services

**Dashboard View:**
1. Go to Dashboard (Overview)
2. Scroll down to "Services Status" section
3. See all services across all servers

**Server Details View:**
1. Go to Servers page
2. Click on any server
3. View services in the server details

## What You'll See

### For Each Service:
- **Status:** Running (green), Stopped (gray), Failed (red)
- **Uptime:** How long the service has been running
- **Memory Usage:** RAM consumed by the service
- **Restart Count:** Number of times service has restarted
- **Auto-start:** Whether service starts on boot
- **Connections:** Active connections (MySQL only)

### Dashboard Statistics:
- Total services across all servers
- Running services count
- Stopped services count
- Failed services count

## Example Scenarios

### Scenario 1: All LiteSpeed Servers
If all your servers use LiteSpeed, you'll see:
```
Services Status
├─ LiteSpeed Web Server (5 servers)
│  ├─ web-01: Running, 2d 5h uptime, 256MB
│  ├─ web-02: Running, 1d 12h uptime, 312MB
│  └─ ...
└─ MySQL/MariaDB (5 servers)
   ├─ web-01: Running, 45 connections
   └─ ...
```

### Scenario 2: Mixed Environment
If you have different web servers:
```
Services Status
├─ LiteSpeed Web Server (2 servers)
│  ├─ web-01: Running
│  └─ web-02: Running
├─ Apache HTTP Server (2 servers)
│  ├─ web-03: Running
│  └─ web-04: Running
├─ Nginx (1 server)
│  └─ web-05: Running
└─ MySQL/MariaDB (5 servers)
   └─ ...
```

### Scenario 3: Service Down
If a service is stopped or failed:
```
Services Status
├─ Apache HTTP Server
│  ├─ web-01: Running ✓
│  └─ web-02: Failed ✗ (highlighted in red)
```

## Troubleshooting

### Service Not Showing Up?

**Check 1:** Is metrics collection enabled?
- Go to server settings
- Verify "Enable Metrics Collection" is checked

**Check 2:** Have metrics been collected?
- Click "Collect Metrics Now" on the server
- Wait 10-30 seconds for collection to complete

**Check 3:** Is the service installed?
- SSH into the server
- Run: `systemctl status servicename`
- If service doesn't exist, it won't show up (this is normal)

### Service Shows as "Stopped"?

This means the service is installed but not running:
```bash
# Start the service
sudo systemctl start servicename

# Enable auto-start on boot
sudo systemctl enable servicename
```

### Service Shows as "Failed"?

This means the service tried to start but encountered an error:
```bash
# Check service logs
sudo journalctl -u servicename -n 50

# Try restarting
sudo systemctl restart servicename
```

## Tips

1. **Regular Monitoring:** Services are automatically checked every 5 minutes
2. **Quick Overview:** Dashboard shows aggregated status across all servers
3. **Detailed View:** Server details page shows per-server service information
4. **Color Coding:** Green = running, Gray = stopped, Red = failed
5. **Memory Tracking:** Monitor which services consume most RAM
6. **Uptime Tracking:** See how long services have been running

## What's Monitored?

### Web Servers
- **LiteSpeed:** Both lshttpd and lsws variants
- **Apache:** Both httpd (Red Hat) and apache2 (Debian) names
- **Nginx:** Standard nginx service

### Database Servers
- **MySQL:** mysqld service name
- **MariaDB:** mariadb service name
- **MySQL (Debian):** mysql service name

### Metrics Collected
- Service status (running/stopped/failed)
- Process ID (PID)
- Memory usage (MB)
- Service uptime (seconds)
- Restart count
- Auto-start enabled/disabled
- Active connections (MySQL only)

## Next Steps

1. **Collect metrics** from all your servers
2. **Check the dashboard** to see service overview
3. **Monitor failed services** and investigate issues
4. **Track resource usage** to optimize server performance

## Need Help?

- Check `SERVICE_MONITORING_IMPLEMENTATION.md` for technical details
- Check `MULTI_WEBSERVER_SUPPORT.md` for multi-server setup info
- Review server logs if services aren't detected correctly

---

**That's it!** Your service monitoring is now active and will automatically detect and monitor all installed web servers and databases across your infrastructure.
