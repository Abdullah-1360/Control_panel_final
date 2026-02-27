import { Injectable } from '@nestjs/common';
import { servers as Server } from '@prisma/client';
import { SSHExecutorService } from '../services/ssh-executor.service';
import {
  IStackPlugin,
  DetectionResult,
  DiagnosticCheckResult,
  HealingAction,
} from '../interfaces/stack-plugin.interface';

@Injectable()
export class PhpGenericPlugin implements IStackPlugin {
  name = 'php-generic';
  version = '1.0.0';
  supportedVersions = ['7.4', '8.0', '8.1', '8.2', '8.3'];

  constructor(protected readonly sshExecutor: SSHExecutorService) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check for index.php or composer.json
      const hasIndexPhp = await this.checkFileExists(server.id, `${path}/index.php`);
      const hasComposerJson = await this.checkFileExists(server.id, `${path}/composer.json`);
      
      if (!hasIndexPhp && !hasComposerJson) {
        return { detected: false, confidence: 0 };
      }
      
      // If composer.json exists, check if it's Laravel or other framework
      if (hasComposerJson) {
        try {
          const composerContent = await this.sshExecutor.executeCommand(
            server.id,
            `cat ${path}/composer.json`,
          );
          const composer = JSON.parse(composerContent);
          
          // Exclude Laravel (has its own plugin)
          if (composer.require?.['laravel/framework']) {
            return { detected: false, confidence: 0 };
          }
          
          // Exclude WordPress (has its own plugin)
          if (composer.require?.['wordpress/wordpress'] || 
              composer.name?.includes('wordpress')) {
            return { detected: false, confidence: 0 };
          }
        } catch {
          // If can't parse composer.json, continue with generic PHP detection
        }
      }
      
      // Get PHP version
      let version = 'unknown';
      try {
        const phpVersion = await this.sshExecutor.executeCommand(
          server.id,
          `cd ${path} && php -v | head -n 1 | cut -d ' ' -f 2`,
        );
        version = phpVersion.trim();
      } catch {
        // Keep version as 'unknown'
      }
      
