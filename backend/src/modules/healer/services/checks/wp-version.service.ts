import { Injectable, Logger } from '@nestjs/common';
import { WpCliService } from '../wp-cli.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { addRawOutputs } from '../../utils/check-error-handler';

@Injectable()
export class WpVersionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(WpVersionService.name);

  constructor(private readonly wpCli: WpCliService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      const versionOutput = await this.wpCli.execute(serverId, sitePath, 'core version');
      const currentVersion = versionOutput.trim();

      // Check for updates
      const updateOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'core check-update --format=json',
      );
      
      let updates = [];
      try {
        // Clean the output - sometimes WP-CLI adds extra text before/after JSON
        const cleanOutput = updateOutput.trim();
        const jsonStart = cleanOutput.indexOf('[');
        const jsonEnd = cleanOutput.lastIndexOf(']') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonString = cleanOutput.substring(jsonStart, jsonEnd);
          updates = JSON.parse(jsonString);
        } else if (cleanOutput === '' || cleanOutput.toLowerCase().includes('no updates')) {
          updates = []; // No updates available
        } else {
          // Try parsing the full output as fallback
          updates = JSON.parse(cleanOutput || '[]');
        }
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        this.logger.warn(`Failed to parse update check JSON: ${errorMessage}. Output: ${updateOutput}`);
        // If JSON parsing fails, assume no updates available
        updates = [];
      }
      
      const updateAvailable = updates.length > 0;
      const latestVersion = updateAvailable ? updates[0].version : currentVersion;

      let status: CheckStatus;
      let score = 100;
      let message: string;

      if (updateAvailable) {
        status = CheckStatus.WARNING;
        score = 70;
        message = `WordPress ${currentVersion} - Update available: ${latestVersion}`;
        recommendations.push(`Update to WordPress ${latestVersion}`);
        recommendations.push('Backup site before updating');
      } else {
        status = CheckStatus.PASS;
        message = `WordPress ${currentVersion} - Up to date`;
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: addRawOutputs(
          { currentVersion, latestVersion, updateAvailable },
          {
            'wp core version': versionOutput,
            'wp core check-update': updateOutput,
          }
        ),
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Version check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Verify WP-CLI is installed'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.WP_VERSION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'WordPress Version';
  }

  getDescription(): string {
    return 'Checks WordPress version and available updates';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.WP_VERSION;
  }
}
