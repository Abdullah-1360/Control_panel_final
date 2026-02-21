import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { HealerStatus, DiagnosisType, HealthStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BackupService } from '../services/backup.service';
import { WsodHealerRunbook } from '../runbooks/wsod-healer.runbook';
import { MaintenanceHealerRunbook } from '../runbooks/maintenance-healer.runbook';
import { PatternLearningService } from '../services/pattern-learning.service';
import { VerificationService } from '../services/verification.service';
import { RetryService } from '../services/retry.service';

interface HealingJobData {
  executionId: string;
  siteId: string;
  diagnosisType: string;
  customCommands?: string[];
}

@Processor('healer-jobs')
export class HealingProcessor {
  private readonly logger = new Logger(HealingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
    private readonly wsodHealer: WsodHealerRunbook,
    private readonly maintenanceHealer: MaintenanceHealerRunbook,
    private readonly patternLearning: PatternLearningService,
    private readonly verificationService: VerificationService,
    private readonly retryService: RetryService,
    @InjectQueue('healer-jobs') private readonly healerQueue: Queue,
  ) {}

  @Process('heal')
  async handleHealingJob(job: Job<HealingJobData>): Promise<void> {
    const { executionId, siteId, diagnosisType, customCommands } = job.data;

    this.logger.log(`Processing healing job for execution ${executionId}`);
    
    if (customCommands && customCommands.length > 0) {
      this.logger.log(`Using ${customCommands.length} custom commands`);
    }

    try {
      // Get execution and site details
      const execution = await this.prisma.healer_executions.findUnique({
        where: { id: executionId },
        include: { wp_sites: true },
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      const site = execution.wp_sites;

      // Determine the correct path to use for healing
      const diagnosisDetails = JSON.parse(execution.diagnosisDetails);
      const healingPath = diagnosisDetails.diagnosisPath || site.path;
      const healingDomain = diagnosisDetails.diagnosisDomain || site.domain;
      const customCommands = diagnosisDetails.customCommands || undefined;

      // Create a modified site object with the correct path for healing
      const healingSite = {
        ...site,
        path: healingPath,
        domain: healingDomain,
      };

      this.logger.log(`Healing ${execution.subdomain ? `subdomain: ${execution.subdomain}` : 'main domain'} at path: ${healingPath}`);

      // Update status to HEALING
      await this.updateExecutionStatus(executionId, 'HEALING', [
        {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Starting healing process${execution.subdomain ? ` for subdomain: ${execution.subdomain}` : ''}`,
        },
      ]);

      // Step 1: Create backup
      await this.addExecutionLog(executionId, 'INFO', 'Creating backup...');
      const backup = await this.backupService.createBackup(healingSite, 'FULL');
      await this.addExecutionLog(
        executionId,
        'SUCCESS',
        `Backup created: ${backup.id}`,
      );

      // Link backup to execution
      await this.prisma.healer_executions.update({
        where: { id: executionId },
        data: { backupId: backup.id },
      });

      // Step 2: Execute healing based on diagnosis type
      await this.addExecutionLog(executionId, 'INFO', 'Executing healing...');

      const healingContext = {
        site: healingSite, // Use the modified site object with correct path
        execution,
        diagnosisDetails,
        customCommands,
      };

      let healingResult;

      switch (diagnosisType) {
        case 'WSOD':
        case 'SYNTAX_ERROR':  // Syntax errors are a type of WSOD
          healingResult = await this.wsodHealer.execute(healingContext);
          break;

        case 'MAINTENANCE':
          healingResult = await this.maintenanceHealer.execute(healingContext);
          break;

        default:
          throw new Error(`Unsupported diagnosis type: ${diagnosisType}`);
      }

      await this.addExecutionLog(
        executionId,
        'SUCCESS',
        `Healing action: ${healingResult.action}`,
      );

      // Step 3: Verify healing success
      await this.addExecutionLog(executionId, 'INFO', 'Verifying healing...');

      let isVerified = false;

      switch (diagnosisType) {
        case 'WSOD':
        case 'SYNTAX_ERROR':  // Syntax errors are a type of WSOD
          isVerified = await this.wsodHealer.verify(healingContext);
          break;

        case 'MAINTENANCE':
          isVerified = await this.maintenanceHealer.verify(healingContext);
          break;
      }

      if (isVerified) {
        await this.addExecutionLog(
          executionId,
          'SUCCESS',
          'Healing verified successfully',
        );

        // Perform comprehensive verification
        const verificationResult = await this.verificationService.verify(
          site.serverId,
          healingPath,
          healingDomain,
          diagnosisType,
        );

        // Update execution with verification results
        await this.prisma.healer_executions.update({
          where: { id: executionId },
          data: {
            status: verificationResult.passed ? HealerStatus.SUCCESS : HealerStatus.FAILED,
            wasSuccessful: verificationResult.passed,
            actionTaken: healingResult.action,
            healedAt: new Date(),
            verifiedAt: new Date(),
            finishedAt: new Date(),
            duration: Date.now() - execution.startedAt.getTime(),
            verificationResults: JSON.stringify(verificationResult),
            verificationScore: verificationResult.score,
            verificationChecks: JSON.stringify(verificationResult.checks),
            postHealingMetrics: JSON.stringify(verificationResult.metrics),
          },
        });

        if (verificationResult.passed) {
          // Update site status
          await this.prisma.wp_sites.update({
            where: { id: siteId },
            data: {
              healthStatus: HealthStatus.HEALTHY,
              lastHealedAt: new Date(),
              healingAttempts: 0, // Reset attempts on success
            },
          });

          this.logger.log(`Healing completed successfully: ${executionId} (score: ${verificationResult.score}/100)`);

          // Learn from successful execution
          await this.patternLearning.learnFromExecution(executionId);
          
          // Close circuit breaker on success
          await this.retryService.closeCircuitBreaker(siteId);
        } else {
          throw new Error(`Healing verification failed (score: ${verificationResult.score}/100)`);
        }
      } else {
        throw new Error('Healing verification failed');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Healing job failed: ${err.message}`, err.stack);

      // Record failure for pattern learning
      await this.patternLearning.recordFailure(executionId);

      // Add error log
      await this.addExecutionLog(
        executionId,
        'ERROR',
        `Healing failed: ${err.message}`,
      );

      // Update execution status to FAILED
      await this.prisma.healer_executions.update({
        where: { id: executionId },
        data: {
          status: HealerStatus.FAILED,
          wasSuccessful: false,
          errorMessage: err.message,
          finishedAt: new Date(),
          duration: Date.now() - (await this.getExecutionStartTime(executionId)),
        },
      });

      // Update site status
      await this.prisma.wp_sites.update({
        where: { id: siteId },
        data: {
          healthStatus: HealthStatus.DOWN,
          healingAttempts: {
            increment: 1,
          },
        },
      });

      // Record failure and check for retry
      await this.retryService.recordFailure(siteId);
      const retryDecision = await this.retryService.shouldRetry(executionId, err);

      if (retryDecision.shouldRetry) {
        this.logger.log(`Scheduling retry attempt ${retryDecision.attemptNumber} in ${retryDecision.delayMs}ms`);

        // Create retry execution
        const retryExecutionId = await this.retryService.createRetryExecution(
          executionId,
          retryDecision.attemptNumber,
          retryDecision.reason,
        );

        // Schedule retry job
        await this.healerQueue.add(
          'heal',
          {
            executionId: retryExecutionId,
            siteId,
            diagnosisType,
            customCommands,
          },
          {
            delay: retryDecision.delayMs,
          },
        );

        this.logger.log(`Retry job scheduled: ${retryExecutionId}`);
      } else {
        this.logger.warn(`Not retrying: ${retryDecision.reason}`);
      }

      throw error;
    }
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(
    executionId: string,
    status: HealerStatus,
    logs: any[],
  ): Promise<void> {
    await this.prisma.healer_executions.update({
      where: { id: executionId },
      data: {
        status,
        executionLogs: JSON.stringify(logs),
      },
    });
  }

  /**
   * Add log entry to execution
   */
  private async addExecutionLog(
    executionId: string,
    level: string,
    message: string,
  ): Promise<void> {
    const execution = await this.prisma.healer_executions.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return;
    }

    const logs = JSON.parse(execution.executionLogs);
    logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });

    await this.prisma.healer_executions.update({
      where: { id: executionId },
      data: {
        executionLogs: JSON.stringify(logs),
      },
    });
  }

  /**
   * Get execution start time
   */
  private async getExecutionStartTime(executionId: string): Promise<number> {
    const execution = await this.prisma.healer_executions.findUnique({
      where: { id: executionId },
    });

    return execution?.startedAt.getTime() || Date.now();
  }
}
