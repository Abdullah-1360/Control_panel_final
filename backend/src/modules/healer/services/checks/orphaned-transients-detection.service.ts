import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';

@Injectable()
export class OrphanedTransientsDetectionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(OrphanedTransientsDetectionService.name);

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService
  ) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Detecting orphaned transients for site: ${domain}`);

      // Get database connection info
      const dbConfig = await this.getDatabaseConfig(serverId, sitePath);
      if (!dbConfig) {
        throw new Error('Unable to retrieve database configuration');
      }

      // Analyze transients in the database
      const transientAnalysis = await this.analyzeTransients(serverId, dbConfig);
      
      let status = CheckStatus.PASS;
      let score = 100;
      let message = 'Transients are well managed';
      const recommendations: string[] = [];

      const { totalTransients, expiredTransients, orphanedTransients, sizeImpact } = transientAnalysis;

      if (expiredTransients > 10000) {
        status = CheckStatus.FAIL;
        score = 20;
        message = `Critical: ${expiredTransients} expired transients causing database bloat`;
        recommendations.push('Clean up expired transients immediately');
        recommendations.push('Consider implementing automatic transient cleanup');
        recommendations.push('Review plugins that create excessive transients');
      } else if (expiredTransients > 5000) {
        status = CheckStatus.WARNING;
        score = 50;
        message = `Warning: ${expiredTransients} expired transients detected`;
        recommendations.push('Schedule transient cleanup');
        recommendations.push('Monitor transient creation patterns');
      } else if (expiredTransients > 1000) {
        status = CheckStatus.WARNING;
        score = 75;
        message = `${expiredTransients} expired transients found`;
        recommendations.push('Consider periodic transient cleanup');
      }

      if (orphanedTransients > 100) {
        status = CheckStatus.WARNING;
        score = Math.min(score, 60);
        recommendations.push('Clean up orphaned transient timeout entries');
      }

      if (sizeImpact > 50) { // More than 50MB
        recommendations.push(`Transients consuming ${sizeImpact.toFixed(1)}MB of database space`);
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          totalTransients,
          expiredTransients,
          orphanedTransients,
          activeTransients: totalTransients - expiredTransients,
          sizeImpactMB: Math.round(sizeImpact * 10) / 10,
          databaseName: dbConfig.name,
          tablePrefix: dbConfig.prefix,
          cleanupRecommended: expiredTransients > 1000
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Orphaned transients detection failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Orphaned transients detection failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.ORPHANED_TRANSIENTS_DETECTION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Orphaned Transients Detection';
  }

  getDescription(): string {
    return 'Detects expired and orphaned transients that cause database bloat';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.ORPHANED_TRANSIENTS_DETECTION;
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
          
          try {
            const config = JSON.parse(jsonString);
            
            return {
              host: config.DB_HOST || 'localhost',
              name: config.DB_NAME,
              user: config.DB_USER,
              password: config.DB_PASSWORD,
              prefix: config.table_prefix || 'wp_'
            };
          } catch (parseError) {
            this.logger.warn('Failed to parse WP-CLI config output, trying fallback method');
          }
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

  private async analyzeTransients(serverId: string, dbConfig: any): Promise<any> {
    try {
      const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
      
      // Count total transients
      const totalQuery = `SELECT COUNT(*) as count FROM ${dbConfig.prefix}options WHERE option_name LIKE '_transient_%'`;
      const totalResult = await this.executeQuery(serverId, dbConfig, totalQuery);
      const totalTransients = totalResult ? parseInt(totalResult.count) : 0;

      // Count expired transients
      const expiredQuery = `
        SELECT COUNT(*) as count 
        FROM ${dbConfig.prefix}options o1 
        JOIN ${dbConfig.prefix}options o2 ON o2.option_name = CONCAT('_transient_timeout_', SUBSTRING(o1.option_name, 12))
        WHERE o1.option_name LIKE '_transient_%' 
        AND o1.option_name NOT LIKE '_transient_timeout_%'
        AND CAST(o2.option_value AS UNSIGNED) < ${now}
      `;
      const expiredResult = await this.executeQuery(serverId, dbConfig, expiredQuery);
      const expiredTransients = expiredResult ? parseInt(expiredResult.count) : 0;

      // Count orphaned transients (transients without timeout entries)
      const orphanedQuery = `
        SELECT COUNT(*) as count 
        FROM ${dbConfig.prefix}options o1 
        LEFT JOIN ${dbConfig.prefix}options o2 ON o2.option_name = CONCAT('_transient_timeout_', SUBSTRING(o1.option_name, 12))
        WHERE o1.option_name LIKE '_transient_%' 
        AND o1.option_name NOT LIKE '_transient_timeout_%'
        AND o2.option_name IS NULL
      `;
      const orphanedResult = await this.executeQuery(serverId, dbConfig, orphanedQuery);
      const orphanedTransients = orphanedResult ? parseInt(orphanedResult.count) : 0;

      // Calculate size impact
      const sizeQuery = `
        SELECT SUM(LENGTH(option_value)) as total_size 
        FROM ${dbConfig.prefix}options 
        WHERE option_name LIKE '_transient_%'
      `;
      const sizeResult = await this.executeQuery(serverId, dbConfig, sizeQuery);
      const sizeImpact = sizeResult ? (parseInt(sizeResult.total_size) / 1024 / 1024) : 0; // Convert to MB

      return {
        totalTransients,
        expiredTransients,
        orphanedTransients,
        sizeImpact
      };
    } catch (error) {
      this.logger.error('Failed to analyze transients:', error);
      throw error;
    }
  }

  private async executeQuery(serverId: string, dbConfig: any, query: string): Promise<any> {
    try {
      const command = `mysql -h "${dbConfig.host}" -u "${dbConfig.user}" -p"${dbConfig.password}" "${dbConfig.name}" -e "${query}" -s --skip-column-names`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);
      
      if (result.success && result.output) {
        const lines = result.output.trim().split('\n');
        const values = lines[0].split('\t');
        
        // Return as object with column names
        if (query.includes('COUNT(*)')) {
          return { count: values[0] };
        } else if (query.includes('SUM(LENGTH')) {
          return { total_size: values[0] || '0' };
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to execute query:', error);
      return null;
    }
  }
}