/**
 * Base class for all backup strategies
 * 
 * Provides common functionality for backup and restore operations
 */

import { IBackupStrategy, BackupResult, RestoreResult } from './interfaces';
import { Logger } from '@nestjs/common';

export abstract class BackupStrategyBase implements IBackupStrategy {
  protected readonly logger = new Logger(this.constructor.name);
  
  abstract readonly name: string;
  abstract readonly description: string;
  
  /**
   * Create a backup of the application
   */
  abstract createBackup(application: any, server: any): Promise<BackupResult>;
  
  /**
   * Restore from a backup
   */
  abstract restoreBackup(
    application: any,
    server: any,
    backupPath: string,
  ): Promise<RestoreResult>;
  
  /**
   * Validate that a backup is valid and can be restored
   */
  abstract validateBackup(backupPath: string): Promise<boolean>;
  
  /**
   * Helper method to create a successful backup result
   */
  protected createBackupSuccess(
    backupPath: string,
    backupSize: number,
    duration: number,
  ): BackupResult {
    return {
      success: true,
      backupPath,
      backupSize,
      duration,
    };
  }
  
  /**
   * Helper method to create a failed backup result
   */
  protected createBackupFailure(error: string, duration: number): BackupResult {
    return {
      success: false,
      duration,
      error,
    };
  }
  
  /**
   * Helper method to create a successful restore result
   */
  protected createRestoreSuccess(duration: number): RestoreResult {
    return {
      success: true,
      duration,
    };
  }
  
  /**
   * Helper method to create a failed restore result
   */
  protected createRestoreFailure(error: string, duration: number): RestoreResult {
    return {
      success: false,
      duration,
      error,
    };
  }
}
