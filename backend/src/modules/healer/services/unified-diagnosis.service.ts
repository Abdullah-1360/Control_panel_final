import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiagnosisService } from './diagnosis.service';
import {
  DiagnosisProfile,
  DiagnosisCheckType,
} from '../enums/diagnosis-profile.enum';
import { getProfileConfig } from '../config/diagnosis-profiles.config';
import { DiagnosisResultDto, DiagnosisCheckResult } from '../dto/diagnose-site.dto';
import { DiagnosisType, HealerTrigger } from '@prisma/client';
import { IDiagnosisCheckService, CheckResult, CheckStatus, CheckPriority } from '../interfaces/diagnosis-check.interface';
import { MalwareDetectionService } from './checks/malware-detection.service';
import { SecurityAuditService } from './checks/security-audit.service';
import { PerformanceMetricsService } from './checks/performance-metrics.service';
import { DatabaseHealthService } from './checks/database-health.service';
import { UpdateStatusService } from './checks/update-status.service';
import { SeoHealthService } from './checks/seo-health.service';
import { BackupStatusService } from './checks/backup-status.service';
import { ResourceMonitoringService } from './checks/resource-monitoring.service';
import { PluginThemeAnalysisService } from './checks/plugin-theme-analysis.service';
import { UptimeMonitoringService } from './checks/uptime-monitoring.service';

/**
 * Unified Diagnosis Service
 * Combines manual and auto diagnosis with profile-based configuration
 */