      return {
        detected: true,
        techStack: 'PHP_GENERIC',
        version,
        confidence: 0.70, // Lower confidence as it's a fallback
        metadata: {
          hasComposer: hasComposerJson,
          hasIndexPhp: hasIndexPhp,
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  private async checkFileExists(serverId: string, filePath: string): Promise<boolean> {
    try {
      await this.sshExecutor.executeCommand(serverId, `[ -f "${filePath}" ]`);
      return true;
    } catch {
      return false;
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'php_version',
      'php_extensions',
      'php_config',
      'composer_dependencies',
      'file_permissions',
      'error_log_check',
    ];
  }

  async executeDiagnosticCheck(
    checkName: string,
    application: any,
    server: Server,
  ): Promise<DiagnosticCheckResult> {
    const startTime = Date.now();
    
    try {
      switch (checkName) {
        case 'php_version':
          return await this.checkPhpVersion(application, server, startTime);
        case 'php_extensions':
          return await this.checkPhpExtensions(application, server, startTime);
        case 'php_config':
          return await this.checkPhpConfig(application, server, startTime);
        case 'composer_dependencies':
          return await this.checkComposerDependencies(application, server, startTime);
        case 'file_permissions':
          return await this.checkFilePermissions(application, server, startTime);
        case 'error_log_check':
          return await this.checkErrorLog(application, server, startTime);
        default:
          throw new Error(`Unknown check: ${checkName}`);
      }
    } catch (error: any) {
      return {
        checkName,
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Check failed: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPhpVersion(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const phpVersion = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && php -v | head -n 1`,
      );
      
      const versionMatch = phpVersion.match(/PHP (\d+\.\d+)/);
      if (!versionMatch) {
        return {
          checkName: 'php_version',
          category: 'SYSTEM',
          status: 'ERROR',
          severity: 'HIGH',
          message: 'Could not determine PHP version',
          executionTime: Date.now() - startTime,
        };
      }
      
      const version = versionMatch[1];
      const majorMinor = parseFloat(version);
      
      // PHP 7.4 reached EOL, warn about it
      if (majorMinor < 7.4) {
        return {
          checkName: 'php_version',
          category: 'SYSTEM',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: `PHP ${version} is end-of-life and unsupported`,
          details: { version, phpVersion },
          suggestedFix: 'Upgrade to PHP 8.1 or higher',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (majorMinor === 7.4) {
        return {
          checkName: 'php_version',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: `PHP ${version} reached end-of-life`,
          details: { version, phpVersion },
          suggestedFix: 'Upgrade to PHP 8.1 or higher',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'php_version',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `PHP ${version}`,
        details: { version, phpVersion },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'php_version',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check PHP version: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPhpExtensions(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const extensions = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && php -m`,
      );
      
      const extensionList = extensions.split('\n').map(e => e.trim().toLowerCase());
      
      // Common required extensions
      const requiredExtensions = ['curl', 'json', 'mbstring', 'openssl', 'pdo', 'xml'];
      const missingExtensions = requiredExtensions.filter(ext => !extensionList.includes(ext));
      
      if (missingExtensions.length > 0) {
        return {
          checkName: 'php_extensions',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Missing ${missingExtensions.length} common PHP extensions`,
          details: { missingExtensions, installedCount: extensionList.length },
          suggestedFix: `Install missing extensions: ${missingExtensions.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'php_extensions',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `${extensionList.length} PHP extensions installed`,
        details: { installedCount: extensionList.length },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'php_extensions',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check PHP extensions: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPhpConfig(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check important php.ini settings
      const settings = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && php -i | grep -E "(memory_limit|max_execution_time|upload_max_filesize|post_max_size|display_errors)"`,
      );
      
      const issues: string[] = [];
      
      // Check if display_errors is on (security risk in production)
      if (settings.includes('display_errors => On')) {
        issues.push('display_errors is enabled (security risk)');
      }
      
      // Check memory limit
      const memoryMatch = settings.match(/memory_limit => (\d+)M/);
      if (memoryMatch && parseInt(memoryMatch[1]) < 128) {
        issues.push(`memory_limit is low (${memoryMatch[1]}M)`);
      }
      
      // Check max execution time
      const execTimeMatch = settings.match(/max_execution_time => (\d+)/);
      if (execTimeMatch && parseInt(execTimeMatch[1]) < 30) {
        issues.push(`max_execution_time is low (${execTimeMatch[1]}s)`);
      }
      
      if (issues.length > 0) {
        return {
          checkName: 'php_config',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${issues.length} PHP configuration issue(s) found`,
          details: { issues, settings },
          suggestedFix: 'Review and update php.ini settings',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'php_config',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: 'PHP configuration is optimal',
        details: { settings },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'php_config',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check PHP config: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkComposerDependencies(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if composer.json exists
      const hasComposer = await this.checkFileExists(server.id, `${application.path}/composer.json`);
      
      if (!hasComposer) {
        return {
          checkName: 'composer_dependencies',
          category: 'DEPENDENCIES',
          status: 'PASS',
          severity: 'LOW',
          message: 'No Composer dependencies',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if composer is installed
      try {
        await this.sshExecutor.executeCommand(server.id, 'which composer');
      } catch {
        return {
          checkName: 'composer_dependencies',
          category: 'DEPENDENCIES',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Composer not installed',
          suggestedFix: 'Install Composer: https://getcomposer.org/download/',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check for outdated packages
      const outdated = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && composer outdated --direct --format=json 2>/dev/null || echo '{"installed":[]}'`,
      );
      
      const outdatedData = JSON.parse(outdated);
      const outdatedCount = outdatedData.installed?.length || 0;
      
      if (outdatedCount > 5) {
        return {
          checkName: 'composer_dependencies',
          category: 'DEPENDENCIES',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${outdatedCount} outdated Composer packages`,
          details: { outdatedCount },
          suggestedFix: 'Run: composer update',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (outdatedCount > 0) {
        return {
          checkName: 'composer_dependencies',
          category: 'DEPENDENCIES',
          status: 'WARN',
          severity: 'LOW',
          message: `${outdatedCount} outdated Composer packages`,
          details: { outdatedCount },
          suggestedFix: 'Run: composer update',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'composer_dependencies',
        category: 'DEPENDENCIES',
        status: 'PASS',
        severity: 'LOW',
        message: 'Composer dependencies are up to date',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'composer_dependencies',
        category: 'DEPENDENCIES',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check Composer dependencies: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkFilePermissions(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check permissions on common directories
      const checks = [
        { path: application.path, name: 'root', expected: 755 },
        { path: `${application.path}/vendor`, name: 'vendor', expected: 755 },
        { path: `${application.path}/storage`, name: 'storage', expected: 775 },
        { path: `${application.path}/cache`, name: 'cache', expected: 775 },
      ];
      
      const issues: string[] = [];
      
      for (const check of checks) {
        try {
          const perms = await this.sshExecutor.executeCommand(
            server.id,
            `stat -c "%a" ${check.path} 2>/dev/null || echo "0"`,
          );
          
          const permissions = parseInt(perms.trim());
          
          if (permissions === 0) {
            continue; // Directory doesn't exist, skip
          }
          
          if (permissions > check.expected) {
            issues.push(`${check.name}: ${permissions} (too permissive, expected ${check.expected})`);
          }
        } catch {
          // Skip if directory doesn't exist
        }
      }
      
      if (issues.length > 0) {
        return {
          checkName: 'file_permissions',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${issues.length} permission issue(s) found`,
          details: { issues },
          suggestedFix: 'Fix permissions: chmod 755 for directories, 644 for files',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'file_permissions',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'File permissions are secure',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'file_permissions',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check file permissions: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkErrorLog(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check for PHP error log
      const errorLogPath = `${application.path}/error_log`;
      const hasErrorLog = await this.checkFileExists(server.id, errorLogPath);
      
      if (!hasErrorLog) {
        return {
          checkName: 'error_log_check',
          category: 'SYSTEM',
          status: 'PASS',
          severity: 'LOW',
          message: 'No error log found',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check error log size
      const logSize = await this.sshExecutor.executeCommand(
        server.id,
        `stat -c "%s" ${errorLogPath}`,
      );
      
      const sizeBytes = parseInt(logSize.trim());
      const sizeMB = sizeBytes / (1024 * 1024);
      
      if (sizeMB > 100) {
        return {
          checkName: 'error_log_check',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Error log is large (${sizeMB.toFixed(2)} MB)`,
          details: { sizeBytes, sizeMB },
          suggestedFix: 'Review and clear error log',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check recent errors
      const recentErrors = await this.sshExecutor.executeCommand(
        server.id,
        `tail -n 50 ${errorLogPath} | grep -i "error\\|fatal\\|warning" | wc -l`,
      );
      
      const errorCount = parseInt(recentErrors.trim());
      
      if (errorCount > 10) {
        return {
          checkName: 'error_log_check',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: `${errorCount} recent errors in log`,
          details: { errorCount, sizeMB },
          suggestedFix: 'Review error log and fix issues',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'error_log_check',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Error log size: ${sizeMB.toFixed(2)} MB`,
        details: { sizeMB, errorCount },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'error_log_check',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check error log: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  getHealingActions(): HealingAction[] {
    return [
      {
        name: 'composer_install',
        description: 'Install Composer dependencies',
        commands: ['cd {{path}} && composer install --no-dev --optimize-autoloader'],
        requiresBackup: true,
        estimatedDuration: 120,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'composer_update',
        description: 'Update Composer dependencies',
        commands: ['cd {{path}} && composer update'],
        requiresBackup: true,
        estimatedDuration: 180,
        riskLevel: 'HIGH',
      },
      {
        name: 'fix_permissions',
        description: 'Fix file and directory permissions',
        commands: [
          'cd {{path}} && find . -type d -exec chmod 755 {} \\;',
          'cd {{path}} && find . -type f -exec chmod 644 {} \\;',
          'cd {{path}} && chmod -R 775 storage cache 2>/dev/null || true',
        ],
        requiresBackup: false,
        estimatedDuration: 60,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'clear_cache',
        description: 'Clear PHP OPcache',
        commands: [
          'cd {{path}} && rm -rf cache/* 2>/dev/null || true',
          'cd {{path}} && php -r "if(function_exists(\'opcache_reset\')) opcache_reset();"',
        ],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'clear_error_log',
        description: 'Clear PHP error log',
        commands: ['cd {{path}} && > error_log'],
        requiresBackup: true,
        estimatedDuration: 5,
        riskLevel: 'LOW',
      },
      {
        name: 'disable_display_errors',
        description: 'Disable display_errors in production',
        commands: [
          'cd {{path}} && echo "php_flag display_errors off" >> .htaccess',
        ],
        requiresBackup: true,
        estimatedDuration: 5,
        riskLevel: 'LOW',
      },
    ];
  }

  async executeHealingAction(
    actionName: string,
    application: any,
    server: Server,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const action = this.getHealingActions().find(a => a.name === actionName);
    if (!action) {
      throw new Error(`Unknown healing action: ${actionName}`);
    }

    try {
      const results: string[] = [];
      
      for (const command of action.commands) {
        const actualCommand = command.replace(/\{\{path\}\}/g, application.path);
        const output = await this.sshExecutor.executeCommand(server.id, actualCommand);
        results.push(output);
      }
      
      return {
        success: true,
        message: `Successfully executed ${action.description}`,
        details: { results },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to execute ${action.description}: ${error?.message || 'Unknown error'}`,
        details: { error: error?.message || 'Unknown error' },
      };
    }
  }
}
