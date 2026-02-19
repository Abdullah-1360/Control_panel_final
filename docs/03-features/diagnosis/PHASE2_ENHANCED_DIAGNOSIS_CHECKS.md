# Phase 2: Enhanced Diagnosis Checks - Implementation Plan

## Overview
Expand diagnosis capabilities with comprehensive checks covering security, performance, malware detection, SEO, and more.

## Status: STARTING

## New Diagnosis Checks to Implement

### 1. Malware/Hack Detection ⏳
**Priority: HIGH**
- Scan for suspicious files (backdoors, shells, malicious code)
- Check for unauthorized admin users
- Detect modified core files with malicious code
- Check for suspicious cron jobs
- Scan for known malware signatures
- Check for suspicious database entries

**Implementation:**
- Create `MalwareDetectionService`
- Add malware signature database
- Implement file integrity checking
- Add suspicious pattern detection

### 2. Performance Metrics ⏳
**Priority: HIGH**
- Page load time (TTFB, FCP, LCP)
- Database query performance
- PHP execution time
- Memory usage patterns
- Cache hit/miss rates
- Asset optimization (images, CSS, JS)

**Implementation:**
- Create `PerformanceMetricsService`
- Integrate with WP-CLI performance commands
- Add database query profiling
- Implement resource usage monitoring

### 3. Security Audit ⏳
**Priority: HIGH**
- File permission audit (wp-config.php, .htaccess)
- User role audit (suspicious admins)
- Plugin/theme vulnerability scan
- SSL/TLS configuration check
- Security headers check
- Brute force protection status
- Two-factor authentication status

**Implementation:**
- Create `SecurityAuditService`
- Add vulnerability database integration
- Implement permission checker
- Add security header validator

### 4. SEO Health ⏳
**Priority: MEDIUM**
- robots.txt validation
- Sitemap.xml presence and validity
- Meta tags check (title, description)
- Open Graph tags
- Schema.org markup
- Canonical URLs
- 404 error pages
- Redirect chains

**Implementation:**
- Create `SeoHealthService`
- Add robots.txt parser
- Implement sitemap validator
- Add meta tag extractor

### 5. Backup Status ⏳
**Priority: MEDIUM**
- Last backup date
- Backup integrity check
- Backup size and location
- Automated backup schedule
- Backup retention policy
- Restore test status

**Implementation:**
- Enhance `BackupService`
- Add backup verification
- Implement backup scheduling check
- Add restore testing

### 6. Update Status ⏳
**Priority: MEDIUM**
- WordPress core version check
- Outdated plugins list
- Outdated themes list
- Security updates available
- Compatibility warnings
- Changelog review

**Implementation:**
- Create `UpdateStatusService`
- Integrate with WordPress.org API
- Add version comparison logic
- Implement security advisory check

### 7. Resource Usage ⏳
**Priority: MEDIUM**
- CPU usage patterns
- Memory consumption
- Disk I/O statistics
- Network bandwidth usage
- Database size and growth
- Log file sizes

**Implementation:**
- Create `ResourceMonitoringService`
- Add system metrics collection
- Implement trend analysis
- Add alerting thresholds

### 8. Database Health ⏳
**Priority: HIGH**
- Table optimization status
- Index usage analysis
- Query performance
- Database size
- Transient cleanup needed
- Post revision cleanup needed
- Orphaned data detection

**Implementation:**
- Create `DatabaseHealthService`
- Add table analysis
- Implement optimization recommendations
- Add cleanup suggestions

### 9. Plugin/Theme Analysis ⏳
**Priority: MEDIUM**
- Active vs inactive plugins
- Plugin conflicts detection
- Theme compatibility check
- Unused plugins/themes
- Plugin update frequency
- Plugin support status

**Implementation:**
- Create `PluginThemeAnalysisService`
- Add conflict detection logic
- Implement compatibility checker
- Add usage analysis

### 10. Uptime Monitoring ⏳
**Priority: LOW**
- Historical uptime percentage
- Downtime incidents
- Response time trends
- Availability zones
- Incident patterns

**Implementation:**
- Create `UptimeMonitoringService`
- Add historical data tracking
- Implement trend analysis
- Add incident correlation

## Implementation Strategy

### Step 1: Create Service Interfaces
Define common interfaces for all check services:
```typescript
interface DiagnosisCheckService {
  check(siteId: string, config: any): Promise<CheckResult>;
  getCheckType(): DiagnosisCheckType;
  getPriority(): number;
}

interface CheckResult {
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  score: number; // 0-100
  message: string;
  details: any;
  recommendations?: string[];
  duration: number;
}
```

