import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DiagnosisType, HealthStatus, HealerTrigger, HealerStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiagnosisService } from './diagnosis.service';
import { BackupService } from './backup.service';
import { PatternLearningService } from './pattern-learning.service';

@Injectable()
export class HealingOrchestratorService {
  private readonly logger = new Logger(HealingOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisService: DiagnosisService,
    private readonly backupService: BackupService,
    private readonly patternLearning: PatternLearningService,
    @InjectQueue('healer-jobs') private readonly healerQueue: Queue,
  ) {}

  /**
   * Trigger diagnosis for a site (with optional subdomain)
   */
  async diagnose(siteId: string, triggeredBy?: string, subdomain?: string): Promise<any> {
    this.logger.log(`Starting diagnosis for site ${siteId}${subdomain ? ` (subdomain: ${subdomain})` : ''}`);

    try {
      const site = await this.prisma.wp_sites.findUnique({
        where: { id: siteId },
      });

      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      // Determine the path to diagnose
      let diagnosisPath = site.path;
      let diagnosisDomain = site.domain;

      if (subdomain) {
        // Find the subdomain in availableSubdomains
        const subdomains = (site.availableSubdomains as any) || [];
        const subdomainInfo = subdomains.find((s: any) => s.subdomain === subdomain);

        if (subdomainInfo) {
          diagnosisPath = subdomainInfo.path;
          diagnosisDomain = subdomain;
          this.logger.log(`Using subdomain path: ${diagnosisPath}`);
        } else {
          throw new Error(`Subdomain ${subdomain} not found for site ${siteId}`);
        }
      }

      // Check rate limiting
      const canDiagnose = await this.checkRateLimit(siteId);
      if (!canDiagnose) {
        throw new Error('Rate limit exceeded - please wait before diagnosing again');
      }

      // Perform diagnosis
      const diagnosis = await this.diagnosisService.diagnose(
        site.serverId,
        diagnosisPath,
        diagnosisDomain,
      );

      // Get learned pattern suggestions
      const patternSuggestions = await this.patternLearning.suggestCommands(diagnosis);

      // Use pattern suggestions if available and confident, otherwise use diagnosis suggestions
      let suggestedCommands = diagnosis.suggestedCommands;
      let suggestedAction = diagnosis.suggestedAction;
      let patternId: string | undefined;

      if (patternSuggestions.length > 0) {
        const bestPattern = patternSuggestions[0];
        suggestedCommands = bestPattern.commands;
        suggestedAction = bestPattern.reasoning;
        patternId = bestPattern.patternId;

        this.logger.log(`Using learned pattern ${patternId} with ${Math.round(bestPattern.confidence * 100)}% confidence`);
      }

      // Create execution record
      const execution = await this.prisma.healer_executions.create({
        data: {
          siteId,
          subdomain, // Store subdomain for healing process
          trigger: triggeredBy ? HealerTrigger.MANUAL : HealerTrigger.SEARCH,
          triggeredBy,
          diagnosisType: diagnosis.diagnosisType,
          diagnosisDetails: JSON.stringify({
            ...diagnosis.details,
            patternId, // Store pattern ID for learning
            patternSuggestions: patternSuggestions.map(p => ({
              confidence: p.confidence,
              autoApprove: p.autoApprove,
              reasoning: p.reasoning,
            })),
            diagnosisPath, // Store the path that was diagnosed
            diagnosisDomain, // Store the domain that was diagnosed
          }),
          confidence: diagnosis.confidence,
          logsAnalyzed: JSON.stringify(diagnosis.logsAnalyzed),
          suggestedAction,
          suggestedCommands: JSON.stringify(suggestedCommands),
          status: HealerStatus.DIAGNOSED,
          executionLogs: JSON.stringify([
            {
              timestamp: new Date().toISOString(),
              level: 'INFO',
              message: `Diagnosis completed${subdomain ? ` for subdomain: ${subdomain}` : ''}`,
            },
            ...(patternSuggestions.length > 0 ? [{
              timestamp: new Date().toISOString(),
              level: 'INFO',
              message: `Found ${patternSuggestions.length} learned pattern(s)`,
            }] : []),
          ]),
          diagnosedAt: new Date(),
        },
      });

      // Update site status
      await this.prisma.wp_sites.update({
        where: { id: siteId },
        data: {
          lastDiagnosedAt: new Date(),
          healthStatus: this.mapDiagnosisToHealthStatus(diagnosis.diagnosisType),
        },
      });

      this.logger.log(`Diagnosis completed: ${execution.id}`);

      return {
        executionId: execution.id,
        diagnosis,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Diagnosis failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Execute healing (after user approval)
   */
  async heal(executionId: string, customCommands?: string[]): Promise<any> {
    this.logger.log(`Starting healing for execution ${executionId}`);

    try {
      const execution = await this.prisma.healer_executions.findUnique({
        where: { id: executionId },
        include: { wp_sites: true },
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      if (execution.status !== 'DIAGNOSED') {
        throw new Error(`Execution ${executionId} is not in DIAGNOSED status`);
      }

      const site = execution.site;

      // Check circuit breaker (skip if custom commands provided - that IS manual intervention)
      if (!customCommands || customCommands.length === 0) {
        const canHeal = await this.checkCircuitBreaker(site.id);
        if (!canHeal) {
          throw new Error(
            'Circuit breaker open - max healing attempts reached. Manual intervention required.',
          );
        }
      } else {
        this.logger.log('Bypassing circuit breaker - custom commands provided (manual intervention)');
      }

      // Store custom commands in diagnosisDetails if provided
      let updatedDiagnosisDetails = execution.diagnosisDetails;
      if (customCommands && customCommands.length > 0) {
        const diagnosisDetails = JSON.parse(execution.diagnosisDetails);
        diagnosisDetails.customCommands = customCommands;
        updatedDiagnosisDetails = JSON.stringify(diagnosisDetails);
        
        this.logger.log(`Custom commands provided: ${customCommands.length} commands`);
      }

      // Update execution status
      await this.prisma.healer_executions.update({
        where: { id: executionId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          diagnosisDetails: updatedDiagnosisDetails,
        },
      });

      // Queue healing job
      const job = await this.healerQueue.add('heal', {
        executionId,
        siteId: site.id,
        diagnosisType: execution.diagnosisType,
        customCommands,
      });

      this.logger.log(`Healing job queued: ${job.id}`);

      return {
        executionId,
        jobId: job.id,
        status: 'QUEUED',
        message: 'Healing job queued for execution',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Healing failed: ${err.message}`, err.stack);

      // Update execution status
      await this.prisma.healer_executions.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Rollback to backup
   */
  async rollback(executionId: string): Promise<void> {
    this.logger.log(`Rolling back execution ${executionId}`);

    try {
      const execution = await this.prisma.healer_executions.findUnique({
        where: { id: executionId },
        include: { backup: true },
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      if (!execution.backup) {
        throw new Error(`No backup found for execution ${executionId}`);
      }

      // Restore from backup
      await this.backupService.restore(execution.backup.id);

      // Update execution status
      await this.prisma.healer_executions.update({
        where: { id: executionId },
        data: {
          status: 'ROLLED_BACK',
          finishedAt: new Date(),
        },
      });

      this.logger.log(`Rollback completed for execution ${executionId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Rollback failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Check rate limiting (max 1 diagnosis per 30 mins)
   */
  private async checkRateLimit(siteId: string): Promise<boolean> {
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
    });

    if (!site || !site.lastDiagnosedAt) {
      return true;
    }

    const cooldownMs = site.healingCooldown * 1000; // Convert to milliseconds
    const elapsed = Date.now() - site.lastDiagnosedAt.getTime();

    return elapsed >= cooldownMs;
  }

  /**
   * Check circuit breaker (max 3 attempts per 24 hours)
   */
  private async checkCircuitBreaker(siteId: string): Promise<boolean> {
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return false;
    }

    // Count healing attempts in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAttempts = await this.prisma.healer_executions.count({
      where: {
        siteId,
        startedAt: {
          gte: oneDayAgo,
        },
        status: {
          in: [HealerStatus.SUCCESS, HealerStatus.FAILED],
        },
      },
    });

    return recentAttempts < site.maxHealingAttempts;
  }

  /**
   * Map diagnosis type to health status
   */
  private mapDiagnosisToHealthStatus(diagnosisType: DiagnosisType): HealthStatus {
    switch (diagnosisType) {
      case DiagnosisType.HEALTHY:
        return HealthStatus.HEALTHY;
      case DiagnosisType.WSOD:
      case DiagnosisType.DB_ERROR:
      case DiagnosisType.SYNTAX_ERROR:
        return HealthStatus.DOWN;
      case DiagnosisType.MAINTENANCE:
        return HealthStatus.MAINTENANCE;
      case DiagnosisType.MEMORY_EXHAUSTION:
      case DiagnosisType.PERMISSION:
        return HealthStatus.DEGRADED;
      default:
        return HealthStatus.UNKNOWN;
    }
  }

  /**
   * Get execution details
   */
  async getExecution(executionId: string): Promise<any> {
    const execution = await this.prisma.healer_executions.findUnique({
      where: { id: executionId },
      include: {
        site: {
          include: {
            server: {
              select: {
                id: true,
                host: true,
              },
            },
          },
        },
        backup: true,
      },
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    return {
      ...execution,
      diagnosisDetails: JSON.parse(execution.diagnosisDetails),
      suggestedCommands: JSON.parse(execution.suggestedCommands),
      executionLogs: JSON.parse(execution.executionLogs),
      logsAnalyzed: JSON.parse(execution.logsAnalyzed),
    };
  }

  /**
   * Get healing history for a site
   */
  async getHealingHistory(
    siteId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      this.prisma.healer_executions.findMany({
        where: { siteId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.healer_executions.count({
        where: { siteId },
      }),
    ]);

    return {
      data: executions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
