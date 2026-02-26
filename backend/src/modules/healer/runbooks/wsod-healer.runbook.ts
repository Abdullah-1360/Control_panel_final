import { Injectable, Logger } from '@nestjs/common';
import { WpCliService } from '../services/wp-cli.service';
import { SSHExecutorService } from '../services/ssh-executor.service';

interface HealingContext {
  site: any;
  execution: any;
  diagnosisDetails: any;
  customCommands?: string[];
}

interface HealingResult {
  success: boolean;
  action: string;
  details: any;
}

@Injectable()
export class WsodHealerRunbook {
  private readonly logger = new Logger(WsodHealerRunbook.name);

  constructor(
    private readonly wpCliService: WpCliService,
    private readonly sshService: SSHExecutorService,
  ) {}

  /**
   * Execute WSOD healing
   */
  async execute(context: HealingContext): Promise<HealingResult> {
    const { site, diagnosisDetails, customCommands } = context;

    this.logger.log(`Executing WSOD healer for site ${site.domain}`);

    try {
      // If custom commands provided, execute them instead of default healing
      if (customCommands && customCommands.length > 0) {
        return await this.executeCustomCommands(site, customCommands);
      }

      const errorType = diagnosisDetails.errorType;

      if (errorType === 'PLUGIN_FAULT') {
        return await this.healPluginFault(site, diagnosisDetails);
      } else if (errorType === 'THEME_FAULT') {
        return await this.healThemeFault(site, diagnosisDetails);
      } else {
        // Unknown WSOD cause - activate safe mode
        return await this.activateSafeMode(site);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`WSOD healing failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Heal plugin fault by deactivating faulty plugin
   */
  private async healPluginFault(
    site: any,
    diagnosisDetails: any,
  ): Promise<HealingResult> {
    const culprit = diagnosisDetails.culprit;

    this.logger.log(`Deactivating faulty plugin: ${culprit}`);

    // Check if plugin is blacklisted
    if (this.isBlacklisted(culprit, site.blacklistedPlugins)) {
      throw new Error(
        `Plugin ${culprit} is blacklisted and cannot be deactivated`,
      );
    }

    // Deactivate plugin
    await this.wpCliService.execute(
      site.serverId,
      site.path,
      `plugin deactivate ${culprit}`,
    );

    return {
      success: true,
      action: `Deactivated faulty plugin: ${culprit}`,
      details: { plugin: culprit },
    };
  }

  /**
   * Heal theme fault by switching to default theme
   */
  private async healThemeFault(
    site: any,
    diagnosisDetails: any,
  ): Promise<HealingResult> {
    const culprit = diagnosisDetails.culprit;

    this.logger.log(`Switching from faulty theme: ${culprit}`);

    // Check if theme is blacklisted
    if (this.isBlacklisted(culprit, site.blacklistedThemes)) {
      throw new Error(
        `Theme ${culprit} is blacklisted and cannot be switched`,
      );
    }

    // List of fallback themes to try (in order)
    const fallbackThemes = [
      'twentytwentyfour',
      'twentytwentythree',
      'twentytwentytwo',
      'twentytwentyone',
      'twentytwenty',
    ];

    // Remove the faulty theme from fallback list
    const availableThemes = fallbackThemes.filter(theme => theme !== culprit);

    let activatedTheme: string | null = null;
    let lastError: Error | null = null;

    // Try each fallback theme until one works
    for (const theme of availableThemes) {
      try {
        this.logger.log(`Attempting to activate theme: ${theme}`);
        
        await this.wpCliService.execute(
          site.serverId,
          site.path,
          `theme activate ${theme}`,
        );
        
        activatedTheme = theme;
        this.logger.log(`Successfully activated theme: ${theme}`);
        break;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Failed to activate ${theme}: ${err.message}`);
        lastError = err;
        // Continue to next theme
      }
    }

    if (!activatedTheme) {
      throw new Error(
        `Failed to activate any fallback theme. Last error: ${lastError?.message || 'Unknown'}`,
      );
    }

