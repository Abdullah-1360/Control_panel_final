import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { SSHConnectionService } from './ssh-connection.service';
import { AuditService } from '../audit/audit.service';

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

  // Network
  networkRxMBps?: number;
  networkTxMBps?: number;
  networkRxTotalMB?: number;
  networkTxTotalMB?: number;

  // System
  uptime: number;
  processCount?: number;
  threadCount?: number;

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
          ...metrics,
          collectionLatency,
          collectionSuccess: true,
        },
      });

      // Check alert thresholds
      await this.checkAlertThresholds(serverId, metrics, server);

      this.logger.log(
        `Metrics collected for server ${server.name} in ${collectionLatency}ms`,
      );

      return metrics;
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
   * Collect metrics from Linux server
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

    // Parse the output
    const lines = result.output.trim().split('\n');
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

    return {
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
      uptime,
      processCount,
      detectedOS,
      kernelVersion,
      networkRxTotalMB: Math.round(networkRxTotalMB * 100) / 100,
      networkTxTotalMB: Math.round(networkTxTotalMB * 100) / 100,
    };
  }

  /**
   * Get latest metrics for a server
   */
  async getLatestMetrics(serverId: string) {
    const metrics = await this.prisma.server_metrics.findFirst({
      where: { serverId },
      orderBy: { collectedAt: 'desc' },
    });

    return metrics;
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

    return metrics;
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

    return {
      avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
      avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
      avgDiskUsage: Math.round(avgDiskUsage * 100) / 100,
      totalServers: servers.length,
      serversWithMetrics: count,
      servers: aggregated,
    };
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
}
