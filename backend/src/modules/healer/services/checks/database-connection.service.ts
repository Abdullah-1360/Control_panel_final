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
 * Database Connection Service
 * Checks if WordPress can connect to the database
 */
@Injectable()
export class DatabaseConnectionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(DatabaseConnectionService.name);

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
    const recommendations: string[] = [];

    try {
      this.logger.log(`Checking database connection for ${domain}`);

      // Step 1: Parse wp-config.php to extract database credentials
      const dbConfig = await this.parseWpConfig(serverId, sitePath);
      
      if (!dbConfig) {
        return {
          checkType: this.getCheckType(),
          status: CheckStatus.ERROR,
          score: 0,
          message: 'Failed to parse wp-config.php',
          details: { error: 'Could not extract database credentials from wp-config.php' },
          recommendations: [
            'Verify wp-config.php exists and is readable',
            'Check wp-config.php syntax',
          ],
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Step 2: Test actual database connection with those credentials
      const connectionResult = await this.testDatabaseConnection(serverId, dbConfig);

      let status: CheckStatus;
      let message: string;
      let score = 100;
      const integrityDetails: any = {};

      if (connectionResult.connected) {
        // Step 3: Verify WordPress integrity (Core 12 tables check)
        const integrityResult = await this.verifyWordPressIntegrity(serverId, dbConfig);
        
        integrityDetails.coreTablesCheck = integrityResult.coreTablesCheck;
        integrityDetails.bloatAnalysis = integrityResult.bloatAnalysis;
        
        if (integrityResult.coreTablesCheck.allPresent) {
          status = CheckStatus.PASS;
          message = `Database connection successful. All ${integrityResult.coreTablesCheck.presentCount}/12 core tables present.`;
          score = 100;
          
          // Add bloat warnings if detected
          if (integrityResult.bloatAnalysis.bloatedTables.length > 0) {
            const bloatedTableNames = integrityResult.bloatAnalysis.bloatedTables.map(t => t.name).join(', ');
            recommendations.push(`Performance bottleneck detected: ${bloatedTableNames} - consider cleanup`);
          }
        } else {
          status = CheckStatus.FAIL;
          message = `Database connected but WordPress is corrupted. Missing ${integrityResult.coreTablesCheck.missingCount}/12 core tables.`;
          score = 30; // Connection works but WordPress is broken
          
          recommendations.push(`Missing core tables: ${integrityResult.coreTablesCheck.missingTables.join(', ')}`);
          recommendations.push('WordPress installation is corrupted');
          recommendations.push('Restore database from backup or reinstall WordPress');
        }
      } else {
        status = CheckStatus.FAIL;
        score = 0;
        
        // Categorize the error and provide specific recommendations
        switch (connectionResult.errorType) {
          case 'CONNECTION_REFUSED': // Error 2002
            message = `MySQL server is down or unreachable (Error 2002)`;
            recommendations.push('Check if MySQL/MariaDB service is running');
            recommendations.push(`Verify DB_HOST is correct: ${dbConfig.host}`);
            recommendations.push('If using "localhost", try "127.0.0.1" or vice versa');
            recommendations.push('Check firewall rules if using remote database');
            break;
            
          case 'ACCESS_DENIED': // Error 1045
            message = `Database credentials are incorrect (Error 1045)`;
            recommendations.push('AUTOMATABLE: Database password mismatch detected');
            recommendations.push(`Verify DB_USER (${dbConfig.user}) has correct password`);
            recommendations.push('Check if password was changed in cPanel but not in wp-config.php');
            recommendations.push('Update wp-config.php with correct credentials');
            break;
            
          case 'UNKNOWN_DATABASE': // Error 1049
            message = `Database "${dbConfig.name}" does not exist (Error 1049)`;
            recommendations.push(`Database ${dbConfig.name} has been deleted`);
            recommendations.push('Restore database from backup');
            recommendations.push('Or create new database and import backup');
            recommendations.push('Verify database name in wp-config.php is correct');
            break;
            
          case 'MYSQL_NOT_FOUND':
            message = 'MySQL client not available on server';
            recommendations.push('Install MySQL client: apt-get install mysql-client or yum install mysql');
            recommendations.push('Verify MySQL/MariaDB is installed');
            break;
            
          default:
            message = `Database connection failed: ${connectionResult.error}`;
            recommendations.push('Check wp-config.php database credentials');
            recommendations.push('Verify MySQL/MariaDB service is running');
            recommendations.push('Check database server connectivity');
            recommendations.push('Verify database user permissions');
        }
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          connected: connectionResult.connected,
          dbHost: dbConfig.host,
          dbName: dbConfig.name,
          dbUser: dbConfig.user,
          tablePrefix: dbConfig.prefix,
          errorType: connectionResult.errorType,
          errorCode: connectionResult.errorCode,
          errorMessage: connectionResult.error,
          rawOutput: connectionResult.rawOutput?.substring(0, 500),
          ...integrityDetails,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Database connection check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Database connection check failed: ${err.message}`,
        details: { error: err.message },
        recommendations: [
          'Check wp-config.php exists and is readable',
          'Verify MySQL/MariaDB service is running',
          'Ensure proper file permissions',
        ],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Parse wp-config.php to extract database credentials and table prefix
   */
  private async parseWpConfig(serverId: string, sitePath: string): Promise<{
    host: string;
    name: string;
    user: string;
    password: string;
    prefix: string;
  } | null> {
    try {
      const wpConfigPath = `${sitePath}/wp-config.php`;
      const command = `cat "${wpConfigPath}"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (!result.success || !result.output) {
        this.logger.error('Failed to read wp-config.php');
        return null;
      }

      const content = result.output;
      
      // Extract database configuration using regex
      const dbName = this.extractDefine(content, 'DB_NAME');
      const dbUser = this.extractDefine(content, 'DB_USER');
      const dbPassword = this.extractDefine(content, 'DB_PASSWORD');
      const dbHost = this.extractDefine(content, 'DB_HOST') || 'localhost';
      
      // Extract table prefix
      const prefix = this.extractTablePrefix(content) || 'wp_';

      if (!dbName || !dbUser) {
        this.logger.error('Could not extract required database credentials from wp-config.php');
        return null;
      }

      this.logger.log(`Extracted DB config: host=${dbHost}, name=${dbName}, user=${dbUser}, prefix=${prefix}`);

      return {
        host: dbHost,
        name: dbName,
        user: dbUser,
        password: dbPassword || '',
        prefix: prefix,
      };
    } catch (error) {
      this.logger.error('Failed to parse wp-config.php:', error);
      return null;
    }
  }

  /**
   * Extract define() value from wp-config.php content
   */
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

  /**
   * Extract table prefix from wp-config.php content
   */
  private extractTablePrefix(content: string): string | null {
    const patterns = [
      /\$table_prefix\s*=\s*['"]([^'"]+)['"]/,
      /\$table_prefix\s*=\s*"([^"]+)"/,
      /\$table_prefix\s*=\s*'([^']+)'/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Test database connection using extracted credentials
   * Categorizes errors by MySQL error code
   */
  private async testDatabaseConnection(serverId: string, dbConfig: {
    host: string;
    name: string;
    user: string;
    password: string;
    prefix: string;
  }): Promise<{
    connected: boolean;
    errorType?: 'CONNECTION_REFUSED' | 'ACCESS_DENIED' | 'UNKNOWN_DATABASE' | 'MYSQL_NOT_FOUND' | 'OTHER';
    errorCode?: string;
    error?: string;
    rawOutput?: string;
  }> {
    try {
      // Escape password for shell (handle special characters)
      const escapedPassword = dbConfig.password.replace(/'/g, "'\\''");
      
      // Method 1: Try mysqladmin ping (fastest, most reliable)
      const pingCommand = `mysqladmin -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ping 2>&1`;
      const pingResult = await this.sshExecutor.executeCommandDetailed(serverId, pingCommand, 10000);
      
      const pingOutput = pingResult.output || pingResult.error || '';
      
      // Check for success (mysqladmin ping returns "mysqld is alive")
      if (pingOutput.includes('mysqld is alive')) {
        // Connection to MySQL works, now test database access
        const dbTestCommand = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT 1;" 2>&1`;
        const dbTestResult = await this.sshExecutor.executeCommandDetailed(serverId, dbTestCommand, 10000);
        
        const dbTestOutput = dbTestResult.output || dbTestResult.error || '';
        
        // Check for success (should contain "1" in output)
        if (dbTestOutput.includes('| 1 |') || (dbTestResult.success && !dbTestOutput.toLowerCase().includes('error'))) {
          return {
            connected: true,
            rawOutput: dbTestOutput,
          };
        }
        
        // Database test failed - categorize error
        if (dbTestOutput.includes('ERROR 1049') || dbTestOutput.includes('Unknown database')) {
          return {
            connected: false,
            errorType: 'UNKNOWN_DATABASE',
            errorCode: '1049',
            error: `Database ${dbConfig.name} does not exist`,
            rawOutput: dbTestOutput,
          };
        }
        
        // Other database error
        return {
          connected: false,
          errorType: 'OTHER',
          error: dbTestOutput.substring(0, 200),
          rawOutput: dbTestOutput,
        };
      }
      
      // Categorize MySQL errors from ping command
      if (pingOutput.includes('ERROR 2002') || pingOutput.includes('Connection refused') || pingOutput.includes("Can't connect")) {
        return {
          connected: false,
          errorType: 'CONNECTION_REFUSED',
          errorCode: '2002',
          error: 'MySQL server is down or DB_HOST is incorrect',
          rawOutput: pingOutput,
        };
      }

      if (pingOutput.includes('ERROR 1045') || pingOutput.includes('Access denied')) {
        return {
          connected: false,
          errorType: 'ACCESS_DENIED',
          errorCode: '1045',
          error: 'Database credentials are incorrect',
          rawOutput: pingOutput,
        };
      }

      if (pingOutput.includes('mysqladmin: command not found') || pingOutput.includes('mysqladmin: not found')) {
        // Fallback to mysql command if mysqladmin not available
        const fallbackCommand = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT 1;" 2>&1`;
        const fallbackResult = await this.sshExecutor.executeCommandDetailed(serverId, fallbackCommand, 10000);
        
        const fallbackOutput = fallbackResult.output || fallbackResult.error || '';
        
        // Check for success
        if (fallbackOutput.includes('| 1 |') || (fallbackResult.success && !fallbackOutput.toLowerCase().includes('error'))) {
          return {
            connected: true,
            rawOutput: fallbackOutput,
          };
        }
        
        // Categorize errors from fallback
        if (fallbackOutput.includes('ERROR 2002') || fallbackOutput.includes('Connection refused')) {
          return {
            connected: false,
            errorType: 'CONNECTION_REFUSED',
            errorCode: '2002',
            error: 'MySQL server is down or DB_HOST is incorrect',
            rawOutput: fallbackOutput,
          };
        }
        
        if (fallbackOutput.includes('ERROR 1045') || fallbackOutput.includes('Access denied')) {
          return {
            connected: false,
            errorType: 'ACCESS_DENIED',
            errorCode: '1045',
            error: 'Database credentials are incorrect',
            rawOutput: fallbackOutput,
          };
        }
        
        if (fallbackOutput.includes('ERROR 1049') || fallbackOutput.includes('Unknown database')) {
          return {
            connected: false,
            errorType: 'UNKNOWN_DATABASE',
            errorCode: '1049',
            error: `Database ${dbConfig.name} does not exist`,
            rawOutput: fallbackOutput,
          };
        }
        
        if (fallbackOutput.includes('mysql: command not found') || fallbackOutput.includes('mysql: not found')) {
          return {
            connected: false,
            errorType: 'MYSQL_NOT_FOUND',
            error: 'MySQL client not installed',
            rawOutput: fallbackOutput,
          };
        }
        
        return {
          connected: false,
          errorType: 'OTHER',
          error: fallbackOutput.substring(0, 200),
          rawOutput: fallbackOutput,
        };
      }

      // Unknown error
      return {
        connected: false,
        errorType: 'OTHER',
        error: pingOutput.substring(0, 200),
        rawOutput: pingOutput,
      };
    } catch (error) {
      return {
        connected: false,
        errorType: 'OTHER',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Verify WordPress integrity by checking for core 12 tables and identifying bloat
   */
  private async verifyWordPressIntegrity(serverId: string, dbConfig: {
    host: string;
    name: string;
    user: string;
    password: string;
    prefix: string;
  }): Promise<{
    coreTablesCheck: {
      allPresent: boolean;
      presentCount: number;
      missingCount: number;
      missingTables: string[];
      presentTables: string[];
    };
    bloatAnalysis: {
      bloatedTables: Array<{
        name: string;
        sizeMB: number;
        type: 'options' | 'logs' | 'other';
      }>;
      totalBloatMB: number;
    };
  }> {
    // WordPress core 12 required tables (without prefix)
    const CORE_TABLES = [
      'posts',
      'postmeta',
      'options',
      'users',
      'usermeta',
      'terms',
      'term_taxonomy',
      'term_relationships',
      'termmeta',
      'comments',
      'commentmeta',
      'links',
    ];

    try {
      // Escape password for shell
      const escapedPassword = dbConfig.password.replace(/'/g, "'\\''");
      
      // Get all tables with the WordPress prefix
      const showTablesCommand = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SHOW TABLES;" 2>&1`;
      const tablesResult = await this.sshExecutor.executeCommandDetailed(serverId, showTablesCommand, 10000);

      if (!tablesResult.success || !tablesResult.output) {
        throw new Error('Failed to retrieve tables list');
      }

      // Parse table names from output
      const tableLines = tablesResult.output.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('Tables_in_') && 
               !trimmed.startsWith('mysql:') &&
               !trimmed.startsWith('Warning:');
      });
      const existingTables = tableLines.map(line => line.trim());

      // Check which core tables are present
      const presentTables: string[] = [];
      const missingTables: string[] = [];

      for (const coreTable of CORE_TABLES) {
        const fullTableName = `${dbConfig.prefix}${coreTable}`;
        if (existingTables.includes(fullTableName)) {
          presentTables.push(coreTable);
        } else {
          missingTables.push(coreTable);
        }
      }

      // Get table sizes for bloat analysis
      const tableSizeCommand = `mysql -u ${dbConfig.user} -p'${escapedPassword}' -h ${dbConfig.host} ${dbConfig.name} -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb FROM information_schema.TABLES WHERE table_schema = '${dbConfig.name}' AND table_name LIKE '${dbConfig.prefix}%' ORDER BY (data_length + index_length) DESC LIMIT 20;" 2>&1`;
      const sizeResult = await this.sshExecutor.executeCommandDetailed(serverId, tableSizeCommand, 10000);

      const bloatedTables: Array<{ name: string; sizeMB: number; type: 'options' | 'logs' | 'other' }> = [];
      let totalBloatMB = 0;

      if (sizeResult.success && sizeResult.output) {
        const sizeLines = sizeResult.output.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.startsWith('table_name') && 
                 !trimmed.startsWith('mysql:') &&
                 !trimmed.startsWith('Warning:');
        });
        
        for (const line of sizeLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const tableName = parts[0];
            const sizeMB = parseFloat(parts[1]);

            if (isNaN(sizeMB)) continue;

            // Identify bloat: options table > 50MB, log tables > 100MB, other tables > 500MB
            let isBloated = false;
            let type: 'options' | 'logs' | 'other' = 'other';

            if (tableName === `${dbConfig.prefix}options` && sizeMB > 50) {
              isBloated = true;
              type = 'options';
            } else if (tableName.toLowerCase().includes('log') && sizeMB > 100) {
              isBloated = true;
              type = 'logs';
            } else if (sizeMB > 500) {
              isBloated = true;
              type = 'other';
            }

            if (isBloated) {
              bloatedTables.push({ name: tableName, sizeMB, type });
              totalBloatMB += sizeMB;
            }
          }
        }
      }

      return {
        coreTablesCheck: {
          allPresent: missingTables.length === 0,
          presentCount: presentTables.length,
          missingCount: missingTables.length,
          missingTables,
          presentTables,
        },
        bloatAnalysis: {
          bloatedTables,
          totalBloatMB,
        },
      };
    } catch (error) {
      this.logger.error('Failed to verify WordPress integrity:', error);
      
      // Return default values on error
      return {
        coreTablesCheck: {
          allPresent: false,
          presentCount: 0,
          missingCount: 12,
          missingTables: [],
          presentTables: [],
        },
        bloatAnalysis: {
          bloatedTables: [],
          totalBloatMB: 0,
        },
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.DATABASE_CONNECTION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.CRITICAL;
  }

  getName(): string {
    return 'Database Connection';
  }

  getDescription(): string {
    return 'Checks if WordPress can connect to the database';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.DATABASE_CONNECTION;
  }
}
