/**
 * Tech Stack Aware Healing Orchestrator
 * 
 * Phase 1: Core Infrastructure
 * - Auto-heal validation (isHealerEnabled check)
 * - Tech stack routing
 * - Intelligent backup strategy
 * - Domain-aware healing
 */

import { Injectable, Logger } from '@nestjs/common';
import { HealerTrigger, HealingMode, TechStack } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { IntelligentBackupService } from './intelligent-backup.service';
import { DomainAwareHealingService } from './domain-aware-healing.service';
import { WordPressHealingService } from './wordpress-healing.service';

interface HealingResult {
  success: boolean;
  message: string;
  actions: HealingAction[];
  metadata?: Record<string, any>;
}

interface HealingAction {
  type: string;
  description: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface ITechStackHealingService {
  heal(
    application: any,
    diagnosis: any,
    trigger: HealerTrigger,
    triggeredBy: string
  ): Promise<HealingResult>;
  
  canHandle(techStack: TechStack): boolean;
}

@Injectable()
export class TechStackAwareHealingOrchestratorService {
  private readonly logger = new Logger(TechStackAwareHealingOrchestratorService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligentBackup: IntelligentBackupService,
    private readonly domainAwareHealing: DomainAwareHealingService,
    // Tech-stack-specific healing services
    private readonly wordpressHealing: WordPressHealingService,
    // TODO: Add other tech-stack services
    // private readonly nodejsHealing: NodeJsHealingService,
    // private readonly laravelHealing: LaravelHealingService,
    // etc.
  ) {}
  
  /**
   * Main healing entry point with auto-heal validation
   */
  async heal(
    applicationId: string,
    trigger: HealerTrigger,
    triggeredBy: string,
    options?: {
      subdomain?: string;
      customCommands?: string[];
    }
  ): Promise<HealingResult> {
    const startTime = Date.now();
    
    this.logger.log(
      `Healing request for application ${applicationId} (trigger: ${trigger}, by: ${triggeredBy})`
    );
    
    // 1. Get application with tech stack
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { 
        servers: true,
        site_tech_stack: true
      }
    });
    
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    // 2. AUTO-HEAL VALIDATION
    const canAutoHeal = await this.validateAutoHeal(app, trigger);
    if (!canAutoHeal) {
      // Save failed execution to history
      await this.saveHealingExecution({
        applicationId,
        trigger,
        triggeredBy,
        status: 'FAILED',
        errorMessage: `Auto-heal is disabled for ${app.domain}. Enable healing or trigger manually.`,
        diagnosticResults: {},
        healthScore: null,
        healingPlan: { autoHeal: [], requireApproval: [], cannotHeal: [] },
        actionsExecuted: [],
        executionLogs: JSON.stringify([{
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: 'Auto-heal validation failed'
        }]),
        startedAt: new Date(),
        completedAt: new Date()
      });
      
      return {
        success: false,
        message: `Auto-heal is disabled for ${app.domain}. Enable healing or trigger manually.`,
        actions: [],
        metadata: {
          isHealerEnabled: app.isHealerEnabled,
          healingMode: app.healingMode,
          trigger
        }
      };
    }
    
    // 3. Get latest diagnosis
    const latestDiagnosis = await this.getLatestDiagnosis(applicationId, options?.subdomain);
    
    if (!latestDiagnosis) {
      throw new Error('No recent diagnosis found - run diagnosis first');
    }
    
    // 4. Analyze domain context (main/subdomain/addon)
    const domainContext = await this.domainAwareHealing.analyzeDomainContext(
      applicationId,
      options?.subdomain || app.domain
    );
    
    this.logger.log(
      `Domain context: ${domainContext.type} (isolation: ${domainContext.isolationLevel})`
    );
    
    // 5. Determine backup strategy based on disk space
    const backupStrategy = await this.intelligentBackup.determineBackupStrategy(
      app.serverId,
      domainContext.path,
      latestDiagnosis.checkResults || []
    );
    
    this.logger.log(
      `Backup strategy: ${backupStrategy.type} (${backupStrategy.reason})`
    );
    
    // 6. Create backup if needed
    let backupId: string | null = null;
    let backupCreated = false;
    if (backupStrategy.type !== 'SKIP') {
      backupId = await this.intelligentBackup.createIntelligentBackup(
        app.serverId,
        domainContext.path,
        backupStrategy
      );
      
      if (backupId) {
        backupCreated = true;
        this.logger.log(`Backup created: ${backupId}`);
      }
    }
    
