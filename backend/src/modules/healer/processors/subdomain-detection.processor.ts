import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ApplicationService } from '../services/application.service';
import { DiscoveryQueueService } from '../services/discovery-queue.service';

interface SubdomainDetectionJob {
  applicationId: string;
  serverId: string;
}

@Processor('healer-subdomain-detection', {
  concurrency: 10, // Process 10 apps concurrently
})
export class SubdomainDetectionProcessor extends WorkerHost {
  private readonly logger = new Logger(SubdomainDetectionProcessor.name);

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly discoveryQueueService: DiscoveryQueueService,
  ) {
    super();
  }

  async process(job: Job<SubdomainDetectionJob>): Promise<any> {
    const { applicationId, serverId } = job.data;

    this.logger.debug(`Detecting subdomains for application ${applicationId}`);

    try {
      // Detect subdomains and addon domains for the application
      const result = await this.applicationService.detectSubdomainsForApplication(applicationId);

      const totalFound = result.subdomains.length + result.addonDomains.length + result.parkedDomains.length;

      this.logger.log(
        `Subdomain detection completed for application ${applicationId}: ${result.subdomains.length} subdomains, ${result.addonDomains.length} addon domains, ${result.parkedDomains.length} parked domains`,
      );

      // NEW: Queue tech stack detection for all discovered subdomains
      // This replicates the "View Details" auto-detection behavior
      if (totalFound > 0) {
        this.logger.log(`Queueing tech stack detection for ${totalFound} subdomains of application ${applicationId}`);
        
        try {
          // Get the updated application with subdomain metadata
          const app = await this.applicationService.findOne(applicationId);
          const metadata = app.metadata as any;
          const subdomains = metadata?.availableSubdomains || [];
          
          let queuedCount = 0;
          for (const subdomain of subdomains) {
            try {
              // Queue tech stack detection for each subdomain
              await this.discoveryQueueService.enqueueTechStackDetection(
                applicationId,
                serverId,
                subdomain.domain, // Pass subdomain domain
              );
              queuedCount++;
            } catch (error: any) {
              this.logger.warn(
                `Failed to queue tech stack detection for subdomain ${subdomain.domain}: ${error.message}`,
              );
            }
          }
          
          this.logger.log(
            `Successfully queued tech stack detection for ${queuedCount}/${totalFound} subdomains`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to queue subdomain tech stack detection: ${error.message}`,
          );
          // Don't throw - subdomain detection itself succeeded
        }
      }

      return {
        success: true,
        applicationId,
        subdomainsFound: result.subdomains.length,
        addonDomainsFound: result.addonDomains.length,
        parkedDomainsFound: result.parkedDomains.length,
        totalFound,
        techStackDetectionQueued: totalFound,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Subdomain detection failed for application ${applicationId}: ${err.message}`);
      throw error;
    }
  }
}
