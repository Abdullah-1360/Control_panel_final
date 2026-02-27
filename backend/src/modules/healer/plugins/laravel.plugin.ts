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
export class LaravelPlugin implements IStackPlugin {
  name = 'laravel';
  version = '1.0.0';
  supportedVersions = ['9.x', '10.x', '11.x'];

  constructor(protected readonly sshExecutor: SSHExecutorService) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check for artisan file (Laravel's CLI tool)
      await this.sshExecutor.executeCommand(server.id, `[ -f "${path}/artisan" ]`);
      
      // Check for composer.json with laravel/framework
      const composerContent = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${path}/composer.json`,
      );
      
      const composer = JSON.parse(composerContent);
      
      // Verify it's Laravel
      if (!composer.require?.['laravel/framework']) {
        return { detected: false, confidence: 0 };
      }
      
      // Get Laravel version
      let version = 'unknown';
      try {
        const versionOutput = await this.sshExecutor.executeCommand(
          server.id,
          `cd ${path} && php artisan --version | grep -oP 'Laravel Framework \\K[0-9.]+'`,
        );
        version = versionOutput.trim();
      } catch {
        // Try to get version from composer.json
        const frameworkVersion = composer.require['laravel/framework'];
        version = frameworkVersion.replace(/[^0-9.]/g, '').split('.')[0] + '.x';
      }
      
      return {
        detected: true,
        techStack: 'LARAVEL',
        version,
        confidence: 0.95,
        metadata: {
          hasArtisan: true,
          phpVersion: composer.require?.php || 'unknown',
          laravelVersion: version,
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'laravel_config_cache',
      'laravel_route_cache',
      'laravel_storage_permissions',
      'laravel_database_connection',
      'laravel_queue_worker',
      'composer_dependencies',
      'laravel_env_file',
      'laravel_app_key',
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
        case 'laravel_config_cache':
          return await this.checkConfigCache(application, server, startTime);
        case 'laravel_route_cache':
          return await this.checkRouteCache(application, server, startTime);
        case 'laravel_storage_permissions':
          return await this.checkStoragePermissions(application, server, startTime);
        case 'laravel_database_connection':
          return await this.checkDatabaseConnection(application, server, startTime);
        case 'laravel_queue_worker':
          return await this.checkQueueWorker(application, server, startTime);
        case 'composer_dependencies':
          return await this.checkComposerDependencies(application, server, startTime);
        case 'laravel_env_file':
          return await this.checkEnvFile(application, server, startTime);
        case 'laravel_app_key':
          return await this.checkAppKey(application, server, startTime);
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

  private async checkConfigCache(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if config is cached
      const hasCachedConfig = await this.checkFileExists(
        server.id,
        `${application.path}/bootstrap/cache/config.php`,
      );
      
      if (!hasCachedConfig) {
        return {
          checkName: 'laravel_config_cache',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'LOW',
          message: 'Configuration not cached (performance impact)',
          suggestedFix: 'Run: php artisan config:cache',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if cache is stale (older than config files)
      const cacheTime = await this.sshExecutor.executeCommand(
        server.id,
        `stat -c %Y ${application.path}/bootstrap/cache/config.php`,
      );
      
      const configTime = await this.sshExecutor.executeCommand(
        server.id,
        `find ${application.path}/config -name "*.php" -type f -printf '%T@\\n' | sort -n | tail -1`,
      );
      
      const cacheTimestamp = parseInt(cacheTime.trim());
      const configTimestamp = Math.floor(parseFloat(configTime.trim()));
      
      if (configTimestamp > cacheTimestamp) {
        return {
          checkName: 'laravel_config_cache',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Config cache is stale (config files modified)',
          details: { cacheTimestamp, configTimestamp },
          suggestedFix: 'Run: php artisan config:cache',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_config_cache',
        category: 'PERFORMANCE',
        status: 'PASS',
        severity: 'LOW',
        message: 'Configuration is cached and up to date',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_config_cache',
        category: 'PERFORMANCE',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check config cache: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkRouteCache(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if routes are cached
      const hasCachedRoutes = await this.checkFileExists(
        server.id,
        `${application.path}/bootstrap/cache/routes-v7.php`,
      );
      
      if (!hasCachedRoutes) {
        return {
          checkName: 'laravel_route_cache',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'LOW',
          message: 'Routes not cached (performance impact)',
          suggestedFix: 'Run: php artisan route:cache',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_route_cache',
        category: 'PERFORMANCE',
        status: 'PASS',
        severity: 'LOW',
        message: 'Routes are cached',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_route_cache',
        category: 'PERFORMANCE',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check route cache: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkStoragePermissions(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check storage directory permissions
      const storagePerms = await this.sshExecutor.executeCommand(
        server.id,
        `stat -c "%a" ${application.path}/storage 2>/dev/null || echo "0"`,
      );
      
      const permissions = parseInt(storagePerms.trim());
      
      if (permissions === 0) {
        return {
          checkName: 'laravel_storage_permissions',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Storage directory not found or inaccessible',
          suggestedFix: 'Ensure storage directory exists with proper permissions',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if storage is writable
      const isWritable = await this.sshExecutor.executeCommand(
        server.id,
        `[ -w "${application.path}/storage" ] && echo "writable" || echo "not-writable"`,
      );
      
      if (isWritable.trim() === 'not-writable') {
        return {
          checkName: 'laravel_storage_permissions',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'HIGH',
          message: 'Storage directory is not writable',
          details: { permissions },
          suggestedFix: 'Run: chmod -R 775 storage && chmod -R 775 bootstrap/cache',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check bootstrap/cache permissions
      const bootstrapPerms = await this.sshExecutor.executeCommand(
        server.id,
        `stat -c "%a" ${application.path}/bootstrap/cache 2>/dev/null || echo "0"`,
      );
      
      const bootstrapPermissions = parseInt(bootstrapPerms.trim());
      
      if (bootstrapPermissions < 775) {
        return {
          checkName: 'laravel_storage_permissions',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Bootstrap cache permissions may be too restrictive',
          details: { storagePerms: permissions, bootstrapPerms: bootstrapPermissions },
          suggestedFix: 'Run: chmod -R 775 bootstrap/cache',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_storage_permissions',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'Storage and cache directories have correct permissions',
        details: { storagePerms: permissions, bootstrapPerms: bootstrapPermissions },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_storage_permissions',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check storage permissions: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkDatabaseConnection(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Try to connect to database using artisan
      const dbCheck = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && php artisan db:show 2>&1 || echo "FAILED"`,
      );
      
