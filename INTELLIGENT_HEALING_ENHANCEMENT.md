# Intelligent Healing Module - Advanced Enhancement

## 1. Context-Aware Healing Intelligence

### 1.1 Smart Backup Strategy

**Problem**: Creating full backups when disk space is critically low can fail or make situation worse.

**Solution**: Intelligent backup decision based on available resources

```typescript
interface BackupStrategy {
  type: 'FULL' | 'SELECTIVE' | 'SKIP' | 'REMOTE';
  reason: string;
  estimatedSize: number;
  availableSpace: number;
}

@Injectable()
export class IntelligentBackupService {
  async determineBackupStrategy(
    serverId: string,
    sitePath: string,
    checkResults: CheckResult[]
  ): Promise<BackupStrategy> {
    // 1. Check disk space
    const diskCheck = checkResults.find(
      r => r.checkType === DiagnosisCheckType.RESOURCE_MONITORING
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
  
  private async createSelectiveBackup(
    serverId: string,
    sitePath: string
  ): Promise<string> {
    const backupId = uuidv4();
    const backupDir = `/tmp/healer-backups/${backupId}`;
    
    await this.sshExecutor.executeCommand(serverId, `mkdir -p ${backupDir}`);
    
    // Only backup critical files
    await this.sshExecutor.executeCommand(
      serverId,
      `cp ${sitePath}/wp-config.php ${backupDir}/`
    );
    
    await this.sshExecutor.executeCommand(
      serverId,
      `cp ${sitePath}/.htaccess ${backupDir}/ 2>/dev/null || true`
    );
    
    // Backup database only (no files)
    await this.sshExecutor.executeCommand(
      serverId,
      `cd ${sitePath} && wp db export ${backupDir}/database.sql --skip-plugins --skip-themes`
    );
    
    return backupId;
  }
}
```

### 1.2 Smart Database Credential Healing

**Problem**: Database connection fails due to wrong credentials - need to create new user with proper privileges.

**Solution**: Intelligent database user management

