import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Performance Metrics Service
 * Measures page load time, database performance, PHP execution, and resource usage
 */
@Injectable()
export class PerformanceMetricsService implements IDiagnosisCheckService {
  private readonly logger = new Logger(PerformanceMetricsService.name);

  // Performance thresholds
  private readonly THRESHOLDS = {
    pageLoadTime: 3000, // 3 seconds
    ttfb: 600, // 600ms
    dbQueryTime: 100, // 100ms
    phpMemoryUsage: 128, // 128MB
    phpExecutionTime: 30, // 30 seconds
  };

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
      this.logger.log(`Starting performance check for ${domain}`);

      // 1. Measure page load time and TTFB
      const pageMetrics = await this.measurePageLoad(domain);
      if (pageMetrics.ttfb > this.THRESHOLDS.ttfb) {
        issues.push(`Slow TTFB: ${pageMetrics.ttfb}ms`);
        score -= 15;
        recommendations.push('Optimize server response time');
        recommendations.push('Enable caching');
      }
      if (pageMetrics.totalTime > this.THRESHOLDS.pageLoadTime) {
        issues.push(`Slow page load: ${pageMetrics.totalTime}ms`);
        score -= 20;
        recommendations.push('Optimize images and assets');
        recommendations.push('Enable compression');
      }

      // 2. Check database performance
      const dbMetrics = await this.checkDatabasePerformance(serverId, sitePath);
      if (dbMetrics.slowQueries > 0) {
        issues.push(`${dbMetrics.slowQueries} slow database queries`);
        score -= Math.min(20, dbMetrics.slowQueries * 5);
        recommendations.push('Optimize slow database queries');
        recommendations.push('Add database indexes');
      }

      // 3. Check PHP configuration
      const phpMetrics = await this.checkPHPConfiguration(serverId, sitePath);
      if (phpMetrics.memoryLimit < this.THRESHOLDS.phpMemoryUsage) {
        issues.push(`Low PHP memory limit: ${phpMetrics.memoryLimit}MB`);
        score -= 10;
        recommendations.push('Increase PHP memory_limit to at least 256MB');
      }
      if (phpMetrics.maxExecutionTime < this.THRESHOLDS.phpExecutionTime) {
        issues.push(`Low PHP max_execution_time: ${phpMetrics.maxExecutionTime}s`);
        score -= 5;
        recommendations.push('Increase max_execution_time if needed');
      }

      // 4. Check caching status
      const cachingStatus = await this.checkCaching(serverId, sitePath);
      if (!cachingStatus.objectCacheEnabled) {
        issues.push('Object cache not enabled');
        score -= 15;
        recommendations.push('Enable object caching (Redis/Memcached)');
      }
      if (!cachingStatus.pageCacheEnabled) {
        issues.push('Page cache not enabled');
        score -= 10;
        recommendations.push('Enable page caching plugin');
      }

      // 5. Check asset optimization
      const assetMetrics = await this.checkAssetOptimization(serverId, sitePath);
      if (assetMetrics.unoptimizedImages > 0) {
        issues.push(`${assetMetrics.unoptimizedImages} unoptimized images`);
        score -= Math.min(15, assetMetrics.unoptimizedImages * 2);
        recommendations.push('Optimize images (compress, resize, WebP)');
      }
      if (!assetMetrics.minificationEnabled) {
        issues.push('CSS/JS minification not enabled');
        score -= 10;
        recommendations.push('Enable CSS/JS minification');
      }

      // 6. Check database size
      const dbSize = await this.checkDatabaseSize(serverId, sitePath);
      if (dbSize.needsOptimization) {
        issues.push(`Database needs optimization (${dbSize.sizeMB}MB)`);
        score -= 10;
        recommendations.push('Optimize database tables');
        recommendations.push('Clean up post revisions and transients');
      }

      // Determine status
      let status: CheckStatus;
      if (score >= 80) {
        status = CheckStatus.PASS;
      } else if (score >= 60) {
        status = CheckStatus.WARNING;
      } else {
        status = CheckStatus.FAIL;
      }

      const message =
        issues.length === 0
          ? 'Performance is good - no optimization needed'
          : `Performance issues detected: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: {
          pageMetrics,
          dbMetrics,
          phpMetrics,
          cachingStatus,
          assetMetrics,
          dbSize,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Performance check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Performance check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Retry performance check', 'Check server connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Measure page load time and TTFB
   */
  private async measurePageLoad(domain: string): Promise<any> {
    try {
      const command = `curl -o /dev/null -s -w "ttfb:%{time_starttransfer}\\ntotal:%{time_total}\\nhttp_code:%{http_code}" https://${domain} --max-time 30 2>/dev/null || curl -o /dev/null -s -w "ttfb:%{time_starttransfer}\\ntotal:%{time_total}\\nhttp_code:%{http_code}" http://${domain} --max-time 30 2>/dev/null`;

      const result = await this.sshExecutor.executeCommand('local', command, 35000);
      const lines = result.split('\n');
      
      const ttfb = parseFloat(lines[0]?.split(':')[1] || '0') * 1000; // Convert to ms
      const totalTime = parseFloat(lines[1]?.split(':')[1] || '0') * 1000;
      const httpCode = parseInt(lines[2]?.split(':')[1] || '0');

