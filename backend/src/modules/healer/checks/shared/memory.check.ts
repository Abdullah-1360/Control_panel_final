/**
 * Memory Check - Shared across all tech stacks
 * 
 * Checks memory usage on the server
 */

import { Injectable, Logger } from '@nestjs/common';
import { CheckCategory, CheckStatus, RiskLevel, TechStack } from '@prisma/client';
import { DiagnosticCheckBase } from '../../core/diagnostic-check.base';
import { CheckResult, DiagnosticCheckMetadata } from '../../core/interfaces';

@Injectable()
export class MemoryCheck extends DiagnosticCheckBase {
  private readonly logger = new Logger(MemoryCheck.name);
  
  readonly metadata: DiagnosticCheckMetadata = {
    name: 'memory_usage',
    category: CheckCategory.SYSTEM,
    riskLevel: RiskLevel.LOW,
    description: 'Check memory usage',
    applicableTo: Object.values(TechStack),
    timeout: 10000,
  };
  
  async execute(application: any, server: any): Promise<CheckResult> {
    try {
      const memoryInfo = await this.getMemoryInfo(server);
      const { used, total, percentage } = memoryInfo;
      
      if (percentage >= 95) {
        return this.fail(
          `Memory usage critically high at ${percentage.toFixed(1)}%`,
          { used, total, percentage },
          'Restart services, kill unnecessary processes, or add more RAM.',
        );
      }
      
      if (percentage >= 85) {
        return this.warn(
          `Memory usage high at ${percentage.toFixed(1)}%`,
          { used, total, percentage },
          'Monitor memory usage and consider restarting services or adding more RAM.',
        );
      }
      
      return this.pass(
        `Memory usage healthy at ${percentage.toFixed(1)}%`,
        { used, total, percentage },
      );
      
    } catch (error) {
      this.logger.error(`Memory check failed: ${error.message}`);
      return this.error(
        `Failed to check memory usage: ${error.message}`,
        { error: error.message },
      );
    }
  }
  
  /**
   * Get memory information from the server
   * TODO: Implement actual SSH command execution
   */
  private async getMemoryInfo(server: any): Promise<{
    used: number;
    total: number;
    percentage: number;
  }> {
    // Placeholder implementation
    // Command: free -m | grep Mem | awk '{print $3,$2}'
    const total = 8192; // MB
    const used = Math.floor(Math.random() * total);
    const percentage = (used / total) * 100;
    
    return { used, total, percentage };
  }
}
