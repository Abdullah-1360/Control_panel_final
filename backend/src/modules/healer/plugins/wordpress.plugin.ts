import { Injectable } from '@nestjs/common';
import { servers as Server } from '@prisma/client';
import { SSHExecutorService } from '../services/ssh-executor.service';
import { WpCliService } from '../services/wp-cli.service';
import {
  IStackPlugin,
  DetectionResult,
  DiagnosticCheckResult,
  HealingAction,
} from '../interfaces/stack-plugin.interface';

@Injectable()
export class WordPressPlugin implements IStackPlugin {
  name = 'wordpress';
  version = '1.0.0';
  supportedVersions = ['5.x', '6.x'];

  constructor(
    protected readonly sshExecutor: SSHExecutorService,
    protected readonly wpCli: WpCliService,
  ) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check for wp-config.php
      await this.sshExecutor.executeCommand(server.id, `[ -f "${path}/wp-config.php" ]`);
      
      // Check for wp-includes directory
      await this.sshExecutor.executeCommand(server.id, `[ -d "${path}/wp-includes" ]`);
      
      // Try to get WordPress version
      let version = 'unknown';
      try {
        const versionOutput = await this.wpCli.execute(
          server.id,
          path,
          'core version',
        );
        version = versionOutput.trim();
      } catch (error) {
        // If wp-cli fails, try reading version from wp-includes/version.php
        try {
          const versionFile = await this.sshExecutor.executeCommand(
            server.id,
            `grep "wp_version = " ${path}/wp-includes/version.php | cut -d "'" -f 2`,
          );
          version = versionFile.trim();
        } catch {
          // Keep version as 'unknown'
        }
      }
      
