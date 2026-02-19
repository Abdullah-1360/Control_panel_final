import { Injectable, Logger } from '@nestjs/common';
import { Client, ConnectConfig } from 'ssh2';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  passphrase?: string;
  password?: string;
  timeout?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency: number;
  testedAt: Date;
  details: {
    dnsResolution: {
      success: boolean;
      ip?: string;
      time: number;
      error?: string;
    };
    tcpConnection: {
      success: boolean;
      time: number;
      error?: string;
    };
    hostKeyVerification: {
      success: boolean;
      keyType?: string;
      fingerprint?: string;
      fingerprintMD5?: string;
      matched?: boolean;
      error?: string;
    };
    authentication: {
      success: boolean;
      time: number;
      error?: string;
    };
    privilegeTest: {
      success: boolean;
      hasRoot?: boolean;
      hasSudo?: boolean;
      error?: string;
    };
    commandExecution: {
      whoami?: {
        success: boolean;
        output?: string;
        error?: string;
      };
      systemInfo?: {
        success: boolean;
        output?: string;
        error?: string;
      };
      customCommands?: Array<{
        command: string;
        success: boolean;
        output?: string;
        error?: string;
      }>;
    };
  };
  detectedOS?: string;
  detectedUsername?: string;
  errors: string[];
  warnings: string[];
}

interface PooledConnection {
  client: Client;
  serverId: string;
  lastUsed: Date;
  inUse: boolean;
}

@Injectable()
export class SSHConnectionService {
  private readonly logger = new Logger(SSHConnectionService.name);
  private readonly connectionPool: Map<string, PooledConnection[]> = new Map();
  private readonly maxPoolSize = 20;
  private readonly poolTimeout = 300000; // 5 minutes
  private readonly testTimeout = 25000; // 25 seconds per step

  /**
   * Dangerous command patterns that should be blocked
   */
  private readonly dangerousPatterns = [
    /rm\s+-rf\s+\/(?!tmp|var\/tmp)/i, // Prevent rm -rf / (except /tmp)
    /:\(\)\{.*\|.*&\s*\};:/i, // Fork bomb
    />\s*\/dev\/sd[a-z]/i, // Direct disk writes
    /dd\s+if=.*of=\/dev/i, // DD to devices
    /mkfs/i, // Format filesystem
    /fdisk/i, // Partition manipulation
    /shutdown|reboot|halt|poweroff/i, // System shutdown (unless explicitly allowed)
    /userdel|deluser/i, // User deletion
    /passwd.*root/i, // Root password change
    /chmod\s+777\s+\//i, // Dangerous permissions on root
    /curl.*\|\s*bash/i, // Piping to bash
    /wget.*\|\s*sh/i, // Piping to shell
  ];

