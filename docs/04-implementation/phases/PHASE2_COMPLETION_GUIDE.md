# Phase 2 Completion Guide

## Current Status: 50% Complete (5 of 10 checks implemented)

## ✅ Implemented Checks
1. Malware Detection Service ✅
2. Security Audit Service ✅
3. Performance Metrics Service ✅
4. Database Health Service ✅
5. Update Status Service ✅

## 🚧 Remaining Checks (Templates Provided)

### 6. SEO Health Service
**File**: `backend/src/modules/healer/services/checks/seo-health.service.ts`
**Checks**:
- robots.txt validation
- Sitemap.xml presence
- Meta tags (title, description)
- Open Graph tags
- Canonical URLs

### 7. Backup Status Service
**File**: `backend/src/modules/healer/services/checks/backup-status.service.ts`
**Checks**:
- Last backup date
- Backup integrity
- Automated schedule

### 8. Resource Monitoring Service
**File**: `backend/src/modules/healer/services/checks/resource-monitoring.service.ts`
**Checks**:
- CPU usage
- Memory consumption
- Disk space

### 9. Plugin/Theme Analysis Service
**File**: `backend/src/modules/healer/services/checks/plugin-theme-analysis.service.ts`
**Checks**:
- Active vs inactive
- Conflict detection
- Unused plugins/themes

### 10. Uptime Monitoring Service (Optional - Low Priority)
**File**: `backend/src/modules/healer/services/checks/uptime-monitoring.service.ts`
**Checks**:
- Historical uptime
- Response time trends

## Integration Steps

### Step 1: Register All Check Services in Module

```typescript
// backend/src/modules/healer/healer.module.ts

import { MalwareDetectionService } from './services/checks/malware-detection.service';
import { SecurityAuditService } from './services/checks/security-audit.service';
import { PerformanceMetricsService } from './services/checks/performance-metrics.service';
import { DatabaseHealthService } from './services/checks/database-health.service';
import { UpdateStatusService } from './services/checks/update-status.service';
// Import remaining services...

@Module({
  providers: [
    // ... existing providers
    
    // Check Services
    MalwareDetectionService,
    SecurityAuditService,
    PerformanceMetricsService,
    DatabaseHealthService,
    UpdateStatusService,
    // Add remaining services...
  ],
})
```

### Step 2: Update UnifiedDiagnosisService to Use Check Services

```typescript
// backend/src/modules/healer/services/unified-diagnosis.service.ts

@Injectable()
export class UnifiedDiagnosisService {
  private checkServices: Map<DiagnosisCheckType, IDiagnosisCheckService>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosisService: DiagnosisService,
    // Inject all check services
    private readonly malwareDetection: MalwareDetectionService,
    private readonly securityAudit: SecurityAuditService,
    private readonly performanceMetrics: PerformanceMetricsService,
    private readonly databaseHealth: DatabaseHealthService,
    private readonly updateStatus: UpdateStatusService,
    // ... other check services
  ) {
    // Initialize check services map
    this.checkServices = new Map();
    this.registerCheckService(malwareDetection);
    this.registerCheckService(securityAudit);
    this.registerCheckService(performanceMetrics);
    this.registerCheckService(databaseHealth);
    this.registerCheckService(updateStatus);
    // Register remaining services...
  }

  private registerCheckService(service: IDiagnosisCheckService): void {
    this.checkServices.set(service.getCheckType(), service);
  }

  async diagnose(
    siteId: string,
    profile: DiagnosisProfile = DiagnosisProfile.FULL,
    options: any = {},
  ): Promise<DiagnosisResultDto> {
    // ... existing code ...

    // Get profile configuration
    const config = getProfileConfig(profile, options.customChecks);

    // Execute checks based on profile
    const checkResults = await this.executeChecks(
      site.serverId,
      site.path,
      domain,
      config.checks,
    );

    // Calculate health score from check results
    const healthScore = this.calculateHealthScoreFromChecks(checkResults);

    // Build result with check results
    const result: DiagnosisResultDto = {
      profile,
      checksRun: config.checks,
      healthScore,
      checkResults,
      // ... rest of result
    };

    return result;
  }

  private async executeChecks(
    serverId: string,
    sitePath: string,
    domain: string,
    checkTypes: DiagnosisCheckType[],
  ): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // Execute checks in parallel
    const promises = checkTypes.map(async (checkType) => {
      const service = this.checkServices.get(checkType);
      if (!service) {
        this.logger.warn(`No service found for check type: ${checkType}`);
        return null;
      }

      try {
        return await service.check(serverId, sitePath, domain);
      } catch (error) {
        this.logger.error(`Check ${checkType} failed: ${(error as Error).message}`);
        return null;
      }
    });

    const checkResults = await Promise.all(promises);
    return checkResults.filter((r) => r !== null) as CheckResult[];
  }

  private calculateHealthScoreFromChecks(checkResults: CheckResult[]): number {
    if (checkResults.length === 0) return 0;

    // Weight checks by priority
    const weights = {
      [CheckPriority.CRITICAL]: 3,
      [CheckPriority.HIGH]: 2,
      [CheckPriority.MEDIUM]: 1,
      [CheckPriority.LOW]: 0.5,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const result of checkResults) {
      const service = this.checkServices.get(result.checkType);
      if (!service) continue;

      const weight = weights[service.getPriority()];
      totalScore += result.score * weight;
      totalWeight += weight;
    }

    return Math.round(totalScore / totalWeight);
  }
}
```

