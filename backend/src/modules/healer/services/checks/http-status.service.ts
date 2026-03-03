import { Injectable, Logger } from '@nestjs/common';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import axios from 'axios';

/**
 * HTTP Status Service
 * Checks if the site is accessible via HTTP/HTTPS
 */
@Injectable()
export class HttpStatusService implements IDiagnosisCheckService {
  private readonly logger = new Logger(HttpStatusService.name);

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      this.logger.log(`Checking HTTP status for ${domain}`);

      // Try HTTPS first
      let protocol = 'https';
      let statusCode = 0;
      let responseTime = 0;
      let error: string | null = null;

      try {
        const httpsStart = Date.now();
        const httpsResponse = await axios.get(`https://${domain}`, {
          timeout: 10000,
          validateStatus: () => true, // Accept any status code
          maxRedirects: 5,
        });
        responseTime = Date.now() - httpsStart;
        statusCode = httpsResponse.status;
      } catch (httpsError: any) {
        // Try HTTP fallback
        try {
          protocol = 'http';
          const httpStart = Date.now();
          const httpResponse = await axios.get(`http://${domain}`, {
            timeout: 10000,
            validateStatus: () => true,
            maxRedirects: 5,
          });
          responseTime = Date.now() - httpStart;
          statusCode = httpResponse.status;
          
          issues.push('Site not accessible via HTTPS');
          score -= 20;
          recommendations.push('Install SSL certificate');
          recommendations.push('Enable HTTPS redirect');
        } catch (httpError: any) {
          error = httpError.message;
          issues.push(`Site not accessible: ${error}`);
          score = 0;
          recommendations.push('Check if site is down');
          recommendations.push('Verify DNS configuration');
          recommendations.push('Check web server status');
        }
      }

      // Evaluate status code
      if (statusCode >= 200 && statusCode < 300) {
        // Success
      } else if (statusCode >= 300 && statusCode < 400) {
        issues.push(`Redirect detected: ${statusCode}`);
        score -= 5;
      } else if (statusCode >= 400 && statusCode < 500) {
        issues.push(`Client error: ${statusCode}`);
        score -= 30;
        recommendations.push('Check .htaccess configuration');
        recommendations.push('Verify WordPress installation');
      } else if (statusCode >= 500) {
        issues.push(`Server error: ${statusCode}`);
        score -= 50;
        recommendations.push('Check error logs');
        recommendations.push('Disable plugins to identify issue');
        recommendations.push('Check PHP errors');
      }

      // Check response time
      if (responseTime > 5000) {
        issues.push(`Very slow response: ${responseTime}ms`);
        score -= 20;
        recommendations.push('Optimize server performance');
      } else if (responseTime > 3000) {
        issues.push(`Slow response: ${responseTime}ms`);
        score -= 10;
        recommendations.push('Enable caching');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 50 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0
        ? `Site accessible via ${protocol.toUpperCase()} (${statusCode}) - ${responseTime}ms`
        : `HTTP issues detected: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: {
          protocol,
          statusCode,
          responseTime,
          accessible: statusCode > 0,
          error,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`HTTP status check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `HTTP status check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Retry check', 'Verify network connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.HTTP_STATUS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.CRITICAL;
  }

  getName(): string {
    return 'HTTP Status';
  }

  getDescription(): string {
    return 'Checks if the site is accessible via HTTP/HTTPS';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.HTTP_STATUS;
  }
}