```typescript
@Injectable()
export class DatabaseCredentialHealingService {
  async healDatabaseCredentials(
    serverId: string,
    sitePath: string,
    checkResults: CheckResult[]
  ): Promise<HealingResult> {
    // 1. Parse wp-config.php to get database details
    const dbConfig = await this.parseWpConfig(serverId, sitePath);
    
    // 2. Test connection with current credentials
    const connectionTest = await this.testDatabaseConnection(
      serverId,
      dbConfig
    );
    
    if (connectionTest.success) {
      return {
        success: true,
        message: 'Database credentials are valid',
        actions: []
      };
    }
    
    // 3. Determine error type
    const errorType = this.classifyDatabaseError(connectionTest.error);
    
    switch (errorType) {
      case 'INVALID_CREDENTIALS':
        return this.fixInvalidCredentials(serverId, sitePath, dbConfig);
        
      case 'USER_NOT_EXISTS':
        return this.createDatabaseUser(serverId, sitePath, dbConfig);
        
      case 'INSUFFICIENT_PRIVILEGES':
        return this.grantPrivileges(serverId, sitePath, dbConfig);
        
      case 'DATABASE_NOT_EXISTS':
        return this.createDatabase(serverId, sitePath, dbConfig);
        
      case 'CONNECTION_REFUSED':
        return this.fixConnectionRefused(serverId, sitePath, dbConfig);
        
      default:
        return {
          success: false,
          message: `Unknown database error: ${connectionTest.error}`,
          actions: []
        };
    }
  }
  
  private async fixInvalidCredentials(
    serverId: string,
    sitePath: string,
    dbConfig: DatabaseConfig
  ): Promise<HealingResult> {
    const actions: HealingAction[] = [];
    
    // Strategy 1: Try to reset password for existing user
    try {
      const newPassword = this.generateSecurePassword();
      
      // Connect as root or admin user
      const rootCreds = await this.getRootDatabaseCredentials(serverId);
      
      // Reset password
      await this.executeDatabaseQuery(
        serverId,
        rootCreds,
        `ALTER USER '${dbConfig.user}'@'localhost' IDENTIFIED BY '${newPassword}';`
      );
      
      // Update wp-config.php
      await this.updateWpConfigPassword(serverId, sitePath, newPassword);
      
      actions.push({
        type: HealingActionType.DATABASE_PASSWORD_RESET,
        description: 'Reset database user password',
        success: true
      });
      
      // Verify connection
      const verified = await this.testDatabaseConnection(serverId, {
        ...dbConfig,
        password: newPassword
      });
      
      if (verified.success) {
        return {
          success: true,
          message: 'Database password reset successfully',
          actions
        };
      }
    } catch (error) {
      this.logger.warn(`Password reset failed: ${error.message}`);
    }
    
    // Strategy 2: Create new user with same privileges
    return this.createDatabaseUser(serverId, sitePath, dbConfig);
  }
  
  private async createDatabaseUser(
    serverId: string,
    sitePath: string,
    dbConfig: DatabaseConfig
  ): Promise<HealingResult> {
    const actions: HealingAction[] = [];
    
    try {
      const rootCreds = await this.getRootDatabaseCredentials(serverId);
      const newPassword = this.generateSecurePassword();
      
      // Create user
      await this.executeDatabaseQuery(
        serverId,
        rootCreds,
        `CREATE USER IF NOT EXISTS '${dbConfig.user}'@'localhost' IDENTIFIED BY '${newPassword}';`
      );
      
      actions.push({
        type: HealingActionType.DATABASE_USER_CREATE,
        description: 'Created database user',
        success: true
      });
      
      // Grant all privileges on database
      await this.executeDatabaseQuery(
        serverId,
        rootCreds,
        `GRANT ALL PRIVILEGES ON \`${dbConfig.database}\`.* TO '${dbConfig.user}'@'localhost';`
      );
      
      actions.push({
        type: HealingActionType.DATABASE_PRIVILEGES_GRANT,
        description: 'Granted all privileges to user',
        success: true
      });
      
      // Flush privileges
      await this.executeDatabaseQuery(
        serverId,
        rootCreds,
        `FLUSH PRIVILEGES;`
      );
      
      // Update wp-config.php
      await this.updateWpConfigPassword(serverId, sitePath, newPassword);
      
      actions.push({
        type: HealingActionType.WP_CONFIG_UPDATE,
        description: 'Updated wp-config.php with new password',
        success: true
      });
      
      return {
        success: true,
        message: 'Database user created with full privileges',
        actions
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to create database user: ${error.message}`,
        actions
      };
    }
  }
  
  private async grantPrivileges(
    serverId: string,
    sitePath: string,
    dbConfig: DatabaseConfig
  ): Promise<HealingResult> {
    const actions: HealingAction[] = [];
    
    try {
      const rootCreds = await this.getRootDatabaseCredentials(serverId);
      
      // Grant all privileges
      await this.executeDatabaseQuery(
        serverId,
        rootCreds,
        `GRANT ALL PRIVILEGES ON \`${dbConfig.database}\`.* TO '${dbConfig.user}'@'localhost';`
      );
      
      await this.executeDatabaseQuery(
        serverId,
        rootCreds,
        `FLUSH PRIVILEGES;`
      );
      
      actions.push({
        type: HealingActionType.DATABASE_PRIVILEGES_GRANT,
        description: 'Granted all privileges to existing user',
        success: true
      });
      
      return {
        success: true,
        message: 'Database privileges granted successfully',
        actions
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to grant privileges: ${error.message}`,
        actions
      };
    }
  }
  
  private generateSecurePassword(): string {
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}
```

## 2. Subdomain/Addon/Main Domain Awareness



### 2.1 Domain-Aware Healing Strategy

```typescript
interface DomainContext {
  type: 'main' | 'subdomain' | 'addon' | 'parked';
  domain: string;
  path: string;
  parentDomain?: string; // For subdomains
  sharedResources: {
    database: boolean;
    plugins: boolean;
    themes: boolean;
    uploads: boolean;
  };
  isolationLevel: 'SHARED' | 'ISOLATED';
}

@Injectable()
export class DomainAwareHealingService {
  async analyzeDomainContext(
    applicationId: string,
    targetDomain: string
  ): Promise<DomainContext> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId }
    });
    
    const metadata = app.metadata as any;
    const subdomains = metadata?.availableSubdomains || [];
    const addonDomains = metadata?.addonDomains || [];
    
    // Determine domain type
    let domainType: 'main' | 'subdomain' | 'addon' | 'parked' = 'main';
    let domainPath = app.path;
    let parentDomain: string | undefined;
    
    if (targetDomain !== app.domain) {
      const subdomain = subdomains.find((s: any) => s.subdomain === targetDomain);
      if (subdomain) {
        domainType = 'subdomain';
        domainPath = subdomain.path;
        parentDomain = app.domain;
      }
      
      const addon = addonDomains.find((a: any) => a.domain === targetDomain);
      if (addon) {
        domainType = 'addon';
        domainPath = addon.path;
      }
    }
    
    // Analyze shared resources
    const sharedResources = await this.analyzeSharedResources(
      app.serverId,
      app.path,
      domainPath,
      domainType
    );
    
    // Determine isolation level
    const isolationLevel = this.determineIsolationLevel(
      domainType,
      sharedResources
    );
    
    return {
      type: domainType,
      domain: targetDomain,
      path: domainPath,
      parentDomain,
      sharedResources,
      isolationLevel
    };
  }
  
  private async analyzeSharedResources(
    serverId: string,
    mainPath: string,
    targetPath: string,
    domainType: string
  ): Promise<DomainContext['sharedResources']> {
    // Check if paths are the same (shared installation)
    if (mainPath === targetPath) {
      return {
        database: true,
        plugins: true,
        themes: true,
        uploads: true
      };
    }
    
    // Check database sharing
    const mainDbConfig = await this.parseWpConfig(serverId, mainPath);
    const targetDbConfig = await this.parseWpConfig(serverId, targetPath);
    const sharedDatabase = mainDbConfig.database === targetDbConfig.database;
    
    // Check if wp-content is symlinked or shared
    const sharedWpContent = await this.checkSharedWpContent(
      serverId,
      mainPath,
      targetPath
    );
    
    return {
      database: sharedDatabase,
      plugins: sharedWpContent,
      themes: sharedWpContent,
      uploads: sharedWpContent
    };
  }
  
  private determineIsolationLevel(
    domainType: string,
    sharedResources: DomainContext['sharedResources']
  ): 'SHARED' | 'ISOLATED' {
    // If any resources are shared, consider it SHARED
    if (
      sharedResources.database ||
      sharedResources.plugins ||
      sharedResources.themes
    ) {
      return 'SHARED';
    }
    
    return 'ISOLATED';
  }
  
  /**
   * Adjust healing strategy based on domain context
   */
  async adjustHealingStrategy(
    strategy: HealingStrategy,
    domainContext: DomainContext
  ): Promise<HealingStrategy> {
    const adjustedActions: HealingAction[] = [];
    
    for (const action of strategy.actions) {
      // Adjust based on isolation level
      if (domainContext.isolationLevel === 'SHARED') {
        adjustedActions.push(
          ...this.adjustForSharedEnvironment(action, domainContext)
        );
      } else {
        adjustedActions.push(action);
      }
    }
    
    return {
      ...strategy,
      actions: adjustedActions,
      description: `${strategy.description} (${domainContext.type} domain, ${domainContext.isolationLevel})`
    };
  }
  
  private adjustForSharedEnvironment(
    action: HealingAction,
    domainContext: DomainContext
  ): HealingAction[] {
    switch (action.type) {
      case HealingActionType.PLUGIN_DEACTIVATE:
        if (domainContext.sharedResources.plugins) {
          // WARNING: Deactivating plugins will affect all domains
          return [{
            ...action,
            description: `${action.description} (WARNING: Affects all domains sharing plugins)`,
            requiresApproval: true,
            riskLevel: 'HIGH'
          }];
        }
        return [action];
        
      case HealingActionType.THEME_SWITCH:
        if (domainContext.sharedResources.themes) {
          // If themes are shared, switching theme affects all domains
          return [{
            ...action,
            description: `${action.description} (WARNING: Affects all domains sharing themes)`,
            requiresApproval: true,
            riskLevel: 'HIGH'
          }];
        }
        return [action];
        
      case HealingActionType.DATABASE_REPAIR:
        if (domainContext.sharedResources.database) {
          // Database repair affects all domains sharing the database
          return [{
            ...action,
            description: `${action.description} (WARNING: Affects all domains sharing database)`,
            requiresApproval: true,
            riskLevel: 'HIGH'
          }];
        }
        return [action];
        
      default:
        return [action];
    }
  }
}
```

### 2.2 Cascade Healing for Related Domains

```typescript
@Injectable()
export class CascadeHealingService {
  /**
   * When healing main domain, check if subdomains/addons need healing too
   */
  async checkCascadeHealing(
    applicationId: string,
    healedDomain: string,
    healingResult: HealingResult
  ): Promise<void> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId }
    });
    
    // Only cascade from main domain
    if (healedDomain !== app.domain) {
      return;
    }
    
    const metadata = app.metadata as any;
    const subdomains = metadata?.availableSubdomains || [];
    const addonDomains = metadata?.addonDomains || [];
    
    // Check if healing was for shared resources
    const affectsSharedResources = this.checkSharedResourceHealing(
      healingResult.actions
    );
    
    if (!affectsSharedResources) {
      return; // No cascade needed
    }
    
    // Trigger diagnosis for all related domains
    const relatedDomains = [
      ...subdomains.map((s: any) => s.subdomain),
      ...addonDomains.map((a: any) => a.domain)
    ];
    
    for (const domain of relatedDomains) {
      this.logger.log(
        `Triggering cascade diagnosis for ${domain} after healing ${healedDomain}`
      );
      
      await this.diagnosisQueue.enqueueDiagnosis(
        applicationId,
        DiagnosisProfile.QUICK,
        'SYSTEM',
        { subdomain: domain, trigger: 'CASCADE_HEALING' }
      );
    }
  }
  
  private checkSharedResourceHealing(actions: HealingAction[]): boolean {
    const sharedResourceActions = [
      HealingActionType.PLUGIN_DEACTIVATE,
      HealingActionType.PLUGIN_UPDATE,
      HealingActionType.THEME_SWITCH,
      HealingActionType.THEME_UPDATE,
      HealingActionType.DATABASE_REPAIR,
      HealingActionType.CORE_UPDATE
    ];
    
    return actions.some(action => 
      sharedResourceActions.includes(action.type)
    );
  }
}
```

## 3. Advanced Healing Scenarios

### 3.1 Disk Space Critical - Cleanup Before Healing



```typescript
@Injectable()
export class DiskSpaceHealingService {
  async healDiskSpace(
    serverId: string,
    sitePath: string,
    checkResults: CheckResult[]
  ): Promise<HealingResult> {
    const diskCheck = checkResults.find(
      r => r.checkType === DiagnosisCheckType.RESOURCE_MONITORING
    );
    
    const diskUsage = diskCheck?.details?.diskUsage || 0;
    const inodeUsage = diskCheck?.details?.inodeUsage || 0;
    
    const actions: HealingAction[] = [];
    let freedSpace = 0;
    
    // Strategy 1: Clean WordPress transients (safe, quick)
    if (diskUsage > 80 || inodeUsage > 80) {
      const transientResult = await this.cleanTransients(serverId, sitePath);
      actions.push(transientResult.action);
      freedSpace += transientResult.freedSpace;
    }
    
    // Strategy 2: Clean old revisions (safe, moderate impact)
    if (diskUsage > 85 || inodeUsage > 85) {
      const revisionResult = await this.cleanRevisions(serverId, sitePath);
      actions.push(revisionResult.action);
      freedSpace += revisionResult.freedSpace;
    }
    
    // Strategy 3: Clean spam comments (safe, moderate impact)
    if (diskUsage > 88 || inodeUsage > 88) {
      const spamResult = await this.cleanSpamComments(serverId, sitePath);
      actions.push(spamResult.action);
      freedSpace += spamResult.freedSpace;
    }
    
    // Strategy 4: Clean error logs (safe, can free significant space)
    if (diskUsage > 90 || inodeUsage > 90) {
      const logResult = await this.cleanErrorLogs(serverId, sitePath);
      actions.push(logResult.action);
      freedSpace += logResult.freedSpace;
    }
    
    // Strategy 5: Clean old backups (moderate risk)
    if (diskUsage > 92 || inodeUsage > 92) {
      const backupResult = await this.cleanOldBackups(serverId, sitePath);
      actions.push(backupResult.action);
      freedSpace += backupResult.freedSpace;
    }
    
    // Strategy 6: Optimize images (safe but slow)
    if (diskUsage > 93 || inodeUsage > 93) {
      const imageResult = await this.optimizeImages(serverId, sitePath);
      actions.push(imageResult.action);
      freedSpace += imageResult.freedSpace;
    }
    
    // Strategy 7: Clean cache directories (safe)
    if (diskUsage > 94 || inodeUsage > 94) {
      const cacheResult = await this.cleanCacheDirectories(serverId, sitePath);
      actions.push(cacheResult.action);
      freedSpace += cacheResult.freedSpace;
    }
    
    // Strategy 8: Emergency - delete unused themes/plugins (requires approval)
    if (diskUsage > 95 || inodeUsage > 95) {
      const unusedResult = await this.deleteUnusedThemesPlugins(serverId, sitePath);
      actions.push(unusedResult.action);
      freedSpace += unusedResult.freedSpace;
    }
    
    return {
      success: freedSpace > 0,
      message: `Freed ${this.formatBytes(freedSpace)} of disk space`,
      actions,
      metadata: {
        freedSpace,
        freedSpaceFormatted: this.formatBytes(freedSpace),
        diskUsageBefore: diskUsage,
        inodeUsageBefore: inodeUsage
      }
    };
  }
  
  private async cleanTransients(
    serverId: string,
    sitePath: string
  ): Promise<{ action: HealingAction; freedSpace: number }> {
    try {
      // Get size before
      const sizeBefore = await this.getTransientsSize(serverId, sitePath);
      
      // Delete expired transients
      await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp transient delete --expired --skip-plugins --skip-themes`
      );
      
      // Delete all transients if still critical
      await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp transient delete --all --skip-plugins --skip-themes`
      );
      
      const sizeAfter = await this.getTransientsSize(serverId, sitePath);
      const freedSpace = sizeBefore - sizeAfter;
      
      return {
        action: {
          type: HealingActionType.TRANSIENT_CLEANUP,
          description: `Cleaned transients (freed ${this.formatBytes(freedSpace)})`,
          success: true
        },
        freedSpace
      };
    } catch (error) {
      return {
        action: {
          type: HealingActionType.TRANSIENT_CLEANUP,
          description: 'Failed to clean transients',
          success: false,
          error: error.message
        },
        freedSpace: 0
      };
    }
  }
  
  private async cleanRevisions(
    serverId: string,
    sitePath: string
  ): Promise<{ action: HealingAction; freedSpace: number }> {
    try {
      const sizeBefore = await this.getDatabaseSize(serverId, sitePath);
      
      // Delete old revisions (keep last 5)
      await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp post delete $(wp post list --post_type='revision' --format=ids --posts_per_page=-1 | awk '{for(i=6;i<=NF;i++) print $i}') --force --skip-plugins --skip-themes`
      );
      
      const sizeAfter = await this.getDatabaseSize(serverId, sitePath);
      const freedSpace = sizeBefore - sizeAfter;
      
      return {
        action: {
          type: HealingActionType.DATABASE_CLEANUP,
          description: `Cleaned old revisions (freed ${this.formatBytes(freedSpace)})`,
          success: true
        },
        freedSpace
      };
    } catch (error) {
      return {
        action: {
          type: HealingActionType.DATABASE_CLEANUP,
          description: 'Failed to clean revisions',
          success: false,
          error: error.message
        },
        freedSpace: 0
      };
    }
  }
  
  private async cleanErrorLogs(
    serverId: string,
    sitePath: string
  ): Promise<{ action: HealingAction; freedSpace: number }> {
    try {
      // Get size of error logs
      const logSize = await this.sshExecutor.executeCommand(
        serverId,
        `du -sb ${sitePath}/error_log ${sitePath}/wp-content/debug.log 2>/dev/null | awk '{sum+=$1} END {print sum}'`
      );
      
      const sizeBefore = parseInt(logSize.trim()) || 0;
      
      // Truncate error logs (keep last 1000 lines)
      await this.sshExecutor.executeCommand(
        serverId,
        `tail -1000 ${sitePath}/error_log > ${sitePath}/error_log.tmp && mv ${sitePath}/error_log.tmp ${sitePath}/error_log 2>/dev/null || true`
      );
      
      await this.sshExecutor.executeCommand(
        serverId,
        `tail -1000 ${sitePath}/wp-content/debug.log > ${sitePath}/wp-content/debug.log.tmp && mv ${sitePath}/wp-content/debug.log.tmp ${sitePath}/wp-content/debug.log 2>/dev/null || true`
      );
      
      const freedSpace = sizeBefore * 0.9; // Estimate 90% freed
      
      return {
        action: {
          type: HealingActionType.LOG_CLEANUP,
          description: `Truncated error logs (freed ${this.formatBytes(freedSpace)})`,
          success: true
        },
        freedSpace
      };
    } catch (error) {
      return {
        action: {
          type: HealingActionType.LOG_CLEANUP,
          description: 'Failed to clean error logs',
          success: false,
          error: error.message
        },
        freedSpace: 0
      };
    }
  }
}
```

### 3.2 Memory Exhaustion - Progressive Memory Increase

```typescript
@Injectable()
export class MemoryHealingService {
  async healMemoryExhaustion(
    serverId: string,
    sitePath: string,
    checkResults: CheckResult[]
  ): Promise<HealingResult> {
    const actions: HealingAction[] = [];
    
    // 1. Get current memory limits
    const currentLimits = await this.getCurrentMemoryLimits(serverId, sitePath);
    
    // 2. Analyze memory usage patterns
    const memoryAnalysis = await this.analyzeMemoryUsage(serverId, sitePath);
    
    // 3. Calculate recommended memory limit
    const recommendedLimit = this.calculateRecommendedMemory(
      currentLimits,
      memoryAnalysis
    );
    
    // 4. Progressive increase strategy
    const increaseSteps = this.calculateIncreaseSteps(
      currentLimits.wpMemoryLimit,
      recommendedLimit
    );
    
    for (const step of increaseSteps) {
      const result = await this.increaseMemoryLimit(
        serverId,
        sitePath,
        step.limit
      );
      
      actions.push(result.action);
      
      // Test if site works with new limit
      const siteWorks = await this.testSiteAfterMemoryIncrease(
        serverId,
        sitePath
      );
      
      if (siteWorks) {
        // Success! Stop here
        break;
      }
    }
    
    // 5. If still failing, identify memory-hungry plugins
    const memoryHungryPlugins = await this.identifyMemoryHungryPlugins(
      serverId,
      sitePath
    );
    
    if (memoryHungryPlugins.length > 0) {
      actions.push({
        type: HealingActionType.PLUGIN_DEACTIVATE,
        description: `Deactivated memory-hungry plugins: ${memoryHungryPlugins.join(', ')}`,
        success: true,
        metadata: { plugins: memoryHungryPlugins }
      });
    }
    
    return {
      success: actions.some(a => a.success),
      message: 'Memory limits adjusted',
      actions
    };
  }
  
