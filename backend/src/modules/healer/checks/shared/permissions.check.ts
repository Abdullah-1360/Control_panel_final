/**
 * Permissions Check - Shared across all tech stacks
 * 
 * Checks file and directory permissions
 */

import { Injectable, Logger } from '@nestjs/common';
import { CheckCategory, CheckStatus, RiskLevel, TechStack } from '@prisma/client';
import { DiagnosticCheckBase } from '../../core/diagnostic-check.base';
import { CheckResult, DiagnosticCheckMetadata } from '../../core/interfaces';
import { SSHExecutorService } from '../../services/ssh-executor.service';

@Injectable()
export class PermissionsCheck extends DiagnosticCheckBase {
  private readonly logger = new Logger(PermissionsCheck.name);
  
  constructor(private readonly sshExecutor: SSHExecutorService) {
    super();
  }
  
  readonly metadata: DiagnosticCheckMetadata = {
    name: 'file_permissions',
    category: CheckCategory.SECURITY,
    riskLevel: RiskLevel.MEDIUM,
    description: 'Check file and directory permissions',
    applicableTo: Object.values(TechStack),
    timeout: 15000,
  };
  
  async execute(application: any, server: any): Promise<CheckResult> {
    try {
      const permissionIssues = await this.checkPermissions(server, application.path);
      
      if (permissionIssues.critical.length > 0) {
        return this.fail(
          `Found ${permissionIssues.critical.length} critical permission issues`,
          permissionIssues,
          'Fix file permissions using chmod/chown commands. Ensure proper ownership and access rights.',
        );
      }
      
      if (permissionIssues.warnings.length > 0) {
        return this.warn(
          `Found ${permissionIssues.warnings.length} permission warnings`,
          permissionIssues,
          'Review and fix file permissions to improve security.',
        );
      }
      
      return this.pass(
        'File permissions are properly configured',
        permissionIssues,
      );
      
    } catch (error: any) {
      this.logger.error(`Permissions check failed: ${error.message}`);
      return this.error(
        `Failed to check permissions: ${error.message}`,
        { error: error.message },
      );
    }
  }
  
  /**
   * Check file and directory permissions
   */
  private async checkPermissions(server: any, path: string): Promise<{
    critical: string[];
    warnings: string[];
    checked: number;
  }> {
    const critical: string[] = [];
    const warnings: string[] = [];
    let checked = 0;
    
    try {
      // Check for world-writable files (777, 666)
      const worldWritableResult = await this.sshExecutor.executeCommandDetailed(
        server.id,
        `find "${path}" -type f \\( -perm -002 -o -perm -020 \\) -ls 2>/dev/null | head -20`,
      );
      
      if (worldWritableResult.success && worldWritableResult.output) {
        const lines = worldWritableResult.output.trim().split('\n').filter(l => l);
        if (lines.length > 0) {
          critical.push(`Found ${lines.length} world-writable files`);
          checked += lines.length;
        }
      }
      
      // Check for files with overly permissive permissions (755 on sensitive files)
      const sensitiveFiles = ['.env', 'config.php', 'wp-config.php', 'database.yml', '.htaccess'];
      for (const file of sensitiveFiles) {
        const fileExists = await this.sshExecutor.fileExists(server.id, `${path}/${file}`);
        if (fileExists) {
          const perms = await this.sshExecutor.getFilePermissions(server.id, `${path}/${file}`);
          if (perms) {
            checked++;
            const permNum = parseInt(perms, 10);
            if (permNum > 644) {
              warnings.push(`${file} has overly permissive permissions: ${perms}`);
            }
          }
        }
      }
      
    } catch (error: any) {
      this.logger.error(`Permission check error: ${error.message}`);
    }
    
    return { critical, warnings, checked };
  }
}
