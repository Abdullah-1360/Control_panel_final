import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ApplicationService } from '../services/application.service';

interface MetadataCollectionJob {
  applicationId: string;
  serverId: string;
}

@Processor('healer-metadata-collection', {
  concurrency: 10, // Process 10 apps concurrently
})
export class MetadataCollectionProcessor extends WorkerHost {
  private readonly logger = new Logger(MetadataCollectionProcessor.name);

  constructor(private readonly applicationService: ApplicationService) {
    super();
  }

  async process(job: Job<MetadataCollectionJob>): Promise<any> {
    const { applicationId, serverId } = job.data;

    this.logger.debug(`Collecting metadata for application ${applicationId}`);

    try {
      // Collect detailed metadata for the application
      await this.applicationService.collectDetailedMetadata(applicationId);

      this.logger.log(`Metadata collection completed for application ${applicationId}`);

      return { success: true, applicationId };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Metadata collection failed for application ${applicationId}: ${err.message}`);
      throw error;
    }
  }
}