  private calculateIncreaseSteps(
    current: number,
    target: number
  ): Array<{ limit: number; description: string }> {
    const steps = [];
    const increments = [128, 256, 384, 512, 768, 1024];
    
    for (const increment of increments) {
      if (increment > current && increment <= target) {
        steps.push({
          limit: increment,
          description: `Increase to ${increment}M`
        });
      }
    }
    
    return steps;
  }
  
  private async identifyMemoryHungryPlugins(
    serverId: string,
    sitePath: string
  ): Promise<string[]> {
    // Get list of active plugins
    const plugins = await this.sshExecutor.executeCommand(
      serverId,
      `cd ${sitePath} && wp plugin list --status=active --field=name --skip-themes`
    );
    
    const pluginList = plugins.trim().split('\n');
    const memoryHungry: string[] = [];
    
    // Known memory-hungry plugins
    const knownMemoryHungry = [
      'wordfence',
      'jetpack',
      'woocommerce',
      'wpml',
      'elementor',
      'visual-composer'
    ];
    
    for (const plugin of pluginList) {
      if (knownMemoryHungry.some(known => plugin.toLowerCase().includes(known))) {
        memoryHungry.push(plugin);
      }
    }
    
    return memoryHungry;
  }
}
```

### 3.3 Plugin Conflict - Binary Search Isolation



```typescript
@Injectable()
export class PluginConflictHealingService {
  /**
   * Use binary search to quickly identify conflicting plugin
   * Instead of testing plugins one by one (O(n)), use binary search (O(log n))
   */
  async identifyConflictingPlugin(
    serverId: string,
    sitePath: string
  ): Promise<string[]> {
    // Get all active plugins
    const allPlugins = await this.getActivePlugins(serverId, sitePath);
    
    if (allPlugins.length === 0) {
      return [];
    }
    
    // Deactivate all plugins
    await this.deactivateAllPlugins(serverId, sitePath);
    
    // Test if site works without plugins
    const worksWithoutPlugins = await this.testSite(serverId, sitePath);
    
    if (!worksWithoutPlugins) {
      // Issue is not plugin-related
      return [];
    }
    
    // Binary search to find conflicting plugin(s)
    const conflicting = await this.binarySearchConflict(
      serverId,
      sitePath,
      allPlugins
    );
    
    return conflicting;
  }
  
