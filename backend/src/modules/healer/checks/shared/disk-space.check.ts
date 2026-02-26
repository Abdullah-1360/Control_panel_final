/**
 * Disk Space Check - Shared across all tech stacks
 * 
 * Checks available disk space on the server
 */

import { Injectable, Logger } from '@nestjs/common';
import { CheckCategory, CheckStatus, RiskLevel, TechStack } from '@prisma/client';
import { DiagnosticCheckBase } from '../../core/diagnostic-check.base';
import { CheckResult, DiagnosticCheckMetadata } from '../../core/interfaces';
import { SSHExecutorService } from '../../services/ssh-executor.service';

@Injectable()
export class DiskSpaceCheck extends DiagnosticCheckBase {
  private readonly logger = new Logger(DiskSpaceCheck.name);
  
  constructor(private readonly sshExecutor: SSHExecutorService) {
    super();
  }
  
  readonly metadata: DiagnosticCheckMetadata = {
    name: 'disk_space',
    category: CheckCategory.SYSTEM,
    riskLevel: RiskLevel.MEDIUM,
    description: 'Check available disk space',
    applicableTo: Object.values(TechStack), // Applies to all tech stacks
    timeout: 10000, // 10 seconds
  };
  
  async execute(application: any, server: any): Promise<CheckResult> {
    try {
      // Get disk usage using SSH executor
      const usage = await this.sshExecutor.getDiskUsage(server, application.path);
      
      if (usage === null) {
        return this.error(
          'Failed to retrieve disk usage information',
          { error: 'Command execution failed' },
        );
      }
      
      if (usage >= 95) {
        return this.fail(
          `Disk usage critically high at ${usage}%`,
          { usage, threshold: 95 },
          'Free up disk space immediately or expand storage. Consider removing old logs, temporary files, or unused data.',
        );
      }
      
      if (usage >= 90) {
        return this.warn(
          `Disk usage high at ${usage}%`,
          { usage, threshold: 90 },
          'Free up disk space or expand storage soon to prevent issues.',
        );
      }
      
      if (usage >= 80) {
        return this.warn(
          `Disk usage at ${usage}%`,
          { usage, threshold: 80 },
          'Monitor disk usage and plan for cleanup or expansion.',
        );
      }
      
      return this.pass(`Disk usage healthy at ${usage}%`, { usage });
      
    } catch (error) {
      this.logger.error(`Disk space check failed: ${error.message}`);
      return this.error(
        `Failed to check disk space: ${error.message}`,
        { error: error.message },
      );
    }
  }
}
