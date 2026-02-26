import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
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

@Module({
  imports: [
    ServersModule, // Import Module 2 for SSH functionality
    ScheduleModule.forRoot(), // For cron jobs in MetricsService
    BullModule.registerQueue({
      name: 'healer-jobs',
    }),
  ],
  controllers: [HealerController],
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
  ],
  exports: [HealerService, UnifiedDiagnosisService],
})
export class HealerModule {}