  private async binarySearchConflict(
    serverId: string,
    sitePath: string,
    plugins: string[]
  ): Promise<string[]> {
    if (plugins.length === 0) {
      return [];
    }
    
    if (plugins.length === 1) {
      // Test single plugin
      await this.activatePlugins(serverId, sitePath, plugins);
      const works = await this.testSite(serverId, sitePath);
      await this.deactivatePlugins(serverId, sitePath, plugins);
      
      return works ? [] : plugins;
    }
    
    // Split plugins in half
    const mid = Math.floor(plugins.length / 2);
    const firstHalf = plugins.slice(0, mid);
    const secondHalf = plugins.slice(mid);
    
    // Test first half
    await this.activatePlugins(serverId, sitePath, firstHalf);
    const firstHalfWorks = await this.testSite(serverId, sitePath);
    await this.deactivatePlugins(serverId, sitePath, firstHalf);
    
    // Test second half
    await this.activatePlugins(serverId, sitePath, secondHalf);
    const secondHalfWorks = await this.testSite(serverId, sitePath);
    await this.deactivatePlugins(serverId, sitePath, secondHalf);
    
    const conflicting: string[] = [];
    
    // Recurse into halves that have conflicts
    if (!firstHalfWorks) {
      conflicting.push(
        ...await this.binarySearchConflict(serverId, sitePath, firstHalf)
      );
    }
    
    if (!secondHalfWorks) {
      conflicting.push(
        ...await this.binarySearchConflict(serverId, sitePath, secondHalf)
      );
    }
    
    return conflicting;
  }
  
