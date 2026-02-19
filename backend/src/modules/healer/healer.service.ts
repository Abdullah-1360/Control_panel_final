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
    
    this.logger.log(`Registered ${registeredCount} sites in database`);
    
    // Return the list of sites from database
    return this.listSites({ serverId });
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
    where.server = {
      deletedAt: null,
    };

    const [sites, total] = await Promise.all([
      this.prisma.wp_sites.findMany({
        where,
        include: {
          server: {
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

    return {
      data: sites,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
        server: true,
      },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Check if the server has been soft-deleted
    if (site.server.deletedAt) {
      throw new Error(`Site ${siteId} not found (server deleted)`);
    }

    return site;
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
