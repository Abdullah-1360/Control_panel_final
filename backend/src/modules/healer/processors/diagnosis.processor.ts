import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UnifiedDiagnosisService } from '../services/unified-diagnosis.service';
import { AuditService } from '../../audit/audit.service';
import { DiagnosisJobData } from '../services/diagnosis-queue.service';

@Processor('healer-diagnosis', {
  concurrency: 3, // Process max 3 diagnosis jobs concurrently to prevent server overload
  limiter: {
    max: 10, // Max 10 jobs per duration
    duration: 60000, // Per 60 seconds (1 minute)
  },
})
export class DiagnosisProcessor extends WorkerHost {
  private readonly logger = new Logger(DiagnosisProcessor.name);

  constructor(
    private readonly unifiedDiagnosisService: UnifiedDiagnosisService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<DiagnosisJobData>): Promise<any> {
    const { applicationId, domain, subdomain, profile, triggeredBy, trigger } = job.data;
    const diagnosisId = job.id!; // Use job ID as diagnosis ID for SSE tracking

    this.logger.log(
      `Processing diagnosis job ${diagnosisId} for ${domain}${subdomain ? ` (subdomain: ${subdomain})` : ''}`,
    );

    try {
      // Update job progress
      await job.updateProgress(10);

      // Get application to find siteId (wp_sites)
      // For now, we'll use applicationId directly since we're transitioning
      // In the future, we need to map applications to wp_sites
      
      await job.updateProgress(20);

      // Run diagnosis using unified diagnosis service with diagnosisId
      const result = await this.unifiedDiagnosisService.diagnose(
        applicationId, // Using applicationId as siteId for now
        profile as any, // Cast to avoid type error
        {
          diagnosisId, // Pass job ID as diagnosis ID for SSE tracking
          subdomain,
          triggeredBy,
          trigger,
          bypassCache: false,
        },
      );

      await job.updateProgress(90);

      // Create audit log
      await this.auditService.log({
        action: 'DIAGNOSE_SITE',
        resource: 'APPLICATION',
        resourceId: applicationId,
        description: `Diagnosis completed for ${domain}${subdomain ? ` (${subdomain})` : ''} via queue`,
        metadata: {
          domain,
          subdomain,
          profile,
          healthScore: result.healthScore,
          diagnosisType: result.diagnosisType,
          issuesFound: result.issuesFound,
          criticalIssues: result.criticalIssues,
          jobId: job.id,
          diagnosisId,
        },
        severity: result.criticalIssues > 0 ? 'HIGH' : result.issuesFound > 0 ? 'WARNING' : 'INFO',
        actorType: 'SYSTEM',
      });

      await job.updateProgress(100);

      this.logger.log(
        `Diagnosis completed for ${domain}: ${result.diagnosisType} (score: ${result.healthScore}) [ID: ${diagnosisId}]`,
      );

      return {
        success: true,
        domain,
        subdomain,
        healthScore: result.healthScore,
        diagnosisType: result.diagnosisType,
        issuesFound: result.issuesFound,
        criticalIssues: result.criticalIssues,
        diagnosisId, // Include diagnosisId in result
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Diagnosis failed for ${domain}: ${err.message}`,
        err.stack,
      );

      // Create audit log for failure
      await this.auditService.log({
        action: 'DIAGNOSE_SITE',
        resource: 'APPLICATION',
        resourceId: applicationId,
        description: `Diagnosis failed for ${domain}${subdomain ? ` (${subdomain})` : ''}: ${err.message}`,
        metadata: {
          domain,
          subdomain,
          profile,
          error: err.message,
          jobId: job.id,
          diagnosisId,
        },
        severity: 'HIGH',
        actorType: 'SYSTEM',
      });

      throw error;
    }
  }
}
