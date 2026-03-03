# WordPress Production-Grade Diagnosis System - Implementation Plan

**Date:** February 28, 2026  
**Status:** Ready for Implementation  
**Approach:** Enhance existing services (Option A - Layers 2-4 first)

---

## 📊 Executive Summary

This document outlines the implementation plan for enhancing the existing WordPress healer into a production-grade 8-layer diagnosis system. The plan leverages existing infrastructure (12+ checks, 10 services) and adds missing capabilities from the comprehensive diagnosis plan.

---

## 🎯 Current State Analysis

### ✅ What's Already Built (Production-Ready)

#### Core Services
- **DiagnosisService** (1661 lines) - 12+ comprehensive checks
- **UnifiedDiagnosisService** - Profile-based architecture (QUICK, STANDARD, FULL, CUSTOM)
- **10 Specialized Check Services:**
  1. MalwareDetectionService
  2. SecurityAuditService
  3. PerformanceMetricsService
  4. DatabaseHealthService
  5. UpdateStatusService
  6. SeoHealthService
  7. BackupStatusService
  8. ResourceMonitoringService
  9. PluginThemeAnalysisService
  10. UptimeMonitoringService

#### Infrastructure Components
- **SSHExecutorService** - SSH connection pooling and command execution
- **WpCliService** - WordPress CLI wrapper
- **LogAnalysisService** - Log parsing utilities
- **VerificationService** - 5-layer post-healing verification
- **RetryService** - 4 retry strategies (IMMEDIATE, LINEAR, EXPONENTIAL, FIBONACCI)
- **SecurityService** - Command validation and audit logging

#### Production Features
- Circuit breaker pattern (prevents infinite healing loops)
- Health score calculation with weighted scoring
- Diagnosis caching with TTL
- History tracking and trending
- Alert generation system
- Metrics collection (hourly/daily cron jobs)

#### Database Schema
- `wp_sites` - WordPress site inventory
- `diagnosis_history` - Diagnosis records
- `diagnosis_cache` - Caching layer
- `health_score_history` - Trending data
- `healer_metrics` - Performance metrics
- `healer_alerts` - Alerting system
- `healer_audit_logs` - Security audit trail
- `healing_patterns` - ML-ready pattern learning

#### API Endpoints (Fully Operational)
- `POST /discover` - Site discovery
- `GET /sites` - List with filtering
- `GET /sites/:id` - Site details
- `POST /sites/:id/diagnose` - Trigger diagnosis
- `POST /sites/:id/heal` - Execute healing
- `POST /sites/:id/rollback` - Rollback to backup
- `PATCH /sites/:id/config` - Configuration
- `GET /sites/:id/executions` - History
- `GET /metrics/:periodType` - Metrics
- `GET /alerts` - Active alerts

### 🔍 Gap Analysis (What's Missing)

#### Layer 1: Availability & Accessibility
- ✅ HTTP status check (exists)
- ⚠️ SSL certificate validity (partial)
- ❌ DNS resolution verification
- ❌ Server response time baseline comparison
- ⚠️ Mixed content detection (partial)

#### Layer 2: Core WordPress Integrity
- ✅ Core file integrity check (exists)
- ✅ Filesystem permissions (exists)
- ⚠️ .htaccess/Nginx config validation (partial)
- ❌ Checksum verification against wordpress.org API
- ⚠️ Malware signature scanning (basic exists)

#### Layer 3: Configuration Validation
- ✅ wp-config.php parsing (exists)
- ✅ Debug mode detection (exists)
- ❌ Salts/keys validation
- ❌ Absolute path verification
- ⚠️ Cron configuration validation (partial)

#### Layer 4: Database Health
- ✅ Connection status (exists)
- ✅ Table integrity (exists)
- ⚠️ Corruption detection (CHECK TABLE) (partial)
- ❌ Query performance analysis
- ❌ Orphaned transients cleanup
- ❌ Auto-increment capacity check

