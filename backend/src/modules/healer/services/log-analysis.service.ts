import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from './ssh-executor.service';

interface LogAnalysisResult {
  logType: string;
  logPath: string;
  errors: ParsedError[];
  totalErrors: number;
}

interface ParsedError {
  timestamp: string;
  level: string;
  message: string;
  file?: string;
  line?: number;
  type?: string; // PLUGIN_FAULT, THEME_FAULT, SYNTAX_ERROR, etc.
  culprit?: string; // Plugin/theme name
}

@Injectable()
export class LogAnalysisService {
  private readonly logger = new Logger(LogAnalysisService.name);

  // Error patterns for diagnosis
  private readonly ERROR_PATTERNS = {
    PLUGIN_FAULT: /(?:PHP Fatal error|PHP Parse error|PHP Warning):.* in .*\/wp-content\/plugins\/([^\/]+)\//,
    THEME_FAULT: /(?:PHP Fatal error|PHP Parse error|PHP Warning):.* in .*\/wp-content\/themes\/([^\/]+)\//,
    SYNTAX_ERROR: /PHP Parse error: syntax error/,
    MEMORY_EXHAUSTION: /Allowed memory size of \d+ bytes exhausted/,
    DB_CONNECTION: /Error establishing a database connection/,
    DB_ACCESS_DENIED: /Access denied for user/,
  };

  constructor(private readonly sshService: SSHExecutorService) {}

  /**
   * Analyze all logs for a WordPress site
   */
  async analyzeLogs(
    serverId: string,
    sitePath: string,
    domain?: string,
  ): Promise<LogAnalysisResult[]> {
    this.logger.log(`Analyzing logs for site at ${sitePath}`);

    // Run all log checks in parallel for faster execution
    const [wpDebugLog, phpErrorLog, webServerLog] = await Promise.all([
      this.analyzeWordPressDebugLog(serverId, sitePath),
      this.analyzePhpErrorLog(serverId, sitePath),
      this.analyzeWebServerLog(serverId, sitePath, domain),
    ]);

    // Filter out null results
    const results: LogAnalysisResult[] = [];
    if (wpDebugLog) results.push(wpDebugLog);
    if (phpErrorLog) results.push(phpErrorLog);
    if (webServerLog) results.push(webServerLog);

    return results;
  }

