import { Injectable, Logger } from '@nestjs/common';
import { WpCliService } from '../wp-cli.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

@Injectable()
export class CoreIntegrityService implements IDiagnosisCheckService {
  private readonly logger = new Logger(CoreIntegrityService.name);

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
      this.logger.log(`Checking core integrity for ${domain}`);

      // Verify core checksums
      const checksumOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'core verify-checksums --skip-plugins --skip-themes',
      );

      const hasErrors = checksumOutput.toLowerCase().includes('error') ||
                       checksumOutput.toLowerCase().includes('fail') ||
                       checksumOutput.toLowerCase().includes('warning');

      if (hasErrors) {
        issues.push('Core file integrity check failed');
        score -= 40;
        recommendations.push('Reinstall WordPress core files');
        recommendations.push('Check for malware or unauthorized modifications');
        recommendations.push('Run: wp core download --skip-content --force');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 50 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0
        ? 'WordPress core files are intact'
        : `Core integrity issues: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          checksumOutput: checksumOutput.substring(0, 1000),
          hasErrors,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Core integrity check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Core integrity check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Verify WP-CLI is installed', 'Check internet connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.CORE_INTEGRITY;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Core Integrity';
  }

  getDescription(): string {
    return 'Verifies WordPress core file checksums';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.CORE_INTEGRITY;
  }
}
