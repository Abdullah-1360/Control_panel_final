import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Maintenance Mode Service
 * Checks if WordPress is in maintenance mode
 */
@Injectable()
export class MaintenanceModeService implements IDiagnosisCheckService {
  private readonly logger = new Logger(MaintenanceModeService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      this.logger.log(`Checking maintenance mode for ${domain}`);

      // Check for .maintenance file
      const maintenanceFileCommand = `test -f ${sitePath}/.maintenance && echo "EXISTS" || echo "NOT_EXISTS"`;
      const maintenanceFileResult = await this.sshExecutor.executeCommand(
        serverId,
        maintenanceFileCommand,
        10000,
      );

      const inMaintenanceMode = maintenanceFileResult.trim() === 'EXISTS';

      let maintenanceAge = 0;
      if (inMaintenanceMode) {
        // Get file age in minutes
        const ageCommand = `echo $(( ($(date +%s) - $(stat -c %Y ${sitePath}/.maintenance)) / 60 ))`;
        const ageResult = await this.sshExecutor.executeCommand(serverId, ageCommand, 10000);
        maintenanceAge = parseInt(ageResult.trim() || '0');
      }

      let status: CheckStatus;
      let message: string;
      let score = 100;

      if (inMaintenanceMode) {
        if (maintenanceAge > 30) {
          // Stuck in maintenance mode for >30 minutes
          status = CheckStatus.FAIL;
          score = 0;
          message = `Site stuck in maintenance mode for ${maintenanceAge} minutes`;
          recommendations.push('Remove .maintenance file manually');
          recommendations.push('Check if update/plugin installation failed');
          recommendations.push(`Run: rm ${sitePath}/.maintenance`);
        } else {
          // Recently entered maintenance mode (likely updating)
          status = CheckStatus.WARNING;
          score = 50;
          message = `Site in maintenance mode (${maintenanceAge} minutes)`;
          recommendations.push('Wait for update to complete');
          recommendations.push('Monitor for stuck updates');
        }
      } else {
        status = CheckStatus.PASS;
        message = 'Site not in maintenance mode';
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          inMaintenanceMode,
          maintenanceAge,
          maintenanceFile: `${sitePath}/.maintenance`,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Maintenance mode check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Maintenance mode check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Retry check', 'Verify SSH connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.MAINTENANCE_MODE;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Maintenance Mode';
  }

  getDescription(): string {
    return 'Checks if WordPress is in maintenance mode';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.MAINTENANCE_MODE;
  }
}
