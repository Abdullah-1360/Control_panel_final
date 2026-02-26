/**
 * CPU Check - Shared across all tech stacks
 * 
 * Checks CPU usage on the server
 */

import { Injectable, Logger } from '@nestjs/common';
import { CheckCategory, CheckStatus, RiskLevel, TechStack } from '@prisma/client';
import { DiagnosticCheckBase } from '../../core/diagnostic-check.base';
import { CheckResult, DiagnosticCheckMetadata } from '../../core/interfaces';

@Injectable()
export class CpuCheck extends DiagnosticCheckBase {
  private readonly logger = new Logger(CpuCheck.name);
  
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
      const cpuUsage = await this.getCpuUsage(server);
      
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
  
  /**
   * Get CPU usage percentage
   * TODO: Implement actual SSH command execution
   */
  private async getCpuUsage(server: any): Promise<number> {
    // Placeholder implementation
    // Command: top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}'
    return Math.random() * 100;
  }
}
