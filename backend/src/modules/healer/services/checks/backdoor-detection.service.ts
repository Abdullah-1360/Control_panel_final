import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';
import { CommandSanitizer } from '../../utils/command-sanitizer';
import { RetryHandler } from '../../utils/retry-handler';
import { MALWARE_PATTERNS, calculateMalwareScore, PLUGIN_WHITELIST, SUSPICIOUS_FILENAMES, isFileWhitelisted } from '../../config/malware-patterns.config';

@Injectable()
export class BackdoorDetectionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(BackdoorDetectionService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      // Sanitize inputs
      CommandSanitizer.validateServerId(serverId);
      const sanitizedPath = CommandSanitizer.sanitizePath(sitePath);
      const sanitizedDomain = CommandSanitizer.sanitizeDomain(domain);

      this.logger.log(`Scanning for backdoors in site: ${sanitizedDomain}`);

      // Perform comprehensive backdoor detection with retry
      const backdoorResults = await RetryHandler.executeWithRetry(
        () => this.scanForBackdoors(serverId, sanitizedPath),
        { maxRetries: 2 }
      );
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'No backdoors detected';
      const recommendations: string[] = [];

      const totalSuspiciousFiles = backdoorResults.suspiciousFiles.length;
      const criticalBackdoors = backdoorResults.suspiciousFiles.filter((file: any) => file.severity === 'critical');
      const warningBackdoors = backdoorResults.suspiciousFiles.filter((file: any) => file.severity === 'warning');

      if (criticalBackdoors.length > 0) {
        status = CheckStatus.FAIL;
        score = 10;
        message = `CRITICAL: ${criticalBackdoors.length} potential backdoors detected`;
        recommendations.push('Quarantine suspicious files immediately');
        recommendations.push('Restore from clean backup');
        recommendations.push('Change all passwords and security keys');
        recommendations.push('Scan entire server for compromise');
      } else if (warningBackdoors.length > 0) {
        status = CheckStatus.WARNING;
        score = 40;
        message = `${warningBackdoors.length} suspicious files require investigation`;
        recommendations.push('Review suspicious files manually');
        recommendations.push('Consider removing or cleaning suspicious files');
        recommendations.push('Monitor file changes closely');
      }

      if (backdoorResults.executableUploads > 0) {
        status = CheckStatus.FAIL;
        score = Math.min(score, 20);
        message = `${backdoorResults.executableUploads} executable file(s) found in uploads directory`;
        recommendations.push('Remove executable files from uploads directory');
        recommendations.push('Uploads directory should only contain media files');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          totalFilesScanned: backdoorResults.totalFilesScanned,
          suspiciousFiles: backdoorResults.suspiciousFiles,
          executableUploads: backdoorResults.executableUploads,
          scanPatterns: backdoorResults.patternsUsed,
          scanDuration: backdoorResults.scanDuration
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Backdoor detection failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Backdoor detection failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.BACKDOOR_DETECTION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.CRITICAL;
  }

  getName(): string {
    return 'Backdoor Detection';
  }

  getDescription(): string {
    return 'Scans for common backdoor patterns and suspicious files that could indicate compromise';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.BACKDOOR_DETECTION;
  }

  private async scanForBackdoors(serverId: string, sitePath: string): Promise<any> {
    const scanStart = Date.now();
    const results = {
      totalFilesScanned: 0,
      suspiciousFiles: [] as any[],
      executableUploads: 0,
      patternsUsed: [] as string[],
      scanDuration: 0,
      malwareScore: 0
    };

    try {
      results.patternsUsed = MALWARE_PATTERNS.map(p => p.description);

      // Scan PHP files for backdoor patterns using enhanced pattern database
      // Only scan HIGH confidence and CRITICAL severity patterns to reduce scan time
      const criticalPatterns = MALWARE_PATTERNS.filter(
        p => (p.confidence === 'HIGH' && p.severity === 'CRITICAL') || 
             (p.confidence === 'HIGH' && p.severity === 'HIGH')
      );
      
      this.logger.log(`Scanning with ${criticalPatterns.length} critical patterns`);
      
      for (const patternInfo of criticalPatterns) {
        const suspiciousFiles = await this.scanForPattern(serverId, sitePath, patternInfo.pattern);
        
        for (const file of suspiciousFiles) {
          const relativePath = file.replace(sitePath + '/', '');
          
          // Check if file is in whitelist
          const isWhitelisted = patternInfo.whitelist?.some(wl => relativePath.includes(wl)) ||
                               PLUGIN_WHITELIST.some(wl => relativePath.includes(wl));
          
          if (!isWhitelisted) {
            results.suspiciousFiles.push({
              file: relativePath,
              pattern: patternInfo.description,
              severity: patternInfo.severity.toLowerCase(),
              patternMatched: patternInfo.pattern,
              confidence: patternInfo.confidence
            });
          }
        }
      }

      // Check for suspicious filenames
      for (const suspiciousName of SUSPICIOUS_FILENAMES) {
        const command = CommandSanitizer.buildFindCommand(
          sitePath,
          `-name "${suspiciousName}" -type f`
        );
        const result = await this.sshExecutor.executeCommandDetailed(serverId, command);
        
        if (result.success && result.output) {
          const files = result.output.trim().split('\n').filter(f => f);
          for (const file of files) {
            const relativePath = file.replace(sitePath + '/', '');
            
            // Use the new whitelist function
            if (!isFileWhitelisted(relativePath)) {
              results.suspiciousFiles.push({
                file: relativePath,
                pattern: `Suspicious filename: ${suspiciousName}`,
                severity: 'critical',
                patternMatched: suspiciousName,
                confidence: 'HIGH'
              });
            }
          }
        }
      }

      // Check for executable files in uploads directory
      results.executableUploads = await this.checkExecutableUploads(serverId, sitePath);

      // Count total files scanned (approximate)
      results.totalFilesScanned = await this.countPhpFiles(serverId, sitePath);

      // Calculate malware score
      const matches = results.suspiciousFiles.map(sf => ({
        pattern: MALWARE_PATTERNS.find(p => p.pattern === sf.patternMatched) || {
          pattern: sf.patternMatched,
          confidence: sf.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
          falsePositiveRate: 0.1,
          description: sf.pattern,
          severity: sf.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        },
        file: sf.file,
      }));

      const scoreResult = calculateMalwareScore(matches);
      results.malwareScore = scoreResult.score;

      results.scanDuration = Date.now() - scanStart;
      return results;
    } catch (error) {
      this.logger.error('Failed to scan for backdoors:', error);
      throw error;
    }
  }

  private async scanForPattern(serverId: string, sitePath: string, pattern: string): Promise<string[]> {
    try {
      // Use CommandSanitizer to build safe grep command
      const command = CommandSanitizer.buildGrepCommand(
        pattern,
        `"${sitePath}"`,
        '-rl'
      ) + ' --include="*.php" | head -20';
      
      // Reduced timeout to 15 seconds per pattern to prevent overall timeout
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command, 15000);

      if (result.success && result.output) {
        return result.output.trim().split('\n').filter(file => file.trim());
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to scan for pattern ${pattern}:`, error);
      return [];
    }
  }

  private async checkExecutableUploads(serverId: string, sitePath: string): Promise<number> {
    try {
      // Check for executable files in wp-content/uploads
      const uploadsPath = `${sitePath}/wp-content/uploads`;
      const command = `find "${uploadsPath}" -type f \\( -name "*.php" -o -name "*.php3" -o -name "*.php4" -o -name "*.php5" -o -name "*.phtml" -o -name "*.pl" -o -name "*.py" -o -name "*.sh" -o -name "*.cgi" \\) 2>/dev/null | wc -l`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output) {
        return parseInt(result.output.trim()) || 0;
      }

      return 0;
    } catch (error) {
      this.logger.error('Failed to check executable uploads:', error);
      return 0;
    }
  }

  private async countPhpFiles(serverId: string, sitePath: string): Promise<number> {
    try {
      const command = `find "${sitePath}" -name "*.php" -type f | wc -l`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output) {
        return parseInt(result.output.trim()) || 0;
      }

      return 0;
    } catch (error) {
      this.logger.error('Failed to count PHP files:', error);
      return 0;
    }
  }
}