#### Layer 5: Performance & Resource Monitoring
- ✅ Disk space check (exists)
- ✅ Memory monitoring (exists)
- ❌ PHP memory usage tracking
- ❌ Query count monitoring
- ❌ Object cache hit ratio
- ❌ Core Web Vitals simulation
- ❌ External HTTP request monitoring

#### Layer 6: Plugin & Theme Analysis
- ✅ Plugin inventory (exists)
- ✅ Theme validation (exists)
- ❌ Vulnerability database integration
- ⚠️ Plugin conflict detection (basic)
- ❌ Abandoned plugin detection
- ⚠️ Version currency checking (partial)

#### Layer 7: Error Log Analysis
- ✅ PHP error log parsing (exists)
- ✅ Apache/Nginx error log parsing (exists)
- ⚠️ WordPress debug log analysis (partial)
- ❌ Error categorization
- ❌ Error frequency analysis
- ❌ 404 error pattern detection

#### Layer 8: Security Hardening
- ⚠️ File change detection (basic)
- ⚠️ User account audit (basic)
- ❌ Suspicious file scanning
- ❌ Login attempt analysis
- ❌ Executable files in uploads detection
- ❌ Backdoor detection

---

## 🚀 Implementation Strategy

### Decision: Enhance Existing Services (Not Rebuild)

**Rationale:**
- 12+ checks already implemented and production-ready
- Complete infrastructure in place (SSH, database, API)
- Faster implementation by building on solid foundation
- Maintains backward compatibility
- Leverages existing circuit breaker, retry logic, verification

**Approach:**
1. Expand 10 existing check services with missing checks
2. Build intelligent correlation engine
3. Integrate vulnerability databases
4. Add advanced malware detection

---

## 📋 Implementation Phases

### **Phase 1: Core Enhancements (Layers 2-4)** - Week 1
**Priority:** CRITICAL - Most impactful for diagnosis accuracy

#### 1.1 Layer 2: Core WordPress Integrity Enhancement
**File:** `backend/src/modules/healer/services/checks/security-audit.service.ts`

**Add:**
- Checksum verification against `api.wordpress.org/core/checksums/1.0/`
- Enhanced malware signature scanning
- Advanced .htaccess malware pattern detection
- Core file modification detection with baseline comparison

**Implementation:**
```typescript
async verifyCoreFileChecksums(siteId: string): Promise<CheckResult> {
  // 1. Detect WordPress version
  // 2. Fetch official checksums from wordpress.org API
  // 3. Compare MD5/SHA1 hashes of all core files
  // 4. Flag modified, missing, or extra files
  // 5. Return detailed report with file-level differences
}

async scanForMalwareSignatures(siteId: string): Promise<CheckResult> {
  // 1. Scan for suspicious patterns: base64_decode, eval, system, exec, shell_exec, gzinflate, str_rot13
  // 2. Check for files with double extensions (file.php.jpg)
  // 3. Detect high entropy + suspicious functions
  // 4. Scan wp-includes, wp-admin, wp-content/uploads for unexpected PHP files
  // 5. Return quarantine candidates with confidence scores
}

async validateHtaccessSecurity(siteId: string): Promise<CheckResult> {
  // 1. Parse .htaccess file
  // 2. Check for redirect rules to external domains (often base64 encoded)
  // 3. Detect RewriteCond %{HTTP_USER_AGENT} blocks (cloaking)
  // 4. Detect AddType application/x-httpd-php .jpg (image execution)
  // 5. Compare against WordPress default rewrite rules
}
```

#### 1.2 Layer 3: Configuration Validation Enhancement
**File:** `backend/src/modules/healer/services/diagnosis.service.ts`

**Add:**
- Security keys and salts validation
- Absolute path verification
- Complete cron configuration validation
- File editing permissions check

