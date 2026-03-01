import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DiscoveryJob, DiscoveryQueueService } from '../services/discovery-queue.service';
import { ApplicationService } from '../services/application.service';
import { AuditService } from '../../audit/audit.service';

@Processor('healer-discovery', {
  concurrency: 4, // Process 4 servers concurrently
})
export class DiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DiscoveryProcessor.name);

  constructor(
    private readonly discoveryQueueService: DiscoveryQueueService,
    private readonly applicationService: ApplicationService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<DiscoveryJob>): Promise<any> {
    const { serverId, serverName, triggeredBy, triggerType, options } = job.data;
    const jobId = job.id!; // BullMQ always provides job.id

    this.logger.log(`Starting discovery for server ${serverName} (job: ${jobId})`);

    try {
      // Update progress: Starting
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: 'PROCESSING',
        progress: 10,
        currentStep: 'Initializing discovery',
        applicationsFound: 0,
        applicationsProcessed: 0,
        errors: [],
        startedAt: new Date(),
      });

      // Step 1: Discover applications (fast, no metadata)
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: 'PROCESSING',
        progress: 20,
        currentStep: 'Discovering applications',
        applicationsFound: 0,
        applicationsProcessed: 0,
        errors: [],
        startedAt: new Date(),
      });

      const discoveryResult = await this.applicationService.discover({
        serverId,
        paths: options?.paths,
        techStacks: options?.techStacks as any, // Cast to avoid type error
        forceRediscover: options?.forceRediscover || false,
      });

      const applicationsFound = Array.isArray(discoveryResult.discovered) 
        ? discoveryResult.discovered.length 
        : 0;

      this.logger.log(`Discovered ${applicationsFound} new applications on server ${serverName}`);

      // IMPORTANT: Also queue tech stack detection for existing UNKNOWN applications
      // This ensures all applications eventually get their tech stack detected
      const unknownApps = await this.applicationService.findAll({
        serverId,
        techStack: 'UNKNOWN',
        limit: 1000,
      });

      this.logger.log(`Found ${unknownApps.data.length} existing UNKNOWN applications to process`);

      const totalToProcess = applicationsFound + unknownApps.data.length;

      // Update progress: Applications discovered
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: 'PROCESSING',
        progress: 50,
        currentStep: `Processing ${applicationsFound} new + ${unknownApps.data.length} UNKNOWN applications`,
        applicationsFound: totalToProcess,
        applicationsProcessed: 0,
        errors: [],
        startedAt: new Date(),
      });

      // Step 2: Enqueue background jobs
      const errors: string[] = [];
      let processedCount = 0;

      const discoveredApps = Array.isArray(discoveryResult.discovered) 
        ? discoveryResult.discovered 
        : [];

      // Process NEW applications (full processing: tech stack + metadata + subdomains)
      for (const app of discoveredApps) {
        try {
          await this.discoveryQueueService.enqueueTechStackDetection(app.id, serverId);
          await this.discoveryQueueService.enqueueMetadataCollection(app.id, serverId);
          await this.discoveryQueueService.enqueueSubdomainDetection(app.id, serverId);
          processedCount++;

          const progress = 50 + Math.floor((processedCount / totalToProcess) * 30);
          await this.discoveryQueueService.updateProgress(jobId, {
            jobId,
            serverId,
            status: 'PROCESSING',
            progress,
            currentStep: `Enqueued jobs (${processedCount}/${totalToProcess})`,
            applicationsFound: totalToProcess,
            applicationsProcessed: processedCount,
            errors,
            startedAt: new Date(),
          });
        } catch (error) {
          const err = error as Error;
          this.logger.error(`Failed to enqueue jobs for new app ${app.domain}: ${err.message}`);
          errors.push(`${app.domain}: ${err.message}`);
        }
      }

      // Process UNKNOWN applications (tech stack detection only)
      for (const app of unknownApps.data) {
        try {
          await this.discoveryQueueService.enqueueTechStackDetection(app.id, serverId);
          processedCount++;

          const progress = 50 + Math.floor((processedCount / totalToProcess) * 30);
          await this.discoveryQueueService.updateProgress(jobId, {
            jobId,
            serverId,
            status: 'PROCESSING',
            progress,
            currentStep: `Enqueued jobs (${processedCount}/${totalToProcess})`,
            applicationsFound: totalToProcess,
            applicationsProcessed: processedCount,
            errors,
            startedAt: new Date(),
          });
        } catch (error) {
          const err = error as Error;
          this.logger.error(`Failed to enqueue tech stack detection for ${app.domain}: ${err.message}`);
          errors.push(`${app.domain}: ${err.message}`);
        }
      }

      // Step 3: Trigger automatic health checks for new applications only
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: 'PROCESSING',
        progress: 85,
        currentStep: 'Triggering health checks',
        applicationsFound: totalToProcess,
        applicationsProcessed: processedCount,
        errors,
        startedAt: new Date(),
      });

      // Trigger health checks for NEW applications only
      let healthChecksTriggered = 0;
      for (const app of discoveredApps) {
        try {
          await this.applicationService.calculateHealthScore(app.id);
          await this.applicationService.updateHealthStatus(app.id);
          healthChecksTriggered++;
          this.logger.debug(`Health check triggered for application ${app.domain}`);
        } catch (error) {
          const err = error as Error;
          this.logger.warn(`Failed to trigger health check for ${app.domain}: ${err.message}`);
        }
      }

      this.logger.log(`Health checks triggered for ${healthChecksTriggered}/${applicationsFound} new applications`);

      // Step 4: Send notifications
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: 'PROCESSING',
        progress: 95,
        currentStep: 'Sending notifications',
        applicationsFound: totalToProcess,
        applicationsProcessed: processedCount,
        errors,
        startedAt: new Date(),
      });

      // Send notification
      if (totalToProcess > 0) {
        try {
          await this.auditService.log({
            action: 'DISCOVERY_COMPLETED',
            resource: 'APPLICATION',
            resourceId: serverId,
            description: `Discovery: ${applicationsFound} new, ${unknownApps.data.length} UNKNOWN queued for detection`,
            metadata: {
              jobId,
              serverId,
              serverName,
              newApplications: applicationsFound,
              unknownApplications: unknownApps.data.length,
              totalProcessed: totalToProcess,
              applications: discoveredApps.map((app: any) => ({
                id: app.id,
                domain: app.domain,
                techStack: app.techStack,
                healthStatus: app.healthStatus,
              })),
              triggeredBy,
              triggerType,
            },
            severity: 'INFO',
            actorType: 'SYSTEM',
          });

          this.logger.log(`Notification sent: ${applicationsFound} new applications discovered`);
        } catch (error) {
          const err = error as Error;
          this.logger.warn(`Failed to send notification: ${err.message}`);
          // Don't add to errors array - notification failures are non-critical
        }
      }

      // Final progress update
      const finalStatus = errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: finalStatus,
        progress: 100,
        currentStep: 'Discovery completed',
        applicationsFound: totalToProcess,
        applicationsProcessed: processedCount,
        errors,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      this.logger.log(`Discovery completed: ${applicationsFound} new + ${unknownApps.data.length} UNKNOWN = ${totalToProcess} total processed`);

      return {
        success: true,
        applicationsFound: totalToProcess,
        newApplications: applicationsFound,
        unknownApplications: unknownApps.data.length,
        applicationsProcessed: processedCount,
        errors,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Discovery failed for server ${serverName}: ${err.message}`, err.stack);

      // Update progress: Failed
      await this.discoveryQueueService.updateProgress(jobId, {
        jobId,
        serverId,
        status: 'FAILED',
        progress: 0,
        currentStep: `Failed: ${err.message}`,
        applicationsFound: 0,
        applicationsProcessed: 0,
        errors: [err.message],
        startedAt: new Date(),
        completedAt: new Date(),
      });

      // Audit failed discovery
      await this.discoveryQueueService.auditFailedJob(job, err);

      throw error;
    }
  }
}
