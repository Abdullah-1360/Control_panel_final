import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { ServerMetricsService } from './server-metrics.service';

export interface MetricsCollectionJob {
  serverId: string;
  serverName: string;
  triggeredBy: 'SCHEDULED' | 'MANUAL' | 'RETRY';
}

@Injectable()
export class MetricsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsQueueService.name);
  private metricsQueue: Queue<MetricsCollectionJob>;
  private metricsWorker: Worker<MetricsCollectionJob>;
  private redisConnection: Redis;
  private cacheConnection: Redis;

  constructor(
    private prisma: PrismaService,
    private metricsService: ServerMetricsService,
  ) {
    // Initialize Redis connections
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Connection for BullMQ queue
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    // Separate connection for caching
    this.cacheConnection = new Redis(redisUrl);

    // Initialize queue
    this.metricsQueue = new Queue<MetricsCollectionJob>('metrics-collection', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
          count: 500,
        },
      },
    });

    // Initialize worker
    this.metricsWorker = new Worker<MetricsCollectionJob>(
      'metrics-collection',
      async (job: Job<MetricsCollectionJob>) => {
        return this.processMetricsCollection(job);
      },
      {
        connection: this.redisConnection,
        concurrency: 5, // Process 5 servers concurrently
      },
    );

    // Worker event handlers
    this.metricsWorker.on('completed', (job) => {
      this.logger.log(`Metrics collection completed for server ${job.data.serverName}`);
    });

    this.metricsWorker.on('failed', (job, err) => {
      // Only log if it's the final attempt (reduces spam)
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        this.logger.warn(
          `Metrics collection permanently failed for server ${job.data.serverName} after ${job.attemptsMade} attempts: ${err.message}`,
        );
      }
    });
  }

  async onModuleInit() {
    this.logger.log('Metrics queue service initialized');
    
    // Schedule metrics collection for all enabled servers
    await this.scheduleAllServers();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down metrics queue service...');
    
    await this.metricsWorker.close();
    await this.metricsQueue.close();
    await this.redisConnection.quit();
    await this.cacheConnection.quit();
    
    this.logger.log('Metrics queue service shut down');
  }

  /**
   * Process metrics collection job
   */
  private async processMetricsCollection(job: Job<MetricsCollectionJob>) {
    const { serverId, serverName, triggeredBy } = job.data;

    this.logger.debug(
      `Processing metrics collection for ${serverName} (triggered by: ${triggeredBy})`,
    );

    try {
      // Check if server still exists
      const serverExists = await this.prisma.servers.findUnique({
        where: { id: serverId, deletedAt: null },
        select: { id: true, metricsEnabled: true },
      });

      if (!serverExists) {
        this.logger.warn(
          `Server ${serverName} (${serverId}) no longer exists, removing from schedule`,
        );
        // Remove the repeatable job for this server
        await this.unscheduleServer(serverId);
        // Don't throw error, just skip this job
        return {
          success: false,
          serverId,
          serverName,
          skipped: true,
          reason: 'Server not found',
        };
      }

      if (!serverExists.metricsEnabled) {
        this.logger.debug(
          `Metrics disabled for ${serverName}, removing from schedule`,
        );
        await this.unscheduleServer(serverId);
        return {
          success: false,
          serverId,
          serverName,
          skipped: true,
          reason: 'Metrics disabled',
        };
      }

      // Collect metrics
      const metrics = await this.metricsService.collectMetrics(serverId);

      // Cache the latest metrics
      await this.cacheLatestMetrics(serverId, {
        ...metrics,
        collectionSuccess: true,
        collectedAt: new Date(),
      });

      // Invalidate aggregated cache
      await this.invalidateAggregatedCache();

      // Reset failure count on success
      await this.resetFailureCount(serverId);

      return {
        success: true,
        serverId,
        serverName,
        metrics,
      };
    } catch (error: any) {
      // Track consecutive failures
      const failureCount = await this.incrementFailureCount(serverId);
      
      // Only log as warning, not error (reduces noise)
      this.logger.warn(
        `Failed to collect metrics for ${serverName} (attempt ${job.attemptsMade}/${job.opts.attempts}, consecutive failures: ${failureCount}): ${error.message}`,
      );

      // If too many consecutive failures, disable metrics for this server
      if (failureCount >= 10) {
        this.logger.warn(
          `Disabling metrics collection for ${serverName} after ${failureCount} consecutive failures`,
        );
        await this.disableMetricsForServer(serverId);
      }

      throw error; // Let BullMQ handle retry
    }
  }

  /**
   * Schedule metrics collection for all enabled servers
   */
  async scheduleAllServers() {
    const servers = await this.prisma.servers.findMany({
      where: {
        deletedAt: null,
        metricsEnabled: true,
      },
      select: {
        id: true,
        name: true,
        metricsInterval: true,
      },
    });

    this.logger.log(`Scheduling metrics collection for ${servers.length} servers`);

    for (const server of servers) {
      await this.scheduleServer(server.id, server.name, server.metricsInterval);
    }
  }

  /**
   * Schedule metrics collection for a specific server
   */
  async scheduleServer(serverId: string, serverName: string, intervalSeconds: number) {
    const repeatKey = `metrics:${serverId}`;

    // Remove existing schedule if any
    const existingJobs = await this.metricsQueue.getRepeatableJobs();
    const existingJob = existingJobs.find((job) => job.key === repeatKey);
    if (existingJob) {
      await this.metricsQueue.removeRepeatableByKey(existingJob.key);
    }

    // Add new repeatable job
    await this.metricsQueue.add(
      repeatKey,
      {
        serverId,
        serverName,
        triggeredBy: 'SCHEDULED',
      },
      {
        repeat: {
          every: intervalSeconds * 1000, // Convert to milliseconds
        },
        jobId: repeatKey,
      },
    );

    this.logger.log(
      `Scheduled metrics collection for ${serverName} every ${intervalSeconds}s`,
    );
  }

  /**
   * Unschedule metrics collection for a server
   */
  async unscheduleServer(serverId: string) {
    const repeatKey = `metrics:${serverId}`;
    const existingJobs = await this.metricsQueue.getRepeatableJobs();
    const existingJob = existingJobs.find((job) => job.key === repeatKey);
    
    if (existingJob) {
      await this.metricsQueue.removeRepeatableByKey(existingJob.key);
      this.logger.log(`Unscheduled metrics collection for server ${serverId}`);
    }
  }

  /**
   * Trigger immediate metrics collection for all servers
   */
  async collectAllMetricsNow() {
    const servers = await this.prisma.servers.findMany({
      where: {
        deletedAt: null,
        metricsEnabled: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const jobs = await Promise.all(
      servers.map((server) =>
        this.metricsQueue.add(
          `manual:${server.id}`,
          {
            serverId: server.id,
            serverName: server.name,
            triggeredBy: 'MANUAL',
          },
          {
            priority: 1, // Higher priority for manual collections
          },
        ),
      ),
    );

    this.logger.log(`Queued ${jobs.length} manual metrics collection jobs`);

    return {
      queued: jobs.length,
      servers: servers.map((s) => ({ id: s.id, name: s.name })),
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.metricsQueue.getWaitingCount(),
      this.metricsQueue.getActiveCount(),
      this.metricsQueue.getCompletedCount(),
      this.metricsQueue.getFailedCount(),
      this.metricsQueue.getDelayedCount(),
    ]);

    const repeatableJobs = await this.metricsQueue.getRepeatableJobs();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      scheduled: repeatableJobs.length,
      repeatableJobs: repeatableJobs.map((job) => ({
        key: job.key,
        pattern: job.pattern,
        next: job.next,
      })),
    };
  }

  /**
   * Pause the queue
   */
  async pauseQueue() {
    await this.metricsQueue.pause();
    this.logger.log('Metrics collection queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.metricsQueue.resume();
    this.logger.log('Metrics collection queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue() {
    const [completedCleaned, failedCleaned] = await Promise.all([
      this.metricsQueue.clean(3600 * 1000, 100, 'completed'), // Keep 1 hour
      this.metricsQueue.clean(86400 * 1000, 500, 'failed'), // Keep 24 hours
    ]);

    this.logger.log(
      `Cleaned ${completedCleaned.length} completed and ${failedCleaned.length} failed jobs`,
    );

    return {
      completedCleaned: completedCleaned.length,
      failedCleaned: failedCleaned.length,
    };
  }

  // ============================================
  // REDIS CACHING METHODS
  // ============================================

  /**
   * Cache latest metrics for a server
   */
  async cacheLatestMetrics(serverId: string, metrics: any) {
    const key = `metrics:latest:${serverId}`;
    await this.cacheConnection.setex(key, 3600, JSON.stringify(metrics)); // 1 hour TTL
  }

  /**
   * Get cached metrics for a server
   */
  async getCachedMetrics(serverId: string) {
    const key = `metrics:latest:${serverId}`;
    const cached = await this.cacheConnection.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache aggregated metrics
   */
  async cacheAggregatedMetrics(data: any) {
    const key = 'metrics:aggregated';
    await this.cacheConnection.setex(key, 60, JSON.stringify(data)); // 1 minute TTL
  }

  /**
   * Get cached aggregated metrics
   */
  async getCachedAggregatedMetrics() {
    const key = 'metrics:aggregated';
    const cached = await this.cacheConnection.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Invalidate aggregated cache
   */
  async invalidateAggregatedCache() {
    const key = 'metrics:aggregated';
    await this.cacheConnection.del(key);
  }

  /**
   * Clear all metrics cache
   */
  async clearAllCache() {
    const keys = await this.cacheConnection.keys('metrics:*');
    if (keys.length > 0) {
      await this.cacheConnection.del(...keys);
      this.logger.log(`Cleared ${keys.length} cached metrics`);
    }
  }

  // ============================================
  // FAILURE TRACKING METHODS
  // ============================================

  /**
   * Increment failure count for a server
   */
  private async incrementFailureCount(serverId: string): Promise<number> {
    const key = `metrics:failures:${serverId}`;
    const count = await this.cacheConnection.incr(key);
    await this.cacheConnection.expire(key, 86400); // 24 hour TTL
    return count;
  }

  /**
   * Reset failure count for a server
   */
  private async resetFailureCount(serverId: string): Promise<void> {
    const key = `metrics:failures:${serverId}`;
    await this.cacheConnection.del(key);
  }

  /**
   * Disable metrics collection for a server
   */
  private async disableMetricsForServer(serverId: string): Promise<void> {
    await this.prisma.servers.update({
      where: { id: serverId },
      data: { metricsEnabled: false },
    });
    await this.unscheduleServer(serverId);
  }
}
