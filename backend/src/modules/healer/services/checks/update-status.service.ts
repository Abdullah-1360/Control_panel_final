import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

@Injectable()
export class UpdateStatusService implements IDiagnosisCheckService {
  private readonly logger = new Logger(UpdateStatusService.name);

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService,
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
      // Check WordPress core updates
      const coreUpdates = await this.checkCoreUpdates(serverId, sitePath);
      if (coreUpdates.available) {
        issues.push(`WordPress ${coreUpdates.current} → ${coreUpdates.latest} available`);
        score -= coreUpdates.isSecurity ? 25 : 15;
        recommendations.push('Update WordPress core');
      }

      // Check plugin updates
      const pluginUpdates = await this.checkPluginUpdates(serverId, sitePath);
      if (pluginUpdates.length > 0) {
        issues.push(`${pluginUpdates.length} plugin updates available`);
        score -= Math.min(20, pluginUpdates.length * 3);
        recommendations.push('Update outdated plugins');
      }

      // Check theme updates
      const themeUpdates = await this.checkThemeUpdates(serverId, sitePath);
      if (themeUpdates.length > 0) {
        issues.push(`${themeUpdates.length} theme updates available`);
        score -= Math.min(15, themeUpdates.length * 5);
        recommendations.push('Update outdated themes');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 60 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0 ? 'All software is up to date' : `Updates available: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: { coreUpdates, pluginUpdates, themeUpdates, issues },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Update check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        recommendations: ['Retry update check'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async checkCoreUpdates(serverId: string, sitePath: string): Promise<any> {
    try {
      const result = await this.wpCli.execute(serverId, sitePath, 'core check-update --format=json', 15000);
      const updates = JSON.parse(result || '[]');
      return {
        available: updates.length > 0,
        current: updates[0]?.version || 'unknown',
        latest: updates[0]?.version || 'unknown',
        isSecurity: updates[0]?.package?.includes('security') || false,
      };
    } catch (error) {
      return { available: false, current: 'unknown', latest: 'unknown', isSecurity: false };
    }
  }

  private async checkPluginUpdates(serverId: string, sitePath: string): Promise<any[]> {
    try {
      const result = await this.wpCli.execute(serverId, sitePath, 'plugin list --update=available --format=json', 15000);
      return JSON.parse(result || '[]');
    } catch (error) {
      return [];
    }
  }

  private async checkThemeUpdates(serverId: string, sitePath: string): Promise<any[]> {
    try {
      const result = await this.wpCli.execute(serverId, sitePath, 'theme list --update=available --format=json', 15000);
      return JSON.parse(result || '[]');
    } catch (error) {
      return [];
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.UPDATE_STATUS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Update Status';
  }

  getDescription(): string {
    return 'Checks for WordPress core, plugin, and theme updates';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.UPDATE_STATUS;
  }
}
