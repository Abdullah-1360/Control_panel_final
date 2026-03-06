/**
 * Secure Database Access Utility
 * Provides secure methods for database operations without exposing credentials
 */

import { SSHExecutorService } from '../services/ssh-executor.service';
import { CommandSanitizer } from './command-sanitizer';

export interface DatabaseConfig {
  host: string;
  name: string;
  user: string;
  password: string;
  prefix?: string;
}

export class SecureDatabaseAccess {
  constructor(private readonly sshExecutor: SSHExecutorService) {}

  /**
   * Create MySQL config file on remote server
   * Uses printf for reliable file creation over SSH
   */
  private async createConfigFile(
    serverId: string,
    configFile: string,
    dbConfig: DatabaseConfig
  ): Promise<void> {
    const configContent = CommandSanitizer.createMySQLConfigContent({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name
    });
    
    console.log('[SecureDatabaseAccess] Creating config file:', configFile);
    console.log('[SecureDatabaseAccess] Config (password hidden):', configContent.replace(dbConfig.password, '***'));
    
    // Split into lines and use printf for each line (more reliable than heredoc over SSH)
    const lines = configContent.split('\n').filter(line => line.trim() || line === '');
    const commands: string[] = [];
    
    lines.forEach((line, index) => {
      // Escape single quotes in the line
      const escapedLine = line.replace(/'/g, "'\\''");
      
      if (index === 0) {
        // First line: create file
        commands.push(`printf '%s\\n' '${escapedLine}' > ${configFile}`);
      } else {
        // Subsequent lines: append
        commands.push(`printf '%s\\n' '${escapedLine}' >> ${configFile}`);
      }
    });
    
    // Add chmod command
    commands.push(`chmod 600 ${configFile}`);
    
    const createCommand = commands.join(' && ');
    console.log('[SecureDatabaseAccess] Create command length:', createCommand.length);
    
    const result = await this.sshExecutor.executeCommand(serverId, createCommand, 5000);
    console.log('[SecureDatabaseAccess] Config file created, result:', result);
    
    // Verify file was created
    const verifyCommand = `test -f ${configFile} && echo "exists" || echo "not_found"`;
    const verifyResult = await this.sshExecutor.executeCommand(serverId, verifyCommand, 5000);
    console.log('[SecureDatabaseAccess] Config file verification:', verifyResult.trim());
    
    if (verifyResult.trim() !== 'exists') {
      throw new Error('Failed to create MySQL config file');
    }
  }

  /**
   * Execute MySQL query securely using temporary config file
   */
  async executeQuery(
    serverId: string,
    dbConfig: DatabaseConfig,
    query: string,
    timeout = 30000
  ): Promise<string> {
    const configFile = `/tmp/.my.cnf.${Date.now()}.${Math.random().toString(36).substring(7)}`;
    
    try {
      console.log('[SecureDatabaseAccess] executeQuery called');
      console.log('[SecureDatabaseAccess] DB Config:', { ...dbConfig, password: '***' });
      console.log('[SecureDatabaseAccess] Query:', query.substring(0, 100));

      // Create config file
      await this.createConfigFile(serverId, configFile, dbConfig);

      // Execute query using config file
      const escapedQuery = CommandSanitizer.escapeShellArg(query);
      const queryCommand = `mysql --defaults-file=${configFile} -e ${escapedQuery} 2>&1`;
      
      console.log('[SecureDatabaseAccess] Executing query...');
      const result = await this.sshExecutor.executeCommand(serverId, queryCommand, timeout);
      console.log('[SecureDatabaseAccess] Query result (first 200 chars):', result.substring(0, 200));
      
      // Check for MySQL errors
      if (result.includes('ERROR') || result.includes('Access denied') || result.includes('Unknown database')) {
        throw new Error(`MySQL query failed: ${result}`);
      }
      
      return result;
    } catch (error) {
      console.error('[SecureDatabaseAccess] executeQuery failed:', error);
      throw error;
    } finally {
      // Always clean up config file
      try {
        await this.sshExecutor.executeCommand(serverId, `rm -f ${configFile}`, 5000);
        console.log('[SecureDatabaseAccess] Config file cleaned up');
      } catch (error) {
        console.error('[SecureDatabaseAccess] Failed to clean up config file:', error);
      }
    }
  }

  /**
   * Execute MySQL query and return as JSON
   */
  async executeQueryJSON(
    serverId: string,
    dbConfig: DatabaseConfig,
    query: string,
    timeout = 30000
  ): Promise<any[]> {
    const configFile = `/tmp/.my.cnf.${Date.now()}.${Math.random().toString(36).substring(7)}`;
    
    try {
      console.log('[SecureDatabaseAccess] executeQueryJSON called');
      console.log('[SecureDatabaseAccess] DB Config:', { ...dbConfig, password: '***' });
      console.log('[SecureDatabaseAccess] Query:', query.substring(0, 100));

      // Create config file
      await this.createConfigFile(serverId, configFile, dbConfig);

      // Execute query with JSON output
      const escapedQuery = CommandSanitizer.escapeShellArg(query);
      const queryCommand = `mysql --defaults-file=${configFile} -e ${escapedQuery} --batch --skip-column-names 2>&1`;
      
      console.log('[SecureDatabaseAccess] Executing query...');
      const result = await this.sshExecutor.executeCommand(serverId, queryCommand, timeout);
      console.log('[SecureDatabaseAccess] Query result (first 200 chars):', result.substring(0, 200));
      
      // Check for MySQL errors
      if (result.includes('ERROR') || result.includes('Access denied') || result.includes('Unknown database')) {
        throw new Error(`MySQL query failed: ${result}`);
      }
      
      // Parse tab-separated output
      const lines = result.trim().split('\n').filter(line => line && !line.includes('ERROR'));
      const parsed = lines.map(line => {
        const values = line.split('\t');
        return values;
      });
      
      console.log('[SecureDatabaseAccess] Parsed', parsed.length, 'rows');
      return parsed;
    } catch (error) {
      console.error('[SecureDatabaseAccess] executeQueryJSON failed:', error);
      throw error;
    } finally {
      // Always clean up config file
      try {
        await this.sshExecutor.executeCommand(serverId, `rm -f ${configFile}`, 5000);
        console.log('[SecureDatabaseAccess] Config file cleaned up');
      } catch (error) {
        console.error('[SecureDatabaseAccess] Failed to clean up config file:', error);
      }
    }
  }

  /**
   * Check table corruption securely
   */
  async checkTable(
    serverId: string,
    dbConfig: DatabaseConfig,
    tableName: string
  ): Promise<{
    tableName: string;
    operation: string;
    messageType: string;
    status: string;
    message: string;
  }> {
    const sanitizedTable = CommandSanitizer.sanitizeMySQLIdentifier(tableName);
    const query = `CHECK TABLE ${sanitizedTable}`;
    
    const result = await this.executeQuery(serverId, dbConfig, query);
    
    // Parse CHECK TABLE output
    const lines = result.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split('\t');
    
    if (parts.length >= 4) {
      return {
        tableName: parts[0],
        operation: parts[1],
        messageType: parts[2],
        status: parts[3],
        message: parts[3],
      };
    }
    
    throw new Error(`Failed to parse CHECK TABLE output: ${result}`);
  }

  /**
   * Get table list securely
   */
  async getTables(
    serverId: string,
    dbConfig: DatabaseConfig,
    prefix?: string
  ): Promise<string[]> {
    try {
      console.log('[SecureDatabaseAccess] getTables called with prefix:', prefix);
      
      const pattern = prefix ? `${prefix}%` : '%';
      const query = `SHOW TABLES LIKE '${pattern}'`;
      
      console.log('[SecureDatabaseAccess] Executing SHOW TABLES query:', query);
      const result = await this.executeQuery(serverId, dbConfig, query);
      
      console.log('[SecureDatabaseAccess] SHOW TABLES raw result:', result);
      
      const tables = result
        .trim()
        .split('\n')
        .filter(line => line && !line.startsWith('Tables_in_'))
        .map(line => line.trim());
      
      console.log('[SecureDatabaseAccess] Parsed tables:', tables);
      return tables;
    } catch (error) {
      console.error('[SecureDatabaseAccess] getTables failed:', error);
      throw error;
    }
  }

  /**
   * Get table statistics securely
   */
  async getTableStats(
    serverId: string,
    dbConfig: DatabaseConfig,
    tableName: string
  ): Promise<{
    rows: number;
    dataLength: number;
    indexLength: number;
    autoIncrement: number | null;
  }> {
    const sanitizedTable = CommandSanitizer.sanitizeMySQLIdentifier(tableName);
    const sanitizedDb = CommandSanitizer.sanitizeMySQLIdentifier(dbConfig.name);
    
    const query = `
      SELECT 
        TABLE_ROWS,
        DATA_LENGTH,
        INDEX_LENGTH,
        AUTO_INCREMENT
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ${sanitizedDb}
        AND TABLE_NAME = ${sanitizedTable}
    `;
    
    const result = await this.executeQueryJSON(serverId, dbConfig, query);
    
    if (result.length > 0) {
      const row = result[0];
      return {
        rows: parseInt(row[0]) || 0,
        dataLength: parseInt(row[1]) || 0,
        indexLength: parseInt(row[2]) || 0,
        autoIncrement: row[3] ? parseInt(row[3]) : null,
      };
    }
    
    throw new Error(`Table ${tableName} not found`);
  }

  /**
   * Count transients securely
   */
  async countTransients(
    serverId: string,
    dbConfig: DatabaseConfig,
    prefix: string
  ): Promise<{
    total: number;
    expired: number;
    orphaned: number;
  }> {
    try {
      console.log('[SecureDatabaseAccess] countTransients called with prefix:', prefix);
      
      const now = Math.floor(Date.now() / 1000);
      console.log('[SecureDatabaseAccess] Current timestamp:', now);
      
      // Count total transients
      const totalQuery = `
        SELECT COUNT(*) as count 
        FROM ${prefix}options 
        WHERE option_name LIKE '_transient_%'
      `;
      console.log('[SecureDatabaseAccess] Executing total transients query');
      const totalResult = await this.executeQueryJSON(serverId, dbConfig, totalQuery);
      const total = totalResult.length > 0 && totalResult[0][0] ? parseInt(totalResult[0][0]) : 0;
      console.log('[SecureDatabaseAccess] Total transients:', total);

      // Count expired transients
      const expiredQuery = `
        SELECT COUNT(*) as count 
        FROM ${prefix}options o1 
        JOIN ${prefix}options o2 ON o2.option_name = CONCAT('_transient_timeout_', SUBSTRING(o1.option_name, 12))
        WHERE o1.option_name LIKE '_transient_%' 
          AND o1.option_name NOT LIKE '_transient_timeout_%'
          AND CAST(o2.option_value AS UNSIGNED) < ${now}
      `;
      console.log('[SecureDatabaseAccess] Executing expired transients query');
      const expiredResult = await this.executeQueryJSON(serverId, dbConfig, expiredQuery);
      const expired = expiredResult.length > 0 && expiredResult[0][0] ? parseInt(expiredResult[0][0]) : 0;
      console.log('[SecureDatabaseAccess] Expired transients:', expired);

      // Count orphaned transients
      const orphanedQuery = `
        SELECT COUNT(*) as count 
        FROM ${prefix}options o1 
        LEFT JOIN ${prefix}options o2 ON o2.option_name = CONCAT('_transient_timeout_', SUBSTRING(o1.option_name, 12))
        WHERE o1.option_name LIKE '_transient_%' 
          AND o1.option_name NOT LIKE '_transient_timeout_%'
          AND o2.option_name IS NULL
      `;
      console.log('[SecureDatabaseAccess] Executing orphaned transients query');
      const orphanedResult = await this.executeQueryJSON(serverId, dbConfig, orphanedQuery);
      const orphaned = orphanedResult.length > 0 && orphanedResult[0][0] ? parseInt(orphanedResult[0][0]) : 0;
      console.log('[SecureDatabaseAccess] Orphaned transients:', orphaned);

      return { total, expired, orphaned };
    } catch (error) {
      console.error('[SecureDatabaseAccess] countTransients failed:', error);
      throw error;
    }
  }
}
