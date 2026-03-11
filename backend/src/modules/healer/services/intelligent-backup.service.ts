/**
 * Intelligent Backup Service
 * 
 * Context-aware backup strategy based on available resources:
 * - FULL: Sufficient disk space (< 80% usage)
 * - SELECTIVE: Moderate disk space (80-90% usage) - only critical files
 * - REMOTE: High disk space (> 90% usage) with remote backup configured
 * - SKIP: Critical disk space (> 95% usage) - backup would fail
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SSHExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';

interface BackupStrategy {
  type: 'FULL' | 'SELECTIVE' | 'REMOTE' | 'SKIP';
  reason: string;
  estimatedSize: number;
  availableSpace: number;
}

interface CheckResult {
  checkName: string;
  status: string;
  details?: Record<string, any>;
}

@Injectable()
export class IntelligentBackupService {
  private readonly logger = new Logger(IntelligentBackupService.name);
  
  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService
  ) {}
  
  /**
   * Determine backup strategy based on available resources
   */
  async determineBackupStrategy(
    serverId: string,
    sitePath: string,
    checkResults: CheckResult[]
  ): Promise<BackupStrategy> {
    // 1. Check disk space
    const diskCheck = checkResults.find(
      r => r.checkName === 'resource_monitoring' || r.checkName === 'disk_space'
    );
    
    const diskUsage = diskCheck?.details?.diskUsage || 0;
    const inodeUsage = diskCheck?.details?.inodeUsage || 0;
    const availableSpace = diskCheck?.details?.availableSpace || 0;
    
    // 2. Estimate backup size
    const estimatedSize = await this.estimateBackupSize(serverId, sitePath);
    
    // 3. Decide strategy
    
    // CRITICAL: Disk space >95% or inodes >95%
    if (diskUsage > 95 || inodeUsage > 95) {
      return {
        type: 'SKIP',
        reason: 'Critical disk/inode usage - backup would fail or worsen situation',
        estimatedSize,
        availableSpace
      };
    }
    
    // HIGH: Disk space >90% or inodes >90%
    if (diskUsage > 90 || inodeUsage > 90) {
      // Only backup critical files (wp-config.php, .htaccess, database)
      return {
        type: 'SELECTIVE',
        reason: 'High disk/inode usage - backing up only critical files',
        estimatedSize: estimatedSize * 0.1, // ~10% of full backup
        availableSpace
      };
    }
    
    // MODERATE: Disk space >80%
    if (diskUsage > 80) {
      // Try remote backup if configured
      const remoteBackupEnabled = await this.checkRemoteBackupConfig(serverId);
      if (remoteBackupEnabled) {
        return {
          type: 'REMOTE',
          reason: 'Moderate disk usage - using remote backup',
          estimatedSize,
          availableSpace
        };
      }
      
      return {
        type: 'SELECTIVE',
        reason: 'Moderate disk usage - selective backup',
        estimatedSize: estimatedSize * 0.3,
        availableSpace
      };
    }
    
    // NORMAL: Full backup
    return {
      type: 'FULL',
      reason: 'Sufficient disk space - full backup',
      estimatedSize,
      availableSpace
    };
  }
  
  /**
   * Create intelligent backup based on strategy
   */
  async createIntelligentBackup(
    serverId: string,
    sitePath: string,
    strategy: BackupStrategy
  ): Promise<string | null> {
    switch (strategy.type) {
      case 'SKIP':
        this.logger.warn(`Skipping backup: ${strategy.reason}`);
        return null;
        
      case 'SELECTIVE':
        return this.createSelectiveBackup(serverId, sitePath);
        
      case 'REMOTE':
        return this.createRemoteBackup(serverId, sitePath);
        
      case 'FULL':
        return this.createFullBackup(serverId, sitePath);
    }
  }
  
  /**
   * Estimate backup size
   */
  private async estimateBackupSize(
    serverId: string,
    sitePath: string
  ): Promise<number> {
    try {
      const sizeOutput = await this.sshExecutor.executeCommand(
        serverId,
        `du -sb ${sitePath} | awk '{print $1}'`
      );
      
      return parseInt(sizeOutput.trim()) || 0;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to estimate backup size: ${err.message}`);
      return 0;
    }
  }
  
  /**
   * Check if remote backup is configured
   */
  private async checkRemoteBackupConfig(serverId: string): Promise<boolean> {
    // TODO: Check if remote backup (S3, FTP, etc.) is configured
    // For now, return false
    return false;
  }
  
  /**
   * Create selective backup (only critical files)
   */
  private async createSelectiveBackup(
    serverId: string,
    sitePath: string
  ): Promise<string> {
    const backupId = uuidv4();
    const backupDir = `/tmp/healer-backups/${backupId}`;
    
    try {
      // Create backup directory
      await this.sshExecutor.executeCommand(serverId, `mkdir -p ${backupDir}`);
      
      // Backup wp-config.php
      await this.sshExecutor.executeCommand(
        serverId,
        `cp ${sitePath}/wp-config.php ${backupDir}/ 2>/dev/null || true`
      );
      
      // Backup .htaccess
      await this.sshExecutor.executeCommand(
        serverId,
        `cp ${sitePath}/.htaccess ${backupDir}/ 2>/dev/null || true`
      );
      
      // Backup database only (no files)
      try {
        await this.wpCli.execute(
          serverId,
          sitePath,
          `db export ${backupDir}/database.sql --skip-plugins --skip-themes`
        );
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Database backup failed: ${err.message}`);
      }
      
      // Create tar archive
      await this.sshExecutor.executeCommand(
        serverId,
        `cd /tmp/healer-backups && tar -czf ${backupId}.tar.gz ${backupId}`
      );
      
      // Remove uncompressed directory
      await this.sshExecutor.executeCommand(
        serverId,
        `rm -rf ${backupDir}`
      );
      
      this.logger.log(`Selective backup created: ${backupId}`);
      return backupId;
      
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Selective backup failed: ${err.message}`);
      throw error;
    }
  }
  
  /**
   * Create remote backup
   */
  private async createRemoteBackup(
    serverId: string,
    sitePath: string
  ): Promise<string> {
    // TODO: Implement remote backup (S3, FTP, etc.)
    this.logger.warn('Remote backup not yet implemented - falling back to selective');
    return this.createSelectiveBackup(serverId, sitePath);
  }
  
  /**
   * Create full backup
   */
  private async createFullBackup(
    serverId: string,
    sitePath: string
  ): Promise<string> {
    const backupId = uuidv4();
    const backupPath = `/tmp/healer-backups/${backupId}.tar.gz`;
    
    try {
      // Create backup directory
      await this.sshExecutor.executeCommand(
        serverId,
        `mkdir -p /tmp/healer-backups`
      );
      
      // Create tar archive of entire site
      await this.sshExecutor.executeCommand(
        serverId,
        `tar -czf ${backupPath} -C $(dirname ${sitePath}) $(basename ${sitePath})`,
        300000 // 5 minutes timeout
      );
      
      this.logger.log(`Full backup created: ${backupId}`);
      return backupId;
      
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Full backup failed: ${err.message}`);
      throw error;
    }
  }
  
  /**
   * Restore backup
   */
  async restoreBackup(
    serverId: string,
    sitePath: string,
    backupId: string
  ): Promise<void> {
    const backupPath = `/tmp/healer-backups/${backupId}.tar.gz`;
    
    try {
      // Check if backup exists
      await this.sshExecutor.executeCommand(
        serverId,
        `[ -f "${backupPath}" ]`
      );
      
      // Extract backup
      await this.sshExecutor.executeCommand(
        serverId,
        `tar -xzf ${backupPath} -C $(dirname ${sitePath})`,
        300000 // 5 minutes timeout
      );
      
      this.logger.log(`Backup restored: ${backupId}`);
      
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Backup restore failed: ${err.message}`);
      throw error;
    }
  }
  
  /**
   * Delete backup
   */
  async deleteBackup(serverId: string, backupId: string): Promise<void> {
    try {
      await this.sshExecutor.executeCommand(
        serverId,
        `rm -f /tmp/healer-backups/${backupId}.tar.gz`
      );
      
      this.logger.log(`Backup deleted: ${backupId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to delete backup: ${err.message}`);
    }
  }
}
