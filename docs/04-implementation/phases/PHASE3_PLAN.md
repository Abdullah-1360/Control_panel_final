# Phase 3: Testing, API Endpoints, and Scheduled Diagnosis

## Status: READY TO START

Phase 2 is complete with all TypeScript errors fixed. Now we proceed to Phase 3.

## Phase 3 Tasks

### 1. Unit Testing (Priority: HIGH)
**Estimated Time**: 8-10 hours

Create unit tests for all check services:
- [ ] MalwareDetectionService.spec.ts
- [ ] SecurityAuditService.spec.ts
- [ ] PerformanceMetricsService.spec.ts
- [ ] DatabaseHealthService.spec.ts
- [ ] UpdateStatusService.spec.ts
- [ ] SeoHealthService.spec.ts
- [ ] BackupStatusService.spec.ts
- [ ] ResourceMonitoringService.spec.ts
- [ ] PluginThemeAnalysisService.spec.ts
- [ ] UptimeMonitoringService.spec.ts
- [ ] UnifiedDiagnosisService.spec.ts

**Test Coverage Target**: >80%

**Test Structure**:
```typescript
describe('MalwareDetectionService', () => {
  let service: MalwareDetectionService;
  let sshExecutor: jest.Mocked<SshExecutorService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MalwareDetectionService,
        {
          provide: SshExecutorService,
          useValue: {
            executeCommand: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MalwareDetectionService>(MalwareDetectionService);
    sshExecutor = module.get(SshExecutorService);
  });

  describe('check', () => {
    it('should detect malware when suspicious files found', async () => {
      // Arrange
      sshExecutor.executeCommand.mockResolvedValue('suspicious.php\nbackdoor.php');

      // Act
      const result = await service.check('server-id', '/path', 'example.com');

      // Assert
      expect(result.status).toBe(CheckStatus.FAIL);
      expect(result.score).toBeLessThan(100);
    });

    it('should pass when no malware found', async () => {
      // Arrange
      sshExecutor.executeCommand.mockResolvedValue('');

      // Act
      const result = await service.check('server-id', '/path', 'example.com');

      // Assert
      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.score).toBe(100);
    });
  });
});
```

### 2. Integration Testing (Priority: HIGH)
**Estimated Time**: 6-8 hours

Create integration tests for UnifiedDiagnosisService:
- [ ] Test FULL profile execution
- [ ] Test LIGHT profile execution
- [ ] Test QUICK profile execution
- [ ] Test CUSTOM profile with specific checks
- [ ] Test caching behavior
- [ ] Test health score calculation
- [ ] Test category score calculation
- [ ] Test diagnosis history storage

**Test File**: `backend/test/healer/unified-diagnosis.integration.spec.ts`

### 3. API Endpoints (Priority: HIGH)
**Estimated Time**: 4-6 hours

Add new endpoints to HealerController:

#### Individual Check Execution
```typescript
@Post('sites/:id/checks/:checkType')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('healer.diagnose')
async executeIndividualCheck(
  @Param('id') siteId: string,
  @Param('checkType') checkType: DiagnosisCheckType,
): Promise<CheckResult> {
  // Execute single check
}
```

#### Get Available Checks
```typescript
@Get('checks')
@UseGuards(JwtAuthGuard)
async getAvailableChecks(): Promise<any[]> {
  // Return all check services with metadata
}
```

#### Get Health Score Trending
```typescript
@Get('sites/:id/health-trending')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('healer.read')
async getHealthTrending(
  @Param('id') siteId: string,
  @Query('days') days?: number,
): Promise<any> {
  // Return health score history with category breakdown
}
```

### 4. Scheduled Diagnosis with BullMQ (Priority: MEDIUM)
**Estimated Time**: 6-8 hours

Implement automated diagnosis scheduling:

#### Create Scheduled Diagnosis Processor
**File**: `backend/src/modules/healer/processors/scheduled-diagnosis.processor.ts`

```typescript
@Processor('scheduled-diagnosis')
export class ScheduledDiagnosisProcessor {
  constructor(
    private readonly unifiedDiagnosis: UnifiedDiagnosisService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('run-diagnosis')
  async handleScheduledDiagnosis(job: Job<{ siteId: string; profile: DiagnosisProfile }>) {
    const { siteId, profile } = job.data;

    // Check if in maintenance window
    const site = await this.prisma.wpSite.findUnique({
      where: { id: siteId },
      select: { maintenanceWindow: true },
    });

    if (this.isInMaintenanceWindow(site.maintenanceWindow)) {
      return { skipped: true, reason: 'maintenance_window' };
    }

    // Run diagnosis
    const result = await this.unifiedDiagnosis.diagnose(siteId, profile, {
      trigger: HealerTrigger.SCHEDULED,
      triggeredBy: 'system',
    });

    // Trigger notifications if issues detected
    if (result.criticalIssues > 0 || result.warningIssues > 0) {
      await this.triggerNotifications(siteId, result);
    }

    return result;
  }

  private isInMaintenanceWindow(window: any): boolean {
    // Check if current time is within maintenance window
    return false; // TODO: Implement
  }

  private async triggerNotifications(siteId: string, result: any): Promise<void> {
    // TODO: Integrate with Module 8 (Notifications)
  }
}
```