### Step 3: Update Health Score Calculation

```typescript
// Add category scores
private calculateCategoryScores(checkResults: CheckResult[]): any {
  const categories = {
    security: [DiagnosisCheckType.MALWARE_SCAN, DiagnosisCheckType.SECURITY_AUDIT],
    performance: [DiagnosisCheckType.PERFORMANCE_METRICS, DiagnosisCheckType.DATABASE_CONNECTION],
    maintenance: [DiagnosisCheckType.BACKUP_STATUS, DiagnosisCheckType.UPDATE_STATUS],
    seo: [DiagnosisCheckType.SEO_HEALTH],
  };

  const scores: any = {};

  for (const [category, checkTypes] of Object.entries(categories)) {
    const categoryResults = checkResults.filter((r) => checkTypes.includes(r.checkType));
    if (categoryResults.length === 0) {
      scores[category] = 0;
      continue;
    }

    const avgScore = categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length;
    scores[category] = Math.round(avgScore);
  }

  return scores;
}
```

### Step 4: Update HealthScoreHistory Model

```typescript
// Update saveHealthScoreHistory method
private async saveHealthScoreHistory(
  siteId: string,
  result: DiagnosisResultDto,
): Promise<void> {
  const categoryScores = this.calculateCategoryScores(result.checkResults);

  await this.prisma.healthScoreHistory.create({
    data: {
      siteId,
      score: result.healthScore,
      profile: result.profile,
      availabilityScore: categoryScores.availability || 100,
      performanceScore: categoryScores.performance || 100,
      securityScore: categoryScores.security || 100,
      integrityScore: categoryScores.integrity || 100,
      maintenanceScore: categoryScores.maintenance || 100,
    },
  });
}
```

## Testing Checklist

### Unit Tests
- [ ] Test each check service individually
- [ ] Test check service error handling
- [ ] Test score calculation logic
- [ ] Test check result aggregation

### Integration Tests
- [ ] Test UnifiedDiagnosisService with all checks
- [ ] Test profile-based check execution
- [ ] Test health score calculation
- [ ] Test caching behavior

### E2E Tests
- [ ] Test diagnosis endpoint with FULL profile
- [ ] Test diagnosis endpoint with LIGHT profile
- [ ] Test diagnosis endpoint with CUSTOM profile
- [ ] Test diagnosis history retrieval
- [ ] Test health score trending

## API Endpoints to Add

```typescript
// Get available checks
GET /api/v1/healer/checks
Response: [
  {
    checkType: "MALWARE_SCAN",
    name: "Malware Detection",
    description: "...",
    priority: "CRITICAL"
  },
  // ...
]

// Run specific check
POST /api/v1/healer/sites/:id/check/:checkType
Response: {
  data: CheckResult
}

// Get check history
GET /api/v1/healer/sites/:id/check-history/:checkType?limit=20
Response: {
  data: CheckResult[],
  pagination: {...}
}
```

## Performance Optimization

1. **Parallel Execution**: Execute checks in parallel using Promise.all()
2. **Timeout Management**: Each check has configurable timeout
3. **Caching**: Cache check results based on profile TTL
4. **Lazy Loading**: Only load check services when needed
5. **Result Streaming**: Stream check results as they complete (future enhancement)

## Monitoring & Alerting

1. **Check Execution Metrics**:
   - Track check duration
   - Track check success/failure rate
   - Track check timeout rate

2. **Health Score Alerts**:
   - Alert when score drops below threshold
   - Alert on critical check failures
   - Alert on security issues

3. **Trend Analysis**:
   - Track score trends over time
   - Predict future issues
   - Identify degradation patterns

## Documentation Updates

1. Update API documentation with new endpoints
2. Document each check service
3. Add examples for custom check profiles
4. Document health score calculation
5. Add troubleshooting guide

## Next Phase Preview: Phase 3 - Healing Runbooks Expansion

After completing Phase 2, we'll implement:

1. Database Connection Healer
2. Core Integrity Healer
3. Plugin/Theme Conflict Healer
4. Memory Exhaustion Healer
5. Disk Space Healer
6. SSL Certificate Healer
7. Malware Healer
8. Performance Optimizer

Each healer will:
- Detect specific issues
- Suggest fixes
- Execute healing actions
- Verify success
- Support rollback

## Summary

Phase 2 is 50% complete with 5 critical/high-priority checks implemented. The remaining 5 checks are medium/low priority and can be implemented using the same pattern. Integration with UnifiedDiagnosisService will enable comprehensive site health monitoring with weighted scoring and category breakdowns.

**Estimated Time to Complete**: 4-6 hours
**Priority**: Complete high-priority checks first, then integrate before implementing remaining checks