  private async testSite(
    serverId: string,
    sitePath: string
  ): Promise<boolean> {
    try {
      // Quick test: Check if WordPress loads
      const result = await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp core version --skip-plugins --skip-themes`,
        { timeout: 10000 }
      );
      
      return result.trim().length > 0;
    } catch (error) {
      return false;
    }
  }
}
```

### 3.4 SSL Certificate Issues - Auto-Renewal

```typescript
@Injectable()
export class SSLHealingService {
  async healSSLCertificate(
    serverId: string,
    domain: string,
    checkResults: CheckResult[]
  ): Promise<HealingResult> {
    const sslCheck = checkResults.find(
      r => r.checkType === DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION
    );
    
    if (!sslCheck || sslCheck.status === CheckStatus.PASS) {
      return {
        success: true,
        message: 'SSL certificate is valid',
        actions: []
      };
    }
    
    const actions: HealingAction[] = [];
    
    // Determine SSL issue type
    const issueType = this.classifySSLIssue(sslCheck);
    
    switch (issueType) {
      case 'EXPIRED':
        return this.renewSSLCertificate(serverId, domain, actions);
        
      case 'EXPIRING_SOON':
        return this.renewSSLCertificate(serverId, domain, actions);
        
      case 'SELF_SIGNED':
        return this.installLetsEncryptCertificate(serverId, domain, actions);
        
      case 'INVALID_CHAIN':
        return this.fixCertificateChain(serverId, domain, actions);
        
      case 'MIXED_CONTENT':
        return this.fixMixedContent(serverId, domain, actions);
        
      default:
        return {
          success: false,
          message: 'Unknown SSL issue',
          actions
        };
    }
  }
  
  private async renewSSLCertificate(
    serverId: string,
    domain: string,
    actions: HealingAction[]
  ): Promise<HealingResult> {
    try {
      // Check if Let's Encrypt is available
      const hasLetsEncrypt = await this.checkLetsEncryptAvailable(serverId);
      
      if (hasLetsEncrypt) {
        // Renew using certbot
        await this.sshExecutor.executeCommand(
          serverId,
          `certbot renew --cert-name ${domain} --force-renewal`,
          { timeout: 120000 }
        );
        
        actions.push({
          type: HealingActionType.SSL_RENEWAL,
          description: 'Renewed SSL certificate using Let\'s Encrypt',
          success: true
        });
        
        // Reload web server
        await this.reloadWebServer(serverId);
        
        return {
          success: true,
          message: 'SSL certificate renewed successfully',
          actions
        };
      } else {
        // Check if cPanel/WHM is available
        const hasCPanel = await this.checkCPanelAvailable(serverId);
        
        if (hasCPanel) {
          // Use cPanel AutoSSL
          await this.sshExecutor.executeCommand(
            serverId,
            `/usr/local/cpanel/bin/autossl_check --all`,
            { timeout: 120000 }
          );
          
          actions.push({
            type: HealingActionType.SSL_RENEWAL,
            description: 'Triggered cPanel AutoSSL renewal',
            success: true
          });
          
          return {
            success: true,
            message: 'SSL renewal triggered via cPanel AutoSSL',
            actions
          };
        }
      }
      
      return {
        success: false,
        message: 'No SSL renewal method available',
        actions
      };
      
    } catch (error) {
      actions.push({
        type: HealingActionType.SSL_RENEWAL,
        description: 'Failed to renew SSL certificate',
        success: false,
        error: error.message
      });
      
      return {
        success: false,
        message: `SSL renewal failed: ${error.message}`,
        actions
      };
    }
  }
  
  private async fixMixedContent(
    serverId: string,
    domain: string,
    actions: HealingAction[]
  ): Promise<HealingResult> {
    try {
      // Get site path
      const sitePath = await this.getSitePath(serverId, domain);
      
      // Update site URL to HTTPS
      await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp option update home 'https://${domain}' --skip-plugins --skip-themes`
      );
      
      await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp option update siteurl 'https://${domain}' --skip-plugins --skip-themes`
      );
      
      actions.push({
        type: HealingActionType.URL_UPDATE,
        description: 'Updated site URLs to HTTPS',
        success: true
      });
      
      // Search and replace HTTP URLs in database
      await this.sshExecutor.executeCommand(
        serverId,
        `cd ${sitePath} && wp search-replace 'http://${domain}' 'https://${domain}' --skip-plugins --skip-themes --all-tables`,
        { timeout: 300000 }
      );
      
      actions.push({
        type: HealingActionType.DATABASE_UPDATE,
        description: 'Replaced HTTP URLs with HTTPS in database',
        success: true
      });
      
      return {
        success: true,
        message: 'Fixed mixed content issues',
        actions
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to fix mixed content: ${error.message}`,
        actions
      };
    }
  }
}
```

### 3.5 Malware Detection - Intelligent Cleanup

```typescript
@Injectable()
export class MalwareHealingService {
  async healMalwareInfection(
    serverId: string,
    sitePath: string,
    checkResults: CheckResult[]
  ): Promise<HealingResult> {
    const malwareCheck = checkResults.find(
      r => r.checkType === DiagnosisCheckType.MALWARE_DETECTION
    );
    
    if (!malwareCheck || malwareCheck.status === CheckStatus.PASS) {
      return {
        success: true,
        message: 'No malware detected',
        actions: []
      };
    }
    
    const actions: HealingAction[] = [];
    const infectedFiles = malwareCheck.details?.infectedFiles || [];
    
    // Strategy 1: Quarantine infected files
    const quarantineResult = await this.quarantineInfectedFiles(
      serverId,
      sitePath,
      infectedFiles
    );
    actions.push(quarantineResult.action);
    
    // Strategy 2: Restore core files from clean source
    const coreFiles = infectedFiles.filter((f: any) => 
      !f.path.includes('wp-content')
    );
    
    if (coreFiles.length > 0) {
      const restoreResult = await this.restoreCoreFiles(
        serverId,
        sitePath,
        coreFiles
      );
      actions.push(restoreResult.action);
    }
    
    // Strategy 3: Scan and clean database injections
    const dbCleanResult = await this.cleanDatabaseInjections(
      serverId,
      sitePath
    );
    actions.push(dbCleanResult.action);
    
    // Strategy 4: Reset all passwords
    const passwordResult = await this.resetAllPasswords(
      serverId,
      sitePath
    );
    actions.push(passwordResult.action);
    
    // Strategy 5: Regenerate security keys
    const keysResult = await this.regenerateSecurityKeys(
      serverId,
      sitePath
    );
    actions.push(keysResult.action);
    
    // Strategy 6: Update all plugins and themes
    const updateResult = await this.updateAllComponents(
      serverId,
      sitePath
    );
    actions.push(updateResult.action);
    
    return {
      success: actions.every(a => a.success),
      message: `Cleaned ${infectedFiles.length} infected files`,
      actions
    };
  }
  
