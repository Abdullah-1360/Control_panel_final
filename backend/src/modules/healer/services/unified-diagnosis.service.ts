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
import { ErrorLogAnalysisService } from './checks/error-log-analysis.service';
import { HttpStatusService } from './checks/http-status.service';
import { MaintenanceModeService } from './checks/maintenance-mode.service';
import { DatabaseConnectionService } from './checks/database-connection.service';
import { WpVersionService } from './checks/wp-version.service';
import { CoreIntegrityService } from './checks/core-integrity.service';
import { PluginStatusService } from './checks/plugin-status.service';
import { ThemeStatusService } from './checks/theme-status.service';
import { CorrelationEngineService } from './correlation-engine.service';
import { DiagnosisProgressService } from './diagnosis-progress.service';
// New Layer 1 services
import { DnsResolutionService } from './checks/dns-resolution.service';
import { SslCertificateValidationService } from './checks/ssl-certificate-validation.service';
// New comprehensive check services
import { MixedContentDetectionService } from './checks/mixed-content-detection.service';
import { ResponseTimeBaselineService } from './checks/response-time-baseline.service';
import { ChecksumVerificationService } from './checks/checksum-verification.service';
import { TableCorruptionCheckService } from './checks/table-corruption-check.service';
import { LoginAttemptAnalysisService } from './checks/login-attempt-analysis.service';
import { SecurityKeysValidationService } from './checks/security-keys-validation.service';
import { OrphanedTransientsDetectionService } from './checks/orphaned-transients-detection.service';
import { BackdoorDetectionService } from './checks/backdoor-detection.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Unified Diagnosis Service
 * Combines manual and auto diagnosis with profile-based configuration
 * PHASE 2: Integrated with Correlation Engine for root cause analysis
 * PHASE 4: Real-time progress tracking via SSE
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
    private readonly errorLogAnalysis: ErrorLogAnalysisService,
    private readonly httpStatus: HttpStatusService,
    private readonly maintenanceMode: MaintenanceModeService,
    private readonly databaseConnection: DatabaseConnectionService,
    private readonly wpVersion: WpVersionService,
    private readonly coreIntegrity: CoreIntegrityService,
    private readonly pluginStatus: PluginStatusService,
    private readonly themeStatus: ThemeStatusService,
    private readonly correlationEngine: CorrelationEngineService,
    private readonly diagnosisProgress: DiagnosisProgressService,
    // New Layer 1 services
    private readonly dnsResolution: DnsResolutionService,
    private readonly sslCertificateValidation: SslCertificateValidationService,
    // New comprehensive check services
    private readonly mixedContentDetection: MixedContentDetectionService,
    private readonly responseTimeBaseline: ResponseTimeBaselineService,
    private readonly checksumVerification: ChecksumVerificationService,
    private readonly tableCorruptionCheck: TableCorruptionCheckService,
    private readonly loginAttemptAnalysis: LoginAttemptAnalysisService,
    private readonly securityKeysValidation: SecurityKeysValidationService,
    private readonly orphanedTransientsDetection: OrphanedTransientsDetectionService,
    private readonly backdoorDetection: BackdoorDetectionService,
  ) {
    // Initialize check services map
    this.checkServices = new Map<DiagnosisCheckType, IDiagnosisCheckService>([
      // Existing services
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
      [DiagnosisCheckType.ERROR_LOG_ANALYSIS, errorLogAnalysis],
      [DiagnosisCheckType.HTTP_STATUS, httpStatus],
      [DiagnosisCheckType.MAINTENANCE_MODE, maintenanceMode],
      [DiagnosisCheckType.DATABASE_CONNECTION, databaseConnection],
      [DiagnosisCheckType.WP_VERSION, wpVersion],
      [DiagnosisCheckType.CORE_INTEGRITY, coreIntegrity],
      [DiagnosisCheckType.PLUGIN_STATUS, pluginStatus],
      [DiagnosisCheckType.THEME_STATUS, themeStatus],
      
      // New Layer 1: Availability & Accessibility
      [DiagnosisCheckType.DNS_RESOLUTION, dnsResolution],
      [DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION, sslCertificateValidation],
      [DiagnosisCheckType.MIXED_CONTENT_DETECTION, mixedContentDetection],
      [DiagnosisCheckType.RESPONSE_TIME_BASELINE, responseTimeBaseline],
      
      // New Layer 2: Core WordPress Integrity
      [DiagnosisCheckType.CHECKSUM_VERIFICATION, checksumVerification],
      
      // New Layer 3: Configuration Validation
      [DiagnosisCheckType.SECURITY_KEYS_VALIDATION, securityKeysValidation],
      
      // New Layer 4: Database Health
      [DiagnosisCheckType.TABLE_CORRUPTION_CHECK, tableCorruptionCheck],
      [DiagnosisCheckType.ORPHANED_TRANSIENTS_DETECTION, orphanedTransientsDetection],
      
      // New Layer 8: Security Hardening
      [DiagnosisCheckType.LOGIN_ATTEMPT_ANALYSIS, loginAttemptAnalysis],
      [DiagnosisCheckType.BACKDOOR_DETECTION, backdoorDetection],
    ]);
  }

  /**
   * Diagnose a site with specified profile
   * PHASE 4: Real-time progress tracking via SSE
   */
  async diagnose(
    siteId: string,
    profile: DiagnosisProfile = DiagnosisProfile.FULL,
    options: {
      diagnosisId?: string; // Accept diagnosisId from caller
      customChecks?: DiagnosisCheckType[];
      subdomain?: string;
      bypassCache?: boolean;
      triggeredBy?: string;
      trigger?: HealerTrigger;
    } = {},
  ): Promise<DiagnosisResultDto & { diagnosisId?: string }> {
    const startTime = Date.now();
    const diagnosisId = options.diagnosisId || uuidv4(); // Use provided diagnosisId or generate new one
    
    // Get site details
    const site = await this.prisma.applications.findUnique({
      where: { id: siteId },
      include: { servers: true },
    });

    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    // Determine domain and path to diagnose
    let domain = site.domain;
    let sitePath = site.path;
    
    // If subdomain is provided, resolve its path
    if (options.subdomain) {
      domain = options.subdomain;
      
      // Find subdomain path from metadata
      const subdomains = (site.metadata as any)?.availableSubdomains || [];
      const subdomainInfo = subdomains.find((s: any) => s.domain === options.subdomain);
      
      if (subdomainInfo && subdomainInfo.path) {
        sitePath = subdomainInfo.path;
        this.logger.log(`Using subdomain path: ${sitePath} for ${domain}`);
      } else {
        this.logger.warn(`Subdomain ${options.subdomain} not found in metadata, using main path: ${sitePath}`);
      }
    }
    
    // Get profile configuration
    const config = getProfileConfig(profile, options.customChecks);
    
    this.logger.log(
      `Starting ${profile} diagnosis for ${domain} (${config.checks.length} checks) [ID: ${diagnosisId}]`,
    );

    // PHASE 4: Start progress tracking
    this.diagnosisProgress.startDiagnosis(
      diagnosisId,
      siteId,
      domain,
      config.checks.length,
    );

    try {
      // Check cache if enabled and not bypassed
      if (config.useCache && !options.bypassCache) {
        const cached = await this.getCachedResult(
          site.serverId,
          sitePath, // Use resolved sitePath (subdomain or main)
          domain,
          profile,
        );
        
        if (cached) {
          this.logger.log(`Returning cached diagnosis for ${domain}`);
          this.diagnosisProgress.completeDiagnosis(diagnosisId, cached.healthScore);
          return { ...cached, diagnosisId };
        }
      }

      // PHASE 4: Set status to running
      this.diagnosisProgress.setRunning(diagnosisId);

      // Execute checks based on profile with progress tracking
      const checkResults = await this.executeChecksWithProgress(
        diagnosisId,
        site.serverId,
        sitePath, // Use resolved sitePath (subdomain or main)
        domain,
        config.checks,
      );

      // PHASE 4: Set status to correlating
      this.diagnosisProgress.setCorrelating(diagnosisId);

      // PHASE 2: Run correlation analysis on check results
      const correlationResult = await this.correlationEngine.correlateResults(checkResults);

      // Run legacy diagnosis for backward compatibility
      const diagnosisResult = await this.diagnosisService.diagnose(
        site.serverId,
        sitePath, // Use resolved sitePath (subdomain or main)
        domain,
      );

      // Use correlation engine's health score if available, otherwise calculate from checks
      const healthScore = correlationResult.overallHealthScore > 0 
        ? correlationResult.overallHealthScore 
        : this.calculateHealthScoreFromChecks(checkResults);
      
      const categoryScores = this.calculateCategoryScores(checkResults);

      // Build unified result with correlation insights
      const result: DiagnosisResultDto & { diagnosisId?: string } = {
        diagnosisId,
        profile,
        checksRun: config.checks,
        healthScore,
        issuesFound: this.countIssuesFromChecks(checkResults),
        criticalIssues: this.countCriticalIssuesFromChecks(checkResults),
        warningIssues: this.countWarningIssuesFromChecks(checkResults),
        diagnosisType: diagnosisResult.diagnosisType,
        confidence: diagnosisResult.confidence,
        details: {
          ...diagnosisResult.details,
          // PHASE 2: Add correlation insights
          correlation: {
            rootCauses: correlationResult.rootCauses,
            correlationConfidence: correlationResult.correlationConfidence,
            criticalIssuesCount: correlationResult.criticalIssues.length,
          },
        },
        suggestedAction: diagnosisResult.suggestedAction,
        suggestedCommands: diagnosisResult.suggestedCommands,
        // PHASE 2: Use correlation recommendations if available
        recommendations: correlationResult.recommendations.length > 0 
          ? correlationResult.recommendations 
          : diagnosisResult.suggestedCommands,
        canAutoHeal: this.canAutoHeal(diagnosisResult.diagnosisType),
        requiresApproval: site.healingMode !== 'FULL_AUTO',
        checkResults: this.convertCheckResults(checkResults),
        commandOutputs: diagnosisResult.commandOutputs || {}, // Include command outputs from diagnosis
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

      // PHASE 4: Complete progress tracking
      this.logger.log(`[UnifiedDiagnosisService] Calling completeDiagnosis for ${diagnosisId} with healthScore ${healthScore}`);
      this.diagnosisProgress.completeDiagnosis(diagnosisId, healthScore);
      
      // Verify completion was set
      const finalProgress = this.diagnosisProgress.getProgress(diagnosisId);
      this.logger.log(`[UnifiedDiagnosisService] Final progress status: ${finalProgress?.status}, progress: ${finalProgress?.progress}%`);

      this.logger.log(
        `Diagnosis completed for ${domain}: ${diagnosisResult.diagnosisType} (score: ${healthScore}) [ID: ${diagnosisId}]`,
      );

      return result;
    } catch (error) {
      // PHASE 4: Mark diagnosis as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[UnifiedDiagnosisService] Diagnosis error, calling failDiagnosis for ${diagnosisId}: ${errorMessage}`);
      this.diagnosisProgress.failDiagnosis(diagnosisId, errorMessage);
      
      this.logger.error(
        `Diagnosis failed for ${domain}: ${errorMessage} [ID: ${diagnosisId}]`,
        error instanceof Error ? error.stack : undefined,
      );
      
      throw error;
    }
  }

  /**
   * Execute checks based on profile
   * PHASE 4: Enhanced with timeout handling, comprehensive error handling, and parallel execution
   */
  private async executeChecks(
    serverId: string,
    sitePath: string,
    domain: string,
    checks: DiagnosisCheckType[],
  ): Promise<CheckResult[]> {
    // PHASE 4: Task 1.3 - Parallel execution for independent checks
    return await this.executeChecksInParallel(serverId, sitePath, domain, checks);
  }

  /**
   * Execute checks with real-time progress tracking
   * PHASE 4: Real-time progress tracking via SSE
   */
  private async executeChecksWithProgress(
    diagnosisId: string,
    serverId: string,
    sitePath: string,
    domain: string,
    checks: DiagnosisCheckType[],
  ): Promise<CheckResult[]> {
    // Group checks by dependency
    const independentChecks = this.getIndependentChecks(checks);
    const databaseDependentChecks = this.getDatabaseDependentChecks(checks);
    const otherChecks = checks.filter(
      (check) =>
        !independentChecks.includes(check) &&
        !databaseDependentChecks.includes(check),
    );

    this.logger.log(
      `Executing checks: ${independentChecks.length} independent, ${databaseDependentChecks.length} DB-dependent, ${otherChecks.length} other`,
    );

    const allResults: CheckResult[] = [];

    // Execute independent checks in parallel with progress tracking
    const independentResults = await Promise.allSettled(
      independentChecks.map((checkType) =>
        this.executeCheckWithProgressTracking(diagnosisId, serverId, sitePath, domain, checkType),
      ),
    );
    allResults.push(...this.extractResults(independentResults, independentChecks));

    // Execute database-dependent checks in parallel with progress tracking
    const dbResults = await Promise.allSettled(
      databaseDependentChecks.map((checkType) =>
        this.executeCheckWithProgressTracking(diagnosisId, serverId, sitePath, domain, checkType),
      ),
    );
    allResults.push(...this.extractResults(dbResults, databaseDependentChecks));

    // Execute remaining checks sequentially with progress tracking
    const otherResults = await Promise.allSettled(
      otherChecks.map((checkType) =>
        this.executeCheckWithProgressTracking(diagnosisId, serverId, sitePath, domain, checkType),
      ),
    );
    allResults.push(...this.extractResults(otherResults, otherChecks));

    return allResults;
  }

  /**
   * Execute a single check with progress tracking
   * PHASE 4: Real-time progress tracking via SSE
   */
  private async executeCheckWithProgressTracking(
    diagnosisId: string,
    serverId: string,
    sitePath: string,
    domain: string,
    checkType: DiagnosisCheckType,
  ): Promise<CheckResult> {
    const service = this.checkServices.get(checkType);
    
    if (!service) {
      this.logger.warn(`No service found for check type: ${checkType}`);
      return this.createErrorResult(checkType, 'Service not registered', Date.now());
    }

    // Notify check started
    this.diagnosisProgress.checkStarted(
      diagnosisId,
      checkType,
      service.getName(),
      this.getCategoryForCheck(checkType),
    );

    const startTime = Date.now();
    
    try {
      // Execute check with timeout
      const result = await this.executeCheckWithTimeout(
        serverId,
        sitePath,
        domain,
        checkType,
      );

      // Notify check completed
      this.diagnosisProgress.checkCompleted(
        diagnosisId,
        checkType,
        result.status as 'PASS' | 'FAIL' | 'WARNING' | 'ERROR',
        result.message,
        result.duration,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      // Notify check failed
      this.diagnosisProgress.checkCompleted(
        diagnosisId,
        checkType,
        'ERROR',
        errorMessage,
        duration,
      );

      return this.createErrorResult(checkType, errorMessage, startTime);
    }
  }

  /**
   * Get category for a check type
   */
  private getCategoryForCheck(checkType: DiagnosisCheckType): string {
    const categoryMap: Partial<Record<DiagnosisCheckType, string>> = {
      [DiagnosisCheckType.MALWARE_DETECTION]: 'SECURITY',
      [DiagnosisCheckType.SECURITY_AUDIT]: 'SECURITY',
      [DiagnosisCheckType.CORE_INTEGRITY]: 'SECURITY',
      [DiagnosisCheckType.PERFORMANCE_METRICS]: 'PERFORMANCE',
      [DiagnosisCheckType.DATABASE_HEALTH]: 'PERFORMANCE',
      [DiagnosisCheckType.RESOURCE_MONITORING]: 'PERFORMANCE',
      [DiagnosisCheckType.UPDATE_STATUS]: 'MAINTENANCE',
      [DiagnosisCheckType.BACKUP_STATUS]: 'MAINTENANCE',
      [DiagnosisCheckType.PLUGIN_THEME_ANALYSIS]: 'MAINTENANCE',
      [DiagnosisCheckType.PLUGIN_STATUS]: 'MAINTENANCE',
      [DiagnosisCheckType.THEME_STATUS]: 'MAINTENANCE',
      [DiagnosisCheckType.WP_VERSION]: 'MAINTENANCE',
      [DiagnosisCheckType.SEO_HEALTH]: 'SEO',
      [DiagnosisCheckType.UPTIME_MONITORING]: 'AVAILABILITY',
      [DiagnosisCheckType.HTTP_STATUS]: 'AVAILABILITY',
      [DiagnosisCheckType.DATABASE_CONNECTION]: 'AVAILABILITY',
      [DiagnosisCheckType.MAINTENANCE_MODE]: 'CONFIGURATION',
      [DiagnosisCheckType.ERROR_LOG_ANALYSIS]: 'SYSTEM',
    };

    return categoryMap[checkType] || 'SYSTEM';
  }

  /**
   * Extract results from Promise.allSettled results
   */
  private extractResults(
    results: PromiseSettledResult<CheckResult>[],
    checkTypes: DiagnosisCheckType[],
  ): CheckResult[] {
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const checkType = checkTypes[index];
        this.logger.error(
          `Check ${checkType} promise rejected: ${result.reason}`,
        );
        return this.createErrorResult(
          checkType,
          result.reason?.message || 'Promise rejected',
          Date.now(),
        );
      }
    });
  }

  /**
   * Execute checks in parallel where possible
   * PHASE 4: Task 1.3 - Parallel check execution
   */
  private async executeChecksInParallel(
    serverId: string,
    sitePath: string,
    domain: string,
    checks: DiagnosisCheckType[],
  ): Promise<CheckResult[]> {
    // Group checks by dependency
    const independentChecks = this.getIndependentChecks(checks);
    const databaseDependentChecks = this.getDatabaseDependentChecks(checks);
    const otherChecks = checks.filter(
      (check) =>
        !independentChecks.includes(check) &&
        !databaseDependentChecks.includes(check),
    );

    this.logger.log(
      `Executing checks: ${independentChecks.length} independent, ${databaseDependentChecks.length} DB-dependent, ${otherChecks.length} other`,
    );

    // Execute independent checks in parallel
    const independentResults = await Promise.allSettled(
      independentChecks.map((checkType) =>
        this.executeCheckWithTimeout(serverId, sitePath, domain, checkType),
      ),
    );

    // Execute database-dependent checks in parallel (after DB connection verified)
    const dbResults = await Promise.allSettled(
      databaseDependentChecks.map((checkType) =>
        this.executeCheckWithTimeout(serverId, sitePath, domain, checkType),
      ),
    );

    // Execute remaining checks sequentially
    const otherResults = await Promise.allSettled(
      otherChecks.map((checkType) =>
        this.executeCheckWithTimeout(serverId, sitePath, domain, checkType),
      ),
    );

    // Combine all results
    const allResults = [
      ...independentResults,
      ...dbResults,
      ...otherResults,
    ];

    // Extract successful results and handle failures
    return allResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle rejected promise
        const checkType = [
          ...independentChecks,
          ...databaseDependentChecks,
          ...otherChecks,
        ][index];
        
        this.logger.error(
          `Check ${checkType} promise rejected: ${result.reason}`,
        );

        return this.createErrorResult(
          checkType,
          result.reason?.message || 'Promise rejected',
          Date.now(),
        );
      }
    });
  }

  /**
   * Get list of checks that can run independently (no dependencies)
   */
  private getIndependentChecks(
    checks: DiagnosisCheckType[],
  ): DiagnosisCheckType[] {
    const independent = [
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.SSL_CERTIFICATE,
      DiagnosisCheckType.DISK_SPACE,
      DiagnosisCheckType.MEMORY_LIMIT,
      DiagnosisCheckType.FILE_PERMISSIONS,
      DiagnosisCheckType.HTACCESS,
      DiagnosisCheckType.WP_CONFIG,
      DiagnosisCheckType.PHP_ERRORS,
      DiagnosisCheckType.APACHE_NGINX_LOGS,
      DiagnosisCheckType.CORE_INTEGRITY,
      DiagnosisCheckType.WP_VERSION,
      DiagnosisCheckType.MAINTENANCE_MODE,
      DiagnosisCheckType.PERFORMANCE_METRICS,
      DiagnosisCheckType.RESOURCE_MONITORING,
      DiagnosisCheckType.ERROR_LOG_ANALYSIS,
    ];

    return checks.filter((check) => independent.includes(check));
  }

  /**
   * Get list of checks that depend on database connection
   */
  private getDatabaseDependentChecks(
    checks: DiagnosisCheckType[],
  ): DiagnosisCheckType[] {
    const dbDependent = [
      DiagnosisCheckType.DATABASE_CONNECTION,
      DiagnosisCheckType.DATABASE_HEALTH,
      DiagnosisCheckType.PLUGIN_STATUS,
      DiagnosisCheckType.THEME_STATUS,
      DiagnosisCheckType.UPDATE_STATUS,
      DiagnosisCheckType.PLUGIN_THEME_ANALYSIS,
      DiagnosisCheckType.MALWARE_DETECTION, // Needs DB for content injection check
      DiagnosisCheckType.SECURITY_AUDIT,
      DiagnosisCheckType.SEO_HEALTH,
      DiagnosisCheckType.BACKUP_STATUS,
      DiagnosisCheckType.UPTIME_MONITORING,
    ];

    return checks.filter((check) => dbDependent.includes(check));
  }

  /**
   * Execute a single check with timeout and comprehensive error handling
   * PHASE 4: Task 1.6 - Comprehensive error handling
   * PHASE 4: Task 1.4 - Caching for expensive checks
   */
  private async executeCheckWithTimeout(
    serverId: string,
    sitePath: string,
    domain: string,
    checkType: DiagnosisCheckType,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const checkTimeout = 60000; // 60 seconds per check

    try {
      const service = this.checkServices.get(checkType);

      if (!service) {
        this.logger.warn(`No service found for check type: ${checkType}`);
        return this.createErrorResult(
          checkType,
          'Service not registered',
          startTime,
        );
      }

      // PHASE 4: Task 1.4 - Check cache for expensive checks
      const cachedResult = await this.getCheckCache(
        serverId,
        sitePath,
        domain,
        checkType,
      );

      if (cachedResult) {
        this.logger.debug(`Using cached result for check ${checkType}`);
        return {
          ...cachedResult,
          timestamp: new Date(), // Update timestamp
        };
      }

      // Execute check with timeout
      const result = await Promise.race([
        service.check(serverId, sitePath, domain),
        this.createTimeoutPromise(checkTimeout, checkType),
      ]);

      // Log successful execution
      this.logger.debug(
        `Check ${checkType} completed in ${result.duration}ms with status ${result.status}`,
      );

      // PHASE 4: Task 1.4 - Cache expensive checks
      await this.cacheCheckResult(
        serverId,
        sitePath,
        domain,
        checkType,
        result,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      // Determine if it's a timeout error
      const isTimeout = errorMessage.includes('timed out');

      if (isTimeout) {
        this.logger.error(
          `Check ${checkType} timed out after ${duration}ms`,
        );
      } else {
        this.logger.error(
          `Check ${checkType} failed after ${duration}ms: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      return this.createErrorResult(checkType, errorMessage, startTime);
    }
  }

  /**
   * Get cached check result if available
   * PHASE 4: Task 1.4 - Caching for expensive checks
   */
  private async getCheckCache(
    serverId: string,
    sitePath: string,
    domain: string,
    checkType: DiagnosisCheckType,
  ): Promise<CheckResult | null> {
    // Only cache expensive checks
    const expensiveChecks = [
      DiagnosisCheckType.CORE_INTEGRITY, // WordPress core checksums
      DiagnosisCheckType.PLUGIN_THEME_ANALYSIS, // Vulnerability scans
      DiagnosisCheckType.MALWARE_DETECTION, // Malware scanning
    ];

    if (!expensiveChecks.includes(checkType)) {
      return null;
    }

    try {
      // Use a special profile value for check-level caching
      const cacheProfile = DiagnosisProfile.CUSTOM; // Use CUSTOM profile for check caching
      
      const cached = await this.prisma.diagnosis_cache.findUnique({
        where: {
          serverId_sitePath_domain_profile: {
            serverId,
            sitePath,
            domain,
            profile: cacheProfile,
          },
        },
      });

      if (!cached) {
        return null;
      }

      // Check if cache is still valid
      const now = new Date();
      if (cached.expiresAt < now) {
        // Cache expired, delete it
        await this.prisma.diagnosis_cache.delete({
          where: {
            serverId_sitePath_domain_profile: {
              serverId,
              sitePath,
              domain,
              profile: cacheProfile,
            },
          },
        });
        return null;
      }

      // Parse and return cached result
      // Store check type in result to identify which check is cached
      const cachedData = cached.result as any;
      if (cachedData && cachedData.checkType === checkType) {
        return cachedData as CheckResult;
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get check cache for ${checkType}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Cache check result for expensive checks
   * PHASE 4: Task 1.4 - Caching for expensive checks
   */
  private async cacheCheckResult(
    serverId: string,
    sitePath: string,
    domain: string,
    checkType: DiagnosisCheckType,
    result: CheckResult,
  ): Promise<void> {
    // Define cache TTL for expensive checks
    const cacheTTLMap: Record<string, number> = {
      [DiagnosisCheckType.CORE_INTEGRITY]: 86400, // 24 hours
      [DiagnosisCheckType.PLUGIN_THEME_ANALYSIS]: 21600, // 6 hours
      [DiagnosisCheckType.MALWARE_DETECTION]: 3600, // 1 hour
    };

    const cacheTTL = cacheTTLMap[checkType];
    if (!cacheTTL) {
      return; // Don't cache this check
    }

    try {
      const cacheProfile = DiagnosisProfile.CUSTOM; // Use CUSTOM profile for check caching
      const expiresAt = new Date(Date.now() + cacheTTL * 1000);

      await this.prisma.diagnosis_cache.upsert({
        where: {
          serverId_sitePath_domain_profile: {
            serverId,
            sitePath,
            domain,
            profile: cacheProfile,
          },
        },
        create: {
          serverId,
          sitePath,
          domain,
          profile: cacheProfile,
          result: result as any,
          expiresAt,
        },
        update: {
          result: result as any,
          expiresAt,
          lastAccessedAt: new Date(),
          hitCount: {
            increment: 1,
          },
        },
      });

      this.logger.debug(
        `Cached check ${checkType} result for ${cacheTTL}s`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cache check result for ${checkType}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise(
    timeoutMs: number,
    checkType: DiagnosisCheckType,
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Check ${checkType} timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
    });
  }

  /**
   * Create an error result for a failed check
   */
  private createErrorResult(
    checkType: DiagnosisCheckType,
    errorMessage: string,
    startTime: number,
  ): CheckResult {
    const duration = Date.now() - startTime;
    const isTimeout = errorMessage.includes('timed out');

    return {
      checkType,
      status: CheckStatus.ERROR,
      score: 0,
      message: isTimeout
        ? `Check timed out: ${errorMessage}`
        : `Check failed: ${errorMessage}`,
      details: {
        error: errorMessage,
        isTimeout,
        duration,
      },
      recommendations: isTimeout
        ? [
            'Check may be taking too long due to server load',
            'Verify SSH connection is stable',
            'Consider increasing timeout for this check',
          ]
        : [
            'Retry the check',
            'Verify server connectivity',
            'Check server logs for more details',
          ],
      duration,
      timestamp: new Date(),
    };
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
        diagnosisDetails: result as any, // Store complete result including checkResults
        commandOutputs: result.commandOutputs || {}, // Include command outputs if available
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

    // Update applications table (new universal table)
    await this.prisma.applications.update({
      where: { id: siteId },
      data: {
        healthScore,
        healthStatus,
        lastHealthCheck: new Date(),
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
      const site = await this.prisma.applications.findUnique({
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
