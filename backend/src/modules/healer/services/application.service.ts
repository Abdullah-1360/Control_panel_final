import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TechStack, DetectionMethod, HealingMode, HealthStatus } from '@prisma/client';
import { TechStackDetectorService } from './tech-stack-detector.service';
import { PluginRegistryService } from './plugin-registry.service';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly techStackDetector: TechStackDetectorService,
    private readonly pluginRegistry: PluginRegistryService,
  ) {}

  /**
   * Get all applications with pagination and filters
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    techStack?: TechStack;
    healthStatus?: HealthStatus;
    serverId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      servers: {
        deletedAt: null, // Exclude soft-deleted servers
      },
    };

    if (params.search) {
      where.domain = {
        contains: params.search,
        mode: 'insensitive',
      };
    }

    if (params.techStack) {
      where.techStack = params.techStack;
    }

    if (params.healthStatus) {
      where.healthStatus = params.healthStatus;
    }

    if (params.serverId) {
      where.serverId = params.serverId;
    }

    const [applications, total] = await Promise.all([
      this.prisma.applications.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.applications.count({ where }),
    ]);

    return {
      data: applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get application by ID
   */
  async findOne(id: string) {
    const application = await this.prisma.applications.findUnique({
      where: { id },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            platformType: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    return application;
  }

  /**
   * Create new application
   */
  async create(data: {
    serverId: string;
    domain: string;
    path: string;
    techStack: TechStack;
    detectionMethod?: DetectionMethod;
    version?: string;
    phpVersion?: string;
    dbName?: string;
    dbHost?: string;
  }) {
    return this.prisma.applications.create({
      data: {
        serverId: data.serverId,
        domain: data.domain,
        path: data.path,
        techStack: data.techStack,
        detectionMethod: data.detectionMethod || DetectionMethod.MANUAL,
        techStackVersion: data.version,
        metadata: {
          phpVersion: data.phpVersion,
          dbName: data.dbName,
          dbHost: data.dbHost || 'localhost',
        },
        isHealerEnabled: false,
        healingMode: HealingMode.MANUAL,
        healthStatus: HealthStatus.UNKNOWN,
        healthScore: 0,
      },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });
  }

  /**
   * Update application
   */
  async update(id: string, data: {
    domain?: string;
    path?: string;
    techStack?: TechStack;
    version?: string;
    phpVersion?: string;
    isHealerEnabled?: boolean;
    healingMode?: HealingMode;
  }) {
    const application = await this.findOne(id);

    return this.prisma.applications.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });
  }

  /**
   * Delete application
   */
  async delete(id: string) {
    const application = await this.findOne(id);

    await this.prisma.applications.delete({
      where: { id },
    });

    return { message: 'Application deleted successfully' };
  }

  /**
   * Discover applications on a server
   */
  async discover(params: {
    serverId: string;
    techStacks?: TechStack[];
    autoDetect?: boolean;
  }) {
    this.logger.log(`Discovering applications on server ${params.serverId}`);

    const server = await this.prisma.servers.findUnique({
      where: { id: params.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${params.serverId} not found`);
    }

    const discoveredApps: any[] = [];

    // Auto-detect tech stacks if enabled
    if (params.autoDetect) {
      // TODO: Implement auto-detection when TechStackDetectorService.detectTechStacks is ready
      this.logger.log('Auto-detection not yet implemented');
      
      // For now, return empty array
      // const detectedStacks = await this.techStackDetector.detectTechStacks(
      //   params.serverId,
      //   '/home', // Start from /home directory
      // );
    }

    // Discover specific tech stacks if provided
    if (params.techStacks && params.techStacks.length > 0) {
      for (const techStack of params.techStacks) {
        const plugin = this.pluginRegistry.getPlugin(techStack);
        
        if (plugin) {
          // Plugin-specific discovery logic would go here
          this.logger.log(`Discovering ${techStack} applications using plugin`);
        }
      }
    }

    this.logger.log(`Discovered ${discoveredApps.length} applications`);

    return {
      discovered: discoveredApps.length,
      applications: discoveredApps,
    };
  }

  /**
   * Calculate health score based on diagnostic results
   */
  async calculateHealthScore(applicationId: string): Promise<number> {
    const results = await this.prisma.diagnostic_results.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Consider last 50 checks
    });

    if (results.length === 0) {
      return 0;
    }

    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of results) {
      // Weight by severity (risk level)
      let weight = 1;
      switch (result.severity) {
        case 'CRITICAL':
          weight = 4;
          break;
        case 'HIGH':
          weight = 3;
          break;
        case 'MEDIUM':
          weight = 2;
          break;
        case 'LOW':
          weight = 1;
          break;
      }

      totalWeight += weight;

      // Score by status
      if (result.status === 'PASS') {
        weightedScore += weight * 100;
      } else if (result.status === 'WARN') {
        weightedScore += weight * 50;
      }
      // FAIL or ERROR = 0 points
    }

    const healthScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Update application health score
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: { healthScore },
    });

    return healthScore;
  }

  /**
   * Update health status based on health score
   */
  async updateHealthStatus(applicationId: string): Promise<HealthStatus> {
    const application = await this.findOne(applicationId);
    const healthScore = application.healthScore ?? 0;

    let healthStatus: HealthStatus;

    if (healthScore >= 90) {
      healthStatus = HealthStatus.HEALTHY;
    } else if (healthScore >= 70) {
      healthStatus = HealthStatus.DEGRADED;
    } else if (healthScore >= 50) {
      healthStatus = HealthStatus.DOWN;
    } else {
      healthStatus = HealthStatus.DOWN;
    }

    await this.prisma.applications.update({
      where: { id: applicationId },
      data: { healthStatus },
    });

    return healthStatus;
  }
}