      return {
        detected: true,
        techStack: 'WORDPRESS',
        version,
        confidence: 0.95,
        metadata: {
          hasWpCli: await this.wpCli.isInstalled(server.id, path),
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'wp_core_update',
      'wp_plugin_updates',
      'wp_theme_updates',
      'wp_database_check',
      'wp_permissions',
      'wp_debug_mode',
      'wp_plugin_conflicts',
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
        case 'wp_core_update':
          return await this.checkCoreUpdate(application, server, startTime);
        case 'wp_plugin_updates':
          return await this.checkPluginUpdates(application, server, startTime);
        case 'wp_theme_updates':
          return await this.checkThemeUpdates(application, server, startTime);
        case 'wp_database_check':
          return await this.checkDatabase(application, server, startTime);
        case 'wp_permissions':
          return await this.checkPermissions(application, server, startTime);
        case 'wp_debug_mode':
          return await this.checkDebugMode(application, server, startTime);
        case 'wp_plugin_conflicts':
          return await this.checkPluginConflicts(application, server, startTime);
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

  private async checkCoreUpdate(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const output = await this.wpCli.execute(
        server.id,
        application.path,
        'core check-update --format=json',
      );
      
      const updates = JSON.parse(output || '[]');
      
      if (updates.length > 0) {
        const latestVersion = updates[0].version;
        return {
          checkName: 'wp_core_update',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'HIGH',
          message: `WordPress core update available: ${latestVersion}`,
          details: { updates },
          suggestedFix: 'Run: wp core update',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_core_update',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'WordPress core is up to date',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_core_update',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check core updates: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPluginUpdates(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const output = await this.wpCli.execute(
        server.id,
        application.path,
        'plugin list --update=available --format=json',
      );
      
      const updates = JSON.parse(output || '[]');
      
      if (updates.length > 0) {
        return {
          checkName: 'wp_plugin_updates',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${updates.length} plugin update(s) available`,
          details: { updates },
          suggestedFix: 'Run: wp plugin update --all',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_plugin_updates',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'All plugins are up to date',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_plugin_updates',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check plugin updates: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkThemeUpdates(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const output = await this.wpCli.execute(
        server.id,
        application.path,
        'theme list --update=available --format=json',
      );
      
      const updates = JSON.parse(output || '[]');
      
      if (updates.length > 0) {
        return {
          checkName: 'wp_theme_updates',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'LOW',
          message: `${updates.length} theme update(s) available`,
          details: { updates },
          suggestedFix: 'Run: wp theme update --all',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_theme_updates',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'All themes are up to date',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_theme_updates',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check theme updates: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkDatabase(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const output = await this.wpCli.execute(
        server.id,
        application.path,
        'db check',
      );
      
      if (output.toLowerCase().includes('error') || output.toLowerCase().includes('corrupt')) {
        return {
          checkName: 'wp_database_check',
          category: 'DATABASE',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Database has errors or corrupted tables',
          details: { output },
          suggestedFix: 'Run: wp db repair',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_database_check',
        category: 'DATABASE',
        status: 'PASS',
        severity: 'LOW',
        message: 'Database is healthy',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_database_check',
        category: 'DATABASE',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check database: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPermissions(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check wp-content permissions
      const wpContentPerms = await this.sshExecutor.executeCommand(
        server.id,
        `stat -c "%a" ${application.path}/wp-content`,
      );
      
      const perms = parseInt(wpContentPerms.trim());
      
      if (perms > 755) {
        return {
          checkName: 'wp_permissions',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `wp-content permissions too permissive: ${perms}`,
          details: { permissions: perms },
          suggestedFix: 'Run: chmod 755 wp-content',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_permissions',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'File permissions are secure',
        details: { permissions: perms },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_permissions',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check permissions: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkDebugMode(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const configContent = await this.sshExecutor.executeCommand(
        server.id,
        `grep "WP_DEBUG" ${application.path}/wp-config.php || echo "not found"`,
      );
      
      if (configContent.includes('WP_DEBUG') && configContent.includes('true')) {
        return {
          checkName: 'wp_debug_mode',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Debug mode is enabled in production',
          suggestedFix: 'Set WP_DEBUG to false in wp-config.php',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_debug_mode',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'Debug mode is disabled',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_debug_mode',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check debug mode: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPluginConflicts(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Get list of active plugins
      const output = await this.wpCli.execute(
        server.id,
        application.path,
        'plugin list --status=active --format=json',
      );
      
      const plugins = JSON.parse(output || '[]');
      const pluginCount = plugins.length;
      
      if (pluginCount > 50) {
        return {
          checkName: 'wp_plugin_conflicts',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'LOW',
          message: `High number of active plugins: ${pluginCount}`,
          details: { pluginCount, plugins },
          suggestedFix: 'Consider deactivating unused plugins',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'wp_plugin_conflicts',
        category: 'PERFORMANCE',
        status: 'PASS',
        severity: 'LOW',
        message: `${pluginCount} active plugins`,
        details: { pluginCount },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'wp_plugin_conflicts',
        category: 'PERFORMANCE',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check plugins: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  getHealingActions(): HealingAction[] {
    return [
      {
        name: 'clear_cache',
        description: 'Clear WordPress cache',
        commands: ['cd {{path}} && wp cache flush --allow-root'],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'update_core',
        description: 'Update WordPress core',
        commands: ['cd {{path}} && wp core update --allow-root'],
        requiresBackup: true,
        estimatedDuration: 60,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'update_plugins',
        description: 'Update all plugins',
        commands: ['cd {{path}} && wp plugin update --all --allow-root'],
        requiresBackup: true,
        estimatedDuration: 120,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'repair_database',
        description: 'Repair WordPress database',
        commands: ['cd {{path}} && wp db repair --allow-root'],
        requiresBackup: true,
        estimatedDuration: 30,
        riskLevel: 'HIGH',
      },
      {
        name: 'fix_permissions',
        description: 'Fix file permissions',
        commands: [
          'cd {{path}} && find . -type d -exec chmod 755 {} \\;',
          'cd {{path}} && find . -type f -exec chmod 644 {} \\;',
        ],
        requiresBackup: false,
        estimatedDuration: 60,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'disable_debug',
        description: 'Disable debug mode',
        commands: [
          'cd {{path}} && sed -i "s/define( *\'WP_DEBUG\' *, *true *)/define(\'WP_DEBUG\', false)/g" wp-config.php',
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
        const actualCommand = command.replace('{{path}}', application.path);
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
