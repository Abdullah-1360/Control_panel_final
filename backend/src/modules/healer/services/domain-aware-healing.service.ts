/**
 * Domain-Aware Healing Service
 * 
 * Understands domain relationships:
 * - Main domain
 * - Subdomains (shared or isolated)
 * - Addon domains
 * - Parked domains
 * 
 * Prevents collateral damage when healing shared resources
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SSHExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';

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

interface DatabaseConfig {
  database: string;
  user: string;
  password: string;
  host: string;
}

@Injectable()
export class DomainAwareHealingService {
  private readonly logger = new Logger(DomainAwareHealingService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService
  ) {}
  
  /**
   * Analyze domain context to understand relationships
   */
  async analyzeDomainContext(
    applicationId: string,
    targetDomain: string
  ): Promise<DomainContext> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId }
    });
    
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
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
  
  /**
   * Analyze which resources are shared between domains
   */
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
    
    try {
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
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to analyze shared resources: ${err.message}`);
      
      // Default to isolated if analysis fails
      return {
        database: false,
        plugins: false,
        themes: false,
        uploads: false
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
   * Check if wp-content is shared between domains
   */
  private async checkSharedWpContent(
    serverId: string,
    mainPath: string,
    targetPath: string
  ): Promise<boolean> {
    try {
      // Check if wp-content is a symlink
      const mainWpContent = await this.sshExecutor.executeCommand(
        serverId,
        `readlink -f ${mainPath}/wp-content`
      );
      
      const targetWpContent = await this.sshExecutor.executeCommand(
        serverId,
        `readlink -f ${targetPath}/wp-content`
      );
      
      return mainWpContent.trim() === targetWpContent.trim();
    } catch (error) {
      // If readlink fails, assume not shared
      return false;
    }
  }
  
  /**
   * Determine isolation level based on shared resources
   */
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
   * Adjust healing actions based on domain context
   * Adds warnings for actions that affect shared resources
   */
  adjustHealingActions(
    actions: any[],
    domainContext: DomainContext
  ): any[] {
    if (domainContext.isolationLevel === 'ISOLATED') {
      // No adjustments needed for isolated domains
      return actions;
    }
    
    // Adjust actions for shared environment
    return actions.map(action => {
      switch (action.type) {
        case 'PLUGIN_DEACTIVATE':
        case 'PLUGIN_UPDATE':
          if (domainContext.sharedResources.plugins) {
            return {
              ...action,
              description: `${action.description} (WARNING: Affects all domains sharing plugins)`,
              requiresApproval: true,
              riskLevel: 'HIGH'
            };
          }
          break;
          
        case 'THEME_SWITCH':
        case 'THEME_UPDATE':
          if (domainContext.sharedResources.themes) {
            return {
              ...action,
              description: `${action.description} (WARNING: Affects all domains sharing themes)`,
              requiresApproval: true,
              riskLevel: 'HIGH'
            };
          }
          break;
          
        case 'DATABASE_REPAIR':
        case 'DATABASE_OPTIMIZE':
          if (domainContext.sharedResources.database) {
            return {
              ...action,
              description: `${action.description} (WARNING: Affects all domains sharing database)`,
              requiresApproval: true,
              riskLevel: 'HIGH'
            };
          }
          break;
      }
      
      return action;
    });
  }
  
  /**
   * Get all related domains for cascade healing
   */
  async getRelatedDomains(applicationId: string): Promise<string[]> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId }
    });
    
    if (!app) {
      return [];
    }
    
    const metadata = app.metadata as any;
    const subdomains = metadata?.availableSubdomains || [];
    const addonDomains = metadata?.addonDomains || [];
    
    return [
      ...subdomains.map((s: any) => s.subdomain),
      ...addonDomains.map((a: any) => a.domain)
    ];
  }
}