    return {
      success: true,
      action: `Switched to fallback theme: ${activatedTheme}`,
      details: { oldTheme: culprit, newTheme: activatedTheme },
    };
  }

  /**
   * Execute custom commands provided by user
   */
  private async executeCustomCommands(
    site: any,
    customCommands: string[],
  ): Promise<HealingResult> {
    this.logger.log(`Executing ${customCommands.length} custom commands`);

    const executedCommands: string[] = [];
    const results: string[] = [];

    for (const command of customCommands) {
      // Skip empty lines and comments
      const trimmedCommand = command.trim();
      if (!trimmedCommand || trimmedCommand.startsWith('#')) {
        continue;
      }

      // Validate command safety
      if (!this.isCommandSafe(trimmedCommand)) {
        throw new Error(
          `Dangerous command detected and blocked: ${trimmedCommand}`,
        );
      }

      try {
        this.logger.log(`Executing custom command: ${trimmedCommand}`);

        let result: string;

        // Check if it's a WP-CLI command or shell command
        if (trimmedCommand.toLowerCase().startsWith('wp ')) {
          // WP-CLI command - strip "wp" prefix and use WpCliService
          const cleanCommand = trimmedCommand.substring(3).trim();
          result = await this.wpCliService.execute(
            site.serverId,
            site.path,
            cleanCommand,
          );
        } else {
          // Shell command - execute directly via SSH
          result = await this.sshService.executeCommand(
            site.serverId,
            `cd ${site.path} && ${trimmedCommand}`,
          );
        }

        executedCommands.push(trimmedCommand); // Store original command for display
        results.push(`✓ ${trimmedCommand}: ${result || 'Success'}`);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Custom command failed: ${trimmedCommand}`, err.message);
        throw new Error(
          `Custom command failed: ${trimmedCommand}\nError: ${err.message}`,
        );
      }
    }

    return {
      success: true,
      action: `Executed ${executedCommands.length} custom commands`,
      details: {
        commands: executedCommands,
        results,
      },
    };
  }

  /**
   * Validate command safety - block dangerous commands
   */
  private isCommandSafe(command: string): boolean {
    const dangerousPatterns = [
      /\brm\b.*-rf/i, // rm -rf
      /\brm\b.*-fr/i, // rm -fr (alternative order)
      /\bdd\b/i, // dd command
      />\s*\/dev\//i, // Writing to /dev/
      /\bmkfs\b/i, // Format filesystem
      /\bformat\b/i, // Format command
      /\bfdisk\b/i, // Disk partitioning
      /\bshutdown\b/i, // Shutdown
      /\breboot\b/i, // Reboot
      /\bhalt\b/i, // Halt
      /\bkill\b.*-9/i, // Force kill
      /\bchmod\b.*777/i, // Dangerous permissions
      /\bchown\b.*root/i, // Change to root ownership
      /;\s*rm\b.*-rf/i, // Command chaining with rm -rf
      /&&\s*rm\b.*-rf/i, // Command chaining with rm -rf
      /\|\s*rm\b.*-rf/i, // Piping to rm -rf
      /\brm\b.*\/\s*$/i, // rm with root directory
      /\brm\b.*\.\.\//i, // rm with parent directory traversal
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        this.logger.warn(`Blocked dangerous command pattern: ${command}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Activate safe mode (deactivate all plugins)
   */
  private async activateSafeMode(site: any): Promise<HealingResult> {
    this.logger.log('Activating safe mode - deactivating all plugins');

    // Deactivate all plugins
    await this.wpCliService.execute(
      site.serverId,
      site.path,
      'plugin deactivate --all',
    );

    return {
      success: true,
      action: 'Activated safe mode: deactivated all plugins',
      details: { mode: 'safe' },
    };
  }

  /**
   * Verify healing success by checking site response
   */
  async verify(context: HealingContext): Promise<boolean> {
    const { site } = context;

    this.logger.log(`Verifying WSOD healing for site ${site.domain}`);

    try {
      // Use curl to check the site response
      const curlCommand = `curl -s -o /dev/null -w "%{http_code}|%{size_download}" -L "https://${site.domain}" || curl -s -o /dev/null -w "%{http_code}|%{size_download}" -L "http://${site.domain}"`;
      
      const result = await this.sshService.executeCommand(
        site.serverId,
        curlCommand,
      );

      const [statusCode, sizeStr] = result.trim().split('|');
      const size = parseInt(sizeStr || '0');

      this.logger.log(`Site verification: HTTP ${statusCode}, Size: ${size} bytes`);

      // Check if status is 200 and response has reasonable size
      if (statusCode === '200' && size > 500) {
        // Additional check: fetch actual content and look for WSOD indicators
        const contentCommand = `curl -s -L "https://${site.domain}" || curl -s -L "http://${site.domain}"`;
        const content = await this.sshService.executeCommand(
          site.serverId,
          contentCommand,
        );

        // Check for WSOD indicators in content
        const wsodIndicators = [
          'There has been a critical error',
          'Parse error:',
          'Fatal error:',
          'syntax error',
          'Call to undefined',
          'Cannot redeclare',
          'white screen of death',
          'WordPress database error',
          'Error establishing a database connection',
          'Maximum execution time',
          'Allowed memory size',
          'Class \'',
          'Uncaught Error',
          'Uncaught Exception',
          'Stack trace:',
        ];

        const hasWsod = wsodIndicators.some(indicator => 
          content.toLowerCase().includes(indicator.toLowerCase())
        );

        if (hasWsod) {
          this.logger.warn('Site returns 200 but contains WSOD indicators');
          return false;
        }

        return true;
      }

      // Status not 200 or size too small (likely error page)
      this.logger.warn(`Site verification failed: HTTP ${statusCode}, Size: ${size}`);
      return false;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Verification failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Check if plugin/theme is blacklisted
   */
  private isBlacklisted(name: string, blacklist: string[]): boolean {
    if (!blacklist || blacklist.length === 0) {
      return false;
    }

    // Check exact match
    if (blacklist.includes(name)) {
      return true;
    }

    // Check wildcard match (e.g., woocommerce-*)
    for (const pattern of blacklist) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (name.startsWith(prefix)) {
          return true;
        }
      }
    }

    return false;
  }
}
