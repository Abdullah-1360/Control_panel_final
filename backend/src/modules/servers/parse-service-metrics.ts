/**
 * Helper function to parse service metrics from command output
 */
export function parseServiceMetrics(lines: string[]): Array<{
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  enabled: boolean;
  uptime?: number;
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  restartCount?: number;
  activeConnections?: number;
  pid?: number;
}> {
  const services: Array<{
    name: string;
    displayName: string;
    status: 'running' | 'stopped' | 'failed' | 'unknown';
    enabled: boolean;
    uptime?: number;
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
    restartCount?: number;
    activeConnections?: number;
    pid?: number;
  }> = [];

  // Parse LiteSpeed HTTP Server (lshttpd)
  const lshttpdStartIndex = lines.findIndex(line => line.includes('===SERVICE_LSHTTPD_START==='));
  const lshttpdEndIndex = lines.findIndex(line => line.includes('===SERVICE_LSHTTPD_END==='));
  if (lshttpdStartIndex !== -1 && lshttpdEndIndex !== -1) {
    const serviceLines = lines.slice(lshttpdStartIndex + 1, lshttpdEndIndex);
    
    // DEBUG: Log raw data
    console.log('[LSHTTPD RAW]', serviceLines);
    
    if (serviceLines.length >= 6) {
      const status = serviceLines[0].trim();
      const enabled = serviceLines[1].trim() === 'enabled';
      const pid = parseInt(serviceLines[2].trim()) || 0;
      const memoryMB = parseInt(serviceLines[3].trim()) || 0;
      const restarts = parseInt(serviceLines[4].trim()) || 0;
      const serviceUptime = parseInt(serviceLines[5].trim()) || 0;

      // DEBUG: Log parsed values
      console.log('[LSHTTPD PARSED]', { status, enabled, pid, memoryMB, restarts, serviceUptime });

      // STRICT: Only add if service is actually running (active status AND has PID)
      // This prevents showing services that exist as unit files but were never started
      if (status === 'active' && pid > 0) {
        services.push({
          name: 'lshttpd',
          displayName: 'LiteSpeed HTTP Server',
          status: 'running',
          enabled,
          uptime: serviceUptime,
          memoryUsageMB: memoryMB,
          restartCount: restarts,
          pid: pid,
        });
      }
    }
  }

  // Parse LiteSpeed Web Server (lsws)
  const lswsStartIndex = lines.findIndex(line => line.includes('===SERVICE_LSWS_START==='));
  const lswsEndIndex = lines.findIndex(line => line.includes('===SERVICE_LSWS_END==='));
  if (lswsStartIndex !== -1 && lswsEndIndex !== -1) {
    const serviceLines = lines.slice(lswsStartIndex + 1, lswsEndIndex);
    if (serviceLines.length >= 6) {
      const status = serviceLines[0].trim();
      const enabled = serviceLines[1].trim() === 'enabled';
      const pid = parseInt(serviceLines[2].trim()) || 0;
      const memoryMB = parseInt(serviceLines[3].trim()) || 0;
      const restarts = parseInt(serviceLines[4].trim()) || 0;
      const serviceUptime = parseInt(serviceLines[5].trim()) || 0;

      // STRICT: Only add if service is actually running (active status AND has PID)
      if (status === 'active' && pid > 0) {
        services.push({
          name: 'lsws',
          displayName: 'LiteSpeed Web Server',
          status: 'running',
          enabled,
          uptime: serviceUptime,
          memoryUsageMB: memoryMB,
          restartCount: restarts,
          pid: pid,
        });
      }
    }
  }

  // Parse MySQL/MariaDB
  const mysqldStartIndex = lines.findIndex(line => line.includes('===SERVICE_MYSQLD_START==='));
  const mysqldEndIndex = lines.findIndex(line => line.includes('===SERVICE_MYSQLD_END==='));
  if (mysqldStartIndex !== -1 && mysqldEndIndex !== -1) {
    const serviceLines = lines.slice(mysqldStartIndex + 1, mysqldEndIndex);
    if (serviceLines.length >= 7) {
      const status = serviceLines[0].trim();
      const enabled = serviceLines[1].trim() === 'enabled';
      const pid = parseInt(serviceLines[2].trim()) || 0;
      const memoryMB = parseInt(serviceLines[3].trim()) || 0;
      const restarts = parseInt(serviceLines[4].trim()) || 0;
      const serviceUptime = parseInt(serviceLines[5].trim()) || 0;
      const connections = parseInt(serviceLines[6].trim()) || 0;

      // STRICT: Only add if service is actually running (active status AND has PID)
      if (status === 'active' && pid > 0) {
        services.push({
          name: 'mysqld',
          displayName: 'MySQL/MariaDB',
          status: 'running',
          enabled,
          uptime: serviceUptime,
          memoryUsageMB: memoryMB,
          restartCount: restarts,
          activeConnections: connections,
          pid: pid,
        });
      }
    }
  }

  // Parse Apache HTTP Server
  const apacheStartIndex = lines.findIndex(line => line.includes('===SERVICE_APACHE_START==='));
  const apacheEndIndex = lines.findIndex(line => line.includes('===SERVICE_APACHE_END==='));
  if (apacheStartIndex !== -1 && apacheEndIndex !== -1) {
    const serviceLines = lines.slice(apacheStartIndex + 1, apacheEndIndex);
    
    // DEBUG: Log raw Apache data
    console.log('[APACHE RAW]', serviceLines);
    
    if (serviceLines.length >= 6) {
      const status = serviceLines[0].trim();
      const enabled = serviceLines[1].trim() === 'enabled';
      const pid = parseInt(serviceLines[2].trim()) || 0;
      const memoryMB = parseInt(serviceLines[3].trim()) || 0;
      const restarts = parseInt(serviceLines[4].trim()) || 0;
      const serviceUptime = parseInt(serviceLines[5].trim()) || 0;

      // DEBUG: Log parsed Apache values
      console.log('[APACHE PARSED]', { status, enabled, pid, memoryMB, restarts, serviceUptime, willAdd: status !== 'not-installed' && status === 'active' && pid > 0 });

      // STRICT: Only add if service is installed, active, and has PID
      if (status !== 'not-installed' && status === 'active' && pid > 0) {
        services.push({
          name: 'apache',
          displayName: 'Apache HTTP Server',
          status: 'running',
          enabled,
          uptime: serviceUptime,
          memoryUsageMB: memoryMB,
          restartCount: restarts,
          pid: pid,
        });
      }
    }
  }

  // Parse Nginx
  const nginxStartIndex = lines.findIndex(line => line.includes('===SERVICE_NGINX_START==='));
  const nginxEndIndex = lines.findIndex(line => line.includes('===SERVICE_NGINX_END==='));
  if (nginxStartIndex !== -1 && nginxEndIndex !== -1) {
    const serviceLines = lines.slice(nginxStartIndex + 1, nginxEndIndex);
    if (serviceLines.length >= 6) {
      const status = serviceLines[0].trim();
      const enabled = serviceLines[1].trim() === 'enabled';
      const pid = parseInt(serviceLines[2].trim()) || 0;
      const memoryMB = parseInt(serviceLines[3].trim()) || 0;
      const restarts = parseInt(serviceLines[4].trim()) || 0;
      const serviceUptime = parseInt(serviceLines[5].trim()) || 0;

      // STRICT: Only add if service is installed, active, and has PID
      if (status !== 'not-installed' && status === 'active' && pid > 0) {
        services.push({
          name: 'nginx',
          displayName: 'Nginx',
          status: 'running',
          enabled,
          uptime: serviceUptime,
          memoryUsageMB: memoryMB,
          restartCount: restarts,
          pid: pid,
        });
      }
    }
  }

  return services;
}
