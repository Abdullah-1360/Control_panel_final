import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ApplicationService } from '../services/application.service';
import { DiscoveryQueueService } from '../services/discovery-queue.service';
import { DiagnosisQueueService } from '../services/diagnosis-queue.service';
import { AuditService } from '../../audit/audit.service';
import { DiagnosisProfile } from '@prisma/client';

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
    private readonly diagnosisQueueService: DiagnosisQueueService,
    private readonly auditService: AuditService,
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

      // AUTO-TRIGGER DIAGNOSIS: If WordPress and multiple domains, auto-diagnose all
      await this.autoTriggerDiagnosisIfWordPressWithMultipleDomains(applicationId);

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

  /**
   * Auto-trigger diagnosis for all domains if WordPress with multiple domains
   * Triggers after subdomain detection completes (when we know total domain count)
   */
  private async autoTriggerDiagnosisIfWordPressWithMultipleDomains(
    applicationId: string,
  ): Promise<void> {
    try {
      // Get application with metadata
      const app = await this.applicationService.findOne(applicationId);

      // Only trigger for WordPress sites
      if (app.techStack !== 'WORDPRESS') {
        this.logger.debug(
          `Skipping auto-diagnosis for ${app.domain} - not WordPress (${app.techStack})`,
        );
        return;
      }

      // Count total domains (main + subdomains + addons)
      const metadata = app.metadata as any;
      const subdomains = metadata?.availableSubdomains || [];
      const totalDomains = 1 + subdomains.length; // 1 for main domain + subdomains

      this.logger.log(
        `WordPress site ${app.domain}: Total domains = ${totalDomains} (1 main + ${subdomains.length} subdomains/addons)`,
      );

      // Only auto-trigger if there are multiple domains (2+)
      if (totalDomains >= 2) {
        this.logger.log(
          `🚀 AUTO-TRIGGERING diagnosis for all ${totalDomains} domains of ${app.domain}`,
        );

        // Enqueue diagnosis for all domains
        const result = await this.diagnosisQueueService.enqueueDiagnosisForAllDomains(
          applicationId,
          DiagnosisProfile.FULL,
          'SYSTEM', // Triggered by system
        );

        this.logger.log(
          `✅ Auto-diagnosis enqueued: ${result.batchId} with ${result.totalDomains} domains for ${app.domain}`,
        );

        // Create audit log
        await this.auditService.log({
          action: 'AUTO_DIAGNOSIS_TRIGGERED',
          resource: 'APPLICATION',
          resourceId: applicationId,
          description: `Auto-triggered diagnosis for ${totalDomains} domains after subdomain detection`,
          metadata: {
            applicationId,
            domain: app.domain,
            techStack: 'WORDPRESS',
            totalDomains,
            mainDomain: app.domain,
            subdomains: subdomains.map((s: any) => s.domain),
            batchId: result.batchId,
            jobIds: result.jobIds,
            trigger: 'AUTO',
            reason: 'Multiple domains detected on WordPress site after subdomain detection',
          },
          severity: 'INFO',
          actorType: 'SYSTEM',
        });
      } else {
        this.logger.log(
          `No auto-diagnosis needed for ${app.domain} - no additional subdomains/addons detected (main domain only)`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to auto-trigger diagnosis: ${err.message}`,
        err.stack,
      );
      // Don't throw - this is a non-critical enhancement
    }
  }
}