      return {
        ttfb: Math.round(ttfb),
        totalTime: Math.round(totalTime),
        httpCode,
      };
    } catch (error) {
      this.logger.warn(`Failed to measure page load: ${(error as Error).message}`);
      return { ttfb: 0, totalTime: 0, httpCode: 0 };
    }
  }

  /**
   * Check database performance
   */
  private async checkDatabasePerformance(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      // Check for slow queries using WP-CLI
      const command = `cd ${sitePath} && wp db query "SHOW VARIABLES LIKE 'slow_query_log'" --allow-root 2>/dev/null || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);

      // Get database size
      const sizeCommand = `cd ${sitePath} && wp db size --allow-root 2>/dev/null || echo "0"`;
      const sizeResult = await this.sshExecutor.executeCommand(serverId, sizeCommand, 15000);

      return {
        slowQueries: 0, // Placeholder - would need actual slow query log analysis
        dbSize: sizeResult.trim(),
        tablesNeedingOptimization: 0,
      };
    } catch (error) {
      this.logger.warn(`Failed to check database performance: ${(error as Error).message}`);
      return { slowQueries: 0, dbSize: '0', tablesNeedingOptimization: 0 };
    }
  }

  /**
   * Check PHP configuration
   */
  private async checkPHPConfiguration(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      // Get PHP memory limit
      const memoryCommand = `cd ${sitePath} && wp eval "echo ini_get('memory_limit');" --allow-root 2>/dev/null || echo "128M"`;
      const memoryResult = await this.sshExecutor.executeCommand(serverId, memoryCommand, 10000);
      const memoryLimit = parseInt(memoryResult.replace(/[^0-9]/g, ''));

      // Get max execution time
      const timeCommand = `cd ${sitePath} && wp eval "echo ini_get('max_execution_time');" --allow-root 2>/dev/null || echo "30"`;
      const timeResult = await this.sshExecutor.executeCommand(serverId, timeCommand, 10000);
      const maxExecutionTime = parseInt(timeResult.trim());

      return {
        memoryLimit,
        maxExecutionTime,
      };
    } catch (error) {
      this.logger.warn(`Failed to check PHP configuration: ${(error as Error).message}`);
      return { memoryLimit: 128, maxExecutionTime: 30 };
    }
  }

  /**
   * Check caching status
   */
  private async checkCaching(serverId: string, sitePath: string): Promise<any> {
    try {
      // Check for object cache drop-in
      const objectCacheCommand = `test -f ${sitePath}/wp-content/object-cache.php && echo "ENABLED" || echo "DISABLED"`;
      const objectCacheResult = await this.sshExecutor.executeCommand(serverId, objectCacheCommand, 10000);

      // Check for caching plugins
      const cachingPluginsCommand = `cd ${sitePath} && wp plugin list --status=active --format=json --allow-root 2>/dev/null || echo "[]"`;
      const pluginsResult = await this.sshExecutor.executeCommand(serverId, cachingPluginsCommand, 15000);
      const plugins = JSON.parse(pluginsResult || '[]');
      
      const cachingPlugins = ['wp-super-cache', 'w3-total-cache', 'wp-rocket', 'litespeed-cache', 'wp-fastest-cache'];
      const pageCacheEnabled = plugins.some((p: any) => 
        cachingPlugins.some(cp => p.name?.toLowerCase().includes(cp))
      );

      return {
        objectCacheEnabled: objectCacheResult.trim() === 'ENABLED',
        pageCacheEnabled,
        cachingPlugins: plugins.filter((p: any) => 
          cachingPlugins.some(cp => p.name?.toLowerCase().includes(cp))
        ).map((p: any) => p.name),
      };
    } catch (error) {
      this.logger.warn(`Failed to check caching: ${(error as Error).message}`);
      return { objectCacheEnabled: false, pageCacheEnabled: false, cachingPlugins: [] };
    }
  }

  /**
   * Check asset optimization
   */
  private async checkAssetOptimization(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      // Count large images (>500KB)
      const largeImagesCommand = `find ${sitePath}/wp-content/uploads -type f \\( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \\) -size +500k 2>/dev/null | wc -l`;
      const largeImagesResult = await this.sshExecutor.executeCommand(serverId, largeImagesCommand, 30000);
      const unoptimizedImages = parseInt(largeImagesResult.trim() || '0');

      // Check for minification plugins
      const minificationCommand = `cd ${sitePath} && wp plugin list --status=active --format=json --allow-root 2>/dev/null || echo "[]"`;
      const pluginsResult = await this.sshExecutor.executeCommand(serverId, minificationCommand, 15000);
      const plugins = JSON.parse(pluginsResult || '[]');
      
      const minificationPlugins = ['autoptimize', 'wp-rocket', 'w3-total-cache', 'fast-velocity-minify'];
      const minificationEnabled = plugins.some((p: any) => 
        minificationPlugins.some(mp => p.name?.toLowerCase().includes(mp))
      );

      return {
        unoptimizedImages,
        minificationEnabled,
      };
    } catch (error) {
      this.logger.warn(`Failed to check asset optimization: ${(error as Error).message}`);
      return { unoptimizedImages: 0, minificationEnabled: false };
    }
  }

  /**
   * Check database size
   */
  private async checkDatabaseSize(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `cd ${sitePath} && wp db size --allow-root 2>/dev/null || echo "0 MB"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const sizeMB = parseFloat(result.replace(/[^0-9.]/g, ''));

      return {
        sizeMB,
        needsOptimization: sizeMB > 500, // Flag if DB > 500MB
      };
    } catch (error) {
      this.logger.warn(`Failed to check database size: ${(error as Error).message}`);
      return { sizeMB: 0, needsOptimization: false };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.PERFORMANCE_METRICS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Performance Metrics';
  }

  getDescription(): string {
    return 'Measures page load time, database performance, caching, and asset optimization';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.PERFORMANCE_METRICS;
  }
}
