import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';
import { SecureDatabaseAccess } from '../../utils/secure-database-access';
import { RetryHandler } from '../../utils/retry-handler';
import { CircuitBreakerManager } from '../../utils/circuit-breaker';

@Injectable()
export class TableCorruptionCheckService implements IDiagnosisCheckService {
  private readonly logger = new Logger(TableCorruptionCheckService.name);
  private readonly secureDatabaseAccess: SecureDatabaseAccess;

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService
  ) {
    this.secureDatabaseAccess = new SecureDatabaseAccess(sshExecutor);
  }

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Checking database table corruption for site: ${domain}`);

      // Get database connection info
      const dbConfig = await this.getDatabaseConfig(serverId, sitePath);
      if (!dbConfig) {
        throw new Error('Unable to retrieve database configuration');
      }

      // Check all WordPress tables for corruption with circuit breaker
      const corruptionResults = await CircuitBreakerManager.execute(
        `table-corruption-${serverId}`,
        () => RetryHandler.executeWithRetry(
          () => this.checkTableCorruption(serverId, dbConfig),
          { maxRetries: 2 }
        ),
        () => []
      );
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'All database tables are healthy';
      const recommendations: string[] = [];

      const corruptedTables = corruptionResults.filter(result => result.status === 'corrupt' || result.status === 'error');
      const warningTables = corruptionResults.filter(result => result.status === 'warning');

      if (corruptedTables.length > 0) {
        const criticalTables = corruptedTables.filter(table => 
          ['wp_posts', 'wp_options', 'wp_users', 'wp_usermeta'].some(critical => table.tableName.includes(critical))
        );
        
        if (criticalTables.length > 0) {
          status = CheckStatus.FAIL;
          score = 10;
          message = `Critical database corruption: ${criticalTables.length} core tables corrupted`;
          recommendations.push('URGENT: Restore database from backup immediately');
          recommendations.push('Run REPAIR TABLE on corrupted tables');
          recommendations.push('Check disk space and file system integrity');
        } else {
          status = CheckStatus.FAIL;
          score = 30;
          message = `Database corruption detected: ${corruptedTables.length} tables corrupted`;
          recommendations.push('Run REPAIR TABLE on corrupted tables');
          recommendations.push('Backup database before attempting repairs');
        }
      } else if (warningTables.length > 0) {
        status = CheckStatus.WARNING;
        score = 70;
        message = `${warningTables.length} tables have warnings`;
        recommendations.push('Monitor tables with warnings');
        recommendations.push('Consider running OPTIMIZE TABLE');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          totalTables: corruptionResults.length,
          healthyTables: corruptionResults.filter(r => r.status === 'ok').length,
          corruptedTables: corruptedTables.length,
          warningTables: warningTables.length,
          tableResults: corruptionResults,
          databaseName: dbConfig.name
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Table corruption check failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Table corruption check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.TABLE_CORRUPTION_CHECK;
  }

  getPriority(): CheckPriority {
    return CheckPriority.CRITICAL;
  }

  getName(): string {
    return 'Database Table Corruption Check';
  }

  getDescription(): string {
    return 'Checks WordPress database tables for corruption using CHECK TABLE command';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.TABLE_CORRUPTION_CHECK;
  }

  private async getDatabaseConfig(serverId: string, sitePath: string): Promise<any> {
    try {
      // Method 1: Try WP-CLI config get
      try {
        const dbConfigOutput = await this.wpCli.execute(serverId, sitePath, 'config get --format=json');
        
        // Clean and parse JSON output
        const cleanOutput = dbConfigOutput.trim();
        const jsonStart = cleanOutput.indexOf('{');
        const jsonEnd = cleanOutput.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonString = cleanOutput.substring(jsonStart, jsonEnd);
          const config = JSON.parse(jsonString);
          
          return {
            host: config.DB_HOST || 'localhost',
            name: config.DB_NAME,
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            prefix: config.table_prefix || 'wp_'
          };
        }
      } catch (wpCliError) {
        this.logger.warn('WP-CLI config get failed, trying fallback method');
      }

      // Method 2: Fallback - Parse wp-config.php directly
      return await this.parseWpConfigFile(serverId, sitePath);
    } catch (error) {
      this.logger.error('All methods to get database config failed:', error);
      return null;
    }
  }

  private async parseWpConfigFile(serverId: string, sitePath: string): Promise<any> {
    try {
      const wpConfigPath = `${sitePath}/wp-config.php`;
      const command = `cat "${wpConfigPath}"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (!result.success || !result.output) {
        return null;
      }

      const content = result.output;
      
      // Extract database configuration using regex
      const dbName = this.extractDefine(content, 'DB_NAME');
      const dbUser = this.extractDefine(content, 'DB_USER');
      const dbPassword = this.extractDefine(content, 'DB_PASSWORD');
      const dbHost = this.extractDefine(content, 'DB_HOST') || 'localhost';
      const tablePrefix = this.extractVariable(content, 'table_prefix') || 'wp_';

      if (!dbName || !dbUser) {
        this.logger.error('Could not extract required database credentials from wp-config.php');
        return null;
      }

      return {
        host: dbHost,
        name: dbName,
        user: dbUser,
        password: dbPassword || '',
        prefix: tablePrefix
      };
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
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private extractVariable(content: string, variable: string): string | null {
    const patterns = [
      new RegExp(`\\$${variable}\\s*=\\s*['"]([^'"]+)['"]`, 'i'),
      new RegExp(`\\$${variable}\\s*=\\s*"([^"]+)"`, 'i'),
      new RegExp(`\\$${variable}\\s*=\\s*'([^']+)'`, 'i')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async checkTableCorruption(serverId: string, dbConfig: any): Promise<any[]> {
    try {
      console.log('[TableCorruptionCheck] Starting table corruption check');
      console.log('[TableCorruptionCheck] Database config:', { ...dbConfig, password: '***' });
      
      // Get list of WordPress tables using SecureDatabaseAccess
      console.log('[TableCorruptionCheck] Getting tables with prefix:', dbConfig.prefix);
      let tables: string[] = [];
      
      try {
        tables = await this.secureDatabaseAccess.getTables(serverId, dbConfig, dbConfig.prefix);
        console.log('[TableCorruptionCheck] Found tables via MySQL:', tables.length);
      } catch (mysqlError) {
        console.error('[TableCorruptionCheck] MySQL getTables failed:', mysqlError);
        
        // Fallback: Try using WP-CLI to get tables
        try {
          console.log('[TableCorruptionCheck] Trying WP-CLI fallback for table list');
          const wpCliCommand = `wp db tables --format=csv --allow-root`;
          const wpCliResult = await this.sshExecutor.executeCommand(serverId, wpCliCommand, 30000);
          
          if (wpCliResult) {
            tables = wpCliResult
              .trim()
              .split('\n')
              .filter(line => line && line.startsWith(dbConfig.prefix))
              .map(line => line.trim());
            console.log('[TableCorruptionCheck] Found tables via WP-CLI:', tables.length);
          }
        } catch (wpCliError) {
          console.error('[TableCorruptionCheck] WP-CLI fallback also failed:', wpCliError);
          throw new Error('Failed to get table list via both MySQL and WP-CLI');
        }
      }
      
      if (tables.length === 0) {
        this.logger.warn('No tables found with prefix: ' + dbConfig.prefix);
        return [];
      }
      
      const results: any[] = [];

      // Check each table for corruption
      for (const tableName of tables) {
        try {
          console.log('[TableCorruptionCheck] Checking table:', tableName);
          const checkResult = await this.secureDatabaseAccess.checkTable(serverId, dbConfig, tableName);
          results.push({
            tableName: checkResult.tableName,
            operation: checkResult.operation,
            messageType: checkResult.messageType,
            status: this.normalizeTableStatus(checkResult.status),
            message: checkResult.message,
          });
        } catch (tableError) {
          this.logger.error(`Failed to check table ${tableName}:`, tableError);
          results.push({
            tableName,
            operation: 'check',
            messageType: 'error',
            status: 'error',
            message: tableError instanceof Error ? tableError.message : 'Unknown error',
          });
        }
      }

      console.log('[TableCorruptionCheck] Check complete. Results:', results.length);
      return results;
    } catch (error) {
      this.logger.error('Failed to check table corruption:', error);
      console.error('[TableCorruptionCheck] Fatal error:', error);
      throw error;
    }
  }

  private normalizeTableStatus(status: string): string {
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('ok')) {
      return 'ok';
    } else if (lowerStatus.includes('corrupt') || lowerStatus.includes('crashed')) {
      return 'corrupt';
    } else if (lowerStatus.includes('warning') || lowerStatus.includes('repair')) {
      return 'warning';
    } else {
      return 'error';
    }
  }
}