import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

interface DbConfig {
  host: string;
  name: string;
  user: string;
  password: string;
  prefix: string;
}

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
      // Extract database credentials from wp-config.php
      const dbConfig = await this.parseWpConfig(serverId, sitePath);
      
      if (!dbConfig) {
        return {
          checkType: this.getCheckType(),
          status: CheckStatus.ERROR,
          score: 0,
          message: 'Failed to parse wp-config.php',
          details: { error: 'Could not extract database credentials' },
          recommendations: ['Verify wp-config.php exists and is readable'],
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // 1. Check Global SEO Blockers (wp_options)
      const globalBlockers = await this.checkGlobalSeoBlockers(serverId, dbConfig);
      
      if (globalBlockers.searchEnginesBlocked) {
        issues.push('Site is blocking search engines (NoIndex enabled)');
        score -= 40; // Critical issue
        recommendations.push('Go to Settings → Reading and uncheck "Discourage search engines from indexing this site"');
      }
      
      if (globalBlockers.badPermalinks) {
        issues.push('Using plain permalinks (bad for SEO)');
        score -= 15;
        recommendations.push('Go to Settings → Permalinks and choose "Post name" structure');
      }

      // 2. Detect Active SEO Plugins
      const seoPlugins = await this.detectSeoPlugins(serverId, dbConfig);
      
      if (!seoPlugins.hasYoast && !seoPlugins.hasRankMath) {
        issues.push('No SEO plugin detected');
        score -= 20;
        recommendations.push('Install Yoast SEO or Rank Math plugin');
      }

      // 3. Yoast SEO Specific Audits
      let yoastIssues: any = null;
      if (seoPlugins.hasYoast) {
        yoastIssues = await this.auditYoastSeo(serverId, dbConfig);
        
        if (yoastIssues.missingMetaDescriptions.length > 0) {
          issues.push(`${yoastIssues.missingMetaDescriptions.length} pages missing meta descriptions (Yoast)`);
          score -= Math.min(15, yoastIssues.missingMetaDescriptions.length * 2);
          recommendations.push('Add meta descriptions to all published pages/posts');
        }
        
        if (yoastIssues.noindexPages.length > 0) {
          issues.push(`${yoastIssues.noindexPages.length} pages accidentally set to NoIndex (Yoast)`);
          score -= Math.min(20, yoastIssues.noindexPages.length * 3);
          recommendations.push('Review pages set to NoIndex and enable indexing if needed');
        }
      }

      // 4. Rank Math SEO Specific Audits
      let rankMathIssues: any = null;
      if (seoPlugins.hasRankMath) {
        rankMathIssues = await this.auditRankMathSeo(serverId, dbConfig);
        
        if (rankMathIssues.missingMetaDescriptions.length > 0) {
          issues.push(`${rankMathIssues.missingMetaDescriptions.length} pages missing meta descriptions (Rank Math)`);
          score -= Math.min(15, rankMathIssues.missingMetaDescriptions.length * 2);
          recommendations.push('Add meta descriptions to all published pages/posts');
        }
        
        if (rankMathIssues.noindexPages.length > 0) {
          issues.push(`${rankMathIssues.noindexPages.length} pages accidentally set to NoIndex (Rank Math)`);
          score -= Math.min(20, rankMathIssues.noindexPages.length * 3);
          recommendations.push('Review pages set to NoIndex and enable indexing if needed');
        }
      }

      // 5. Check robots.txt (file-based check)
      const robotsTxt = await this.checkRobotsTxt(serverId, sitePath);
      if (!robotsTxt.exists) {
        issues.push('robots.txt not found');
        score -= 5;
        recommendations.push('Create robots.txt file (SEO plugin can generate this)');
      } else if (robotsTxt.blocksAll) {
        issues.push('robots.txt blocks all crawlers');
        score -= 20;
        recommendations.push('Update robots.txt to allow search engines');
      }

      // 6. Check sitemap.xml (file-based check)
      const sitemap = await this.checkSitemap(serverId, sitePath);
      if (!sitemap.exists) {
        issues.push('sitemap.xml not found');
        score -= 10;
        recommendations.push('Enable XML sitemap in SEO plugin settings');
      }

      const status = score >= 80 ? CheckStatus.PASS : score >= 60 ? CheckStatus.WARNING : CheckStatus.FAIL;
      const message = issues.length === 0 
        ? 'SEO health is excellent' 
        : `${issues.length} SEO issue(s) detected`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: { 
          globalBlockers,
          seoPlugins,
          yoastIssues,
          rankMathIssues,
          robotsTxt,
          sitemap,
          issues 
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('SEO check failed:', error);
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `SEO check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        recommendations: ['Retry SEO check', 'Verify database connection'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Parse wp-config.php to extract database credentials and table prefix
   */
  private async parseWpConfig(serverId: string, sitePath: string): Promise<DbConfig | null> {
    try {
      const wpConfigPath = `${sitePath}/wp-config.php`;
      const command = `cat "${wpConfigPath}"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (!result.success || !result.output) {
        this.logger.error('Failed to read wp-config.php');
        return null;
      }

      const content = result.output;
      
      const dbName = this.extractDefine(content, 'DB_NAME');
      const dbUser = this.extractDefine(content, 'DB_USER');
      const dbPassword = this.extractDefine(content, 'DB_PASSWORD');
      const dbHost = this.extractDefine(content, 'DB_HOST') || 'localhost';
      const prefix = this.extractTablePrefix(content) || 'wp_';

      if (!dbName || !dbUser) {
        this.logger.error('Could not extract required database credentials');
        return null;
      }

      return { host: dbHost, name: dbName, user: dbUser, password: dbPassword || '', prefix };
    } catch (error) {
      this.logger.error('Failed to parse wp-config.php:', error);
      return null;
    }
  }

  private extractDefine(content: string, constant: string): string | null {
    const patterns = [
      new RegExp(`define\\s*\\(\\s*['"]${constant}['"]\\s*,\\s*['"]([^'"]+)['"]\\s*\\)`, 'i'),
      new RegExp(`define\\s*\\(\\s*"${constant}"\\s*,\\s*"([^"]+)"\\s*\\)`, 'i'),
      new RegExp(`define\\s*\\(\\s*'${constant}'\\s*,\\s*'([^']+)'\\s*\\)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  private extractTablePrefix(content: string): string | null {
    const patterns = [
      /\$table_prefix\s*=\s*['"]([^'"]+)['"]/,
      /\$table_prefix\s*=\s*"([^"]+)"/,
      /\$table_prefix\s*=\s*'([^']+)'/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  /**
   * Check global SEO blockers in wp_options
   */
  private async checkGlobalSeoBlockers(serverId: string, dbConfig: DbConfig): Promise<{
    searchEnginesBlocked: boolean;
    badPermalinks: boolean;
    permalinkStructure: string;
  }> {
    try {
      const escapedPassword = dbConfig.password.replace(/'/g, "'\\''");
      
      // Check if site is blocking search engines (blog_public = 0)
      const blockQuery = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT option_value FROM ${dbConfig.prefix}options WHERE option_name = 'blog_public';" 2>&1`;
      const blockResult = await this.sshExecutor.executeCommandDetailed(serverId, blockQuery, 10000);
      
      const blogPublic = this.extractQueryValue(blockResult.output || '');
      const searchEnginesBlocked = blogPublic === '0';
      
      // Check permalink structure
      const permalinkQuery = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT option_value FROM ${dbConfig.prefix}options WHERE option_name = 'permalink_structure';" 2>&1`;
      const permalinkResult = await this.sshExecutor.executeCommandDetailed(serverId, permalinkQuery, 10000);
      
      const permalinkStructure = this.extractQueryValue(permalinkResult.output || '');
      const badPermalinks = !permalinkStructure || permalinkStructure.trim() === '';
      
      return {
        searchEnginesBlocked,
        badPermalinks,
        permalinkStructure: permalinkStructure || 'plain (bad)',
      };
    } catch (error) {
      this.logger.error('Failed to check global SEO blockers:', error);
      return {
        searchEnginesBlocked: false,
        badPermalinks: false,
        permalinkStructure: 'unknown',
      };
    }
  }

  /**
   * Detect active SEO plugins (Yoast or Rank Math)
   */
  private async detectSeoPlugins(serverId: string, dbConfig: DbConfig): Promise<{
    hasYoast: boolean;
    hasRankMath: boolean;
    activePlugins: string;
  }> {
    try {
      const escapedPassword = dbConfig.password.replace(/'/g, "'\\''");
      
      const query = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT option_value FROM ${dbConfig.prefix}options WHERE option_name = 'active_plugins';" 2>&1`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, query, 10000);
      
      const serializedPlugins = this.extractQueryValue(result.output || '');
      
      // Check for Yoast SEO (wordpress-seo)
      const hasYoast = serializedPlugins.includes('wordpress-seo');
      
      // Check for Rank Math (seo-by-rank-math)
      const hasRankMath = serializedPlugins.includes('seo-by-rank-math');
      
      return {
        hasYoast,
        hasRankMath,
        activePlugins: serializedPlugins,
      };
    } catch (error) {
      this.logger.error('Failed to detect SEO plugins:', error);
      return {
        hasYoast: false,
        hasRankMath: false,
        activePlugins: '',
      };
    }
  }

  /**
   * Audit Yoast SEO specific issues
   */
  private async auditYoastSeo(serverId: string, dbConfig: DbConfig): Promise<{
    missingMetaDescriptions: Array<{ id: string; title: string }>;
    noindexPages: Array<{ id: string; title: string }>;
  }> {
    try {
      const escapedPassword = dbConfig.password.replace(/'/g, "'\\''");
      
      // Find published pages/posts missing meta description
      const missingDescQuery = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT p.ID, p.post_title FROM ${dbConfig.prefix}posts p LEFT JOIN ${dbConfig.prefix}postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_yoast_wpseo_metadesc' WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') AND (pm.meta_value IS NULL OR pm.meta_value = '') LIMIT 20;" 2>&1`;
      const missingDescResult = await this.sshExecutor.executeCommandDetailed(serverId, missingDescQuery, 15000);
      
      const missingMetaDescriptions = this.parseQueryResults(missingDescResult.output || '');
      
      // Find pages accidentally set to NoIndex
      const noindexQuery = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT p.ID, p.post_title FROM ${dbConfig.prefix}posts p INNER JOIN ${dbConfig.prefix}postmeta pm ON p.ID = pm.post_id WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') AND pm.meta_key = '_yoast_wpseo_meta-robots-noindex' AND pm.meta_value = '1' LIMIT 20;" 2>&1`;
      const noindexResult = await this.sshExecutor.executeCommandDetailed(serverId, noindexQuery, 15000);
      
      const noindexPages = this.parseQueryResults(noindexResult.output || '');
      
      return {
        missingMetaDescriptions,
        noindexPages,
      };
    } catch (error) {
      this.logger.error('Failed to audit Yoast SEO:', error);
      return {
        missingMetaDescriptions: [],
        noindexPages: [],
      };
    }
  }

  /**
   * Audit Rank Math SEO specific issues
   */
  private async auditRankMathSeo(serverId: string, dbConfig: DbConfig): Promise<{
    missingMetaDescriptions: Array<{ id: string; title: string }>;
    noindexPages: Array<{ id: string; title: string }>;
  }> {
    try {
      const escapedPassword = dbConfig.password.replace(/'/g, "'\\''");
      
      // Find published pages/posts missing meta description
      const missingDescQuery = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT p.ID, p.post_title FROM ${dbConfig.prefix}posts p LEFT JOIN ${dbConfig.prefix}postmeta pm ON p.ID = pm.post_id AND pm.meta_key = 'rank_math_description' WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') AND (pm.meta_value IS NULL OR pm.meta_value = '') LIMIT 20;" 2>&1`;
      const missingDescResult = await this.sshExecutor.executeCommandDetailed(serverId, missingDescQuery, 15000);
      
      const missingMetaDescriptions = this.parseQueryResults(missingDescResult.output || '');
      
      // Find pages accidentally set to NoIndex (Rank Math stores as array string)
      const noindexQuery = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT p.ID, p.post_title FROM ${dbConfig.prefix}posts p INNER JOIN ${dbConfig.prefix}postmeta pm ON p.ID = pm.post_id WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') AND pm.meta_key = 'rank_math_robots' AND pm.meta_value LIKE '%noindex%' LIMIT 20;" 2>&1`;
      const noindexResult = await this.sshExecutor.executeCommandDetailed(serverId, noindexQuery, 15000);
      
      const noindexPages = this.parseQueryResults(noindexResult.output || '');
      
      return {
        missingMetaDescriptions,
        noindexPages,
      };
    } catch (error) {
      this.logger.error('Failed to audit Rank Math SEO:', error);
      return {
        missingMetaDescriptions: [],
        noindexPages: [],
      };
    }
  }

  /**
   * Extract single value from MySQL query output
   */
  private extractQueryValue(output: string): string {
    const lines = output.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && 
             !trimmed.startsWith('option_value') && 
             !trimmed.startsWith('mysql:') &&
             !trimmed.startsWith('Warning:');
    });
    
    return lines.length > 0 ? lines[0].trim() : '';
  }

  /**
   * Parse query results with ID and title columns
   */
  private parseQueryResults(output: string): Array<{ id: string; title: string }> {
    const lines = output.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && 
             !trimmed.startsWith('ID') && 
             !trimmed.startsWith('mysql:') &&
             !trimmed.startsWith('Warning:');
    });
    
    const results: Array<{ id: string; title: string }> = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\t/);
      if (parts.length >= 2) {
        results.push({
          id: parts[0],
          title: parts.slice(1).join(' '),
        });
      }
    }
    
    return results;
  }

  private async checkRobotsTxt(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `test -f ${sitePath}/robots.txt && cat ${sitePath}/robots.txt || echo "NOT_FOUND"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      
      if (result.trim() === 'NOT_FOUND') {
        return { exists: false, blocksAll: false };
      }

      const blocksAll = result.toLowerCase().includes('disallow: /') && 
                       result.toLowerCase().includes('user-agent: *');

      return { exists: true, blocksAll };
    } catch (error) {
      return { exists: false, blocksAll: false };
    }
  }

  private async checkSitemap(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `test -f ${sitePath}/sitemap.xml && echo "EXISTS" || echo "NOT_FOUND"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return { exists: result.trim() === 'EXISTS' };
    } catch (error) {
      return { exists: false };
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
    return 'Comprehensive SEO audit: global blockers, plugin detection, meta descriptions, NoIndex pages';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.SEO_HEALTH;
  }
}
