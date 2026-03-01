import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'ssh2';
import { SSHConnectionService, SSHConnectionConfig } from './ssh-connection.service';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface SSHSession {
  client: Client;
  serverId: string;
  lastUsed: Date;
  inUse: boolean;
  commandCount: number;
  createdAt: Date;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

/**
 * SSH Session Manager
 * 
 * Centralized service for managing SSH connections across the entire application.
 * Provides connection pooling, session reuse, and automatic cleanup.
 * 
 * All services should use this instead of creating their own SSH connections.
 */
@Injectable()
export class SSHSessionManager implements OnModuleDestroy {
  private readonly logger = new Logger(SSHSessionManager.name);
  private readonly sessions: Map<string, SSHSession[]> = new Map();
  private readonly maxSessionsPerServer = 10;
  private readonly sessionTimeout = 300000; // 5 minutes
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly serverConfigCache: Map<string, { config: SSHConnectionConfig; cachedAt: Date }> = new Map();
  private readonly configCacheTimeout = 60000; // 1 minute

  constructor(
    private readonly sshConnection: SSHConnectionService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
  ) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions().catch((error) => {
        this.logger.error(`Session cleanup failed: ${error.message}`);
      });
    }, 60000); // Run every minute
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.closeAllSessions();
  }

  /**
   * Execute a command on a server (main entry point for all SSH operations)
   */
  async executeCommand(
    serverId: string,
    command: string,
    timeout: number = 30000,
  ): Promise<CommandResult> {
    const session = await this.acquireSession(serverId);
    
    try {
      const result = await this.executeOnSession(session, command, timeout);
      return result;
    } finally {
      this.releaseSession(serverId, session);
    }
  }

  /**
   * Execute multiple commands sequentially on the same session
   */
  async executeCommands(
    serverId: string,
    commands: string[],
    timeout: number = 30000,
  ): Promise<CommandResult[]> {
    const session = await this.acquireSession(serverId);
    const results: CommandResult[] = [];
    
    try {
      for (const command of commands) {
        const result = await this.executeOnSession(session, command, timeout);
        results.push(result);
        
        // Stop on first failure
        if (!result.success) {
          break;
        }
      }
      return results;
    } finally {
      this.releaseSession(serverId, session);
    }
  }

  /**
   * Execute a batch of commands in a single SSH session (more efficient)
   */
  async executeBatch(
    serverId: string,
    commands: string[],
    timeout: number = 30000,
  ): Promise<CommandResult> {
    const combinedCommand = commands.join(' && ');
    return this.executeCommand(serverId, combinedCommand, timeout);
  }

  /**
   * Acquire a session for a server (reuses existing or creates new)
   */
  private async acquireSession(serverId: string): Promise<SSHSession> {
    const pool = this.sessions.get(serverId) || [];
    
    // Find available session
    const available = pool.find((s) => !s.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      available.commandCount++;
      return available;
    }
    
    // Create new session if pool not full
    if (pool.length < this.maxSessionsPerServer) {
      const config = await this.getServerConfig(serverId);
      const client = await this.sshConnection.getConnection(serverId, config);
      
      const session: SSHSession = {
        client,
        serverId,
        lastUsed: new Date(),
        inUse: true,
        commandCount: 1,
        createdAt: new Date(),
      };
      
      pool.push(session);
      this.sessions.set(serverId, pool);
      
      this.logger.debug(`Created new SSH session for server ${serverId} (${pool.length}/${this.maxSessionsPerServer})`);
      return session;
    }
    
    // Pool is full, wait for available session
    return this.waitForAvailableSession(serverId);
  }

  /**
   * Wait for an available session (with timeout)
   */
  private async waitForAvailableSession(serverId: string, maxWait: number = 30000): Promise<SSHSession> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const pool = this.sessions.get(serverId) || [];
      const available = pool.find((s) => !s.inUse);
      
      if (available) {
        available.inUse = true;
        available.lastUsed = new Date();
        available.commandCount++;
        return available;
      }
      
      // Wait 100ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for available SSH session for server ${serverId}`);
  }

  /**
   * Release a session back to the pool
   */
  private releaseSession(serverId: string, session: SSHSession): void {
    session.inUse = false;
    session.lastUsed = new Date();
  }

  /**
   * Execute command on a session
   */
  private async executeOnSession(
    session: SSHSession,
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
      
      session.client.exec(command, (err: Error | undefined, stream: any) => {
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
   * Get server SSH configuration (with caching)
   */
  private async getServerConfig(serverId: string): Promise<SSHConnectionConfig> {
    // Check cache
    const cached = this.serverConfigCache.get(serverId);
    if (cached && Date.now() - cached.cachedAt.getTime() < this.configCacheTimeout) {
      return cached.config;
    }
    
    // Fetch from database
    const server = await this.prisma.servers.findUnique({
      where: { id: serverId, deletedAt: null },
    });
    
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    const config: SSHConnectionConfig = {
      host: server.host,
      port: server.port,
      username: server.username,
      timeout: 30000,
    };
    
    // Decrypt credentials
    if (server.encryptedPrivateKey) {
      config.privateKey = await this.encryption.decrypt(server.encryptedPrivateKey);
      
      if (server.encryptedPassphrase) {
        config.passphrase = await this.encryption.decrypt(server.encryptedPassphrase);
      }
    } else if (server.encryptedPassword) {
      config.password = await this.encryption.decrypt(server.encryptedPassword);
    }
    
    // Cache the config
    this.serverConfigCache.set(serverId, {
      config,
      cachedAt: new Date(),
    });
    
    return config;
  }

  /**
   * Cleanup idle sessions
   */
  private async cleanupIdleSessions(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [serverId, pool] of this.sessions.entries()) {
      const toRemove: SSHSession[] = [];
      
      for (const session of pool) {
        if (!session.inUse && now.getTime() - session.lastUsed.getTime() > this.sessionTimeout) {
          try {
            session.client.end();
            toRemove.push(session);
            cleanedCount++;
          } catch (error: any) {
            this.logger.error(`Failed to close session for server ${serverId}: ${error.message}`);
          }
        }
      }
      
      // Remove closed sessions
      const remaining = pool.filter((s) => !toRemove.includes(s));
      if (remaining.length === 0) {
        this.sessions.delete(serverId);
      } else {
        this.sessions.set(serverId, remaining);
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} idle SSH sessions`);
    }
  }

  /**
   * Close all sessions (on shutdown)
   */
  private closeAllSessions(): void {
    let closedCount = 0;
    
    for (const [serverId, pool] of this.sessions.entries()) {
      for (const session of pool) {
        try {
          session.client.end();
          closedCount++;
        } catch (error: any) {
          this.logger.error(`Failed to close session for server ${serverId}: ${error.message}`);
        }
      }
    }
    
    this.sessions.clear();
    this.logger.log(`Closed ${closedCount} SSH sessions on shutdown`);
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    idleSessions: number;
    serverCount: number;
    sessionsByServer: Record<string, number>;
  } {
    let totalSessions = 0;
    let activeSessions = 0;
    let idleSessions = 0;
    const sessionsByServer: Record<string, number> = {};
    
    for (const [serverId, pool] of this.sessions.entries()) {
      totalSessions += pool.length;
      sessionsByServer[serverId] = pool.length;
      
      for (const session of pool) {
        if (session.inUse) {
          activeSessions++;
        } else {
          idleSessions++;
        }
      }
    }
    
    return {
      totalSessions,
      activeSessions,
      idleSessions,
      serverCount: this.sessions.size,
      sessionsByServer,
    };
  }

  /**
   * Force close all sessions for a specific server
   */
  async closeServerSessions(serverId: string): Promise<number> {
    const pool = this.sessions.get(serverId);
    if (!pool) {
      return 0;
    }
    
    let closedCount = 0;
    for (const session of pool) {
      try {
        session.client.end();
        closedCount++;
      } catch (error: any) {
        this.logger.error(`Failed to close session for server ${serverId}: ${error.message}`);
      }
    }
    
    this.sessions.delete(serverId);
    this.serverConfigCache.delete(serverId);
    
    this.logger.log(`Closed ${closedCount} sessions for server ${serverId}`);
    return closedCount;
  }

  /**
   * Invalidate server config cache (call when server credentials change)
   */
  invalidateServerConfig(serverId: string): void {
    this.serverConfigCache.delete(serverId);
  }
}