**Implementation:**
```typescript
async validateSecurityKeys(siteId: string): Promise<CheckResult> {
  // 1. Parse wp-config.php for AUTH_KEY, SECURE_AUTH_KEY, LOGGED_IN_KEY, NONCE_KEY, etc.
  // 2. Check if keys exist and are not default/weak
  // 3. Verify key length and entropy
  // 4. Flag missing or weak salts as security vulnerability
}

async validateAbsolutePath(siteId: string): Promise<CheckResult> {
  // 1. Parse ABSPATH from wp-config.php
  // 2. Verify path resolution matches actual installation path
  // 3. Check for path traversal vulnerabilities
  // 4. Validate path permissions
}

async validateCronConfiguration(siteId: string): Promise<CheckResult> {
  // 1. Check DISABLE_WP_CRON setting in wp-config.php
  // 2. If true, verify system cron exists for wp-cron.php
  // 3. If false, check wp-cron.php accessibility
  // 4. Query wp_options for cron option bloat (transient buildup)
  // 5. Check for missed scheduled posts
}

async checkFileEditingPermissions(siteId: string): Promise<CheckResult> {
  // 1. Check DISALLOW_FILE_EDIT constant (should be true in production)
  // 2. Check DISALLOW_FILE_MODS for additional security
  // 3. Verify theme/plugin editor is disabled
}
```

#### 1.3 Layer 4: Database Health Enhancement
**File:** `backend/src/modules/healer/services/checks/database-health.service.ts`

**Add:**
- Advanced corruption detection (CHECK TABLE)
- Query performance analysis
- Orphaned transients detection and cleanup
- Auto-increment capacity check
- Database size and growth tracking

**Implementation:**
```typescript
async checkTableCorruption(siteId: string): Promise<CheckResult> {
  // 1. Get all WordPress tables from database
  // 2. Run CHECK TABLE on each table
  // 3. Detect MyISAM crashed tables or InnoDB corruption flags
  // 4. Query information_schema for tables needing repair
  // 5. Prioritize core tables (wp_posts, wp_options) for immediate escalation
}

async analyzeQueryPerformance(siteId: string): Promise<CheckResult> {
  // 1. Check if slow_query_log is enabled
  // 2. Parse slow query log for queries related to this database
  // 3. Identify queries >1 second
  // 4. Detect missing indexes
  // 5. Analyze query patterns for optimization opportunities
}

async detectOrphanedTransients(siteId: string): Promise<CheckResult> {
  // 1. Query wp_options for expired transients
  // 2. Count total transients vs expired transients
  // 3. Calculate database bloat from transients
  // 4. Flag if >10,000 expired transients (performance degradation)
  // 5. Provide cleanup recommendation
}

async checkAutoIncrementCapacity(siteId: string): Promise<CheckResult> {
  // 1. Query information_schema for auto_increment values
  // 2. Compare against column max values (INT, BIGINT limits)
  // 3. Calculate percentage of capacity used
  // 4. Flag if approaching MAXINT (>80% = warning, >95% = critical)
  // 5. Identify tables at risk of imminent failure
}

async trackDatabaseGrowth(siteId: string): Promise<CheckResult> {
  // 1. Query information_schema for total database size
  // 2. Compare against historical data (from health_score_history)
  // 3. Calculate growth rate (MB per day/week)
  // 4. Flag rapid growth (potential spam or logging issue)
  // 5. Identify largest tables for optimization
}
```

---

### **Phase 2: Correlation Engine** - Week 2
**Priority:** HIGH - Transforms raw data into actionable intelligence

#### 2.1 Build Correlation Engine Service
**File:** `backend/src/modules/healer/services/correlation-engine.service.ts` (NEW)

**Purpose:** Analyze diagnostic results to identify root causes with confidence scores