  /**
   * Analyze WordPress debug.log
   */
  private async analyzeWordPressDebugLog(
    serverId: string,
    sitePath: string,
  ): Promise<LogAnalysisResult | null> {
    const logPath = `${sitePath}/wp-content/debug.log`;

    try {
      // Check if log exists
      const exists = await this.checkFileExists(serverId, logPath);
      if (!exists) {
        return null;
      }

      // Read last 100 lines
      const command = `tail -n 100 ${logPath}`;
      const logContent = await this.sshService.executeCommand(
        serverId,
        command,
      );

      // Parse errors
      const errors = this.parseWordPressLog(logContent);

      return {
        logType: 'WordPress Debug Log',
        logPath,
        errors,
        totalErrors: errors.length,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to analyze WordPress debug.log: ${err.message}`);
      return null;
    }
  }

  /**
   * Analyze PHP error log
   */
  private async analyzePhpErrorLog(
    serverId: string,
    sitePath: string,
  ): Promise<LogAnalysisResult | null> {
    // Try site-specific error_log locations FIRST (most relevant)
    const siteSpecificPaths = [
      `${sitePath}/error_log`,
      `${sitePath}/public_html/error_log`,
      `${sitePath}/../error_log`,
      `${sitePath}/wp-content/debug.log`,
    ];

    // Try site-specific logs first
    for (const logPath of siteSpecificPaths) {
      try {
        const exists = await this.checkFileExists(serverId, logPath);
        if (!exists) continue;

        // Read last 100 lines
        const command = `tail -n 100 ${logPath}`;
        const logContent = await this.sshService.executeCommand(
          serverId,
          command,
        );

        if (!logContent || logContent.trim() === '' || logContent.includes('No such file')) continue;

        // Parse errors
        const errors = this.parsePhpLog(logContent);

        if (errors.length > 0) {
          return {
            logType: 'PHP Error Log (Site-Specific)',
            logPath,
            errors,
            totalErrors: errors.length,
          };
        }
      } catch (error) {
        continue;
      }
    }

    // Fallback to system-wide PHP logs
    const systemPaths = [
      '/var/log/php-fpm/error.log',
      '/var/log/php/error.log',
      '/var/log/php7.4-fpm.log',
      '/var/log/php8.0-fpm.log',
      '/var/log/php8.1-fpm.log',
      '/var/log/php8.2-fpm.log',
    ];

    for (const logPath of systemPaths) {
      try {
        const exists = await this.checkFileExists(serverId, logPath);
        if (!exists) continue;

        // Read last 100 lines and filter for this site
        const command = `tail -n 100 ${logPath} | grep "${sitePath}"`;
        const logContent = await this.sshService.executeCommand(
          serverId,
          command,
        );

        if (!logContent || logContent.trim() === '') continue;

        // Parse errors
        const errors = this.parsePhpLog(logContent);

        if (errors.length > 0) {
          return {
            logType: 'PHP Error Log (System)',
            logPath,
            errors,
            totalErrors: errors.length,
          };
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Analyze web server error log
   */
  private async analyzeWebServerLog(
    serverId: string,
    sitePath: string,
    domain?: string,
  ): Promise<LogAnalysisResult | null> {
    // Try Nginx first, then Apache
    const nginxLog = await this.analyzeNginxLog(serverId, sitePath, domain);
    if (nginxLog) return nginxLog;

    const apacheLog = await this.analyzeApacheLog(serverId, sitePath, domain);
    if (apacheLog) return apacheLog;

    return null;
  }

  /**
   * Analyze Nginx error log
   */
  private async analyzeNginxLog(
    serverId: string,
    sitePath: string,
    domain?: string,
  ): Promise<LogAnalysisResult | null> {
    const logPath = '/var/log/nginx/error.log';

    try {
      const exists = await this.checkFileExists(serverId, logPath);
      if (!exists) return null;

      // Filter by domain if provided, otherwise by sitePath
      const filterPattern = domain || sitePath;
      
      // Read last 100 lines and filter for this site/domain
      const command = `tail -n 100 ${logPath} | grep "${filterPattern}"`;
      const logContent = await this.sshService.executeCommand(
        serverId,
        command,
      );

      if (!logContent || logContent.trim() === '') return null;

      const errors = this.parseNginxLog(logContent);

      return {
        logType: 'Nginx Error Log',
        logPath,
        errors,
        totalErrors: errors.length,
      };
    } catch {
      return null;
    }
  }

  /**
   * Analyze Apache error log
   */
  private async analyzeApacheLog(
    serverId: string,
    sitePath: string,
    domain?: string,
  ): Promise<LogAnalysisResult | null> {
    const possiblePaths = [
      '/var/log/apache2/error.log',
      '/var/log/httpd/error_log',
    ];

    for (const logPath of possiblePaths) {
      try {
        const exists = await this.checkFileExists(serverId, logPath);
        if (!exists) continue;

        // Filter by domain if provided, otherwise by sitePath
        const filterPattern = domain || sitePath;
        
        const command = `tail -n 100 ${logPath} | grep "${filterPattern}"`;
        const logContent = await this.sshService.executeCommand(
          serverId,
          command,
        );

        if (!logContent || logContent.trim() === '') continue;

        const errors = this.parseApacheLog(logContent);

        return {
          logType: 'Apache Error Log',
          logPath,
          errors,
          totalErrors: errors.length,
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Parse WordPress debug.log format
   */
  private parseWordPressLog(logContent: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = logContent.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Match: [13-Feb-2026 10:00:00 UTC] PHP Fatal error: ...
      const match = line.match(/\[(.*?)\] (PHP .*?): (.*)/);
      if (!match) continue;

      const [, timestamp, level, message] = match;

      // Detect error type and culprit
      const { type, culprit } = this.detectErrorType(message);

      errors.push({
        timestamp,
        level,
        message,
        type,
        culprit,
      });
    }

    return errors;
  }

  /**
   * Parse PHP error log format
   */
  private parsePhpLog(logContent: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = logContent.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Match: [13-Feb-2026 10:00:00] PHP Fatal error: ...
      const match = line.match(/\[(.*?)\] (.*)/);
      if (!match) continue;

      const [, timestamp, message] = match;

      const { type, culprit } = this.detectErrorType(message);

      errors.push({
        timestamp,
        level: 'ERROR',
        message,
        type,
        culprit,
      });
    }

    return errors;
  }

  /**
   * Parse Nginx error log format
   */
  private parseNginxLog(logContent: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = logContent.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Match: 2026/02/13 10:00:00 [error] ...
      const match = line.match(/(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(.*?)\] (.*)/);
      if (!match) continue;

      const [, timestamp, level, message] = match;

      errors.push({
        timestamp,
        level: level.toUpperCase(),
        message,
      });
    }

    return errors;
  }

  /**
   * Parse Apache error log format
   */
  private parseApacheLog(logContent: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = logContent.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Match: [Day Mon DD HH:MM:SS.mmmmmm YYYY] [level] ...
      const match = line.match(/\[(.*?)\] \[(.*?)\] (.*)/);
      if (!match) continue;

      const [, timestamp, level, message] = match;

      errors.push({
        timestamp,
        level: level.toUpperCase(),
        message,
      });
    }

    return errors;
  }

  /**
   * Detect error type and culprit from error message
   */
  private detectErrorType(message: string): { type?: string; culprit?: string } {
    // Check for theme fault FIRST (before generic syntax error)
    const themeMatch = message.match(this.ERROR_PATTERNS.THEME_FAULT);
    if (themeMatch) {
      return { type: 'THEME_FAULT', culprit: themeMatch[1] };
    }

    // Check for plugin fault
    const pluginMatch = message.match(this.ERROR_PATTERNS.PLUGIN_FAULT);
    if (pluginMatch) {
      return { type: 'PLUGIN_FAULT', culprit: pluginMatch[1] };
    }

    // Check for syntax error (generic, no culprit identified)
    if (this.ERROR_PATTERNS.SYNTAX_ERROR.test(message)) {
      // Try to extract file path for better context
      const fileMatch = message.match(/in (.*?) on line/);
      const culprit = fileMatch ? fileMatch[1] : undefined;
      return { type: 'SYNTAX_ERROR', culprit };
    }

    // Check for memory exhaustion
    if (this.ERROR_PATTERNS.MEMORY_EXHAUSTION.test(message)) {
      return { type: 'MEMORY_EXHAUSTION' };
    }

    // Check for database errors
    if (this.ERROR_PATTERNS.DB_CONNECTION.test(message)) {
      return { type: 'DB_CONNECTION' };
    }

    if (this.ERROR_PATTERNS.DB_ACCESS_DENIED.test(message)) {
      return { type: 'DB_ACCESS_DENIED' };
    }

    return {};
  }

  /**
   * Check if file exists
   */
  private async checkFileExists(
    serverId: string,
    filePath: string,
  ): Promise<boolean> {
    try {
      const command = `test -f ${filePath} && echo "exists" || echo "not found"`;
      const result = await this.sshService.executeCommand(serverId, command);
      return result.includes('exists');
    } catch {
      return false;
    }
  }
}
