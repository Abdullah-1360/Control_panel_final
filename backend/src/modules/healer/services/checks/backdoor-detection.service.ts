import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class BackdoorDetectionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(BackdoorDetectionService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Scanning for backdoors in site: ${domain}`);

      // Perform comprehensive backdoor detection
      const backdoorResults = await this.scanForBackdoors(serverId, sitePath);
      
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
        recommendations.push('Remove executable files from uploads directory');
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
      scanDuration: 0
    };

    try {
      // Define backdoor patterns to search for
      const backdoorPatterns = [
        { pattern: 'eval\\s*\\(\\s*base64_decode', severity: 'critical', description: 'Base64 encoded eval execution' },
        { pattern: 'system\\s*\\(\\s*\\$_', severity: 'critical', description: 'System command execution from user input' },
        { pattern: 'exec\\s*\\(\\s*\\$_', severity: 'critical', description: 'Exec command from user input' },
        { pattern: 'shell_exec\\s*\\(\\s*\\$_', severity: 'critical', description: 'Shell execution from user input' },
        { pattern: 'passthru\\s*\\(\\s*\\$_', severity: 'critical', description: 'Passthru execution from user input' },
        { pattern: 'file_get_contents\\s*\\(\\s*["\']http', severity: 'warning', description: 'Remote file inclusion attempt' },
        { pattern: 'curl_exec\\s*\\(.*\\$_', severity: 'warning', description: 'CURL execution with user input' },
        { pattern: 'preg_replace.*\\/e', severity: 'critical', description: 'Deprecated preg_replace /e modifier' },
        { pattern: 'assert\\s*\\(\\s*\\$_', severity: 'critical', description: 'Assert with user input' },
        { pattern: 'create_function.*\\$_', severity: 'warning', description: 'Dynamic function creation' },
        { pattern: '\\$GLOBALS\\[.*\\]\\s*\\(', severity: 'warning', description: 'Dynamic function call via GLOBALS' },
        { pattern: 'str_rot13\\s*\\(.*base64', severity: 'warning', description: 'ROT13 with base64 obfuscation' },
        { pattern: 'gzinflate\\s*\\(\\s*base64_decode', severity: 'critical', description: 'Compressed base64 payload' },
        { pattern: '\\$_POST\\[.*\\]\\s*\\(', severity: 'critical', description: 'Function execution via POST data' },
        { pattern: '\\$_GET\\[.*\\]\\s*\\(', severity: 'critical', description: 'Function execution via GET data' }
      ];

      results.patternsUsed = backdoorPatterns.map(p => p.description);

      // Scan PHP files for backdoor patterns
      for (const patternInfo of backdoorPatterns) {
        const suspiciousFiles = await this.scanForPattern(serverId, sitePath, patternInfo.pattern);
        
        for (const file of suspiciousFiles) {
          results.suspiciousFiles.push({
            file,
            pattern: patternInfo.description,
            severity: patternInfo.severity,
            patternMatched: patternInfo.pattern
          });
        }
      }

      // Check for executable files in uploads directory
      results.executableUploads = await this.checkExecutableUploads(serverId, sitePath);

      // Count total files scanned (approximate)
      results.totalFilesScanned = await this.countPhpFiles(serverId, sitePath);

      results.scanDuration = Date.now() - scanStart;
      return results;
    } catch (error) {
      this.logger.error('Failed to scan for backdoors:', error);
      throw error;
    }
  }

  private async scanForPattern(serverId: string, sitePath: string, pattern: string): Promise<string[]> {
    try {
      // Use grep to search for the pattern in PHP files
      const command = `find "${sitePath}" -name "*.php" -type f -exec grep -l "${pattern}" {} \\; 2>/dev/null | head -20`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

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