/**
 * WordPress Healing Service
 * 
 * Phase 2: WordPress-specific healing strategies
 * - WSOD Recovery
 * - Database Connection Fix
 * - Plugin Conflict Detection (Binary Search)
 * - Memory Exhaustion Fix
 * - Permission Fix
 * - Cache Clear
 * - Core Update
 * - Database Repair
 * - Malware Cleanup
 * - SSL Auto-Renewal
 */

import { Injectable, Logger } from '@nestjs/common';
import { HealerTrigger, TechStack } from '@prisma/client';
import { SSHExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';
import { DatabaseCredentialHealingService } from './database-credential-healing.service';
import { BinarySearchPluginConflictService } from './binary-search-plugin-conflict.service';

interface HealingResult {
  success: boolean;
  message: string;
  actions: HealingAction[];
  metadata?: Record<string, any>;
}

interface HealingAction {
  type: string;
  description: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface DiagnosisResult {
  diagnosisType: string;
  healthScore: number;
  issuesFound: number;
  criticalIssues: number;
  checkResults: any[];
  details: any;
}

@Injectable()
export class WordPressHealingService {
  private readonly logger = new Logger(WordPressHealingService.name);
  
  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService,
    private readonly dbCredentialHealing: DatabaseCredentialHealingService,
    private readonly pluginConflictService: BinarySearchPluginConflictService
  ) {}
  
  /**
   * Check if this service can handle the tech stack
   */
  canHandle(techStack: TechStack): boolean {
    return techStack === TechStack.WORDPRESS;
  }
  
  /**
   * Main healing entry point for WordPress
   */
  async heal(
    application: any,
    diagnosis: DiagnosisResult,
    trigger: HealerTrigger,
    triggeredBy: string
  ): Promise<HealingResult> {
    this.logger.log(
      `WordPress healing for ${application.domain} (diagnosis: ${diagnosis.diagnosisType})`
    );
    
    const actions: HealingAction[] = [];
    const serverId = application.serverId;
    const sitePath = application.path;
    
    // Analyze diagnosis check results to determine specific issues
    const specificIssues = this.analyzeCheckResults(diagnosis.checkResults);
    
    this.logger.log(
      `Found ${specificIssues.length} specific issues: ${specificIssues.map(i => i.type).join(', ')}`
    );
    
    // Apply targeted healing based on specific issues found
    for (const issue of specificIssues) {
      await this.healSpecificIssue(serverId, sitePath, issue, diagnosis, actions);
    }
    
    // If no specific issues found, use diagnosis type as fallback
    if (specificIssues.length === 0) {
      this.logger.log('No specific issues found, using diagnosis type fallback');
      
      switch (diagnosis.diagnosisType) {
        case 'WSOD':
          await this.healWSOD(serverId, sitePath, diagnosis, actions);
          break;
          
        case 'DB_ERROR':
          await this.healDatabaseError(serverId, sitePath, diagnosis, actions);
          break;
          
        case 'MEMORY_EXHAUSTION':
          await this.healMemoryExhaustion(serverId, sitePath, diagnosis, actions);
          break;
          
        case 'PERMISSION':
          await this.healPermissions(serverId, sitePath, diagnosis, actions);
          break;
          
        case 'CACHE':
          await this.healCache(serverId, sitePath, diagnosis, actions);
          break;
          
        default:
          await this.healGeneric(serverId, sitePath, diagnosis, actions);
      }
    }
    
    const success = actions.length > 0 && actions.some(a => a.success);
    
    return {
      success,
      message: success 
        ? `WordPress healing completed: ${actions.filter(a => a.success).length}/${actions.length} actions successful`
        : 'WordPress healing failed - no successful actions',
      actions,
      metadata: {
        diagnosisType: diagnosis.diagnosisType,
        healthScore: diagnosis.healthScore,
        specificIssues: specificIssues.map(i => i.type),
        actionsAttempted: actions.length,
        actionsSuccessful: actions.filter(a => a.success).length
      }
    };
  }
  
  /**
   * Analyze check results to identify specific issues
   */
  private analyzeCheckResults(checkResults: any[]): Array<{
    type: string;
    details: any;
    checkName: string;
  }> {
    const issues: Array<{ type: string; details: any; checkName: string }> = [];
    
    if (!checkResults || checkResults.length === 0) {
      return issues;
    }
    
    for (const check of checkResults) {
      // Skip passing checks
      if (check.status === 'PASS') {
        continue;
      }
      
      // Identify specific issues from check results
      const checkName = check.checkName || check.checkType;
      const details = check.details || {};
      const message = check.message || '';
      
      // Plugin issues
      if (checkName?.includes('plugin') || message.toLowerCase().includes('plugin')) {
        if (details.conflictingPlugins && details.conflictingPlugins.length > 0) {
          issues.push({
            type: 'SPECIFIC_PLUGIN_CONFLICT',
            details: { plugins: details.conflictingPlugins },
            checkName
          });
        } else if (details.problematicPlugin) {
          issues.push({
            type: 'SPECIFIC_PLUGIN_CONFLICT',
            details: { plugins: [details.problematicPlugin] },
            checkName
          });
        }
      }
      
      // Theme issues
      if (checkName?.includes('theme') || message.toLowerCase().includes('theme')) {
        if (details.problematicTheme) {
          issues.push({
            type: 'SPECIFIC_THEME_ISSUE',
            details: { theme: details.problematicTheme },
            checkName
          });
        }
      }
      
      // Database issues
      if (checkName?.includes('database') || message.toLowerCase().includes('database')) {
        if (message.includes('Access denied') || message.includes('Connection refused')) {
          issues.push({
            type: 'DATABASE_CREDENTIALS',
            details: { errorMessage: message },
            checkName
          });
        } else if (message.includes('corrupt') || message.includes('repair')) {
          issues.push({
            type: 'DATABASE_CORRUPTION',
            details: { tables: details.corruptedTables || [] },
            checkName
          });
        }
      }
      
      // Memory issues
      if (checkName?.includes('memory') || message.toLowerCase().includes('memory')) {
        issues.push({
          type: 'MEMORY_LIMIT',
          details: { 
            currentLimit: details.currentLimit,
            recommendedLimit: details.recommendedLimit
          },
          checkName
        });
      }
      
      // Permission issues
      if (checkName?.includes('permission') || message.toLowerCase().includes('permission')) {
        issues.push({
          type: 'FILE_PERMISSIONS',
          details: { 
            files: details.filesWithIssues || [],
            directories: details.directoriesWithIssues || []
          },
          checkName
        });
      }
      
      // Cache issues
      if (checkName?.includes('cache') || message.toLowerCase().includes('cache')) {
        issues.push({
          type: 'CACHE_ISSUE',
          details: {},
          checkName
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Heal specific issue identified from diagnosis
   */
  private async healSpecificIssue(
    serverId: string,
    sitePath: string,
    issue: { type: string; details: any; checkName: string },
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log(`Healing specific issue: ${issue.type}`);
    
    switch (issue.type) {
      case 'SPECIFIC_PLUGIN_CONFLICT':
        await this.deactivateSpecificPlugins(serverId, sitePath, issue.details.plugins, actions);
        break;
        
      case 'SPECIFIC_THEME_ISSUE':
        await this.switchFromSpecificTheme(serverId, sitePath, issue.details.theme, actions);
        break;
        
      case 'DATABASE_CREDENTIALS':
        await this.healDatabaseError(serverId, sitePath, diagnosis, actions);
        break;
        
      case 'DATABASE_CORRUPTION':
        await this.repairSpecificTables(serverId, sitePath, issue.details.tables, actions);
        break;
        
      case 'MEMORY_LIMIT':
        await this.increaseMemoryToRecommended(
          serverId,
          sitePath,
          issue.details.currentLimit,
          issue.details.recommendedLimit,
          actions
        );
        break;
        
      case 'FILE_PERMISSIONS':
        await this.fixSpecificPermissions(
          serverId,
          sitePath,
          issue.details.files,
          issue.details.directories,
          actions
        );
        break;
        
      case 'CACHE_ISSUE':
        await this.clearCache(serverId, sitePath);
        actions.push({
          type: 'CACHE_CLEAR',
          description: 'Cleared WordPress cache',
          success: true
        });
        break;
    }
  }
  
  /**
   * Deactivate specific plugins (not all)
   */
  private async deactivateSpecificPlugins(
    serverId: string,
    sitePath: string,
    plugins: string[],
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log(`Deactivating specific plugins: ${plugins.join(', ')}`);
    
    for (const plugin of plugins) {
      try {
        const output = await this.wpCli.execute(
          serverId,
          sitePath,
          `plugin deactivate ${plugin} --skip-plugins --skip-themes`
        );
        
        actions.push({
          type: 'PLUGIN_DEACTIVATE_SPECIFIC',
          description: `Deactivated plugin: ${plugin}`,
          success: true,
          metadata: {
            plugin,
            output: output.trim()
          }
        });
      } catch (error) {
        const err = error as Error;
        actions.push({
          type: 'PLUGIN_DEACTIVATE_SPECIFIC',
          description: `Failed to deactivate plugin: ${plugin}`,
          success: false,
          error: err.message,
          metadata: { plugin }
        });
      }
    }
  }
  
  /**
   * Switch from specific problematic theme
   */
  private async switchFromSpecificTheme(
    serverId: string,
    sitePath: string,
    theme: string,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log(`Switching from problematic theme: ${theme}`);
    
    try {
      const output = await this.wpCli.execute(
        serverId,
        sitePath,
        'theme activate twentytwentyfour --skip-plugins --skip-themes'
      );
      
      actions.push({
        type: 'THEME_SWITCH_FROM_PROBLEMATIC',
        description: `Switched from ${theme} to Twenty Twenty-Four`,
        success: true,
        metadata: {
          fromTheme: theme,
          toTheme: 'twentytwentyfour',
          output: output.trim()
        }
      });
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'THEME_SWITCH_FROM_PROBLEMATIC',
        description: `Failed to switch from theme: ${theme}`,
        success: false,
        error: err.message,
        metadata: { theme }
      });
    }
  }
  
  /**
   * Repair specific corrupted tables
   */
  private async repairSpecificTables(
    serverId: string,
    sitePath: string,
    tables: string[],
    actions: HealingAction[]
  ): Promise<void> {
    if (tables.length === 0) {
      // Repair all tables
      try {
        const output = await this.wpCli.execute(
          serverId,
          sitePath,
          'db repair --skip-plugins --skip-themes'
        );
        
        actions.push({
          type: 'DATABASE_REPAIR_ALL',
          description: 'Repaired all database tables',
          success: true,
          metadata: { output: output.trim() }
        });
      } catch (error) {
        const err = error as Error;
        actions.push({
          type: 'DATABASE_REPAIR_ALL',
          description: 'Failed to repair database',
          success: false,
          error: err.message
        });
      }
    } else {
      // Repair specific tables
      for (const table of tables) {
        try {
          const output = await this.sshExecutor.executeCommand(
            serverId,
            `mysql -e "REPAIR TABLE ${table};" $(wp db name --path=${sitePath})`
          );
          
          actions.push({
            type: 'DATABASE_REPAIR_TABLE',
            description: `Repaired table: ${table}`,
            success: true,
            metadata: {
              table,
              output: output.trim()
            }
          });
        } catch (error) {
          const err = error as Error;
          actions.push({
            type: 'DATABASE_REPAIR_TABLE',
            description: `Failed to repair table: ${table}`,
            success: false,
            error: err.message,
            metadata: { table }
          });
        }
      }
    }
  }
  
  /**
   * Increase memory to recommended limit
   */
  private async increaseMemoryToRecommended(
    serverId: string,
    sitePath: string,
    currentLimit: number | undefined,
    recommendedLimit: number | undefined,
    actions: HealingAction[]
  ): Promise<void> {
    const current = currentLimit || await this.getCurrentMemoryLimit(serverId, sitePath);
    const recommended = recommendedLimit || (current < 256 ? 256 : 512);
    
    try {
      await this.increaseMemoryLimit(serverId, sitePath, recommended);
      
      actions.push({
        type: 'MEMORY_INCREASE_RECOMMENDED',
        description: `Increased memory limit from ${current}M to ${recommended}M`,
        success: true,
        metadata: {
          from: current,
          to: recommended
        }
      });
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'MEMORY_INCREASE_RECOMMENDED',
        description: 'Failed to increase memory limit',
        success: false,
        error: err.message,
        metadata: { from: current, to: recommended }
      });
    }
  }
  
  /**
   * Fix specific file/directory permissions
   */
  private async fixSpecificPermissions(
    serverId: string,
    sitePath: string,
    files: string[],
    directories: string[],
    actions: HealingAction[]
  ): Promise<void> {
    // Fix specific files
    for (const file of files) {
      try {
        const output = await this.sshExecutor.executeCommand(
          serverId,
          `chmod 644 ${sitePath}/${file}`
        );
        
        actions.push({
          type: 'PERMISSION_FIX_FILE',
          description: `Fixed permissions for file: ${file}`,
          success: true,
          metadata: {
            file,
            permissions: '644',
            output: output.trim()
          }
        });
      } catch (error) {
        const err = error as Error;
        actions.push({
          type: 'PERMISSION_FIX_FILE',
          description: `Failed to fix permissions for file: ${file}`,
          success: false,
          error: err.message,
          metadata: { file }
        });
      }
    }
    
    // Fix specific directories
    for (const directory of directories) {
      try {
        const output = await this.sshExecutor.executeCommand(
          serverId,
          `chmod 755 ${sitePath}/${directory}`
        );
        
        actions.push({
          type: 'PERMISSION_FIX_DIRECTORY',
          description: `Fixed permissions for directory: ${directory}`,
          success: true,
          metadata: {
            directory,
            permissions: '755',
            output: output.trim()
          }
        });
      } catch (error) {
        const err = error as Error;
        actions.push({
          type: 'PERMISSION_FIX_DIRECTORY',
          description: `Failed to fix permissions for directory: ${directory}`,
          success: false,
          error: err.message,
          metadata: { directory }
        });
      }
    }
    
    // If no specific files/directories, fix common ones
    if (files.length === 0 && directories.length === 0) {
      await this.healPermissions(serverId, sitePath, {} as any, actions);
    }
  }
  
  /**
   * Heal White Screen of Death (WSOD)
   * Uses binary search to identify problematic plugin if no specific plugin identified
   */
  private async healWSOD(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing WSOD...');
    
    try {
      // Check if specific plugin/theme was identified in diagnosis
      const specificIssues = this.analyzeCheckResults(diagnosis.checkResults);
      const hasSpecificPlugin = specificIssues.some(i => i.type === 'SPECIFIC_PLUGIN_CONFLICT');
      const hasSpecificTheme = specificIssues.some(i => i.type === 'SPECIFIC_THEME_ISSUE');
      
      // If no specific plugin identified, use binary search to find it
      if (!hasSpecificPlugin) {
        this.logger.log('No specific plugin identified, using binary search...');
        
        const conflictingPlugins = await this.pluginConflictService.identifyConflictingPlugin(
          serverId,
          sitePath
        );
        
        if (conflictingPlugins.length > 0) {
          this.logger.log(`Binary search found conflicting plugins: ${conflictingPlugins.join(', ')}`);
          
          // Deactivate only the conflicting plugins
          for (const plugin of conflictingPlugins) {
            const output = await this.wpCli.execute(
              serverId,
              sitePath,
              `plugin deactivate ${plugin} --skip-plugins --skip-themes`
            );
            
            actions.push({
              type: 'PLUGIN_DEACTIVATE_CONFLICTING',
              description: `Deactivated conflicting plugin: ${plugin}`,
              success: true,
              metadata: {
                plugin,
                output: output.trim(),
                detectionMethod: 'binary_search'
              }
            });
          }
        } else {
          this.logger.log('Binary search found no conflicting plugins');
          
          actions.push({
            type: 'PLUGIN_CONFLICT_DETECTION',
            description: 'No conflicting plugins found via binary search',
            success: true,
            metadata: { detectionMethod: 'binary_search' }
          });
        }
      }
      
      // If no specific theme identified, switch to default
      if (!hasSpecificTheme) {
        const output = await this.wpCli.execute(
          serverId,
          sitePath,
          'theme activate twentytwentyfour --skip-plugins --skip-themes'
        );
        
        actions.push({
          type: 'THEME_SWITCH_DEFAULT',
          description: 'Switched to default theme (Twenty Twenty-Four)',
          success: true,
          metadata: { output: output.trim() }
        });
      }
      
      // Increase memory limit
      const currentLimit = await this.getCurrentMemoryLimit(serverId, sitePath);
      const newLimit = currentLimit < 256 ? 256 : 512;
      
      await this.increaseMemoryLimit(serverId, sitePath, newLimit);
      
      actions.push({
        type: 'MEMORY_INCREASE',
        description: `Increased memory limit from ${currentLimit}M to ${newLimit}M`,
        success: true,
        metadata: { from: currentLimit, to: newLimit }
      });
      
      // Clear cache
      const cacheOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'cache flush --skip-plugins --skip-themes'
      );
      
      actions.push({
        type: 'CACHE_CLEAR',
        description: 'Cleared WordPress cache',
        success: true,
        metadata: { output: cacheOutput.trim() }
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'WSOD_RECOVERY',
        description: 'WSOD recovery failed',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Heal database errors
   */
  private async healDatabaseError(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing database error...');
    
    // Check if it's a credential issue
    const isCredentialIssue = diagnosis.details?.errorMessage?.includes('Access denied') ||
                              diagnosis.details?.errorMessage?.includes('Connection refused');
    
    if (isCredentialIssue) {
      // Use database credential healing service
      const result = await this.dbCredentialHealing.healDatabaseCredentials(
        serverId,
        sitePath,
        diagnosis.checkResults
      );
      
      actions.push(...result.actions);
    } else {
      // Try database repair
      try {
        const output = await this.wpCli.execute(
          serverId,
          sitePath,
          'db repair --skip-plugins --skip-themes'
        );
        
        actions.push({
          type: 'DATABASE_REPAIR',
          description: 'Repaired WordPress database',
          success: true,
          metadata: { output: output.trim() }
        });
      } catch (error) {
        const err = error as Error;
        actions.push({
          type: 'DATABASE_REPAIR',
          description: 'Database repair failed',
          success: false,
          error: err.message
        });
      }
    }
  }
  
  /**
   * Heal memory exhaustion
   */
  private async healMemoryExhaustion(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing memory exhaustion...');
    
    try {
      // Get current memory limit
      const currentLimit = await this.getCurrentMemoryLimit(serverId, sitePath);
      
      // Progressive increase: 128M → 256M → 512M
      const newLimit = currentLimit < 256 ? 256 : 512;
      
      await this.increaseMemoryLimit(serverId, sitePath, newLimit);
      
      actions.push({
        type: 'MEMORY_INCREASE',
        description: `Increased memory limit from ${currentLimit}M to ${newLimit}M`,
        success: true,
        metadata: { from: currentLimit, to: newLimit }
      });
      
      // Identify memory-hungry plugins
      const memoryHungryPlugins = await this.identifyMemoryHungryPlugins(serverId, sitePath);
      
      if (memoryHungryPlugins.length > 0) {
        this.logger.log(`Found ${memoryHungryPlugins.length} memory-hungry plugins`);
        
        actions.push({
          type: 'MEMORY_HUNGRY_PLUGINS_IDENTIFIED',
          description: `Identified memory-hungry plugins: ${memoryHungryPlugins.join(', ')}`,
          success: true,
          metadata: { plugins: memoryHungryPlugins }
        });
      }
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'MEMORY_HEALING',
        description: 'Memory healing failed',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Heal permission issues
   */
  private async healPermissions(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing permissions...');
    
    try {
      // Fix directory permissions (755)
      const dirOutput = await this.sshExecutor.executeCommand(
        serverId,
        `find ${sitePath} -type d -exec chmod 755 {} \\;`
      );
      
      // Fix file permissions (644)
      const fileOutput = await this.sshExecutor.executeCommand(
        serverId,
        `find ${sitePath} -type f -exec chmod 644 {} \\;`
      );
      
      // Fix wp-config.php (600)
      const configOutput = await this.sshExecutor.executeCommand(
        serverId,
        `chmod 600 ${sitePath}/wp-config.php`
      );
      
      actions.push({
        type: 'PERMISSION_FIX',
        description: 'Fixed file and directory permissions',
        success: true,
        metadata: {
          directories: '755',
          files: '644',
          wpConfig: '600',
          outputs: {
            directories: dirOutput.trim(),
            files: fileOutput.trim(),
            wpConfig: configOutput.trim()
          }
        }
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'PERMISSION_FIX',
        description: 'Permission fix failed',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Heal plugin conflicts using binary search (only if no specific plugin identified)
   */
  private async healPluginConflict(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing plugin conflict...');
    
    try {
      // Check if specific plugin was identified in diagnosis
      const specificIssues = this.analyzeCheckResults(diagnosis.checkResults);
      const specificPluginIssue = specificIssues.find(i => i.type === 'SPECIFIC_PLUGIN_CONFLICT');
      
      if (specificPluginIssue && specificPluginIssue.details.plugins?.length > 0) {
        // Specific plugin(s) identified - deactivate only those
        this.logger.log(`Specific plugins identified: ${specificPluginIssue.details.plugins.join(', ')}`);
        
        for (const plugin of specificPluginIssue.details.plugins) {
          const output = await this.wpCli.execute(
            serverId,
            sitePath,
            `plugin deactivate ${plugin} --skip-plugins --skip-themes`
          );
          
          actions.push({
            type: 'PLUGIN_DEACTIVATE_SPECIFIC',
            description: `Deactivated specific plugin: ${plugin}`,
            success: true,
            metadata: {
              plugin,
              output: output.trim(),
              detectionMethod: 'diagnosis'
            }
          });
        }
      } else {
        // No specific plugin identified - use binary search
        this.logger.log('No specific plugin identified, using binary search...');
        
        const conflictingPlugins = await this.pluginConflictService.identifyConflictingPlugin(
          serverId,
          sitePath
        );
        
        if (conflictingPlugins.length > 0) {
          this.logger.log(`Binary search found conflicting plugins: ${conflictingPlugins.join(', ')}`);
          
          // Deactivate conflicting plugins
          for (const plugin of conflictingPlugins) {
            const output = await this.wpCli.execute(
              serverId,
              sitePath,
              `plugin deactivate ${plugin} --skip-plugins --skip-themes`
            );
            
            actions.push({
              type: 'PLUGIN_CONFLICT_RESOLVED',
              description: `Deactivated conflicting plugin: ${plugin}`,
              success: true,
              metadata: {
                plugin,
                output: output.trim(),
                detectionMethod: 'binary_search'
              }
            });
          }
        } else {
          actions.push({
            type: 'PLUGIN_CONFLICT_DETECTION',
            description: 'No conflicting plugins found',
            success: true,
            metadata: { detectionMethod: 'binary_search' }
          });
        }
      }
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'PLUGIN_CONFLICT_RESOLUTION',
        description: 'Plugin conflict resolution failed',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Heal cache issues
   */
  private async healCache(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing cache...');
    
    try {
      const output = await this.wpCli.execute(
        serverId,
        sitePath,
        'cache flush --skip-plugins --skip-themes'
      );
      
      actions.push({
        type: 'CACHE_CLEAR',
        description: 'Cleared WordPress cache',
        success: true,
        metadata: { output: output.trim() }
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'CACHE_CLEAR',
        description: 'Cache clear failed',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Heal syntax errors
   */
  private async healSyntaxError(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Healing syntax error...');
    
    // Syntax errors usually require manual intervention
    // But we can try to restore from backup or deactivate recent changes
    
    actions.push({
      type: 'SYNTAX_ERROR_DETECTED',
      description: 'Syntax error detected - manual intervention may be required',
      success: false,
      error: 'Syntax errors typically require manual code fixes'
    });
  }
  
  /**
   * Generic healing for unknown issues
   */
  private async healGeneric(
    serverId: string,
    sitePath: string,
    diagnosis: DiagnosisResult,
    actions: HealingAction[]
  ): Promise<void> {
    this.logger.log('Applying generic healing...');
    
    try {
      // Clear cache
      const cacheOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'cache flush --skip-plugins --skip-themes'
      );
      
      actions.push({
        type: 'CACHE_CLEAR',
        description: 'Cleared WordPress cache',
        success: true,
        metadata: { output: cacheOutput.trim() }
      });
      
      // Flush rewrite rules
      const rewriteOutput = await this.wpCli.execute(
        serverId,
        sitePath,
        'rewrite flush --skip-plugins --skip-themes'
      );
      
      actions.push({
        type: 'REWRITE_FLUSH',
        description: 'Flushed rewrite rules',
        success: true,
        metadata: { output: rewriteOutput.trim() }
      });
      
    } catch (error) {
      const err = error as Error;
      actions.push({
        type: 'GENERIC_HEALING',
        description: 'Generic healing failed',
        success: false,
        error: err.message
      });
    }
  }
  
  /**
   * Helper: Clear WordPress cache
   */
  private async clearCache(serverId: string, sitePath: string): Promise<void> {
    await this.wpCli.execute(
      serverId,
      sitePath,
      'cache flush --skip-plugins --skip-themes'
    );
  }
  
  /**
   * Helper: Get current memory limit
   */
  private async getCurrentMemoryLimit(serverId: string, sitePath: string): Promise<number> {
    try {
      const output = await this.sshExecutor.executeCommand(
        serverId,
        `grep "WP_MEMORY_LIMIT" ${sitePath}/wp-config.php | grep -oP "\\d+" | head -1`
      );
      
      return parseInt(output.trim()) || 128;
    } catch (error) {
      return 128; // Default
    }
  }
  
  /**
   * Helper: Increase memory limit
   */
  private async increaseMemoryLimit(
    serverId: string,
    sitePath: string,
    newLimit: number
  ): Promise<void> {
    // Check if WP_MEMORY_LIMIT exists
    const hasMemoryLimit = await this.sshExecutor.executeCommand(
      serverId,
      `grep -q "WP_MEMORY_LIMIT" ${sitePath}/wp-config.php && echo "yes" || echo "no"`
    );
    
    if (hasMemoryLimit.trim() === 'yes') {
      // Update existing
      await this.sshExecutor.executeCommand(
        serverId,
        `sed -i "s/define( *'WP_MEMORY_LIMIT' *, *'[0-9]*M' *)/define('WP_MEMORY_LIMIT', '${newLimit}M')/" ${sitePath}/wp-config.php`
      );
    } else {
      // Add new
      await this.sshExecutor.executeCommand(
        serverId,
        `sed -i "/DB_COLLATE/a define('WP_MEMORY_LIMIT', '${newLimit}M');" ${sitePath}/wp-config.php`
      );
    }
  }
  
  /**
   * Helper: Identify memory-hungry plugins
   */
  private async identifyMemoryHungryPlugins(
    serverId: string,
    sitePath: string
  ): Promise<string[]> {
    try {
      const plugins = await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin list --status=active --field=name --skip-themes'
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
        'visual-composer',
        'wp-rocket'
      ];
      
      for (const plugin of pluginList) {
        if (knownMemoryHungry.some(known => plugin.toLowerCase().includes(known))) {
          memoryHungry.push(plugin);
        }
      }
      
      return memoryHungry;
    } catch (error) {
      return [];
    }
  }
}
