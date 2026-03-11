import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TechStack, DetectionMethod } from '@prisma/client';

export interface SiteTechStackData {
  techStack: TechStack;
  techStackVersion?: string;
  detectionMethod: DetectionMethod;
  detectionConfidence: number;
  
  // Domain addon information
  sslEnabled?: boolean;
  sslIssuer?: string;
  sslExpiryDate?: Date;
  dnsRecords?: any;
  emailAccountsCount?: number;
  emailQuotaUsedMB?: number;
  emailQuotaTotalMB?: number;
  
  // Domain type
  isMainDomain?: boolean;
  isSubdomain?: boolean;
  isParkedDomain?: boolean;
  isAddonDomain?: boolean;
  
  metadata?: any;
}

@Injectable()
export class SiteTechStackService {
  private readonly logger = new Logger(SiteTechStackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save or update tech stack information for an application
   */
  async saveTechStack(
    applicationId: string,
    data: SiteTechStackData,
  ): Promise<any> {
    this.logger.log(`Saving tech stack for application ${applicationId}`);

    try {
      // Check if application exists
      const application = await this.prisma.applications.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new NotFoundException(`Application ${applicationId} not found`);
      }

      // Upsert site tech stack
      const siteTechStack = await this.prisma.site_tech_stack.upsert({
        where: { applicationId },
        create: {
          applicationId,
          techStack: data.techStack,
          techStackVersion: data.techStackVersion,
          detectionMethod: data.detectionMethod,
          detectionConfidence: data.detectionConfidence,
          sslEnabled: data.sslEnabled,
          sslIssuer: data.sslIssuer,
          sslExpiryDate: data.sslExpiryDate,
          dnsRecords: data.dnsRecords || {},
          emailAccountsCount: data.emailAccountsCount,
          emailQuotaUsedMB: data.emailQuotaUsedMB,
          emailQuotaTotalMB: data.emailQuotaTotalMB,
          isMainDomain: data.isMainDomain ?? true,
          isSubdomain: data.isSubdomain ?? false,
          isParkedDomain: data.isParkedDomain ?? false,
          isAddonDomain: data.isAddonDomain ?? false,
          metadata: data.metadata || {},
        },
        update: {
          techStack: data.techStack,
          techStackVersion: data.techStackVersion,
          detectionMethod: data.detectionMethod,
          detectionConfidence: data.detectionConfidence,
          sslEnabled: data.sslEnabled,
          sslIssuer: data.sslIssuer,
          sslExpiryDate: data.sslExpiryDate,
          dnsRecords: data.dnsRecords,
          emailAccountsCount: data.emailAccountsCount,
          emailQuotaUsedMB: data.emailQuotaUsedMB,
          emailQuotaTotalMB: data.emailQuotaTotalMB,
          isMainDomain: data.isMainDomain,
          isSubdomain: data.isSubdomain,
          isParkedDomain: data.isParkedDomain,
          isAddonDomain: data.isAddonDomain,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Tech stack saved for application ${applicationId}: ${data.techStack}`,
      );

      return siteTechStack;
    } catch (error) {
      this.logger.error(
        `Failed to save tech stack for application ${applicationId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get tech stack information for an application
   */
  async getTechStack(applicationId: string): Promise<any> {
    const siteTechStack = await this.prisma.site_tech_stack.findUnique({
      where: { applicationId },
      include: {
        applications: {
          select: {
            id: true,
            domain: true,
            path: true,
            serverId: true,
          },
        },
      },
    });

    if (!siteTechStack) {
      throw new NotFoundException(
        `Tech stack not found for application ${applicationId}`,
      );
    }

    return siteTechStack;
  }

  /**
   * Update domain addon information (SSL, DNS, email)
   */
  async updateDomainAddons(
    applicationId: string,
    addons: {
      sslEnabled?: boolean;
      sslIssuer?: string;
      sslExpiryDate?: Date;
      dnsRecords?: any;
      emailAccountsCount?: number;
      emailQuotaUsedMB?: number;
      emailQuotaTotalMB?: number;
    },
  ): Promise<any> {
    this.logger.log(`Updating domain addons for application ${applicationId}`);

    const siteTechStack = await this.prisma.site_tech_stack.findUnique({
      where: { applicationId },
    });

    if (!siteTechStack) {
      throw new NotFoundException(
        `Tech stack not found for application ${applicationId}. Please run tech stack detection first.`,
      );
    }

    return await this.prisma.site_tech_stack.update({
      where: { applicationId },
      data: {
        sslEnabled: addons.sslEnabled,
        sslIssuer: addons.sslIssuer,
        sslExpiryDate: addons.sslExpiryDate,
        dnsRecords: addons.dnsRecords,
        emailAccountsCount: addons.emailAccountsCount,
        emailQuotaUsedMB: addons.emailQuotaUsedMB,
        emailQuotaTotalMB: addons.emailQuotaTotalMB,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update domain type information
   */
  async updateDomainType(
    applicationId: string,
    domainType: {
      isMainDomain?: boolean;
      isSubdomain?: boolean;
      isParkedDomain?: boolean;
      isAddonDomain?: boolean;
    },
  ): Promise<any> {
    this.logger.log(`Updating domain type for application ${applicationId}`);

    const siteTechStack = await this.prisma.site_tech_stack.findUnique({
      where: { applicationId },
    });

    if (!siteTechStack) {
      throw new NotFoundException(
        `Tech stack not found for application ${applicationId}. Please run tech stack detection first.`,
      );
    }

    return await this.prisma.site_tech_stack.update({
      where: { applicationId },
      data: {
        isMainDomain: domainType.isMainDomain,
        isSubdomain: domainType.isSubdomain,
        isParkedDomain: domainType.isParkedDomain,
        isAddonDomain: domainType.isAddonDomain,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete tech stack information
   */
  async deleteTechStack(applicationId: string): Promise<void> {
    await this.prisma.site_tech_stack.delete({
      where: { applicationId },
    });

    this.logger.log(`Tech stack deleted for application ${applicationId}`);
  }

  /**
   * Get all tech stacks with filters
   */
  async findAll(filters?: {
    techStack?: TechStack;
    isMainDomain?: boolean;
    isSubdomain?: boolean;
    isParkedDomain?: boolean;
    isAddonDomain?: boolean;
  }): Promise<any[]> {
    return await this.prisma.site_tech_stack.findMany({
      where: {
        techStack: filters?.techStack,
        isMainDomain: filters?.isMainDomain,
        isSubdomain: filters?.isSubdomain,
        isParkedDomain: filters?.isParkedDomain,
        isAddonDomain: filters?.isAddonDomain,
      },
      include: {
        applications: {
          select: {
            id: true,
            domain: true,
            path: true,
            serverId: true,
            healthStatus: true,
          },
        },
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }
}
