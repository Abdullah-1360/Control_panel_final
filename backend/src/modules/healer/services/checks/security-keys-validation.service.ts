import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class SecurityKeysValidationService implements IDiagnosisCheckService {
  private readonly logger = new Logger(SecurityKeysValidationService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Validating WordPress security keys for site: ${domain}`);

      const wpConfigPath = `${sitePath}/wp-config.php`;
      const securityAnalysis = await this.analyzeSecurityKeys(serverId, wpConfigPath);
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'All security keys and salts are properly configured';
      const recommendations: string[] = [];

      const issues = securityAnalysis.issues;
      const criticalIssues = issues.filter((issue: any) => issue.severity === 'critical');
      const warningIssues = issues.filter((issue: any) => issue.severity === 'warning');

      if (criticalIssues.length > 0) {
        status = CheckStatus.FAIL;
        score = 20;
        message = `Critical security issues: ${criticalIssues.length} keys missing or weak`;
        recommendations.push('Generate new security keys immediately');
        recommendations.push('Use WordPress.org secret key generator');
        recommendations.push('Update wp-config.php with new keys');
      } else if (warningIssues.length > 0) {
        status = CheckStatus.WARNING;
        score = 60;
        message = `Security warnings: ${warningIssues.length} keys need attention`;
        recommendations.push('Consider regenerating old or weak keys');
        recommendations.push('Ensure all keys are unique and complex');
      }

      if (securityAnalysis.keysAge > 365) {
        status = CheckStatus.WARNING;
        score = Math.min(score, 70);
        recommendations.push('Security keys are over 1 year old - consider rotation');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          totalKeys: securityAnalysis.totalKeys,
          validKeys: securityAnalysis.validKeys,
          missingKeys: securityAnalysis.missingKeys,
          weakKeys: securityAnalysis.weakKeys,
          duplicateKeys: securityAnalysis.duplicateKeys,
          keysAge: securityAnalysis.keysAge,
          issues: issues,
          keyAnalysis: securityAnalysis.keyDetails
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Security keys validation failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Security keys validation failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.SECURITY_KEYS_VALIDATION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'WordPress Security Keys Validation';
  }

  getDescription(): string {
    return 'Validates WordPress security keys and salts for proper configuration and strength';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.SECURITY_KEYS_VALIDATION;
  }

  private async analyzeSecurityKeys(serverId: string, wpConfigPath: string): Promise<any> {
    try {
      // Try multiple methods to read wp-config.php
      let wpConfigContent: string | null = null;

      // Method 1: Direct cat command
      try {
        const command = `cat "${wpConfigPath}"`;
        const result = await this.sshExecutor.executeCommandDetailed(serverId, command);
        if (result.success && result.output) {
          wpConfigContent = result.output;
        }
      } catch (error) {
        this.logger.warn('Direct cat command failed, trying alternative method');
      }

      // Method 2: Try with sudo if first method failed
      if (!wpConfigContent) {
        try {
          const command = `sudo cat "${wpConfigPath}" 2>/dev/null || cat "${wpConfigPath}"`;
          const result = await this.sshExecutor.executeCommandDetailed(serverId, command);
          if (result.success && result.output) {
            wpConfigContent = result.output;
          }
        } catch (error) {
          this.logger.warn('Sudo cat command also failed');
        }
      }

      // Method 3: Check if file exists and is readable
      if (!wpConfigContent) {
        const testCommand = `test -r "${wpConfigPath}" && echo "readable" || echo "not readable"`;
        const testResult = await this.sshExecutor.executeCommandDetailed(serverId, testCommand);
        
        if (testResult.output?.includes('not readable')) {
          throw new Error('wp-config.php exists but is not readable (permission denied)');
        } else {
          throw new Error('Unable to read wp-config.php file');
        }
      }
      
      // Define required security keys and salts
      const requiredKeys = [
        'AUTH_KEY',
        'SECURE_AUTH_KEY',
        'LOGGED_IN_KEY',
        'NONCE_KEY',
        'AUTH_SALT',
        'SECURE_AUTH_SALT',
        'LOGGED_IN_SALT',
        'NONCE_SALT'
      ];

      const keyAnalysis = {
        totalKeys: requiredKeys.length,
        validKeys: 0,
        missingKeys: [] as string[],
        weakKeys: [] as string[],
        duplicateKeys: [] as string[],
        keysAge: 0,
        keyDetails: {} as any,
        issues: [] as any[]
      };

      const foundKeys: Record<string, string> = {};
      const keyValues: string[] = [];

      // Extract security keys from wp-config.php
      for (const keyName of requiredKeys) {
        const keyPattern = new RegExp(`define\\s*\\(\\s*['"]${keyName}['"]\\s*,\\s*['"]([^'"]+)['"]\\s*\\)`, 'i');
        const match = wpConfigContent.match(keyPattern);

        if (match && match[1]) {
          const keyValue = match[1];
          foundKeys[keyName] = keyValue;
          keyValues.push(keyValue);

          // Analyze key strength
          const keyStrength = this.analyzeKeyStrength(keyValue);
          keyAnalysis.keyDetails[keyName] = {
            value: keyValue.substring(0, 10) + '...', // Show only first 10 chars for security
            length: keyValue.length,
            strength: keyStrength.strength,
            entropy: keyStrength.entropy,
            hasSpecialChars: keyStrength.hasSpecialChars,
            isDefault: this.isDefaultKey(keyValue)
          };

          if (keyStrength.strength === 'strong') {
            keyAnalysis.validKeys++;
          } else {
            keyAnalysis.weakKeys.push(keyName);
            keyAnalysis.issues.push({
              type: 'weak_key',
              severity: keyStrength.strength === 'weak' ? 'critical' : 'warning',
              key: keyName,
              message: `${keyName} has ${keyStrength.strength} strength`
            });
          }

          if (this.isDefaultKey(keyValue)) {
            keyAnalysis.issues.push({
              type: 'default_key',
              severity: 'critical',
              key: keyName,
              message: `${keyName} is using default/example value`
            });
          }
        } else {
          keyAnalysis.missingKeys.push(keyName);
          keyAnalysis.issues.push({
            type: 'missing_key',
            severity: 'critical',
            key: keyName,
            message: `${keyName} is not defined`
          });
        }
      }

      // Check for duplicate keys
      const duplicates = this.findDuplicateValues(keyValues);
      if (duplicates.length > 0) {
        keyAnalysis.duplicateKeys = duplicates;
        keyAnalysis.issues.push({
          type: 'duplicate_keys',
          severity: 'critical',
          message: `Duplicate key values found: ${duplicates.join(', ')}`
        });
      }

      // Estimate keys age (this is approximate based on file modification time)
      keyAnalysis.keysAge = await this.estimateKeysAge(serverId, wpConfigPath);

      return keyAnalysis;
    } catch (error) {
      this.logger.error('Failed to analyze security keys:', error);
      throw error;
    }
  }

  private analyzeKeyStrength(key: string): any {
    const analysis = {
      strength: 'weak',
      entropy: 0,
      hasSpecialChars: false,
      hasNumbers: false,
      hasUppercase: false,
      hasLowercase: false
    };

    // Check character types
    analysis.hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(key);
    analysis.hasNumbers = /\d/.test(key);
    analysis.hasUppercase = /[A-Z]/.test(key);
    analysis.hasLowercase = /[a-z]/.test(key);

    // Calculate entropy (simplified)
    const uniqueChars = new Set(key).size;
    analysis.entropy = Math.log2(Math.pow(uniqueChars, key.length));

    // Determine strength
    if (key.length >= 64 && analysis.hasSpecialChars && analysis.hasNumbers && 
        analysis.hasUppercase && analysis.hasLowercase && analysis.entropy > 200) {
      analysis.strength = 'strong';
    } else if (key.length >= 32 && uniqueChars >= 10 && analysis.entropy > 100) {
      analysis.strength = 'medium';
    } else {
      analysis.strength = 'weak';
    }

    return analysis;
  }

  private isDefaultKey(key: string): boolean {
    const defaultKeys = [
      'put your unique phrase here',
      'your-secret-key-here',
      'change-me',
      'replace-this',
      'unique phrase',
      'secret key'
    ];

    const lowerKey = key.toLowerCase();
    return defaultKeys.some(defaultKey => lowerKey.includes(defaultKey)) || key.length < 20;
  }

  private findDuplicateValues(values: string[]): string[] {
    const seen = new Set();
    const duplicates = new Set();

    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
      } else {
        seen.add(value);
      }
    }

    return Array.from(duplicates) as string[];
  }

  private async estimateKeysAge(serverId: string, wpConfigPath: string): Promise<number> {
    try {
      const command = `stat -c %Y "${wpConfigPath}"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output) {
        const modificationTime = parseInt(result.output.trim()) * 1000;
        const now = Date.now();
        const ageInDays = Math.floor((now - modificationTime) / (1000 * 60 * 60 * 24));
        return ageInDays;
      }

      return 0;
    } catch (error) {
      this.logger.error('Failed to estimate keys age:', error);
      return 0;
    }
  }
}