import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { ProviderType } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IntegrationsService } from './integrations.service';
import { SmtpAdapterService } from './adapters/smtp.adapter';
import { SlackAdapterService } from './adapters/slack.adapter';
import { DiscordAdapterService } from './adapters/discord.adapter';
import { AnsibleAdapterService } from './adapters/ansible.adapter';
import { BaseAdapter } from './adapters/base.adapter';

/**
 * Client Factory Service
 * Creates and caches integration adapter instances using Redis
 */
@Injectable()
export class ClientFactoryService {
  private readonly logger = new Logger(ClientFactoryService.name);
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly CACHE_PREFIX = 'integration:client:';

  constructor(
    private readonly integrationsService: IntegrationsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Get or create an adapter client for an integration
   * @param integrationId - Integration ID
   * @returns Adapter instance (WHM, SMTP, etc.)
   */
  async getClient(integrationId: string): Promise<BaseAdapter> {
    const cacheKey = `${this.CACHE_PREFIX}${integrationId}`;

    // Check Redis cache first
    const cachedConfig = await this.cacheManager.get<any>(cacheKey);
    
    if (cachedConfig) {
      this.logger.debug(`Using cached client config for integration ${integrationId}`);
      return this.createAdapter(cachedConfig.provider, cachedConfig.config);
    }

    // Get integration from database
    const integration = await this.integrationsService.findOne(integrationId);

    if (!integration.isActive) {
      throw new BadRequestException(
        `Integration ${integration.name} is not active`,
      );
    }

    // Get decrypted configuration
    const config = await this.integrationsService.getDecryptedConfig(
      integrationId,
    );

    // Cache the configuration in Redis (not the client instance)
    await this.cacheManager.set(
      cacheKey,
      { provider: integration.provider, config },
      this.CACHE_TTL * 1000, // Convert to milliseconds
    );

    this.logger.log(
      `Cached ${integration.provider} config for integration ${integrationId} (TTL: ${this.CACHE_TTL}s)`,
    );

    // Create and return adapter
    return this.createAdapter(integration.provider, config);
  }

  /**
   * Create adapter instance based on provider type
   * @param provider - Provider type
   * @param config - Decrypted configuration
   * @returns Adapter instance
   */
  private createAdapter(provider: ProviderType, config: any): BaseAdapter {
    switch (provider) {
      case ProviderType.SMTP:
        return new SmtpAdapterService({
          host: config.host,
          port: config.port,
          secure: config.secure,
          username: config.username,
          password: config.password,
          from: config.from,
        });

      case ProviderType.SLACK:
        return new SlackAdapterService(
          config.webhookUrl,
          config.botToken, // Optional
        );

      case ProviderType.DISCORD:
        return new DiscordAdapterService(config.webhookUrl);

      case ProviderType.ANSIBLE:
        return new AnsibleAdapterService(
          config.baseUrl,
          config.username,
          config.password,
        );

      default:
        throw new BadRequestException(
          `Provider ${provider} is not yet supported`,
        );
    }
  }

  /**
   * Clear cached client for an integration
   * Useful when integration config is updated
   */
  async clearCache(integrationId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${integrationId}`;
    await this.cacheManager.del(cacheKey);
    this.logger.log(`Cleared cached config for integration ${integrationId}`);
  }

  /**
   * Clear all cached clients
   */
  async clearAllCache(): Promise<void> {
    // Note: This requires Redis SCAN to find all keys with prefix
    // For now, we'll just log a warning
    this.logger.warn('clearAllCache not fully implemented - requires Redis SCAN');
    // TODO: Implement Redis SCAN to delete all keys with CACHE_PREFIX
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    // Note: Getting cache size requires Redis DBSIZE or SCAN
    // For now, return basic info
    return {
      ttl: this.CACHE_TTL,
      prefix: this.CACHE_PREFIX,
      note: 'Full stats require Redis SCAN implementation',
    };
  }
}
