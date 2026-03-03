import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

@Injectable()
export class SeoHealthService implements IDiagnosisCheckService {
  private readonly logger = new Logger(SeoHealthService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

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
      // 1. Check robots.txt
      const robotsTxt = await this.checkRobotsTxt(serverId, sitePath, domain);
      if (!robotsTxt.exists) {
        issues.push('robots.txt not found');
        score -= 10;
        recommendations.push('Create robots.txt file');
      } else if (robotsTxt.blocksAll) {
        issues.push('robots.txt blocks all crawlers');
        score -= 20;
        recommendations.push('Update robots.txt to allow search engines');
      }

      // 2. Check sitemap.xml
      const sitemap = await this.checkSitemap(serverId, sitePath, domain);
      if (!sitemap.exists) {
        issues.push('sitemap.xml not found');
        score -= 15;
        recommendations.push('Generate sitemap.xml');
        recommendations.push('Install SEO plugin (Yoast, Rank Math)');
      }

      // 3. Check meta tags
      const metaTags = await this.checkMetaTags(domain);
      if (!metaTags.hasTitle) {
        issues.push('Missing page title');
        score -= 15;
        recommendations.push('Add page title meta tag');
      }
      if (!metaTags.hasDescription) {
        issues.push('Missing meta description');
        score -= 10;
        recommendations.push('Add meta description');
      }

      // 4. Check Open Graph tags
      const ogTags = await this.checkOpenGraphTags(domain);
      if (!ogTags.hasOgTags) {
        issues.push('Missing Open Graph tags');
        score -= 10;
        recommendations.push('Add Open Graph meta tags for social sharing');
      }

      // 5. Check canonical URL
      const canonical = await this.checkCanonicalUrl(domain);
      if (!canonical.hasCanonical) {
        issues.push('Missing canonical URL');
        score -= 10;
        recommendations.push('Add canonical link tag');
      }

      // 6. Check for mixed content (HTTP/HTTPS)
      const mixedContent = await this.checkMixedContent(domain);
      if (mixedContent.hasMixedContent) {
        issues.push('Mixed content detected (HTTP resources on HTTPS page)');
        score -= 15;
        recommendations.push('Update all resources to use HTTPS');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 60 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0 ? 'SEO health is good' : `SEO issues: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: { robotsTxt, sitemap, metaTags, ogTags, canonical, mixedContent, issues },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `SEO check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        recommendations: ['Retry SEO check'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async checkRobotsTxt(serverId: string, sitePath: string, domain: string): Promise<any> {
    try {
      const command = `test -f ${sitePath}/robots.txt && cat ${sitePath}/robots.txt || echo "NOT_FOUND"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      
      if (result.trim() === 'NOT_FOUND') {
        return { exists: false, blocksAll: false, content: '' };
      }

      const blocksAll = result.toLowerCase().includes('disallow: /') && 
                       result.toLowerCase().includes('user-agent: *');

      return { exists: true, blocksAll, content: result };
    } catch (error) {
      return { exists: false, blocksAll: false, content: '' };
    }
  }

  private async checkSitemap(serverId: string, sitePath: string, domain: string): Promise<any> {
    try {
      const command = `test -f ${sitePath}/sitemap.xml && echo "EXISTS" || echo "NOT_FOUND"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return { exists: result.trim() === 'EXISTS' };
    } catch (error) {
      return { exists: false };
    }
  }

  private async checkMetaTags(domain: string): Promise<any> {
    try {
      const axios = require('axios');
      let html = '';
      
      try {
        const response = await axios.get(`https://${domain}`, { timeout: 10000 });
        html = response.data;
      } catch (httpsError) {
        const response = await axios.get(`http://${domain}`, { timeout: 10000 });
        html = response.data;
      }

      return {
        hasTitle: html.includes('<title>') && !html.includes('<title></title>'),
        hasDescription: html.includes('name="description"') || html.includes('name=\'description\''),
      };
    } catch (error) {
      return { hasTitle: false, hasDescription: false };
    }
  }

  private async checkOpenGraphTags(domain: string): Promise<any> {
    try {
      const axios = require('axios');
      let html = '';
      
      try {
        const response = await axios.get(`https://${domain}`, { timeout: 10000 });
        html = response.data;
      } catch (httpsError) {
        const response = await axios.get(`http://${domain}`, { timeout: 10000 });
        html = response.data;
      }

      return {
        hasOgTags: html.includes('property="og:') || html.includes('property=\'og:'),
      };
    } catch (error) {
      return { hasOgTags: false };
    }
  }

  private async checkCanonicalUrl(domain: string): Promise<any> {
    try {
      const axios = require('axios');
      let html = '';
      
      try {
        const response = await axios.get(`https://${domain}`, { timeout: 10000 });
        html = response.data;
      } catch (httpsError) {
        const response = await axios.get(`http://${domain}`, { timeout: 10000 });
        html = response.data;
      }

      return {
        hasCanonical: html.includes('rel="canonical"') || html.includes('rel=\'canonical\''),
      };
    } catch (error) {
      return { hasCanonical: false };
    }
  }

  private async checkMixedContent(domain: string): Promise<any> {
    try {
      const axios = require('axios');
      let html = '';
      
      try {
        const response = await axios.get(`https://${domain}`, { timeout: 10000 });
        html = response.data;
      } catch (httpsError) {
        return { hasMixedContent: false }; // If HTTPS fails, no mixed content issue
      }

      return {
        hasMixedContent: html.includes('src="http://') || html.includes('src=\'http://'),
      };
    } catch (error) {
      return { hasMixedContent: false };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.SEO_HEALTH;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'SEO Health';
  }

  getDescription(): string {
    return 'Checks robots.txt, sitemap, meta tags, Open Graph, and canonical URLs';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.SEO_HEALTH;
  }
}
