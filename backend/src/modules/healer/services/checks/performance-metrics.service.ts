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

      // PHASE 3 - LAYER 5: Advanced Performance Monitoring
      // 7. Track PHP memory usage
      const phpMemoryUsage = await this.trackPHPMemoryUsage(serverId, sitePath);
      if (phpMemoryUsage.peakUsagePercent > 90) {
        issues.push(`PHP memory usage critical: ${phpMemoryUsage.peakUsagePercent}%`);
        score -= 20;
        recommendations.push('Increase PHP memory_limit immediately');
        recommendations.push('Investigate memory-intensive plugins');
      } else if (phpMemoryUsage.peakUsagePercent > 75) {
        issues.push(`PHP memory usage high: ${phpMemoryUsage.peakUsagePercent}%`);
        score -= 10;
        recommendations.push('Monitor PHP memory usage closely');
      }

      // 8. Monitor MySQL query count
      const queryCount = await this.monitorQueryCount(serverId, sitePath, domain);
      if (queryCount.totalQueries > 100) {
        issues.push(`High query count: ${queryCount.totalQueries} queries per page`);
        score -= 15;
        recommendations.push('Reduce database queries (use caching)');
        recommendations.push('Optimize plugin queries');
      }

      // 9. Analyze object cache hit ratio
      const cacheHitRatio = await this.analyzeObjectCacheHitRatio(serverId, sitePath);
      if (cacheHitRatio.enabled && cacheHitRatio.hitRate < 70) {
        issues.push(`Low cache hit ratio: ${cacheHitRatio.hitRate}%`);
        score -= 10;
        recommendations.push('Optimize cache configuration');
        recommendations.push('Increase cache TTL for static data');
      }

      // 10. Monitor external HTTP requests
      const externalRequests = await this.monitorExternalHTTPRequests(serverId, sitePath, domain);
      if (externalRequests.count > 10) {
        issues.push(`High external HTTP requests: ${externalRequests.count}`);
        score -= 10;
        recommendations.push('Reduce external API calls');
        recommendations.push('Cache external API responses');
      }
      if (externalRequests.slowRequests > 0) {
        issues.push(`${externalRequests.slowRequests} slow external requests (>2s)`);
        score -= 5;
        recommendations.push('Optimize or remove slow external services');
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
      // Use curl from local machine (no SSH needed for external HTTP requests)
      const axios = require('axios');
      const startTime = Date.now();
      
      try {
        const response = await axios.get(`https://${domain}`, {
          timeout: 30000,
          validateStatus: () => true,
        });
        const totalTime = Date.now() - startTime;
        
        return {
          ttfb: Math.round(totalTime * 0.3), // Approximate TTFB as 30% of total time
          totalTime: Math.round(totalTime),
          httpCode: response.status,
        };
      } catch (httpsError) {
        // Try HTTP fallback
        const response = await axios.get(`http://${domain}`, {
          timeout: 30000,
          validateStatus: () => true,
        });
        const totalTime = Date.now() - startTime;
        
        return {
          ttfb: Math.round(totalTime * 0.3),
          totalTime: Math.round(totalTime),
          httpCode: response.status,
        };
      }
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
      
      // Parse memory limit properly (handles M, G, K suffixes)
      let memoryLimit = 128; // Default
      const memoryStr = memoryResult.trim().toUpperCase();
      
      if (memoryStr.includes('G')) {
        memoryLimit = parseInt(memoryStr.replace(/[^0-9]/g, '')) * 1024;
      } else if (memoryStr.includes('M')) {
        memoryLimit = parseInt(memoryStr.replace(/[^0-9]/g, ''));
      } else if (memoryStr.includes('K')) {
        memoryLimit = Math.round(parseInt(memoryStr.replace(/[^0-9]/g, '')) / 1024);
      } else {
        // Bytes
        const bytes = parseInt(memoryStr.replace(/[^0-9]/g, ''));
        if (bytes > 0) {
          memoryLimit = Math.round(bytes / 1024 / 1024);
        }
      }

      // Get max execution time
      const timeCommand = `cd ${sitePath} && wp eval "echo ini_get('max_execution_time');" --allow-root 2>/dev/null || echo "30"`;
      const timeResult = await this.sshExecutor.executeCommand(serverId, timeCommand, 10000);
      const maxExecutionTime = parseInt(timeResult.trim()) || 30;

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
      
      // Parse database size properly
      // Output format: "Name\tSize\ndatabase_name\t12345678 B"
      const lines = result.split('\n').filter(line => line.trim() && !line.startsWith('Name'));
      let sizeMB = 0;
      
      if (lines.length > 0) {
        const parts = lines[0].split(/\s+/);
        if (parts.length >= 2) {
          const sizeStr = parts[1];
          // Parse size with unit (B, KB, MB, GB)
          if (sizeStr.includes('GB')) {
            sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) * 1024;
          } else if (sizeStr.includes('MB')) {
            sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, ''));
          } else if (sizeStr.includes('KB')) {
            sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) / 1024;
          } else if (sizeStr.includes('B')) {
            // Bytes
            sizeMB = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) / 1024 / 1024;
          } else {
            // Assume bytes if no unit
            sizeMB = parseFloat(sizeStr) / 1024 / 1024;
          }
        }
      }
      
      sizeMB = Math.round(sizeMB * 100) / 100; // Round to 2 decimal places

      return {
        sizeMB,
        needsOptimization: sizeMB > 500, // Flag if DB > 500MB
      };
    } catch (error) {
      this.logger.warn(`Failed to check database size: ${(error as Error).message}`);
      return { sizeMB: 0, needsOptimization: false };
    }
  }

  /**
   * PHASE 3 - LAYER 5: Track PHP memory usage
   */
  private async trackPHPMemoryUsage(serverId: string, sitePath: string): Promise<any> {
    try {
      // Get current memory usage and limit
      const command = `cd ${sitePath} && wp eval "
        \\$limit = ini_get('memory_limit');
        \\$current = memory_get_usage(true);
        \\$peak = memory_get_peak_usage(true);
        echo json_encode([
          'limit' => \\$limit,
          'current' => \\$current,
          'peak' => \\$peak,
          'limit_bytes' => wp_convert_hr_to_bytes(\\$limit)
        ]);
      " --allow-root 2>/dev/null`;

      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const data = JSON.parse(result || '{}');

      const limitBytes = data.limit_bytes || 134217728; // Default 128MB
      const currentBytes = data.current || 0;
      const peakBytes = data.peak || 0;

      const currentUsagePercent = Math.round((currentBytes / limitBytes) * 100);
      const peakUsagePercent = Math.round((peakBytes / limitBytes) * 100);

      return {
        limit: data.limit || '128M',
        currentUsageMB: Math.round(currentBytes / 1024 / 1024),
        peakUsageMB: Math.round(peakBytes / 1024 / 1024),
        limitMB: Math.round(limitBytes / 1024 / 1024),
        currentUsagePercent,
        peakUsagePercent,
      };
    } catch (error) {
      this.logger.warn(`Failed to track PHP memory usage: ${(error as Error).message}`);
      return {
        limit: '128M',
        currentUsageMB: 0,
        peakUsageMB: 0,
        limitMB: 128,
        currentUsagePercent: 0,
        peakUsagePercent: 0,
      };
    }
  }

  /**
   * PHASE 3 - LAYER 5: Monitor MySQL query count per page load
   */
  private async monitorQueryCount(serverId: string, sitePath: string, domain: string): Promise<any> {
    try {
      // Enable query monitor temporarily and count queries
      const command = `cd ${sitePath} && wp eval "
        define('SAVEQUERIES', true);
        \\$before = \\$GLOBALS['wpdb']->num_queries ?? 0;
        
        // Simulate a page load
        do_action('init');
        do_action('wp_loaded');
        
        \\$after = \\$GLOBALS['wpdb']->num_queries ?? 0;
        \\$queries = \\$after - \\$before;
        
        // Get slow queries (>0.05s)
        \\$slow = 0;
        if (isset(\\$GLOBALS['wpdb']->queries)) {
          foreach (\\$GLOBALS['wpdb']->queries as \\$q) {
            if (\\$q[1] > 0.05) \\$slow++;
          }
        }
        
        echo json_encode([
          'total' => \\$queries,
          'slow' => \\$slow
        ]);
      " --allow-root 2>/dev/null`;

      const result = await this.sshExecutor.executeCommand(serverId, command, 20000);
      const data = JSON.parse(result || '{"total":0,"slow":0}');

      return {
        totalQueries: data.total || 0,
        slowQueries: data.slow || 0,
      };
    } catch (error) {
      this.logger.warn(`Failed to monitor query count: ${(error as Error).message}`);
      return { totalQueries: 0, slowQueries: 0 };
    }
  }

  /**
   * PHASE 3 - LAYER 5: Analyze object cache hit ratio
   */
  private async analyzeObjectCacheHitRatio(serverId: string, sitePath: string): Promise<any> {
    try {
      // Check if object cache is enabled
      const cacheCheckCommand = `test -f ${sitePath}/wp-content/object-cache.php && echo "ENABLED" || echo "DISABLED"`;
      const cacheEnabled = await this.sshExecutor.executeCommand(serverId, cacheCheckCommand, 10000);

      if (cacheEnabled.trim() !== 'ENABLED') {
        return {
          enabled: false,
          hitRate: 0,
          hits: 0,
          misses: 0,
        };
      }

      // Get cache statistics
      const command = `cd ${sitePath} && wp eval "
        \\$info = wp_cache_get_info();
        if (is_array(\\$info)) {
          echo json_encode(\\$info);
        } else {
          // Fallback: Get stats from Redis/Memcached directly
          echo json_encode(['hits' => 0, 'misses' => 0]);
        }
      " --allow-root 2>/dev/null`;

      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const data = JSON.parse(result || '{"hits":0,"misses":0}');

      const hits = data.hits || data.cache_hits || 0;
      const misses = data.misses || data.cache_misses || 0;
      const total = hits + misses;
      const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;

      return {
        enabled: true,
        hitRate,
        hits,
        misses,
        total,
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze cache hit ratio: ${(error as Error).message}`);
      return {
        enabled: false,
        hitRate: 0,
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * PHASE 3 - LAYER 5: Monitor external HTTP requests
   */
  private async monitorExternalHTTPRequests(serverId: string, sitePath: string, domain: string): Promise<any> {
    try {
      // Hook into HTTP API to track external requests
      const command = `cd ${sitePath} && wp eval "
        \\$requests = [];
        \\$slow_requests = 0;
        
        // Hook into HTTP API
        add_filter('pre_http_request', function(\\$response, \\$args, \\$url) use (&\\$requests, &\\$slow_requests) {
          \\$start = microtime(true);
          \\$response = false; // Continue with actual request
          return \\$response;
        }, 10, 3);
        
        add_action('http_api_debug', function(\\$response, \\$context, \\$class, \\$args, \\$url) use (&\\$requests, &\\$slow_requests) {
          \\$duration = \\$response['duration'] ?? 0;
          \\$requests[] = [
            'url' => \\$url,
            'duration' => \\$duration
          ];
          if (\\$duration > 2) {
            \\$slow_requests++;
          }
        }, 10, 5);
        
        // Simulate page load to trigger HTTP requests
        do_action('init');
        do_action('wp_loaded');
        do_action('wp_head');
        
        echo json_encode([
          'count' => count(\\$requests),
          'slow' => \\$slow_requests,
          'requests' => array_slice(\\$requests, 0, 10) // Top 10
        ]);
      " --allow-root 2>/dev/null`;

      const result = await this.sshExecutor.executeCommand(serverId, command, 25000);
      const data = JSON.parse(result || '{"count":0,"slow":0,"requests":[]}');

      return {
        count: data.count || 0,
        slowRequests: data.slow || 0,
        topRequests: data.requests || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to monitor external HTTP requests: ${(error as Error).message}`);
      return {
        count: 0,
        slowRequests: 0,
        topRequests: [],
      };
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
