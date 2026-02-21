import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from '../ssh-executor.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

@Injectable()
export class BackupStatusService implements IDiagnosisCheckService {
  private readonly logger = new Logger(BackupStatusService.name);

  constructor(
    private readonly sshExecutor: SshExecutorService,
    private readonly prisma: PrismaService,
  ) {}

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
      // 1. Check last backup from our system
      const lastBackup = await this.checkLastBackup(serverId, sitePath);
      if (!lastBackup.exists) {
        issues.push('No backups found');
        score -= 40;
        recommendations.push('Create initial backup');
        recommendations.push('Setup automated backup schedule');
      } else {
        const daysSinceBackup = lastBackup.daysSince;
        if (daysSinceBackup > 7) {
          issues.push(`Last backup was ${daysSinceBackup} days ago`);
          score -= 30;
          recommendations.push('Create fresh backup');
        } else if (daysSinceBackup > 3) {
          issues.push(`Last backup was ${daysSinceBackup} days ago`);
          score -= 15;
          recommendations.push('Consider more frequent backups');
        }
      }

      // 2. Check backup plugins
      const backupPlugins = await this.checkBackupPlugins(serverId, sitePath);
      if (backupPlugins.length === 0) {
        issues.push('No backup plugin installed');
        score -= 20;
        recommendations.push('Install backup plugin (UpdraftPlus, BackupBuddy, etc.)');
      }

      // 3. Check backup directory
      const backupDir = await this.checkBackupDirectory(serverId, sitePath);
      if (backupDir.exists && backupDir.sizeMB > 5000) {
        issues.push(`Large backup directory: ${backupDir.sizeMB}MB`);
        score -= 10;
        recommendations.push('Clean up old backups');
        recommendations.push('Consider offsite backup storage');
      }

      // 4. Check automated backup schedule
      const schedule = await this.checkBackupSchedule(serverId, sitePath);
      if (!schedule.hasSchedule) {
        issues.push('No automated backup schedule');
        score -= 15;
        recommendations.push('Setup automated daily/weekly backups');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 60 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0 ? 'Backup status is good' : `Backup issues: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: { lastBackup, backupPlugins, backupDir, schedule, issues },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Backup check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        recommendations: ['Retry backup check'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async checkLastBackup(serverId: string, sitePath: string): Promise<any> {
    try {
      // Check our healer backups
      const backup = await this.prisma.healer_backups.findFirst({
        where: {
          wp_sites: {
            serverId,
            path: sitePath,
          },
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!backup) {
        return { exists: false, daysSince: 0, date: null };
      }

      const daysSince = Math.floor(
        (Date.now() - backup.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        exists: true,
        daysSince,
        date: backup.createdAt,
        type: backup.backupType,
        sizeMB: backup.fileSize ? Math.round(backup.fileSize / 1024 / 1024) : 0,
      };
    } catch (error) {
      return { exists: false, daysSince: 0, date: null };
    }
  }

  private async checkBackupPlugins(serverId: string, sitePath: string): Promise<any[]> {
    try {
      const command = `cd ${sitePath} && wp plugin list --status=active --format=json --allow-root 2>/dev/null || echo "[]"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const plugins = JSON.parse(result || '[]');

      const backupPlugins = ['updraftplus', 'backupbuddy', 'backup', 'duplicator', 'backwpup'];
      return plugins.filter((p: any) =>
        backupPlugins.some((bp) => p.name?.toLowerCase().includes(bp)),
      );
    } catch (error) {
      return [];
    }
  }

  private async checkBackupDirectory(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `du -sm ${sitePath}/wp-content/backups 2>/dev/null || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const sizeMB = parseInt(result.split('\t')[0] || '0');

      return {
        exists: sizeMB > 0,
        sizeMB,
      };
    } catch (error) {
      return { exists: false, sizeMB: 0 };
    }
  }

  private async checkBackupSchedule(serverId: string, sitePath: string): Promise<any> {
    try {
      // Check for backup-related cron jobs
      const command = `cd ${sitePath} && wp cron event list --format=json --allow-root 2>/dev/null || echo "[]"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const crons = JSON.parse(result || '[]');

      const backupCrons = crons.filter((c: any) =>
        c.hook?.toLowerCase().includes('backup'),
      );

      return {
        hasSchedule: backupCrons.length > 0,
        schedules: backupCrons,
      };
    } catch (error) {
      return { hasSchedule: false, schedules: [] };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.BACKUP_STATUS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Backup Status';
  }

  getDescription(): string {
    return 'Checks last backup date, backup plugins, and automated backup schedule';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.BACKUP_STATUS;
  }
}
