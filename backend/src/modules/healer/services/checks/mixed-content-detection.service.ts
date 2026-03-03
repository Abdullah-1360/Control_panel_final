import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class MixedContentDetectionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(MixedContentDetectionService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Checking for mixed content on site: ${domain}`);

      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const httpsUrl = `https://${cleanDomain}`;

      // Check for mixed content by analyzing the page source
      const mixedContentIssues = await this.scanForMixedContent(serverId, httpsUrl);
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'No mixed content detected';
      const recommendations: string[] = [];

      if (mixedContentIssues.length > 0) {
        const criticalIssues = mixedContentIssues.filter(issue => issue.type === 'script' || issue.type === 'iframe');
        
        if (criticalIssues.length > 0) {
          status = CheckStatus.FAIL;
          score = 30;
          message = `${criticalIssues.length} critical mixed content issues found`;
          recommendations.push('Fix critical mixed content (scripts, iframes) immediately');
        } else {
          status = CheckStatus.WARNING;
          score = 70;
          message = `${mixedContentIssues.length} mixed content issues found`;
          recommendations.push('Update HTTP resources to HTTPS');
        }
        
        recommendations.push('Use browser developer tools to identify all mixed content');
        recommendations.push('Consider implementing Content Security Policy (CSP)');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          domain: cleanDomain,
          httpsUrl,
          mixedContentIssues,
          totalIssues: mixedContentIssues.length,
          criticalIssues: mixedContentIssues.filter(issue => issue.type === 'script' || issue.type === 'iframe').length
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Mixed content detection failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Mixed content detection failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.MIXED_CONTENT_DETECTION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Mixed Content Detection';
  }

  getDescription(): string {
    return 'Detects HTTP resources loaded on HTTPS pages that cause mixed content warnings';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.MIXED_CONTENT_DETECTION;
  }

  private async scanForMixedContent(serverId: string, httpsUrl: string): Promise<any[]> {
    try {
      // Use curl to fetch the page and analyze for mixed content
      const command = `curl -s -L "${httpsUrl}" | grep -i -E 'src="http:|href="http:|action="http:' | head -20`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      const mixedContentIssues: any[] = [];

      if (result.success && result.output) {
        const lines = result.output.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          const httpMatches = line.match(/(?:src|href|action)="(http:[^"]+)"/gi);
          
          if (httpMatches) {
            for (const match of httpMatches) {
              const url = match.replace(/^(?:src|href|action)="/i, '').replace(/"$/, '');
              const type = this.determineResourceType(line, url);
              
              mixedContentIssues.push({
                url,
                type,
                line: line.trim(),
                severity: type === 'script' || type === 'iframe' ? 'critical' : 'warning'
              });
            }
          }
        }
      }

      return mixedContentIssues;
    } catch (error) {
      this.logger.error('Failed to scan for mixed content:', error);
      return [];
    }
  }

  private determineResourceType(line: string, url: string): string {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('<script') || lowerLine.includes('src=') && url.endsWith('.js')) {
      return 'script';
    } else if (lowerLine.includes('<iframe')) {
      return 'iframe';
    } else if (lowerLine.includes('<img') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      return 'image';
    } else if (lowerLine.includes('<link') || url.endsWith('.css')) {
      return 'stylesheet';
    } else if (lowerLine.includes('<form')) {
      return 'form';
    } else {
      return 'other';
    }
  }
}