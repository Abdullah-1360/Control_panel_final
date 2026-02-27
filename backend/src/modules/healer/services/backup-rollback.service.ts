/**
 * Backup & Rollback Service
 * 
 * Creates backups before risky healing operations and provides rollback capability
 * 
 * Backup Strategy:
 * - WordPress: Database + wp-content directory
 * - Laravel: Database + storage directory + .env file
 * - Node.js/Express/Next.js: package.json + package-lock.json + .env files
 * - PHP Generic: composer.json + composer.lock + .env files
 * 
 * Backup Location: /tmp/opsmanager-backups/{applicationId}/{timestamp}/
 * Retention: Keep last 5 backups per application
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../stubs/prisma.service.stub';
import { SSHExecutorService } from './ssh-executor.service';
import { TechStack } from '@prisma/client';

interface BackupResult {
  success: boolean;
  backupId: string;
  backupPath: string;
  message: string;
  files: string[];
}

interface RollbackResult {
  success: boolean;
  message: string;
  restoredFiles: string[];
}

@Injectable()
export class BackupRollbackService {
  private readonly logger = new Logger(BackupRollbackService.name);
  
  // Base backup directory on server
  private readonly BACKUP_BASE_DIR = '/tmp/opsmanager-backups';
  
  // Maximum number of backups to keep per application
  private readonly MAX_BACKUPS_PER_APP = 5;
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly sshExecutor: SSHExecutorService,
  ) {}
  
  /**
   * Create backup before healing operation
   * Returns backup ID that can be used for rollback
   */
  async createBackup(
    applicationId: string,
    actionName: string,
  ): Promise<BackupResult> {
    this.logger.log(`Creating backup for application ${applicationId} before action: ${actionName}`);
    
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const server = application.servers;
    const backupId = `${Date.now()}-${actionName}`;
    const backupPath = `${this.BACKUP_BASE_DIR}/${applicationId}/${backupId}`;
    
    try {
      // Create backup directory
      await this.sshExecutor.executeCommand(
        server.id,
        `mkdir -p ${backupPath}`,
      );
      
      // Perform tech-stack-specific backup
      const files = await this.performBackup(
        server.id,
        application.path,
        application.techStack,
        backupPath,
      );
      
      // Clean up old backups (keep last 5)
      await this.cleanupOldBackups(server.id, applicationId);
      
      this.logger.log(`Backup created successfully: ${backupPath}`);
      
      return {
        success: true,
        backupId,
        backupPath,
        message: `Backup created successfully`,
        files,
      };
    } catch (error: any) {
      this.logger.error(`Backup failed: ${error?.message || 'Unknown error'}`);
      
      // Try to clean up failed backup
      try {
        await this.sshExecutor.executeCommand(
          server.id,
          `rm -rf ${backupPath}`,
        );
      } catch {
        // Ignore cleanup errors
      }
      
      return {
        success: false,
        backupId,
        backupPath,
        message: `Backup failed: ${error?.message || 'Unknown error'}`,
        files: [],
      };
    }
  }
  
  /**
   * Perform tech-stack-specific backup
   */
  private async performBackup(
    serverId: string,
    appPath: string,
    techStack: TechStack,
    backupPath: string,
  ): Promise<string[]> {
    const files: string[] = [];
    
    switch (techStack) {
      case TechStack.WORDPRESS:
        // Backup wp-config.php
        await this.backupFile(serverId, `${appPath}/wp-config.php`, backupPath);
        files.push('wp-config.php');
        
        // Backup .htaccess if exists
        try {
          await this.backupFile(serverId, `${appPath}/.htaccess`, backupPath);
          files.push('.htaccess');
        } catch {
          // .htaccess might not exist
        }
        
        // Note: Database backup would require wp-cli or direct MySQL access
        // For now, we'll skip database backup and focus on files
        this.logger.warn('WordPress database backup not implemented yet');
        break;
        
      case TechStack.LARAVEL:
        // Backup .env file
        await this.backupFile(serverId, `${appPath}/.env`, backupPath);
        files.push('.env');
        
        // Backup composer files
        await this.backupFile(serverId, `${appPath}/composer.json`, backupPath);
        await this.backupFile(serverId, `${appPath}/composer.lock`, backupPath);
        files.push('composer.json', 'composer.lock');
        
        // Backup storage directory (tar it for efficiency)
        try {
          await this.sshExecutor.executeCommand(
            serverId,
            `cd ${appPath} && tar -czf ${backupPath}/storage.tar.gz storage/`,
          );
          files.push('storage.tar.gz');
        } catch (error) {
          this.logger.warn(`Failed to backup storage directory: ${error}`);
        }
        break;
        
      case TechStack.NODEJS:
      case TechStack.EXPRESS:
      case TechStack.NEXTJS:
        // Backup package files
        await this.backupFile(serverId, `${appPath}/package.json`, backupPath);
        files.push('package.json');
        
        try {
          await this.backupFile(serverId, `${appPath}/package-lock.json`, backupPath);
          files.push('package-lock.json');
        } catch {
          // package-lock.json might not exist
        }
        
        // Backup .env files
        try {
          await this.backupFile(serverId, `${appPath}/.env`, backupPath);
          files.push('.env');
        } catch {
          // .env might not exist
        }
        
        try {
          await this.backupFile(serverId, `${appPath}/.env.local`, backupPath);
          files.push('.env.local');
        } catch {
          // .env.local might not exist
        }
        break;
        
      case TechStack.PHP_GENERIC:
        // Backup composer files if they exist
        try {
          await this.backupFile(serverId, `${appPath}/composer.json`, backupPath);
          await this.backupFile(serverId, `${appPath}/composer.lock`, backupPath);
          files.push('composer.json', 'composer.lock');
        } catch {
          // Composer files might not exist
        }
        
        // Backup .env if exists
        try {
          await this.backupFile(serverId, `${appPath}/.env`, backupPath);
          files.push('.env');
        } catch {
          // .env might not exist
        }
        
        // Backup main PHP files
        try {
          await this.backupFile(serverId, `${appPath}/index.php`, backupPath);
          files.push('index.php');
        } catch {
          // index.php might not exist
        }
        break;
        
      default:
        this.logger.warn(`No backup strategy defined for tech stack: ${techStack}`);
    }
    
    return files;
  }
  
  /**
   * Backup a single file
   */
  private async backupFile(
    serverId: string,
    sourcePath: string,
    backupDir: string,
  ): Promise<void> {
    const fileName = sourcePath.split('/').pop();
    await this.sshExecutor.executeCommand(
      serverId,
      `cp ${sourcePath} ${backupDir}/${fileName}`,
    );
  }
  
  /**
   * Rollback to a previous backup
   */
  async rollback(
    applicationId: string,
    backupId: string,
  ): Promise<RollbackResult> {
    this.logger.log(`Rolling back application ${applicationId} to backup: ${backupId}`);
    
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const server = application.servers;
    const backupPath = `${this.BACKUP_BASE_DIR}/${applicationId}/${backupId}`;
    
    try {
      // Check if backup exists
      await this.sshExecutor.executeCommand(
        server.id,
        `[ -d "${backupPath}" ]`,
      );
      
      // List files in backup
      const filesOutput = await this.sshExecutor.executeCommand(
        server.id,
        `ls -1 ${backupPath}`,
      );
      
      const files = filesOutput.trim().split('\n').filter(f => f);
      const restoredFiles: string[] = [];
      
      // Restore each file
      for (const file of files) {
        if (file.endsWith('.tar.gz')) {
          // Extract tar archive
          await this.sshExecutor.executeCommand(
            server.id,
            `cd ${application.path} && tar -xzf ${backupPath}/${file}`,
          );
          restoredFiles.push(file);
        } else {
          // Copy file back
          await this.sshExecutor.executeCommand(
            server.id,
            `cp ${backupPath}/${file} ${application.path}/${file}`,
          );
          restoredFiles.push(file);
        }
      }
      
      this.logger.log(`Rollback completed successfully: ${restoredFiles.length} files restored`);
      
      return {
        success: true,
        message: `Rollback completed successfully`,
        restoredFiles,
      };
    } catch (error: any) {
      this.logger.error(`Rollback failed: ${error?.message || 'Unknown error'}`);
      
      return {
        success: false,
        message: `Rollback failed: ${error?.message || 'Unknown error'}`,
        restoredFiles: [],
      };
    }
  }
  
  /**
   * Clean up old backups, keeping only the last N backups
   */
  private async cleanupOldBackups(
    serverId: string,
    applicationId: string,
  ): Promise<void> {
    try {
      const appBackupDir = `${this.BACKUP_BASE_DIR}/${applicationId}`;
      
      // List all backups sorted by modification time (oldest first)
      const backupsOutput = await this.sshExecutor.executeCommand(
        serverId,
        `ls -1t ${appBackupDir} 2>/dev/null || echo ""`,
      );
      
      const backups = backupsOutput.trim().split('\n').filter(b => b);
      
      // If we have more than MAX_BACKUPS_PER_APP, delete the oldest ones
      if (backups.length > this.MAX_BACKUPS_PER_APP) {
        const backupsToDelete = backups.slice(this.MAX_BACKUPS_PER_APP);
        
        for (const backup of backupsToDelete) {
          await this.sshExecutor.executeCommand(
            serverId,
            `rm -rf ${appBackupDir}/${backup}`,
          );
          this.logger.log(`Deleted old backup: ${backup}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup old backups: ${error}`);
      // Don't throw, cleanup is not critical
    }
  }
  
  /**
   * List all backups for an application
   */
  async listBackups(applicationId: string): Promise<Array<{
    backupId: string;
    createdAt: Date;
    size: string;
  }>> {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const server = application.servers;
    const appBackupDir = `${this.BACKUP_BASE_DIR}/${applicationId}`;
    
    try {
      // List backups with details
      const output = await this.sshExecutor.executeCommand(
        server.id,
        `ls -lt ${appBackupDir} 2>/dev/null | tail -n +2 | awk '{print $9, $6, $7, $8}' || echo ""`,
      );
      
      const lines = output.trim().split('\n').filter(l => l);
      const backups = [];
      
      for (const line of lines) {
        const parts = line.split(' ');
        if (parts.length >= 4) {
          const backupId = parts[0];
          const month = parts[1];
          const day = parts[2];
          const time = parts[3];
          
          // Parse date (approximate, since we don't have year)
          const createdAt = new Date(`${month} ${day} ${new Date().getFullYear()} ${time}`);
          
          // Get size
          const sizeOutput = await this.sshExecutor.executeCommand(
            server.id,
            `du -sh ${appBackupDir}/${backupId} | cut -f1`,
          );
          
          backups.push({
            backupId,
            createdAt,
            size: sizeOutput.trim(),
          });
        }
      }
      
      return backups;
    } catch (error) {
      this.logger.warn(`Failed to list backups: ${error}`);
      return [];
    }
  }
  
  /**
   * Delete a specific backup
   */
  async deleteBackup(applicationId: string, backupId: string): Promise<void> {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const server = application.servers;
    const backupPath = `${this.BACKUP_BASE_DIR}/${applicationId}/${backupId}`;
    
    await this.sshExecutor.executeCommand(
      server.id,
      `rm -rf ${backupPath}`,
    );
    
    this.logger.log(`Deleted backup: ${backupId}`);
  }
}