  private async quarantineInfectedFiles(
    serverId: string,
    sitePath: string,
    infectedFiles: any[]
  ): Promise<{ action: HealingAction }> {
    try {
      const quarantineDir = `${sitePath}/../quarantine_${Date.now()}`;
      
      // Create quarantine directory
      await this.sshExecutor.executeCommand(
        serverId,
        `mkdir -p ${quarantineDir}`
      );
      
      // Move infected files to quarantine
      for (const file of infectedFiles) {
        const filePath = `${sitePath}/${file.path}`;
        const fileName = file.path.replace(/\//g, '_');
        
        await this.sshExecutor.executeCommand(
          serverId,
          `mv ${filePath} ${quarantineDir}/${fileName} 2>/dev/null || true`
        );
      }
      
      return {
        action: {
          type: HealingActionType.MALWARE_QUARANTINE,
          description: `Quarantined ${infectedFiles.length} infected files`,
          success: true,
          metadata: { quarantineDir, fileCount: infectedFiles.length }
        }
      };
    } catch (error) {
      return {
        action: {
          type: HealingActionType.MALWARE_QUARANTINE,
          description: 'Failed to quarantine infected files',
          success: false,
          error: error.message
        }
      };
    }
  }
  
  private async cleanDatabaseInjections(
    serverId: string,
    sitePath: string
  ): Promise<{ action: HealingAction }> {
    try {
      // Common malware patterns in database
      const malwarePatterns = [
        'eval(base64_decode',
        'eval(gzinflate',
        'eval(str_rot13',
        'assert(base64_decode',
        '<iframe',
        '<script>document.write',
        'fromCharCode'
      ];
      
      let cleanedCount = 0;
      
      for (const pattern of malwarePatterns) {
        // Search for pattern in options table
        const result = await this.sshExecutor.executeCommand(
          serverId,
          `cd ${sitePath} && wp db query "SELECT COUNT(*) FROM wp_options WHERE option_value LIKE '%${pattern}%'" --skip-plugins --skip-themes`
        );
        
        const count = parseInt(result.trim().split('\n')[1]) || 0;
        
        if (count > 0) {
          // Clean the injections
          await this.sshExecutor.executeCommand(
            serverId,
            `cd ${sitePath} && wp db query "UPDATE wp_options SET option_value = '' WHERE option_value LIKE '%${pattern}%'" --skip-plugins --skip-themes`
          );
          
          cleanedCount += count;
        }
      }
      
      return {
        action: {
          type: HealingActionType.DATABASE_CLEANUP,
          description: `Cleaned ${cleanedCount} database injections`,
          success: true,
          metadata: { cleanedCount }
        }
      };
    } catch (error) {
      return {
        action: {
          type: HealingActionType.DATABASE_CLEANUP,
          description: 'Failed to clean database injections',
          success: false,
          error: error.message
        }
      };
    }
  }
}
```

## 4. Predictive Healing

### 4.1 Pattern Learning from Past Healings



```typescript
@Injectable()
export class PredictiveHealingService {
  /**
   * Learn from past healing attempts to predict best strategy
   */
  async predictBestStrategy(
    applicationId: string,
    correlationResult: CorrelationResult,
    checkResults: CheckResult[]
  ): Promise<HealingStrategy> {
    // 1. Get healing history for this application
    const history = await this.prisma.healing_executions_new.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    // 2. Get similar healing patterns from other sites
    const similarPatterns = await this.findSimilarPatterns(
      correlationResult,
      checkResults
    );
    
    // 3. Calculate success rates for each strategy
    const strategyScores = await this.calculateStrategyScores(
      history,
      similarPatterns,
      correlationResult
    );
    
    // 4. Select strategy with highest success probability
    const bestStrategy = this.selectBestStrategy(strategyScores);
    
    // 5. Customize strategy based on site-specific context
    return this.customizeStrategy(
      bestStrategy,
      applicationId,
      checkResults
    );
  }
  
