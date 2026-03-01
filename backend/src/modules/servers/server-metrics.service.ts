import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { SSHConnectionService } from './ssh-connection.service';
import { SSHSessionManager } from './ssh-session-manager.service';
import { AuditService } from '../audit/audit.service';
import { parseServiceMetrics } from './parse-service-metrics';

export interface ServerMetricsData {
  // CPU
  cpuUsagePercent: number;
  cpuCores?: number;
  loadAverage1m?: number;
  loadAverage5m?: number;
  loadAverage15m?: number;

  // Memory
  memoryTotalMB: number;
  memoryUsedMB: number;
  memoryFreeMB: number;
  memoryAvailableMB?: number;
  memoryUsagePercent: number;
  swapTotalMB?: number;
  swapUsedMB?: number;
  swapUsagePercent?: number;

  // Disk
  diskTotalGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  diskUsagePercent: number;
  diskReadMBps?: number;
  diskWriteMBps?: number;
  diskIops?: number;

  // Inodes
  inodeTotal?: bigint;
  inodeUsed?: bigint;
  inodeFree?: bigint;
  inodeUsagePercent?: number;
  diskBreakdown?: Array<{
    filesystem: string;
    mountPoint: string;
    diskTotalGB: number;
    diskUsedGB: number;
    diskFreeGB: number;
    diskUsagePercent: number;
    inodeTotal: number;
    inodeUsed: number;
    inodeFree: number;
    inodeUsagePercent: number;
  }>;

  // Network
  networkRxMBps?: number;
  networkTxMBps?: number;
  networkRxTotalMB?: number;
  networkTxTotalMB?: number;

  // System
  uptime: number;
  processCount?: number;
  threadCount?: number;

  // Services
  services?: Array<{
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
  }>;

  // Additional
  detectedOS?: string;
  kernelVersion?: string;
}

@Injectable()
export class ServerMetricsService {
  private readonly logger = new Logger(ServerMetricsService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private sshConnection: SSHConnectionService,
    private sessionManager: SSHSessionManager,
    private audit: AuditService,
  ) {}