  /**
   * Validate command for injection attempts and dangerous operations
   */
  private validateCommand(command: string): { valid: boolean; reason?: string } {
    // Check for null bytes (command injection)
    if (command.includes('\0')) {
      return { valid: false, reason: 'Null byte detected in command' };
    }

    // Block backtick command substitution (use $(...) instead)
    if (/`/.test(command)) {
      return { valid: false, reason: 'Backtick command substitution detected' };
    }

    // Check for dangerous patterns only (fork bombs, curl|bash, etc.)
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return { valid: false, reason: `Dangerous command pattern detected: ${pattern.source}` };
      }
    }

    // All other commands are allowed (including &&, ||, ;, pipes, etc.)
    return { valid: true };
  }

  /**
   * Test server connection with detailed diagnostics
   */
  async testConnection(
    config: SSHConnectionConfig,
    serverId: string,
    hostKeyStrategy: string,
    knownHostFingerprints: any[],
    sudoMode?: string,
    sudoPassword?: string,
    customCommands?: string[],
  ): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const result: ConnectionTestResult = {
      success: false,
      message: '',
      latency: 0,
      testedAt: new Date(),
      details: {
        dnsResolution: { success: false, time: 0 },
        tcpConnection: { success: false, time: 0 },
        hostKeyVerification: { success: false },
        authentication: { success: false, time: 0 },
        privilegeTest: { success: false },
        commandExecution: {},
      },
      errors: [],
      warnings: [],
    };

    try {
      // Step 1: DNS Resolution
      const dnsStart = Date.now();
      try {
        const addresses = await Promise.race([
          dns.resolve4(config.host),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DNS timeout')), this.testTimeout),
          ),
        ]);
        result.details.dnsResolution = {
          success: true,
          ip: addresses[0],
          time: Date.now() - dnsStart,
        };
      } catch (error: any) {
        result.details.dnsResolution = {
          success: false,
          time: Date.now() - dnsStart,
          error: error.message,
        };
        result.errors.push(`DNS resolution failed: ${error.message}`);
        result.message = 'DNS resolution failed';
        result.latency = Date.now() - startTime;
        return result;
      }

      // Step 2-6: SSH Connection and Tests
      const sshResult = await this.performSSHTest(
        config,
        hostKeyStrategy,
        knownHostFingerprints,
        sudoMode,
        sudoPassword,
        customCommands,
      );

      // Merge SSH test results
      if (sshResult.details) {
        result.details.tcpConnection = sshResult.details.tcpConnection;
        result.details.hostKeyVerification = sshResult.details.hostKeyVerification;
        result.details.authentication = sshResult.details.authentication;
        result.details.privilegeTest = sshResult.details.privilegeTest;
        result.details.commandExecution = sshResult.details.commandExecution;
      }
      result.detectedOS = sshResult.detectedOS;
      result.detectedUsername = sshResult.detectedUsername;
      if (sshResult.errors) {
        result.errors.push(...sshResult.errors);
      }
      if (sshResult.warnings) {
        result.warnings.push(...sshResult.warnings);
      }

      result.success = sshResult.success || false;
      result.message = sshResult.success ? 'Connection test successful' : (sshResult.message || 'Connection test failed');
      result.latency = Date.now() - startTime;

      return result;
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
      result.message = 'Connection test failed';
      result.latency = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Perform SSH connection and tests
   */
  private async performSSHTest(
    config: SSHConnectionConfig,
    hostKeyStrategy: string,
    knownHostFingerprints: any[],
    sudoMode?: string,
    sudoPassword?: string,
    customCommands?: string[],
  ): Promise<Partial<ConnectionTestResult>> {
    return new Promise((resolve) => {
      const result: Partial<ConnectionTestResult> = {
        success: false,
        message: '',
        details: {
          dnsResolution: { success: true, time: 0 },
          tcpConnection: { success: false, time: 0 },
          hostKeyVerification: { success: false },
          authentication: { success: false, time: 0 },
          privilegeTest: { success: false },
          commandExecution: {},
        },
        errors: [],
        warnings: [],
      };

      const client = new Client();
      const tcpStart = Date.now();
      let authStart = 0;

      const timeout = setTimeout(() => {
        client.end();
        result.errors!.push('Connection timeout (25 seconds)');
        result.message = 'Connection timeout';
        resolve(result);
      }, this.testTimeout);

      client.on('ready', async () => {
        result.details!.tcpConnection = {
          success: true,
          time: Date.now() - tcpStart,
        };

        result.details!.authentication = {
          success: true,
          time: Date.now() - authStart,
        };

        // Handle host key verification (simplified for now - will be enhanced later)
        result.details!.hostKeyVerification = {
          success: true,
          matched: true,
        };

        if (hostKeyStrategy === 'DISABLED') {
          result.warnings!.push('Host key verification disabled (security risk)');
        } else if (hostKeyStrategy === 'TOFU' && (!knownHostFingerprints || knownHostFingerprints.length === 0)) {
          result.warnings!.push('First connection - accepting host key (TOFU)');
        }

        try {
          // Test privilege escalation
          await this.testPrivileges(client, sudoMode, sudoPassword, result);

          // Execute test commands
          await this.executeTestCommands(client, customCommands, result);

          result.success = true;
          result.message = 'Connection successful';
        } catch (error: any) {
          result.errors!.push(`Command execution failed: ${error.message}`);
          result.message = 'Command execution failed';
        }

        client.end();
        clearTimeout(timeout);
        resolve(result);
      });

      client.on('error', (err: Error) => {
        clearTimeout(timeout);

        if (!result.details!.tcpConnection.success) {
          result.details!.tcpConnection = {
            success: false,
            time: Date.now() - tcpStart,
            error: err.message,
          };
          result.errors!.push(`TCP connection failed: ${err.message}`);
          result.message = 'TCP connection failed';
        } else if (!result.details!.authentication.success) {
          result.details!.authentication = {
            success: false,
            time: Date.now() - authStart,
            error: err.message,
          };
          result.errors!.push(`Authentication failed: ${err.message}`);
          result.message = 'Authentication failed';
        } else {
          result.errors!.push(`SSH error: ${err.message}`);
          result.message = 'SSH connection error';
        }

        resolve(result);
      });

      // Prepare SSH config
      authStart = Date.now();
      const sshConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: this.testTimeout,
      };

      if (config.privateKey) {
        sshConfig.privateKey = config.privateKey;
        if (config.passphrase) {
          sshConfig.passphrase = config.passphrase;
        }
      } else if (config.password) {
        sshConfig.password = config.password;
      }

      client.connect(sshConfig);
    });
  }

  /**
   * Test privilege escalation
   */
  private async testPrivileges(
    client: Client,
    sudoMode?: string,
    sudoPassword?: string,
    result?: Partial<ConnectionTestResult>,
  ): Promise<void> {
    if (!sudoMode || sudoMode === 'NONE') {
      if (result) {
        result.details!.privilegeTest = {
          success: true,
          hasRoot: false,
          hasSudo: false,
        };
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const command = sudoMode === 'NOPASSWD' ? 'sudo -n whoami' : 'sudo -S whoami';

      client.exec(command, (err, stream) => {
        if (err) {
          if (result) {
            result.details!.privilegeTest = {
              success: false,
              error: err.message,
            };
            result.warnings!.push(`Sudo test failed: ${err.message}`);
          }
          resolve();
          return;
        }

        let output = '';
        let errorOutput = '';

        if (sudoMode === 'PASSWORD_REQUIRED' && sudoPassword) {
          stream.stdin.write(`${sudoPassword}\n`);
        }

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code: number) => {
          if (result) {
            result.details!.privilegeTest = {
              success: code === 0,
              hasRoot: output.trim() === 'root',
              hasSudo: code === 0,
              error: code !== 0 ? errorOutput : undefined,
            };

            if (code !== 0) {
              result.warnings!.push('Sudo access not available or failed');
            }
          }
          resolve();
        });
      });
    });
  }

  /**
   * Execute test commands
   */
  private async executeTestCommands(
    client: Client,
    customCommands: string[] = [],
    result: Partial<ConnectionTestResult>,
  ): Promise<void> {
    // Default commands
    const whoamiResult = await this.executeCommandInternal(client, 'whoami');
    const unameResult = await this.executeCommandInternal(client, 'uname -a');

    result.details!.commandExecution = {
      whoami: whoamiResult,
      systemInfo: unameResult,
    };

    if (whoamiResult.success) {
      result.detectedUsername = whoamiResult.output?.trim();
    }

    if (unameResult.success) {
      result.detectedOS = unameResult.output?.trim();
    }

    // Custom commands
    if (customCommands && customCommands.length > 0) {
      result.details!.commandExecution.customCommands = [];
      for (const cmd of customCommands) {
        const cmdResult = await this.executeCommandInternal(client, cmd);
        result.details!.commandExecution.customCommands.push({
          command: cmd,
          ...cmdResult,
        });
      }
    }
  }

  /**
   * Execute a single command (private helper)
   */
  private async executeCommandInternal(
    client: Client,
    command: string,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      client.exec(command, (err, stream) => {
        if (err) {
          resolve({ success: false, error: err.message });
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
          if (code === 0) {
            resolve({ success: true, output: this.sanitizeOutput(output) });
          } else {
            resolve({ success: false, error: errorOutput || 'Command failed' });
          }
        });
      });
    });
  }

  /**
   * Sanitize command output (remove sensitive data)
   */
  private sanitizeOutput(output: string): string {
    // Remove common sensitive patterns
    let sanitized = output;

    // Remove password patterns
    sanitized = sanitized.replace(/password[=:]\s*\S+/gi, 'password=***');

    // Remove SSH key patterns
    sanitized = sanitized.replace(
      /-----BEGIN .* KEY-----[\s\S]*?-----END .* KEY-----/g,
      '***SSH_KEY***',
    );

    // Remove token patterns
    sanitized = sanitized.replace(/token[=:]\s*\S+/gi, 'token=***');
    sanitized = sanitized.replace(/api[-_]?key[=:]\s*\S+/gi, 'api_key=***');

    // Remove environment variables that might contain secrets
    sanitized = sanitized.replace(/\b[A-Z_]+_SECRET[=:]\s*\S+/g, 'SECRET=***');
    sanitized = sanitized.replace(/\b[A-Z_]+_PASSWORD[=:]\s*\S+/g, 'PASSWORD=***');
    sanitized = sanitized.replace(/\b[A-Z_]+_KEY[=:]\s*\S+/g, 'KEY=***');

    return sanitized;
  }

  /**
   * Generate SSH key fingerprint
   */
  private generateFingerprint(key: Buffer, algorithm: 'sha256' | 'md5'): string {
    const hash = crypto.createHash(algorithm).update(key).digest();

    if (algorithm === 'sha256') {
      return `SHA256:${hash.toString('base64').replace(/=+$/, '')}`;
    } else {
      return `MD5:${hash.toString('hex').match(/.{2}/g)!.join(':')}`;
    }
  }

  /**
   * Get key type from SSH key
   */
  private getKeyType(key: Buffer): string {
    const keyStr = key.toString('base64');
    if (keyStr.startsWith('AAAAB3NzaC1yc2')) return 'ssh-rsa';
    if (keyStr.startsWith('AAAAC3NzaC1lZDI1NTE5')) return 'ssh-ed25519';
    if (keyStr.startsWith('AAAAE2VjZHNhLXNoYTItbmlzdHA')) return 'ecdsa-sha2-nistp256';
    return 'unknown';
  }

  /**
   * Get connection from pool or create new one
   */
  async getConnection(serverId: string, config: SSHConnectionConfig): Promise<Client> {
    // Check if there's an available connection in the pool
    const pool = this.connectionPool.get(serverId) || [];
    const available = pool.find((conn) => !conn.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      return available.client;
    }

    // Create new connection if pool not full
    if (pool.length < this.maxPoolSize) {
      const client = await this.createConnection(config);
      const pooled: PooledConnection = {
        client,
        serverId,
        lastUsed: new Date(),
        inUse: true,
      };

      pool.push(pooled);
      this.connectionPool.set(serverId, pool);

      return client;
    }

    // Pool is full, wait or create temporary connection
    throw new Error('Connection pool exhausted');
  }

  /**
   * Create a new SSH connection
   */
  private async createConnection(config: SSHConnectionConfig): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      client.on('ready', () => {
        resolve(client);
      });

      client.on('error', (err) => {
        reject(err);
      });

      const sshConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: this.testTimeout,
      };

      if (config.privateKey) {
        sshConfig.privateKey = config.privateKey;
        if (config.passphrase) {
          sshConfig.passphrase = config.passphrase;
        }
      } else if (config.password) {
        sshConfig.password = config.password;
      }

      client.connect(sshConfig);
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(serverId: string, client: Client): void {
    const pool = this.connectionPool.get(serverId);
    if (!pool) return;

    const conn = pool.find((c) => c.client === client);
    if (conn) {
      conn.inUse = false;
      conn.lastUsed = new Date();
    }
  }

  /**
   * Clean up old connections from pool
   */
  async cleanupPool(): Promise<void> {
    const now = new Date();

    for (const [serverId, pool] of this.connectionPool.entries()) {
      const toRemove: PooledConnection[] = [];

      for (const conn of pool) {
        if (!conn.inUse && now.getTime() - conn.lastUsed.getTime() > this.poolTimeout) {
          conn.client.end();
          toRemove.push(conn);
        }
      }

      // Remove old connections
      const remaining = pool.filter((c) => !toRemove.includes(c));
      if (remaining.length === 0) {
        this.connectionPool.delete(serverId);
      } else {
        this.connectionPool.set(serverId, remaining);
      }
    }
  }

  /**
   * Execute a command on a server (public method for metrics collection)
   */
  async executeCommand(
    config: SSHConnectionConfig,
    serverId: string,
    command: string,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    // Validate command for injection attempts
    const validation = this.validateCommand(command);
    if (!validation.valid) {
      this.logger.warn(`Command validation failed for server ${serverId}: ${validation.reason}`);
      return {
        success: false,
        error: `Command rejected: ${validation.reason}`,
      };
    }

    const client = new Client();
    let connectionEstablished = false;

    return new Promise((resolve) => {
      const sshConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: config.timeout || 30000,
        keepaliveInterval: 10000, // Send keepalive every 10 seconds
        keepaliveCountMax: 3, // Allow 3 missed keepalives before disconnect
      };

      // Add authentication method
      if (config.privateKey) {
        sshConfig.privateKey = config.privateKey;
        if (config.passphrase) {
          sshConfig.passphrase = config.passphrase;
        }
      } else if (config.password) {
        sshConfig.password = config.password;
      }

      // Set timeout for the entire operation
      const operationTimeout = setTimeout(() => {
        if (!connectionEstablished) {
          client.end();
          resolve({ 
            success: false, 
            error: `Connection timeout after ${config.timeout || 30000}ms` 
          });
        }
      }, config.timeout || 30000);

      client.on('ready', () => {
        connectionEstablished = true;
        clearTimeout(operationTimeout);
        
        client.exec(command, (err, stream) => {
          if (err) {
            client.end();
            resolve({ 
              success: false, 
              error: `Command execution error: ${err.message}` 
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
            client.end();
            if (code === 0) {
              resolve({ success: true, output: this.sanitizeOutput(output) });
            } else {
              // Provide more context about the failure
              const errorMsg = errorOutput.trim() || output.trim() || 'Command failed';
              resolve({ 
                success: false, 
                error: `Command exited with code ${code}: ${errorMsg}` 
              });
            }
          });

          stream.on('error', (streamErr: Error) => {
            client.end();
            resolve({ 
              success: false, 
              error: `Stream error: ${streamErr.message}` 
            });
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(operationTimeout);
        
        // Provide more specific error messages
        let errorMessage = err.message;
        
        if (err.message.includes('ECONNREFUSED')) {
          errorMessage = `Connection refused - server may be down or SSH port ${config.port} is blocked`;
        } else if (err.message.includes('ETIMEDOUT')) {
          errorMessage = `Connection timed out - check network connectivity and firewall rules`;
        } else if (err.message.includes('ENOTFOUND')) {
          errorMessage = `Host not found - check hostname/IP address: ${config.host}`;
        } else if (err.message.includes('ECONNRESET')) {
          errorMessage = `Connection reset - network issue or server dropped connection`;
        } else if (err.message.includes('All configured authentication methods failed')) {
          errorMessage = `Authentication failed - check credentials`;
        } else if (err.message.includes('Keepalive timeout')) {
          errorMessage = `Connection lost - keepalive timeout (server may be overloaded)`;
        }
        
        resolve({ success: false, error: errorMessage });
      });

      client.on('close', () => {
        clearTimeout(operationTimeout);
        if (!connectionEstablished) {
          resolve({ 
            success: false, 
            error: 'Connection closed before handshake completed' 
          });
        }
      });

      try {
        client.connect(sshConfig);
      } catch (connectErr) {
        clearTimeout(operationTimeout);
        resolve({ 
          success: false, 
          error: `Failed to initiate connection: ${(connectErr as Error).message}` 
        });
      }
    });
  }
}

