import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SshExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly BACKUP_DIR = '/var/backups/healer';

  constructor(
    private readonly prisma: PrismaService,
    private readonly sshService: SshExecutorService,
    private readonly wpCliService: WpCliService,
  ) {}

  /**
   * Create backup before healing
   */
  async createBackup(
    siteIdOrSite: string | any,
    backupType: 'FILE' | 'DATABASE' | 'FULL',
  ): Promise<any> {
    // Support both siteId (string) and site object
    const site = typeof siteIdOrSite === 'string' 
      ? await this.prisma.wp_sites.findUnique({ where: { id: siteIdOrSite } })
      : siteIdOrSite;

    if (!site) {
      throw new Error(`Site not found`);
    }

    const siteId = site.id;
    
    this.logger.log(`Creating ${backupType} backup for site ${siteId}`);

    try {

      // Ensure backup directory exists
      await this.ensureBackupDirectory(site.serverId);

      const timestamp = Date.now();
      const backupFileName = `${site.id}_${timestamp}`;

      let filePath: string;
      let fileSize: number;
      let backupData: any = {};

      switch (backupType) {
        case 'FILE':
          ({ filePath, fileSize, backupData } = await this.backupFiles(
            site,
            backupFileName,
          ));
          break;

        case 'DATABASE':
          ({ filePath, fileSize, backupData } = await this.backupDatabase(
            site,
            backupFileName,
          ));
          break;

        case 'FULL':
          const fileBackup = await this.backupFiles(site, `${backupFileName}_files`);
          const dbBackup = await this.backupDatabase(site, `${backupFileName}_db`);
          filePath = fileBackup.filePath;
          fileSize = fileBackup.fileSize + dbBackup.fileSize;
          backupData = {
            files: fileBackup.backupData,
            database: dbBackup.backupData,
          };
          break;
      }

      // Create backup record
      const backup = await this.prisma.healer_backups.create({
        data: {
          siteId,
          backupType,
          filePath,
          fileSize,
          backupData: JSON.stringify(backupData),
          status: 'COMPLETED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      this.logger.log(`Backup created: ${backup.id}`);
      return backup;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Backup creation failed: ${err.message}`, err.stack);

      // Create failed backup record
      await this.prisma.healer_backups.create({
        data: {
          siteId,
          backupType,
          filePath: '',
          status: 'FAILED',
          backupData: JSON.stringify({ error: err.message }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
        },
      });

      throw error;
    }
  }

  /**
   * Backup files (plugins, themes, wp-config.php, .htaccess)
   */
  private async backupFiles(
    site: any,
    backupFileName: string,
  ): Promise<{ filePath: string; fileSize: number; backupData: any }> {
    const backupPath = `${this.BACKUP_DIR}/${backupFileName}.tar.gz`;

    // Files to backup
    const filesToBackup = [
      'wp-config.php',
      '.htaccess',
      'wp-content/plugins',
      'wp-content/themes',
      'wp-content/mu-plugins',
    ];

    // Create tar.gz archive
    const tarCommand = `cd ${site.path} && tar -czf ${backupPath} ${filesToBackup.join(' ')} 2>/dev/null || true`;
    await this.sshService.executeCommand(site.serverId, tarCommand);

    // Get file size
    const sizeCommand = `stat -c %s ${backupPath}`;
    const sizeResult = await this.sshService.executeCommand(
      site.serverId,
      sizeCommand,
    );
    const fileSize = parseInt(sizeResult.trim());

    return {
      filePath: backupPath,
      fileSize,
      backupData: {
        files: filesToBackup,
        sitePath: site.path,
      },
    };
  }

  /**
   * Backup database
   */
  private async backupDatabase(
    site: any,
    backupFileName: string,
  ): Promise<{ filePath: string; fileSize: number; backupData: any }> {
    const backupPath = `${this.BACKUP_DIR}/${backupFileName}.sql.gz`;

    try {
      // Always try mysqldump first (more reliable and doesn't require wp-cli)
      this.logger.log('Using mysqldump for database backup');
      
      // Try to find wp-config.php (could be in site.path or site.path/public_html)
      let wpConfigPath = `${site.path}/wp-config.php`;
      
      // Check if wp-config.php exists at the primary path
      const checkPrimaryPath = await this.sshService.executeCommand(
        site.serverId,
        `test -f ${wpConfigPath} && echo "exists" || echo "not_found"`,
      );
      
      // If not found, try common alternative paths
      if (checkPrimaryPath.trim() === 'not_found') {
        const alternativePaths = [
          `${site.path}/public_html/wp-config.php`,
          `${site.path}/httpdocs/wp-config.php`,
          `${site.path}/www/wp-config.php`,
        ];
        
        for (const altPath of alternativePaths) {
          const checkAltPath = await this.sshService.executeCommand(
            site.serverId,
            `test -f ${altPath} && echo "exists" || echo "not_found"`,
          );
          
          if (checkAltPath.trim() === 'exists') {
            wpConfigPath = altPath;
            this.logger.log(`Found wp-config.php at alternative path: ${wpConfigPath}`);
            break;
          }
        }
      }
      
      // Read database credentials from wp-config.php
      const wpConfigCheck = await this.sshService.executeCommand(
        site.serverId,
        `cat ${wpConfigPath} | grep -E "DB_NAME|DB_USER|DB_PASSWORD|DB_HOST"`,
      );
      
      const dbNameMatch = wpConfigCheck.match(/DB_NAME['"],\s*['"]([^'"]+)['"]/);
      const dbUserMatch = wpConfigCheck.match(/DB_USER['"],\s*['"]([^'"]+)['"]/);
      const dbPassMatch = wpConfigCheck.match(/DB_PASSWORD['"],\s*['"]([^'"]+)['"]/);
      const dbHostMatch = wpConfigCheck.match(/DB_HOST['"],\s*['"]([^'"]+)['"]/);

      const dbName = dbNameMatch ? dbNameMatch[1] : site.dbName;
      const dbUser = dbUserMatch ? dbUserMatch[1] : '';
      const dbPass = dbPassMatch ? dbPassMatch[1] : '';
      const dbHost = dbHostMatch ? dbHostMatch[1] : 'localhost';

      if (!dbName || !dbUser) {
        throw new Error('Could not extract database credentials from wp-config.php');
      }

      // Use mysqldump directly (executed as single command, not through wp-cli)
      const dumpCommand = `mysqldump -h ${dbHost} -u ${dbUser} ${dbPass ? `-p'${dbPass}'` : ''} ${dbName} | gzip > ${backupPath}`;
      await this.sshService.executeCommand(site.serverId, dumpCommand);

      // Get file size
      const sizeCommand = `stat -c %s ${backupPath}`;
      const sizeResult = await this.sshService.executeCommand(
        site.serverId,
        sizeCommand,
      );
      const fileSize = parseInt(sizeResult.trim());

      return {
        filePath: backupPath,
        fileSize,
        backupData: {
          dbName: dbName,
          dbHost: dbHost,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Database backup failed: ${err.message}`);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restore(backupId: string): Promise<void> {
    this.logger.log(`Restoring from backup ${backupId}`);

    try {
      const backup = await this.prisma.healer_backups.findUnique({
        where: { id: backupId },
        include: { wp_sites: true },
      });

      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      if (backup.status !== 'COMPLETED') {
        throw new Error(`Backup ${backupId} is not in COMPLETED status`);
      }

      const site = backup.site;
      const backupData = JSON.parse(backup.backupData);

      switch (backup.backupType) {
        case 'FILE':
          await this.restoreFiles(site, backup.filePath, backupData);
          break;

        case 'DATABASE':
          await this.restoreDatabase(site, backup.filePath, backupData);
          break;

        case 'FULL':
          await this.restoreFiles(site, backup.filePath, backupData.files);
          await this.restoreDatabase(
            site,
            backup.filePath.replace('_files', '_db'),
            backupData.database,
          );
          break;
      }

      this.logger.log(`Restore completed for backup ${backupId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Restore failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Restore files from backup
   */
  private async restoreFiles(
    site: any,
    backupPath: string,
    backupData: any,
  ): Promise<void> {
    // Extract tar.gz archive
    const extractCommand = `cd ${site.path} && tar -xzf ${backupPath}`;
    await this.sshService.executeCommand(site.serverId, extractCommand);

    this.logger.log(`Files restored from ${backupPath}`);
  }

  /**
   * Restore database from backup
   */
  private async restoreDatabase(
    site: any,
    backupPath: string,
    backupData: any,
  ): Promise<void> {
    // Import database using wp-cli
    const importCommand = `gunzip < ${backupPath} | wp db import -`;
    await this.wpCliService.execute(site.serverId, site.path, importCommand);

    this.logger.log(`Database restored from ${backupPath}`);
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(serverId: string): Promise<void> {
    const command = `mkdir -p ${this.BACKUP_DIR}`;
    await this.sshService.executeCommand(serverId, command);
  }

  /**
   * Cleanup expired backups (runs daily at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredBackups(): Promise<void> {
    this.logger.log('Starting cleanup of expired backups');

    try {
      // Find expired backups
      const expiredBackups = await this.prisma.healer_backups.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          status: 'COMPLETED',
        },
        include: { wp_sites: true },
      });

      this.logger.log(`Found ${expiredBackups.length} expired backups`);

      for (const backup of expiredBackups) {
        try {
          // Delete backup file from server
          const deleteCommand = `rm -f ${backup.filePath}`;
          await this.sshService.executeCommand(
            backup.site.serverId,
            deleteCommand,
          );

          // Update backup status
          await this.prisma.healer_backups.update({
            where: { id: backup.id },
            data: { status: 'EXPIRED' },
          });

          this.logger.log(`Deleted expired backup: ${backup.id}`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to delete backup ${backup.id}: ${err.message}`,
          );
        }
      }

      this.logger.log('Backup cleanup completed');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Backup cleanup failed: ${err.message}`, err.stack);
    }
  }
}
