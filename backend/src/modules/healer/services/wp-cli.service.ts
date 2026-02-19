import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from './ssh-executor.service';

@Injectable()
export class WpCliService {
  private readonly logger = new Logger(WpCliService.name);

  // Whitelist of allowed wp-cli commands
  private readonly ALLOWED_COMMANDS = [
    'plugin',
    'theme',
    'config',
    'db',
    'core',
    'cache',
    'transient',
    'option',
  ];

  constructor(private readonly sshService: SshExecutorService) {}

  /**
   * Execute wp-cli command
   */
  async execute(
    serverId: string,
    sitePath: string,
    command: string,
    timeout: number = 120000, // Increased to 120 seconds for long-running WP-CLI commands
  ): Promise<string> {
    // Validate command
    this.validateCommand(command);

    // Sanitize command
    const sanitized = this.sanitizeCommand(command);

    // Build full command
    const fullCommand = `cd ${sitePath} && wp ${sanitized} --allow-root`;

    this.logger.log(`Executing wp-cli: ${fullCommand}`);

    try {
      const result = await this.sshService.executeCommand(
        serverId,
        fullCommand,
        timeout, // Pass timeout to SSH executor
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`wp-cli execution failed: ${err.message}`);
      throw error;
    }
  }

  /**
   * Validate that command is in whitelist
   */
  private validateCommand(command: string): void {
    // Skip validation if command is empty
    if (!command || command.trim() === '') {
      throw new Error('Command cannot be empty');
    }

    const [mainCommand] = command.trim().split(' ');

    if (!this.ALLOWED_COMMANDS.includes(mainCommand)) {
      throw new Error(`Command not allowed: ${mainCommand}`);
    }
  }

  /**
   * Sanitize command to prevent injection
   */
  private sanitizeCommand(command: string): string {
    return command
      .replace(/[;&|`$()]/g, '') // Remove dangerous characters
      .replace(/\.\./g, '') // Remove directory traversal
      .trim();
  }

  /**
   * Check if wp-cli is installed
   */
  async isInstalled(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `cd ${sitePath} && which wp`;
      const result = await this.sshService.executeCommand(serverId, command);
      return result.includes('/wp');
    } catch {
      return false;
    }
  }
}