#### Add Cron Job for Scheduling
**File**: `backend/src/modules/healer/services/diagnosis-scheduler.service.ts`

```typescript
@Injectable()
export class DiagnosisSchedulerService {
  constructor(
    @InjectQueue('scheduled-diagnosis') private diagnosisQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async scheduleAutoDiagnosis() {
    // Get all sites with auto-diagnosis enabled
    const sites = await this.prisma.wpSite.findMany({
      where: {
        isHealerEnabled: true,
        autoDiagnosisEnabled: true,
      },
      select: {
        id: true,
        autoDiagnosisProfile: true,
      },
    });

    // Queue diagnosis jobs
    for (const site of sites) {
      await this.diagnosisQueue.add('run-diagnosis', {
        siteId: site.id,
        profile: site.autoDiagnosisProfile || DiagnosisProfile.LIGHT,
      });
    }
  }
}
```

### 5. Notification Integration (Priority: MEDIUM)
**Estimated Time**: 4-6 hours

Integrate with Module 8 (Notifications) for alerting:

- [ ] Critical issues detected → Send immediate alert
- [ ] Healing triggered → Send notification
- [ ] Healing failed → Send escalation
- [ ] Health score degradation → Send warning
- [ ] Scheduled diagnosis completed → Send summary (optional)

### 6. Frontend Components (Priority: MEDIUM)
**Estimated Time**: 12-16 hours

Create React components for health dashboard:

#### Health Score Dashboard
**File**: `frontend/src/components/healer/HealthScoreDashboard.tsx`

Features:
- Overall health score gauge (0-100)
- Category breakdown (security, performance, maintenance, SEO, availability)
- Trending chart (last 30 days)
- Recent issues list
- Quick actions (run diagnosis, view history)

#### Check Results View
**File**: `frontend/src/components/healer/CheckResultsView.tsx`

Features:
- List of all checks with status badges
- Expandable details for each check
- Recommendations display
- Re-run individual check button

#### Health Trending Chart
**File**: `frontend/src/components/healer/HealthTrendingChart.tsx`

Features:
- Line chart showing health score over time
- Category score breakdown
- Hover tooltips with details
- Date range selector

### 7. Auto-Healing Workflow (Priority: LOW)
**Estimated Time**: 8-10 hours

Connect check results to healing runbooks:

- [ ] Map check failures to healing actions
- [ ] Implement approval workflow
- [ ] Add rollback support
- [ ] Implement multi-step workflows with pause/resume

### 8. Documentation (Priority: LOW)
**Estimated Time**: 4-6 hours

- [ ] API documentation (Swagger)
- [ ] Check service documentation
- [ ] Integration guide
- [ ] Troubleshooting guide

## Total Estimated Time: 52-70 hours

## Priority Order

1. **Unit Testing** - Ensure code quality and catch bugs early
2. **Integration Testing** - Verify system works end-to-end
3. **API Endpoints** - Enable frontend integration
4. **Scheduled Diagnosis** - Automate monitoring
5. **Notification Integration** - Alert on issues
6. **Frontend Components** - User interface
7. **Auto-Healing Workflow** - Advanced automation
8. **Documentation** - Knowledge transfer

## Success Criteria

- [ ] All unit tests passing with >80% coverage
- [ ] All integration tests passing
- [ ] All API endpoints functional and documented
- [ ] Scheduled diagnosis running every 15 minutes
- [ ] Notifications sent on critical issues
- [ ] Frontend dashboard displaying health scores
- [ ] Auto-healing workflow functional (basic)
- [ ] Documentation complete

## Next Steps

1. Start with unit testing for check services
2. Create integration tests for UnifiedDiagnosisService
3. Add API endpoints to HealerController
4. Implement scheduled diagnosis with BullMQ
5. Integrate notifications
6. Build frontend components
7. Implement auto-healing workflow
8. Write documentation

## Questions to Address

1. Should we implement all tests first, or implement features incrementally with tests?
2. What notification channels should be supported initially (email, Slack, webhook)?
3. Should auto-healing require approval for all actions, or only critical ones?
4. What should be the default diagnosis schedule (every 15 minutes, hourly, custom)?
5. Should we implement predictive alerts based on health score trends?
