import { Injectable, Logger } from '@nestjs/common';
import { WpCliService } from '../wp-cli.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { createCheckErrorResponse, addRawOutputs } from '../../utils/check-error-handler';

@Injectable()
export class PluginStatusService implements IDiagnosisCheckService {
  private readonly logger = new Logger(PluginStatusService.name);

  constructor(private readonly wpCli: WpCliService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const recommendations: string[] = [];
    const issues: string[] = [];
    let score = 100;

    try {
      // Get all plugins
      const pluginsOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin list --format=json',
      );
      const plugins = JSON.parse(pluginsOutput || '[]');

      const activePlugins = plugins.filter((p: any) => p.status === 'active');
      const inactivePlugins = plugins.filter((p: any) => p.status === 'inactive');
      const mustUsePlugins = plugins.filter((p: any) => p.status === 'must-use');

      // Check for too many plugins
      if (activePlugins.length > 30) {
        issues.push(`High number of active plugins: ${activePlugins.length}`);
        score -= 10;
        recommendations.push('Consider deactivating unused plugins');
      }

      // Check for inactive plugins
      if (inactivePlugins.length > 10) {
        issues.push(`Many inactive plugins: ${inactivePlugins.length}`);
        score -= 5;
        recommendations.push('Delete unused plugins to reduce security risk');
      }

      const status = score >= 80 ? CheckStatus.PASS : CheckStatus.WARNING;
      const message = issues.length === 0
        ? `${activePlugins.length} active plugins, ${inactivePlugins.length} inactive`
        : issues.join(', ');

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: addRawOutputs(
          {
            totalPlugins: plugins.length,
            activePlugins: activePlugins.length,
            inactivePlugins: inactivePlugins.length,
            mustUsePlugins: mustUsePlugins.length,
            issues,
            // Include full plugin list for detailed view
            plugins: plugins.map((p: any) => ({
              name: p.name,
              status: p.status,
              update: p.update,
              version: p.version,
              update_version: p.update_version,
              auto_update: p.auto_update,
            })),
          },
          {
            'wp plugin list': pluginsOutput, // Raw WP-CLI output
          }
        ),
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return createCheckErrorResponse(
        this.getCheckType(),
        error as Error,
        startTime,
      );
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.PLUGIN_STATUS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Plugin Status';
  }

  getDescription(): string {
    return 'Checks plugin status and counts';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.PLUGIN_STATUS;
  }
}
