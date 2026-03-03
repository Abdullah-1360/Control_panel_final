import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullModule as BullMQModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { HealerController } from './healer.controller';
import { HealerService } from './healer.service';
import { SiteDiscoveryService } from './services/site-discovery.service';
import { LogAnalysisService } from './services/log-analysis.service';
import { DiagnosisService } from './services/diagnosis.service';
import { UnifiedDiagnosisService } from './services/unified-diagnosis.service';
import { HealingOrchestratorService } from './services/healing-orchestrator.service';
import { BackupService } from './services/backup.service';
import { WpCliService } from './services/wp-cli.service';
import { SSHExecutorService } from './services/ssh-executor.service';
import { PatternLearningService } from './services/pattern-learning.service';
import { ManualDiagnosisService } from './services/manual-diagnosis.service';
import { HealingProcessor } from './processors/healing.processor';
import { WsodHealerRunbook } from './runbooks/wsod-healer.runbook';
import { MaintenanceHealerRunbook } from './runbooks/maintenance-healer.runbook';
import { PrismaService } from './stubs/prisma.service.stub';
import { ServersModule } from '../servers/servers.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../../common/events/events.module';
// Phase 1: Intelligence Services
import { VerificationService } from './services/verification.service';
import { MetricsService } from './services/metrics.service';
import { RetryService } from './services/retry.service';
import { SecurityService } from './services/security.service';
// Phase 2: Check services
import { MalwareDetectionService } from './services/checks/malware-detection.service';
import { SecurityAuditService } from './services/checks/security-audit.service';
import { PerformanceMetricsService } from './services/checks/performance-metrics.service';
import { DatabaseHealthService } from './services/checks/database-health.service';
import { UpdateStatusService } from './services/checks/update-status.service';
import { SeoHealthService } from './services/checks/seo-health.service';
import { BackupStatusService } from './services/checks/backup-status.service';
import { ResourceMonitoringService } from './services/checks/resource-monitoring.service';
import { PluginThemeAnalysisService } from './services/checks/plugin-theme-analysis.service';
import { UptimeMonitoringService } from './services/checks/uptime-monitoring.service';
// Phase 3: Error Log Analysis
import { ErrorLogAnalysisService } from './services/checks/error-log-analysis.service';
// Phase 4: Additional Check Services
import { HttpStatusService } from './services/checks/http-status.service';
import { MaintenanceModeService } from './services/checks/maintenance-mode.service';
import { DatabaseConnectionService } from './services/checks/database-connection.service';
import { WpVersionService } from './services/checks/wp-version.service';
import { CoreIntegrityService } from './services/checks/core-integrity.service';
import { PluginStatusService } from './services/checks/plugin-status.service';
import { ThemeStatusService } from './services/checks/theme-status.service';
// Real-Time Progress Tracking
import { DiagnosisProgressService } from './services/diagnosis-progress.service';
// Phase 2: Correlation Engine
import { CorrelationEngineService } from './services/correlation-engine.service';
// New comprehensive check services
import { DnsResolutionService } from './services/checks/dns-resolution.service';
import { SslCertificateValidationService } from './services/checks/ssl-certificate-validation.service';
import { MixedContentDetectionService } from './services/checks/mixed-content-detection.service';
import { ResponseTimeBaselineService } from './services/checks/response-time-baseline.service';
import { ChecksumVerificationService } from './services/checks/checksum-verification.service';
import { TableCorruptionCheckService } from './services/checks/table-corruption-check.service';
import { LoginAttemptAnalysisService } from './services/checks/login-attempt-analysis.service';
import { SecurityKeysValidationService } from './services/checks/security-keys-validation.service';
import { OrphanedTransientsDetectionService } from './services/checks/orphaned-transients-detection.service';
import { BackdoorDetectionService } from './services/checks/backdoor-detection.service';
// Universal Healer: Core Services
import { ApplicationService } from './services/application.service';
import { PluginRegistryService } from './services/plugin-registry.service';
import { TechStackDetectorService } from './services/tech-stack-detector.service';
import { HealingStrategyEngineService } from './services/healing-strategy-engine.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { BackupRollbackService } from './services/backup-rollback.service';
// Universal Healer: Discovery Queue System
import { DiscoveryQueueService } from './services/discovery-queue.service';
import { DiscoveryProcessor } from './processors/discovery.processor';
import { MetadataCollectionProcessor } from './processors/metadata-collection.processor';
import { SubdomainDetectionProcessor } from './processors/subdomain-detection.processor';
import { TechStackDetectionProcessor } from './processors/techstack-detection.processor';
// Universal Healer: Plugins
import { NodeJsPlugin } from './plugins/nodejs.plugin';
import { LaravelPlugin } from './plugins/laravel.plugin';
import { PhpGenericPlugin } from './plugins/php-generic.plugin';
import { ExpressPlugin } from './plugins/express.plugin';
import { NextJsPlugin } from './plugins/nextjs.plugin';
import { MySQLPlugin } from './plugins/mysql.plugin';
import { WordPressPlugin } from './plugins/wordpress.plugin';
// Universal Healer: Controllers
import { ApplicationController } from './controllers/application.controller';

