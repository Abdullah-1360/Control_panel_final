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
export class ThemeStatusService implements IDiagnosisCheckService {
  private readonly logger = new Logger(ThemeStatusService.name);

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
      const themesOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'theme list --format=json',
      );
      const themes = JSON.parse(themesOutput || '[]');

      const activeTheme = themes.find((t: any) => t.status === 'active');
      const inactiveThemes = themes.filter((t: any) => t.status === 'inactive');

      if (!activeTheme) {
        issues.push('No active theme found');
        score = 0;
        recommendations.push('Activate a theme');
      }

      if (inactiveThemes.length > 5) {
        issues.push(`Many inactive themes: ${inactiveThemes.length}`);
        score -= 5;
        recommendations.push('Delete unused themes');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 50 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0
        ? `Active theme: ${activeTheme?.name || 'Unknown'}, ${inactiveThemes.length} inactive`
        : issues.join(', ');

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: addRawOutputs(
          {
            activeTheme: activeTheme?.name,
            totalThemes: themes.length,
            inactiveThemes: inactiveThemes.length,
            issues,
            // Include full theme list for detailed view
            themes: themes.map((t: any) => ({
              name: t.name,
              status: t.status,
              update: t.update,
              version: t.version,
              update_version: t.update_version,
            })),
          },
          {
            'wp theme list': themesOutput, // Raw WP-CLI output
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
    return DiagnosisCheckType.THEME_STATUS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Theme Status';
  }

  getDescription(): string {
    return 'Checks theme status and counts';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.THEME_STATUS;
  }
}