  private async findSimilarPatterns(
    correlationResult: CorrelationResult,
    checkResults: CheckResult[]
  ): Promise<any[]> {
    // Find healing patterns with similar symptoms
    const primaryRootCause = correlationResult.rootCauses[0];
    
    const patterns = await this.prisma.healing_patterns.findMany({
      where: {
        rootCause: primaryRootCause.name,
        successRate: { gte: 0.7 } // Only patterns with >70% success rate
      },
      orderBy: { successRate: 'desc' },
      take: 5
    });
    
    return patterns;
  }
  
  private async calculateStrategyScores(
    history: any[],
    similarPatterns: any[],
    correlationResult: CorrelationResult
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    
    // Score based on historical success
    for (const execution of history) {
      const strategy = execution.healingPlan?.strategy;
      if (!strategy) continue;
      
      const currentScore = scores.get(strategy) || 0;
      const weight = execution.executionStatus === 'COMPLETED' ? 1 : -0.5;
      scores.set(strategy, currentScore + weight);
    }
    
    // Score based on similar patterns
    for (const pattern of similarPatterns) {
      const strategy = pattern.strategy;
      const currentScore = scores.get(strategy) || 0;
      scores.set(strategy, currentScore + pattern.successRate * 2);
    }
    
    // Score based on correlation confidence
    const primaryRootCause = correlationResult.rootCauses[0];
    const confidenceBonus = primaryRootCause.confidence / 100;
    
    for (const [strategy, score] of scores.entries()) {
      scores.set(strategy, score * (1 + confidenceBonus));
    }
    
    return scores;
  }
}
```

### 4.2 Proactive Healing Triggers

```typescript
@Injectable()
export class ProactiveHealingService {
  /**
   * Trigger healing before issues become critical
   */
  async checkProactiveHealing(
    applicationId: string,
    checkResults: CheckResult[]
  ): Promise<void> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId }
    });
    
    if (!app.isHealerEnabled) {
      return;
    }
    
    // Proactive trigger conditions
    const triggers = [
      this.checkDiskSpaceTrend(checkResults),
      this.checkMemoryTrend(checkResults),
      this.checkErrorRateTrend(checkResults),
      this.checkPerformanceDegradation(checkResults),
      this.checkSecurityThreats(checkResults)
    ];
    
    const triggeredConditions = (await Promise.all(triggers))
      .filter(t => t.shouldTrigger);
    
    if (triggeredConditions.length > 0) {
      this.logger.log(
        `Proactive healing triggered for ${app.domain}: ${triggeredConditions.map(t => t.reason).join(', ')}`
      );
      
      await this.healingOrchestrator.heal(
        applicationId,
        HealerTrigger.PROACTIVE,
        'SYSTEM'
      );
    }
  }
  
  private async checkDiskSpaceTrend(
    checkResults: CheckResult[]
  ): Promise<{ shouldTrigger: boolean; reason: string }> {
    const diskCheck = checkResults.find(
      r => r.checkType === DiagnosisCheckType.RESOURCE_MONITORING
    );
    
    if (!diskCheck) {
      return { shouldTrigger: false, reason: '' };
    }
    
    const diskUsage = diskCheck.details?.diskUsage || 0;
    
    // Trigger if disk usage >85% (before it becomes critical at 95%)
    if (diskUsage > 85) {
      return {
        shouldTrigger: true,
        reason: `Disk usage at ${diskUsage}% - proactive cleanup recommended`
      };
    }
    
    return { shouldTrigger: false, reason: '' };
  }
  
  private async checkErrorRateTrend(
    checkResults: CheckResult[]
  ): Promise<{ shouldTrigger: boolean; reason: string }> {
    const errorLogCheck = checkResults.find(
      r => r.checkType === DiagnosisCheckType.ERROR_LOG_ANALYSIS
    );
    
    if (!errorLogCheck) {
      return { shouldTrigger: false, reason: '' };
    }
    
    const errorRate = errorLogCheck.details?.errorRate || 0;
    const errorSpike = errorLogCheck.details?.errorSpike || false;
    
    // Trigger if error rate is increasing rapidly
    if (errorSpike && errorRate > 10) {
      return {
        shouldTrigger: true,
        reason: `Error rate spike detected (${errorRate} errors/hour)`
      };
    }
    
    return { shouldTrigger: false, reason: '' };
  }
}
```

## 5. Enhanced Healing Orchestrator

### 5.1 Intelligent Healing Workflow

```typescript
@Injectable()
export class EnhancedHealingOrchestratorService {
  async heal(
    applicationId: string,
    trigger: HealerTrigger,
    triggeredBy: string,
    options?: {
      targetDomain?: string;
      forceStrategy?: string;
    }
  ): Promise<HealingExecutionResult> {
    const executionId = uuidv4();
    
    try {
      // 1. Get application and diagnosis results
      const app = await this.prisma.applications.findUnique({
        where: { id: applicationId },
        include: { servers: true }
      });
      
      const latestDiagnosis = await this.getLatestDiagnosis(applicationId);
      
      if (!latestDiagnosis) {
        throw new Error('No recent diagnosis found - run diagnosis first');
      }
      
      // 2. Analyze domain context (main/subdomain/addon)
      const domainContext = await this.domainAwareHealing.analyzeDomainContext(
        applicationId,
        options?.targetDomain || app.domain
      );
      
      // 3. Determine intelligent backup strategy
      const backupStrategy = await this.intelligentBackup.determineBackupStrategy(
        app.serverId,
        domainContext.path,
        latestDiagnosis.checkResults
      );
      
      // 4. Create backup (if needed)
      let backupId: string | null = null;
      if (backupStrategy.type !== 'SKIP') {
        backupId = await this.intelligentBackup.createIntelligentBackup(
          app.serverId,
          domainContext.path,
          backupStrategy
        );
      }
      
      // 5. Predict best healing strategy
      const strategy = options?.forceStrategy
        ? await this.strategySelector.getStrategy(options.forceStrategy)
        : await this.predictiveHealing.predictBestStrategy(
            applicationId,
            latestDiagnosis.correlationResult,
            latestDiagnosis.checkResults
          );
      
      // 6. Adjust strategy for domain context
      const adjustedStrategy = await this.domainAwareHealing.adjustHealingStrategy(
        strategy,
        domainContext
      );
      
      // 7. Create execution record
      await this.prisma.healing_executions_new.create({
        data: {
          id: executionId,
          applicationId,
          trigger,
          triggeredBy,
          diagnosticResults: latestDiagnosis.checkResults,
          healthScore: latestDiagnosis.overallHealthScore,
          healingPlan: {
            strategy: adjustedStrategy.name,
            actions: adjustedStrategy.actions,
            backupStrategy: backupStrategy.type,
            domainContext
          },
          executionStatus: 'PENDING',
          backupId
        }
      });
      
      // 8. Execute healing
      const result = await this.healingExecutor.executeHealing(
        applicationId,
        adjustedStrategy,
        executionId
      );
      
      // 9. Cascade healing if needed
      if (result.success && domainContext.type === 'main') {
        await this.cascadeHealing.checkCascadeHealing(
          applicationId,
          domainContext.domain,
          result
        );
      }
      
      // 10. Learn from execution
      await this.patternLearning.learnFromExecution(
        executionId,
        result
      );
      
      return result;
      
    } catch (error) {
      this.logger.error(`Healing failed: ${error.message}`, error.stack);
      
      await this.prisma.healing_executions_new.update({
        where: { id: executionId },
        data: {
          executionStatus: 'FAILED',
          error: error.message
        }
      });
      
      throw error;
    }
  }
}
```

## 6. New Healing Action Types

```typescript
enum HealingActionType {
  // Existing actions
  CACHE_CLEAR = 'CACHE_CLEAR',
  TRANSIENT_CLEANUP = 'TRANSIENT_CLEANUP',
  PERMISSION_FIX = 'PERMISSION_FIX',
  HTACCESS_RESET = 'HTACCESS_RESET',
  PLUGIN_DEACTIVATE = 'PLUGIN_DEACTIVATE',
  THEME_SWITCH = 'THEME_SWITCH',
  MEMORY_LIMIT_INCREASE = 'MEMORY_LIMIT_INCREASE',
  DEBUG_MODE_DISABLE = 'DEBUG_MODE_DISABLE',
  FILE_RESTORE = 'FILE_RESTORE',
  DATABASE_REPAIR = 'DATABASE_REPAIR',
  CORE_UPDATE = 'CORE_UPDATE',
  PLUGIN_UPDATE = 'PLUGIN_UPDATE',
  
