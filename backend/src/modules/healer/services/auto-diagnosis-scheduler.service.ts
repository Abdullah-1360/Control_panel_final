import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiagnosisQueueService } from './diagnosis-queue.service';
import { AuditService } from '../../audit/audit.service';
import { DiagnosisProfile } from '@prisma/client';

/**
 * Auto-Diagnosis Scheduler Service
 * 
 * CONTINUOUS DIAGNOSIS CYCLE:
 * 1. Phase 1: Diagnose all undiagnosed sites (healthScore = 0 or null)
 * 2. Phase 2: Re-diagnose all sites (oldest diagnosis first)
 * 3. Repeat cycle continuously
 * 
 * FEATURES:
 * - Gradual processing (5 sites per run to prevent server flooding)
 * - Priority-based: Undiagnosed sites first, then oldest diagnosed sites
 * - Extensible: Easy to add new phases, priorities, or conditions
 * - Robust: Handles errors gracefully, tracks progress
 */
@Injectable()
export class AutoDiagnosisSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AutoDiagnosisSchedulerService.name);
  private isRunning = false;
  private currentPhase: 'UNDIAGNOSED' | 'RE_DIAGNOSIS' = 'UNDIAGNOSED';
  private cycleNumber = 0;

  // Configuration (easily extensible)
  private readonly config = {
    BATCH_SIZE: 5, // Sites per scheduler run
    ENABLE_RE_DIAGNOSIS: true, // Enable continuous re-diagnosis
    RE_DIAGNOSIS_INTERVAL_HOURS: 24, // Re-diagnose sites older than 24 hours
    PHASES: {
      UNDIAGNOSED: {
        priority: 1,
        description: 'Sites never diagnosed or with health score 0',
      },
      RE_DIAGNOSIS: {
        priority: 2,
        description: 'Sites with outdated diagnosis (oldest first)',
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisQueue: DiagnosisQueueService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    // Run once on startup (after 30 seconds to let system stabilize)
    setTimeout(() => {
      this.logger.log('🚀 Starting auto-diagnosis scheduler...');
      this.logger.log(`Configuration: Batch size=${this.config.BATCH_SIZE}, Re-diagnosis=${this.config.ENABLE_RE_DIAGNOSIS ? 'enabled' : 'disabled'}`);
      this.checkAndTriggerDiagnosis();
    }, 30000);
  }

  /**
   * Run every hour to check for sites needing diagnosis
   * Processes only 5 sites per run to prevent server flooding
   * Cron expression: 0 * * * * (every hour at minute 0)
   */
  @Cron('0 * * * *', {
    name: 'auto-diagnosis-check',
    timeZone: 'UTC',
  })
  async scheduledCheck() {
    this.logger.log('⏰ Running scheduled auto-diagnosis check...');
    await this.checkAndTriggerDiagnosis();
  }

  /**
   * Main diagnosis orchestrator
   * Implements continuous diagnosis cycle with phases
   */
  async checkAndTriggerDiagnosis(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('⚠️  Auto-diagnosis check already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      // Phase 1: Check for undiagnosed sites
      const undiagnosedSites = await this.getUndiagnosedSites();
      
      if (undiagnosedSites.length > 0) {
        this.currentPhase = 'UNDIAGNOSED';
        this.logger.log(`📋 Phase 1: Found ${undiagnosedSites.length} undiagnosed sites`);
        await this.processSites(undiagnosedSites, 'UNDIAGNOSED');
        return;
      }

      // Phase 2: Re-diagnose sites (if enabled)
      if (this.config.ENABLE_RE_DIAGNOSIS) {
        const sitesForReDiagnosis = await this.getSitesForReDiagnosis();
        
        if (sitesForReDiagnosis.length > 0) {
          this.currentPhase = 'RE_DIAGNOSIS';
          
          // Check if this is a new cycle
          const isNewCycle = await this.isStartOfNewCycle();
          if (isNewCycle) {
            this.cycleNumber++;
            this.logger.log(`🔄 Starting new diagnosis cycle #${this.cycleNumber}`);
            
            // Log cycle start
            await this.auditService.log({
              action: 'AUTO_DIAGNOSIS_CYCLE_START',
              resource: 'SYSTEM',
              resourceId: 'auto-diagnosis-scheduler',
              description: `Starting diagnosis cycle #${this.cycleNumber} - re-diagnosing all WordPress sites`,
              metadata: {
                cycleNumber: this.cycleNumber,
                totalSites: await this.getTotalWordPressSites(),
                batchSize: this.config.BATCH_SIZE,
                reDiagnosisInterval: this.config.RE_DIAGNOSIS_INTERVAL_HOURS,
                timestamp: new Date().toISOString(),
              },
              severity: 'INFO',
              actorType: 'SYSTEM',
            });
          }
          
          this.logger.log(`🔄 Phase 2: Re-diagnosing ${sitesForReDiagnosis.length} sites (cycle #${this.cycleNumber})`);
          await this.processSites(sitesForReDiagnosis, 'RE_DIAGNOSIS');
          return;
        }
      }

      // No sites to process
      this.logger.log('✅ All WordPress sites are up to date');
      
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Auto-diagnosis check failed: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get undiagnosed WordPress sites
   * Priority: Sites never diagnosed or with health score 0/null
   * IMPORTANT: Only returns WORDPRESS sites
   */
  private async getUndiagnosedSites() {
    return this.prisma.applications.findMany({
      where: {
        techStack: 'WORDPRESS', // ONLY WordPress sites
        OR: [
          { lastHealthCheck: null }, // Never diagnosed
          { healthScore: 0 }, // Health score is 0
          { healthScore: null }, // Health score is null
        ],
      },
      select: {
        id: true,
        domain: true,
        path: true, // Include path for validation
        metadata: true,
        healthScore: true,
        lastHealthCheck: true,
        createdAt: true,
        techStack: true, // Include for logging
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
      take: this.config.BATCH_SIZE,
    });
  }

  /**
   * Get sites for re-diagnosis
   * Priority: Sites with oldest diagnosis first
   * IMPORTANT: Only returns WORDPRESS sites
   */
  private async getSitesForReDiagnosis() {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.config.RE_DIAGNOSIS_INTERVAL_HOURS);

    return this.prisma.applications.findMany({
      where: {
        techStack: 'WORDPRESS', // ONLY WordPress sites
        lastHealthCheck: {
          not: null,
          lt: cutoffTime, // Diagnosed more than X hours ago
        },
        AND: [
          { healthScore: { not: null } },
          { healthScore: { not: 0 } },
        ],
      },
      select: {
        id: true,
        domain: true,
        path: true, // Include path for validation
        metadata: true,
        healthScore: true,
        lastHealthCheck: true,
        createdAt: true,
        techStack: true, // Include for logging
      },
      orderBy: {
        lastHealthCheck: 'asc', // Oldest diagnosis first
      },
      take: this.config.BATCH_SIZE,
    });
  }

  /**
   * Process a batch of sites
   */
  private async processSites(
    sites: any[],
    phase: 'UNDIAGNOSED' | 'RE_DIAGNOSIS',
  ): Promise<void> {
    let triggered = 0;
    let failed = 0;
    let skipped = 0;

    for (const app of sites) {
      // Validate this is actually a WordPress site
      if (app.techStack !== 'WORDPRESS') {
        this.logger.warn(
          `⚠️  Skipping ${app.domain} - not a WordPress site (techStack: ${app.techStack})`,
        );
        skipped++;
        continue;
      }

      // Additional validation: check path doesn't look suspicious
      if (app.path === '/root' || app.path === '/root/' || app.path === '/' || !app.path) {
        this.logger.warn(
          `⚠️  Skipping ${app.domain} - suspicious path: ${app.path}`,
        );
        skipped++;
        continue;
      }

      const metadata = app.metadata as any;
      const subdomains = metadata?.availableSubdomains || [];
      const totalDomains = 1 + subdomains.length;

      try {
        const phaseLabel = phase === 'UNDIAGNOSED' ? '🆕 NEW' : '🔄 RE-DIAGNOSIS';
        this.logger.log(
          `${phaseLabel}: Triggering diagnosis for ${app.domain} at ${app.path} (${totalDomains} domain${totalDomains > 1 ? 's' : ''})`,
        );

        const result = await this.diagnosisQueue.enqueueDiagnosisForAllDomains(
          app.id,
          DiagnosisProfile.FULL,
          'SYSTEM', // Triggered by system
        );

        this.logger.log(
          `✅ Enqueued: ${result.batchId} for ${app.domain}`,
        );

        // Create audit log
        await this.auditService.log({
          action: 'AUTO_DIAGNOSIS_SCHEDULED',
          resource: 'APPLICATION',
          resourceId: app.id,
          description: `Auto-triggered ${phase === 'UNDIAGNOSED' ? 'initial' : 're-'} diagnosis for ${totalDomains} domain${totalDomains > 1 ? 's' : ''}`,
          metadata: {
            applicationId: app.id,
            domain: app.domain,
            totalDomains,
            batchId: result.batchId,
            jobCount: result.totalDomains,
            trigger: 'SCHEDULER',
            phase,
            cycleNumber: this.cycleNumber,
            reason: phase === 'UNDIAGNOSED' 
              ? 'Undiagnosed WordPress site' 
              : `Re-diagnosis (last check: ${app.lastHealthCheck?.toISOString()})`,
            lastHealthCheck: app.lastHealthCheck?.toISOString(),
            currentHealthScore: app.healthScore,
          },
          severity: 'INFO',
          actorType: 'SYSTEM',
        });

        triggered++;
      } catch (error: any) {
        this.logger.error(
          `❌ Failed to trigger diagnosis for ${app.domain}: ${error.message}`,
        );
        failed++;
      }
    }

    // Get remaining counts
    const remainingUndiagnosed = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        OR: [
          { lastHealthCheck: null },
          { healthScore: 0 },
          { healthScore: null },
        ],
      },
    });

    const remainingForReDiagnosis = this.config.ENABLE_RE_DIAGNOSIS
      ? await this.prisma.applications.count({
          where: {
            techStack: 'WORDPRESS',
            lastHealthCheck: {
              not: null,
              lt: new Date(Date.now() - this.config.RE_DIAGNOSIS_INTERVAL_HOURS * 60 * 60 * 1000),
            },
            AND: [
              { healthScore: { not: null } },
              { healthScore: { not: 0 } },
            ],
          },
        })
      : 0;

    this.logger.log(
      `📊 Summary: ${triggered} triggered, ${failed} failed, ${skipped} skipped | Remaining: ${remainingUndiagnosed} undiagnosed, ${remainingForReDiagnosis} for re-diagnosis`,
    );

    // Create summary audit log
    if (triggered > 0 || skipped > 0) {
      await this.auditService.log({
        action: 'AUTO_DIAGNOSIS_BATCH_COMPLETED',
        resource: 'SYSTEM',
        resourceId: 'auto-diagnosis-scheduler',
        description: `Completed auto-diagnosis batch: ${triggered} sites processed, ${skipped} skipped`,
        metadata: {
          phase,
          cycleNumber: this.cycleNumber,
          totalProcessed: sites.length,
          triggered,
          failed,
          skipped,
          remainingUndiagnosed,
          remainingForReDiagnosis,
          batchSize: this.config.BATCH_SIZE,
          timestamp: new Date().toISOString(),
        },
        severity: 'INFO',
        actorType: 'SYSTEM',
      });
    }
  }

  /**
   * Check if this is the start of a new cycle
   * (First re-diagnosis after all sites have been diagnosed)
   */
  private async isStartOfNewCycle(): Promise<boolean> {
    // Check if this is the first site in re-diagnosis phase
    const totalSites = await this.getTotalWordPressSites();
    const diagnosedSites = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        lastHealthCheck: { not: null },
        AND: [
          { healthScore: { not: null } },
          { healthScore: { not: 0 } },
        ],
      },
    });

    // If all sites are diagnosed and we're about to start re-diagnosis
    return totalSites === diagnosedSites && this.currentPhase === 'RE_DIAGNOSIS';
  }

  /**
   * Get total WordPress sites count
   */
  private async getTotalWordPressSites(): Promise<number> {
    return this.prisma.applications.count({
      where: { techStack: 'WORDPRESS' },
    });
  }

  /**
   * Get current scheduler status (for monitoring/admin)
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    currentPhase: string;
    cycleNumber: number;
    config: any;
    stats: {
      totalSites: number;
      undiagnosed: number;
      diagnosed: number;
      needsReDiagnosis: number;
    };
  }> {
    const totalSites = await this.getTotalWordPressSites();
    
    const undiagnosed = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        OR: [
          { lastHealthCheck: null },
          { healthScore: 0 },
          { healthScore: null },
        ],
      },
    });

    const diagnosed = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        lastHealthCheck: { not: null },
        AND: [
          { healthScore: { not: null } },
          { healthScore: { not: 0 } },
        ],
      },
    });

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.config.RE_DIAGNOSIS_INTERVAL_HOURS);

    const needsReDiagnosis = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        lastHealthCheck: {
          not: null,
          lt: cutoffTime,
        },
        AND: [
          { healthScore: { not: null } },
          { healthScore: { not: 0 } },
        ],
      },
    });

    return {
      isRunning: this.isRunning,
      currentPhase: this.currentPhase,
      cycleNumber: this.cycleNumber,
      config: this.config,
      stats: {
        totalSites,
        undiagnosed,
        diagnosed,
        needsReDiagnosis,
      },
    };
  }

  /**
   * Manually trigger the check (for testing or admin use)
   */
  async triggerManualCheck(): Promise<{
    triggered: number;
    failed: number;
    phase: string;
    remainingUndiagnosed: number;
    remainingForReDiagnosis: number;
  }> {
    this.logger.log('🔧 Manual auto-diagnosis check triggered');
    
    const beforeUndiagnosed = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        OR: [
          { lastHealthCheck: null },
          { healthScore: 0 },
          { healthScore: null },
        ],
      },
    });

    await this.checkAndTriggerDiagnosis();

    const afterUndiagnosed = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        OR: [
          { lastHealthCheck: null },
          { healthScore: 0 },
          { healthScore: null },
        ],
      },
    });

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.config.RE_DIAGNOSIS_INTERVAL_HOURS);

    const remainingForReDiagnosis = await this.prisma.applications.count({
      where: {
        techStack: 'WORDPRESS',
        lastHealthCheck: {
          not: null,
          lt: cutoffTime,
        },
        AND: [
          { healthScore: { not: null } },
          { healthScore: { not: 0 } },
        ],
      },
    });

    return {
      triggered: beforeUndiagnosed - afterUndiagnosed,
      failed: 0,
      phase: this.currentPhase,
      remainingUndiagnosed: afterUndiagnosed,
      remainingForReDiagnosis,
    };
  }
}