      if (dbCheck.includes('FAILED') || dbCheck.includes('error') || dbCheck.includes('SQLSTATE')) {
        return {
          checkName: 'laravel_database_connection',
          category: 'DATABASE',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Cannot connect to database',
          details: { error: dbCheck },
          suggestedFix: 'Check database credentials in .env file',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_database_connection',
        category: 'DATABASE',
        status: 'PASS',
        severity: 'LOW',
        message: 'Database connection successful',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_database_connection',
        category: 'DATABASE',
        status: 'FAIL',
        severity: 'CRITICAL',
        message: `Database connection failed: ${error?.message || 'Unknown error'}`,
        suggestedFix: 'Check database credentials and ensure database server is running',
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkQueueWorker(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if queue worker is running
      const queueProcess = await this.sshExecutor.executeCommand(
        server.id,
        `ps aux | grep "artisan queue:work" | grep -v grep | wc -l`,
      );
      
      const processCount = parseInt(queueProcess.trim());
      
      // Check if there are queued jobs
      const queuedJobs = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && php artisan queue:failed --format=json 2>/dev/null | jq 'length' 2>/dev/null || echo "0"`,
      );
      
      const failedJobCount = parseInt(queuedJobs.trim());
      
      if (processCount === 0 && failedJobCount > 0) {
        return {
          checkName: 'laravel_queue_worker',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: `Queue worker not running, ${failedJobCount} failed jobs`,
          details: { processCount, failedJobCount },
          suggestedFix: 'Start queue worker: php artisan queue:work',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (processCount === 0) {
        return {
          checkName: 'laravel_queue_worker',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Queue worker not running',
          details: { processCount },
          suggestedFix: 'Start queue worker: php artisan queue:work',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (failedJobCount > 0) {
        return {
          checkName: 'laravel_queue_worker',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Queue worker running, but ${failedJobCount} failed jobs`,
          details: { processCount, failedJobCount },
          suggestedFix: 'Review failed jobs: php artisan queue:failed',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_queue_worker',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Queue worker running (${processCount} process(es))`,
        details: { processCount, failedJobCount },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_queue_worker',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check queue worker: ${error?.message || 'Unknown error'}`,
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
      // Check for outdated packages
      const outdated = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && composer outdated --direct --format=json 2>/dev/null || echo '{"installed":[]}'`,
      );
      
      const outdatedData = JSON.parse(outdated);
      const outdatedCount = outdatedData.installed?.length || 0;
      
      if (outdatedCount > 10) {
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

  private async checkEnvFile(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if .env file exists
      const hasEnv = await this.checkFileExists(server.id, `${application.path}/.env`);
      
      if (!hasEnv) {
        return {
          checkName: 'laravel_env_file',
          category: 'CONFIGURATION',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: '.env file not found',
          suggestedFix: 'Copy .env.example to .env and configure',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if .env has required keys
      const envContent = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${application.path}/.env`,
      );
      
      const requiredKeys = ['APP_KEY', 'DB_CONNECTION', 'DB_HOST', 'DB_DATABASE'];
      const missingKeys = requiredKeys.filter(key => !envContent.includes(key));
      
      if (missingKeys.length > 0) {
        return {
          checkName: 'laravel_env_file',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'HIGH',
          message: `Missing required environment variables: ${missingKeys.join(', ')}`,
          details: { missingKeys },
          suggestedFix: 'Add missing keys to .env file',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_env_file',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: '.env file exists with required keys',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_env_file',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check .env file: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkAppKey(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if APP_KEY is set
      const envContent = await this.sshExecutor.executeCommand(
        server.id,
        `grep "^APP_KEY=" ${application.path}/.env || echo "APP_KEY="`,
      );
      
      const appKey = envContent.trim().split('=')[1];
      
      if (!appKey || appKey === '') {
        return {
          checkName: 'laravel_app_key',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'APP_KEY not set (security risk)',
          suggestedFix: 'Run: php artisan key:generate',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if APP_KEY is the default/example value
      if (appKey.includes('SomeRandomString') || appKey.length < 32) {
        return {
          checkName: 'laravel_app_key',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'APP_KEY is default or invalid (security risk)',
          suggestedFix: 'Run: php artisan key:generate',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'laravel_app_key',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'APP_KEY is properly configured',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'laravel_app_key',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check APP_KEY: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
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

  getHealingActions(): HealingAction[] {
    return [
      {
        name: 'cache_clear',
        description: 'Clear all Laravel caches',
        commands: [
          'cd {{path}} && php artisan cache:clear',
          'cd {{path}} && php artisan config:clear',
          'cd {{path}} && php artisan route:clear',
          'cd {{path}} && php artisan view:clear',
        ],
        requiresBackup: false,
        estimatedDuration: 15,
        riskLevel: 'LOW',
      },
      {
        name: 'optimize',
        description: 'Optimize Laravel application',
        commands: [
          'cd {{path}} && php artisan config:cache',
          'cd {{path}} && php artisan route:cache',
          'cd {{path}} && php artisan view:cache',
        ],
        requiresBackup: false,
        estimatedDuration: 30,
        riskLevel: 'LOW',
      },
      {
        name: 'migrate',
        description: 'Run database migrations',
        commands: ['cd {{path}} && php artisan migrate --force'],
        requiresBackup: true,
        estimatedDuration: 60,
        riskLevel: 'HIGH',
      },
      {
        name: 'queue_restart',
        description: 'Restart queue workers',
        commands: ['cd {{path}} && php artisan queue:restart'],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'composer_update',
        description: 'Update Composer dependencies',
        commands: ['cd {{path}} && composer update --no-dev --optimize-autoloader'],
        requiresBackup: true,
        estimatedDuration: 180,
        riskLevel: 'HIGH',
      },
      {
        name: 'fix_storage_permissions',
        description: 'Fix storage and cache permissions',
        commands: [
          'cd {{path}} && chmod -R 775 storage',
          'cd {{path}} && chmod -R 775 bootstrap/cache',
        ],
        requiresBackup: false,
        estimatedDuration: 30,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'generate_app_key',
        description: 'Generate application key',
        commands: ['cd {{path}} && php artisan key:generate --force'],
        requiresBackup: true,
        estimatedDuration: 5,
        riskLevel: 'HIGH',
      },
      {
        name: 'clear_failed_jobs',
        description: 'Clear failed queue jobs',
        commands: ['cd {{path}} && php artisan queue:flush'],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'storage_link',
        description: 'Create storage symbolic link',
        commands: ['cd {{path}} && php artisan storage:link'],
        requiresBackup: false,
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
