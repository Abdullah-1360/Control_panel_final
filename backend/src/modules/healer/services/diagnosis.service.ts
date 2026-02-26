import { Injectable, Logger } from '@nestjs/common';
import { DiagnosisType } from '@prisma/client';
import { LogAnalysisService } from './log-analysis.service';
import { SSHExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';

interface DiagnosisResult {
  diagnosisType: DiagnosisType;
  confidence: number; // 0.0-1.0
  details: {
    errorType?: string;
    culprit?: string;
    errorMessage?: string;
    logFiles: string[];
    timestamp?: string;
    isSyntaxError?: boolean;
    filePath?: string;
    lineNumber?: number;
  };
  suggestedAction: string;
  suggestedCommands: string[];
  logsAnalyzed: any[];
  commandOutputs?: Array<{command: string, output: string, success: boolean, duration: number}>;
}

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(
    private readonly logAnalysis: LogAnalysisService,
    private readonly sshService: SSHExecutorService,
    private readonly wpCliService: WpCliService,
  ) {}

  /**
   * Perform full diagnosis on a WordPress site
   * EXTENSIVE MODE: Runs 12 comprehensive checks
   */
  async diagnose(
    serverId: string,
    sitePath: string,
    domain: string,
  ): Promise<DiagnosisResult> {
    this.logger.log(`Starting EXTENSIVE diagnosis for ${domain}`);

    const commandOutputs: Array<{command: string, output: string, success: boolean, duration: number}> = [];
    const startTime = Date.now();

    try {
      // Run all checks in parallel for speed
      const [
        logResults,
        maintenanceCheck,
        httpStatus,
        coreIntegrity,
        dbConnection,
        phpErrors,
        apacheErrors,
        diskSpace,
        permissions,
        htaccessCheck,
        wpConfigCheck,
        memoryLimit,
        sslCheck,
      ] = await Promise.all([
        this.logAnalysis.analyzeLogs(serverId, sitePath, domain),
        this.checkMaintenanceMode(serverId, sitePath, commandOutputs),
        this.checkHttpStatus(domain, commandOutputs),
        this.checkCoreIntegrity(serverId, sitePath, commandOutputs),
        this.checkDatabaseConnection(serverId, sitePath, commandOutputs),
        this.checkPHPErrors(serverId, sitePath, commandOutputs),
        this.checkApacheErrors(serverId, commandOutputs, domain), // Pass domain for filtering
        this.checkDiskSpace(serverId, sitePath, commandOutputs),
        this.checkWebsiteSize(serverId, sitePath, commandOutputs),
        this.checkEmailSize(serverId, sitePath, commandOutputs),
        this.checkLogsSize(serverId, sitePath, commandOutputs),
        this.checkInodes(serverId, sitePath, commandOutputs),
        this.checkAccountSummary(serverId, sitePath, commandOutputs),
        this.checkPermissions(serverId, sitePath, commandOutputs),
        this.checkHtaccess(serverId, sitePath, commandOutputs),
        this.checkWpConfig(serverId, sitePath, commandOutputs),
        this.checkMemoryLimit(serverId, sitePath, commandOutputs),
        this.checkSSL(domain, commandOutputs, serverId),
      ]);

      const totalDuration = Date.now() - startTime;
      this.logger.log(`Extensive diagnosis completed in ${totalDuration}ms`);

      // Check for stuck maintenance mode (highest priority)
      if (maintenanceCheck.isStuck) {
        return this.createMaintenanceDiagnosis(maintenanceCheck, logResults, commandOutputs);
      }

      // Check for critical issues
      if (!dbConnection.success) {
        return this.createDatabaseDiagnosis({ type: 'DB_CONNECTION', message: dbConnection.error }, logResults, commandOutputs);
      }

      if (!coreIntegrity.success) {
        return {
          diagnosisType: DiagnosisType.INTEGRITY,
          confidence: 0.90,
          details: {
            errorType: 'CORE_INTEGRITY',
            errorMessage: 'WordPress core files modified or corrupted',
            logFiles: logResults.map((r) => r.logPath),
          },
          suggestedAction: 'Restore WordPress core files',
          suggestedCommands: ['wp core download --force --skip-content'],
          logsAnalyzed: logResults,
          commandOutputs,
        };
      }

      // Analyze errors and determine diagnosis
      if (logResults.length === 0 && httpStatus === 200 && coreIntegrity.success && dbConnection.success) {
        return this.createHealthyDiagnosis(logResults, commandOutputs);
      }

      // Aggregate errors and determine primary issue
      const diagnosis = await this.aggregateAndDiagnose(
        logResults,
        httpStatus,
        serverId,
        sitePath,
        commandOutputs,
      );

      return diagnosis;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Diagnosis failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Check if site is stuck in maintenance mode
   */
  private async checkMaintenanceMode(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ isStuck: boolean; fileAge?: number }> {
    const startTime = Date.now();
    try {
      const maintenanceFile = `${sitePath}/.maintenance`;

      // Check if file exists
      const command = `test -f ${maintenanceFile} && echo "exists" || echo "not found"`;
      const exists = await this.sshService.executeCommand(serverId, command);
      
      commandOutputs.push({
        command: 'Check maintenance mode',
        output: exists,
        success: true,
        duration: Date.now() - startTime,
      });

      if (!exists.includes('exists')) {
        return { isStuck: false };
      }

      // Get file age in minutes
      const fileAge = await this.sshService.executeCommand(
        serverId,
        `stat -c %Y ${maintenanceFile}`,
      );

      const ageInMinutes = (Date.now() / 1000 - parseInt(fileAge)) / 60;

      // Consider stuck if older than 10 minutes
      return {
        isStuck: ageInMinutes > 10,
        fileAge: ageInMinutes,
      };
    } catch (error) {
      commandOutputs.push({
        command: 'Check maintenance mode',
        output: (error as Error).message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { isStuck: false };
    }
  }

  /**
   * Check HTTP status of site and detect WSOD
   */
  private async checkHttpStatus(domain: string, commandOutputs: any[]): Promise<number> {
    const startTime = Date.now();
    try {
      // Try HTTPS first, then HTTP
      const protocols = ['https', 'http'];
      
      for (const protocol of protocols) {
        try {
          const url = `${protocol}://${domain}`;
          
          // Use fetch with timeout - GET request to check content
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
          
          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'User-Agent': 'OpsManager-Healer/1.0',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          });
          
          clearTimeout(timeoutId);
          
          // Get response body to check for WSOD indicators
          const body = await response.text();
          
          // Check for completely blank page (WSOD)
          const trimmedBody = body.trim();
          const isBlankPage = trimmedBody.length === 0 || 
                             (trimmedBody.length < 100 && !trimmedBody.includes('<'));
          
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

          const wsodFound = wsodIndicators.find(indicator => 
            body.toLowerCase().includes(indicator.toLowerCase())
          );

          // Also check if response is suspiciously small (likely error page)
          const isTooSmall = body.length < 500 && response.status === 200;

          if (wsodFound || isTooSmall || isBlankPage) {
            let reason = 'Unknown issue';
            if (isBlankPage) {
              reason = 'Blank page (WSOD)';
            } else if (wsodFound) {
              reason = `WSOD detected: ${wsodFound}`;
            } else if (isTooSmall) {
              reason = 'Response too small (likely error page)';
            }
            
            this.logger.warn(`HTTP check for ${domain}: ${response.status} but ${reason}`);
            
            commandOutputs.push({
              command: `HTTP Status Check (${protocol})`,
              output: `Status: ${response.status} but site has issues\nReason: ${reason}\nSize: ${body.length} bytes\nContent preview: ${trimmedBody.substring(0, 200)}`,
              success: false,
              duration: Date.now() - startTime,
            });
            
            // Return 500 to indicate error even though status was 200
            return 500;
          }
          
          this.logger.log(`HTTP check for ${domain}: ${response.status}`);
          
          commandOutputs.push({
            command: `HTTP Status Check (${protocol})`,
            output: `Status: ${response.status} ${response.statusText}\nSize: ${body.length} bytes`,
            success: response.status < 500,
            duration: Date.now() - startTime,
          });
          
          return response.status;
        } catch (error) {
          // Try next protocol
          continue;
        }
      }
      
      // Both protocols failed
      this.logger.warn(`HTTP check failed for ${domain} - site unreachable`);
      commandOutputs.push({
        command: 'HTTP Status Check',
        output: 'Site unreachable',
        success: false,
        duration: Date.now() - startTime,
      });
      return 0;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`HTTP check error for ${domain}: ${err.message}`);
      commandOutputs.push({
        command: 'HTTP Status Check',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return 0;
    }
  }

  /**
   * Check WordPress core file integrity
   */
  private async checkCoreIntegrity(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ success: boolean; modifiedFiles?: string[]; error?: string }> {
    const startTime = Date.now();
    try {
      // Check if wp-cli is available first
      const wpCliCheck = await this.sshService.executeCommand(
        serverId,
        `cd ${sitePath} && which wp 2>/dev/null || echo "not found"`,
      );

      if (wpCliCheck.includes('not found')) {
        commandOutputs.push({
          command: 'WordPress Core Integrity Check',
          output: 'wp-cli not installed - skipping core integrity check',
          success: true, // Don't fail if wp-cli is not available
          duration: Date.now() - startTime,
        });
        return { success: true }; // Skip check if wp-cli not available
      }

      const result = await this.wpCliService.execute(
        serverId,
        sitePath,
        'core verify-checksums',
      );
      
      const success = result.includes('Success');
      commandOutputs.push({
        command: 'WordPress Core Integrity Check',
        output: result,
        success,
        duration: Date.now() - startTime,
      });
      
      return { success, modifiedFiles: success ? [] : [result] };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'WordPress Core Integrity Check',
        output: `Check skipped: ${err.message}`,
        success: true, // Don't fail diagnosis if this check fails
        duration: Date.now() - startTime,
      });
      return { success: true }; // Don't fail diagnosis if wp-cli fails
    }
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();
    try {
      // First, try to read database credentials from wp-config.php
      const wpConfigCheck = await this.sshService.executeCommand(
        serverId,
        `cat ${sitePath}/wp-config.php | grep -E "DB_NAME|DB_USER|DB_PASSWORD|DB_HOST" | head -4`,
      );
      
      if (!wpConfigCheck.includes('DB_NAME')) {
        commandOutputs.push({
          command: 'Database Connection Test',
          output: 'wp-config.php not found or invalid',
          success: false,
          duration: Date.now() - startTime,
        });
        return { success: false, error: 'wp-config.php not found' };
      }

      // Extract database credentials
      const dbNameMatch = wpConfigCheck.match(/DB_NAME['"],\s*['"]([^'"]+)['"]/);
      const dbUserMatch = wpConfigCheck.match(/DB_USER['"],\s*['"]([^'"]+)['"]/);
      const dbPassMatch = wpConfigCheck.match(/DB_PASSWORD['"],\s*['"]([^'"]+)['"]/);
      const dbHostMatch = wpConfigCheck.match(/DB_HOST['"],\s*['"]([^'"]+)['"]/);

      const dbName = dbNameMatch ? dbNameMatch[1] : '';
      const dbUser = dbUserMatch ? dbUserMatch[1] : '';
      const dbPass = dbPassMatch ? dbPassMatch[1] : '';
      const dbHost = dbHostMatch ? dbHostMatch[1] : 'localhost';

      if (!dbName || !dbUser) {
        commandOutputs.push({
          command: 'Database Connection Test',
          output: 'Database credentials not found in wp-config.php',
          success: false,
          duration: Date.now() - startTime,
        });
        return { success: false, error: 'Database credentials not found' };
      }

      // Test database connection using mysql command
      const mysqlTest = await this.sshService.executeCommand(
        serverId,
        `mysql -h ${dbHost} -u ${dbUser} ${dbPass ? `-p'${dbPass}'` : ''} -e "USE ${dbName}; SELECT 1;" 2>&1`,
      );
      
      const success = !mysqlTest.toLowerCase().includes('error') && 
                     !mysqlTest.toLowerCase().includes('denied') &&
                     !mysqlTest.toLowerCase().includes('unknown database');
      
      commandOutputs.push({
        command: 'Database Connection Test',
        output: success ? `Successfully connected to database: ${dbName}` : mysqlTest,
        success,
        duration: Date.now() - startTime,
      });
      
      return { success, error: success ? undefined : mysqlTest };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'Database Connection Test',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Check PHP error log (last 100 lines)
   */
  private async checkPHPErrors(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ hasErrors: boolean; errors: string[] }> {
    const startTime = Date.now();
    try {
      // Check both debug.log and error_log
      const debugLogResult = await this.sshService.executeCommand(
        serverId,
        `tail -100 ${sitePath}/wp-content/debug.log 2>/dev/null || echo "No debug log found"`,
      );
      
      const errorLogResult = await this.sshService.executeCommand(
        serverId,
        `tail -100 ${sitePath}/error_log 2>/dev/null || echo "No error log found"`,
      );
      
      // Also check common alternative error_log locations
      const altErrorLogResult = await this.sshService.executeCommand(
        serverId,
        `tail -100 ${sitePath}/public_html/error_log 2>/dev/null || tail -100 ${sitePath}/../error_log 2>/dev/null || echo "No alternative error log found"`,
      );
      
      const combinedLogs = `${debugLogResult}\n${errorLogResult}\n${altErrorLogResult}`;
      
      const hasErrors = combinedLogs.includes('Fatal error') || 
                       combinedLogs.includes('Warning') || 
                       combinedLogs.includes('Error') ||
                       combinedLogs.includes('PHP Parse error') ||
                       combinedLogs.includes('PHP Fatal error');
      
      commandOutputs.push({
        command: 'PHP Error Log Analysis (debug.log + error_log, last 100 lines each)',
        output: combinedLogs,
        success: !hasErrors,
        duration: Date.now() - startTime,
      });
      
      const errorLines = hasErrors 
        ? combinedLogs.split('\n').filter(l => 
            l.includes('Error') || 
            l.includes('Fatal') || 
            l.includes('Warning') ||
            l.includes('Parse error')
          ) 
        : [];
      
      return { hasErrors, errors: errorLines };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'PHP Error Log Analysis',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { hasErrors: false, errors: [] };
    }
  }

  /**
   * Check Apache/Nginx error logs
   */
  private async checkApacheErrors(
    serverId: string,
    commandOutputs: any[],
    domain?: string,
  ): Promise<{ hasErrors: boolean; errors: string[] }> {
    const startTime = Date.now();
    try {
      let apacheResult: string;
      let nginxResult: string;
      
      if (domain) {
        // With domain filtering - use subshell to handle grep exit codes properly
        apacheResult = await this.sshService.executeCommand(
          serverId,
          `(tail -500 /var/log/apache2/error.log 2>/dev/null || tail -500 /var/log/httpd/error_log 2>/dev/null || echo "No Apache log found") | grep -i "${domain}" || echo "No Apache errors found for ${domain}"`,
          90000, // 90 second timeout for large log files
        );
        
        nginxResult = await this.sshService.executeCommand(
          serverId,
          `(tail -500 /var/log/nginx/error.log 2>/dev/null || echo "No Nginx log found") | grep -i "${domain}" || echo "No Nginx errors found for ${domain}"`,
          90000,
        );
      } else {
        // Without domain filtering - get all logs
        apacheResult = await this.sshService.executeCommand(
          serverId,
          `tail -500 /var/log/apache2/error.log 2>/dev/null || tail -500 /var/log/httpd/error_log 2>/dev/null || echo "No Apache log found"`,
          90000,
        );
        
        nginxResult = await this.sshService.executeCommand(
          serverId,
          `tail -500 /var/log/nginx/error.log 2>/dev/null || echo "No Nginx log found"`,
          90000,
        );
      }
      
      const combinedResult = `Apache/httpd:\n${apacheResult}\n\nNginx:\n${nginxResult}`;
      const hasErrors = (apacheResult.includes('error') || apacheResult.includes('critical') ||
                        nginxResult.includes('error') || nginxResult.includes('critical')) &&
                        !apacheResult.includes('No Apache') && !nginxResult.includes('No Nginx');
      
      commandOutputs.push({
        command: domain 
          ? `Apache/Nginx Error Log Analysis (filtered for ${domain})` 
          : 'Apache/Nginx Error Log Analysis',
        output: combinedResult,
        success: !hasErrors,
        duration: Date.now() - startTime,
      });
      
      return { hasErrors, errors: [] };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'Apache/Nginx Error Log Analysis',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { hasErrors: false, errors: [] };
    }
  }

  /**
   * Check disk space using cPanel quota command (quota-only, no fallback)
   */
  private async checkDiskSpace(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ available: string; usage: string; critical: boolean }> {
    const startTime = Date.now();
    try {
      // Extract username from path (e.g., /home/x98aailqrs/public_html -> x98aailqrs)
      const usernameMatch = sitePath.match(/\/home\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;
      
      if (!username) {
        throw new Error('Could not extract username from path');
      }
      
      // Use cPanel quota command for accurate disk usage
      const quotaCommand = `quota -u ${username} 2>&1`;
      const quotaResult = await this.sshService.executeCommand(serverId, quotaCommand);
      
      this.logger.debug(`Quota command result for ${username}: ${quotaResult.substring(0, 200)}`);
      
      // Check if quota command succeeded
      if (!quotaResult.includes('/dev/')) {
        throw new Error(`Quota command failed or returned no data: ${quotaResult.substring(0, 100)}`);
      }
      
      // Parse quota output
      // Format: Filesystem  blocks   quota   limit   grace   files   quota   limit   grace
      //         /dev/sda9  239024  15360000 15360000            6732  100000  100000
      // Note: Output might be on one line or multiple lines
      const lines = quotaResult.trim().split('\n');
      
      // Find the line with the largest usage (usually /dev/sda9 or similar)
      let maxUsagePercent = 0;
      let maxUsageBlocks = 0;
      let maxQuota = 0;
      let maxAvailable = 0;
      
      // Check each line AND also check if /dev/ entries are on the same line as header
      for (const line of lines) {
        // Split by /dev/ to handle cases where output is on one line
        const devEntries = line.split(/(?=\/dev\/)/);
        
        for (const entry of devEntries) {
          if (entry.trim().startsWith('/dev/')) {
            const parts = entry.trim().split(/\s+/);
            const blocks = parseInt(parts[1]) || 0; // Current usage in KB
            const quota = parseInt(parts[2]) || 0;  // Soft limit in KB
            const limit = parseInt(parts[3]) || 0;  // Hard limit in KB
            
            const effectiveLimit = limit || quota;
            if (effectiveLimit > 0) {
              const usagePercent = (blocks / effectiveLimit) * 100;
              if (usagePercent > maxUsagePercent) {
                maxUsagePercent = usagePercent;
                maxUsageBlocks = blocks;
                maxQuota = effectiveLimit;
                maxAvailable = effectiveLimit - blocks;
              }
            }
          }
        }
      }
      
      if (maxQuota === 0) {
        throw new Error('No valid quota data found in output');
      }
      
      const usageStr = `${maxUsagePercent.toFixed(1)}%`;
      const usedMB = (maxUsageBlocks / 1024).toFixed(2);
      const quotaMB = (maxQuota / 1024).toFixed(2);
      const availableMB = (maxAvailable / 1024).toFixed(2);
      const critical = maxUsagePercent > 90;
      
      this.logger.debug(`Using quota data: ${usedMB}MB / ${quotaMB}MB (${usageStr})`);
      
      commandOutputs.push({
        command: 'Disk Space Check (quota)',
        output: `Used: ${usedMB} MB / ${quotaMB} MB (${usageStr})\nAvailable: ${availableMB} MB`,
        success: !critical,
        duration: Date.now() - startTime,
      });
      
      return { 
        available: `${availableMB} MB`, 
        usage: usageStr, 
        critical 
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Disk space check failed: ${err.message}`);
      commandOutputs.push({
        command: 'Disk Space Check (quota)',
        output: `Failed: ${err.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
      return { available: 'Unknown', usage: '0%', critical: false };
    }
  }

  /**
   * Check website size using du command
   */
  private async checkWebsiteSize(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Use du -sh to get human-readable size
      const command = `du -sh ${sitePath} 2>&1 | awk '{print $1}'`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      const size = result.trim();
      
      // Parse size to check if it's too large (e.g., > 5GB)
      let sizeInMB = 0;
      let warning = false;
      
      if (size.includes('G')) {
        sizeInMB = parseFloat(size.replace('G', '')) * 1024;
        warning = sizeInMB > 5120; // Warn if > 5GB
      } else if (size.includes('M')) {
        sizeInMB = parseFloat(size.replace('M', ''));
        warning = sizeInMB > 5120;
      } else if (size.includes('K')) {
        sizeInMB = parseFloat(size.replace('K', '')) / 1024;
      }
      
      this.logger.debug(`Website size for ${sitePath}: ${size} (${sizeInMB.toFixed(2)} MB)`);
      
      commandOutputs.push({
        command: 'Website Size Check (du)',
        output: `Total size: ${size}${warning ? ' (Warning: Large website size may affect performance)' : ''}`,
        success: !warning,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Website size check failed: ${err.message}`);
      commandOutputs.push({
        command: 'Website Size Check (du)',
        output: `Failed: ${err.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Check email directory size
   */
  private async checkEmailSize(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Extract username from path
      const usernameMatch = sitePath.match(/\/home\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;
      
      if (!username) {
        throw new Error('Could not extract username from path');
      }
      
      // Check email directory size
      const mailPath = `/home/${username}/mail`;
      const command = `du -sh ${mailPath} 2>&1 | awk '{print $1}'`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      const size = result.trim();
      
      // Parse size to check if it's too large (e.g., > 2GB)
      let sizeInMB = 0;
      let warning = false;
      
      if (size.includes('G')) {
        sizeInMB = parseFloat(size.replace('G', '')) * 1024;
        warning = sizeInMB > 2048; // Warn if > 2GB
      } else if (size.includes('M')) {
        sizeInMB = parseFloat(size.replace('M', ''));
        warning = sizeInMB > 2048;
      } else if (size.includes('K')) {
        sizeInMB = parseFloat(size.replace('K', '')) / 1024;
      }
      
      this.logger.debug(`Email size for ${username}: ${size} (${sizeInMB.toFixed(2)} MB)`);
      
      commandOutputs.push({
        command: 'Email Directory Size (du)',
        output: `Total email size: ${size}${warning ? ' (Warning: Large email storage may consume disk space)' : ''}`,
        success: !warning,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Email size check failed: ${err.message}`);
      commandOutputs.push({
        command: 'Email Directory Size (du)',
        output: `Failed: ${err.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Check logs directory size
   */
  private async checkLogsSize(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Extract username from path
      const usernameMatch = sitePath.match(/\/home\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;
      
      if (!username) {
        throw new Error('Could not extract username from path');
      }
      
      // Check logs directory size
      const logsPath = `/home/${username}/logs`;
      const command = `du -sh ${logsPath} 2>&1 | awk '{print $1}'`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      const size = result.trim();
      
      // Parse size to check if it's too large (e.g., > 1GB)
      let sizeInMB = 0;
      let warning = false;
      let critical = false;
      
      if (size.includes('G')) {
        sizeInMB = parseFloat(size.replace('G', '')) * 1024;
        critical = sizeInMB > 2048; // Critical if > 2GB
        warning = sizeInMB > 1024 && !critical; // Warning if > 1GB
      } else if (size.includes('M')) {
        sizeInMB = parseFloat(size.replace('M', ''));
        critical = sizeInMB > 2048;
        warning = sizeInMB > 1024 && !critical;
      } else if (size.includes('K')) {
        sizeInMB = parseFloat(size.replace('K', '')) / 1024;
      }
      
      this.logger.debug(`Logs size for ${username}: ${size} (${sizeInMB.toFixed(2)} MB)`);
      
      let output = `Total logs size: ${size}`;
      
      if (critical) {
        output += '\n\n❌ CRITICAL: Logs directory is very large (>2GB). Consider log rotation or cleanup.';
      } else if (warning) {
        output += '\n\n⚠️ WARNING: Logs directory is large (>1GB). Monitor and consider cleanup.';
      }
      
      commandOutputs.push({
        command: 'Logs Directory Size (du)',
        output,
        success: !critical,
        duration: Date.now() - startTime,
      });
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Logs size check failed: ${error.message}`);
      commandOutputs.push({
        command: 'Logs Directory Size (du)',
        output: `Failed: ${error.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Check inodes usage
   */
  private async checkInodes(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Extract username from path
      const usernameMatch = sitePath.match(/\/home\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;
      
      if (!username) {
        throw new Error('Could not extract username from path');
      }
      
      const homePath = `/home/${username}`;
      
      // Check inodes usage
      const command = `df -i ${homePath} 2>&1 | tail -1`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      const parts = result.trim().split(/\s+/);
      const inodesUsed = parts[2] || '0';
      const inodesTotal = parts[1] || '0';
      const inodesPercent = parts[4] || '0%';
      const usagePercent = parseInt(inodesPercent.replace('%', ''));
      
      const critical = usagePercent > 80;
      const warning = usagePercent > 60;
      
      this.logger.debug(`Inodes for ${username}: ${inodesUsed}/${inodesTotal} (${inodesPercent})`);
      
      let output = `Inodes used: ${inodesUsed} / ${inodesTotal} (${inodesPercent})`;
      
      // If usage is high, get top 20 directories consuming inodes
      if (critical || warning) {
        try {
          const topDirsCommand = `du -h ${homePath} 2>/dev/null | sort -hr | head -20`;
          const topDirs = await this.sshService.executeCommand(serverId, topDirsCommand, 30000);
          output += `\n\nTop 20 directories by size:\n${topDirs.trim()}`;
        } catch (err) {
          const error = err as Error;
          this.logger.warn(`Failed to get top directories: ${error.message}`);
        }
      }
      
      if (critical) {
        output += '\n\n⚠️ CRITICAL: Inodes usage is very high! This may prevent file creation.';
      } else if (warning) {
        output += '\n\n⚠️ WARNING: Inodes usage is elevated. Monitor closely.';
      }
      
      commandOutputs.push({
        command: 'Inodes Usage Check (df -i)',
        output,
        success: !critical,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Inodes check failed: ${err.message}`);
      commandOutputs.push({
        command: 'Inodes Usage Check (df -i)',
        output: `Failed: ${err.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Check cPanel account summary for issues
   */
  private async checkAccountSummary(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Extract username from path
      const usernameMatch = sitePath.match(/\/home\/([^\/]+)/);
      const username = usernameMatch ? usernameMatch[1] : null;
      
      if (!username) {
        throw new Error('Could not extract username from path');
      }
      
      // Get account summary using WHM API
      const command = `whmapi1 accountsummary user=${username} 2>&1`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      this.logger.debug(`Account summary for ${username}: ${result.substring(0, 300)}`);
      
      // Parse YAML-like output
      const lines = result.split('\n');
      const accountData: any = {};
      
      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          accountData[key] = value;
        }
      }
      
      // Check for issues
      const issues: string[] = [];
      const warnings: string[] = [];
      
      // Check if account is suspended
      if (accountData.suspended === '1') {
        issues.push(`❌ Account is SUSPENDED: ${accountData.suspendreason || 'Unknown reason'}`);
      }
      
      // Check if account is locked
      if (accountData.is_locked === '1') {
        issues.push('❌ Account is LOCKED');
      }
      
      // Check outgoing mail status
      if (accountData.outgoing_mail_suspended === '1') {
        issues.push('❌ Outgoing mail is SUSPENDED');
      }
      
      if (accountData.outgoing_mail_hold === '1') {
        warnings.push('⚠️ Outgoing mail is on HOLD');
      }
      
      // Check disk usage
      const diskUsed = accountData.diskused || '0M';
      const diskLimit = accountData.disklimit || '0M';
      const diskUsedMB = parseFloat(diskUsed.replace('M', ''));
      const diskLimitMB = parseFloat(diskLimit.replace('M', ''));
      
      if (diskLimitMB > 0) {
        const diskPercent = (diskUsedMB / diskLimitMB) * 100;
        if (diskPercent > 95) {
          issues.push(`❌ Disk usage critical: ${diskUsedMB}MB / ${diskLimitMB}MB (${diskPercent.toFixed(1)}%)`);
        } else if (diskPercent > 85) {
          warnings.push(`⚠️ Disk usage high: ${diskUsedMB}MB / ${diskLimitMB}MB (${diskPercent.toFixed(1)}%)`);
        }
      }
      
      // Check inodes usage
      const inodesUsed = parseInt(accountData.inodesused || '0');
      const inodesLimit = parseInt(accountData.inodeslimit || '0');
      
      if (inodesLimit > 0) {
        const inodesPercent = (inodesUsed / inodesLimit) * 100;
        if (inodesPercent > 95) {
          issues.push(`❌ Inodes critical: ${inodesUsed} / ${inodesLimit} (${inodesPercent.toFixed(1)}%)`);
        } else if (inodesPercent > 85) {
          warnings.push(`⚠️ Inodes high: ${inodesUsed} / ${inodesLimit} (${inodesPercent.toFixed(1)}%)`);
        }
      }
      
      // Check email limits
      const maxEmailPerHour = parseInt(accountData.max_email_per_hour || '0');
      if (maxEmailPerHour > 0 && maxEmailPerHour < 50) {
        warnings.push(`⚠️ Email limit is low: ${maxEmailPerHour} emails/hour`);
      }
      
      // Build output
      let output = `Account: ${username}\n`;
      output += `Domain: ${accountData.domain || 'Unknown'}\n`;
      output += `Plan: ${accountData.plan || 'Unknown'}\n`;
      output += `Owner: ${accountData.owner || 'Unknown'}\n`;
      output += `Status: ${accountData.suspended === '1' ? 'SUSPENDED' : 'Active'}\n`;
      output += `Disk: ${diskUsed} / ${diskLimit}\n`;
      output += `Inodes: ${inodesUsed} / ${inodesLimit}\n`;
      output += `Email Limit: ${maxEmailPerHour} per hour\n`;
      
      if (issues.length > 0) {
        output += `\n🚨 CRITICAL ISSUES:\n${issues.join('\n')}`;
      }
      
      if (warnings.length > 0) {
        output += `\n\n⚠️ WARNINGS:\n${warnings.join('\n')}`;
      }
      
      if (issues.length === 0 && warnings.length === 0) {
        output += '\n\n✅ No issues detected';
      }
      
      const hasIssues = issues.length > 0;
      
      commandOutputs.push({
        command: 'cPanel Account Summary (whmapi1)',
        output,
        success: !hasIssues,
        duration: Date.now() - startTime,
      });
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Account summary check failed: ${error.message}`);
      commandOutputs.push({
        command: 'cPanel Account Summary (whmapi1)',
        output: `Failed: ${error.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Check file permissions (wp-content, uploads)
   */
  private async checkPermissions(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ correct: boolean; issues: string[] }> {
    const startTime = Date.now();
    try {
      const result = await this.sshService.executeCommand(
        serverId,
        `ls -ld ${sitePath}/wp-content ${sitePath}/wp-content/uploads 2>/dev/null || echo "Directories not found"`,
      );
      
      const hasIssues = result.includes('Permission denied') || result.includes('not found');
      commandOutputs.push({
        command: 'File Permissions Check (wp-content, uploads)',
        output: result,
        success: !hasIssues,
        duration: Date.now() - startTime,
      });
      
      return { correct: !hasIssues, issues: hasIssues ? [result] : [] };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'File Permissions Check',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { correct: false, issues: [err.message] };
    }
  }

  /**
   * Validate .htaccess file
   */
  private async checkHtaccess(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ valid: boolean; exists: boolean; error?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.sshService.executeCommand(
        serverId,
        `test -f ${sitePath}/.htaccess && cat ${sitePath}/.htaccess | head -20 || echo "File not found"`,
      );
      
      const exists = !result.includes('File not found');
      const valid = exists && !result.includes('syntax error');
      
      commandOutputs.push({
        command: '.htaccess Validation',
        output: result,
        success: valid || !exists,
        duration: Date.now() - startTime,
      });
      
      return { valid, exists };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: '.htaccess Validation',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { valid: false, exists: false, error: err.message };
    }
  }

  /**
   * Validate wp-config.php
   */
  private async checkWpConfig(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ valid: boolean; debugEnabled: boolean; error?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.sshService.executeCommand(
        serverId,
        `cat ${sitePath}/wp-config.php | grep -E "WP_DEBUG|DB_NAME|DB_USER" | head -10`,
      );
      
      const valid = result.includes('DB_NAME') && result.includes('DB_USER');
      const debugEnabled = result.includes('WP_DEBUG') && result.includes('true');
      
      commandOutputs.push({
        command: 'wp-config.php Validation',
        output: result,
        success: valid,
        duration: Date.now() - startTime,
      });
      
      return { valid, debugEnabled };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'wp-config.php Validation',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { valid: false, debugEnabled: false, error: err.message };
    }
  }

  /**
   * Check PHP memory limit
   */
  private async checkMemoryLimit(
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<{ limit: string; sufficient: boolean }> {
    const startTime = Date.now();
    try {
      const result = await this.sshService.executeCommand(
        serverId,
        `cd ${sitePath} && php -r "echo ini_get('memory_limit');" 2>/dev/null || echo "Unknown"`,
      );
      
      const limit = result.trim();
      const limitMB = parseInt(limit.replace(/[^0-9]/g, ''));
      const sufficient = limitMB >= 128;
      
      commandOutputs.push({
        command: 'Memory Limit Check',
        output: `PHP Memory Limit: ${limit}`,
        success: sufficient,
        duration: Date.now() - startTime,
      });
      
      return { limit, sufficient };
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'Memory Limit Check',
        output: err.message,
        success: false,
        duration: Date.now() - startTime,
      });
      return { limit: 'Unknown', sufficient: false };
    }
  }

  /**
   * Check SSL certificate using cPanel paths and openssl
   */
  private async checkSSL(domain: string, commandOutputs: any[], serverId: string): Promise<{ valid: boolean; expiresIn?: number; error?: string }> {
    const startTime = Date.now();
    try {
      // First try cPanel-specific SSL certificate path
      const certPath = `/var/cpanel/ssl/apache_tls/${domain}`;
      const opensslCommand = `cd ${certPath} && openssl x509 -in certificates -noout -dates 2>/dev/null || echo "CERT_NOT_FOUND"`;
      
      try {
        const result = await this.sshService.executeCommand(serverId, opensslCommand);
        
        if (result.includes('CERT_NOT_FOUND') || result.includes('No such file')) {
          // Certificate file not found, try HTTPS check as fallback
          return await this.checkSSLFallback(domain, commandOutputs, startTime);
        }
        
        // Parse openssl output
        // Format: notBefore=Jan 1 00:00:00 2024 GMT
        //         notAfter=Jan 1 00:00:00 2025 GMT
        const notAfterMatch = result.match(/notAfter=(.+)/);
        const notBeforeMatch = result.match(/notBefore=(.+)/);
        
        if (notAfterMatch && notBeforeMatch) {
          const expiryDate = new Date(notAfterMatch[1]);
          const startDate = new Date(notBeforeMatch[1]);
          const now = new Date();
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Check if certificate is valid (not expired and started)
          const isValid = now >= startDate && now <= expiryDate;
          const isExpiringSoon = daysUntilExpiry < 30 && daysUntilExpiry > 0;
          
          if (isValid) {
            commandOutputs.push({
              command: 'SSL Certificate Check',
              output: `Valid until: ${expiryDate.toLocaleDateString()}\nDays remaining: ${daysUntilExpiry}${isExpiringSoon ? ' (expiring soon!)' : ''}`,
              success: !isExpiringSoon,
              duration: Date.now() - startTime,
            });
            
            return { valid: true, expiresIn: daysUntilExpiry };
          } else {
            const error = now < startDate ? 'Certificate not yet valid' : 'Certificate expired';
            commandOutputs.push({
              command: 'SSL Certificate Check',
              output: `${error}\nExpiry date: ${expiryDate.toLocaleDateString()}`,
              success: false,
              duration: Date.now() - startTime,
            });
            
            return { valid: false, error };
          }
        }
        
        // Could not parse dates, fallback to HTTPS check
        return await this.checkSSLFallback(domain, commandOutputs, startTime);
      } catch (sshError) {
        // SSH command failed, try HTTPS check as fallback
        return await this.checkSSLFallback(domain, commandOutputs, startTime);
      }
    } catch (error) {
      const err = error as Error;
      commandOutputs.push({
        command: 'SSL Certificate Check',
        output: `Error: ${err.message}`,
        success: false,
        duration: Date.now() - startTime,
      });
      
      return { valid: false, error: err.message };
    }
  }

  /**
   * Fallback SSL check using HTTPS request
   */
  private async checkSSLFallback(domain: string, commandOutputs: any[], startTime: number): Promise<{ valid: boolean; expiresIn?: number; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      commandOutputs.push({
        command: 'SSL Certificate Check',
        output: 'SSL certificate is valid (verified via HTTPS)',
        success: true,
        duration: Date.now() - startTime,
      });
      
      return { valid: true };
    } catch (error) {
      const err = error as Error;
      const isSSLError = err.message.includes('certificate') || err.message.includes('SSL') || err.message.includes('TLS');
      
      commandOutputs.push({
        command: 'SSL Certificate Check',
        output: isSSLError ? 'SSL certificate issue detected' : 'HTTPS not available',
        success: false,
        duration: Date.now() - startTime,
      });
      
      return { valid: false, error: err.message };
    }
  }

  /**
   * Aggregate log results and determine primary diagnosis
   */
  private async aggregateAndDiagnose(
    logResults: any[],
    httpStatus: number,
    serverId: string,
    sitePath: string,
    commandOutputs: any[],
  ): Promise<DiagnosisResult> {
    // Flatten all errors
    const allErrors = logResults.flatMap((result) => result.errors);

    if (allErrors.length === 0) {
      return this.createUnknownDiagnosis(logResults, httpStatus, commandOutputs);
    }

    // Count error types
    const errorTypeCounts = this.countErrorTypes(allErrors);

    // Determine primary issue
    const primaryErrorType = this.getPrimaryErrorType(errorTypeCounts);

    // Get most recent error of primary type
    const primaryError = allErrors.find((e) => e.type === primaryErrorType);

    // Create diagnosis based on error type
    switch (primaryErrorType) {
      case 'PLUGIN_FAULT':
        return this.createPluginFaultDiagnosis(primaryError, logResults, commandOutputs);

      case 'THEME_FAULT':
        return this.createThemeFaultDiagnosis(primaryError, logResults, commandOutputs);

      case 'MEMORY_EXHAUSTION':
        return this.createMemoryExhaustionDiagnosis(primaryError, logResults, commandOutputs);

      case 'DB_CONNECTION':
      case 'DB_ACCESS_DENIED':
        return this.createDatabaseDiagnosis(primaryError, logResults, commandOutputs);

      case 'SYNTAX_ERROR':
        return this.createSyntaxErrorDiagnosis(primaryError, logResults, commandOutputs);

      default:
        return this.createUnknownDiagnosis(logResults, httpStatus, commandOutputs);
    }
  }

  /**
   * Count occurrences of each error type
   */
  private countErrorTypes(errors: any[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const error of errors) {
      if (error.type) {
        counts[error.type] = (counts[error.type] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Get the most common error type
   */
  private getPrimaryErrorType(counts: Record<string, number>): string {
    let maxCount = 0;
    let primaryType = 'UNKNOWN';

    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryType = type;
      }
    }

    return primaryType;
  }

  /**
   * Create diagnosis for plugin fault
   */
  private createPluginFaultDiagnosis(
    error: any,
    logResults: any[],
    commandOutputs: any[],
  ): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.WSOD,
      confidence: 0.95,
      details: {
        errorType: 'PLUGIN_FAULT',
        culprit: error.culprit,
        errorMessage: error.message,
        logFiles: logResults.map((r) => r.logPath),
        timestamp: error.timestamp,
      },
      suggestedAction: `Deactivate faulty plugin: ${error.culprit}`,
      suggestedCommands: [`wp plugin deactivate ${error.culprit}`],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for theme fault
   */
  private createThemeFaultDiagnosis(
    error: any,
    logResults: any[],
    commandOutputs: any[],
  ): DiagnosisResult {
    const themeName = error.culprit || 'unknown';
    
    // Check if it's a syntax error
    const isSyntaxError = error.message && error.message.includes('Parse error');
    
    // Extract file and line number if available
    const fileMatch = error.message ? error.message.match(/in (.*?) on line (\d+)/) : null;
    const filePath = fileMatch ? fileMatch[1] : undefined;
    const lineNumber = fileMatch ? parseInt(fileMatch[2]) : undefined;
    
    let suggestedAction = `Disable faulty theme by renaming its directory, then switch to default theme`;
    let suggestedCommands = [
      `# Step 1: Rename faulty theme directory to disable it`,
      `mv wp-content/themes/${themeName} wp-content/themes/${themeName}.disabled`,
      `# Step 2: Activate default theme`,
      `wp theme activate twentytwentyfour`,
    ];
    
    if (isSyntaxError && filePath && lineNumber) {
      suggestedAction = `Fix syntax error in ${themeName} theme (${filePath} line ${lineNumber}) or disable the theme`;
      suggestedCommands = [
        `# Option 1: Disable faulty theme by renaming directory`,
        `mv wp-content/themes/${themeName} wp-content/themes/${themeName}.disabled`,
        `wp theme activate twentytwentyfour`,
        `# Option 2: Fix the syntax error manually`,
        `# Edit file: ${filePath} at line ${lineNumber}`,
        `# Option 3: Delete and reinstall the theme`,
        `mv wp-content/themes/${themeName} wp-content/themes/${themeName}.disabled`,
        `wp theme activate twentytwentyfour`,
        `wp theme install ${themeName}`,
      ];
    } else if (isSyntaxError) {
      suggestedAction = `Disable faulty theme ${themeName} by renaming directory, then switch to default theme`;
      suggestedCommands = [
        `# Step 1: Disable faulty theme`,
        `mv wp-content/themes/${themeName} wp-content/themes/${themeName}.disabled`,
        `# Step 2: Activate default theme`,
        `wp theme activate twentytwentyfour`,
        `# Step 3 (optional): Reinstall the theme`,
        `wp theme install ${themeName}`,
      ];
    } else {
      suggestedAction = `Theme ${themeName} is causing errors - disable it and switch to default theme`;
      suggestedCommands = [
        `# Step 1: Disable faulty theme`,
        `mv wp-content/themes/${themeName} wp-content/themes/${themeName}.disabled`,
        `# Step 2: Activate default theme`,
        `wp theme activate twentytwentyfour`,
        `# If issue persists, reinstall the theme:`,
        `wp theme install ${themeName}`,
      ];
    }
    
    return {
      diagnosisType: DiagnosisType.SYNTAX_ERROR,
      confidence: 0.95,
      details: {
        errorType: 'THEME_FAULT',
        culprit: themeName,
        errorMessage: error.message,
        logFiles: logResults.map((r) => r.logPath),
        timestamp: error.timestamp,
        isSyntaxError,
        filePath,
        lineNumber,
      },
      suggestedAction,
      suggestedCommands,
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for memory exhaustion
   */
  private createMemoryExhaustionDiagnosis(
    error: any,
    logResults: any[],
    commandOutputs: any[],
  ): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.MEMORY_EXHAUSTION,
      confidence: 0.90,
      details: {
        errorType: 'MEMORY_EXHAUSTION',
        errorMessage: error.message,
        logFiles: logResults.map((r) => r.logPath),
        timestamp: error.timestamp,
      },
      suggestedAction: 'Increase PHP memory limit to 256M',
      suggestedCommands: [
        'wp config set WP_MEMORY_LIMIT 256M --raw',
        'wp config set WP_MAX_MEMORY_LIMIT 512M --raw',
      ],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for database errors
   */
  private createDatabaseDiagnosis(
    error: any,
    logResults: any[],
    commandOutputs: any[],
  ): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.DB_ERROR,
      confidence: 0.85,
      details: {
        errorType: error.type,
        errorMessage: error.message,
        logFiles: logResults.map((r) => r.logPath),
        timestamp: error.timestamp,
      },
      suggestedAction: 'Check and repair database',
      suggestedCommands: ['wp db check', 'wp db repair'],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for syntax errors
   */
  private createSyntaxErrorDiagnosis(
    error: any,
    logResults: any[],
    commandOutputs: any[],
  ): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.WSOD,
      confidence: 0.80,
      details: {
        errorType: 'SYNTAX_ERROR',
        errorMessage: error.message,
        logFiles: logResults.map((r) => r.logPath),
        timestamp: error.timestamp,
      },
      suggestedAction: 'Syntax error detected - manual intervention required',
      suggestedCommands: [],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for stuck maintenance mode
   */
  private createMaintenanceDiagnosis(
    maintenanceCheck: any,
    logResults: any[],
    commandOutputs: any[],
  ): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.MAINTENANCE,
      confidence: 1.0,
      details: {
        errorType: 'STUCK_MAINTENANCE',
        errorMessage: `Site stuck in maintenance mode for ${Math.round(maintenanceCheck.fileAge)} minutes`,
        logFiles: logResults.map((r) => r.logPath),
      },
      suggestedAction: 'Remove stuck .maintenance file',
      suggestedCommands: ['rm -f .maintenance'],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for healthy site
   */
  private createHealthyDiagnosis(logResults: any[], commandOutputs: any[]): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.HEALTHY,
      confidence: 1.0,
      details: {
        errorType: 'NONE',
        errorMessage: 'No errors detected',
        logFiles: logResults.map((r) => r.logPath),
      },
      suggestedAction: 'Site is healthy - no action needed',
      suggestedCommands: [],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }

  /**
   * Create diagnosis for unknown issues
   */
  private createUnknownDiagnosis(
    logResults: any[],
    httpStatus: number,
    commandOutputs: any[],
  ): DiagnosisResult {
    return {
      diagnosisType: DiagnosisType.UNKNOWN,
      confidence: 0.0,
      details: {
        errorType: 'UNKNOWN',
        errorMessage: `Site returning HTTP ${httpStatus} but no clear errors in logs`,
        logFiles: logResults.map((r) => r.logPath),
      },
      suggestedAction: 'Unable to determine root cause - manual investigation required',
      suggestedCommands: [],
      logsAnalyzed: logResults,
      commandOutputs,
    };
  }
}

