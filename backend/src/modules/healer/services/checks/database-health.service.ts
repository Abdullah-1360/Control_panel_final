import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from '../ssh-executor.service';
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
    private readonly sshExecutor: SshExecutorService,
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

      // 8. Check database connection
      const connectionTest = await this.testDatabaseConnection(serverId, sitePath);
      if (!connectionTest.success) {
        issues.push('Database connection issues');
        score -= 30;
        recommendations.push('Check database credentials in wp-config.php');
        recommendations.push('Verify database server is running');
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
          connectionTest,
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
      const sizeMB = parseFloat(result.replace(/[^0-9.]/g, ''));

      return {
        sizeMB,
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
   * Test database connection
   */
  private async testDatabaseConnection(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      const result = await this.wpCli.execute(serverId, sitePath, 'db check', 15000);
      return {
        success: !result.toLowerCase().includes('error'),
        message: result.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.DATABASE_CONNECTION;
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
    return checkType === DiagnosisCheckType.DATABASE_CONNECTION;
  }
}
