/**
 * CPU Check - Shared across all tech stacks
 * 
 * Checks CPU usage on the server
 */

import { Injectable, Logger } from '@nestjs/common';
import { CheckCategory, CheckStatus, RiskLevel, TechStack } from '@prisma/client';
import { DiagnosticCheckBase } from '../../core/diagnostic-check.base';
import { CheckResult, DiagnosticCheckMetadata } from '../../core/interfaces';
import { SSHExecutorService } from '../../services/ssh-executor.service';

@Injectable()
export class CpuCheck extends DiagnosticCheckBase {
  private readonly logger = new Logger(CpuCheck.name);
  
  constructor(private readonly sshExecutor: SSHExecutorService) {
    super();
  }
  
  readonly metadata: DiagnosticCheckMetadata = {
    name: 'cpu_usage',
    category: CheckCategory.SYSTEM,
    riskLevel: RiskLevel.LOW,
    description: 'Check CPU usage',
    applicableTo: Object.values(TechStack),
    timeout: 10000,
  };
  
  async execute(application: any, server: any): Promise<CheckResult> {
    try {
      const cpuUsage = await this.sshExecutor.getCPUUsage(server);
      
      if (cpuUsage === null) {
        return this.error(
          'Failed to retrieve CPU usage information',
          { error: 'Command execution failed' },
        );
      }
      
      if (cpuUsage >= 95) {
        return this.fail(
          `CPU usage critically high at ${cpuUsage.toFixed(1)}%`,
          { usage: cpuUsage },
          'Identify and kill resource-intensive processes, or scale up server resources.',
        );
      }
      
      if (cpuUsage >= 80) {
        return this.warn(
          `CPU usage high at ${cpuUsage.toFixed(1)}%`,
          { usage: cpuUsage },
          'Monitor CPU usage and consider optimizing processes or scaling up.',
        );
      }
      
      return this.pass(
        `CPU usage healthy at ${cpuUsage.toFixed(1)}%`,
        { usage: cpuUsage },
      );
      
    } catch (error) {
      this.logger.error(`CPU check failed: ${error.message}`);
      return this.error(
        `Failed to check CPU usage: ${error.message}`,
        { error: error.message },
      );
    }
  }
}
