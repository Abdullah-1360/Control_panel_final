import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditService } from '../audit/audit.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { ProviderType, integrations } from '@prisma/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new integration
   */
  async create(dto: CreateIntegrationDto, userId: string): Promise<integrations> {
    // Validate provider-specific configuration
    this.validateProviderConfig(dto.provider, dto.config);

    // Encrypt the configuration
    const encryptedConfig = await this.encryption.encrypt(JSON.stringify(dto.config));

    // Create integration
    const integration = await this.prisma.integrations.create({
      data: {
        name: dto.name,
        description: dto.description,
        provider: dto.provider,
        baseUrl: (dto.config as any).baseUrl,
        username: (dto.config as any).username,
        encryptedConfig,
        linkedServerId: dto.linkedServerId,
        createdByUserId: userId,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'integration.created',
      resource: 'integration',
      resourceId: integration.id,
      description: `Created integration: ${integration.name} (${integration.provider})`,
      metadata: {
        name: integration.name,
        provider: integration.provider,
      },
      severity: 'INFO',
    });

    this.logger.log(`Integration created: ${integration.name} (${integration.provider})`);

    return integration;
  }

  /**
   * Find all integrations with optional filters
   */
  async findAll(filters?: {
    provider?: ProviderType;
    isActive?: boolean;
    linkedServerId?: string;
  }) {
    return this.prisma.integrations.findMany({
      where: {
        provider: filters?.provider,
        isActive: filters?.isActive,
        linkedServerId: filters?.linkedServerId,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find one integration by ID
   */
  async findOne(id: string): Promise<integrations> {
    const integration = await this.prisma.integrations.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    return integration;
  }

  /**
   * Update an integration
   */
  async update(id: string, dto: UpdateIntegrationDto, userId: string): Promise<integrations> {
    const existing = await this.findOne(id);

    let encryptedConfig = existing.encryptedConfig;

    // If config is being updated, re-encrypt it
    if (dto.config) {
      this.validateProviderConfig(dto.provider || existing.provider, dto.config);
      encryptedConfig = await this.encryption.encrypt(JSON.stringify(dto.config));
    }

    const integration = await this.prisma.integrations.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        provider: dto.provider,
        baseUrl: dto.config ? (dto.config as any).baseUrl : undefined,
        username: dto.config ? (dto.config as any).username : undefined,
        encryptedConfig: dto.config ? encryptedConfig : undefined,
        linkedServerId: dto.linkedServerId,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'integration.updated',
      resource: 'integration',
      resourceId: integration.id,
      description: `Updated integration: ${integration.name}`,
      metadata: {
        name: integration.name,
        changes: dto,
      },
      severity: 'INFO',
    });

    this.logger.log(`Integration updated: ${integration.name}`);

    return integration;
  }

  /**
   * Delete an integration
   */
  async remove(id: string, userId: string): Promise<void> {
    const integration = await this.findOne(id);

    await this.prisma.integrations.delete({
      where: { id },
    });

    // Audit log
    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'integration.deleted',
      resource: 'integration',
      resourceId: id,
      description: `Deleted integration: ${integration.name} (${integration.provider})`,
      metadata: {
        name: integration.name,
        provider: integration.provider,
      },
      severity: 'WARNING',
    });

    this.logger.log(`Integration deleted: ${integration.name}`);
  }

  /**
   * Get decrypted configuration for an integration
   */
  async getDecryptedConfig(id: string): Promise<any> {
    const integration = await this.findOne(id);
    const decrypted = await this.encryption.decrypt(integration.encryptedConfig);
    const config = JSON.parse(decrypted);
    
    // Add baseUrl and username from database fields (they're stored separately for querying)
    if (integration.baseUrl) {
      config.baseUrl = integration.baseUrl;
    }
    if (integration.username) {
      config.username = integration.username;
    }
    
    return config;
  }

  /**
   * Update health status after connection test
   */
  async updateHealthStatus(
    id: string,
    success: boolean,
    message: string,
    latency?: number,
  ): Promise<void> {
    await this.prisma.integrations.update({
      where: { id },
      data: {
        healthStatus: success ? 'HEALTHY' : 'DOWN',
        lastTestAt: new Date(),
        lastTestSuccess: success,
        lastTestMessage: message,
        lastTestLatency: latency,
        lastError: success ? null : message,
      },
    });
  }

  /**
   * Validate provider-specific configuration
   */
  private validateProviderConfig(provider: ProviderType, config: any): void {
    switch (provider) {
      case ProviderType.WHM:
        if (!config.baseUrl || !config.username || !config.apiToken) {
          throw new BadRequestException('WHM requires baseUrl, username, and apiToken');
        }
        break;

      case ProviderType.SMTP:
        if (!config.host || !config.port || !config.username || !config.password) {
          throw new BadRequestException('SMTP requires host, port, username, and password');
        }
        break;

      case ProviderType.SLACK:
        if (!config.webhookUrl) {
          throw new BadRequestException('Slack requires webhookUrl');
        }
        break;

      case ProviderType.DISCORD:
        if (!config.webhookUrl) {
          throw new BadRequestException('Discord requires webhookUrl');
        }
        break;

      case ProviderType.ANSIBLE:
        if (!config.baseUrl || !config.username || !config.password) {
          throw new BadRequestException('Ansible requires baseUrl, username, and password');
        }
        break;

      default:
        throw new BadRequestException(`Provider ${provider} is not yet supported`);
    }
  }

  /**
   * Get list of supported providers
   */
  getSupportedProviders() {
    return [
      {
        type: ProviderType.WHM,
        name: 'WHM (WebHost Manager)',
        description: 'WebHost Manager API integration',
        requiredFields: ['baseUrl', 'username', 'apiToken'],
      },
      {
        type: ProviderType.SMTP,
        name: 'SMTP Email Provider',
        description: 'SMTP server for sending emails',
        requiredFields: ['host', 'port', 'username', 'password', 'secure'],
      },
      {
        type: ProviderType.SLACK,
        name: 'Slack',
        description: 'Slack webhook and API integration',
        requiredFields: ['webhookUrl'],
        optionalFields: ['botToken'],
      },
      {
        type: ProviderType.DISCORD,
        name: 'Discord',
        description: 'Discord webhook integration',
        requiredFields: ['webhookUrl'],
      },
      {
        type: ProviderType.ANSIBLE,
        name: 'Ansible Tower/AWX',
        description: 'Ansible automation platform integration',
        requiredFields: ['baseUrl', 'username', 'password'],
      },
    ];
  }
}
