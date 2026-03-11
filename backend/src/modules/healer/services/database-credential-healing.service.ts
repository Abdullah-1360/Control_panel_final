/**
 * Database Credential Healing Service
 * 
 * Intelligently fixes database connection issues:
 * - Auto-create database users
 * - Reset passwords
 * - Grant privileges
 * - Update wp-config.php
 */

import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from './ssh-executor.service';

interface HealingResult {
  success: boolean;
  message: string;
  actions: HealingAction[];
}

interface HealingAction {
  type: string;
  description: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface DatabaseConfig {
  database: string;
  user: string;
  password: string;
  host: string;
}

@Injectable()
export class DatabaseCredentialHealingService {
  private readonly logger = new Logger(DatabaseCredentialHealingService.name);
  
  constructor(
    private readonly sshExecutor: SSHExecutorService
  ) {}
  
  /**
   * Heal database credential issues
   */
  async healDatabaseCredentials(
    serverId: string,
    sitePath: string,
    checkResults: any[]
  ): Promise<HealingResult> {
    this.logger.log('Healing database credentials...');
    
    const actions: HealingAction[] = [];
    
    try {
      // 1. Parse wp-config.php to get database details
      const dbConfig = await this.parseWpConfig(serverId, sitePath);
      
      // 2. Test connection with current credentials
      const connectionTest = await this.testDatabaseConnection(serverId, dbConfig);
      
      if (connectionTest.success) {
        return {
          success: true,
          message: 'Database credentials are valid',
          actions: [{
            type: 'DATABASE_CONNECTION_TEST',
            description: 'Database connection successful',
            success: true
          }]
        };
      }
      
      // 3. Determine error type
      const errorType = this.classifyDatabaseError(connectionTest.error || 'Unknown error');
      
      this.logger.log(`Database error type: ${errorType}`);
      
      // 4. Apply appropriate fix
      switch (errorType) {
        case 'INVALID_CREDENTIALS':
        case 'USER_NOT_EXISTS':
          await this.createDatabaseUser(serverId, sitePath, dbConfig, actions);
          break;
          
        case 'INSUFFICIENT_PRIVILEGES':
          await this.grantPrivileges(serverId, dbConfig, actions);
          break;
          
        case 'DATABASE_NOT_EXISTS':
          await this.createDatabase(serverId, dbConfig, actions);
          break;
          
        default:
          actions.push({
            type: 'DATABASE_ERROR_UNKNOWN',
            description: `Unknown database error: ${connectionTest.error}`,
            success: false,
            error: connectionTest.error
          });
      }
      
      const success = actions.some(a => a.success);
      
      return {
        success,
        message: success 
          ? 'Database credentials healed successfully'
          : 'Failed to heal database credentials',
        actions
      };
      
    } catch (error) {
      const err = error as Error;
      
      return {
        success: false,
        message: `Database credential healing failed: ${err.message}`,
        actions: [{
          type: 'DATABASE_CREDENTIAL_HEALING',
          description: 'Failed to heal database credentials',
          success: false,
          error: err.message
        }]
      };
    }
  }
  
