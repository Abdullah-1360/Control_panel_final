/**
 * SSH Executor Service
 * 
 * Wrapper around SSH connection service for diagnostic checks and healing actions
 * Provides simplified interface for executing commands on remote servers
 */

import { Injectable, Logger } from '@nestjs/common';
import { SSHConnectionService, SSHConnectionConfig } from '../../servers/ssh-connection.service';
import { EncryptionService } from '../../encryption/encryption.service';

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

@Injectable()
export class SSHExecutorService {
  private readonly logger = new Logger(SSHExecutorService.name);
  
  constructor(
    private readonly sshService: SSHConnectionService,
    private readonly encryptionService: EncryptionService,
  ) {}
  
  /**
   * Execute a command on a server
   */
  async executeCommand(
    server: any,
    command: string,
    timeout: number = 30000,
  ): Promise<CommandResult> {
    try {
      // Build SSH config from server credentials
      const config = await this.buildSSHConfig(server, timeout);
      
      // Execute command
      const result = await this.sshService.executeCommand(
        config,
        server.id,
        command,
      );
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.success ? 0 : 1,
      };
    } catch (error: any) {
      this.logger.error(`Command execution failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        exitCode: 1,
      };
    }
  }
  
  /**
   * Execute multiple commands sequentially
   */
  async executeCommands(
    server: any,
    commands: string[],
    timeout: number = 30000,
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    
    for (const command of commands) {
      const result = await this.executeCommand(server, command, timeout);
      results.push(result);
      
      // Stop on first failure
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Check if a file exists on the server
   */
  async fileExists(server: any, path: string): Promise<boolean> {
    const result = await this.executeCommand(
      server,
      `test -f "${path}" && echo "exists" || echo "not_found"`,
    );
    
    return result.success && result.output?.trim() === 'exists';
  }
  
  /**
   * Check if a directory exists on the server
   */
  async directoryExists(server: any, path: string): Promise<boolean> {
    const result = await this.executeCommand(
      server,
      `test -d "${path}" && echo "exists" || echo "not_found"`,
    );
    
    return result.success && result.output?.trim() === 'exists';
  }
  
  /**
   * Read a file from the server
   */
  async readFile(server: any, path: string): Promise<string | null> {
    const result = await this.executeCommand(server, `cat "${path}"`);
    
    if (result.success) {
      return result.output || null;
    }
    
    return null;
  }
  
  /**
   * Get file permissions
   */
  async getFilePermissions(server: any, path: string): Promise<string | null> {
    const result = await this.executeCommand(
      server,
      `stat -c "%a" "${path}" 2>/dev/null || stat -f "%Lp" "${path}"`,
    );
    
    if (result.success) {
      return result.output?.trim() || null;
    }
    
    return null;
  }
  
  /**
   * Get disk usage for a path
   */
  async getDiskUsage(server: any, path: string): Promise<number | null> {
    const result = await this.executeCommand(
      server,
      `df -h "${path}" | tail -1 | awk '{print $5}' | sed 's/%//'`,
    );
    
    if (result.success && result.output) {
      const usage = parseInt(result.output.trim(), 10);
      return isNaN(usage) ? null : usage;
    }
    
    return null;
  }
  
  /**
   * Get memory usage
   */
  async getMemoryUsage(server: any): Promise<{
    used: number;
    total: number;
    percentage: number;
  } | null> {
    const result = await this.executeCommand(
      server,
      `free -m | grep Mem | awk '{print $3,$2}'`,
    );
    
    if (result.success && result.output) {
      const parts = result.output.trim().split(' ');
      if (parts.length === 2) {
        const used = parseInt(parts[0], 10);
        const total = parseInt(parts[1], 10);
        
        if (!isNaN(used) && !isNaN(total) && total > 0) {
          return {
            used,
            total,
            percentage: (used / total) * 100,
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get CPU usage
   */
  async getCPUUsage(server: any): Promise<number | null> {
    const result = await this.executeCommand(
      server,
      `top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'`,
    );
    
    if (result.success && result.output) {
      const usage = parseFloat(result.output.trim());
      return isNaN(usage) ? null : usage;
    }
    
    return null;
  }
  
  /**
   * Build SSH configuration from server credentials
   */
  private async buildSSHConfig(
    server: any,
    timeout: number,
  ): Promise<SSHConnectionConfig> {
    const config: SSHConnectionConfig = {
      host: server.host,
      port: server.port,
      username: server.username,
      timeout,
    };
    
    // Decrypt credentials
    if (server.privateKey) {
      config.privateKey = await this.encryptionService.decrypt(server.privateKey);
      
      if (server.passphrase) {
        config.passphrase = await this.encryptionService.decrypt(server.passphrase);
      }
    } else if (server.password) {
      config.password = await this.encryptionService.decrypt(server.password);
    }
    
    return config;
  }
}