@Module({
  imports: [
    ServersModule, // Import Module 2 for SSH functionality
    AuditModule, // Import audit module for logging
    EventsModule, // Import events module for SSE
    ScheduleModule.forRoot(), // For cron jobs in MetricsService
    BullModule.registerQueue({
      name: 'healer-jobs',
    }),
    BullMQModule.registerQueue({
      name: 'healer-discovery',
    }),
    BullMQModule.registerQueue({
      name: 'healer-metadata-collection',
    }),
    BullMQModule.registerQueue({
      name: 'healer-subdomain-detection',
    }),
    BullMQModule.registerQueue({
      name: 'healer-techstack-detection',
    }),
  ],
  controllers: [
    HealerController,
    ApplicationController, // Universal Healer
  ],
  providers: [
    // Stub services (TODO: Remove when actual modules are integrated)
    PrismaService,
    // Healer services
    HealerService,
    SiteDiscoveryService,
    LogAnalysisService,
    DiagnosisService,
    UnifiedDiagnosisService, // Phase 1: Unified diagnosis with profiles
    HealingOrchestratorService,
    BackupService,
    WpCliService,
    SSHExecutorService, // Real SSH executor using Module 2
    PatternLearningService, // Self-learning automation
    ManualDiagnosisService, // Manual diagnosis with learning
    HealingProcessor,
    WsodHealerRunbook,
    MaintenanceHealerRunbook,
    // Phase 1: Intelligence Services
    VerificationService,
    MetricsService,
    RetryService,
    SecurityService,
    // Phase 2: Check services (all 10 checks)
    MalwareDetectionService,
    SecurityAuditService,
    PerformanceMetricsService,
    DatabaseHealthService,
    UpdateStatusService,
    SeoHealthService,
    BackupStatusService,
    ResourceMonitoringService,
    PluginThemeAnalysisService,
    UptimeMonitoringService,
    // Phase 3: Error Log Analysis
    ErrorLogAnalysisService,
    // Phase 4: Additional Check Services
    HttpStatusService,
    MaintenanceModeService,
    DatabaseConnectionService,
    WpVersionService,
    CoreIntegrityService,
    PluginStatusService,
    ThemeStatusService,
    // Real-Time Progress Tracking
    DiagnosisProgressService,
    // Phase 2: Correlation Engine
    CorrelationEngineService,
    // New comprehensive check services
    DnsResolutionService,
    SslCertificateValidationService,
    MixedContentDetectionService,
    ResponseTimeBaselineService,
    ChecksumVerificationService,
    TableCorruptionCheckService,
    LoginAttemptAnalysisService,
    SecurityKeysValidationService,
    OrphanedTransientsDetectionService,
    BackdoorDetectionService,
    // Universal Healer: Core Services
    ApplicationService,
    PluginRegistryService,
    TechStackDetectorService,
    HealingStrategyEngineService,
    CircuitBreakerService,
    BackupRollbackService,
    // Universal Healer: Discovery Queue System
    DiscoveryQueueService,
    DiscoveryProcessor,
    MetadataCollectionProcessor,
    SubdomainDetectionProcessor,
    TechStackDetectionProcessor,
    // Universal Healer: Plugins
    NodeJsPlugin,
    LaravelPlugin,
    PhpGenericPlugin,
    ExpressPlugin,
    NextJsPlugin,
    MySQLPlugin,
    WordPressPlugin,
  ],
  exports: [HealerService, UnifiedDiagnosisService, ApplicationService, DiscoveryQueueService],
})
export class HealerModule {}