### Step 2: Implement High-Priority Checks First
1. Malware Detection
2. Security Audit
3. Performance Metrics
4. Database Health

### Step 3: Integrate with UnifiedDiagnosisService
- Register all check services
- Map check types to services
- Implement parallel execution
- Add result aggregation

### Step 4: Update Health Score Calculation
- Weight checks by priority
- Calculate category scores
- Implement trending logic
- Add predictive alerts

### Step 5: Add Check Configuration
- Per-site check enable/disable
- Check-specific thresholds
- Custom check parameters
- Check scheduling

## Database Schema Updates

### Add Check Configuration Table
```prisma
model DiagnosisCheckConfig {
  id              String   @id @default(uuid())
  siteId          String
  site            WpSite   @relation(fields: [siteId], references: [id])
  checkType       String   // DiagnosisCheckType
  enabled         Boolean  @default(true)
  threshold       Json?    // Check-specific thresholds
  schedule        String?  // Cron expression
  lastRun         DateTime?
  nextRun         DateTime?
  
  @@unique([siteId, checkType])
}
```

### Add Check Results Table
```prisma
model DiagnosisCheckResult {
  id              String   @id @default(uuid())
  historyId       String
  history         DiagnosisHistory @relation(fields: [historyId], references: [id])
  checkType       String
  status          String   // PASS, FAIL, WARNING, SKIPPED
  score           Int      // 0-100
  message         String   @db.Text
  details         Json
  recommendations String[] @default([])
  duration        Int      // milliseconds
  createdAt       DateTime @default(now())
  
  @@index([historyId])
  @@index([checkType])
}
```

## API Endpoints to Add

```typescript
// Get available checks
GET /api/v1/healer/checks

// Get check configuration for a site
GET /api/v1/healer/sites/:id/check-config

// Update check configuration
PATCH /api/v1/healer/sites/:id/check-config

// Run specific check
POST /api/v1/healer/sites/:id/check/:checkType

// Get check history
GET /api/v1/healer/sites/:id/check-history/:checkType
```

## Files to Create

### Services
- `backend/src/modules/healer/services/checks/malware-detection.service.ts`
- `backend/src/modules/healer/services/checks/performance-metrics.service.ts`
- `backend/src/modules/healer/services/checks/security-audit.service.ts`
- `backend/src/modules/healer/services/checks/seo-health.service.ts`
- `backend/src/modules/healer/services/checks/backup-status.service.ts`
- `backend/src/modules/healer/services/checks/update-status.service.ts`
- `backend/src/modules/healer/services/checks/resource-monitoring.service.ts`
- `backend/src/modules/healer/services/checks/database-health.service.ts`
- `backend/src/modules/healer/services/checks/plugin-theme-analysis.service.ts`
- `backend/src/modules/healer/services/checks/uptime-monitoring.service.ts`

### Interfaces
- `backend/src/modules/healer/interfaces/diagnosis-check.interface.ts`

### DTOs
- `backend/src/modules/healer/dto/check-config.dto.ts`
- `backend/src/modules/healer/dto/check-result.dto.ts`

## Success Criteria

- ✅ All 10 check services implemented
- ✅ Integration with UnifiedDiagnosisService
- ✅ Health score calculation updated
- ✅ Database schema updated
- ✅ API endpoints added
- ✅ Unit tests for each check service
- ✅ Integration tests for check execution
- ✅ Documentation updated

## Timeline

- **Week 2-3**: Implement high-priority checks (Malware, Security, Performance, Database)
- **Week 3**: Integrate with UnifiedDiagnosisService
- **Week 3**: Update health score calculation
- **Week 3**: Add API endpoints and testing

## Next Steps

1. Create base interface for check services
2. Implement MalwareDetectionService (highest priority)
3. Implement SecurityAuditService
4. Implement PerformanceMetricsService
5. Implement DatabaseHealthService
6. Integrate all checks with UnifiedDiagnosisService
7. Update health score calculation
8. Add API endpoints
9. Write tests
10. Update documentation

## Questions

1. Should malware detection use external APIs (VirusTotal, Sucuri) or local signatures?
2. What performance thresholds should trigger warnings? (e.g., page load > 3s)
3. Should we implement automatic remediation for failed checks?
4. What security standards should we audit against? (OWASP, CIS)
5. Should SEO checks integrate with Google Search Console API?
