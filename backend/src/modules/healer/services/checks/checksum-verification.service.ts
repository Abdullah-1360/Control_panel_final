import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';

@Injectable()
export class ChecksumVerificationService implements IDiagnosisCheckService {
  private readonly logger = new Logger(ChecksumVerificationService.name);

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService
  ) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Verifying WordPress core file checksums for site: ${domain}`);

      // Test SSH connection first
      const connectionTest = await this.testConnection(serverId);
      if (!connectionTest) {
        return {
          checkType: this.getCheckType(),
          status: CheckStatus.SKIPPED,
          score: 0,
          message: 'Checksum verification skipped: SSH connection not available',
          details: { error: 'SSH connection failed' },
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Get WordPress version
      const version = await this.getWordPressVersion(serverId, sitePath);
      if (!version) {
        return {
          checkType: this.getCheckType(),
          status: CheckStatus.SKIPPED,
          score: 0,
          message: 'Checksum verification skipped: Unable to determine WordPress version',
          details: { error: 'WordPress version detection failed' },
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Verify core files using WP-CLI
      const verificationResult = await this.verifyCoreChecksums(serverId, sitePath, version);
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'All WordPress core files verified successfully';
      const recommendations: string[] = [];

      if (verificationResult.modifiedFiles.length > 0 || verificationResult.missingFiles.length > 0) {
        const criticalFiles = verificationResult.modifiedFiles.filter((file: string) => 
          file.includes('wp-admin') || file.includes('wp-includes') || file === 'wp-config.php'
        );
        
        if (criticalFiles.length > 0 || verificationResult.missingFiles.length > 0) {
          status = CheckStatus.FAIL;
          score = 20;
          message = `Core integrity compromised: ${criticalFiles.length} critical files modified, ${verificationResult.missingFiles.length} files missing`;
          recommendations.push('Restore WordPress core files from clean installation');
          recommendations.push('Scan for malware before restoration');
          recommendations.push('Review file modification timestamps');
        } else {
          status = CheckStatus.WARNING;
          score = 60;
          message = `${verificationResult.modifiedFiles.length} non-critical core files modified`;
          recommendations.push('Review modified files for unauthorized changes');
          recommendations.push('Consider restoring modified core files');
        }
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          wordpressVersion: version,
          totalFilesChecked: verificationResult.totalFiles,
          modifiedFiles: verificationResult.modifiedFiles,
          missingFiles: verificationResult.missingFiles,
          extraFiles: verificationResult.extraFiles,
          verificationMethod: 'wp-cli-core-verify'
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Checksum verification failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Checksum verification failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.CHECKSUM_VERIFICATION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'WordPress Core Checksum Verification';
  }

  getDescription(): string {
    return 'Verifies WordPress core file integrity against official checksums from wordpress.org';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.CHECKSUM_VERIFICATION;
  }

  private async getWordPressVersion(serverId: string, sitePath: string): Promise<string | null> {
    try {
      const versionOutput = await this.wpCli.execute(
        serverId, 
        sitePath, 
        'core version --skip-plugins --skip-themes'
      );
      return versionOutput.trim();
    } catch (error) {
      this.logger.error('Failed to get WordPress version:', error);
      return null;
    }
  }

  private async verifyCoreChecksums(serverId: string, sitePath: string, version: string): Promise<any> {
    try {
      // Use WP-CLI to verify core files
      const command = 'core verify-checksums --skip-plugins --skip-themes';
      const result = await this.wpCli.execute(serverId, sitePath, command);
      
      const verificationResult = {
        totalFiles: 0,
        modifiedFiles: [] as string[],
        missingFiles: [] as string[],
        extraFiles: [] as string[],
        success: true
      };

      if (result.includes('Success: WordPress installation verifies against checksums.')) {
        verificationResult.success = true;
        verificationResult.totalFiles = await this.countCoreFiles(serverId, sitePath);
      } else {
        // Parse the output for specific file issues
        const lines = result.split('\n');
        
        for (const line of lines) {
          if (line.includes('Warning:') || line.includes('Error:')) {
            if (line.includes('should not exist')) {
              const file = this.extractFileFromMessage(line);
              if (file) verificationResult.extraFiles.push(file);
            } else if (line.includes('does not exist')) {
              const file = this.extractFileFromMessage(line);
              if (file) verificationResult.missingFiles.push(file);
            } else if (line.includes('checksums do not match')) {
              const file = this.extractFileFromMessage(line);
              if (file) verificationResult.modifiedFiles.push(file);
            }
          }
        }
        
        verificationResult.success = false;
      }

      return verificationResult;
    } catch (error) {
      this.logger.error('Failed to verify core checksums:', error);
      throw error;
    }
  }

  private async countCoreFiles(serverId: string, sitePath: string): Promise<number> {
    try {
      const command = `find "${sitePath}" -name "*.php" -path "*/wp-admin/*" -o -path "*/wp-includes/*" | wc -l`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);
      
      if (result.success && result.output) {
        return parseInt(result.output.trim()) || 0;
      }
      
      return 0;
    } catch (error) {
      this.logger.error('Failed to count core files:', error);
      return 0;
    }
  }

  private extractFileFromMessage(message: string): string | null {
    // Extract file path from WP-CLI warning/error messages
    const patterns = [
      /File '([^']+)'/,
      /file '([^']+)'/,
      /`([^`]+)`/,
      /"([^"]+)"/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  private async testConnection(serverId: string): Promise<boolean> {
    try {
      const result = await this.sshExecutor.executeCommandDetailed(serverId, 'echo "test"', 5000);
      return result.success && (result.output?.includes('test') ?? false);
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return false;
    }
  }
}