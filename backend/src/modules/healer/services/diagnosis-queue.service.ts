import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiagnosisProfile, HealerTrigger } from '@prisma/client';

export interface DiagnosisJobData {
  applicationId: string;
  serverId: string;
  domain: string;
  path: string;
  subdomain?: string;
  profile: DiagnosisProfile;
  triggeredBy?: string;
  trigger: HealerTrigger;
  priority?: number;
}

export interface BatchDiagnosisJobData {
  applicationId: string;
  serverId: string;
  mainDomain: string;
  mainPath: string;
  domains: Array<{
    domain: string;
    path: string;
    type: 'main' | 'subdomain' | 'addon' | 'parked';
  }>;
  profile: DiagnosisProfile;
  triggeredBy?: string;
  trigger: HealerTrigger;
}

@Injectable()
export class DiagnosisQueueService {
  private readonly logger = new Logger(DiagnosisQueueService.name);

  constructor(
    @InjectQueue('healer-diagnosis') private diagnosisQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue a single diagnosis job
   */
  async enqueueDiagnosis(data: DiagnosisJobData): Promise<string> {
    this.logger.log(`Enqueueing diagnosis for ${data.domain}`);

    const job = await this.diagnosisQueue.add(
      'diagnose-single',
      data,
      {
        priority: data.priority || 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    );

    this.logger.log(`Diagnosis job enqueued: ${job.id} for ${data.domain}`);
    return job.id!;
  }

  /**
   * Enqueue batch diagnosis for all domains (main + subdomains + addons)
   * This prevents server flooding by using rate limiting
   */
  async enqueueBatchDiagnosis(data: BatchDiagnosisJobData): Promise<{
    batchId: string;
    jobIds: string[];
    totalDomains: number;
  }> {
    this.logger.log(
      `Enqueueing batch diagnosis for ${data.mainDomain} with ${data.domains.length} domains`,
    );

    const batchId = `batch-${Date.now()}-${data.applicationId}`;
    const jobIds: string[] = [];

    // Enqueue jobs with staggered delays to prevent flooding
    // Main domain gets highest priority, then subdomains, then addons/parked
    for (let i = 0; i < data.domains.length; i++) {
      const domainInfo = data.domains[i];
      
      // Calculate priority: main=1, subdomain=5, addon=10, parked=15
      const priorityMap = {
        main: 1,
        subdomain: 5,
        addon: 10,
        parked: 15,
      };
      const priority = priorityMap[domainInfo.type];

      // Add delay between jobs (0s, 10s, 20s, 30s, etc.)
      const delay = i * 10000; // 10 seconds between each job

      const job = await this.diagnosisQueue.add(
        'diagnose-single',
        {
          applicationId: data.applicationId,
          serverId: data.serverId,
          domain: domainInfo.domain,
          path: domainInfo.path,
          subdomain: domainInfo.type !== 'main' ? domainInfo.domain : undefined,
          profile: data.profile,
          triggeredBy: data.triggeredBy,
          trigger: data.trigger,
          priority,
        } as DiagnosisJobData,
        {
          priority,
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          jobId: `${batchId}-${domainInfo.domain}`,
          removeOnComplete: {
            age: 86400,
            count: 1000,
          },
          removeOnFail: {
            age: 604800,
          },
        },
      );

      jobIds.push(job.id!);
      
      this.logger.log(
        `Enqueued diagnosis for ${domainInfo.domain} (${domainInfo.type}) with ${delay}ms delay, priority ${priority}`,
      );
    }

    this.logger.log(
      `Batch diagnosis enqueued: ${batchId} with ${jobIds.length} jobs`,
    );

    return {
      batchId,
      jobIds,
      totalDomains: data.domains.length,
    };
  }

  /**
   * Enqueue diagnosis for all domains of an application
   * Automatically discovers all domains and enqueues them
   */
  async enqueueDiagnosisForAllDomains(
    applicationId: string,
    profile: DiagnosisProfile = DiagnosisProfile.FULL,
    triggeredBy?: string,
  ): Promise<{
    batchId: string;
    jobIds: string[];
    totalDomains: number;
  }> {
    this.logger.log(
      `Enqueueing diagnosis for all domains of application ${applicationId}`,
    );

    // Get application with metadata
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: {
        servers: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // Build domains list
    const domains: Array<{
      domain: string;
      path: string;
      type: 'main' | 'subdomain' | 'addon' | 'parked';
    }> = [];

    // Add main domain
    domains.push({
      domain: application.domain,
      path: application.path,
      type: 'main',
    });

    // Add subdomains, addons, and parked domains from metadata
    const metadata = application.metadata as any;
    if (metadata?.availableSubdomains && Array.isArray(metadata.availableSubdomains)) {
      for (const subdomain of metadata.availableSubdomains) {
        domains.push({
          domain: subdomain.domain,
          path: subdomain.path,
          type: subdomain.type || 'subdomain',
        });
      }
    }

    this.logger.log(
      `Found ${domains.length} domains for application ${application.domain}`,
    );

    // Enqueue batch diagnosis
    return this.enqueueBatchDiagnosis({
      applicationId,
      serverId: application.serverId,
      mainDomain: application.domain,
      mainPath: application.path,
      domains,
      profile,
      triggeredBy,
      trigger: HealerTrigger.MANUAL,
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.diagnosisQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const data = job.data;

    return {
      jobId: job.id,
      state,
      progress,
      data,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<{
    batchId: string;
    total: number;
    completed: number;
    failed: number;
    active: number;
    waiting: number;
    jobs: any[];
  }> {
    // Get all jobs with this batch ID prefix
    const jobs = await this.diagnosisQueue.getJobs([
      'completed',
      'failed',
      'active',
      'waiting',
      'delayed',
    ]);

    const batchJobs = jobs.filter((job) => job.id?.startsWith(batchId));

    const completed = batchJobs.filter((job) => job.finishedOn).length;
    const failed = batchJobs.filter((job) => job.failedReason).length;
    const active = batchJobs.filter(
      (job) => job.processedOn && !job.finishedOn,
    ).length;
    const waiting = batchJobs.filter(
      (job) => !job.processedOn && !job.finishedOn,
    ).length;

    return {
      batchId,
      total: batchJobs.length,
      completed,
      failed,
      active,
      waiting,
      jobs: batchJobs.map((job) => ({
        jobId: job.id,
        domain: job.data.domain,
        state: job.finishedOn
          ? 'completed'
          : job.failedReason
          ? 'failed'
          : job.processedOn
          ? 'active'
          : 'waiting',
        progress: job.progress,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      })),
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.diagnosisQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
    };
  }

  /**
   * Get recent jobs
   */
  async getRecentJobs(limit: number = 20): Promise<any[]> {
    const jobs = await this.diagnosisQueue.getJobs(
      ['completed', 'failed', 'active', 'waiting'],
      0,
      limit - 1,
      true,
    );

    return jobs.map((job) => ({
      jobId: job.id,
      domain: job.data.domain,
      profile: job.data.profile,
      state: job.finishedOn
        ? 'completed'
        : job.failedReason
        ? 'failed'
        : job.processedOn
        ? 'active'
        : 'waiting',
      progress: job.progress,
      createdAt: new Date(job.timestamp),
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
    }));
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    await this.diagnosisQueue.pause();
    this.logger.log('Diagnosis queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.diagnosisQueue.resume();
    this.logger.log('Diagnosis queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanupOldJobs(): Promise<{
    completedCleaned: number;
    failedCleaned: number;
  }> {
    const completedCleaned = await this.diagnosisQueue.clean(
      86400000, // 24 hours
      1000,
      'completed',
    );

    const failedCleaned = await this.diagnosisQueue.clean(
      604800000, // 7 days
      1000,
      'failed',
    );

    this.logger.log(
      `Cleaned up ${completedCleaned.length} completed and ${failedCleaned.length} failed jobs`,
    );

    return {
      completedCleaned: completedCleaned.length,
      failedCleaned: failedCleaned.length,
    };
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.diagnosisQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    this.logger.log(`Retrying job ${jobId}`);
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.diagnosisQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    this.logger.log(`Cancelled job ${jobId}`);
  }

  /**
   * Get job progress
   */
  async getJobProgress(jobId: string): Promise<number> {
    const job = await this.diagnosisQueue.getJob(jobId);
    
    if (!job) {
      return 0;
    }

    return typeof job.progress === 'number' ? job.progress : 0;
  }
}
