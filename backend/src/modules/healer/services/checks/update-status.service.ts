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
      // Get plugin versions and updates
      const pluginUpdates = await this.checkPluginUpdates(serverId, sitePath);
      const pluginVersions = await this.getPluginVersions(serverId, sitePath);
      
      if (pluginUpdates.length > 0) {
        issues.push(`${pluginUpdates.length} plugin updates available`);
        score -= Math.min(20, pluginUpdates.length * 3);
        recommendations.push('Update outdated plugins');
      }

      // Get theme versions and updates
      const themeUpdates = await this.checkThemeUpdates(serverId, sitePath);
      const themeVersions = await this.getThemeVersions(serverId, sitePath);
      
      if (themeUpdates.length > 0) {
        issues.push(`${themeUpdates.length} theme updates available`);
        score -= Math.min(15, themeUpdates.length * 5);
        recommendations.push('Update outdated themes');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 60 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0 ? 'All plugins and themes are up to date' : `Updates available: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: { 
          pluginVersions, 
          themeVersions, 
          pluginUpdates, 
          themeUpdates, 
          issues 
        },
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

  private async getPluginVersions(serverId: string, sitePath: string): Promise<any[]> {
    try {
      const result = await this.wpCli.execute(
        serverId, 
        sitePath, 
        'plugin list --status=active --format=json --skip-themes', 
        15000
      );
      const plugins = JSON.parse(result || '[]');
      return plugins.map((p: any) => ({
        name: p.name,
        title: p.title || p.name,
        version: p.version,
        status: p.status,
        updateAvailable: p.update !== 'none',
        updateVersion: p.update_version || null,
      }));
    } catch (error) {
      this.logger.warn(`Failed to get plugin versions: ${(error as Error).message}`);
      return [];
    }
  }

  private async getThemeVersions(serverId: string, sitePath: string): Promise<any[]> {
    try {
      const result = await this.wpCli.execute(serverId, sitePath, 'theme list --format=json', 15000);
      const themes = JSON.parse(result || '[]');
      return themes.map((t: any) => ({
        name: t.name,
        title: t.title || t.name,
        version: t.version,
        status: t.status,
        updateAvailable: t.update !== 'none',
        updateVersion: t.update_version || null,
      }));
    } catch (error) {
      this.logger.warn(`Failed to get theme versions: ${(error as Error).message}`);
      return [];
    }
  }

  private async checkPluginUpdates(serverId: string, sitePath: string): Promise<any[]> {
    try {
      const result = await this.wpCli.execute(
        serverId, 
        sitePath, 
        'plugin list --update=available --format=json --skip-themes', 
        15000
      );
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
    return 'Displays plugin and theme versions, and checks for available updates';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.UPDATE_STATUS;
  }
}
