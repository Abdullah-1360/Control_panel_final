import { Injectable, Logger } from '@nestjs/common';
import { ServersService } from '../../servers/servers.service';
import { SSHConnectionService } from '../../servers/ssh-connection.service';

/**
 * SSH Executor Service for Healer Module
 * Executes SSH commands on servers using Module 2's SSH infrastructure
 */
@Injectable()
export class SshExecutorService {
  private readonly logger = new Logger(SshExecutorService.name);

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 10000; // 10 seconds
  
  // Transient errors that should trigger retry
  private readonly TRANSIENT_ERRORS = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'Connection lost before handshake',
    'Connection lost',
    'Connection closed before handshake',
    'Keepalive timeout',
    'read ECONNRESET',
    'write ECONNRESET',
    'Connection reset',
    'network issue',
  ];

  constructor(
    private readonly serversService: ServersService,
    private readonly sshConnection: SSHConnectionService,
  ) {}

  /**
   * Execute a command on a server via SSH with retry logic
   * @param serverId Server ID
   * @param command Command to execute
   * @param timeout Command timeout in milliseconds (default: 60s)
   * @returns Command output as string
   */
  async executeCommand(
    serverId: string, 
    command: string,
    timeout: number = 60000,
  ): Promise<string> {
    let lastError: Error | null = null;
    
    // Truncate command for logging (first 100 chars)
    const commandPreview = command.length > 100 
      ? command.substring(0, 100) + '...' 
      : command;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Get server configuration with decrypted credentials
        const serverConfig = await this.serversService.getServerForConnection(serverId);

        // Prepare SSH config with increased timeout
        const sshConfig = {
          host: serverConfig.host,
          port: serverConfig.port,
          username: serverConfig.username,
          privateKey: serverConfig.credentials.privateKey,
          passphrase: serverConfig.credentials.passphrase,
          password: serverConfig.credentials.password,
          timeout: timeout,
        };

        // Execute command
        const result = await this.sshConnection.executeCommand(
          sshConfig,
          serverId,
          command,
        );

        if (!result.success) {
          const error = result.error || 'SSH command execution failed';
          
          // Check if this is a transient error that should be retried
          if (this.isTransientError(error) && attempt < this.MAX_RETRIES) {
            this.logger.warn(
              `Transient SSH error on server ${serverId} (attempt ${attempt}/${this.MAX_RETRIES}): ${error}. Command: ${commandPreview}`,
            );
            lastError = new Error(error);
            
            // Wait before retry with exponential backoff
            await this.sleep(this.calculateRetryDelay(attempt));
            continue;
          }
          
          // Non-transient error or max retries reached
          this.logger.error(
            `SSH command failed on server ${serverId} after ${attempt} attempt(s): ${error}. Command: ${commandPreview}`,
          );
          throw new Error(error);
        }

        // Success - log if this was a retry
        if (attempt > 1) {
          this.logger.log(
            `SSH command succeeded on server ${serverId} after ${attempt} attempt(s). Command: ${commandPreview}`,
          );
        }

        return result.output || '';
        
      } catch (error) {
        const err = error as Error;
        lastError = err;
        
        // Check if this is a transient error
        if (this.isTransientError(err.message) && attempt < this.MAX_RETRIES) {
          this.logger.warn(
            `Transient SSH error on server ${serverId} (attempt ${attempt}/${this.MAX_RETRIES}): ${err.message}. Command: ${commandPreview}`,
          );
          
          // Wait before retry with exponential backoff
          await this.sleep(this.calculateRetryDelay(attempt));
          continue;
        }
        
        // Non-transient error or max retries reached
        this.logger.error(
          `Failed to execute SSH command on server ${serverId} after ${attempt} attempt(s): ${err.message}. Command: ${commandPreview}`,
        );
        throw err;
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error('SSH command execution failed after all retries');
  }

  /**
   * Check if an error is transient and should be retried
   */
  private isTransientError(errorMessage: string): boolean {
    return this.TRANSIENT_ERRORS.some(transientError => 
      errorMessage.includes(transientError)
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
      this.MAX_RETRY_DELAY
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
