import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class ResponseTimeBaselineService implements IDiagnosisCheckService {
  private readonly logger = new Logger(ResponseTimeBaselineService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Checking response time baseline for site: ${domain}`);

      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const testUrl = `https://${cleanDomain}`;

      // Perform multiple response time tests
      const responseTests = await this.performResponseTimeTests(serverId, testUrl);
      
      const averageTime = responseTests.reduce((sum, test) => sum + test.responseTime, 0) / responseTests.length;
      const minTime = Math.min(...responseTests.map(test => test.responseTime));
      const maxTime = Math.max(...responseTests.map(test => test.responseTime));
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = `Average response time: ${averageTime.toFixed(0)}ms`;
      const recommendations: string[] = [];

      // Scoring based on response time thresholds
      if (averageTime > 5000) {
        status = CheckStatus.FAIL;
        score = 20;
        message = `Poor response time: ${averageTime.toFixed(0)}ms (>5s)`;
        recommendations.push('Investigate server performance issues');
        recommendations.push('Consider implementing caching solutions');
        recommendations.push('Optimize database queries');
      } else if (averageTime > 3000) {
        status = CheckStatus.WARNING;
        score = 50;
        message = `Slow response time: ${averageTime.toFixed(0)}ms (>3s)`;
        recommendations.push('Optimize page loading performance');
        recommendations.push('Consider CDN implementation');
      } else if (averageTime > 1000) {
        status = CheckStatus.WARNING;
        score = 75;
        message = `Acceptable response time: ${averageTime.toFixed(0)}ms (>1s)`;
        recommendations.push('Consider minor performance optimizations');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          domain: cleanDomain,
          testUrl,
          averageTime: Math.round(averageTime),
          minTime,
          maxTime,
          tests: responseTests,
          testCount: responseTests.length
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Response time baseline check failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Response time baseline check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.RESPONSE_TIME_BASELINE;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Response Time Baseline';
  }

  getDescription(): string {
    return 'Measures server response time and compares against performance baselines';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.RESPONSE_TIME_BASELINE;
  }

  private async performResponseTimeTests(serverId: string, url: string): Promise<any[]> {
    const tests: any[] = [];
    const testCount = 3; // Perform 3 tests for average

    try {
      for (let i = 0; i < testCount; i++) {
        const testStart = Date.now();
        
        // Use curl to measure response time
        const command = `curl -w "@-" -o /dev/null -s "${url}" <<< "time_namelookup: %{time_namelookup}\\ntime_connect: %{time_connect}\\ntime_appconnect: %{time_appconnect}\\ntime_pretransfer: %{time_pretransfer}\\ntime_redirect: %{time_redirect}\\ntime_starttransfer: %{time_starttransfer}\\ntime_total: %{time_total}\\nhttp_code: %{http_code}\\nsize_download: %{size_download}"`;
        
        const result = await this.sshExecutor.executeCommandDetailed(serverId, command);
        
        if (result.success && result.output) {
          const metrics = this.parseCurlOutput(result.output);
          const responseTime = Math.round(metrics.time_total * 1000); // Convert to milliseconds
          
          tests.push({
            testNumber: i + 1,
            responseTime,
            httpCode: metrics.http_code,
            dnsTime: Math.round(metrics.time_namelookup * 1000),
            connectTime: Math.round(metrics.time_connect * 1000),
            sslTime: Math.round((metrics.time_appconnect - metrics.time_connect) * 1000),
            transferTime: Math.round(metrics.time_starttransfer * 1000),
            totalTime: Math.round(metrics.time_total * 1000),
            downloadSize: metrics.size_download,
            timestamp: new Date()
          });
        } else {
          tests.push({
            testNumber: i + 1,
            responseTime: 0,
            error: result.error || 'Test failed',
            timestamp: new Date()
          });
        }

        // Small delay between tests
        if (i < testCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      this.logger.error('Failed to perform response time tests:', error);
    }

    return tests;
  }

  private parseCurlOutput(output: string): any {
    const metrics: any = {};
    const lines = output.trim().split('\n');
    
    for (const line of lines) {
      const [key, value] = line.split(': ');
      if (key && value) {
        const numValue = parseFloat(value);
        metrics[key] = isNaN(numValue) ? value : numValue;
      }
    }
    
    return metrics;
  }
}