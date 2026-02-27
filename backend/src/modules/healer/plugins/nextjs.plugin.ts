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
export class NextJsPlugin implements IStackPlugin {
  name = 'nextjs';
  version = '1.0.0';
  supportedVersions = ['13.x', '14.x', '15.x'];

  constructor(protected readonly sshExecutor: SSHExecutorService) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check for package.json
      await this.sshExecutor.executeCommand(server.id, `[ -f "${path}/package.json" ]`);
      
      // Read package.json
      const packageJsonContent = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${path}/package.json`,
      );
      
      const packageJson = JSON.parse(packageJsonContent);
      
      // Check if Next.js is a dependency
      const hasNext = packageJson.dependencies?.next || packageJson.devDependencies?.next;
      
      if (!hasNext) {
        return { detected: false, confidence: 0 };
      }
      
      // Check for next.config.js or next.config.mjs
      const hasNextConfig = await this.checkFileExists(server.id, `${path}/next.config.js`) ||
                           await this.checkFileExists(server.id, `${path}/next.config.mjs`);
      
      // Get Next.js version
      let version = 'unknown';
      try {
        const nextVersion = await this.sshExecutor.executeCommand(
          server.id,
          `cd ${path} && npm list next --depth=0 --json 2>/dev/null | grep -oP '"next":\\s*"\\K[^"]+'`,
        );
        version = nextVersion.trim();
      } catch {
        // Fallback to package.json version
        version = hasNext.replace(/[^0-9.]/g, '');
      }
      
      return {
        detected: true,
        techStack: 'NEXTJS',
        version,
        confidence: 0.95,
        metadata: {
          packageName: packageJson.name,
          hasNextConfig,
          hasTypeScript: !!packageJson.devDependencies?.typescript,
          hasAppRouter: await this.checkFileExists(server.id, `${path}/app`),
          hasPagesRouter: await this.checkFileExists(server.id, `${path}/pages`),
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'nextjs_build_status',
      'nextjs_dependencies',
      'nextjs_environment_config',
      'nextjs_process_health',
      'nextjs_static_assets',
      'nextjs_typescript_config',
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
        case 'nextjs_build_status':
          return await this.checkBuildStatus(application, server, startTime);
        case 'nextjs_dependencies':
          return await this.checkDependencies(application, server, startTime);
        case 'nextjs_environment_config':
          return await this.checkEnvironmentConfig(application, server, startTime);
        case 'nextjs_process_health':
          return await this.checkProcessHealth(application, server, startTime);
        case 'nextjs_static_assets':
          return await this.checkStaticAssets(application, server, startTime);
        case 'nextjs_typescript_config':
          return await this.checkTypeScriptConfig(application, server, startTime);
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

  private async checkBuildStatus(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if .next directory exists (build output)
      const hasBuild = await this.checkFileExists(server.id, `${application.path}/.next`);
      
      if (!hasBuild) {
        return {
          checkName: 'nextjs_build_status',
          category: 'SYSTEM',
          status: 'FAIL',
          severity: 'HIGH',
          message: 'Next.js build not found (.next directory missing)',
          suggestedFix: 'Run: npm run build',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check build timestamp
      const buildTime = await this.sshExecutor.executeCommand(
        server.id,
        `stat -c %Y ${application.path}/.next 2>/dev/null || echo "0"`,
      );
      
      const buildTimestamp = parseInt(buildTime.trim());
      const now = Math.floor(Date.now() / 1000);
      const ageInHours = (now - buildTimestamp) / 3600;
      
      if (ageInHours > 168) { // 7 days
        return {
          checkName: 'nextjs_build_status',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Build is ${Math.floor(ageInHours / 24)} days old`,
          details: { buildTimestamp, ageInHours },
          suggestedFix: 'Consider rebuilding: npm run build',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'nextjs_build_status',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Build exists (${Math.floor(ageInHours)} hours old)`,
        details: { buildTimestamp, ageInHours },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'nextjs_build_status',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check build status: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkDependencies(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check for npm audit vulnerabilities
      const auditOutput = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && npm audit --json 2>/dev/null || echo '{}'`,
      );
      
      const audit = JSON.parse(auditOutput || '{}');
      const vulnerabilities = audit.metadata?.vulnerabilities || {};
      const { critical = 0, high = 0, moderate = 0 } = vulnerabilities;
      
      if (critical > 0) {
        return {
          checkName: 'nextjs_dependencies',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: `${critical} critical vulnerabilities in dependencies`,
          details: { vulnerabilities },
          suggestedFix: 'Run: npm audit fix --force',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (high > 0) {
        return {
          checkName: 'nextjs_dependencies',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'HIGH',
          message: `${high} high severity vulnerabilities in dependencies`,
          details: { vulnerabilities },
          suggestedFix: 'Run: npm audit fix',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (moderate > 0) {
        return {
          checkName: 'nextjs_dependencies',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${moderate} moderate vulnerabilities in dependencies`,
          details: { vulnerabilities },
          suggestedFix: 'Run: npm audit fix',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'nextjs_dependencies',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'No vulnerabilities found in dependencies',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'nextjs_dependencies',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check dependencies: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkEnvironmentConfig(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check for .env.local (Next.js convention)
      const hasEnvLocal = await this.checkFileExists(server.id, `${application.path}/.env.local`);
      const hasEnv = await this.checkFileExists(server.id, `${application.path}/.env`);
      
      if (!hasEnvLocal && !hasEnv) {
        // Check if .env.example exists
        const hasEnvExample = await this.checkFileExists(server.id, `${application.path}/.env.example`);
        
        if (hasEnvExample) {
          return {
            checkName: 'nextjs_environment_config',
            category: 'CONFIGURATION',
            status: 'WARN',
            severity: 'MEDIUM',
            message: 'Environment files missing but .env.example exists',
            suggestedFix: 'Copy .env.example to .env.local and configure',
            executionTime: Date.now() - startTime,
          };
        }
        
        return {
          checkName: 'nextjs_environment_config',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'LOW',
          message: 'No environment files found',
          suggestedFix: 'Create .env.local with required environment variables',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'nextjs_environment_config',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: 'Environment configuration exists',
        details: { hasEnvLocal, hasEnv },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'nextjs_environment_config',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check environment config: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkProcessHealth(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if Next.js process is running
      const processCheck = await this.sshExecutor.executeCommand(
        server.id,
        `ps aux | grep "next.*${application.path}" | grep -v grep | wc -l`,
      );
      
      const processCount = parseInt(processCheck.trim());
      
      if (processCount === 0) {
        return {
          checkName: 'nextjs_process_health',
          category: 'SYSTEM',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Next.js application is not running',
          suggestedFix: 'Start the application: npm run start or pm2 start npm -- start',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (processCount > 1) {
        return {
          checkName: 'nextjs_process_health',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Multiple processes detected: ${processCount}`,
          details: { processCount },
          suggestedFix: 'Check for duplicate processes',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check process uptime
      const uptimeCheck = await this.sshExecutor.executeCommand(
        server.id,
        `ps -o etime= -p $(pgrep -f "next.*${application.path}" | head -1) 2>/dev/null || echo "unknown"`,
      );
      
      const uptime = uptimeCheck.trim();
      
      return {
        checkName: 'nextjs_process_health',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Next.js application is running (uptime: ${uptime})`,
        details: { processCount, uptime },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'nextjs_process_health',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check process health: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkStaticAssets(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if public directory exists
      const hasPublic = await this.checkFileExists(server.id, `${application.path}/public`);
      
      if (!hasPublic) {
        return {
          checkName: 'nextjs_static_assets',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'LOW',
          message: 'Public directory not found',
          suggestedFix: 'Create public directory for static assets',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check .next/static directory (built static assets)
      const hasNextStatic = await this.checkFileExists(server.id, `${application.path}/.next/static`);
      
      if (!hasNextStatic) {
        return {
          checkName: 'nextjs_static_assets',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Built static assets not found',
          suggestedFix: 'Run: npm run build',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'nextjs_static_assets',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: 'Static assets are properly configured',
        details: { hasPublic, hasNextStatic },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'nextjs_static_assets',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check static assets: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkTypeScriptConfig(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if TypeScript is used
      const hasTsConfig = await this.checkFileExists(server.id, `${application.path}/tsconfig.json`);
      
      if (!hasTsConfig) {
        return {
          checkName: 'nextjs_typescript_config',
          category: 'CONFIGURATION',
          status: 'PASS',
          severity: 'LOW',
          message: 'JavaScript project (no TypeScript)',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if TypeScript is installed
      const packageJson = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${application.path}/package.json`,
      );
      
      const pkg = JSON.parse(packageJson);
      const hasTypeScript = pkg.devDependencies?.typescript || pkg.dependencies?.typescript;
      
      if (!hasTypeScript) {
        return {
          checkName: 'nextjs_typescript_config',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'tsconfig.json exists but TypeScript not installed',
          suggestedFix: 'Run: npm install --save-dev typescript @types/react @types/node',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'nextjs_typescript_config',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: 'TypeScript is properly configured',
        details: { hasTsConfig, hasTypeScript },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'nextjs_typescript_config',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check TypeScript config: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkFileExists(serverId: string, filePath: string): Promise<boolean> {
    try {
      await this.sshExecutor.executeCommand(serverId, `[ -e "${filePath}" ]`);
      return true;
    } catch {
      return false;
    }
  }

  getHealingActions(): HealingAction[] {
    return [
      {
        name: 'rebuild',
        description: 'Rebuild Next.js application',
        commands: ['cd {{path}} && npm run build'],
        requiresBackup: false,
        estimatedDuration: 180,
        riskLevel: 'LOW',
      },
      {
        name: 'npm_install',
        description: 'Install/update npm dependencies',
        commands: ['cd {{path}} && npm install'],
        requiresBackup: true,
        estimatedDuration: 120,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'npm_audit_fix',
        description: 'Fix npm security vulnerabilities',
        commands: ['cd {{path}} && npm audit fix'],
        requiresBackup: true,
        estimatedDuration: 60,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'restart_app',
        description: 'Restart Next.js application (pm2)',
        commands: ['cd {{path}} && pm2 restart all || pm2 start npm --name "nextjs-app" -- start'],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'clear_cache',
        description: 'Clear Next.js cache and rebuild',
        commands: [
          'cd {{path}} && rm -rf .next',
          'cd {{path}} && npm run build',
        ],
        requiresBackup: false,
        estimatedDuration: 200,
        riskLevel: 'LOW',
      },
      {
        name: 'create_env_from_example',
        description: 'Create .env.local from .env.example',
        commands: ['cd {{path}} && cp .env.example .env.local'],
        requiresBackup: false,
        estimatedDuration: 5,
        riskLevel: 'LOW',
      },
      {
        name: 'install_typescript',
        description: 'Install TypeScript and type definitions',
        commands: ['cd {{path}} && npm install --save-dev typescript @types/react @types/node'],
        requiresBackup: true,
        estimatedDuration: 30,
        riskLevel: 'LOW',
      },
      {
        name: 'clear_node_modules',
        description: 'Clear node_modules and reinstall',
        commands: [
          'cd {{path}} && rm -rf node_modules',
          'cd {{path}} && npm install',
        ],
        requiresBackup: true,
        estimatedDuration: 180,
        riskLevel: 'MEDIUM',
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
