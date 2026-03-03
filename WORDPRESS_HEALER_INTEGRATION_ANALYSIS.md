# WordPress Healer Integration Analysis

**Date:** March 1, 2026  
**Status:** INTEGRATION MISSING ❌  
**Priority:** CRITICAL

---

## Executive Summary

The comprehensive WordPress Healer Diagnosis System (30+ checks, 8 layers, correlation engine) is **NOT integrated** with the Universal Healer's plugin system. The WordPress plugin currently uses only 7 basic checks instead of the full diagnosis system.

---

## Current Architecture

### Universal Healer Flow

```
User Request
    ↓
ApplicationService.diagnose()
    ↓
PluginRegistry.getPlugin(techStack)
    ↓
WordPressPlugin.executeDiagnosticCheck()
    ↓
7 Basic Checks (NOT using UnifiedDiagnosisService)
```

### WordPress Healer Flow (Isolated)

```
User Request
    ↓
HealerController.diagnoseUnified()
    ↓
UnifiedDiagnosisService.diagnose()
    ↓
30+ Comprehensive Checks across 8 layers
    ↓
CorrelationEngine (root cause analysis)
```

---

## Problem

### 1. Two Separate Diagnosis Systems

**Universal Healer (ApplicationService):**
- Uses plugin system
- Routes to WordPressPlugin
- Only 7 basic checks
- No correlation engine
- No profile support
- No caching

**WordPress Healer (UnifiedDiagnosisService):**
- Standalone service
- 30+ comprehensive checks
- 8-layer diagnosis
- Correlation engine with 6 patterns
- 4 diagnosis profiles (QUICK, LIGHT, FULL, CUSTOM)
- Smart caching (67-75% faster)
- Parallel execution (50% faster)

### 2. WordPress Plugin Checks (Basic)

Current checks in `WordPressPlugin`:
1. `wp_core_update` - Check for WordPress core updates
2. `wp_plugin_updates` - Check for plugin updates
3. `wp_theme_updates` - Check for theme updates
4. `wp_database_check` - Basic database check
5. `wp_permissions` - File permissions check
6. `wp_debug_mode` - Debug mode detection
7. `wp_plugin_conflicts` - Basic plugin conflict detection

**Missing from WordPress Plugin:**
- Core integrity (checksum verification)
- Malware detection (login attempts, backdoors, content injection)
- Performance metrics (PHP memory, query count, cache hit ratio)
- Security hardening (executable uploads, suspicious files)
- Error log analysis (categorization, frequency, 404 patterns)
- Advanced database health (corruption, transients, auto-increment)
- Plugin/theme analysis (vulnerabilities, abandoned plugins)
- Configuration validation (security keys, salts, cron)
- Correlation engine (root cause identification)

### 3. Duplicate Endpoints

**Old Endpoint (Basic):**
```
POST /api/v1/healer/sites/:id/diagnose
→ HealerService.diagnose()
→ HealingOrchestratorService.diagnose()
→ DiagnosisService.diagnose() (OLD)
```

**New Endpoint (Comprehensive):**
```
POST /api/v1/healer/sites/:id/diagnose-unified
→ UnifiedDiagnosisService.diagnose()
→ 30+ checks + correlation
```

**Universal Endpoint (Plugin-based):**
```
POST /api/v1/healer/applications/:id/diagnose
→ ApplicationService.diagnose()
→ WordPressPlugin.executeDiagnosticCheck()
→ 7 basic checks
```

---

## Required Integration

### Solution: Integrate UnifiedDiagnosisService into WordPressPlugin

**Approach:**
1. Inject `UnifiedDiagnosisService` into `WordPressPlugin`
2. Replace basic checks with UnifiedDiagnosisService call
3. Map UnifiedDiagnosisService results to plugin interface
4. Maintain backward compatibility

### Implementation Steps

#### Step 1: Update WordPressPlugin Constructor

```typescript
constructor(
  protected readonly sshExecutor: SSHExecutorService,
  protected readonly wpCli: WpCliService,
  private readonly unifiedDiagnosis: UnifiedDiagnosisService, // ADD THIS
) {}
```

#### Step 2: Update getDiagnosticChecks()

```typescript
getDiagnosticChecks(): string[] {
  return [
    'wp_unified_diagnosis', // Single check that runs all 30+ checks
  ];
}
```

#### Step 3: Update executeDiagnosticCheck()

```typescript
async executeDiagnosticCheck(
  checkName: string,
  application: any,
  server: Server,
): Promise<DiagnosticCheckResult> {
  if (checkName === 'wp_unified_diagnosis') {
    // Find or create wp_sites entry
    const wpSite = await this.findOrCreateWpSite(application);
    
    // Run unified diagnosis with FULL profile
    const diagnosis = await this.unifiedDiagnosis.diagnose(
      wpSite.id,
      DiagnosisProfile.FULL,
    );
    
    // Map to plugin interface
    return {
      checkName: 'wp_unified_diagnosis',
      category: 'COMPREHENSIVE',
      status: this.mapHealthStatus(diagnosis.healthStatus),
      severity: this.mapSeverity(diagnosis.healthScore),
      message: `Health Score: ${diagnosis.healthScore}/100 - ${diagnosis.issuesFound} issues found`,
      details: {
        healthScore: diagnosis.healthScore,
        checksPerformed: diagnosis.checksPerformed,
        issuesFound: diagnosis.issuesFound,
        criticalIssues: diagnosis.criticalIssues,
        checks: diagnosis.checks,
        correlation: diagnosis.correlation,
      },
      suggestedFix: this.generateSuggestedFix(diagnosis),
      executionTime: diagnosis.executionTime,
    };
  }
  
  // Fallback to basic checks for backward compatibility
  return this.executeBasicCheck(checkName, application, server);
}
```