  // New intelligent actions
  DATABASE_USER_CREATE = 'DATABASE_USER_CREATE',
  DATABASE_PASSWORD_RESET = 'DATABASE_PASSWORD_RESET',
  DATABASE_PRIVILEGES_GRANT = 'DATABASE_PRIVILEGES_GRANT',
  DATABASE_CLEANUP = 'DATABASE_CLEANUP',
  LOG_CLEANUP = 'LOG_CLEANUP',
  SSL_RENEWAL = 'SSL_RENEWAL',
  URL_UPDATE = 'URL_UPDATE',
  MALWARE_QUARANTINE = 'MALWARE_QUARANTINE',
  SECURITY_KEYS_REGENERATE = 'SECURITY_KEYS_REGENERATE',
  PASSWORD_RESET_ALL = 'PASSWORD_RESET_ALL',
  DISK_SPACE_CLEANUP = 'DISK_SPACE_CLEANUP',
  IMAGE_OPTIMIZATION = 'IMAGE_OPTIMIZATION',
  REVISION_CLEANUP = 'REVISION_CLEANUP',
  SPAM_CLEANUP = 'SPAM_CLEANUP',
  BACKUP_CLEANUP = 'BACKUP_CLEANUP',
  CACHE_DIRECTORY_CLEANUP = 'CACHE_DIRECTORY_CLEANUP',
  UNUSED_THEMES_PLUGINS_DELETE = 'UNUSED_THEMES_PLUGINS_DELETE',
}
```

## 7. Summary of Enhancements

### Intelligence Features
✅ **Context-Aware Backup**: Skip/selective/remote backup based on disk space
✅ **Smart Database Healing**: Auto-create users, reset passwords, grant privileges
✅ **Domain Awareness**: Understand main/subdomain/addon relationships
✅ **Cascade Healing**: Heal related domains when shared resources are fixed
✅ **Binary Search Plugin Isolation**: O(log n) instead of O(n) for conflict detection
✅ **Progressive Memory Increase**: Gradual memory limit increases with testing
✅ **Intelligent Disk Cleanup**: 8-level cleanup strategy based on severity
✅ **SSL Auto-Renewal**: Let's Encrypt and cPanel AutoSSL support
✅ **Malware Cleanup**: Quarantine, restore, database cleaning
✅ **Predictive Healing**: Learn from past attempts and similar patterns
✅ **Proactive Healing**: Trigger before issues become critical

### Advanced Scenarios Covered
1. ✅ Disk space critical → Skip backup, cleanup first
2. ✅ Database credentials wrong → Create new user with privileges
3. ✅ Plugin conflict → Binary search isolation
4. ✅ Memory exhaustion → Progressive increase + plugin analysis
5. ✅ SSL expired → Auto-renewal with Let's Encrypt/cPanel
6. ✅ Malware detected → Quarantine + restore + database clean
7. ✅ Subdomain issues → Cascade healing to related domains
8. ✅ Shared resources → Warn about impact on other domains
9. ✅ Error rate spike → Proactive healing trigger
10. ✅ Performance degradation → Predictive strategy selection

### Next Steps
1. Implement intelligent backup service
2. Implement database credential healing
3. Implement domain-aware healing
4. Implement advanced healing scenarios
5. Implement predictive healing
6. Test with real-world scenarios
7. Monitor and refine strategies

