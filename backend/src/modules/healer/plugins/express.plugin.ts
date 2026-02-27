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
export class ExpressPlugin implements IStackPlugin {
  name = 'express';
  version = '1.0.0';
  supportedVersions = ['4.x', '5.x'];

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
      
      // Check if Express is a dependency
      const hasExpress = packageJson.dependencies?.express || packageJson.devDependencies?.express;
      
      if (!hasExpress) {
        return { detected: false, confidence: 0 };
      }
      
      // Exclude Next.js (has its own plugin)
      if (packageJson.dependencies?.next) {
        return { detected: false, confidence: 0 };
      }
      
      // Get Express version
      let version = 'unknown';
      try {
        const expressVersion = await this.sshExecutor.executeCommand(
          server.id,
          `cd ${path} && npm list express --depth=0 --json 2>/dev/null | grep -oP '"express":\\s*"\\K[^"]+'`,
        );
        version = expressVersion.trim();
      } catch {
        // Fallback to package.json version
        version = hasExpress.replace(/[^0-9.]/g, '');
      }
      
      return {
        detected: true,
        techStack: 'EXPRESS',
        version,
        confidence: 0.85,
        metadata: {
          packageName: packageJson.name,
          hasTypeScript: !!packageJson.devDependencies?.typescript,
          hasNodemon: !!packageJson.devDependencies?.nodemon,
          scripts: packageJson.scripts || {},
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'express_dependencies',
      'express_security_middleware',
      'express_error_handling',
      'express_process_health',
      'express_environment_config',
      'express_port_availability',
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
        case 'express_dependencies':
          return await this.checkDependencies(application, server, startTime);
        case 'express_security_middleware':
          return await this.checkSecurityMiddleware(application, server, startTime);
        case 'express_error_handling':
          return await this.checkErrorHandling(application, server, startTime);
        case 'express_process_health':
          return await this.checkProcessHealth(application, server, startTime);
        case 'express_environment_config':
          return await this.checkEnvironmentConfig(application, server, startTime);
        case 'express_port_availability':
          return await this.checkPortAvailability(application, server, startTime);
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
          checkName: 'express_dependencies',
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
          checkName: 'express_dependencies',
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
          checkName: 'express_dependencies',
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
        checkName: 'express_dependencies',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'No vulnerabilities found in dependencies',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'express_dependencies',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check dependencies: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkSecurityMiddleware(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if helmet is installed (security middleware)
      const packageJson = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${application.path}/package.json`,
      );
      
      const pkg = JSON.parse(packageJson);
      const hasHelmet = pkg.dependencies?.helmet || pkg.devDependencies?.helmet;
      const hasCors = pkg.dependencies?.cors || pkg.devDependencies?.cors;
      
      const issues: string[] = [];
      
      if (!hasHelmet) {
        issues.push('helmet middleware not installed (security headers)');
      }
      
      if (!hasCors) {
        issues.push('cors middleware not installed (CORS protection)');
      }
      
      // Check for common entry files
      const entryFiles = ['index.js', 'app.js', 'server.js', 'src/index.js', 'src/app.js', 'src/server.js'];
      let entryFile = null;
      
      for (const file of entryFiles) {
        try {
          await this.sshExecutor.executeCommand(server.id, `[ -f "${application.path}/${file}" ]`);
          entryFile = file;
          break;
        } catch {
          continue;
        }
      }
      
      if (entryFile && hasHelmet) {
        // Check if helmet is actually used in code
        const codeContent = await this.sshExecutor.executeCommand(
          server.id,
          `cat ${application.path}/${entryFile}`,
        );
        
        if (!codeContent.includes('helmet')) {
          issues.push('helmet installed but not used in code');
        }
      }
      
      if (issues.length > 0) {
        return {
          checkName: 'express_security_middleware',
          category: 'SECURITY',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `${issues.length} security middleware issue(s)`,
          details: { issues, hasHelmet, hasCors },
          suggestedFix: 'Install and use helmet and cors middleware',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'express_security_middleware',
        category: 'SECURITY',
        status: 'PASS',
        severity: 'LOW',
        message: 'Security middleware properly configured',
        details: { hasHelmet, hasCors },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'express_security_middleware',
        category: 'SECURITY',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check security middleware: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkErrorHandling(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check for common entry files
      const entryFiles = ['index.js', 'app.js', 'server.js', 'src/index.js', 'src/app.js', 'src/server.js'];
      let entryFile = null;
      
      for (const file of entryFiles) {
        try {
          await this.sshExecutor.executeCommand(server.id, `[ -f "${application.path}/${file}" ]`);
          entryFile = file;
          break;
        } catch {
          continue;
        }
      }
      
      if (!entryFile) {
        return {
          checkName: 'express_error_handling',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'LOW',
          message: 'Could not find entry file to check error handling',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if error handling middleware exists
      const codeContent = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${application.path}/${entryFile}`,
      );
      
      const hasErrorHandler = codeContent.includes('(err, req, res, next)') || 
                             codeContent.includes('app.use((err') ||
                             codeContent.includes('errorHandler');
      
      if (!hasErrorHandler) {
        return {
          checkName: 'express_error_handling',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'No error handling middleware detected',
          details: { entryFile },
          suggestedFix: 'Add error handling middleware: app.use((err, req, res, next) => {...})',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'express_error_handling',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: 'Error handling middleware detected',
        details: { entryFile },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'express_error_handling',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check error handling: ${error?.message || 'Unknown error'}`,
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
      // Check if Node.js process is running for this application
      const processCheck = await this.sshExecutor.executeCommand(
        server.id,
        `ps aux | grep "node.*${application.path}" | grep -v grep | wc -l`,
      );
      
      const processCount = parseInt(processCheck.trim());
      
      if (processCount === 0) {
        return {
          checkName: 'express_process_health',
          category: 'SYSTEM',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Express application is not running',
          suggestedFix: 'Start the application using pm2 or npm start',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (processCount > 1) {
        return {
          checkName: 'express_process_health',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Multiple processes detected: ${processCount}`,
          details: { processCount },
          suggestedFix: 'Check for duplicate processes and stop extras',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check process uptime
      const uptimeCheck = await this.sshExecutor.executeCommand(
        server.id,
        `ps -o etime= -p $(pgrep -f "node.*${application.path}" | head -1) 2>/dev/null || echo "unknown"`,
      );
      
      const uptime = uptimeCheck.trim();
      
      return {
        checkName: 'express_process_health',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Express application is running (uptime: ${uptime})`,
        details: { processCount, uptime },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'express_process_health',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'HIGH',
        message: `Failed to check process health: ${error?.message || 'Unknown error'}`,
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
      // Check if .env file exists
      const hasEnv = await this.checkFileExists(server.id, `${application.path}/.env`);
      
      if (!hasEnv) {
        // Check if .env.example exists
        const hasEnvExample = await this.checkFileExists(server.id, `${application.path}/.env.example`);
        
        if (hasEnvExample) {
          return {
            checkName: 'express_environment_config',
            category: 'CONFIGURATION',
            status: 'WARN',
            severity: 'HIGH',
            message: '.env file missing but .env.example exists',
            suggestedFix: 'Copy .env.example to .env and configure',
            executionTime: Date.now() - startTime,
          };
        }
        
        return {
          checkName: 'express_environment_config',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'MEDIUM',
          message: '.env file not found',
          suggestedFix: 'Create .env file with required environment variables',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check for common required variables
      const envContent = await this.sshExecutor.executeCommand(
        server.id,
        `cat ${application.path}/.env`,
      );
      
      const commonVars = ['PORT', 'NODE_ENV'];
      const missingVars = commonVars.filter(v => !envContent.includes(v));
      
      if (missingVars.length > 0) {
        return {
          checkName: 'express_environment_config',
          category: 'CONFIGURATION',
          status: 'WARN',
          severity: 'LOW',
          message: `Missing common environment variables: ${missingVars.join(', ')}`,
          details: { missingVars },
          suggestedFix: 'Add missing variables to .env file',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'express_environment_config',
        category: 'CONFIGURATION',
        status: 'PASS',
        severity: 'LOW',
        message: '.env file exists with common variables',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'express_environment_config',
        category: 'CONFIGURATION',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check environment config: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkPortAvailability(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Try to get PORT from .env
      let port = '3000'; // Default Express port
      
      try {
        const envContent = await this.sshExecutor.executeCommand(
          server.id,
          `grep "^PORT=" ${application.path}/.env 2>/dev/null || echo "PORT=3000"`,
        );
        port = envContent.trim().split('=')[1] || '3000';
      } catch {
        // Use default port
      }
      
      // Check if port is in use
      const portCheck = await this.sshExecutor.executeCommand(
        server.id,
        `netstat -tuln 2>/dev/null | grep ":${port} " | wc -l || ss -tuln 2>/dev/null | grep ":${port} " | wc -l || echo "0"`,
      );
      
      const portInUse = parseInt(portCheck.trim()) > 0;
      
      if (!portInUse) {
        return {
          checkName: 'express_port_availability',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: `Port ${port} is not in use (application may not be running)`,
          details: { port },
          suggestedFix: 'Start the Express application',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'express_port_availability',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Port ${port} is in use (application is listening)`,
        details: { port },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'express_port_availability',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check port availability: ${error?.message || 'Unknown error'}`,
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
        description: 'Restart Express application (pm2)',
        commands: ['cd {{path}} && pm2 restart all || pm2 start npm --name "express-app" -- start'],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'LOW',
      },
      {
        name: 'install_security_middleware',
        description: 'Install helmet and cors middleware',
        commands: [
          'cd {{path}} && npm install helmet cors --save',
        ],
        requiresBackup: true,
        estimatedDuration: 30,
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
