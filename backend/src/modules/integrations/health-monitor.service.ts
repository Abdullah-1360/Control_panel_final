import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationsService } from './integrations.service';
import { ClientFactoryService } from './client-factory.service';

/**
 * Health Monitor Service
 * Automatically tests integration connections every 15 minutes
 */
@Injectable()
@Processor('integration-health')
export class HealthMonitorService implements OnModuleInit {
  private readonly logger = new Logger(HealthMonitorService.name);

  constructor(
    @InjectQueue('integration-health') private readonly healthQueue: Queue,
    private readonly integrationsService: IntegrationsService,
    private readonly clientFactory: ClientFactoryService,
  ) {}

  async onModuleInit() {
    this.logger.log('Health Monitor Service initialized');
  }

  /**
   * Schedule health checks every 15 minutes
   * Runs at :00, :15, :30, :45 of every hour
   */
  @Cron('*/15 * * * *', {
    name: 'integration-health-check',
    timeZone: 'UTC',
  })
  async scheduleHealthChecks() {
    this.logger.log('Scheduling health checks for all active integrations');

    try {
      // Get all active integrations
      const integrations = await this.integrationsService.findAll({
        isActive: true,
      });

      this.logger.log(`Found ${integrations.length} active integrations to check`);

      // Queue health check job for each integration
      for (const integration of integrations) {
        await this.healthQueue.add(
          'check-integration',
          { integrationId: integration.id },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000, // 5 seconds
            },
            removeOnComplete: true,
            removeOnFail: false, // Keep failed jobs for debugging
          },
        );
      }

      this.logger.log(`Queued ${integrations.length} health check jobs`);
    } catch (error: any) {
      this.logger.error('Failed to schedule health checks', error);
    }
  }

  /**
   * Process health check job
   * Tests connection and updates health status
   */
  @Process('check-integration')
  async process(job: Job<{ integrationId: string }>): Promise<void> {
    const { integrationId } = job.data;

    try {
      this.logger.debug(`Processing health check for integration ${integrationId}`);

      // Get the adapter client
      const client = await this.clientFactory.getClient(integrationId);

      // Test connection
      const result = await client.testConnection();

      // Update health status in database
      await this.integrationsService.updateHealthStatus(
        integrationId,
        result.success,
        result.message,
        result.latency,
      );

      if (result.success) {
        this.logger.log(
          `Health check passed for integration ${integrationId} (${result.latency}ms)`,
        );
      } else {
        this.logger.warn(
          `Health check failed for integration ${integrationId}: ${result.message}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Health check error for integration ${integrationId}`,
      );
      this.logger.error(error.message);

      // Check if it's an unsupported provider error
      if (error.message && error.message.includes('is not yet supported')) {
        this.logger.warn(
          `Skipping health check for unsupported provider: ${error.message}`,
        );
        // Update health status to indicate unsupported
        await this.integrationsService.updateHealthStatus(
          integrationId,
          false,
          'Provider not yet supported',
        );
        // Don't re-throw to avoid retries
        return;
      }

      // Update health status to DOWN
      await this.integrationsService.updateHealthStatus(
        integrationId,
        false,
        error.message || 'Unknown error',
      );

      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Manually trigger health check for a specific integration
   * @param integrationId - Integration ID
   */
  async triggerHealthCheck(integrationId: string): Promise<void> {
    this.logger.log(`Manually triggering health check for integration ${integrationId}`);

    await this.healthQueue.add(
      'check-integration',
      { integrationId },
      {
        attempts: 1,
        removeOnComplete: true,
      },
    );
  }

  /**
   * Get health check queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.healthQueue.getWaitingCount(),
      this.healthQueue.getActiveCount(),
      this.healthQueue.getCompletedCount(),
      this.healthQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  }
}
