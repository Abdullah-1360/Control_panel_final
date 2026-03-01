import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EventBusService, SystemEvent } from '../../../common/events/event-bus.service';

export interface DiscoveryJob {
  serverId: string;
  serverName: string;
  triggeredBy: string;
  triggerType: 'MANUAL' | 'SCHEDULED' | 'AUTO';
  options?: {
    forceRediscover?: boolean;
    paths?: string[];
    techStacks?: string[];
  };
}

export interface DiscoveryProgress {
  jobId: string;
  serverId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  progress: number; // 0-100
  currentStep: string;
  applicationsFound: number;
  applicationsProcessed: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class DiscoveryQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscoveryQueueService.name);
  private discoveryQueue: Queue<DiscoveryJob>;
  private metadataQueue: Queue<any>;
  private subdomainQueue: Queue<any>;
  private techStackQueue: Queue<any>;
  private redisConnection: Redis;
  private cacheConnection: Redis;

  // Cache TTLs
  private readonly DOMAIN_LIST_CACHE_TTL = 3600; // 1 hour
  private readonly TECH_STACK_CACHE_TTL = 86400; // 24 hours
  private readonly PROGRESS_CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Connection for BullMQ queues
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    // Separate connection for caching
    this.cacheConnection = new Redis(redisUrl);

    // Initialize discovery queue
    this.discoveryQueue = new Queue<DiscoveryJob>('healer-discovery', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s, 20s, 40s
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500,
        },
      },
    });

    // Initialize metadata collection queue
    this.metadataQueue = new Queue('healer-metadata-collection', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 50,
        },
        removeOnFail: {
          age: 86400,
          count: 200,
        },
      },
    });

    // Initialize subdomain detection queue
    this.subdomainQueue = new Queue('healer-subdomain-detection', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 50,
        },
        removeOnFail: {
          age: 86400,
          count: 200,
        },
      },
    });

    // Initialize tech stack detection queue
    this.techStackQueue = new Queue('healer-techstack-detection', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 50,
        },
        removeOnFail: {
          age: 86400,
          count: 200,
        },
      },
    });
  }

  async onModuleInit() {
    this.logger.log('Discovery queue service initialized');

    // Listen for server deletion events
    this.eventBus.on(SystemEvent.SERVER_DELETED, async (event) => {
      const { serverId, serverName } = event.data;
      this.logger.log(`Server ${serverName} deleted, cleaning up queued jobs...`);
      
      try {
        const result = await this.removeServerJobs(serverId);
        this.logger.log(`Cleaned up ${result.removed} jobs for deleted server ${serverName}`);
      } catch (error) {
        this.logger.error(`Failed to clean up jobs for server ${serverName}:`, error);
      }
    });
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down discovery queue service...');

    await this.discoveryQueue.close();
    await this.metadataQueue.close();
    await this.subdomainQueue.close();
    await this.techStackQueue.close();
    await this.redisConnection.quit();
    await this.cacheConnection.quit();

    this.logger.log('Discovery queue service shut down');
  }

  /**
   * Enqueue discovery job for a server
   */
  async enqueueDiscovery(data: DiscoveryJob): Promise<string> {
    // Check if discovery is already running for this server
    const existingJob = await this.getActiveDiscoveryJob(data.serverId);
    if (existingJob) {
      this.logger.warn(`Discovery already running for server ${data.serverName} (job: ${existingJob.id})`);
      throw new Error(`Discovery already in progress for server ${data.serverName}`);
    }

    // Add job to queue
    const job = await this.discoveryQueue.add('discover-server', data, {
      jobId: `discovery-${data.serverId}-${Date.now()}`,
    });

    this.logger.log(`Enqueued discovery job ${job.id!} for server ${data.serverName}`);

    // Initialize progress tracking
    await this.updateProgress(job.id!, {
      jobId: job.id!,
      serverId: data.serverId,
      status: 'QUEUED',
      progress: 0,
      currentStep: 'Queued for processing',
      applicationsFound: 0,
      applicationsProcessed: 0,
      errors: [],
    });

    return job.id!;
  }

  /**
   * Enqueue metadata collection for an application
   */
  async enqueueMetadataCollection(applicationId: string, serverId: string): Promise<void> {
    await this.metadataQueue.add('collect-metadata', {
      applicationId,
      serverId,
    });

    this.logger.debug(`Enqueued metadata collection for application ${applicationId}`);
  }

  /**
   * Enqueue subdomain detection for an application
   */
  async enqueueSubdomainDetection(applicationId: string, serverId: string): Promise<void> {
    await this.subdomainQueue.add('detect-subdomains', {
      applicationId,
      serverId,
    });

    this.logger.debug(`Enqueued subdomain detection for application ${applicationId}`);
  }

  /**
   * Enqueue tech stack detection for an application or subdomain
   */
  async enqueueTechStackDetection(
    applicationId: string,
    serverId: string,
    subdomain?: string,
  ): Promise<void> {
    await this.techStackQueue.add('detect-techstack', {
      applicationId,
      serverId,
      subdomain,
    }, {
      priority: 1, // Higher priority than metadata collection
    });

    const target = subdomain ? `subdomain ${subdomain}` : 'main application';
    this.logger.debug(`Enqueued tech stack detection for ${target} (application ${applicationId})`);
  }

  /**
   * Remove all queued jobs for a specific server
   * Called when a server is deleted
   */
  async removeServerJobs(serverId: string): Promise<{ removed: number }> {
    this.logger.log(`Removing all queued jobs for server ${serverId}`);

    let removedCount = 0;

    // Remove from discovery queue
    const discoveryJobs = await this.discoveryQueue.getJobs(['waiting', 'delayed']);
    for (const job of discoveryJobs) {
      if (job.data.serverId === serverId) {
        await job.remove();
        removedCount++;
      }
    }

    // Remove from metadata queue
    const metadataJobs = await this.metadataQueue.getJobs(['waiting', 'delayed']);
    for (const job of metadataJobs) {
      if (job.data.serverId === serverId) {
        await job.remove();
        removedCount++;
      }
    }

    // Remove from subdomain queue
    const subdomainJobs = await this.subdomainQueue.getJobs(['waiting', 'delayed']);
    for (const job of subdomainJobs) {
      if (job.data.serverId === serverId) {
        await job.remove();
        removedCount++;
      }
    }

    // Remove from tech stack queue
    const techStackJobs = await this.techStackQueue.getJobs(['waiting', 'delayed']);
    for (const job of techStackJobs) {
      if (job.data.serverId === serverId) {
        await job.remove();
        removedCount++;
      }
    }

    this.logger.log(`Removed ${removedCount} queued jobs for server ${serverId}`);

    return { removed: removedCount };
  }

  /**
   * Get active discovery job for a server
   */
  async getActiveDiscoveryJob(serverId: string): Promise<Job<DiscoveryJob> | null> {
    const activeJobs = await this.discoveryQueue.getActive();
    const waitingJobs = await this.discoveryQueue.getWaiting();

    const allJobs = [...activeJobs, ...waitingJobs];
    return allJobs.find(job => job.data.serverId === serverId) || null;
  }

  /**
   * Get discovery progress
   */
  async getProgress(jobId: string): Promise<DiscoveryProgress | null> {
    const cached = await this.cacheConnection.get(`discovery:progress:${jobId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  /**
   * Update discovery progress
   */
  async updateProgress(jobId: string, progress: DiscoveryProgress): Promise<void> {
    await this.cacheConnection.setex(
      `discovery:progress:${jobId}`,
      this.PROGRESS_CACHE_TTL,
      JSON.stringify(progress),
    );
  }

  /**
   * Cache domain list for a server
   */
  async cacheDomainList(serverId: string, domains: any[]): Promise<void> {
    await this.cacheConnection.setex(
      `discovery:domains:${serverId}`,
      this.DOMAIN_LIST_CACHE_TTL,
      JSON.stringify(domains),
    );
  }

  /**
   * Get cached domain list
   */
  async getCachedDomainList(serverId: string): Promise<any[] | null> {
    const cached = await this.cacheConnection.get(`discovery:domains:${serverId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  /**
   * Cache tech stack detection result
   */
  async cacheTechStackResult(path: string, result: any): Promise<void> {
    await this.cacheConnection.setex(
      `discovery:techstack:${path}`,
      this.TECH_STACK_CACHE_TTL,
      JSON.stringify(result),
    );
  }

  /**
   * Get cached tech stack result
   */
  async getCachedTechStackResult(path: string): Promise<any | null> {
    const cached = await this.cacheConnection.get(`discovery:techstack:${path}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [
      discoveryWaiting,
      discoveryActive,
      discoveryCompleted,
      discoveryFailed,
      metadataWaiting,
      metadataActive,
      subdomainWaiting,
      subdomainActive,
      techStackWaiting,
      techStackActive,
    ] = await Promise.all([
      this.discoveryQueue.getWaitingCount(),
      this.discoveryQueue.getActiveCount(),
      this.discoveryQueue.getCompletedCount(),
      this.discoveryQueue.getFailedCount(),
      this.metadataQueue.getWaitingCount(),
      this.metadataQueue.getActiveCount(),
      this.subdomainQueue.getWaitingCount(),
      this.subdomainQueue.getActiveCount(),
      this.techStackQueue.getWaitingCount(),
      this.techStackQueue.getActiveCount(),
    ]);

    return {
      discovery: {
        waiting: discoveryWaiting,
        active: discoveryActive,
        completed: discoveryCompleted,
        failed: discoveryFailed,
      },
      metadata: {
        waiting: metadataWaiting,
        active: metadataActive,
      },
      subdomain: {
        waiting: subdomainWaiting,
        active: subdomainActive,
      },
      techStack: {
        waiting: techStackWaiting,
        active: techStackActive,
      },
    };
  }

  /**
   * Get recent discovery jobs
   */
  async getRecentJobs(limit: number = 10) {
    const [completed, failed] = await Promise.all([
      this.discoveryQueue.getCompleted(0, limit - 1),
      this.discoveryQueue.getFailed(0, limit - 1),
    ]);

    const allJobs = [...completed, ...failed]
      .sort((a, b) => (b.finishedOn || 0) - (a.finishedOn || 0))
      .slice(0, limit);

    return Promise.all(
      allJobs.map(async job => {
        const progress = await this.getProgress(job.id!);
        return {
          id: job.id!,
          serverId: job.data.serverId,
          serverName: job.data.serverName,
          triggeredBy: job.data.triggeredBy,
          status: job.failedReason ? 'FAILED' : 'COMPLETED',
          progress: progress?.progress || 100,
          applicationsFound: progress?.applicationsFound || 0,
          startedAt: job.processedOn ? new Date(job.processedOn) : null,
          completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
          error: job.failedReason,
        };
      }),
    );
  }

  /**
   * Audit failed discovery job
   */
  async auditFailedJob(job: Job<DiscoveryJob>, error: Error): Promise<void> {
    try {
      await this.auditService.log({
        action: 'DISCOVERY_FAILED',
        resource: 'APPLICATION',
        resourceId: job.data.serverId,
        description: `Discovery failed for server ${job.data.serverName}`,
        metadata: {
          jobId: job.id!,
          serverId: job.data.serverId,
          serverName: job.data.serverName,
          triggeredBy: job.data.triggeredBy,
          error: error.message,
          stack: error.stack,
          attemptsMade: job.attemptsMade,
        },
        severity: 'HIGH',
        actorType: 'SYSTEM',
      });
    } catch (auditError) {
      this.logger.error('Failed to audit discovery failure', auditError);
    }
  }

  /**
   * Get discovery queue instance (for processor)
   */
  getDiscoveryQueue(): Queue<DiscoveryJob> {
    return this.discoveryQueue;
  }

  /**
   * Get metadata queue instance (for processor)
   */
  getMetadataQueue(): Queue<any> {
    return this.metadataQueue;
  }

  /**
   * Get subdomain queue instance (for processor)
   */
  getSubdomainQueue(): Queue<any> {
    return this.subdomainQueue;
  }

  /**
   * Get tech stack queue instance (for processor)
   */
  getTechStackQueue(): Queue<any> {
    return this.techStackQueue;
  }
}