    const executionLogs: any[] = [{
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Healing started (trigger: ${trigger})`
    }, {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Domain context: ${domainContext.type} (${domainContext.isolationLevel})`
    }, {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Backup strategy: ${backupStrategy.type}`
    }];
    
    if (backupCreated) {
      executionLogs.push({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Backup created: ${backupId}`
      });
    }
    
    try {
      // 7. Route to tech-stack-specific healing service
      const healingService = this.getHealingService(app.techStack);
      
      // 8. Execute tech-stack-specific healing
      const healingResult = await healingService.heal(
        app,
        latestDiagnosis,
        trigger,
        triggeredBy
      );
      
      executionLogs.push({
        timestamp: new Date().toISOString(),
        level: healingResult.success ? 'INFO' : 'ERROR',
        message: healingResult.message
      });
      
      // 9. Save healing execution to history
      const execution = await this.saveHealingExecution({
        applicationId,
        trigger,
        triggeredBy,
        status: healingResult.success ? 'SUCCESS' : 'FAILED',
        errorMessage: healingResult.success ? null : healingResult.message,
        diagnosticResults: latestDiagnosis.diagnosisDetails,
        healthScore: latestDiagnosis.healthScore,
        healingPlan: {
          autoHeal: [],
          requireApproval: [],
          cannotHeal: []
        },
        actionsExecuted: healingResult.actions,
        executionLogs: JSON.stringify(executionLogs),
        backupCreated,
        backupPath: backupId,
        startedAt: new Date(startTime),
        healedAt: new Date(),
        completedAt: new Date()
      });
      
      // 10. Update application health status
      await this.updateApplicationHealth(applicationId, healingResult);
      
      // 11. Check cascade healing for related domains
      if (domainContext.type === 'main' && healingResult.success) {
        await this.checkCascadeHealing(applicationId, app.domain, healingResult);
      }
      
      return {
        ...healingResult,
        metadata: {
          ...healingResult.metadata,
          executionId: execution.id,
          backupId,
          backupStrategy: backupStrategy.type,
          domainContext: {
            type: domainContext.type,
            isolationLevel: domainContext.isolationLevel
          },
          duration: Date.now() - startTime
        }
      };
      
    } catch (error) {
      const err = error as Error;
      
      executionLogs.push({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: `Healing failed: ${err.message}`
      });
      
      // Save failed execution
      await this.saveHealingExecution({
        applicationId,
        trigger,
        triggeredBy,
        status: 'FAILED',
        errorMessage: err.message,
        diagnosticResults: latestDiagnosis.diagnosisDetails,
        healthScore: latestDiagnosis.healthScore,
        healingPlan: {
          autoHeal: [],
          requireApproval: [],
          cannotHeal: []
        },
        actionsExecuted: [],
        executionLogs: JSON.stringify(executionLogs),
        backupCreated,
        backupPath: backupId,
        startedAt: new Date(startTime),
        completedAt: new Date()
      });
      
      throw error;
    }
  }
  
  /**
   * AUTO-HEAL VALIDATION
   * 
   * Rules:
   * - MANUAL trigger: Always allowed (user explicitly requested)
   * - SEMI_AUTO trigger: Check isHealerEnabled
   * - FULL_AUTO trigger: Check isHealerEnabled
   * - SEARCH trigger: Check isHealerEnabled
   */
  private async validateAutoHeal(
    application: any,
    trigger: HealerTrigger
  ): Promise<boolean> {
    // Manual triggers always allowed (user explicitly requested)
    if (trigger === HealerTrigger.MANUAL) {
      this.logger.log(`Manual trigger - bypassing auto-heal check`);
      return true;
    }
    
    // For automated triggers, check if healer is enabled
    if (!application.isHealerEnabled) {
      this.logger.warn(
        `Auto-heal disabled for ${application.domain} (trigger: ${trigger})`
      );
      return false;
    }
    
    this.logger.log(
      `Auto-heal enabled for ${application.domain} (mode: ${application.healingMode})`
    );
    return true;
  }
  
  /**
   * Get latest diagnosis for application
   */
  private async getLatestDiagnosis(
    applicationId: string,
    subdomain?: string
  ): Promise<any> {
    const diagnosis = await this.prisma.diagnosis_history.findFirst({
      where: {
        siteId: applicationId,
        subdomain: subdomain || null
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    
    if (!diagnosis) {
      return null;
    }
    
    return {
      ...diagnosis,
      diagnosisDetails: JSON.parse(diagnosis.diagnosisDetails as string),
      commandOutputs: JSON.parse(diagnosis.commandOutputs as string),
      checkResults: (JSON.parse(diagnosis.diagnosisDetails as string) as any).checkResults || []
    };
  }
  
  /**
   * Route to tech-stack-specific healing service
   */
  private getHealingService(techStack: TechStack): ITechStackHealingService {
    switch (techStack) {
      case TechStack.WORDPRESS:
        return this.wordpressHealing;
        
      case TechStack.NODEJS:
        // return this.nodejsHealing;
        throw new Error('Node.js healing service not yet implemented');
        
      case TechStack.LARAVEL:
        // return this.laravelHealing;
        throw new Error('Laravel healing service not yet implemented');
        
      case TechStack.NEXTJS:
        // return this.nextjsHealing;
        throw new Error('Next.js healing service not yet implemented');
        
      case TechStack.EXPRESS:
        // return this.expressHealing;
        throw new Error('Express healing service not yet implemented');
        
      case TechStack.PHP_GENERIC:
        // return this.phpGenericHealing;
        throw new Error('PHP Generic healing service not yet implemented');
        
      case TechStack.MYSQL:
        // return this.mysqlHealing;
        throw new Error('MySQL healing service not yet implemented');
        
      default:
        throw new Error(`Unsupported tech stack: ${techStack}`);
    }
  }
  
  /**
   * Update application health status after healing
   */
  private async updateApplicationHealth(
    applicationId: string,
    healingResult: HealingResult
  ): Promise<void> {
    const healthStatus = healingResult.success ? 'HEALTHY' : 'DEGRADED';
    
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        healthStatus,
        lastHealingAttempt: new Date(),
        currentHealingAttempts: healingResult.success ? 0 : { increment: 1 }
      }
    });
  }
  
  /**
   * Check if cascade healing is needed for related domains
   */
  private async checkCascadeHealing(
    applicationId: string,
    healedDomain: string,
    healingResult: HealingResult
  ): Promise<void> {
    // Check if healing affected shared resources
    const affectsSharedResources = this.checkSharedResourceHealing(
      healingResult.actions
    );
    
    if (!affectsSharedResources) {
      return; // No cascade needed
    }
    
    this.logger.log(
      `Healing affected shared resources - checking cascade for ${healedDomain}`
    );
    
    // TODO: Trigger diagnosis for related domains
    // This will be implemented when we integrate with DiagnosisQueueService
  }
  
  /**
   * Check if healing actions affected shared resources
   */
  private checkSharedResourceHealing(actions: HealingAction[]): boolean {
    const sharedResourceActions = [
      'PLUGIN_DEACTIVATE',
      'PLUGIN_UPDATE',
      'THEME_SWITCH',
      'THEME_UPDATE',
      'DATABASE_REPAIR',
      'CORE_UPDATE'
    ];
    
    return actions.some(action => 
      sharedResourceActions.includes(action.type)
    );
  }
  
  /**
   * Save healing execution to database for history tracking
   */
  private async saveHealingExecution(data: {
    applicationId: string;
    trigger: HealerTrigger;
    triggeredBy: string;
    status: string;
    errorMessage: string | null;
    diagnosticResults: any;
    healthScore: number | null;
    healingPlan: any;
    actionsExecuted: any[];
    executionLogs: string;
    backupCreated?: boolean;
    backupPath?: string | null;
    startedAt: Date;
    diagnosedAt?: Date;
    approvedAt?: Date;
    healedAt?: Date;
    completedAt?: Date;
  }): Promise<any> {
    return this.prisma.healing_executions_new.create({
      data: {
        applicationId: data.applicationId,
        trigger: data.trigger,
        triggeredBy: data.triggeredBy,
        status: data.status as any,
        errorMessage: data.errorMessage,
        diagnosticResults: JSON.stringify(data.diagnosticResults),
        healthScore: data.healthScore,
        healingPlan: JSON.stringify(data.healingPlan),
        approvedActions: [],
        actionsExecuted: JSON.stringify(data.actionsExecuted),
        executionLogs: data.executionLogs,
        backupCreated: data.backupCreated || false,
        backupPath: data.backupPath,
        startedAt: data.startedAt,
        diagnosedAt: data.diagnosedAt,
        approvedAt: data.approvedAt,
        healedAt: data.healedAt,
        completedAt: data.completedAt
      }
    });
  }
  
  /**
   * Get healing history for an application
   */
  async getHealingHistory(
    applicationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    
    const [executions, total] = await Promise.all([
      this.prisma.healing_executions_new.findMany({
        where: { applicationId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          applications: {
            select: {
              domain: true,
              techStack: true,
              healthStatus: true
            }
          }
        }
      }),
      this.prisma.healing_executions_new.count({
        where: { applicationId }
      })
    ]);
    
    // Parse JSON fields
    const parsedExecutions = executions.map(exec => ({
      ...exec,
      diagnosticResults: JSON.parse(exec.diagnosticResults as string),
      healingPlan: JSON.parse(exec.healingPlan as string),
      actionsExecuted: JSON.parse(exec.actionsExecuted as string),
      executionLogs: JSON.parse(exec.executionLogs)
    }));
    
    return {
      data: parsedExecutions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Get single healing execution with full details
   */
  async getHealingExecution(executionId: string): Promise<any> {
    const execution = await this.prisma.healing_executions_new.findUnique({
      where: { id: executionId },
      include: {
        applications: {
          include: {
            servers: {
              select: {
                id: true,
                host: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!execution) {
      throw new Error(`Healing execution ${executionId} not found`);
    }
    
    return {
      ...execution,
      diagnosticResults: JSON.parse(execution.diagnosticResults as string),
      healingPlan: JSON.parse(execution.healingPlan as string),
      actionsExecuted: JSON.parse(execution.actionsExecuted as string),
      executionLogs: JSON.parse(execution.executionLogs)
    };
  }
}