  /**
   * Parse wp-config.php to get database configuration
   */
  private async parseWpConfig(
    serverId: string,
    sitePath: string
  ): Promise<DatabaseConfig> {
    try {
      // Extract database name
      const dbName = await this.sshExecutor.executeCommand(
        serverId,
        `grep "DB_NAME" ${sitePath}/wp-config.php | cut -d "'" -f 4`
      );
      
      // Extract database user
      const dbUser = await this.sshExecutor.executeCommand(
        serverId,
        `grep "DB_USER" ${sitePath}/wp-config.php | cut -d "'" -f 4`
      );
      
      // Extract database password
      const dbPassword = await this.sshExecutor.executeCommand(
        serverId,
        `grep "DB_PASSWORD" ${sitePath}/wp-config.php | cut -d "'" -f 4`
      );
      
      // Extract database host
      const dbHost = await this.sshExecutor.executeCommand(
        serverId,
        `grep "DB_HOST" ${sitePath}/wp-config.php | cut -d "'" -f 4`
      );
      
      return {
        database: dbName.trim(),
        user: dbUser.trim(),
        password: dbPassword.trim(),
        host: dbHost.trim() || 'localhost'
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to parse wp-config.php: ${err.message}`);
    }
  }
  
  /**
   * Test database connection
   */
  private async testDatabaseConnection(
    serverId: string,
    dbConfig: DatabaseConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -h ${dbConfig.host} -u ${dbConfig.user} -p'${dbConfig.password}' ${dbConfig.database} -e "SELECT 1" 2>&1`
      );
      
      return { success: true };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Classify database error type
   */
  private classifyDatabaseError(error: string): string {
    if (error.includes('Access denied')) {
      return 'INVALID_CREDENTIALS';
    }
    
    if (error.includes("doesn't exist") || error.includes('Unknown database')) {
      return 'DATABASE_NOT_EXISTS';
    }
    
    if (error.includes('denied') && error.includes('command')) {
      return 'INSUFFICIENT_PRIVILEGES';
    }
    
    if (error.includes('Connection refused')) {
      return 'CONNECTION_REFUSED';
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * Create database user with full privileges
   */
  private async createDatabaseUser(
    serverId: string,
    sitePath: string,
    dbConfig: DatabaseConfig,
    actions: HealingAction[]
  ): Promise<void> {
    try {
      // Generate secure password
      const newPassword = this.generateSecurePassword();
      
      // Get root credentials (try common locations)
      const rootPassword = await this.getRootPassword(serverId);
      
      // Create user
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -u root -p'${rootPassword}' -e "CREATE USER IF NOT EXISTS '${dbConfig.user}'@'localhost' IDENTIFIED BY '${newPassword}';" 2>&1`
      );
      
      actions.push({
        type: 'DATABASE_USER_CREATE',
        description: `Created database user: ${dbConfig.user}`,
        success: true
      });
      
      // Grant all privileges
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -u root -p'${rootPassword}' -e "GRANT ALL PRIVILEGES ON \\\`${dbConfig.database}\\\`.* TO '${dbConfig.user}'@'localhost';" 2>&1`
      );
      
      actions.push({
        type: 'DATABASE_PRIVILEGES_GRANT',
        description: `Granted all privileges to ${dbConfig.user}`,
        success: true
      });
      
      // Flush privileges
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -u root -p'${rootPassword}' -e "FLUSH PRIVILEGES;" 2>&1`
      );
      
      // Update wp-config.php with new password
      await this.updateWpConfigPassword(serverId, sitePath, newPassword);
      
      actions.push({
        type: 'WP_CONFIG_UPDATE',
        description: 'Updated wp-config.php with new password',
        success: true
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'DATABASE_USER_CREATE',
        description: 'Failed to create database user',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Grant privileges to existing user
   */
  private async grantPrivileges(
    serverId: string,
    dbConfig: DatabaseConfig,
    actions: HealingAction[]
  ): Promise<void> {
    try {
      const rootPassword = await this.getRootPassword(serverId);
      
      // Grant all privileges
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -u root -p'${rootPassword}' -e "GRANT ALL PRIVILEGES ON \\\`${dbConfig.database}\\\`.* TO '${dbConfig.user}'@'localhost';" 2>&1`
      );
      
      // Flush privileges
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -u root -p'${rootPassword}' -e "FLUSH PRIVILEGES;" 2>&1`
      );
      
      actions.push({
        type: 'DATABASE_PRIVILEGES_GRANT',
        description: `Granted all privileges to ${dbConfig.user}`,
        success: true
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'DATABASE_PRIVILEGES_GRANT',
        description: 'Failed to grant privileges',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Create database
   */
  private async createDatabase(
    serverId: string,
    dbConfig: DatabaseConfig,
    actions: HealingAction[]
  ): Promise<void> {
    try {
      const rootPassword = await this.getRootPassword(serverId);
      
      // Create database
      await this.sshExecutor.executeCommand(
        serverId,
        `mysql -u root -p'${rootPassword}' -e "CREATE DATABASE IF NOT EXISTS \\\`${dbConfig.database}\\\`;" 2>&1`
      );
      
      actions.push({
        type: 'DATABASE_CREATE',
        description: `Created database: ${dbConfig.database}`,
        success: true
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'DATABASE_CREATE',
        description: 'Failed to create database',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Get MySQL root password
   */
  private async getRootPassword(serverId: string): Promise<string> {
    // Try to get from .my.cnf
    try {
      const password = await this.sshExecutor.executeCommand(
        serverId,
        `grep password ~/.my.cnf | cut -d= -f2 | tr -d ' '`
      );
      
      if (password.trim()) {
        return password.trim();
      }
    } catch (error) {
      // Ignore
    }
    
    // Try empty password (common in development)
    return '';
  }
  
  /**
   * Update wp-config.php with new password
   */
  private async updateWpConfigPassword(
    serverId: string,
    sitePath: string,
    newPassword: string
  ): Promise<void> {
    // Escape special characters for sed
    const escapedPassword = newPassword.replace(/[\/&]/g, '\\$&');
    
    await this.sshExecutor.executeCommand(
      serverId,
      `sed -i "s/define( *'DB_PASSWORD' *, *'[^']*' *)/define('DB_PASSWORD', '${escapedPassword}')/" ${sitePath}/wp-config.php`
    );
  }
  
  /**
   * Generate secure password
   */
  private generateSecurePassword(): string {
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }
}