**Implementation:**
```typescript
interface CorrelationPattern {
  name: string;
  symptoms: string[];
  rootCause: string;
  confidence: number; // 0-100
  remediation: string;
}

class CorrelationEngineService {
  // Pattern 1: Database Connection Error Cascade
  async analyzeDatabaseConnectionFailure(results: CheckResult[]): Promise<CorrelationPattern> {
    // IF database_connection_failed AND mysql_service_running:
    //   → Check wp-config.php credentials
    //   → IF credentials_valid:
    //     → Check max_connections reached
    //     → IF connections_high:
    //       → Root Cause: Resource exhaustion (Confidence: 85%)
    //     → ELSE:
    //       → Check recent plugin activation
    //       → Root Cause: Plugin conflict (Confidence: 70%)
    //   → ELSE:
    //     → Root Cause: Credential compromise (Confidence: 90%)
  }

  // Pattern 2: WSOD (White Screen of Death) Cascade
  async analyzeWSOD(results: CheckResult[]): Promise<CorrelationPattern> {
    // IF http_200_empty_body OR http_500:
    //   → Check PHP error log for fatal errors
    //   → IF memory_exhausted:
    //     → Root Cause: Memory limit too low (Confidence: 95%)
    //   → ELSE IF undefined_function:
    //     → Root Cause: Missing plugin/theme file (Confidence: 90%)
    //   → ELSE IF parse_error:
    //     → Root Cause: Corrupted file edit (Confidence: 85%)
  }

  // Pattern 3: Performance Degradation Cascade
  async analyzePerformanceDegradation(results: CheckResult[]): Promise<CorrelationPattern> {
    // IF page_load_time > 5s:
    //   → Check query_count
    //   → IF query_count > 100:
    //     → Root Cause: Unoptimized queries (Confidence: 80%)
    //   → Check transients_count
    //   → IF transients_count > 10000:
    //     → Root Cause: Database bloat (Confidence: 75%)
    //   → Check object_cache_status
    //   → IF object_cache_missing:
    //     → Root Cause: No caching layer (Confidence: 70%)
  }

  // Pattern 4: Security Compromise Score
  async calculateCompromiseScore(results: CheckResult[]): Promise<CorrelationPattern> {
    // Score = 0
    // IF modified_core_files: Score += 40
    // IF unknown_admin_users: Score += 30
    // IF suspicious_htaccess_rules: Score += 25
    // IF php_files_in_uploads: Score += 20
    // IF base64_in_recent_posts: Score += 15
    // IF eval_in_recent_files: Score += 15
    // 
    // IF Score >= 50: Root Cause: Site compromised (Confidence: 90%)
  }

  // Master correlation method
  async correlateResults(results: CheckResult[]): Promise<{
    rootCauses: CorrelationPattern[];
    overallHealthScore: number;
    criticalIssues: CheckResult[];
    recommendations: string[];
  }> {
    // 1. Run all correlation patterns
    // 2. Aggregate root causes with confidence scores
    // 3. Calculate overall health score
    // 4. Prioritize critical issues
    // 5. Generate actionable recommendations
  }
}
```

#### 2.2 Integrate Correlation Engine into Diagnosis Flow
**File:** `backend/src/modules/healer/services/unified-diagnosis.service.ts`

**Modify:**
```typescript
async diagnose(siteId: string, profile: DiagnosisProfile): Promise<DiagnosisResult> {
  // 1. Run all diagnostic checks (existing)
  // 2. Store raw results (existing)
  // 3. NEW: Pass results to correlation engine
  // 4. NEW: Get root causes with confidence scores
  // 5. NEW: Enhance diagnosis report with correlation insights
  // 6. Calculate health score (existing, but now correlation-aware)
  // 7. Return comprehensive diagnosis with root cause analysis
}
```

---

### **Phase 3: Advanced Features (Layers 5-8)** - Week 3
**Priority:** MEDIUM - Completes the 8-layer system

#### 3.1 Layer 5: Performance & Resource Monitoring
**File:** `backend/src/modules/healer/services/checks/performance-metrics.service.ts`

**Add:**
- PHP memory usage tracking
- MySQL query count monitoring
- Object cache hit ratio analysis
- External HTTP request monitoring