  /**
   * Collect metrics from a server via SSH
   */
  async collectMetrics(serverId: string): Promise<ServerMetricsData> {
    const startTime = Date.now();

    try {
      // Get server connection details
      const server = await this.prisma.servers.findUnique({
        where: { id: serverId, deletedAt: null },
      });

      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }

      // Auto-enable metrics if disabled (user explicitly requested collection)
      if (!server.metricsEnabled) {
        this.logger.log(`Auto-enabling metrics for server ${server.name} (${serverId})`);
        await this.prisma.servers.update({
          where: { id: serverId },
          data: { metricsEnabled: true },
        });
      }

      // Get decrypted credentials
      const serverConfig = await this.getServerForConnection(serverId);

      // Prepare SSH config
      const sshConfig = {
        host: serverConfig.host,
        port: serverConfig.port,
        username: serverConfig.username,
        privateKey: serverConfig.credentials.privateKey,
        passphrase: serverConfig.credentials.passphrase,
        password: serverConfig.credentials.password,
      };

      // Collect metrics based on platform
      let metrics: ServerMetricsData;
      if (server.platformType === 'LINUX') {
        metrics = await this.collectLinuxMetrics(sshConfig, serverId);
      } else {
        throw new Error(`Platform ${server.platformType} not supported yet`);
      }

      const collectionLatency = Date.now() - startTime;

      // Store metrics in database
      await this.prisma.server_metrics.create({
        data: {
          serverId,
          cpuUsagePercent: metrics.cpuUsagePercent,
          cpuCores: metrics.cpuCores,
          loadAverage1m: metrics.loadAverage1m,
          loadAverage5m: metrics.loadAverage5m,
          loadAverage15m: metrics.loadAverage15m,
          memoryTotalMB: metrics.memoryTotalMB,
          memoryUsedMB: metrics.memoryUsedMB,
          memoryFreeMB: metrics.memoryFreeMB,
          memoryAvailableMB: metrics.memoryAvailableMB,
          memoryUsagePercent: metrics.memoryUsagePercent,
          swapTotalMB: metrics.swapTotalMB,
          swapUsedMB: metrics.swapUsedMB,
          swapUsagePercent: metrics.swapUsagePercent,
          diskTotalGB: metrics.diskTotalGB,
          diskUsedGB: metrics.diskUsedGB,
          diskFreeGB: metrics.diskFreeGB,
          diskUsagePercent: metrics.diskUsagePercent,
          diskReadMBps: metrics.diskReadMBps,
          diskWriteMBps: metrics.diskWriteMBps,
          diskIops: metrics.diskIops,
          inodeTotal: metrics.inodeTotal,
          inodeUsed: metrics.inodeUsed,
          inodeFree: metrics.inodeFree,
          inodeUsagePercent: metrics.inodeUsagePercent,
          diskBreakdown: metrics.diskBreakdown as any,
          networkRxMBps: metrics.networkRxMBps,
          networkTxMBps: metrics.networkTxMBps,
          networkRxTotalMB: metrics.networkRxTotalMB,
          networkTxTotalMB: metrics.networkTxTotalMB,
          uptime: metrics.uptime,
          processCount: metrics.processCount,
          threadCount: metrics.threadCount,
          detectedOS: metrics.detectedOS,
          kernelVersion: metrics.kernelVersion,
          services: metrics.services as any,
          collectionLatency,
          collectionSuccess: true,
        },
      });

      // Check alert thresholds
      await this.checkAlertThresholds(serverId, metrics, server);

      this.logger.log(
        `Metrics collected for server ${server.name} in ${collectionLatency}ms`,
      );

      // Convert BigInt to string for JSON serialization
      return this.serializeMetrics(metrics);
    } catch (error: any) {
      const collectionLatency = Date.now() - startTime;

      // Check if server still exists before trying to store failed metrics
      const serverExists = await this.prisma.servers.findUnique({
        where: { id: serverId },
        select: { id: true, name: true },
      });

      if (!serverExists) {
        this.logger.warn(
          `Server ${serverId} no longer exists, skipping metrics storage`,
        );
        throw new Error(`Server ${serverId} not found`);
      }

      // Store failed collection only if server exists
      try {
        await this.prisma.server_metrics.create({
          data: {
            serverId,
            cpuUsagePercent: 0,
            memoryTotalMB: 0,
            memoryUsedMB: 0,
            memoryFreeMB: 0,
            memoryUsagePercent: 0,
            diskTotalGB: 0,
            diskUsedGB: 0,
            diskFreeGB: 0,
            diskUsagePercent: 0,
            uptime: 0,
            collectionLatency,
            collectionSuccess: false,
            collectionError: error?.message || 'Unknown error',
          },
        });
      } catch (dbError: any) {
        this.logger.error(
          `Failed to store failed metrics for server ${serverId}: ${dbError.message}`,
        );
      }

      // Log as debug instead of error to reduce noise
      this.logger.debug(
        `Failed to collect metrics for server ${serverExists.name}: ${error?.message || 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Convert BigInt values to strings for JSON serialization
   */
  private serializeMetrics(metrics: ServerMetricsData): ServerMetricsData {
    return {
      ...metrics,
      inodeTotal: metrics.inodeTotal ? metrics.inodeTotal.toString() : undefined,
      inodeUsed: metrics.inodeUsed ? metrics.inodeUsed.toString() : undefined,
      inodeFree: metrics.inodeFree ? metrics.inodeFree.toString() : undefined,
    } as any;
  }

  /**
   * Collect metrics from Linux server
   * OPTIMIZED: Uses centralized session manager for maximum connection reuse
   */
  private async collectLinuxMetrics(
    sshConfig: any,
    serverId: string,
  ): Promise<ServerMetricsData> {
    // Combined command to collect all metrics in one SSH session
    const command = `
      # CPU Usage (from top)
      top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
      
      # CPU Cores
      nproc
      
      # Load Average
      cat /proc/loadavg | awk '{print $1,$2,$3}'
      
      # Memory Info (in MB)
      free -m | awk 'NR==2{printf "%s %s %s %s\\n", $2,$3,$4,$7}'
      
      # Swap Info (in MB)
      free -m | awk 'NR==3{printf "%s %s\\n", $2,$3}'
      
      # Disk Usage (all mounted filesystems, excluding tmpfs/devtmpfs, in MB for precision)
      df -BM -x tmpfs -x devtmpfs | awk 'NR>1 {total+=$2; used+=$3; avail+=$4} END {printf "%d %d %d %.1f\\n", total, used, avail, (used/total)*100}' | sed 's/M//g'
      
      # Inode Usage (aggregated across all filesystems)
      df -i -x tmpfs -x devtmpfs | awk 'NR>1 {total+=$2; used+=$3; avail+=$4} END {printf "%d %d %d %.1f\\n", total, used, avail, (used/total)*100}'
      
      # Disk Breakdown (per filesystem with inodes) - JSON format
      echo "===DISK_BREAKDOWN_START==="
      df -BM -x tmpfs -x devtmpfs | awk 'NR>1 {print $1"|"$6"|"$2"|"$3"|"$4"|"$5}' | sed 's/M//g' | while IFS='|' read -r fs mount total used avail percent; do
        inode_info=\$(df -i "$mount" | awk 'NR==2 {print $2"|"$3"|"$4"|"$5}')
        echo "$fs|$mount|$total|$used|$avail|$percent|$inode_info"
      done
      echo "===DISK_BREAKDOWN_END==="
      
      # Uptime (in seconds)
      cat /proc/uptime | awk '{print int($1)}'
      
      # Process Count
      ps aux | wc -l
      
      # OS Info
      cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2
      
      # Kernel Version
      uname -r
      
      # Network Stats (in bytes, we'll convert to MB)
      cat /proc/net/dev | awk 'NR>2{rx+=$2; tx+=$10} END{printf "%d %d\\n", rx, tx}'
      
      # Service Status - LiteSpeed HTTP Server
      echo "===SERVICE_LSHTTPD_START==="
      systemctl is-active lshttpd 2>/dev/null || echo "inactive"
      systemctl is-enabled lshttpd 2>/dev/null || echo "disabled"
      LSHTTPD_PID=\$(systemctl show lshttpd --property=MainPID --value 2>/dev/null || echo "0")
      echo "\$LSHTTPD_PID"
      LSHTTPD_MEM=\$(systemctl show lshttpd --property=MemoryCurrent --value 2>/dev/null); if [ -n "\$LSHTTPD_MEM" ] && [ "\$LSHTTPD_MEM" != "[not set]" ] && [ "\$LSHTTPD_MEM" != "0" ]; then echo \$((\$LSHTTPD_MEM / 1024 / 1024)); else if [ "\$LSHTTPD_PID" != "0" ]; then ps -p \$LSHTTPD_PID -o rss= 2>/dev/null | awk '{print int($1/1024)}' || echo "0"; else echo "0"; fi; fi
      systemctl show lshttpd --property=NRestarts --value 2>/dev/null || echo "0"
      ps -p \$LSHTTPD_PID -o etimes= 2>/dev/null | tr -d ' ' || echo "0"
      echo "===SERVICE_LSHTTPD_END==="
      
      # Service Status - LiteSpeed Web Server (alternative)
      echo "===SERVICE_LSWS_START==="
      systemctl is-active lsws 2>/dev/null || echo "inactive"
      systemctl is-enabled lsws 2>/dev/null || echo "disabled"
      LSWS_PID=\$(systemctl show lsws --property=MainPID --value 2>/dev/null || echo "0")
      echo "\$LSWS_PID"
      LSWS_MEM=\$(systemctl show lsws --property=MemoryCurrent --value 2>/dev/null); if [ -n "\$LSWS_MEM" ] && [ "\$LSWS_MEM" != "[not set]" ] && [ "\$LSWS_MEM" != "0" ]; then echo \$((\$LSWS_MEM / 1024 / 1024)); else if [ "\$LSWS_PID" != "0" ]; then ps -p \$LSWS_PID -o rss= 2>/dev/null | awk '{print int($1/1024)}' || echo "0"; else echo "0"; fi; fi
      systemctl show lsws --property=NRestarts --value 2>/dev/null || echo "0"
      ps -p \$LSWS_PID -o etimes= 2>/dev/null | tr -d ' ' || echo "0"
      echo "===SERVICE_LSWS_END==="
      
      # Service Status - MySQL/MariaDB
      echo "===SERVICE_MYSQLD_START==="
      systemctl is-active mysqld 2>/dev/null || systemctl is-active mysql 2>/dev/null || systemctl is-active mariadb 2>/dev/null || echo "inactive"
      systemctl is-enabled mysqld 2>/dev/null || systemctl is-enabled mysql 2>/dev/null || systemctl is-enabled mariadb 2>/dev/null || echo "disabled"
      systemctl show mysqld --property=ExecMainPID --value 2>/dev/null || systemctl show mysql --property=ExecMainPID --value 2>/dev/null || systemctl show mariadb --property=ExecMainPID --value 2>/dev/null || echo "0"
      MYSQL_MEM=\$(systemctl show mysqld --property=MemoryCurrent --value 2>/dev/null || systemctl show mysql --property=MemoryCurrent --value 2>/dev/null || systemctl show mariadb --property=MemoryCurrent --value 2>/dev/null); if [ -n "\$MYSQL_MEM" ] && [ "\$MYSQL_MEM" != "[not set]" ]; then echo \$((\$MYSQL_MEM / 1024 / 1024)); else echo "0"; fi
      systemctl show mysqld --property=NRestarts --value 2>/dev/null || systemctl show mysql --property=NRestarts --value 2>/dev/null || systemctl show mariadb --property=NRestarts --value 2>/dev/null || echo "0"
      ps -p \$(systemctl show mysqld --property=ExecMainPID --value 2>/dev/null || systemctl show mysql --property=ExecMainPID --value 2>/dev/null || systemctl show mariadb --property=ExecMainPID --value 2>/dev/null) -o etimes= 2>/dev/null | tr -d ' ' || echo "0"
      mysqladmin -u root status 2>/dev/null | grep -oP 'Threads: \\K[0-9]+' || echo "0"
      echo "===SERVICE_MYSQLD_END==="
      
      # Service Status - Apache HTTP Server
      echo "===SERVICE_APACHE_START==="
      if systemctl list-unit-files 2>/dev/null | grep -qE '^(httpd|apache2)\.service'; then
        APACHE_STATUS=\$(systemctl is-active httpd 2>/dev/null || systemctl is-active apache2 2>/dev/null || echo "inactive")
        APACHE_ENABLED=\$(systemctl is-enabled httpd 2>/dev/null || systemctl is-enabled apache2 2>/dev/null || echo "disabled")
        APACHE_PID=\$(systemctl show httpd --property=MainPID --value 2>/dev/null || systemctl show apache2 --property=MainPID --value 2>/dev/null || echo "0")
        # Verify the PID actually belongs to apache/httpd process
        if [ "\$APACHE_PID" != "0" ] && [ -n "\$APACHE_PID" ]; then
          APACHE_PROC=\$(ps -p \$APACHE_PID -o comm= 2>/dev/null || echo "")
          if echo "\$APACHE_PROC" | grep -qE 'httpd|apache'; then
            echo "\$APACHE_STATUS"
            echo "\$APACHE_ENABLED"
            echo "\$APACHE_PID"
            APACHE_MEM=\$(systemctl show httpd --property=MemoryCurrent --value 2>/dev/null || systemctl show apache2 --property=MemoryCurrent --value 2>/dev/null); if [ -n "\$APACHE_MEM" ] && [ "\$APACHE_MEM" != "[not set]" ]; then echo \$((\$APACHE_MEM / 1024 / 1024)); else echo "0"; fi
            systemctl show httpd --property=NRestarts --value 2>/dev/null || systemctl show apache2 --property=NRestarts --value 2>/dev/null || echo "0"
            ps -p \$APACHE_PID -o etimes= 2>/dev/null | tr -d ' ' || echo "0"
          else
            echo "not-installed"
            echo "disabled"
            echo "0"
            echo "0"
            echo "0"
            echo "0"
          fi
        else
          echo "not-installed"
          echo "disabled"
          echo "0"
          echo "0"
          echo "0"
          echo "0"
        fi
      else
        echo "not-installed"
        echo "disabled"
        echo "0"
        echo "0"
        echo "0"
        echo "0"
      fi
      echo "===SERVICE_APACHE_END==="
      
      # Service Status - Nginx
      echo "===SERVICE_NGINX_START==="
      if systemctl list-unit-files 2>/dev/null | grep -qE '^nginx\.service'; then
        NGINX_STATUS=\$(systemctl is-active nginx 2>/dev/null || echo "inactive")
        NGINX_ENABLED=\$(systemctl is-enabled nginx 2>/dev/null || echo "disabled")
        NGINX_PID=\$(systemctl show nginx --property=MainPID --value 2>/dev/null || echo "0")
        # Verify the PID actually belongs to nginx process
        if [ "\$NGINX_PID" != "0" ] && [ -n "\$NGINX_PID" ]; then
          NGINX_PROC=\$(ps -p \$NGINX_PID -o comm= 2>/dev/null || echo "")
          if echo "\$NGINX_PROC" | grep -q 'nginx'; then
            echo "\$NGINX_STATUS"
            echo "\$NGINX_ENABLED"
            echo "\$NGINX_PID"
            NGINX_MEM=\$(systemctl show nginx --property=MemoryCurrent --value 2>/dev/null); if [ -n "\$NGINX_MEM" ] && [ "\$NGINX_MEM" != "[not set]" ] && [ "\$NGINX_MEM" != "0" ]; then echo \$((\$NGINX_MEM / 1024 / 1024)); else ps -p \$NGINX_PID -o rss= 2>/dev/null | awk '{print int($1/1024)}' || echo "0"; fi
            systemctl show nginx --property=NRestarts --value 2>/dev/null || echo "0"
            ps -p \$NGINX_PID -o etimes= 2>/dev/null | tr -d ' ' || echo "0"
          else
            echo "not-installed"
            echo "disabled"
            echo "0"
            echo "0"
            echo "0"
            echo "0"
          fi
        else
          echo "not-installed"
          echo "disabled"
          echo "0"
          echo "0"
          echo "0"
          echo "0"
        fi
      else
        echo "not-installed"
        echo "disabled"
        echo "0"
        echo "0"
        echo "0"
        echo "0"
      fi
      echo "===SERVICE_NGINX_END==="
    `;

    // Use centralized session manager for maximum reusability
    const result = await this.sessionManager.executeCommand(serverId, command.trim(), 30000);

    if (!result.success || !result.output) {
      throw new Error(`Failed to execute metrics command: ${result.error || 'No output'}`);
    }

    // Parse the output
    const metrics = this.parseLinuxMetricsOutput(result.output);
    
    return metrics;
  }
  
  /**
   * Execute command on an existing SSH client (for connection pooling)
   */
  private async executeCommandOnClient(
    client: any,
    command: string,
    timeout: number,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        resolve({
          success: false,
          error: `Command timeout after ${timeout}ms`,
        });
      }, timeout);
      
      client.exec(command, (err: Error, stream: any) => {
        if (err) {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            error: err.message,
          });
          return;
        }
        
        let output = '';
        let errorOutput = '';
        
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        stream.on('close', (code: number) => {
          clearTimeout(timeoutHandle);
          
          if (code === 0) {
            resolve({
              success: true,
              output: output,
            });
          } else {
            resolve({
              success: false,
              output: output,
              error: errorOutput || `Command exited with code ${code}`,
            });
          }
        });
        
        stream.on('error', (streamErr: Error) => {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            error: streamErr.message,
          });
        });
      });
    });
  }
  
  /**
   * Fallback: Collect metrics using direct connection (no pooling)
   */
  private async collectLinuxMetricsDirectConnection(
    sshConfig: any,
    serverId: string,
  ): Promise<ServerMetricsData> {
    const command = `
      # CPU Usage (from top)
      top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
      
      # CPU Cores
      nproc
      
      # Load Average
      cat /proc/loadavg | awk '{print $1,$2,$3}'
      
      # Memory Info (in MB)
      free -m | awk 'NR==2{printf "%s %s %s %s\\n", $2,$3,$4,$7}'
      
      # Swap Info (in MB)
      free -m | awk 'NR==3{printf "%s %s\\n", $2,$3}'
      
      # Disk Usage (all mounted filesystems, excluding tmpfs/devtmpfs, in MB for precision)
      df -BM -x tmpfs -x devtmpfs | awk 'NR>1 {total+=$2; used+=$3; avail+=$4} END {printf "%d %d %d %.1f\\n", total, used, avail, (used/total)*100}' | sed 's/M//g'
      
      # Inode Usage (aggregated across all filesystems)
      df -i -x tmpfs -x devtmpfs | awk 'NR>1 {total+=$2; used+=$3; avail+=$4} END {printf "%d %d %d %.1f\\n", total, used, avail, (used/total)*100}'
      
      # Disk Breakdown (per filesystem with inodes) - JSON format
      echo "===DISK_BREAKDOWN_START==="
      df -BM -x tmpfs -x devtmpfs | awk 'NR>1 {print $1"|"$6"|"$2"|"$3"|"$4"|"$5}' | sed 's/M//g' | while IFS='|' read -r fs mount total used avail percent; do
        inode_info=\$(df -i "$mount" | awk 'NR==2 {print $2"|"$3"|"$4"|"$5}')
        echo "$fs|$mount|$total|$used|$avail|$percent|$inode_info"
      done
      echo "===DISK_BREAKDOWN_END==="
      
      # Uptime (in seconds)
      cat /proc/uptime | awk '{print int($1)}'
      
      # Process Count
      ps aux | wc -l
      
      # OS Info
      cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2
      
      # Kernel Version
      uname -r
      
      # Network Stats (in bytes, we'll convert to MB)
      cat /proc/net/dev | awk 'NR>2{rx+=$2; tx+=$10} END{printf "%d %d\\n", rx, tx}'
    `;

    const result = await this.sshConnection.executeCommand(
      sshConfig,
      serverId,
      command.trim(),
    );

    if (!result.success || !result.output) {
      throw new Error(`Failed to execute metrics command: ${result.error || 'No output'}`);
    }

    return this.parseLinuxMetricsOutput(result.output);
  }
  
  /**
   * Parse Linux metrics output into structured data
   */
  private parseLinuxMetricsOutput(output: string): ServerMetricsData {
    // Parse the output
    const lines = output.trim().split('\n');
    let lineIndex = 0;

    // CPU Usage
    const cpuUsagePercent = parseFloat(lines[lineIndex++]) || 0;

    // CPU Cores
    const cpuCores = parseInt(lines[lineIndex++]) || 1;

    // Load Average
    const loadAvg = lines[lineIndex++].split(' ');
    const loadAverage1m = parseFloat(loadAvg[0]) || 0;
    const loadAverage5m = parseFloat(loadAvg[1]) || 0;
    const loadAverage15m = parseFloat(loadAvg[2]) || 0;

    // Memory
    const memParts = lines[lineIndex++].split(' ');
    const memoryTotalMB = parseInt(memParts[0]) || 0;
    const memoryUsedMB = parseInt(memParts[1]) || 0;
    const memoryFreeMB = parseInt(memParts[2]) || 0;
    const memoryAvailableMB = parseInt(memParts[3]) || 0;
    const memoryUsagePercent =
      memoryTotalMB > 0 ? (memoryUsedMB / memoryTotalMB) * 100 : 0;

    // Swap
    const swapParts = lines[lineIndex++].split(' ');
    const swapTotalMB = parseInt(swapParts[0]) || 0;
    const swapUsedMB = parseInt(swapParts[1]) || 0;
    const swapUsagePercent =
      swapTotalMB > 0 ? (swapUsedMB / swapTotalMB) * 100 : 0;

    // Disk (convert MB to GB) - now aggregated across all partitions
    const diskParts = lines[lineIndex++].split(' ');
    const diskTotalMB = parseFloat(diskParts[0]) || 0;
    const diskUsedMB = parseFloat(diskParts[1]) || 0;
    const diskFreeMB = parseFloat(diskParts[2]) || 0;
    const diskUsagePercent = parseFloat(diskParts[3]) || 0;
    
    const diskTotalGB = Math.round((diskTotalMB / 1024) * 100) / 100;
    const diskUsedGB = Math.round((diskUsedMB / 1024) * 100) / 100;
    const diskFreeGB = Math.round((diskFreeMB / 1024) * 100) / 100;

    // Inodes (aggregated)
    const inodeParts = lines[lineIndex++].split(' ');
    const inodeTotal = BigInt(inodeParts[0] || 0);
    const inodeUsed = BigInt(inodeParts[1] || 0);
    const inodeFree = BigInt(inodeParts[2] || 0);
    const inodeUsagePercent = parseFloat(inodeParts[3]) || 0;

    // Parse disk breakdown
    const diskBreakdown: Array<{
      filesystem: string;
      mountPoint: string;
      diskTotalGB: number;
      diskUsedGB: number;
      diskFreeGB: number;
      diskUsagePercent: number;
      inodeTotal: number;
      inodeUsed: number;
      inodeFree: number;
      inodeUsagePercent: number;
    }> = [];

    // Find disk breakdown section
    const breakdownStartIndex = lines.findIndex(line => line.includes('===DISK_BREAKDOWN_START==='));
    const breakdownEndIndex = lines.findIndex(line => line.includes('===DISK_BREAKDOWN_END==='));
    
    if (breakdownStartIndex !== -1 && breakdownEndIndex !== -1) {
      for (let i = breakdownStartIndex + 1; i < breakdownEndIndex; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Format: filesystem|mountPoint|diskTotal|diskUsed|diskAvail|diskPercent|inodeTotal|inodeUsed|inodeAvail|inodePercent
        const parts = line.split('|');
        if (parts.length >= 10) {
          const diskTotal = parseFloat(parts[2]) || 0;
          const diskUsed = parseFloat(parts[3]) || 0;
          const diskAvail = parseFloat(parts[4]) || 0;
          const diskPercent = parseFloat(parts[5].replace('%', '')) || 0;
          
          diskBreakdown.push({
            filesystem: parts[0],
            mountPoint: parts[1],
            diskTotalGB: Math.round((diskTotal / 1024) * 100) / 100,
            diskUsedGB: Math.round((diskUsed / 1024) * 100) / 100,
            diskFreeGB: Math.round((diskAvail / 1024) * 100) / 100,
            diskUsagePercent: diskPercent,
            inodeTotal: parseInt(parts[6]) || 0,
            inodeUsed: parseInt(parts[7]) || 0,
            inodeFree: parseInt(parts[8]) || 0,
            inodeUsagePercent: parseFloat(parts[9].replace('%', '')) || 0,
          });
        }
      }
      
      // Update lineIndex to skip breakdown section
      lineIndex = breakdownEndIndex + 1;
    }

    // Uptime
    const uptime = parseInt(lines[lineIndex++]) || 0;

    // Process Count
    const processCount = parseInt(lines[lineIndex++]) || 0;

    // OS Info
    const detectedOS = lines[lineIndex++] || 'Unknown';

    // Kernel Version
    const kernelVersion = lines[lineIndex++] || 'Unknown';

    // Network (convert bytes to MB)
    const netParts = lines[lineIndex++].split(' ');
    const networkRxTotalMB = parseInt(netParts[0]) / (1024 * 1024) || 0;
    const networkTxTotalMB = parseInt(netParts[1]) / (1024 * 1024) || 0;

    const metrics = {
      cpuUsagePercent: Math.round(cpuUsagePercent * 100) / 100,
      cpuCores,
      loadAverage1m: Math.round(loadAverage1m * 100) / 100,
      loadAverage5m: Math.round(loadAverage5m * 100) / 100,
      loadAverage15m: Math.round(loadAverage15m * 100) / 100,
      memoryTotalMB,
      memoryUsedMB,
      memoryFreeMB,
      memoryAvailableMB,
      memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      swapTotalMB,
      swapUsedMB,
      swapUsagePercent: Math.round(swapUsagePercent * 100) / 100,
      diskTotalGB,
      diskUsedGB,
      diskFreeGB,
      diskUsagePercent: Math.round(diskUsagePercent * 100) / 100,
      inodeTotal,
      inodeUsed,
      inodeFree,
      inodeUsagePercent: Math.round(inodeUsagePercent * 100) / 100,
      diskBreakdown: diskBreakdown.length > 0 ? diskBreakdown : undefined,
      uptime,
      processCount,
      detectedOS,
      kernelVersion,
      networkRxTotalMB: Math.round(networkRxTotalMB * 100) / 100,
      networkTxTotalMB: Math.round(networkTxTotalMB * 100) / 100,
      services: parseServiceMetrics(lines),
    };

    // DEBUG: Log parsed services
    this.logger.debug(`Parsed services: ${JSON.stringify(metrics.services)}`);

    return metrics;
  }

  /**
   * Get latest metrics for a server
   */
  async getLatestMetrics(serverId: string) {
    const metrics = await this.prisma.server_metrics.findFirst({
      where: { serverId },
      orderBy: { collectedAt: 'desc' },
    });

    if (!metrics) {
      return null;
    }

    // Convert BigInt to string for JSON serialization
    return {
      ...metrics,
      inodeTotal: metrics.inodeTotal ? metrics.inodeTotal.toString() : null,
      inodeUsed: metrics.inodeUsed ? metrics.inodeUsed.toString() : null,
      inodeFree: metrics.inodeFree ? metrics.inodeFree.toString() : null,
    };
  }

  /**
   * Get metrics history for a server
   */
  async getMetricsHistory(
    serverId: string,
    hours: number = 24,
  ) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const metrics = await this.prisma.server_metrics.findMany({
      where: {
        serverId,
        collectedAt: { gte: since },
        collectionSuccess: true,
      },
      orderBy: { collectedAt: 'asc' },
    });

    // Convert BigInt to string for JSON serialization
    return metrics.map(m => ({
      ...m,
      inodeTotal: m.inodeTotal ? m.inodeTotal.toString() : null,
      inodeUsed: m.inodeUsed ? m.inodeUsed.toString() : null,
      inodeFree: m.inodeFree ? m.inodeFree.toString() : null,
    }));
  }

  /**
   * Get aggregated metrics across all servers
   */
  async getAggregatedMetrics() {
    // Get all servers with metrics enabled
    const servers = await this.prisma.servers.findMany({
      where: {
        deletedAt: null,
        metricsEnabled: true,
      },
      select: { id: true, name: true },
    });

    const aggregated = await Promise.all(
      servers.map(async (server) => {
        const latest = await this.getLatestMetrics(server.id);
        return {
          serverId: server.id,
          serverName: server.name,
          metrics: latest,
        };
      }),
    );

    // Calculate averages
    const validMetrics = aggregated.filter((a) => a.metrics);
    const count = validMetrics.length;

    if (count === 0) {
      return {
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        avgDiskUsage: 0,
        totalServers: servers.length,
        serversWithMetrics: 0,
        servers: aggregated,
      };
    }

    const avgCpuUsage =
      validMetrics.reduce((sum, a) => sum + (a.metrics?.cpuUsagePercent || 0), 0) / count;
    const avgMemoryUsage =
      validMetrics.reduce((sum, a) => sum + (a.metrics?.memoryUsagePercent || 0), 0) / count;
    const avgDiskUsage =
      validMetrics.reduce((sum, a) => sum + (a.metrics?.diskUsagePercent || 0), 0) / count;
    const avgInodeUsage =
      validMetrics.reduce((sum, a) => sum + (a.metrics?.inodeUsagePercent || 0), 0) / count;

    const totalStorageGB = validMetrics.reduce((sum, a) => sum + (a.metrics?.diskTotalGB || 0), 0);
    const usedStorageGB = validMetrics.reduce((sum, a) => sum + (a.metrics?.diskUsedGB || 0), 0);
    const totalNetworkRxMB = validMetrics.reduce((sum, a) => sum + (a.metrics?.networkRxTotalMB || 0), 0);
    const totalNetworkTxMB = validMetrics.reduce((sum, a) => sum + (a.metrics?.networkTxTotalMB || 0), 0);

    const result = {
      avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
      avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
      avgDiskUsage: Math.round(avgDiskUsage * 100) / 100,
      avgInodeUsage: Math.round(avgInodeUsage * 100) / 100,
      totalServers: servers.length,
      serversWithMetrics: count,
      totalStorageGB: Math.round(totalStorageGB * 100) / 100,
      usedStorageGB: Math.round(usedStorageGB * 100) / 100,
      totalNetworkRxMB: Math.round(totalNetworkRxMB * 100) / 100,
      totalNetworkTxMB: Math.round(totalNetworkTxMB * 100) / 100,
      servers: aggregated,
    };

    // Save to history (fire and forget - don't block the response)
    this.saveAggregatedMetricsHistory(result).catch((error) => {
      this.logger.error('Failed to save aggregated metrics history', error);
    });

    return result;
  }

  /**
   * Save aggregated metrics to history table
   */
  private async saveAggregatedMetricsHistory(metrics: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    avgDiskUsage: number;
    avgInodeUsage: number;
    totalServers: number;
    serversWithMetrics: number;
    totalStorageGB: number;
    usedStorageGB: number;
    totalNetworkRxMB: number;
    totalNetworkTxMB: number;
  }) {
    await this.prisma.aggregated_metrics_history.create({
      data: {
        avgCpuUsage: metrics.avgCpuUsage,
        avgMemoryUsage: metrics.avgMemoryUsage,
        avgDiskUsage: metrics.avgDiskUsage,
        avgInodeUsage: metrics.avgInodeUsage,
        totalServers: metrics.totalServers,
        serversWithMetrics: metrics.serversWithMetrics,
        totalStorageGB: metrics.totalStorageGB,
        usedStorageGB: metrics.usedStorageGB,
        totalNetworkRxMB: metrics.totalNetworkRxMB,
        totalNetworkTxMB: metrics.totalNetworkTxMB,
      },
    });
  }

  /**
   * Get aggregated metrics history
   */
  async getAggregatedMetricsHistory(hours: number = 2) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.prisma.aggregated_metrics_history.findMany({
      where: {
        collectedAt: {
          gte: since,
        },
      },
      orderBy: {
        collectedAt: 'asc',
      },
    });
  }

  /**
   * Check alert thresholds and create incidents if exceeded
   */
  private async checkAlertThresholds(
    serverId: string,
    metrics: ServerMetricsData,
    server: any,
  ) {
    const alerts: string[] = [];

    // Check CPU threshold
    if (metrics.cpuUsagePercent >= server.alertCpuThreshold) {
      alerts.push(
        `CPU usage (${metrics.cpuUsagePercent}%) exceeded threshold (${server.alertCpuThreshold}%)`,
      );
    }

    // Check RAM threshold
    if (metrics.memoryUsagePercent >= server.alertRamThreshold) {
      alerts.push(
        `Memory usage (${metrics.memoryUsagePercent}%) exceeded threshold (${server.alertRamThreshold}%)`,
      );
    }

    // Check Disk threshold
    if (metrics.diskUsagePercent >= server.alertDiskThreshold) {
      alerts.push(
        `Disk usage (${metrics.diskUsagePercent}%) exceeded threshold (${server.alertDiskThreshold}%)`,
      );
    }

    // Log alerts (in Phase 2, we'll create incidents here)
    if (alerts.length > 0) {
      await this.audit.log({
        userId: undefined, // SYSTEM actor has no userId
        actorType: 'SYSTEM',
        action: 'METRICS_THRESHOLD_EXCEEDED',
        resource: 'server',
        resourceId: serverId,
        severity: 'WARNING',
        description: `Server "${server.name}" metrics exceeded thresholds`,
        metadata: {
          serverName: server.name,
          alerts,
          metrics: {
            cpu: metrics.cpuUsagePercent,
            memory: metrics.memoryUsagePercent,
            disk: metrics.diskUsagePercent,
          },
        },
      });

      this.logger.warn(
        `Server ${server.name} exceeded thresholds: ${alerts.join(', ')}`,
      );
    }
  }

  /**
   * Get server with decrypted credentials (internal use only)
   */
  private async getServerForConnection(id: string) {
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new Error(`Server ${id} not found`);
    }

    // Decrypt credentials using EncryptionService
    const credentials: any = {};

    if (server.encryptedPrivateKey) {
      credentials.privateKey = await this.encryption.decrypt(server.encryptedPrivateKey);
    }

    if (server.encryptedPassphrase) {
      credentials.passphrase = await this.encryption.decrypt(server.encryptedPassphrase);
    }

    if (server.encryptedPassword) {
      credentials.password = await this.encryption.decrypt(server.encryptedPassword);
    }

    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      credentials,
    };
  }

  /**
   * Clean up old metrics (keep last 24 hours only)
   */
  async cleanupOldMetrics() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const deleted = await this.prisma.server_metrics.deleteMany({
      where: {
        collectedAt: { lt: cutoff },
      },
    });

    this.logger.log(`Cleaned up ${deleted.count} old metrics records`);
    return deleted.count;
  }

  /**
   * Scheduled task: Collect and save aggregated metrics every 5 minutes
   * This ensures we have historical data for the dashboard charts
   */
  @Cron('*/5 * * * *', {
    name: 'collect-aggregated-metrics',
    timeZone: 'UTC',
  })
  async collectAggregatedMetricsScheduled() {
    try {
      this.logger.debug('Running scheduled aggregated metrics collection');
      
      // Get current aggregated metrics
      const metrics = await this.getAggregatedMetrics();
      
      // Save to history (already done in getAggregatedMetrics, but we call it to ensure it runs)
      this.logger.debug(`Aggregated metrics collected: CPU ${metrics.avgCpuUsage}%, Memory ${metrics.avgMemoryUsage}%, Disk ${metrics.avgDiskUsage}%`);
    } catch (error) {
      this.logger.error('Failed to collect scheduled aggregated metrics', error);
    }
  }

  /**
   * Cleanup old aggregated metrics history (keep last 7 days)
   */
  @Cron('0 3 * * *', {
    name: 'cleanup-aggregated-metrics-history',
    timeZone: 'UTC',
  })
  async cleanupAggregatedMetricsHistory() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7); // Keep 7 days

      const deleted = await this.prisma.aggregated_metrics_history.deleteMany({
        where: {
          collectedAt: { lt: cutoff },
        },
      });

      this.logger.log(`Cleaned up ${deleted.count} old aggregated metrics history records`);
      return deleted.count;
    } catch (error) {
      this.logger.error('Failed to cleanup aggregated metrics history', error);
      throw error;
    }
  }
}