@Injectable()
export class UnifiedDiagnosisService {
  private readonly logger = new Logger(UnifiedDiagnosisService.name);
  private readonly checkServices: Map<DiagnosisCheckType, IDiagnosisCheckService>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisService: DiagnosisService,
    private readonly malwareDetection: MalwareDetectionService,
    private readonly securityAudit: SecurityAuditService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly databaseHealth: DatabaseHealthService,
    private readonly updateStatus: UpdateStatusService,
    private readonly seoHealth: SeoHealthService,
    private readonly backupStatus: BackupStatusService,
    private readonly resourceMonitoring: ResourceMonitoringService,
    private readonly pluginThemeAnalysis: PluginThemeAnalysisService,
    private readonly uptimeMonitoring: UptimeMonitoringService,
  ) {
    // Initialize check services map
    this.checkServices = new Map<DiagnosisCheckType, IDiagnosisCheckService>([
      [DiagnosisCheckType.MALWARE_DETECTION, malwareDetection],
      [DiagnosisCheckType.SECURITY_AUDIT, securityAudit],
      [DiagnosisCheckType.PERFORMANCE_METRICS, performanceMetrics],
      [DiagnosisCheckType.DATABASE_HEALTH, databaseHealth],
      [DiagnosisCheckType.UPDATE_STATUS, updateStatus],
      [DiagnosisCheckType.SEO_HEALTH, seoHealth],
      [DiagnosisCheckType.BACKUP_STATUS, backupStatus],
      [DiagnosisCheckType.RESOURCE_MONITORING, resourceMonitoring],
      [DiagnosisCheckType.PLUGIN_THEME_ANALYSIS, pluginThemeAnalysis],
      [DiagnosisCheckType.UPTIME_MONITORING, uptimeMonitoring],
    ]);
  }

  /**
   * Diagnose a site with specified profile
   */
  async diagnose(
    siteId: string,
    profile: DiagnosisProfile = DiagnosisProfile.FULL,
    options: {
      customChecks?: DiagnosisCheckType[];
      subdomain?: string;
      bypassCache?: boolean;
      triggeredBy?: string;
      trigger?: HealerTrigger;
    } = {},
  ): Promise<DiagnosisResultDto> {
    const startTime = Date.now();
    
    // Get site details
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
      include: { servers: true },
    });

    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    // Determine domain to diagnose
    const domain = options.subdomain || site.domain;
    
    // Get profile configuration
    const config = getProfileConfig(profile, options.customChecks);
    
    this.logger.log(
      `Starting ${profile} diagnosis for ${domain} (${config.checks.length} checks)`,
    );

    // Check cache if enabled and not bypassed
    if (config.useCache && !options.bypassCache) {
      const cached = await this.getCachedResult(
        site.serverId,
        site.path,
        domain,
        profile,
      );
      
      if (cached) {
        this.logger.log(`Returning cached diagnosis for ${domain}`);
        return cached;
      }
    }

    // Execute checks based on profile
    const checkResults = await this.executeChecks(
      site.serverId,
      site.path,
      domain,
      config.checks,
    );

    // Run legacy diagnosis for backward compatibility
    const diagnosisResult = await this.diagnosisService.diagnose(
      site.serverId,
      site.path,
      domain,
    );

    // Calculate health score from check results
    const healthScore = this.calculateHealthScoreFromChecks(checkResults);
    const categoryScores = this.calculateCategoryScores(checkResults);

    // Build unified result
    const result: DiagnosisResultDto = {
      profile,
      checksRun: config.checks,
      healthScore,
      issuesFound: this.countIssuesFromChecks(checkResults),
      criticalIssues: this.countCriticalIssuesFromChecks(checkResults),
      warningIssues: this.countWarningIssuesFromChecks(checkResults),
      diagnosisType: diagnosisResult.diagnosisType,
      confidence: diagnosisResult.confidence,
      details: diagnosisResult.details,
      suggestedAction: diagnosisResult.suggestedAction,
      suggestedCommands: diagnosisResult.suggestedCommands,
      canAutoHeal: this.canAutoHeal(diagnosisResult.diagnosisType),
      requiresApproval: site.healingMode !== 'FULL_AUTO',
      checkResults: this.convertCheckResults(checkResults),
      duration: Date.now() - startTime,
      timestamp: new Date(),
      cached: false,
    };

    // Save to history
    await this.saveToHistory(siteId, domain, result, options);

    // Update site health status
    await this.updateSiteHealth(siteId, healthScore, diagnosisResult.diagnosisType);

    // Save health score history with category scores
    await this.saveHealthScoreHistory(siteId, result.healthScore, this.getHealthStatus(healthScore, diagnosisResult.diagnosisType), categoryScores);

    // Cache result if enabled
    if (config.useCache) {
      await this.cacheResult(
        site.serverId,
        site.path,
        domain,
        profile,
        result,
        config.cacheTTL,
      );
    }

    this.logger.log(
      `Diagnosis completed for ${domain}: ${diagnosisResult.diagnosisType} (score: ${healthScore})`,
    );

    return result;
  }

  /**
   * Execute checks based on profile
   */
  private async executeChecks(
    serverId: string,
    sitePath: string,
    domain: string,
    checks: DiagnosisCheckType[],
  ): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    for (const checkType of checks) {
      const service = this.checkServices.get(checkType);
      
      if (!service) {
        this.logger.warn(`No service found for check type: ${checkType}`);
        continue;
      }

      try {
        const result = await service.check(serverId, sitePath, domain);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Check ${checkType} failed: ${errorMessage}`);
        results.push({
          checkType,
          status: CheckStatus.ERROR,
          score: 0,
          message: `Check failed: ${errorMessage}`,
          details: { error: errorMessage },
          duration: 0,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Calculate health score from check results
   */
  private calculateHealthScoreFromChecks(checkResults: CheckResult[]): number {
    if (checkResults.length === 0) return 100;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const result of checkResults) {
      const service = this.checkServices.get(result.checkType);
      if (!service) continue;

      const priority = service.getPriority();
      
      // Weight by priority: CRITICAL=3x, HIGH=2x, MEDIUM=1x, LOW=0.5x
      const weight = priority === CheckPriority.CRITICAL ? 3 :
                     priority === CheckPriority.HIGH ? 2 :
                     priority === CheckPriority.MEDIUM ? 1 : 0.5;

      totalWeightedScore += result.score * weight;
      totalWeight += weight;
    }

    return Math.round(totalWeightedScore / totalWeight);
  }

  /**
   * Calculate category scores from check results
   */
  private calculateCategoryScores(checkResults: CheckResult[]): any {
    const categories = {
      security: [] as number[],
      performance: [] as number[],
      maintenance: [] as number[],
      seo: [] as number[],
      availability: [] as number[],
    };

    // Map check types to categories
    const categoryMap: Partial<Record<DiagnosisCheckType, keyof typeof categories>> = {
      [DiagnosisCheckType.MALWARE_DETECTION]: 'security',
      [DiagnosisCheckType.SECURITY_AUDIT]: 'security',
      [DiagnosisCheckType.PERFORMANCE_METRICS]: 'performance',
      [DiagnosisCheckType.DATABASE_HEALTH]: 'performance',
      [DiagnosisCheckType.UPDATE_STATUS]: 'maintenance',
      [DiagnosisCheckType.BACKUP_STATUS]: 'maintenance',
      [DiagnosisCheckType.PLUGIN_THEME_ANALYSIS]: 'maintenance',
      [DiagnosisCheckType.SEO_HEALTH]: 'seo',
      [DiagnosisCheckType.RESOURCE_MONITORING]: 'availability',
      [DiagnosisCheckType.UPTIME_MONITORING]: 'availability',
      [DiagnosisCheckType.HTTP_STATUS]: 'availability',
      [DiagnosisCheckType.CORE_INTEGRITY]: 'security',
      [DiagnosisCheckType.LOG_ANALYSIS]: 'maintenance',
    };

    for (const result of checkResults) {
      const category = categoryMap[result.checkType];
      if (category) {
        categories[category].push(result.score);
      }
    }

    // Calculate average for each category
    return {
      security: categories.security.length > 0 
        ? Math.round(categories.security.reduce((a, b) => a + b, 0) / categories.security.length)
        : 100,
      performance: categories.performance.length > 0
        ? Math.round(categories.performance.reduce((a, b) => a + b, 0) / categories.performance.length)
        : 100,
      maintenance: categories.maintenance.length > 0
        ? Math.round(categories.maintenance.reduce((a, b) => a + b, 0) / categories.maintenance.length)
        : 100,
      seo: categories.seo.length > 0
        ? Math.round(categories.seo.reduce((a, b) => a + b, 0) / categories.seo.length)
        : 100,
      availability: categories.availability.length > 0
        ? Math.round(categories.availability.reduce((a, b) => a + b, 0) / categories.availability.length)
        : 100,
    };
  }

  /**
   * Convert CheckResult[] to DiagnosisCheckResult[]
   */
  private convertCheckResults(checkResults: CheckResult[]): DiagnosisCheckResult[] {
    return checkResults.map(result => ({
      checkType: result.checkType,
      status: result.status as 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED',
      message: result.message,
      duration: result.duration,
      details: result.details,
      recommendations: result.recommendations,
    }));
  }

  /**
   * Count issues from check results
   */
  private countIssuesFromChecks(checkResults: CheckResult[]): number {
    return checkResults.filter(r => r.status === CheckStatus.FAIL || r.status === CheckStatus.WARNING).length;
  }

  /**
   * Count critical issues from check results
   */
  private countCriticalIssuesFromChecks(checkResults: CheckResult[]): number {
    return checkResults.filter(r => {
      const service = this.checkServices.get(r.checkType);
      return r.status === CheckStatus.FAIL && service?.getPriority() === CheckPriority.CRITICAL;
    }).length;
  }

  /**
   * Count warning issues from check results
   */
  private countWarningIssuesFromChecks(checkResults: CheckResult[]): number {
    return checkResults.filter(r => r.status === CheckStatus.WARNING).length;
  }

  /**
   * Get cached diagnosis result
   */
  private async getCachedResult(
    serverId: string,
    sitePath: string,
    domain: string,
    profile: DiagnosisProfile,
  ): Promise<DiagnosisResultDto | null> {
    const cached = await this.prisma.diagnosis_cache.findUnique({
      where: {
        serverId_sitePath_domain_profile: {
          serverId,
          sitePath,
          domain,
          profile,
        },
      },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      // Delete expired cache
      await this.prisma.diagnosis_cache.delete({
        where: { id: cached.id },
      });
      return null;
    }

    // Update hit count and last accessed
    await this.prisma.diagnosis_cache.update({
      where: { id: cached.id },
      data: {
        hitCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    const result = cached.result as any;
    result.cached = true;
    result.cacheExpiresAt = cached.expiresAt;

    return result;
  }

  /**
   * Cache diagnosis result
   */
  private async cacheResult(
    serverId: string,
    sitePath: string,
    domain: string,
    profile: DiagnosisProfile,
    result: DiagnosisResultDto,
    cacheTTL: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + cacheTTL * 1000);

    await this.prisma.diagnosis_cache.upsert({
      where: {
        serverId_sitePath_domain_profile: {
          serverId,
          sitePath,
          domain,
          profile,
        },
      },
      create: {
        serverId,
        sitePath,
        domain,
        profile,
        result: result as any,
        healthScore: result.healthScore,
        expiresAt,
      },
      update: {
        result: result as any,
        healthScore: result.healthScore,
        expiresAt,
        hitCount: 0,
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * Save diagnosis to history
   */
  private async saveToHistory(
    siteId: string,
    domain: string,
    result: DiagnosisResultDto,
    options: any,
  ): Promise<void> {
    await this.prisma.diagnosis_history.create({
      data: {
        siteId,
        subdomain: options.subdomain || null,
        domain,
        profile: result.profile,
        checksRun: result.checksRun,
        diagnosisType: result.diagnosisType as DiagnosisType,
        healthScore: result.healthScore,
        issuesFound: result.issuesFound,
        criticalIssues: result.criticalIssues,
        warningIssues: result.warningIssues,
        diagnosisDetails: result as any,
        commandOutputs: {}, // Will be populated from diagnosisResult
        duration: result.duration,
        triggeredBy: options.triggeredBy || null,
        trigger: options.trigger || HealerTrigger.MANUAL,
      },
    });
  }

  /**
   * Save health score history for trending
   */
  private async saveHealthScoreHistory(
    siteId: string,
    score: number,
    status: string,
    categoryScores: any,
  ): Promise<void> {
    await this.prisma.health_score_history.create({
      data: {
        siteId,
        score,
        profile: DiagnosisProfile.FULL, // Default profile
        availabilityScore: categoryScores.availability || 100,
        performanceScore: categoryScores.performance || 100,
        securityScore: categoryScores.security || 100,
        integrityScore: 100, // TODO: Calculate from core integrity checks
        maintenanceScore: categoryScores.maintenance || 100,
      },
    });
  }

  /**
   * Update site health status
   */
  private async updateSiteHealth(
    siteId: string,
    healthScore: number,
    diagnosisType: string,
  ): Promise<void> {
    const healthStatus = this.getHealthStatus(healthScore, diagnosisType);

    await this.prisma.wp_sites.update({
      where: { id: siteId },
      data: {
        healthScore,
        healthStatus,
        lastHealthCheck: new Date(),
        lastDiagnosedAt: new Date(),
      },
    });
  }

  /**
   * Calculate health score (0-100)
   */
  private calculateHealthScore(diagnosisResult: any, checks: DiagnosisCheckType[]): number {
    // Base score
    let score = 100;

    // Deduct points based on diagnosis type
    const deductions: Record<string, number> = {
      WSOD: 50,
      DB_ERROR: 40,
      MAINTENANCE: 30,
      INTEGRITY: 35,
      PERMISSION: 20,
      CACHE: 10,
      PLUGIN_CONFLICT: 25,
      THEME_CONFLICT: 25,
      MEMORY_EXHAUSTION: 30,
      SYNTAX_ERROR: 40,
      HEALTHY: 0,
      UNKNOWN: 15,
    };

    score -= deductions[diagnosisResult.diagnosisType] || 0;

    // Deduct points for failed checks
    // TODO: Implement check-specific scoring

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get health status from score
   */
  private getHealthStatus(score: number, diagnosisType: string): 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'MAINTENANCE' | 'HEALING' | 'UNKNOWN' {
    if (diagnosisType === 'HEALTHY') return 'HEALTHY';
    if (diagnosisType === 'MAINTENANCE') return 'MAINTENANCE';
    if (score >= 80) return 'HEALTHY';
    if (score >= 60) return 'DEGRADED';
    if (score >= 40) return 'DEGRADED';
    return 'DOWN';
  }

  /**
   * Count total issues
   */
  private countIssues(diagnosisResult: any): number {
    // TODO: Implement proper issue counting
    return diagnosisResult.diagnosisType === 'HEALTHY' ? 0 : 1;
  }

  /**
   * Count critical issues
   */
  private countCriticalIssues(diagnosisResult: any): number {
    const criticalTypes = ['WSOD', 'DB_ERROR', 'SYNTAX_ERROR', 'MEMORY_EXHAUSTION'];
    return criticalTypes.includes(diagnosisResult.diagnosisType) ? 1 : 0;
  }

  /**
   * Count warning issues
   */
  private countWarningIssues(diagnosisResult: any): number {
    const warningTypes = ['CACHE', 'PERMISSION', 'MAINTENANCE'];
    return warningTypes.includes(diagnosisResult.diagnosisType) ? 1 : 0;
  }

  /**
   * Check if diagnosis type can be auto-healed
   */
  private canAutoHeal(diagnosisType: string): boolean {
    const autoHealable = ['MAINTENANCE', 'CACHE', 'WSOD', 'PLUGIN_CONFLICT'];
    return autoHealable.includes(diagnosisType);
  }

  /**
   * Build check results from diagnosis
   */
  private buildCheckResults(
    diagnosisResult: any,
    checks: DiagnosisCheckType[],
  ): DiagnosisCheckResult[] {
    // TODO: Implement proper check result building from commandOutputs
    return checks.map(checkType => ({
      checkType,
      status: 'PASS' as const,
      message: 'Check completed',
      duration: 0,
    }));
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<number> {
    const result = await this.prisma.diagnosis_cache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired cache entries`);
    return result.count;
  }

  /**
   * Get diagnosis history for a site
   */
  async getDiagnosisHistory(
    siteId: string,
    options: {
      profile?: DiagnosisProfile;
      limit?: number;
      page?: number;
    } = {},
  ): Promise<{
    data: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const limit = options.limit || 20;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const where: any = { siteId };
    if (options.profile) {
      where.profile = options.profile;
    }

    const [history, total] = await Promise.all([
      this.prisma.diagnosis_history.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.diagnosis_history.count({ where }),
    ]);

    return {
      data: history,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get health score history for trending
   */
  async getHealthScoreHistory(
    siteId: string,
    options: {
      days?: number;
      profile?: DiagnosisProfile;
    } = {},
  ): Promise<any[]> {
    const days = options.days || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = {
      siteId,
      createdAt: { gte: since },
    };

    if (options.profile) {
      where.profile = options.profile;
    }

    return this.prisma.health_score_history.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get available diagnosis profiles
   */
  async getAvailableProfiles(): Promise<any[]> {
    return Object.values(DiagnosisProfile).map((profile) => {
      const config = getProfileConfig(profile as DiagnosisProfile);
      return {
        profile,
        description: config.description,
        checksCount: config.checks.length,
        timeout: config.timeout,
        useCache: config.useCache,
        cacheTTL: config.cacheTTL,
      };
    });
  }

  /**
   * Clear diagnosis cache
   */
  async clearCache(
    siteId?: string,
    profile?: DiagnosisProfile,
  ): Promise<number> {
    const where: any = {};

    if (siteId) {
      // Get site to find serverId
      const site = await this.prisma.wp_sites.findUnique({
        where: { id: siteId },
        select: { serverId: true },
      });

      if (site) {
        where.serverId = site.serverId;
      }
    }

    if (profile) {
      where.profile = profile;
    }

    const result = await this.prisma.diagnosis_cache.deleteMany({ where });
    return result.count;
  }
}
