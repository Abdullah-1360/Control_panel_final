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

  /**
   * PHASE 3 - LAYER 7: Categorize errors by severity
   */
  categorizeErrors(errors: ParsedError[]): {
    fatal: ParsedError[];
    warning: ParsedError[];
    notice: ParsedError[];
    deprecated: ParsedError[];
  } {
    const categorized = {
      fatal: [] as ParsedError[],
      warning: [] as ParsedError[],
      notice: [] as ParsedError[],
      deprecated: [] as ParsedError[],
    };

    for (const error of errors) {
      const level = error.level.toLowerCase();
      const message = error.message.toLowerCase();

      if (level.includes('fatal') || message.includes('fatal error')) {
        categorized.fatal.push(error);
      } else if (level.includes('warning') || message.includes('warning')) {
        categorized.warning.push(error);
      } else if (level.includes('deprecated') || message.includes('deprecated')) {
        categorized.deprecated.push(error);
      } else if (level.includes('notice') || message.includes('notice')) {
        categorized.notice.push(error);
      } else {
        // Default to warning for unknown types
        categorized.warning.push(error);
      }
    }

    return categorized;
  }

  /**
   * PHASE 3 - LAYER 7: Analyze error frequency and detect spikes
   */
  analyzeErrorFrequency(errors: ParsedError[]): {
    totalErrors: number;
    errorsPerHour: number;
    hasSpike: boolean;
    spikeThreshold: number;
    recentErrors: number;
    oldErrors: number;
    frequencyAnalysis: string;
  } {
    if (errors.length === 0) {
      return {
        totalErrors: 0,
        errorsPerHour: 0,
        hasSpike: false,
        spikeThreshold: 0,
        recentErrors: 0,
        oldErrors: 0,
        frequencyAnalysis: 'No errors detected',
      };
    }

    // Parse timestamps and calculate time range
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let recentErrors = 0; // Last hour
    let oldErrors = 0; // 1-24 hours ago

    for (const error of errors) {
      try {
        const errorDate = new Date(error.timestamp);

        if (errorDate >= oneHourAgo) {
          recentErrors++;
        } else if (errorDate >= twentyFourHoursAgo) {
          oldErrors++;
        }
      } catch {
        // If timestamp parsing fails, count as old error
        oldErrors++;
      }
    }

    // Calculate errors per hour (based on last 24 hours)
    const errorsPerHour = Math.round(errors.length / 24);

    // Detect spike: Recent errors (last hour) > 3x average hourly rate
    const spikeThreshold = errorsPerHour * 3;
    const hasSpike = recentErrors > spikeThreshold && recentErrors > 10;

    let frequencyAnalysis = '';
    if (hasSpike) {
      frequencyAnalysis = `ERROR SPIKE DETECTED: ${recentErrors} errors in last hour (normal: ${errorsPerHour}/hour)`;
    } else if (errorsPerHour > 50) {
      frequencyAnalysis = `High error rate: ${errorsPerHour} errors/hour`;
    } else if (errorsPerHour > 10) {
      frequencyAnalysis = `Moderate error rate: ${errorsPerHour} errors/hour`;
    } else {
      frequencyAnalysis = `Low error rate: ${errorsPerHour} errors/hour`;
    }

    return {
      totalErrors: errors.length,
      errorsPerHour,
      hasSpike,
      spikeThreshold,
      recentErrors,
      oldErrors,
      frequencyAnalysis,
    };
  }

  /**
   * PHASE 3 - LAYER 7: Detect 404 error patterns (probing attacks)
   */
  async detect404Patterns(
    serverId: string,
    sitePath: string,
    domain?: string,
  ): Promise<{
    total404s: number;
    suspiciousPatterns: string[];
    probingAttack: boolean;
    attackVectors: string[];
    recommendations: string[];
  }> {
    try {
      // Check access logs for 404 errors
      const accessLogPaths = [
        '/var/log/nginx/access.log',
        '/var/log/apache2/access.log',
        '/var/log/httpd/access_log',
      ];

      let logContent = '';
      for (const logPath of accessLogPaths) {
        try {
          const exists = await this.checkFileExists(serverId, logPath);
          if (!exists) continue;

          const filterPattern = domain || sitePath;
          const command = `tail -n 500 ${logPath} | grep "${filterPattern}" | grep " 404 "`;
          const result = await this.sshService.executeCommand(serverId, command, 30000);

          if (result && result.trim()) {
            logContent = result;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!logContent) {
        return {
          total404s: 0,
          suspiciousPatterns: [],
          probingAttack: false,
          attackVectors: [],
          recommendations: [],
        };
      }

      const lines = logContent.split('\n').filter(l => l.trim());
      const total404s = lines.length;

      // Detect suspicious patterns
      const suspiciousPatterns: string[] = [];
      const attackVectors: string[] = [];

      // Common attack patterns
      const attackPatternChecks = [
        { pattern: /wp-admin|wp-login|xmlrpc\.php/i, vector: 'WordPress admin/login probing' },
        { pattern: /\.env|\.git|\.svn|\.htaccess/i, vector: 'Configuration file probing' },
        { pattern: /phpmyadmin|adminer|sql/i, vector: 'Database admin tool probing' },
        { pattern: /\.php\?|\.asp\?|\.jsp\?/i, vector: 'Script injection attempts' },
        { pattern: /eval\(|base64|exec\(/i, vector: 'Code execution attempts' },
        { pattern: /\.\.|\/etc\/passwd|\/proc\//i, vector: 'Directory traversal attempts' },
        { pattern: /wp-content\/uploads\/.*\.php/i, vector: 'Malicious file upload attempts' },
      ];

      for (const line of lines) {
        for (const check of attackPatternChecks) {
          if (check.pattern.test(line)) {
            if (!suspiciousPatterns.includes(line.substring(0, 100))) {
              suspiciousPatterns.push(line.substring(0, 100));
            }
            if (!attackVectors.includes(check.vector)) {
              attackVectors.push(check.vector);
            }
          }
        }
      }

      // Determine if it's a probing attack
      // Criteria: >50 404s with >3 different attack vectors
      const probingAttack = total404s > 50 && attackVectors.length >= 3;

      const recommendations: string[] = [];
      if (probingAttack) {
        recommendations.push('CRITICAL: Active probing attack detected - review firewall rules');
        recommendations.push('Block suspicious IP addresses');
        recommendations.push('Enable rate limiting');
        recommendations.push('Consider using a WAF (Web Application Firewall)');
      } else if (attackVectors.length > 0) {
        recommendations.push('Suspicious 404 patterns detected - monitor closely');
        recommendations.push('Review access logs for repeated offenders');
      }

      return {
        total404s,
        suspiciousPatterns: suspiciousPatterns.slice(0, 10), // Top 10
        probingAttack,
        attackVectors,
        recommendations,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to detect 404 patterns: ${err.message}`);
      return {
        total404s: 0,
        suspiciousPatterns: [],
        probingAttack: false,
        attackVectors: [],
        recommendations: [],
      };
    }
  }

  /**
   * PHASE 3 - LAYER 7: Correlate errors by plugin/theme
   */
  correlateErrorsBySource(errors: ParsedError[]): {
    byPlugin: Map<string, number>;
    byTheme: Map<string, number>;
    byType: Map<string, number>;
    topCulprits: Array<{ name: string; count: number; type: string }>;
  } {
    const byPlugin = new Map<string, number>();
    const byTheme = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const error of errors) {
      // Count by type
      if (error.type) {
        byType.set(error.type, (byType.get(error.type) || 0) + 1);
      }

      // Count by culprit
      if (error.culprit) {
        if (error.type === 'PLUGIN_FAULT') {
          byPlugin.set(error.culprit, (byPlugin.get(error.culprit) || 0) + 1);
        } else if (error.type === 'THEME_FAULT') {
          byTheme.set(error.culprit, (byTheme.get(error.culprit) || 0) + 1);
        }
      }
    }

    // Build top culprits list
    const topCulprits: Array<{ name: string; count: number; type: string }> = [];

    for (const [name, count] of byPlugin.entries()) {
      topCulprits.push({ name, count, type: 'plugin' });
    }

    for (const [name, count] of byTheme.entries()) {
      topCulprits.push({ name, count, type: 'theme' });
    }

    // Sort by count descending
    topCulprits.sort((a, b) => b.count - a.count);

    return {
      byPlugin,
      byTheme,
      byType,
      topCulprits: topCulprits.slice(0, 10), // Top 10
    };
  }

  /**
   * PHASE 3 - LAYER 7: Generate comprehensive log analysis report
   */
  async generateComprehensiveReport(
    serverId: string,
    sitePath: string,
    domain?: string,
  ): Promise<{
    summary: string;
    categorization: any;
    frequency: any;
    patterns404: any;
    correlation: any;
    recommendations: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    // Analyze all logs
    const logResults = await this.analyzeLogs(serverId, sitePath, domain);

    // Aggregate all errors
    const allErrors: ParsedError[] = [];
    for (const result of logResults) {
      allErrors.push(...result.errors);
    }

    // Run all Phase 3 analyses
    const categorization = this.categorizeErrors(allErrors);
    const frequency = this.analyzeErrorFrequency(allErrors);
    const patterns404 = await this.detect404Patterns(serverId, sitePath, domain);
    const correlation = this.correlateErrorsBySource(allErrors);

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (categorization.fatal.length > 10 || frequency.hasSpike || patterns404.probingAttack) {
      severity = 'critical';
    } else if (categorization.fatal.length > 0 || frequency.errorsPerHour > 50) {
      severity = 'high';
    } else if (categorization.warning.length > 20 || frequency.errorsPerHour > 10) {
      severity = 'medium';
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (categorization.fatal.length > 0) {
      recommendations.push(`Fix ${categorization.fatal.length} fatal error(s) immediately`);
    }

    if (frequency.hasSpike) {
      recommendations.push(frequency.frequencyAnalysis);
    }

    if (correlation.topCulprits.length > 0) {
      const top = correlation.topCulprits[0];
      recommendations.push(`Top error source: ${top.name} (${top.type}) with ${top.count} errors`);
    }

    if (patterns404.probingAttack) {
      recommendations.push(...patterns404.recommendations);
    }

    // Generate summary
    const summary = `Analyzed ${logResults.length} log file(s), found ${allErrors.length} total errors. ` +
      `Fatal: ${categorization.fatal.length}, Warnings: ${categorization.warning.length}. ` +
      `Severity: ${severity.toUpperCase()}`;

    return {
      summary,
      categorization,
      frequency,
      patterns404,
      correlation,
      recommendations,
      severity,
    };
  }

}
