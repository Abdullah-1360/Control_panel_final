import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

@Injectable()
export class ResourceMonitoringService implements IDiagnosisCheckService {
  private readonly logger = new Logger(ResourceMonitoringService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // 1. Check disk space
      const diskSpace = await this.checkDiskSpace(serverId, sitePath);
      if (diskSpace.usagePercent > 90) {
        issues.push(`Disk usage critical: ${diskSpace.usagePercent}%`);
        score -= 30;
        recommendations.push('Free up disk space immediately');
        recommendations.push('Clean up old files, logs, and backups');
      } else if (diskSpace.usagePercent > 80) {
        issues.push(`Disk usage high: ${diskSpace.usagePercent}%`);
        score -= 15;
        recommendations.push('Monitor disk space closely');
      }

      // 2. Check memory usage
      const memory = await this.checkMemoryUsage(serverId);
      if (memory.usagePercent > 90) {
        issues.push(`Memory usage critical: ${memory.usagePercent}%`);
        score -= 25;
        recommendations.push('Investigate memory-intensive processes');
        recommendations.push('Consider upgrading server memory');
      } else if (memory.usagePercent > 80) {
        issues.push(`Memory usage high: ${memory.usagePercent}%`);
        score -= 10;
        recommendations.push('Monitor memory usage');
      }

      // 3. Check CPU load
      const cpu = await this.checkCPULoad(serverId);
      if (cpu.loadAverage > cpu.cores * 2) {
        issues.push(`High CPU load: ${cpu.loadAverage} (${cpu.cores} cores)`);
        score -= 20;
        recommendations.push('Investigate CPU-intensive processes');
        recommendations.push('Optimize slow queries and scripts');
      }

      // 4. Check inode usage
      const inodes = await this.checkInodeUsage(serverId, sitePath);
      if (inodes.usagePercent > 90) {
        issues.push(`Inode usage critical: ${inodes.usagePercent}%`);
        score -= 20;
        recommendations.push('Delete unnecessary files');
        recommendations.push('Clean up cache and session files');
      }

      // 5. Check log file sizes
      const logs = await this.checkLogSizes(serverId, sitePath);
      if (logs.totalSizeMB > 1000) {
        issues.push(`Large log files: ${logs.totalSizeMB}MB`);
        score -= 10;
        recommendations.push('Rotate and compress log files');
        recommendations.push('Setup log rotation');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 60 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0 ? 'Resource usage is normal' : `Resource issues: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: { diskSpace, memory, cpu, inodes, logs, issues },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Resource check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        recommendations: ['Retry resource check'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async checkDiskSpace(serverId: string, sitePath: string): Promise<any> {
    try {
      // Try to get cPanel user quota first
      const username = await this.getCpanelUsername(serverId, sitePath);
      
      if (username) {
        // Get user-specific disk quota from cPanel
        const quotaCommand = `quota -s ${username} 2>/dev/null | tail -1 | awk '{print $2, $3}'`;
        const quotaResult = await this.sshExecutor.executeCommand(serverId, quotaCommand, 10000);
        
        if (quotaResult && quotaResult.trim()) {
          const [used, limit] = quotaResult.trim().split(' ');
          const usedGB = this.parseSize(used);
          const limitGB = this.parseSize(limit);
          
          if (limitGB > 0) {
            const usagePercent = Math.round((usedGB / limitGB) * 100);
            const availableGB = limitGB - usedGB;
            
            return {
              usagePercent,
              available: `${availableGB.toFixed(2)}GB`,
              used: `${usedGB.toFixed(2)}GB`,
              limit: `${limitGB.toFixed(2)}GB`,
              type: 'user-quota'
            };
          }
        }
      }
      
      // Fallback to directory-specific disk usage
      const command = `df -h ${sitePath} | tail -1 | awk '{print $5 " " $4}'`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      const [usageStr, available] = result.trim().split(' ');
      const usagePercent = parseInt(usageStr.replace('%', ''));

      return {
        usagePercent,
        available,
        type: 'filesystem'
      };
    } catch (error) {
      return { usagePercent: 0, available: 'unknown', type: 'error' };
    }
  }

  private async getCpanelUsername(serverId: string, sitePath: string): Promise<string | null> {
    try {
      // Extract username from path (typically /home/username/public_html)
      const pathParts = sitePath.split('/');
      const homeIndex = pathParts.indexOf('home');
      
      if (homeIndex >= 0 && pathParts.length > homeIndex + 1) {
        return pathParts[homeIndex + 1];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private parseSize(sizeStr: string): number {
    // Parse sizes like "1.5G", "500M", "1024K" to GB
    const match = sizeStr.match(/^([\d.]+)([KMGT]?)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
      case 'K': return value / 1024 / 1024;
      case 'M': return value / 1024;
      case 'G': return value;
      case 'T': return value * 1024;
      default: return value / 1024 / 1024 / 1024; // Assume bytes
    }
  }

  private async checkMemoryUsage(serverId: string): Promise<any> {
    try {
      const command = `free | grep Mem | awk '{print ($3/$2) * 100.0}'`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      const usagePercent = Math.round(parseFloat(result.trim()));

      return { usagePercent };
    } catch (error) {
      return { usagePercent: 0 };
    }
  }

  private async checkCPULoad(serverId: string): Promise<any> {
    try {
      const loadCommand = `uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//'`;
      const loadResult = await this.sshExecutor.executeCommand(serverId, loadCommand, 10000);
      const loadAverage = parseFloat(loadResult.trim());

      const coresCommand = `nproc`;
      const coresResult = await this.sshExecutor.executeCommand(serverId, coresCommand, 10000);
      const cores = parseInt(coresResult.trim());

      return {
        loadAverage,
        cores,
        loadPerCore: cores > 0 ? (loadAverage / cores).toFixed(2) : 0,
      };
    } catch (error) {
      return { loadAverage: 0, cores: 1, loadPerCore: 0 };
    }
  }

  private async checkInodeUsage(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `df -i ${sitePath} | tail -1 | awk '{print $5}'`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      const usagePercent = parseInt(result.trim().replace('%', ''));

      return { usagePercent };
    } catch (error) {
      return { usagePercent: 0 };
    }
  }

  private async checkLogSizes(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `du -sm ${sitePath}/wp-content/debug.log ${sitePath}/*.log 2>/dev/null | awk '{sum+=$1} END {print sum}'`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const totalSizeMB = parseInt(result.trim() || '0');

      return { totalSizeMB };
    } catch (error) {
      return { totalSizeMB: 0 };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.RESOURCE_USAGE;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Resource Monitoring';
  }

  getDescription(): string {
    return 'Monitors disk space, memory, CPU load, inodes, and log file sizes';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.RESOURCE_USAGE;
  }
}
