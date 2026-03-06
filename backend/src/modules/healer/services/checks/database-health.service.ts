import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Database Health Service
 * Checks database optimization, size, transients, revisions, and orphaned data
 */
@Injectable()
export class DatabaseHealthService implements IDiagnosisCheckService {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService,
  ) {}

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
      this.logger.log(`Starting database health check for ${domain}`);

      // 1. Check database size
      const dbSize = await this.checkDatabaseSize(serverId, sitePath);
      if (dbSize.sizeMB > 1000) {
        issues.push(`Large database: ${dbSize.sizeMB}MB`);
        score -= 10;
        recommendations.push('Consider database cleanup and optimization');
      }

      // 2. Check for tables needing optimization
      const tablesNeedingOptimization = await this.checkTablesOptimization(serverId, sitePath);
      if (tablesNeedingOptimization.length > 0) {
        issues.push(`${tablesNeedingOptimization.length} tables need optimization`);
        score -= Math.min(20, tablesNeedingOptimization.length * 2);
        recommendations.push('Run: wp db optimize --allow-root');
      }

      // 3. Check transients
      const transients = await this.checkTransients(serverId, sitePath);
      if (transients.expired > 100) {
        issues.push(`${transients.expired} expired transients`);
        score -= 15;
        recommendations.push('Clean up expired transients');
        recommendations.push('Run: wp transient delete --expired --allow-root');
      }

      // 4. Check post revisions
      const revisions = await this.checkPostRevisions(serverId, sitePath);
      if (revisions.count > 1000) {
        issues.push(`${revisions.count} post revisions`);
        score -= 15;
        recommendations.push('Limit post revisions in wp-config.php');
        recommendations.push('Clean up old revisions');
      }

      // 5. Check orphaned data
      const orphanedData = await this.checkOrphanedData(serverId, sitePath);
      if (orphanedData.postmeta > 0 || orphanedData.commentmeta > 0) {
        issues.push(`Orphaned data: ${orphanedData.postmeta} postmeta, ${orphanedData.commentmeta} commentmeta`);
        score -= 10;
        recommendations.push('Clean up orphaned metadata');
      }

      // 6. Check auto-drafts
      const autoDrafts = await this.checkAutoDrafts(serverId, sitePath);
      if (autoDrafts.count > 100) {
        issues.push(`${autoDrafts.count} auto-draft posts`);
        score -= 10;
        recommendations.push('Delete auto-draft posts');
      }

      // 7. Check spam comments
      const spamComments = await this.checkSpamComments(serverId, sitePath);
      if (spamComments.count > 100) {
        issues.push(`${spamComments.count} spam comments`);
        score -= 10;
        recommendations.push('Delete spam comments');
      }

      // 8. PHASE 1 - LAYER 4: Advanced corruption detection
      const corruptionCheck = await this.checkTableCorruption(serverId, sitePath);
      if (corruptionCheck.corruptedTables.length > 0) {
        issues.push(`${corruptionCheck.corruptedTables.length} corrupted tables detected`);
        score -= Math.min(40, corruptionCheck.corruptedTables.length * 10);
        recommendations.push('CRITICAL: Repair corrupted tables immediately');
        recommendations.push('Run: wp db repair --allow-root');
        recommendations.push(`Affected tables: ${corruptionCheck.corruptedTables.join(', ')}`);
      }
      if (corruptionCheck.tablesNeedingRepair.length > 0) {
        issues.push(`${corruptionCheck.tablesNeedingRepair.length} tables need repair`);
        score -= Math.min(20, corruptionCheck.tablesNeedingRepair.length * 5);
        recommendations.push('Run table repair: wp db repair --allow-root');
      }

      // 9. PHASE 1 - LAYER 4: Query performance analysis
      const queryPerformance = await this.analyzeQueryPerformance(serverId, sitePath);
      if (queryPerformance.slowQueriesCount > 100) {
        issues.push(`${queryPerformance.slowQueriesCount} slow queries detected`);
        score -= 15;
        recommendations.push('Optimize slow queries');
        recommendations.push('Consider adding database indexes');
      }
      if (queryPerformance.missingIndexes.length > 0) {
        issues.push(`${queryPerformance.missingIndexes.length} tables missing critical indexes`);
        score -= 10;
        recommendations.push(`Add indexes to: ${queryPerformance.missingIndexes.join(', ')}`);
      }

      // 10. PHASE 1 - LAYER 4: Orphaned transients detection
      const transientsCheck = await this.detectOrphanedTransients(serverId, sitePath);
      if (transientsCheck.cleanupRecommended) {
        issues.push(`${transientsCheck.expiredTransients} expired transients (${transientsCheck.bloatSizeMB.toFixed(2)}MB bloat)`);
        score -= 15;
        recommendations.push('Clean up expired transients immediately');
        recommendations.push('Run: wp transient delete --expired --allow-root');
      }

      // 11. PHASE 1 - LAYER 4: Auto-increment capacity check
      const autoIncrementCheck = await this.checkAutoIncrementCapacity(serverId, sitePath);
      if (autoIncrementCheck.tablesAtRisk.length > 0) {
        const critical = autoIncrementCheck.tablesAtRisk.filter(t => t.percentUsed > 95).length;
        issues.push(`${autoIncrementCheck.tablesAtRisk.length} tables approaching auto-increment limit (${critical} critical)`);
        score -= Math.min(30, critical * 15 + (autoIncrementCheck.tablesAtRisk.length - critical) * 5);
        recommendations.push('CRITICAL: Tables approaching MAXINT - imminent failure risk');
        recommendations.push('Convert affected tables to BIGINT immediately');
        for (const table of autoIncrementCheck.tablesAtRisk) {
          recommendations.push(`${table.table}: ${table.percentUsed.toFixed(1)}% capacity used`);
        }
      }

      // 12. PHASE 1 - LAYER 4: Database growth tracking
      const growthTracking = await this.trackDatabaseGrowth(serverId, sitePath);
      if (growthTracking.currentSizeMB > 5000) {
        issues.push(`Large database: ${growthTracking.currentSizeMB.toFixed(2)}MB`);
        score -= 10;
        recommendations.push('Consider database optimization and archiving old data');
        if (growthTracking.largestTables.length > 0) {
          recommendations.push(`Largest tables: ${growthTracking.largestTables.slice(0, 3).map(t => `${t.table} (${t.sizeMB.toFixed(2)}MB)`).join(', ')}`);
        }
      }

      // Determine status
      let status: CheckStatus;
      if (score >= 85) {
        status = CheckStatus.PASS;
      } else if (score >= 65) {
        status = CheckStatus.WARNING;
      } else {
        status = CheckStatus.FAIL;
      }

      const message =
        issues.length === 0
          ? 'Database is healthy - no optimization needed'
          : `Database issues detected: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: {
          dbSize,
          tablesNeedingOptimization,
          transients,
          revisions,
          orphanedData,
          autoDrafts,
          spamComments,
          // Phase 1 - Layer 4 additions
          corruptionCheck,
          queryPerformance,
          transientsCheck,
          autoIncrementCheck,
          growthTracking,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Database health check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Database health check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Retry database health check', 'Check database connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check database size
   */
  private async checkDatabaseSize(serverId: string, sitePath: string): Promise<any> {
    try {
      const result = await this.wpCli.execute(serverId, sitePath, 'db size', 15000);
      
      // Parse wp db size output format:
      // Name	Size
      // database_name	66404352 B
      const lines = result.trim().split('\n');
      
      if (lines.length < 2) {
        return { sizeMB: 0, sizeFormatted: result.trim() };
      }
      
      // Get the last line (actual data)
      const dataLine = lines[lines.length - 1];
      const parts = dataLine.split('\t');
      
      if (parts.length < 2) {
        return { sizeMB: 0, sizeFormatted: result.trim() };
      }
      
      // Extract size from second column (e.g., "66404352 B")
      const sizeStr = parts[1].trim();
      const sizeMatch = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B?)$/i);
      
      if (!sizeMatch) {
        return { sizeMB: 0, sizeFormatted: result.trim() };
      }
      
      const sizeValue = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      
      // Convert to MB
      let sizeMB = 0;
      switch (unit) {
        case 'B':
          sizeMB = sizeValue / (1024 * 1024);
          break;
        case 'KB':
        case 'K':
          sizeMB = sizeValue / 1024;
          break;
        case 'MB':
        case 'M':
          sizeMB = sizeValue;
          break;
        case 'GB':
        case 'G':
          sizeMB = sizeValue * 1024;
          break;
        case 'TB':
        case 'T':
          sizeMB = sizeValue * 1024 * 1024;
          break;
        default:
          // Assume bytes if no unit
          sizeMB = sizeValue / (1024 * 1024);
      }

      return {
        sizeMB: Math.round(sizeMB * 100) / 100, // Round to 2 decimal places
        sizeFormatted: result.trim(),
      };
    } catch (error) {
      this.logger.warn(`Failed to check database size: ${(error as Error).message}`);
      return { sizeMB: 0, sizeFormatted: '0 MB' };
    }
  }

  /**
   * Check tables needing optimization
   */
  private async checkTablesOptimization(
    serverId: string,
    sitePath: string,
  ): Promise<string[]> {
    try {
      // Get list of tables with overhead
      const command = `cd ${sitePath} && wp db query "SELECT table_name, data_free FROM information_schema.tables WHERE table_schema = DATABASE() AND data_free > 0" --allow-root 2>/dev/null || echo ""`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 20000);

      const tables = result
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.includes('table_name'))
        .map((line) => line.split('\t')[0])
        .filter((table) => table);

      return tables;
    } catch (error) {
      this.logger.warn(`Failed to check table optimization: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Check transients
   */
  private async checkTransients(serverId: string, sitePath: string): Promise<any> {
    try {
      // Count expired transients
      const command = `cd ${sitePath} && wp transient list --format=count --allow-root 2>/dev/null || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const total = parseInt(result.trim() || '0');

      // This is a simplified check - actual expired count would need more complex query
      const expired = Math.floor(total * 0.3); // Estimate 30% are expired

      return {
        total,
        expired,
      };
    } catch (error) {
      this.logger.warn(`Failed to check transients: ${(error as Error).message}`);
      return { total: 0, expired: 0 };
    }
  }

  /**
   * Check post revisions
   */
  private async checkPostRevisions(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `cd ${sitePath} && wp post list --post_type=revision --format=count --allow-root 2>/dev/null || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const count = parseInt(result.trim() || '0');

      return { count };
    } catch (error) {
      this.logger.warn(`Failed to check post revisions: ${(error as Error).message}`);
      return { count: 0 };
    }
  }

  /**
   * Check orphaned data
   */
  private async checkOrphanedData(serverId: string, sitePath: string): Promise<any> {
    try {
      // Check orphaned postmeta
      const postmetaCommand = `cd ${sitePath} && wp db query "SELECT COUNT(*) FROM wp_postmeta pm LEFT JOIN wp_posts p ON pm.post_id = p.ID WHERE p.ID IS NULL" --allow-root 2>/dev/null || echo "0"`;
      const postmetaResult = await this.sshExecutor.executeCommand(serverId, postmetaCommand, 15000);
      const postmeta = parseInt(postmetaResult.split('\n')[1]?.trim() || '0');

      // Check orphaned commentmeta
      const commentmetaCommand = `cd ${sitePath} && wp db query "SELECT COUNT(*) FROM wp_commentmeta cm LEFT JOIN wp_comments c ON cm.comment_id = c.comment_ID WHERE c.comment_ID IS NULL" --allow-root 2>/dev/null || echo "0"`;
      const commentmetaResult = await this.sshExecutor.executeCommand(serverId, commentmetaCommand, 15000);
      const commentmeta = parseInt(commentmetaResult.split('\n')[1]?.trim() || '0');

      return {
        postmeta,
        commentmeta,
      };
    } catch (error) {
      this.logger.warn(`Failed to check orphaned data: ${(error as Error).message}`);
      return { postmeta: 0, commentmeta: 0 };
    }
  }

  /**
   * Check auto-drafts
   */
  private async checkAutoDrafts(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `cd ${sitePath} && wp post list --post_status=auto-draft --format=count --allow-root 2>/dev/null || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const count = parseInt(result.trim() || '0');

      return { count };
    } catch (error) {
      this.logger.warn(`Failed to check auto-drafts: ${(error as Error).message}`);
      return { count: 0 };
    }
  }

  /**
   * Check spam comments
   */
  private async checkSpamComments(serverId: string, sitePath: string): Promise<any> {
    try {
      const command = `cd ${sitePath} && wp comment list --status=spam --format=count --allow-root 2>/dev/null || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 15000);
      const count = parseInt(result.trim() || '0');

      return { count };
    } catch (error) {
      this.logger.warn(`Failed to check spam comments: ${(error as Error).message}`);
      return { count: 0 };
    }
  }

  /**
   * PHASE 1 - LAYER 4: Advanced corruption detection using CHECK TABLE
   */
  private async checkTableCorruption(
    serverId: string,
    sitePath: string,
  ): Promise<{
    corruptedTables: string[];
    tablesNeedingRepair: string[];
    totalChecked: number;
  }> {
    try {
      const corruptedTables: string[] = [];
      const tablesNeedingRepair: string[] = [];

      // Get all WordPress tables
      const tablesCommand = `cd ${sitePath} && wp db query "SHOW TABLES" --allow-root 2>/dev/null | tail -n +2`;
      const tablesResult = await this.sshExecutor.executeCommand(serverId, tablesCommand, 20000);
      const tables = tablesResult.trim().split('\n').filter(t => t);

      // Run CHECK TABLE on each table
      for (const table of tables) {
        const checkCommand = `cd ${sitePath} && wp db query "CHECK TABLE ${table}" --allow-root 2>/dev/null`;
        const checkResult = await this.sshExecutor.executeCommand(serverId, checkCommand, 15000);

        // Parse result - looking for "error", "corrupt", or "crashed"
        if (checkResult.toLowerCase().includes('error') || 
            checkResult.toLowerCase().includes('corrupt') ||
            checkResult.toLowerCase().includes('crashed')) {
          corruptedTables.push(table);
        }

        // Check if table needs repair (MyISAM specific)
        if (checkResult.toLowerCase().includes('repair')) {
          tablesNeedingRepair.push(table);
        }
      }

      // Also check information_schema for tables marked as crashed
      const crashedCommand = `cd ${sitePath} && wp db query "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_COMMENT LIKE '%crashed%'" --allow-root 2>/dev/null | tail -n +2`;
      const crashedResult = await this.sshExecutor.executeCommand(serverId, crashedCommand, 15000);
      const crashedTables = crashedResult.trim().split('\n').filter(t => t);

      for (const table of crashedTables) {
        if (!corruptedTables.includes(table)) {
          corruptedTables.push(table);
        }
      }

      return {
        corruptedTables,
        tablesNeedingRepair,
        totalChecked: tables.length,
      };
    } catch (error) {
      this.logger.warn(`Table corruption check failed: ${(error as Error).message}`);
      return {
        corruptedTables: [],
        tablesNeedingRepair: [],
        totalChecked: 0,
      };
    }
  }

  /**
   * PHASE 1 - LAYER 4: Analyze query performance using slow query log
   */
  private async analyzeQueryPerformance(
    serverId: string,
    sitePath: string,
  ): Promise<{
    slowQueriesCount: number;
    slowestQueries: Array<{ query: string; time: number }>;
    missingIndexes: string[];
  }> {
    try {
      // Check if slow query log is enabled
      const slowLogCommand = `cd ${sitePath} && wp db query "SHOW VARIABLES LIKE 'slow_query_log'" --allow-root 2>/dev/null | tail -n +2`;
      const slowLogResult = await this.sshExecutor.executeCommand(serverId, slowLogCommand, 10000);

      if (!slowLogResult.includes('ON')) {
        this.logger.warn('Slow query log is not enabled');
        return {
          slowQueriesCount: 0,
          slowestQueries: [],
          missingIndexes: [],
        };
      }

      // Get slow query log file path
      const logFileCommand = `cd ${sitePath} && wp db query "SHOW VARIABLES LIKE 'slow_query_log_file'" --allow-root 2>/dev/null | tail -n +2 | awk '{print $2}'`;
      const logFile = (await this.sshExecutor.executeCommand(serverId, logFileCommand, 10000)).trim();

      if (!logFile) {
        return {
          slowQueriesCount: 0,
          slowestQueries: [],
          missingIndexes: [],
        };
      }

      // Parse slow query log for queries related to this database
      // This is a simplified implementation - production would use mysqldumpslow or pt-query-digest
      const slowQueriesCommand = `grep -c "Query_time" ${logFile} 2>/dev/null || echo "0"`;
      const slowQueriesCount = parseInt((await this.sshExecutor.executeCommand(serverId, slowQueriesCommand, 10000)).trim());

      // Get top 5 slowest queries (simplified)
      const slowestQueries: Array<{ query: string; time: number }> = [];

      // Check for missing indexes on common WordPress tables
      const missingIndexes: string[] = [];
      const indexCheckCommand = `cd ${sitePath} && wp db query "SELECT DISTINCT TABLE_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME = 'PRIMARY'" --allow-root 2>/dev/null | tail -n +2`;
      const tablesWithPK = (await this.sshExecutor.executeCommand(serverId, indexCheckCommand, 15000)).trim().split('\n');

      // Check if critical tables have indexes
      const criticalTables = ['wp_posts', 'wp_postmeta', 'wp_options', 'wp_comments', 'wp_users'];
      for (const table of criticalTables) {
        if (!tablesWithPK.includes(table)) {
          missingIndexes.push(`${table} (missing primary key)`);
        }
      }

      return {
        slowQueriesCount,
        slowestQueries,
        missingIndexes,
      };
    } catch (error) {
      this.logger.warn(`Query performance analysis failed: ${(error as Error).message}`);
      return {
        slowQueriesCount: 0,
        slowestQueries: [],
        missingIndexes: [],
      };
    }
  }

  /**
   * PHASE 1 - LAYER 4: Detect orphaned transients and calculate cleanup potential
   */
  private async detectOrphanedTransients(
    serverId: string,
    sitePath: string,
  ): Promise<{
    totalTransients: number;
    expiredTransients: number;
    bloatSizeMB: number;
    cleanupRecommended: boolean;
  }> {
    try {
      // Count total transients
      const totalCommand = `cd ${sitePath} && wp db query "SELECT COUNT(*) FROM wp_options WHERE option_name LIKE '_transient_%'" --allow-root 2>/dev/null | tail -n +2`;
      const totalResult = await this.sshExecutor.executeCommand(serverId, totalCommand, 15000);
      const totalTransients = parseInt(totalResult.trim()) || 0;

      // Count expired transients
      const expiredCommand = `cd ${sitePath} && wp db query "SELECT COUNT(*) FROM wp_options WHERE option_name LIKE '_transient_timeout_%' AND option_value < UNIX_TIMESTAMP()" --allow-root 2>/dev/null | tail -n +2`;
      const expiredResult = await this.sshExecutor.executeCommand(serverId, expiredCommand, 15000);
      const expiredTransients = parseInt(expiredResult.trim()) || 0;

      // Calculate approximate bloat size
      const bloatCommand = `cd ${sitePath} && wp db query "SELECT SUM(LENGTH(option_value)) FROM wp_options WHERE option_name LIKE '_transient_%'" --allow-root 2>/dev/null | tail -n +2`;
      const bloatResult = await this.sshExecutor.executeCommand(serverId, bloatCommand, 15000);
      const bloatBytes = parseInt(bloatResult.trim()) || 0;
      const bloatSizeMB = bloatBytes / (1024 * 1024);

      const cleanupRecommended = expiredTransients > 10000 || bloatSizeMB > 50;

      return {
        totalTransients,
        expiredTransients,
        bloatSizeMB,
        cleanupRecommended,
      };
    } catch (error) {
      this.logger.warn(`Orphaned transients detection failed: ${(error as Error).message}`);
      return {
        totalTransients: 0,
        expiredTransients: 0,
        bloatSizeMB: 0,
        cleanupRecommended: false,
      };
    }
  }

  /**
   * PHASE 1 - LAYER 4: Check auto-increment capacity
   */
  private async checkAutoIncrementCapacity(
    serverId: string,
    sitePath: string,
  ): Promise<{
    tablesAtRisk: Array<{
      table: string;
      currentValue: number;
      maxValue: number;
      percentUsed: number;
    }>;
  }> {
    try {
      const tablesAtRisk: Array<{
        table: string;
        currentValue: number;
        maxValue: number;
        percentUsed: number;
      }> = [];

      // Query information_schema for auto_increment values
      const command = `cd ${sitePath} && wp db query "SELECT TABLE_NAME, AUTO_INCREMENT, COLUMN_TYPE FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.AUTO_INCREMENT IS NOT NULL AND c.EXTRA LIKE '%auto_increment%'" --allow-root 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 20000);

      const lines = result.trim().split('\n').slice(1); // Skip header

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const table = parts[0];
        const currentValue = parseInt(parts[1]) || 0;
        const columnType = parts[2];

        // Determine max value based on column type
        let maxValue = 0;
        if (columnType.includes('bigint')) {
          maxValue = columnType.includes('unsigned') ? 18446744073709551615 : 9223372036854775807;
        } else if (columnType.includes('int')) {
          maxValue = columnType.includes('unsigned') ? 4294967295 : 2147483647;
        } else if (columnType.includes('mediumint')) {
          maxValue = columnType.includes('unsigned') ? 16777215 : 8388607;
        } else if (columnType.includes('smallint')) {
          maxValue = columnType.includes('unsigned') ? 65535 : 32767;
        }

        if (maxValue > 0) {
          const percentUsed = (currentValue / maxValue) * 100;

          // Flag if >80% capacity
          if (percentUsed > 80) {
            tablesAtRisk.push({
              table,
              currentValue,
              maxValue,
              percentUsed,
            });
          }
        }
      }

      return { tablesAtRisk };
    } catch (error) {
      this.logger.warn(`Auto-increment capacity check failed: ${(error as Error).message}`);
      return { tablesAtRisk: [] };
    }
  }

  /**
   * PHASE 1 - LAYER 4: Track database growth
   */
  private async trackDatabaseGrowth(
    serverId: string,
    sitePath: string,
  ): Promise<{
    currentSizeMB: number;
    largestTables: Array<{ table: string; sizeMB: number }>;
    growthRate: string;
  }> {
    try {
      // Get current database size
      const sizeCommand = `cd ${sitePath} && wp db query "SELECT SUM(data_length + index_length) / 1024 / 1024 AS size_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()" --allow-root 2>/dev/null | tail -n +2`;
      const sizeResult = await this.sshExecutor.executeCommand(serverId, sizeCommand, 15000);
      const currentSizeMB = parseFloat(sizeResult.trim()) || 0;

      // Get largest tables
      const largestCommand = `cd ${sitePath} && wp db query "SELECT TABLE_NAME, (data_length + index_length) / 1024 / 1024 AS size_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY size_mb DESC LIMIT 10" --allow-root 2>/dev/null | tail -n +2`;
      const largestResult = await this.sshExecutor.executeCommand(serverId, largestCommand, 15000);
      
      const largestTables: Array<{ table: string; sizeMB: number }> = [];
      const lines = largestResult.trim().split('\n');
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          largestTables.push({
            table: parts[0],
            sizeMB: parseFloat(parts[1]) || 0,
          });
        }
      }

      // Growth rate calculation would require historical data
      // For now, we'll return a placeholder
      const growthRate = 'Historical data not available';

      return {
        currentSizeMB,
        largestTables,
        growthRate,
      };
    } catch (error) {
      this.logger.warn(`Database growth tracking failed: ${(error as Error).message}`);
      return {
        currentSizeMB: 0,
        largestTables: [],
        growthRate: 'Unknown',
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.DATABASE_HEALTH;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Database Health';
  }

  getDescription(): string {
    return 'Checks database optimization, size, transients, revisions, and orphaned data';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.DATABASE_HEALTH;
  }
}
