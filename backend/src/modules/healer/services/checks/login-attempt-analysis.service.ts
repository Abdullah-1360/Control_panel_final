import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class LoginAttemptAnalysisService implements IDiagnosisCheckService {
  private readonly logger = new Logger(LoginAttemptAnalysisService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Analyzing login attempts for site: ${domain}`);

      // Analyze various log sources for login attempts
      const analysisResults = await this.analyzeLoginAttempts(serverId, sitePath, domain);
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'No suspicious login activity detected';
      const recommendations: string[] = [];

      const totalFailedAttempts = analysisResults.failedAttempts;
      const uniqueIPs = analysisResults.uniqueIPs;
      const suspiciousPatterns = analysisResults.suspiciousPatterns;

      if (totalFailedAttempts > 100) {
        status = CheckStatus.FAIL;
        score = 20;
        message = `High risk: ${totalFailedAttempts} failed login attempts from ${uniqueIPs} IPs`;
        recommendations.push('Implement immediate IP blocking for repeat offenders');
        recommendations.push('Enable two-factor authentication');
        recommendations.push('Consider using a security plugin with login protection');
        recommendations.push('Review and strengthen password policies');
      } else if (totalFailedAttempts > 50) {
        status = CheckStatus.WARNING;
        score = 50;
        message = `Moderate risk: ${totalFailedAttempts} failed login attempts detected`;
        recommendations.push('Monitor login attempts more closely');
        recommendations.push('Consider implementing rate limiting');
        recommendations.push('Review user account security');
      } else if (totalFailedAttempts > 10) {
        status = CheckStatus.WARNING;
        score = 75;
        message = `Low risk: ${totalFailedAttempts} failed login attempts detected`;
        recommendations.push('Continue monitoring login activity');
      }

      if (suspiciousPatterns.length > 0) {
        status = CheckStatus.FAIL;
        score = Math.min(score, 30);
        recommendations.push('Investigate suspicious login patterns immediately');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          totalFailedAttempts,
          uniqueIPs,
          suspiciousPatterns,
          topAttackingIPs: analysisResults.topIPs,
          timeRange: analysisResults.timeRange,
          logSources: analysisResults.logSources
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Login attempt analysis failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Login attempt analysis failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.LOGIN_ATTEMPT_ANALYSIS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Login Attempt Analysis';
  }

  getDescription(): string {
    return 'Analyzes login attempts to detect brute force attacks and suspicious activity';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.LOGIN_ATTEMPT_ANALYSIS;
  }

  private async analyzeLoginAttempts(serverId: string, sitePath: string, domain: string): Promise<any> {
    const results = {
      failedAttempts: 0,
      uniqueIPs: 0,
      suspiciousPatterns: [] as string[],
      topIPs: [] as any[],
      timeRange: '24 hours',
      logSources: [] as string[]
    };

    try {
      // Check Apache/Nginx access logs for wp-login.php attempts
      const webLogResults = await this.analyzeWebServerLogs(serverId, domain);
      results.failedAttempts += webLogResults.failedAttempts;
      results.logSources.push('web_server_logs');

      // Check WordPress debug logs for authentication failures
      const wpLogResults = await this.analyzeWordPressLogs(serverId, sitePath);
      results.failedAttempts += wpLogResults.failedAttempts;
      if (wpLogResults.found) {
        results.logSources.push('wordpress_debug_log');
      }

      // Check system auth logs
      const authLogResults = await this.analyzeAuthLogs(serverId);
      if (authLogResults.found) {
        results.logSources.push('system_auth_log');
      }

      // Analyze IP patterns and detect suspicious activity
      const allIPs = [...webLogResults.ips, ...wpLogResults.ips, ...authLogResults.ips];
      const ipCounts = this.countIPOccurrences(allIPs);
      
      results.uniqueIPs = Object.keys(ipCounts).length;
      results.topIPs = Object.entries(ipCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, attempts: count }));

      // Detect suspicious patterns
      results.suspiciousPatterns = this.detectSuspiciousPatterns(results.topIPs, results.failedAttempts);

      return results;
    } catch (error) {
      this.logger.error('Failed to analyze login attempts:', error);
      throw error;
    }
  }

  private async analyzeWebServerLogs(serverId: string, domain: string): Promise<any> {
    try {
      // Look for wp-login.php POST requests with 4xx responses (failed logins)
      const command = `grep -h "wp-login.php" /var/log/apache2/access.log /var/log/nginx/access.log /var/log/httpd/access_log 2>/dev/null | grep -E "(POST|GET)" | grep -E " (4[0-9]{2}|302) " | tail -1000`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      const ips: string[] = [];
      let failedAttempts = 0;

      if (result.success && result.output) {
        const lines = result.output.trim().split('\n').filter(line => line.trim());
        failedAttempts = lines.length;

        // Extract IP addresses
        for (const line of lines) {
          const ipMatch = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
          if (ipMatch) {
            ips.push(ipMatch[1]);
          }
        }
      }

      return { failedAttempts, ips };
    } catch (error) {
      this.logger.error('Failed to analyze web server logs:', error);
      return { failedAttempts: 0, ips: [] };
    }
  }

  private async analyzeWordPressLogs(serverId: string, sitePath: string): Promise<any> {
    try {
      // Check WordPress debug log for authentication failures
      const logPaths = [
        `${sitePath}/wp-content/debug.log`,
        `${sitePath}/debug.log`,
        `${sitePath}/wp-content/uploads/debug.log`
      ];

      let failedAttempts = 0;
      const ips: string[] = [];
      let found = false;

      for (const logPath of logPaths) {
        const command = `grep -i "authentication" "${logPath}" 2>/dev/null | grep -i "fail" | tail -500`;
        const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

        if (result.success && result.output) {
          found = true;
          const lines = result.output.trim().split('\n').filter(line => line.trim());
          failedAttempts += lines.length;

          // Try to extract IP addresses from log entries
          for (const line of lines) {
            const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              ips.push(ipMatch[1]);
            }
          }
        }
      }

      return { failedAttempts, ips, found };
    } catch (error) {
      this.logger.error('Failed to analyze WordPress logs:', error);
      return { failedAttempts: 0, ips: [], found: false };
    }
  }

  private async analyzeAuthLogs(serverId: string): Promise<any> {
    try {
      // Check system authentication logs for SSH/FTP brute force attempts
      const command = `grep -h "authentication failure\\|Failed password\\|Invalid user" /var/log/auth.log /var/log/secure 2>/dev/null | tail -200`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      const ips: string[] = [];
      let found = false;

      if (result.success && result.output) {
        found = true;
        const lines = result.output.trim().split('\n').filter(line => line.trim());

        // Extract IP addresses from auth log entries
        for (const line of lines) {
          const ipMatch = line.match(/from (\d+\.\d+\.\d+\.\d+)/);
          if (ipMatch) {
            ips.push(ipMatch[1]);
          }
        }
      }

      return { ips, found };
    } catch (error) {
      this.logger.error('Failed to analyze auth logs:', error);
      return { ips: [], found: false };
    }
  }

  private countIPOccurrences(ips: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const ip of ips) {
      counts[ip] = (counts[ip] || 0) + 1;
    }
    
    return counts;
  }

  private detectSuspiciousPatterns(topIPs: any[], totalAttempts: number): string[] {
    const patterns: string[] = [];

    // Check for single IP with many attempts (brute force)
    for (const ipData of topIPs) {
      if (ipData.attempts > 50) {
        patterns.push(`Brute force attack from ${ipData.ip} (${ipData.attempts} attempts)`);
      }
    }

    // Check for distributed attack (many IPs with moderate attempts)
    const moderateAttackers = topIPs.filter(ip => ip.attempts >= 10 && ip.attempts <= 50);
    if (moderateAttackers.length > 10) {
      patterns.push(`Distributed attack detected (${moderateAttackers.length} IPs with 10+ attempts each)`);
    }

    // Check for rapid attack pattern
    if (totalAttempts > 100 && topIPs.length > 20) {
      patterns.push('High-volume distributed attack pattern detected');
    }

    return patterns;
  }
}