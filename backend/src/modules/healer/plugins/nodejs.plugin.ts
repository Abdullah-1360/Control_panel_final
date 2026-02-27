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
export class NodeJsPlugin implements IStackPlugin {
  name = 'nodejs';
  version = '1.0.0';
  supportedVersions = ['18.x', '20.x', '22.x'];

  constructor(protected readonly sshExecutor: SSHExecutorService) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check for package.json
      await this.sshExecutor.executeCommand(server.id, `[ -f "${path}/package.json" ]`);
      
      // Read package.json to verify it's not WordPress or other framework
      const packageJsonContent = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${path}/package.json`,
      );
      
      const packageJson = JSON.parse(packageJsonContent);
      
      // Exclude if it's a WordPress, Next.js, or other specific framework
      if (packageJson.dependencies?.wordpress || 
          packageJson.dependencies?.next ||
          packageJson.name?.includes('wordpress')) {
        return { detected: false, confidence: 0 };
      }
      
      // Try to get Node.js version
      let version = 'unknown';
      try {
        const nodeVersion = await this.sshExecutor.executeCommand(
          server.id,
          `cd ${path} && node --version`,
        );
        version = nodeVersion.trim().replace('v', '');
      } catch {
        // Keep version as 'unknown'
      }
      
      return {
        detected: true,
        techStack: 'NODEJS',
        version,
        confidence: 0.90,
        metadata: {
          packageName: packageJson.name,
          hasExpress: !!packageJson.dependencies?.express,
          hasTypeScript: !!packageJson.devDependencies?.typescript,
          engines: packageJson.engines,
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'npm_audit',
      'node_version',
      'package_lock',
      'environment_variables',
      'process_health',
      'dependencies_outdated',
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
        case 'npm_audit':
          return await this.checkNpmAudit(application, server, startTime);
        case 'node_version':
          return await this.checkNodeVersion(application, server, startTime);
        case 'package_lock':
          return await this.checkPackageLock(application, server, startTime);
        case 'environment_variables':
          return await this.checkEnvironmentVariables(application, server, startTime);
        case 'process_health':
          return await this.checkProcessHealth(application, server, startTime);
        case 'dependencies_outdated':
          return await this.checkDependenciesOutdated(application, server, startTime);
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

  private async checkNpmAudit(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const output = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && npm audit --json 2>/dev/null || echo '{}'`,
      );
      
      const audit = JSON.parse(output || '{}');
      const vulnerabilities = audit.metadata?.vulnerabilities || {};
      const { critical = 0, high = 0, moderate = 0, low = 0 } = vulnerabilities;
      
      if (critical > 0) {
        return {
          checkName: 'npm_audit',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: `${critical} critical vulnerabilities found`,
          details: { vulnerabilities, audit },
          suggestedFix: 'Run: npm audit fix --force',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (high > 0) {
        return {
          checkName: 'npm_audit',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'HIGH',
          message: `${high} high severity vulnerabilities found`,
          details: { vulnerabilities, audit },
          suggestedFix: 'Run: npm audit fix',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (moderate > 0 || low > 0) {
        return {
          checkName: 'npm_audit',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${moderate + low} vulnerabilities found (moderate/low)`,
          details: { vulnerabilities },
          suggestedFix: 'Run: npm audit fix',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'npm_audit',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'No vulnerabilities found',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'npm_audit',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to run npm audit: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkNodeVersion(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const nodeVersion = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && node --version`,
      );
      
      const version = nodeVersion.trim().replace('v', '');
      const majorVersion = parseInt(version.split('.')[0]);
      
      // Check if Node.js version is supported (18, 20, 22 are LTS)
      if (majorVersion < 18) {
        return {
          checkName: 'node_version',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: `Node.js ${version} is outdated (< 18.x)`,
          details: { version, majorVersion },
          suggestedFix: 'Upgrade to Node.js 18.x or higher',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check package.json engines requirement
      try {
        const packageJson = await this.sshExecutor.executeCommand(
          server.id,
          `cat ${application.path}/package.json`,
        );
        const pkg = JSON.parse(packageJson);
        
        if (pkg.engines?.node) {
          const requiredVersion = pkg.engines.node;
          return {
            checkName: 'node_version',
            category: 'SYSTEM',
            status: 'PASS',
            severity: 'LOW',
            message: `Node.js ${version} (required: ${requiredVersion})`,
            details: { version, requiredVersion },
            executionTime: Date.now() - startTime,
          };
        }
      } catch {
        // Ignore if can't read package.json
      }
      
      return {
        checkName: 'node_version',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Node.js ${version}`,
        details: { version, majorVersion },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'node_version',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check Node.js version: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPackageLock(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if package-lock.json exists
      await this.sshExecutor.executeCommand(
        server.id,
        `[ -f "${application.path}/package-lock.json" ]`,
      );
      
      // Check if package-lock.json is in sync with package.json
      try {
        await this.sshExecutor.executeCommand(
          server.id,
          `cd ${application.path} && npm ls --depth=0 >/dev/null 2>&1`,
        );
        
        return {
          checkName: 'package_lock',
          category: 'DEPENDENCIES',
          status: 'PASS',
          severity: 'LOW',
          message: 'package-lock.json is in sync',
          executionTime: Date.now() - startTime,
        };
      } catch {
        return {
          checkName: 'package_lock',
          category: 'DEPENDENCIES',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'package-lock.json is out of sync with package.json',
          suggestedFix: 'Run: npm install',
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      return {
        checkName: 'package_lock',
        category: 'DEPENDENCIES',
        status: 'WARN',
        severity: 'LOW',
        message: 'package-lock.json not found',
        suggestedFix: 'Run: npm install to generate package-lock.json',
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkEnvironmentVariables(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if .env file exists
      const hasEnv = await this.sshExecutor.executeCommand(
        server.id,
        `[ -f "${application.path}/.env" ] && echo "exists" || echo "missing"`,
      );
      
      if (hasEnv.trim() === 'missing') {
        // Check if .env.example exists
        const hasEnvExample = await this.sshExecutor.executeCommand(
          server.id,
          `[ -f "${application.path}/.env.example" ] && echo "exists" || echo "missing"`,
        );
        
        if (hasEnvExample.trim() === 'exists') {
          return {
            checkName: 'environment_variables',
            category: 'CONFIGURATION',
            status: 'WARN',
            severity: 'HIGH',
            message: '.env file missing but .env.example exists',
            suggestedFix: 'Copy .env.example to .env and configure',
            executionTime: Date.now() - startTime,
          };
        }
        
        return {
          checkName: 'environment_variables',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'MEDIUM',
          message: '.env file not found',
          suggestedFix: 'Create .env file with required environment variables',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'environment_variables',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: '.env file exists',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'environment_variables',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check environment variables: ${error?.message || 'Unknown error'}`,
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
      // Try to find Node.js process for this application
      const processCheck = await this.sshExecutor.executeCommand(
        server.id,
        `ps aux | grep "node.*${application.path}" | grep -v grep | wc -l`,
      );
      
      const processCount = parseInt(processCheck.trim());
      
      if (processCount === 0) {
        return {
          checkName: 'process_health',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: 'No Node.js process found for this application',
          suggestedFix: 'Start the application using pm2 or systemd',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (processCount > 1) {
        return {
          checkName: 'process_health',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Multiple Node.js processes found: ${processCount}`,
          details: { processCount },
          suggestedFix: 'Check for duplicate processes',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'process_health',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: 'Node.js process is running',
        details: { processCount },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'process_health',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check process health: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkDependenciesOutdated(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      const output = await this.sshExecutor.executeCommand(
        server.id,
        `cd ${application.path} && npm outdated --json 2>/dev/null || echo '{}'`,
      );
      
      const outdated = JSON.parse(output || '{}');
      const outdatedCount = Object.keys(outdated).length;
      
      if (outdatedCount > 10) {
        return {
          checkName: 'dependencies_outdated',
          category: 'DEPENDENCIES',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${outdatedCount} outdated dependencies`,
          details: { outdatedCount, packages: Object.keys(outdated) },
          suggestedFix: 'Run: npm update',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (outdatedCount > 0) {
        return {
          checkName: 'dependencies_outdated',
          category: 'DEPENDENCIES',
          status: 'WARN',
          severity: 'LOW',
          message: `${outdatedCount} outdated dependencies`,
          details: { outdatedCount, packages: Object.keys(outdated) },
          suggestedFix: 'Run: npm update',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'dependencies_outdated',
        category: 'DEPENDENCIES',
        status: 'PASS',
        severity: 'LOW',
        message: 'All dependencies are up to date',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'dependencies_outdated',
        category: 'DEPENDENCIES',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check outdated dependencies: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  getHealingActions(): HealingAction[] {
    return [
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
        name: 'npm_audit_fix_force',
        description: 'Force fix npm security vulnerabilities',
        commands: ['cd {{path}} && npm audit fix --force'],
        requiresBackup: true,
        estimatedDuration: 90,
        riskLevel: 'HIGH',
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
      {
        name: 'npm_update',
        description: 'Update npm dependencies',
        commands: ['cd {{path}} && npm update'],
        requiresBackup: true,
        estimatedDuration: 120,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'restart_process',
        description: 'Restart Node.js process (pm2)',
        commands: ['cd {{path}} && pm2 restart all || pm2 start npm --name "app" -- start'],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'create_env_from_example',
        description: 'Create .env from .env.example',
        commands: ['cd {{path}} && cp .env.example .env'],
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