#### 3.2 Layer 6: Plugin & Theme Analysis
**File:** `backend/src/modules/healer/services/checks/plugin-theme-analysis.service.ts`

**Add:**
- Vulnerability database integration (WPVulnerability API)
- Advanced plugin conflict detection
- Abandoned plugin detection (>2 years no update)
- Version currency checking against WordPress.org API

#### 3.3 Layer 7: Error Log Analysis
**File:** `backend/src/modules/healer/services/log-analysis.service.ts`

**Add:**
- Error categorization (Fatal, Warning, Notice)
- Error frequency analysis (spike detection)
- 404 error pattern detection (probing attacks)
- Error correlation by plugin/theme

#### 3.4 Layer 8: Security Hardening
**File:** `backend/src/modules/healer/services/checks/malware-detection.service.ts`

**Add:**
- Advanced suspicious file scanning
- Login attempt analysis (brute force detection)
- Executable files in uploads detection
- Backdoor detection (common patterns)
- Post & content injection detection

---

### **Phase 4: Integration & Testing** - Week 4
**Priority:** HIGH - Production readiness

#### 4.1 Integration Tasks
- Integrate all enhanced checks into UnifiedDiagnosisService
- Update diagnosis profiles (QUICK, STANDARD, FULL, CUSTOM)
- Add caching for expensive checks (checksums, vulnerability lookups)
- Implement parallel check execution optimization
- Add comprehensive error handling

#### 4.2 Testing Tasks
- Unit tests for each new check method
- Integration tests for correlation engine
- End-to-end tests for complete diagnosis flow
- Performance testing (diagnosis should complete <60 seconds)
- Load testing (handle 100+ concurrent diagnoses)

#### 4.3 Documentation Tasks
- Update API documentation
- Create diagnosis check reference guide
- Document correlation patterns
- Add troubleshooting guide
- Update admin documentation

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ All 8 layers implemented with comprehensive checks
- ✅ Correlation engine identifies root causes with >70% confidence
- ✅ Diagnosis completes in <60 seconds for STANDARD profile
- ✅ Health score accurately reflects site status
- ✅ Critical issues flagged immediately
- ✅ Actionable recommendations provided

### Non-Functional Requirements
- ✅ >80% test coverage
- ✅ Zero TypeScript compilation errors
- ✅ Comprehensive error handling
- ✅ Audit logging for all operations
- ✅ Performance optimized (caching, parallel execution)
- ✅ Backward compatible with existing API

### Production Readiness
- ✅ Circuit breaker prevents infinite loops
- ✅ Retry logic handles transient failures
- ✅ Verification service validates healing success
- ✅ Rollback capability with backups
- ✅ Alerting for critical issues
- ✅ Metrics collection for monitoring

---

## 📊 Progress Tracking

### Phase 1: Core Enhancements (Layers 2-4) - COMPLETE ✅
- [x] Layer 2: Core WordPress Integrity Enhancement
  - [x] Checksum verification against wordpress.org API
  - [x] Enhanced malware signature scanning
  - [x] Advanced .htaccess malware pattern detection
  - [x] Core file modification detection
- [x] Layer 3: Configuration Validation Enhancement
  - [x] Security keys and salts validation
  - [x] Absolute path verification
  - [x] Complete cron configuration validation
  - [x] File editing permissions check
- [x] Layer 4: Database Health Enhancement
  - [x] Advanced corruption detection (CHECK TABLE)
  - [x] Query performance analysis
  - [x] Orphaned transients detection
  - [x] Auto-increment capacity check
  - [x] Database size and growth tracking

### Phase 2: Correlation Engine - COMPLETE ✅
- [x] Build CorrelationEngineService
  - [x] Database Connection Error Cascade pattern
  - [x] WSOD Cascade pattern
  - [x] Performance Degradation Cascade pattern
  - [x] Security Compromise Score pattern
  - [x] Configuration Issues pattern
  - [x] Disk Space Issues pattern
