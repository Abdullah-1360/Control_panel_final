/**
 * SSH Executor Service
 * 
 * Wrapper around SSH connection service for diagnostic checks and healing actions
 * Provides simplified interface for executing commands on remote servers
 * 
 * OPTIMIZATION: Implements rate limiting with semaphore to prevent server flooding
 * Max 5 concurrent SSH connections, 100ms delay between commands
 */

import { Injectable, Logger } from '@nestjs/common';
import { SSHConnectionService, SSHConnectionConfig } from '../../servers/ssh-connection.service';
import { EncryptionService } from '../../encryption/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

/**
 * Semaphore for rate limiting SSH connections
 * Prevents server flooding by limiting concurrent connections
 */
class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;
  
  constructor(private max: number) {}
  
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}

@Injectable()
export class SSHExecutorService {
  private readonly logger = new Logger(SSHExecutorService.name);
  private readonly MAX_CONCURRENT = 5; // Max 5 concurrent SSH connections
  private readonly DELAY_BETWEEN_COMMANDS = 100; // 100ms delay
  private semaphore = new Semaphore(this.MAX_CONCURRENT);
  
  constructor(
    private readonly sshService: SSHConnectionService,
    private readonly encryptionService: EncryptionService,
    private readonly prisma: PrismaService,
  ) {}
  
  /**
   * Execute a command on a server (backward compatible - returns string)
   * @deprecated Use executeCommandDetailed for CommandResult object
   */
  async executeCommand(
    serverId: string,
    command: string,
    timeout: number = 30000,
  ): Promise<string> {
    const result = await this.executeCommandDetailed(serverId, command, timeout);
    if (result.success && result.output) {
      return result.output;
    }
    throw new Error(result.error || 'Command execution failed');
  }
  
  /**
   * Execute a command on a server (returns detailed result)
   * OPTIMIZED: Uses semaphore to limit concurrent connections and prevent server flooding
   */
  async executeCommandDetailed(
    serverId: string,
    command: string,
    timeout: number = 30000,
  ): Promise<CommandResult> {
    // Acquire semaphore (wait if 5 connections active)
    await this.semaphore.acquire();
    
    try {
      // Add small delay to prevent flooding
      await this.delay(this.DELAY_BETWEEN_COMMANDS);
      
      // Get server from database
      const server = await this.prisma.servers.findUnique({
        where: { id: serverId },
      });
      
      if (!server) {
        return {
          success: false,
          error: `Server ${serverId} not found`,
          exitCode: 1,
        };
      }
      
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
    } finally {
      // Release semaphore
      this.semaphore.release();
    }
  }
  
  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Execute multiple commands sequentially
   */
  async executeCommands(
    serverId: string,
    commands: string[],
    timeout: number = 30000,
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    
    for (const command of commands) {
      const result = await this.executeCommandDetailed(serverId, command, timeout);
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
  async fileExists(serverId: string, path: string): Promise<boolean> {
    const result = await this.executeCommandDetailed(
      serverId,
      `test -f "${path}" && echo "exists" || echo "not_found"`,
    );
    
    return result.success && result.output?.trim() === 'exists';
  }
  
  /**
   * Check if a directory exists on the server
   */
  async directoryExists(serverId: string, path: string): Promise<boolean> {
    const result = await this.executeCommandDetailed(
      serverId,
      `test -d "${path}" && echo "exists" || echo "not_found"`,
    );
    
    return result.success && result.output?.trim() === 'exists';
  }
  
  /**
   * Read a file from the server
   */
  async readFile(serverId: string, path: string): Promise<string | null> {
    const result = await this.executeCommandDetailed(serverId, `cat "${path}"`);
    
    if (result.success) {
      return result.output || null;
    }
    
    return null;
  }
  
  /**
   * Get file permissions
   */
  async getFilePermissions(serverId: string, path: string): Promise<string | null> {
    const result = await this.executeCommandDetailed(
      serverId,
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
  async getDiskUsage(serverId: string, path: string): Promise<number | null> {
    const result = await this.executeCommandDetailed(
      serverId,
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
  async getMemoryUsage(serverId: string): Promise<{
    used: number;
    total: number;
    percentage: number;
  } | null> {
    const result = await this.executeCommandDetailed(
      serverId,
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
  async getCPUUsage(serverId: string): Promise<number | null> {
    const result = await this.executeCommandDetailed(
      serverId,
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
    
    // Decrypt credentials (use correct field names from database)
    if (server.encryptedPrivateKey) {
      config.privateKey = await this.encryptionService.decrypt(server.encryptedPrivateKey);
      
      if (server.encryptedPassphrase) {
        config.passphrase = await this.encryptionService.decrypt(server.encryptedPassphrase);
      }
    } else if (server.encryptedPassword) {
      config.password = await this.encryptionService.decrypt(server.encryptedPassword);
    }
    
    return config;
  }
}
