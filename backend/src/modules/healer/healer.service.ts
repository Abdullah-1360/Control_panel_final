import { Injectable, Logger } from '@nestjs/common';
import { HealingMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteDiscoveryService } from './services/site-discovery.service';
import { HealingOrchestratorService } from './services/healing-orchestrator.service';
import { RetryService } from './services/retry.service';

@Injectable()
export class HealerService {
  private readonly logger = new Logger(HealerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly siteDiscovery: SiteDiscoveryService,
    private readonly healingOrchestrator: HealingOrchestratorService,
    private readonly retryService: RetryService,
  ) {}

  /**
   * Discover WordPress sites on a server
   */
  async discoverSites(serverId: string): Promise<any> {
    // Discover sites
    const discoveredSites = await this.siteDiscovery.discoverSites(serverId);
    
    // Register them in the database
    const registeredCount = await this.siteDiscovery.registerSites(
      serverId,
      discoveredSites,
    );
    
    this.logger.log(`Discovery complete: ${discoveredSites.length} sites found, ${registeredCount} new sites registered`);
    
    // Return the list of sites from database
    return this.listSites({ serverId });
  }

  /**
   * Delete all applications for a specific server
   * Removes both wp_sites and applications entries
   */
  async deleteServerApplications(serverId: string): Promise<{ deletedCount: number }> {
    this.logger.log(`Deleting all applications for server ${serverId}`);
    
    try {
      // Delete from wp_sites (WordPress healer)
      const wpSitesDeleted = await this.prisma.wp_sites.deleteMany({
        where: { serverId },
      });
      
      // Delete from applications (Universal healer)
      // First delete diagnostic results (foreign key constraint)
      await this.prisma.diagnostic_results.deleteMany({
        where: {
          applications: {
            serverId,
          },
        },
      });
      
      // Then delete applications
      const applicationsDeleted = await this.prisma.applications.deleteMany({
        where: { serverId },
      });
      
      const totalDeleted = wpSitesDeleted.count + applicationsDeleted.count;
      
      this.logger.log(`Deleted ${totalDeleted} applications for server ${serverId} (${wpSitesDeleted.count} wp_sites, ${applicationsDeleted.count} applications)`);
      
      return { deletedCount: totalDeleted };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to delete applications for server ${serverId}: ${err.message}`);
      throw error;
    }
  }

  /**
   * List all sites with filtering
   */
  async listSites(filters?: {
    serverId?: string;
    healthStatus?: string;
    isHealerEnabled?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.serverId) {
      where.serverId = filters.serverId;
    }

    if (filters?.healthStatus) {
      where.healthStatus = filters.healthStatus;
    }

    if (filters?.isHealerEnabled !== undefined) {
      where.isHealerEnabled = filters.isHealerEnabled;
    }

    if (filters?.search) {
      where.domain = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    // Filter out sites whose servers have been soft-deleted
    where.servers = {
      deletedAt: null,
    };

    const [sites, total] = await Promise.all([
      this.prisma.wp_sites.findMany({
        where,
        include: {
          servers: {
            select: {
              id: true,
              host: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wp_sites.count({ where }),
    ]);

    // Map servers to server for frontend compatibility
    const sitesWithMappedRelation = sites.map((site: any) => ({
      ...site,
      server: site.servers,
    }));

    return {
      data: sitesWithMappedRelation,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get applications with UNKNOWN tech stack after multiple detection attempts
   * These are problematic applications that need manual review
   */
  async getProblematicApplications(filters: {
    minAttempts?: number;
    serverId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;
    const minAttempts = filters.minAttempts || 5;

    const where: any = {
      techStack: 'UNKNOWN',
      detectionAttempts: {
        gte: minAttempts,
      },
      servers: {
        deletedAt: null, // Exclude soft-deleted servers
      },
    };

    if (filters.serverId) {
      where.serverId = filters.serverId;
    }

    const [applications, total] = await Promise.all([
      this.prisma.applications.findMany({
        where,
        include: {
          servers: {
            select: {
              id: true,
              name: true,
              host: true,
              platformType: true,
            },
          },
        },
        orderBy: [
          { detectionAttempts: 'desc' },
          { lastDetectionAttempt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.applications.count({ where }),
    ]);

    this.logger.log(
      `Found ${applications.length} problematic applications (${total} total) with ${minAttempts}+ detection attempts`,
    );

    return {
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalProblematic: total,
        minAttempts,
        message: `Applications with UNKNOWN tech stack after ${minAttempts}+ detection attempts`,
      },
    };
  }

  /**
   * Get site details
   */
  async getSite(siteId: string): Promise<any> {
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
      include: {
        servers: true,
      },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Check if the server has been soft-deleted
    if (site.servers.deletedAt) {
      throw new Error(`Site ${siteId} not found (server deleted)`);
    }

    // Map servers to server for frontend compatibility
    return {
      ...site,
      server: site.servers,
    };
  }

  /**
   * Fuzzy search sites by domain
   */
  async searchSites(query: string): Promise<any> {
    return this.siteDiscovery.searchSites(query);
  }

  /**
   * Trigger diagnosis for a site (with optional subdomain)
   */
  async diagnose(siteId: string, triggeredBy?: string, subdomain?: string): Promise<any> {
    // Collect metadata first (if not already collected)
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Collect metadata if not present
    if (!site.wpVersion || !site.phpVersion) {
      this.logger.log(`Collecting metadata for ${site.domain} before diagnosis`);
      try {
        await this.siteDiscovery.collectSiteMetadata(siteId);
      } catch (error) {
        this.logger.warn(`Failed to collect metadata, proceeding with diagnosis anyway`);
      }
    }

    return this.healingOrchestrator.diagnose(siteId, triggeredBy, subdomain);
  }

  /**
   * Get available subdomains for a site
   * Always re-detects to ensure fresh data
   */
  async getSubdomains(siteId: string): Promise<any> {
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Always detect fresh subdomains (don't use cached data)
    return this.siteDiscovery.detectSubdomains(siteId);
  }

  /**
   * Execute healing (after user approval)
   */
  async heal(executionId: string, customCommands?: string[]): Promise<any> {
    return this.healingOrchestrator.heal(executionId, customCommands);
  }

  /**
   * Rollback to backup
   */
  async rollback(executionId: string): Promise<void> {
    return this.healingOrchestrator.rollback(executionId);
  }

  /**
   * Get execution details
   */
  async getExecution(executionId: string): Promise<any> {
    return this.healingOrchestrator.getExecution(executionId);
  }

  /**
   * Get healing history for a site
   */
  async getHealingHistory(
    siteId: string,
    page?: number,
    limit?: number,
  ): Promise<any> {
    return this.healingOrchestrator.getHealingHistory(siteId, page, limit);
  }

  /**
   * Update site configuration
   */
  async updateSiteConfig(
    siteId: string,
    config: {
      healingMode?: HealingMode;
      isHealerEnabled?: boolean;
      maxHealingAttempts?: number;
      healingCooldown?: number;
      blacklistedPlugins?: string[];
      blacklistedThemes?: string[];
    },
  ): Promise<any> {
    const site = await this.prisma.wp_sites.update({
      where: { id: siteId },
      data: config,
    });

    return site;
  }

  /**
   * Reset circuit breaker for a site (clears healing attempt counter)
   */
  async resetCircuitBreaker(siteId: string): Promise<void> {
    // Use RetryService to properly reset circuit breaker
    await this.retryService.resetCircuitBreaker(siteId);

    this.logger.log(`Circuit breaker reset for site ${siteId}`);
  }
}