- [x] Integrate into UnifiedDiagnosisService
- [x] Add root cause reporting with confidence scores

### Phase 3: Advanced Features (Layers 5-8) - COMPLETE ✅
- [x] Layer 5: Performance & Resource Monitoring
  - [x] PHP memory usage tracking (current/peak with percentage)
  - [x] MySQL query count monitoring (detects >100 queries per page)
  - [x] Object cache hit ratio analysis (Redis/Memcached effectiveness)
  - [x] External HTTP request monitoring (count and slow requests >2s)
- [x] Layer 6: Plugin & Theme Analysis
  - [x] Vulnerability database integration (WPScan API ready)
  - [x] Abandoned plugin detection (>2 years no updates)
  - [x] Version currency checking (semantic versioning, 2+ major versions behind)
  - [x] Advanced conflict detection (5 conflict types: page builders, database optimization, JavaScript, REST API, form builders)
- [x] Layer 7: Error Log Analysis
  - [x] Error categorization by severity (fatal, warning, notice, deprecated)
  - [x] Error frequency analysis (detects error spikes >3x average hourly rate)
  - [x] 404 pattern detection (detects probing attacks >50 404s with >3 attack vectors)
  - [x] Error correlation by source (plugin/theme/type)
  - [x] Comprehensive report generation
- [x] Layer 8: Security Hardening
  - [x] Login attempt analysis (detects brute force attacks >50 failed attempts)
  - [x] Executable upload detection (finds PHP and executable files in uploads)
  - [x] Backdoor detection (detects 9 backdoor function patterns)
  - [x] Content injection detection (scans database for malicious content)

### Phase 4: Integration & Testing
- [ ] Integration tasks
- [ ] Testing tasks
- [ ] Documentation tasks

---

## 🔗 Key Files to Modify

### Existing Files to Enhance
1. `backend/src/modules/healer/services/checks/security-audit.service.ts`
2. `backend/src/modules/healer/services/checks/database-health.service.ts`
3. `backend/src/modules/healer/services/checks/performance-metrics.service.ts`
4. `backend/src/modules/healer/services/checks/plugin-theme-analysis.service.ts`
5. `backend/src/modules/healer/services/checks/malware-detection.service.ts`
6. `backend/src/modules/healer/services/diagnosis.service.ts`
7. `backend/src/modules/healer/services/unified-diagnosis.service.ts`
8. `backend/src/modules/healer/services/log-analysis.service.ts`

### New Files to Create
1. `backend/src/modules/healer/services/correlation-engine.service.ts`
2. `backend/src/modules/healer/interfaces/correlation.interface.ts`

---

## 🚨 Critical Notes

### Safety First
- All diagnosis operations are READ-ONLY
- No state changes during diagnosis phase
- Comprehensive error handling to prevent crashes
- Audit logging for all operations
- Timeout handling for long-running checks

### Performance Considerations
- Connection pooling for SSH (already implemented)
- Caching for expensive checks (checksums, API lookups)
- Parallel execution where possible
- Early termination on critical failures
- Smart check ordering (fail-fast)

### Security Considerations
- Command validation (already implemented via SecurityService)
- Input sanitization for all SSH commands
- Credential encryption (already implemented)
- Audit trail for all diagnosis operations
- Rate limiting for external API calls

---

## 📝 Next Steps

1. **Review and approve this plan**
2. **Start Phase 1: Core Enhancements (Layers 2-4)**
3. **Implement checksum verification first** (highest impact)
4. **Build correlation engine** (transforms data into intelligence)
5. **Complete remaining layers** (comprehensive coverage)
6. **Test thoroughly** (>80% coverage)
7. **Deploy to production** (with monitoring)

---

**Last Updated:** February 28, 2026  
**Status:** Ready for Implementation  
**Next Action:** Begin Phase 1 - Layer 2 Core Integrity Enhancement