#### Step 4: Add Helper Methods

```typescript
private async findOrCreateWpSite(application: any): Promise<any> {
  // Find existing wp_sites entry
  let wpSite = await this.prisma.wp_sites.findFirst({
    where: {
      serverId: application.serverId,
      domain: application.domain,
      path: application.path,
    },
  });
  
  // Create if not exists
  if (!wpSite) {
    wpSite = await this.prisma.wp_sites.create({
      data: {
        serverId: application.serverId,
        domain: application.domain,
        path: application.path,
        sitePath: application.path,
        platformType: 'WORDPRESS',
        wpVersion: application.techStackVersion || 'unknown',
        // ... other fields
      },
    });
  }
  
  return wpSite;
}

private mapHealthStatus(healthStatus: string): 'PASS' | 'FAIL' | 'WARNING' | 'ERROR' {
  switch (healthStatus) {
    case 'HEALTHY': return 'PASS';
    case 'DOWN': return 'FAIL';
    case 'DEGRADED': return 'WARNING';
    default: return 'ERROR';
  }
}

private mapSeverity(healthScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (healthScore >= 80) return 'LOW';
  if (healthScore >= 60) return 'MEDIUM';
  if (healthScore >= 40) return 'HIGH';
  return 'CRITICAL';
}

private generateSuggestedFix(diagnosis: any): string {
  const recommendations = diagnosis.correlation?.recommendations || [];
  if (recommendations.length === 0) return 'No issues detected';
  
  return recommendations.slice(0, 3).join('\n');
}
```

---

## Benefits of Integration

### 1. Comprehensive Diagnosis

- 30+ checks instead of 7
- 8-layer analysis (availability → security)
- Root cause identification with confidence scores
- Actionable recommendations

### 2. Performance

- Parallel execution (50% faster)
- Smart caching (67-75% faster with cache hits)
- Timeout protection (60s per check)
- Graceful degradation

### 3. Intelligence

- Correlation engine identifies root causes
- 6 correlation patterns (database errors, WSOD, performance, security, config, disk space)
- Confidence scoring (0-100)
- Pattern learning integration

### 4. Flexibility

- 4 diagnosis profiles (QUICK, LIGHT, FULL, CUSTOM)
- Profile-based execution
- Custom check selection
- Subdomain support

### 5. Consistency

- Single diagnosis system for WordPress
- Unified API across all tech stacks
- Consistent result format
- Centralized caching

---

## Migration Path

### Phase 1: Integration (2 hours)

1. Update `WordPressPlugin` to inject `UnifiedDiagnosisService`
2. Add `wp_unified_diagnosis` check
3. Implement mapping methods
4. Test integration

### Phase 2: Deprecation (1 hour)

1. Mark old checks as deprecated
2. Update documentation
3. Add migration guide
4. Notify users

### Phase 3: Cleanup (1 hour)

1. Remove old `DiagnosisService` (if not used elsewhere)
2. Remove old endpoint `/sites/:id/diagnose`
3. Update tests
4. Update API documentation

**Total Time:** 4 hours

---

## Testing Checklist

### Integration Tests

- [ ] WordPress detection works
- [ ] UnifiedDiagnosisService is called
- [ ] Results are mapped correctly
- [ ] Health score is calculated
- [ ] Recommendations are generated
- [ ] Caching works
- [ ] Parallel execution works
- [ ] Timeout handling works

### Backward Compatibility

- [ ] Old checks still work (if needed)
- [ ] Existing applications not affected
- [ ] Database schema compatible
- [ ] API responses consistent

### Performance

- [ ] Diagnosis completes in <90s (FULL profile)
- [ ] Cache hit rate >60%
- [ ] No memory leaks
- [ ] No connection pool exhaustion

---

## Risks

### Low Risk ✅

- UnifiedDiagnosisService is production-ready
- Zero TypeScript errors
- Comprehensive error handling
- Well-documented

### Medium Risk ⚠️

- Need to ensure wp_sites and applications tables stay in sync
- Need to handle subdomain diagnosis
- Need to maintain backward compatibility

### Mitigation

- Create wp_sites entry automatically if not exists
- Use transaction for database operations
- Keep old checks as fallback
- Add comprehensive logging

---

## Recommendation

**IMMEDIATE ACTION REQUIRED:**

Integrate UnifiedDiagnosisService into WordPressPlugin to provide comprehensive diagnosis for WordPress applications through the Universal Healer.

**Priority:** CRITICAL  
**Effort:** 4 hours  
**Impact:** HIGH (30+ checks vs 7 basic checks)

---

## Current Status

- ❌ UnifiedDiagnosisService NOT integrated with WordPressPlugin
- ❌ Universal Healer uses only 7 basic checks
- ❌ Comprehensive diagnosis system isolated
- ❌ Correlation engine not accessible via Universal Healer
- ❌ No profile support in Universal Healer
- ❌ No caching in Universal Healer

**Next Action:** Implement integration (Step 1-4 above)

---

**Status:** INTEGRATION MISSING ❌  
**Priority:** CRITICAL 🔴  
**Estimated Fix Time:** 4 hours  
**Last Updated:** March 1, 2026

