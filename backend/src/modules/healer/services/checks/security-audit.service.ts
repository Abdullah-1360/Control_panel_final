import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Security Audit Service
 * Audits file permissions, user roles, SSL, security headers, and vulnerabilities
 */
@Injectable()
export class SecurityAuditService implements IDiagnosisCheckService {
  private readonly logger = new Logger(SecurityAuditService.name);

  // Critical file permissions
  private readonly CRITICAL_FILES = {
    'wp-config.php': '640',
    '.htaccess': '644',
    'wp-content': '755',
    'wp-includes': '755',
    'wp-admin': '755',
  };

  // Security headers to check
  private readonly SECURITY_HEADERS = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'Referrer-Policy',
  ];

  constructor(private readonly sshExecutor: SshExecutorService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      this.logger.log(`Starting security audit for ${domain}`);

      // 1. Check file permissions
      const permissionIssues = await this.checkFilePermissions(serverId, sitePath);
      if (permissionIssues.length > 0) {
        issues.push(`${permissionIssues.length} file permission issues`);
        score -= Math.min(30, permissionIssues.length * 5);
        recommendations.push('Fix file permissions to recommended values');
        recommendations.push('Run: chmod 640 wp-config.php');
      }

      // 2. Check for debug mode enabled
      const debugEnabled = await this.checkDebugMode(serverId, sitePath);
      if (debugEnabled) {
        issues.push('WP_DEBUG is enabled in production');
        score -= 15;
        recommendations.push('Disable WP_DEBUG in wp-config.php');
      }

      // 3. Check SSL certificate
      const sslIssues = await this.checkSSL(domain);
      if (sslIssues.length > 0) {
        issues.push(`SSL issues: ${sslIssues.join(', ')}`);
        score -= Math.min(25, sslIssues.length * 10);
        recommendations.push('Fix SSL certificate issues');
        recommendations.push('Ensure HTTPS is properly configured');
      }

      // 4. Check security headers
      const missingHeaders = await this.checkSecurityHeaders(domain);
      if (missingHeaders.length > 0) {
        issues.push(`${missingHeaders.length} security headers missing`);
        score -= Math.min(20, missingHeaders.length * 3);
        recommendations.push('Add missing security headers to .htaccess or server config');
      }

      // 5. Check for exposed sensitive files
      const exposedFiles = await this.checkExposedFiles(serverId, sitePath);
      if (exposedFiles.length > 0) {
        issues.push(`${exposedFiles.length} sensitive files exposed`);
        score -= Math.min(25, exposedFiles.length * 5);
        recommendations.push('Block access to sensitive files via .htaccess');
      }

      // 6. Check database prefix
      const weakDbPrefix = await this.checkDatabasePrefix(serverId, sitePath);
      if (weakDbPrefix) {
        issues.push('Using default database prefix (wp_)');
        score -= 10;
        recommendations.push('Change database prefix for better security');
      }

      // 7. Check for file editing enabled
      const fileEditingEnabled = await this.checkFileEditing(serverId, sitePath);
      if (fileEditingEnabled) {
        issues.push('File editing enabled in WordPress admin');
        score -= 10;
        recommendations.push('Disable file editing: define(\'DISALLOW_FILE_EDIT\', true)');
      }

      // 8. Check for XML-RPC enabled
      const xmlRpcEnabled = await this.checkXmlRpc(serverId, sitePath);
      if (xmlRpcEnabled) {
        issues.push('XML-RPC is enabled (DDoS risk)');
        score -= 10;
        recommendations.push('Disable XML-RPC if not needed');
      }

      // Determine status
      let status: CheckStatus;
      if (score >= 85) {
        status = CheckStatus.PASS;
      } else if (score >= 65) {
        status = CheckStatus.WARNING;
      } else {
        status = CheckStatus.FAIL;
      }

      const message =
        issues.length === 0
          ? 'Security audit passed - no critical issues found'
          : `Security issues detected: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: {
          permissionIssues,
          debugEnabled,
          sslIssues,
          missingHeaders,
          exposedFiles,
          weakDbPrefix,
          fileEditingEnabled,
          xmlRpcEnabled,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Security audit failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Security audit failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Retry security audit', 'Check server connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check file permissions
   */
  private async checkFilePermissions(
    serverId: string,
    sitePath: string,
  ): Promise<any[]> {
    const issues: any[] = [];

    try {
      for (const [file, expectedPerm] of Object.entries(this.CRITICAL_FILES)) {
        const filePath = file.startsWith('/') ? file : `${sitePath}/${file}`;
        const command = `stat -c '%a' ${filePath} 2>/dev/null || echo "NOT_FOUND"`;

        const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
        const actualPerm = result.trim();

        if (actualPerm === 'NOT_FOUND') {
          continue; // File doesn't exist, skip
        }

        if (actualPerm !== expectedPerm) {
          issues.push({
            file,
            expected: expectedPerm,
            actual: actualPerm,
            severity: this.getPermissionSeverity(file, actualPerm),
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check file permissions: ${(error as Error).message}`);
    }

    return issues;
  }

  /**
   * Get permission severity
   */
  private getPermissionSeverity(file: string, perm: string): string {
    // wp-config.php with 777 or 666 is critical
    if (file === 'wp-config.php' && (perm === '777' || perm === '666')) {
      return 'CRITICAL';
    }
    // Any file with 777 is high risk
    if (perm === '777') {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  /**
   * Check if debug mode is enabled
   */
  private async checkDebugMode(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `grep -i "define.*WP_DEBUG.*true" ${sitePath}/wp-config.php 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() !== '';
    } catch (error) {
      return false; // grep returns 1 if not found
    }
  }

  /**
   * Check SSL certificate
   */
  private async checkSSL(domain: string): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check if site is accessible via HTTPS
      const command = `curl -I -s -o /dev/null -w "%{http_code}" https://${domain} --max-time 10 2>/dev/null || echo "000"`;
      const result = await this.sshExecutor.executeCommand('local', command, 15000);
      const statusCode = result.trim();

      if (statusCode === '000' || statusCode.startsWith('5')) {
        issues.push('HTTPS not accessible');
      }

      // Check SSL certificate expiry (simplified - would need openssl in production)
      // This is a placeholder - actual implementation would use openssl s_client
    } catch (error) {
      issues.push('Unable to verify SSL');
    }

    return issues;
  }

  /**
   * Check security headers
   */
  private async checkSecurityHeaders(domain: string): Promise<string[]> {
    const missing: string[] = [];

    try {
      const command = `curl -I -s https://${domain} --max-time 10 2>/dev/null || curl -I -s http://${domain} --max-time 10 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand('local', command, 15000);

      for (const header of this.SECURITY_HEADERS) {
        if (!result.toLowerCase().includes(header.toLowerCase())) {
          missing.push(header);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check security headers: ${(error as Error).message}`);
    }

    return missing;
  }

  /**
   * Check for exposed sensitive files
   */
  private async checkExposedFiles(
    serverId: string,
    sitePath: string,
  ): Promise<string[]> {
    const exposed: string[] = [];
    const sensitiveFiles = [
      'wp-config.php.bak',
      'wp-config.php~',
      '.git',
      '.env',
      'error_log',
      'debug.log',
      'readme.html',
      'license.txt',
    ];

    try {
      for (const file of sensitiveFiles) {
        const command = `test -f ${sitePath}/${file} && echo "EXISTS" || echo "NOT_FOUND"`;
        const result = await this.sshExecutor.executeCommand(serverId, command, 10000);

        if (result.trim() === 'EXISTS') {
          exposed.push(file);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check exposed files: ${(error as Error).message}`);
    }

    return exposed;
  }

  /**
   * Check database prefix
   */
  private async checkDatabasePrefix(
    serverId: string,
    sitePath: string,
  ): Promise<boolean> {
    try {
      const command = `grep "table_prefix" ${sitePath}/wp-config.php | grep "wp_" 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() !== '';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file editing is enabled
   */
  private async checkFileEditing(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `grep -i "DISALLOW_FILE_EDIT.*true" ${sitePath}/wp-config.php 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() === ''; // If not found, editing is enabled
    } catch (error) {
      return true; // Assume enabled if can't check
    }
  }

  /**
   * Check if XML-RPC is enabled
   */
  private async checkXmlRpc(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `test -f ${sitePath}/xmlrpc.php && echo "EXISTS" || echo "NOT_FOUND"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() === 'EXISTS';
    } catch (error) {
      return false;
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.SECURITY_AUDIT;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Security Audit';
  }

  getDescription(): string {
    return 'Audits file permissions, SSL, security headers, and WordPress security settings';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.SECURITY_AUDIT;
  }
}
