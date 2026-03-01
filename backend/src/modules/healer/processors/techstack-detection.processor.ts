import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ApplicationService } from '../services/application.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface TechStackDetectionJob {
  applicationId: string;
  serverId: string;
  subdomain?: string; // Optional: if provided, detect tech stack for this subdomain
}

@Processor('healer-techstack-detection', {
  concurrency: 10, // Process 10 apps concurrently
})
export class TechStackDetectionProcessor extends WorkerHost {
  private readonly logger = new Logger(TechStackDetectionProcessor.name);

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<TechStackDetectionJob>): Promise<any> {
    const { applicationId, serverId, subdomain } = job.data;

    const target = subdomain || 'main application';
    this.logger.debug(`Detecting tech stack for ${target} (application ${applicationId})`);

    try {
      // Detect tech stack for the application or subdomain
      const result = subdomain
        ? await this.applicationService.detectSubdomainTechStack(applicationId, subdomain)
        : await this.applicationService.detectTechStack(applicationId);

      // Get current application state for audit logging
      const app = await this.prisma.applications.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          domain: true,
          path: true,
          techStack: true,
          detectionAttempts: true,
          metadata: true,
          servers: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!app) {
        throw new Error(`Application ${applicationId} not found`);
      }

      // For main application: track detection attempts and create audit logs
      if (!subdomain) {
        // Increment detection attempts
        const newAttempts = (app.detectionAttempts || 0) + 1;
        
        // If still UNKNOWN after 5 attempts, create audit log and reset counter
        if (result.techStack === 'UNKNOWN' && newAttempts >= 5) {
          this.logger.warn(
            `Application ${app.domain} still UNKNOWN after ${newAttempts} detection attempts - creating audit log and resetting counter`,
          );

          await this.auditService.log({
            action: 'TECH_STACK_DETECTION_FAILED',
            resource: 'APPLICATION',
            resourceId: applicationId,
            description: `Tech stack detection failed after ${newAttempts} attempts for ${app.domain}`,
            metadata: {
              applicationId,
              domain: app.domain,
              path: app.path,
              serverId: app.servers.id,
              serverName: app.servers.name,
              detectionAttempts: newAttempts,
              lastAttempt: new Date().toISOString(),
              confidence: result.confidence,
              detectionMethod: 'AUTO',
              reason: 'No matching tech stack signatures found',
            },
            severity: 'WARNING',
            actorType: 'SYSTEM',
          });

          // Reset counter after creating audit log to avoid spam
          await this.prisma.applications.update({
            where: { id: applicationId },
            data: {
              detectionAttempts: 0,
              lastDetectionAttempt: new Date(),
            },
          });

          this.logger.log(`Reset detection attempts counter for ${app.domain} after audit log creation`);
        } else if (result.techStack !== 'UNKNOWN') {
          // Successfully detected - reset counter
          await this.prisma.applications.update({
            where: { id: applicationId },
            data: {
              detectionAttempts: 0,
              lastDetectionAttempt: new Date(),
            },
          });

          this.logger.log(`Successfully detected ${result.techStack} for ${app.domain} - reset counter`);
        } else {
          // Still UNKNOWN but not at threshold yet - increment counter
          await this.prisma.applications.update({
            where: { id: applicationId },
            data: {
              detectionAttempts: newAttempts,
              lastDetectionAttempt: new Date(),
            },
          });

          this.logger.debug(`Detection attempt ${newAttempts} for ${app.domain} - still UNKNOWN`);
        }

        this.logger.log(
          `Tech stack detection completed for application ${applicationId}: ${result.techStack} (${result.confidence} confidence) - Attempt ${newAttempts}`,
        );
      } else {
        // For subdomains: just log the result
        this.logger.log(
          `Tech stack detection completed for subdomain ${subdomain} (application ${applicationId}): ${result.techStack} (${result.confidence} confidence)`,
        );
      }

      return {
        success: true,
        applicationId,
        subdomain: subdomain || null,
        techStack: result.techStack,
        version: result.version,
        confidence: result.confidence,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Tech stack detection failed for ${target} (application ${applicationId}): ${err.message}`);
      
      // Increment attempts even on error (main application only)
      if (!subdomain) {
        try {
          await this.prisma.applications.update({
            where: { id: applicationId },
            data: {
              detectionAttempts: { increment: 1 },
              lastDetectionAttempt: new Date(),
            },
          });
        } catch (updateError: any) {
          this.logger.error(`Failed to update detection attempts: ${updateError.message}`);
        }
      }
      
      throw error;
    }
  }
}
