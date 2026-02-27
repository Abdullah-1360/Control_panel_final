import { Injectable } from '@nestjs/common';
import { Server } from '@prisma/client';
import {
  IStackPlugin,
  DetectionResult,
  DiagnosticCheckResult,
  HealingAction,
} from '../interfaces/stack-plugin.interface';
import { SSHExecutorService } from '../services/ssh-executor.service';

@Injectable()
export class NodeJsPlugin implements IStackPlugin {
  name = 'nodejs';
  version = '1.0.0';
  supportedVersions = ['18.x', '20.x', '22.x'];

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check for package.json
      await this.sshExecutor.executeCommand(server, `[ -f "${path}/package.json" ]`);
      
      // Read package.json
      const packageJsonContent = await this.sshExecutor.executeCommand(
        server,
        `cat ${path}/package.json`,
      );
      const packageJson = JSON.parse(packageJsonContent);
      
      // Exclude if it's Next.js or Express
      if (packageJson.dependencies?.next || packageJson.dependencies?.express) {
        return { detected: false, confidence: 0 };
      }
      
      // Get Node.js version
      const versionOutput = await this.sshExecutor.executeCommand(
        server,
        'node --version',
      );
      const version = versionOutput.trim().replace(/^v/, '');
      
      return {
        detected: true,
        techStack: 'NODEJS',
        version,
        confidence: 0.90,
        metadata: {
          packageName: packageJson.name,
          hasNodeModules: await this.checkNodeModules(server, path),
        },
      };
    } catch (error) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'npm_audit',
      'node_version',
      'package_lock_exists',
      'node_modules_exists',
      'env_file_exists',
      'process_health',
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
        case 'package_lock_exists':
          return await this.checkPackageLock(application, server, startTime);
        case 'node_modules_exists':
          return await this.checkNodeModules(application, server, startTime);
        case 'env_file_exists':
          return await this.checkEnvFile(application, server, startTime);
        case 'process_health':
          return await this.checkProcessHealth(application, server, startTime);
        default:
          throw new Error(`Unknown check: ${checkName}`);
      }
    } catch (error) {
      return {
        checkName,
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Check failed: ${error.message}`,
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
      const auditOutput = await this.sshExecutor.executeCommand(
        server,
        `cd ${application.path} && npm audit --json`,
      );
      
      const audit = JSON.parse(auditOutput);
      const vulnerabilities = audit.metadata?.vulnerabilities || {};
      const { critical = 0, high = 0, moderate = 0, low = 0 } = vulnerabilities;
      
      if (critical > 0) {
        return {
          checkName: 'npm_audit',
          category: 'SECURITY',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: `${critical} critical vulnerabilities found`,
          details: { vulnerabilities },
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
        message: 'No critical or high vulnerabilities',
        details: { vulnerabilities },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkName: 'npm_audit',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `npm audit failed: ${error.message}`,
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
      const versionOutput = await this.sshExecutor.executeCommand(
        server,
        'node --version',
      );
      const version = versionOutput.trim().replace(/^v/, '');
      const majorVersion = parseInt(version.split('.')[0]);
      
      if (majorVersion < 18) {
        return {
          checkName: 'node_version',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Node.js ${version} is outdated (< 18.x)`,
          details: { version, majorVersion },
          suggestedFix: 'Upgrade to Node.js 18.x or higher',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'node_version',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Node.js ${version} is up to date`,
        details: { version, majorVersion },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkName: 'node_version',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check Node.js version: ${error.message}`,
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
      await this.sshExecutor.executeCommand(
        server,
        `[ -f "${application.path}/package-lock.json" ]`,
      );
      
      return {
        checkName: 'package_lock_exists',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: 'package-lock.json exists',
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkName: 'package_lock_exists',
        category: 'CONFIGURATION',
        status: 'WARN',
        severity: 'LOW',
        message: 'package-lock.json not found',
        suggestedFix: 'Run: npm install to generate package-lock.json',
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkNodeModules(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      await this.sshExecutor.executeCommand(
        server,
        `[ -d "${application.path}/node_modules" ]`,
      );
      
      return {
        checkName: 'node_modules_exists',
        category: 'DEPENDENCIES',
        status: 'PASS',
        severity: 'LOW',
        message: 'node_modules directory exists',
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkName: 'node_modules_exists',
        category: 'DEPENDENCIES',
        status: 'FAIL',
        severity: 'HIGH',
        message: 'node_modules directory not found',
        suggestedFix: 'Run: npm install',
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
      await this.sshExecutor.executeCommand(
        server,
        `[ -f "${application.path}/.env" ]`,
      );
      
      return {
        checkName: 'env_file_exists',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: '.env file exists',
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkName: 'env_file_exists',
        category: 'CONFIGURATION',
        status: 'WARN',
        severity: 'MEDIUM',
        message: '.env file not found',
        suggestedFix: 'Create .env file with required environment variables',
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
      // Check if any Node.js process is running for this application
      const processCheck = await this.sshExecutor.executeCommand(
        server,
        `ps aux | grep "node" | grep "${application.path}" | grep -v grep || true`,
      );
      
      if (processCheck.trim()) {
        return {
          checkName: 'process_health',
          category: 'SYSTEM',
          status: 'PASS',
          severity: 'LOW',
          message: 'Node.js process is running',
          details: { process: processCheck.trim() },
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'process_health',
        category: 'SYSTEM',
        status: 'WARN',
        severity: 'MEDIUM',
        message: 'No Node.js process found running',
        suggestedFix: 'Start the application with npm start or pm2',
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkName: 'process_health',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check process health: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  getHealingActions(): HealingAction[] {
    return [
      {
        name: 'npm_install',
        description: 'Install npm dependencies',
        commands: ['cd {{path}} && npm install'],
        requiresBackup: false,
        estimatedDuration: 60,
        riskLevel: 'LOW',
      },
      {
        name: 'npm_audit_fix',
        description: 'Fix npm security vulnerabilities',
        commands: ['cd {{path}} && npm audit fix'],
        requiresBackup: true,
        estimatedDuration: 30,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'clear_node_modules',
        description: 'Clear and reinstall node_modules',
        commands: [
          'cd {{path}} && rm -rf node_modules',
          'cd {{path}} && npm install',
        ],
        requiresBackup: false,
        estimatedDuration: 90,
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
        const actualCommand = command.replace('{{path}}', application.path);
        const output = await this.sshExecutor.executeCommand(server, actualCommand);
        results.push(output);
      }
      
      return {
        success: true,
        message: `Successfully executed ${action.description}`,
        details: { results },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to execute ${action.description}: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  private async checkNodeModules(server: Server, path: string): Promise<boolean> {
    try {
      await this.sshExecutor.executeCommand(server, `[ -d "${path}/node_modules" ]`);
      return true;
    } catch {
      return false;
    }
  }
}
