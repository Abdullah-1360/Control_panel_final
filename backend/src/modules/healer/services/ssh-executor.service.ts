/**
 * SSH Executor Service
 * 
 * Wrapper around SSH connection service for diagnostic checks and healing actions
 * Provides simplified interface for executing commands on remote servers
 * 
 * OPTIMIZATION: Implements rate limiting with semaphore to prevent server flooding
 * Max 5 concurrent SSH connections, 100ms delay between commands
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SSHSessionManager } from '../../servers/ssh-session-manager.service';
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
export class SSHExecutorService implements OnModuleDestroy {
  private readonly logger = new Logger(SSHExecutorService.name);
  private readonly MAX_CONCURRENT = 5; // Max 5 concurrent SSH connections
  private readonly DELAY_BETWEEN_COMMANDS = 100; // 100ms delay
  private semaphore = new Semaphore(this.MAX_CONCURRENT);
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(
    private readonly sessionManager: SSHSessionManager,
    private readonly sshService: SSHConnectionService,
    private readonly encryptionService: EncryptionService,
    private readonly prisma: PrismaService,
  ) {
    // Start connection pool cleanup (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.sshService.cleanupPool().catch((error) => {
        this.logger.error(`Connection pool cleanup failed: ${error.message}`);
      });
    }, 5 * 60 * 1000);
  }
  
  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
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
   * OPTIMIZED: Uses centralized session manager for maximum connection reuse
   */
  async executeCommandDetailed(
    serverId: string,
    command: string,
    timeout: number = 30000,
  ): Promise<CommandResult> {
    // Acquire semaphore (wait if 5 connections active)
    await this.semaphore.acquire();
    
    try {
      // Use centralized session manager for maximum reusability
      return await this.sessionManager.executeCommand(serverId, command, timeout);
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
   * Execute command on an existing SSH client
   */
  private async executeCommandOnClient(
    client: any,
    command: string,
    timeout: number,
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        resolve({
          success: false,
          error: `Command timeout after ${timeout}ms`,
          exitCode: 124,
        });
      }, timeout);
      
      client.exec(command, (err: Error, stream: any) => {
        if (err) {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            error: err.message,
            exitCode: 1,
          });
          return;
        }
        
        let output = '';
        let errorOutput = '';
        
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        stream.on('close', (code: number) => {
          clearTimeout(timeoutHandle);
          
          if (code === 0) {
            resolve({
              success: true,
              output: output,
              exitCode: 0,
            });
          } else {
            resolve({
              success: false,
              output: output,
              error: errorOutput || `Command exited with code ${code}`,
              exitCode: code,
            });
          }
        });
        
        stream.on('error', (streamErr: Error) => {
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            error: streamErr.message,
            exitCode: 1,
          });
        });
      });
    });
  }
  
  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Execute multiple commands sequentially (reuses same session)
   */
  async executeCommands(
    serverId: string,
    commands: string[],
    timeout: number = 30000,
  ): Promise<CommandResult[]> {
    // Acquire semaphore once for all commands
    await this.semaphore.acquire();
    
    try {
      // Use session manager to execute all commands on same session
      return await this.sessionManager.executeCommands(serverId, commands, timeout);
    } finally {
      this.semaphore.release();
    }
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
