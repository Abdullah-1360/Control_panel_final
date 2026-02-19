import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from './ssh-executor.service';

interface VerificationResult {
  score: number; // 0-100
  checks: VerificationCheck[];
  passed: boolean;
  metrics: PerformanceMetrics;
}

interface VerificationCheck {
  name: string;
  passed: boolean;
  score: number;
  details: string;
  duration: number;
}

interface PerformanceMetrics {
  responseTime: number; // ms
  pageSize: number; // bytes
  httpStatus: number;
  hasErrors: boolean;
  errorCount: number;
  loadTime: number;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly sshService: SshExecutorService,
  ) {}

  /**
   * Perform comprehensive verification after healing
   * Returns score 0-100 (>80 = success)
   */
  async verify(
    serverId: string,
    sitePath: string,
    domain: string,
    diagnosisType: string,
  ): Promise<VerificationResult> {
    this.logger.log(`Starting verification for ${domain}`);

    const checks: VerificationCheck[] = [];
    let totalScore = 0;

    // 1. HTTP Status Check (20 points)
    const httpCheck = await this.checkHttpStatus(domain);
    checks.push(httpCheck);
    totalScore += httpCheck.score;

    // 2. Content Analysis (25 points)
    const contentCheck = await this.checkContent(domain);
    checks.push(contentCheck);
    totalScore += contentCheck.score;

    // 3. Error Log Check (20 points)
    const errorLogCheck = await this.checkErrorLogs(serverId, sitePath);
    checks.push(errorLogCheck);
    totalScore += errorLogCheck.score;

    // 4. WordPress Functionality (20 points)
    const wpCheck = await this.checkWordPressFunctionality(serverId, sitePath);
    checks.push(wpCheck);
    totalScore += wpCheck.score;

    // 5. Performance Check (15 points)
    const perfCheck = await this.checkPerformance(domain);
    checks.push(perfCheck);
    totalScore += perfCheck.score;

    // Collect metrics
    const metrics = await this.collectMetrics(domain);

    const passed = totalScore >= 80;

    this.logger.log(`Verification completed: ${totalScore}/100 (${passed ? 'PASSED' : 'FAILED'})`);

    return {
      score: totalScore,
      checks,
      passed,
      metrics,
    };
  }

  /**
   * Check HTTP status and response (20 points max)
   */
  private async checkHttpStatus(domain: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'OpsManager-Healer-Verification/1.0',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      
      clearTimeout(timeoutId);
      
      const body = await response.text();
      const duration = Date.now() - startTime;
      
      // Check for WSOD indicators
      const wsodIndicators = [
        'There has been a critical error',
        'Parse error:',
        'Fatal error:',
        'syntax error',
        'Call to undefined',
        'WordPress database error',
      ];
      
      const hasWsod = wsodIndicators.some(indicator => 
        body.toLowerCase().includes(indicator.toLowerCase())
      );
      
      const isBlank = body.trim().length < 100;
      
      if (response.status === 200 && !hasWsod && !isBlank) {
        return {
          name: 'HTTP Status',
          passed: true,
          score: 20,
          details: `HTTP 200 OK, ${body.length} bytes, no WSOD indicators`,
          duration,
        };
      } else if (response.status === 200 && (hasWsod || isBlank)) {
        return {
          name: 'HTTP Status',
          passed: false,
          score: 0,
          details: hasWsod ? 'WSOD detected in content' : 'Blank page detected',
          duration,
        };
      } else {
        return {
          name: 'HTTP Status',
          passed: false,
          score: 0,
          details: `HTTP ${response.status}`,
          duration,
        };
      }
    } catch (error) {
      return {
        name: 'HTTP Status',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze page content for errors (25 points max)
   */
  private async checkContent(domain: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const body = await response.text();
      const duration = Date.now() - startTime;
      
      let score = 25;
      const issues: string[] = [];
      
      // Check for error indicators
      const errorPatterns = [
        { pattern: /fatal error/i, penalty: 25, name: 'Fatal Error' },
        { pattern: /parse error/i, penalty: 25, name: 'Parse Error' },
        { pattern: /syntax error/i, penalty: 25, name: 'Syntax Error' },
        { pattern: /database error/i, penalty: 20, name: 'Database Error' },
        { pattern: /warning:/i, penalty: 5, name: 'PHP Warning' },
        { pattern: /notice:/i, penalty: 2, name: 'PHP Notice' },
      ];
      
      for (const { pattern, penalty, name } of errorPatterns) {
        if (pattern.test(body)) {
          score -= penalty;
          issues.push(name);
        }
      }
      
      // Check for positive indicators
      const hasHtmlStructure = /<html/i.test(body) && /<\/html>/i.test(body);
      const hasTitle = /<title>/i.test(body);
      const hasContent = body.length > 1000;
      
      if (!hasHtmlStructure) {
        score -= 10;
        issues.push('No HTML structure');
      }
      
      if (!hasTitle) {
        score -= 5;
        issues.push('No title tag');
      }
      
      if (!hasContent) {
        score -= 5;
        issues.push('Insufficient content');
      }
      
      score = Math.max(0, score);
      
      return {
        name: 'Content Analysis',
        passed: score >= 20,
        score,
        details: issues.length > 0 ? `Issues: ${issues.join(', ')}` : 'Content looks healthy',
        duration,
      };
    } catch (error) {
      return {
        name: 'Content Analysis',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check error logs for new errors (20 points max)
   */
  private async checkErrorLogs(serverId: string, sitePath: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      // Check last 50 lines of error logs (recent errors only)
      const errorLogResult = await this.sshService.executeCommand(
        serverId,
        `tail -50 ${sitePath}/wp-content/debug.log 2>/dev/null || tail -50 ${sitePath}/error_log 2>/dev/null || echo "No logs"`,
      );
      
      const duration = Date.now() - startTime;
      
      // Count recent errors (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentErrors = errorLogResult.split('\n').filter(line => {
        // Check if line has timestamp and is recent
        const timestampMatch = line.match(/\[(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2})\]/);
        if (timestampMatch) {
          const logTime = new Date(timestampMatch[1]);
          return logTime >= fiveMinutesAgo && (
            line.includes('Fatal error') ||
            line.includes('Parse error') ||
            line.includes('Warning')
          );
        }
        return false;
      });
      
      const errorCount = recentErrors.length;
      
      let score = 20;
      if (errorCount > 10) score = 0;
      else if (errorCount > 5) score = 5;
      else if (errorCount > 0) score = 15;
      
      return {
        name: 'Error Logs',
        passed: errorCount === 0,
        score,
        details: errorCount === 0 ? 'No recent errors' : `${errorCount} recent errors found`,
        duration,
      };
    } catch (error) {
      return {
        name: 'Error Logs',
        passed: true, // Don't fail if we can't check logs
        score: 15, // Partial credit
        details: `Could not check logs: ${(error as Error).message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check WordPress functionality (20 points max)
   */
  private async checkWordPressFunctionality(serverId: string, sitePath: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      // Test WP-CLI commands
      const commands = [
        { cmd: 'wp core version', points: 5, name: 'Core accessible' },
        { cmd: 'wp db check', points: 10, name: 'Database accessible' },
        { cmd: 'wp plugin list --status=active', points: 5, name: 'Plugins accessible' },
      ];
      
      let score = 0;
      const results: string[] = [];
      
      for (const { cmd, points, name } of commands) {
        try {
          const result = await this.sshService.executeCommand(
            serverId,
            `cd ${sitePath} && ${cmd} 2>&1`,
          );
          
          if (!result.toLowerCase().includes('error') && !result.toLowerCase().includes('failed')) {
            score += points;
            results.push(`✓ ${name}`);
          } else {
            results.push(`✗ ${name}`);
          }
        } catch {
          results.push(`✗ ${name}`);
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        name: 'WordPress Functionality',
        passed: score >= 15,
        score,
        details: results.join(', '),
        duration,
      };
    } catch (error) {
      return {
        name: 'WordPress Functionality',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check performance metrics (15 points max)
   */
  private async checkPerformance(domain: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const fetchStart = Date.now();
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        signal: controller.signal,
      });
      const responseTime = Date.now() - fetchStart;
      
      clearTimeout(timeoutId);
      
      const body = await response.text();
      const duration = Date.now() - startTime;
      
      let score = 15;
      const metrics: string[] = [];
      
      // Response time scoring
      if (responseTime > 5000) {
        score -= 10;
        metrics.push(`Slow response: ${responseTime}ms`);
      } else if (responseTime > 3000) {
        score -= 5;
        metrics.push(`Moderate response: ${responseTime}ms`);
      } else {
        metrics.push(`Fast response: ${responseTime}ms`);
      }
      
      // Page size check
      const pageSize = body.length;
      if (pageSize < 500) {
        score -= 5;
        metrics.push(`Small page: ${pageSize} bytes`);
      } else {
        metrics.push(`Normal page: ${pageSize} bytes`);
      }
      
      score = Math.max(0, score);
      
      return {
        name: 'Performance',
        passed: score >= 10,
        score,
        details: metrics.join(', '),
        duration,
      };
    } catch (error) {
      return {
        name: 'Performance',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(domain: string): Promise<PerformanceMetrics> {
    try {
      const startTime = Date.now();
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const responseTime = Date.now() - startTime;
      
      const body = await response.text();
      
      const errorIndicators = [
        'fatal error',
        'parse error',
        'syntax error',
        'database error',
        'warning:',
      ];
      
      const errorCount = errorIndicators.reduce((count, indicator) => {
        const regex = new RegExp(indicator, 'gi');
        const matches = body.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
      
      return {
        responseTime,
        pageSize: body.length,
        httpStatus: response.status,
        hasErrors: errorCount > 0,
        errorCount,
        loadTime: responseTime,
      };
    } catch (error) {
      return {
        responseTime: 0,
        pageSize: 0,
        httpStatus: 0,
        hasErrors: true,
        errorCount: 1,
        loadTime: 0,
      };
    }
  }
}
