# Phase 3: Testing & Integration - Implementation Plan

**Start Date:** February 26, 2026  
**Duration:** 6 weeks (accelerated timeline)  
**Status:** 🚀 **IN PROGRESS**  
**Previous Phase:** Phase 2.5 (Complete)  
**Next Phase:** Phase 4 (Deprecation & Cleanup)

---

## Executive Summary

Phase 3 focuses on testing the implemented plugin system, integrating with the frontend, and migrating WordPress functionality to the universal system. This phase transforms the Universal Healer from "implemented" to "operational".

**Key Objectives:**
1. Test discovery, diagnosis, and healing endpoints
2. Verify all 5 plugins work correctly
3. Integrate plugins with frontend
4. Migrate WordPress to plugin system
5. Create unified interface for all tech stacks

---

## 📋 Phase 3 Overview

### Week 1-2: Discovery & Diagnosis Testing
**Goal:** Verify plugin system works with real applications

**Tasks:**
- [ ] Setup test environment with sample applications
- [ ] Test discovery endpoint for each tech stack
- [ ] Test diagnosis endpoint for each tech stack
- [ ] Verify health scoring algorithm
- [ ] Fix bugs found during testing
- [ ] Document test results

### Week 3-4: Healing & Integration
**Goal:** Test healing actions and integrate with frontend

**Tasks:**
- [ ] Test healing actions for each tech stack
- [ ] Verify backup/rollback functionality
- [ ] Test circuit breaker logic
- [ ] Update frontend to show all tech stacks
- [ ] Test frontend integration
- [ ] Performance testing

### Week 5-6: WordPress Migration
**Goal:** Migrate WordPress to universal system

**Tasks:**
- [ ] Create WordPress plugin using new interface
- [ ] Migrate existing WordPress checks
- [ ] Migrate existing WordPress healing actions
- [ ] Test backward compatibility
- [ ] Create unified frontend
- [ ] Final integration testing

---

## 🎯 Detailed Task Breakdown

### Task 1: Setup Test Environment (Day 1)

**Objective:** Create test servers with different tech stacks

**Subtasks:**
1. Create test server in database
2. Setup sample Node.js application
3. Setup sample Laravel application
4. Setup sample PHP application
5. Setup sample Express application
6. Setup sample Next.js application
7. Configure SSH access for testing

**Deliverables:**
- Test server with ID
- 5 sample applications ready for discovery
- SSH credentials configured

**Acceptance Criteria:**
- Can SSH into test server
- All sample applications accessible
- Applications have correct file structure

---

### Task 2: Test Discovery Endpoint (Days 2-3)

**Objective:** Verify tech stack detection works correctly

**Test Cases:**

#### 2.1 NodeJS Discovery
```bash
# Test discovery
POST /api/v1/healer/applications/discover
{
  "serverId": "test-server-id",
  "paths": ["/var/www/nodejs-app"]
}

# Expected Response
{
  "discovered": 1,
  "applications": [{
    "path": "/var/www/nodejs-app",
    "techStack": "NODEJS",
    "version": "20.10.0",
    "confidence": 0.90,
    "metadata": { "packageName": "my-app" }
  }]
}
```

#### 2.2 Laravel Discovery
```bash
POST /api/v1/healer/applications/discover
{
  "serverId": "test-server-id",
  "paths": ["/var/www/laravel-app"]
}

# Expected: techStack = "LARAVEL", confidence > 0.90
```

#### 2.3 PHP Generic Discovery
```bash
POST /api/v1/healer/applications/discover
{
  "serverId": "test-server-id",
  "paths": ["/var/www/php-app"]
}

# Expected: techStack = "PHP_GENERIC", confidence > 0.70
```

#### 2.4 Express Discovery
```bash
POST /api/v1/healer/applications/discover
{
  "serverId": "test-server-id",
  "paths": ["/var/www/express-app"]
}

# Expected: techStack = "EXPRESS", confidence > 0.85
```

#### 2.5 NextJS Discovery
```bash
POST /api/v1/healer/applications/discover
{
  "serverId": "test-server-id",
  "paths": ["/var/www/nextjs-app"]
}

# Expected: techStack = "NEXTJS", confidence > 0.95
```

**Acceptance Criteria:**
- All 5 tech stacks detected correctly
- Confidence scores within expected ranges
- Metadata extracted correctly
- Applications created in database
- No duplicate applications created

---

### Task 3: Test Diagnosis Endpoint (Days 4-5)

**Objective:** Verify diagnostic checks execute correctly

**Test Cases:**

#### 3.1 NodeJS Diagnosis
```bash
POST /api/v1/healer/applications/{nodejs-app-id}/diagnose

# Expected Response
{
  "applicationId": "...",
  "techStack": "NODEJS",
  "checksExecuted": 6,
  "results": [
    {
      "checkName": "npm_audit",
      "category": "SECURITY",
      "status": "PASS",
      "severity": "HIGH",
      "message": "No critical vulnerabilities",
      "executionTime": 1234
    },
    // ... 5 more checks
  ]
}
```

#### 3.2 Laravel Diagnosis
```bash
POST /api/v1/healer/applications/{laravel-app-id}/diagnose

# Expected: 7 checks executed
# Checks: config_cache, route_cache, storage_permissions, database_connection, queue_worker, composer_dependencies, env_file
```

#### 3.3 PHP Generic Diagnosis
```bash
POST /api/v1/healer/applications/{php-app-id}/diagnose

# Expected: 5 checks executed
# Checks: php_version, php_extensions, composer_installed, file_permissions, error_log
```

#### 3.4 Express Diagnosis
```bash
POST /api/v1/healer/applications/{express-app-id}/diagnose

# Expected: 8 checks executed (6 from NodeJS + 2 Express-specific)
```

#### 3.5 NextJS Diagnosis
```bash
POST /api/v1/healer/applications/{nextjs-app-id}/diagnose

# Expected: 8 checks executed (6 from NodeJS + 2 NextJS-specific)
```

**Acceptance Criteria:**
- All checks execute without errors
- Results stored in diagnostic_results table
- Health score calculated correctly
- Health status updated (HEALTHY/DEGRADED/DOWN)
- Execution times reasonable (<30s total)

---

### Task 4: Test Health Scoring (Day 6)

**Objective:** Verify health score calculation is accurate

**Test Scenarios:**

#### 4.1 All Checks Pass
```
Expected Health Score: 100
Expected Health Status: HEALTHY
```

#### 4.2 One HIGH Severity Failure
```
Expected Health Score: ~85-90
Expected Health Status: DEGRADED
```

#### 4.3 Multiple Failures
```
Expected Health Score: <70
Expected Health Status: DOWN
```

#### 4.4 Critical Failure
```
Expected Health Score: <50
Expected Health Status: DOWN
```

**Acceptance Criteria:**
- Health score reflects severity weights correctly
- Health status matches score ranges
- Score updates after each diagnosis
- Historical scores tracked

---

### Task 5: Test Healing Actions (Days 7-9)

**Objective:** Verify healing actions work correctly

**Test Cases:**

#### 5.1 NodeJS Healing
```bash
# Test npm_install
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "npm_install"
}

# Expected: Dependencies installed, no backup required
```

```bash
# Test npm_audit_fix
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "npm_audit_fix"
}

# Expected: Vulnerabilities fixed, backup created
```

#### 5.2 Laravel Healing
```bash
# Test cache_clear
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "cache_clear"
}

# Expected: Caches cleared, no backup required
```

```bash
# Test migrate
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "migrate"
}

# Expected: Migrations run, backup created
```

#### 5.3 PHP Generic Healing
```bash
# Test fix_permissions
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "fix_permissions"
}

# Expected: Permissions fixed
```

**Acceptance Criteria:**
- All healing actions execute successfully
- Backups created for MEDIUM+ risk actions
- Execution results logged
- Circuit breaker prevents infinite loops
- Cooldown period enforced

---

### Task 6: Test Circuit Breaker (Day 10)

**Objective:** Verify circuit breaker prevents infinite healing loops

**Test Scenarios:**

#### 6.1 Max Attempts Reached
```
1. Set maxHealingAttempts = 3
2. Trigger healing that fails
3. Verify circuit breaker trips after 3 attempts
4. Verify cooldown period enforced
```

#### 6.2 Cooldown Period
```
1. Trip circuit breaker
2. Attempt healing before cooldown expires
3. Verify healing blocked
4. Wait for cooldown to expire
5. Verify healing allowed again
```

**Acceptance Criteria:**
- Circuit breaker trips after max attempts
- Cooldown period enforced correctly
- Healing blocked during cooldown
- Circuit breaker resets after cooldown

---

### Task 7: Frontend Integration (Days 11-14)

**Objective:** Update frontend to support all tech stacks

**Subtasks:**

#### 7.1 Update ApplicationCard
```typescript
// Add tech stack badges for all 6 stacks
<TechStackBadge techStack={application.techStack} />

// Show appropriate icons
{techStack === 'NODEJS' && <NodeIcon />}
{techStack === 'LARAVEL' && <LaravelIcon />}
{techStack === 'PHP_GENERIC' && <PhpIcon />}
{techStack === 'EXPRESS' && <ExpressIcon />}
{techStack === 'NEXTJS' && <NextIcon />}
```

#### 7.2 Update Filters
```typescript
// Add tech stack filter
<Select>
  <option value="WORDPRESS">WordPress</option>
  <option value="NODEJS">Node.js</option>
  <option value="LARAVEL">Laravel</option>
  <option value="PHP_GENERIC">PHP</option>
  <option value="EXPRESS">Express</option>
  <option value="NEXTJS">Next.js</option>
</Select>
```

#### 7.3 Update Discovery Modal
```typescript
// Test discovery from UI
// Verify discovered applications appear in list
// Verify tech stack badges display correctly
```

#### 7.4 Update Diagnosis Page
```typescript
// Show tech-specific checks
// Group by category
// Display risk levels
// Show suggested fixes
```

**Acceptance Criteria:**
- All tech stacks visible in UI
- Filters work correctly
- Discovery from UI works
- Diagnosis results display correctly
- Healing actions accessible from UI

---

### Task 8: WordPress Migration (Days 15-21)

**Objective:** Migrate WordPress to universal plugin system

**Subtasks:**

#### 8.1 Create WordPress Plugin
```typescript
// backend/src/modules/healer/plugins/wordpress.plugin.ts
export class WordPressPlugin implements IStackPlugin {
  name = 'wordpress';
  version = '1.0.0';
  supportedVersions = ['5.x', '6.x'];
  
  async detect(server: Server, path: string): Promise<DetectionResult> {
    // Migrate existing detection logic
  }
  
  getDiagnosticChecks(): string[] {
    // Return all WordPress checks
    return [
      'wp_core_update',
      'wp_plugin_updates',
      'wp_theme_updates',
      'wp_database_check',
      'wp_permissions',
      'wp_debug_mode',
      'wp_plugin_conflicts'
    ];
  }
  
  async executeDiagnosticCheck(...): Promise<DiagnosticCheckResult> {
    // Migrate existing check logic
  }
  
  getHealingActions(): HealingAction[] {
    // Return all WordPress healing actions
  }
  
  async executeHealingAction(...): Promise<...> {
    // Migrate existing healing logic
  }
}
```

#### 8.2 Migrate WordPress Checks
- [ ] wp_core_update check
- [ ] wp_plugin_updates check
- [ ] wp_theme_updates check
- [ ] wp_database_check
- [ ] wp_permissions check
- [ ] wp_debug_mode check
- [ ] wp_plugin_conflicts check

#### 8.3 Migrate WordPress Healing Actions
- [ ] clear_cache action
- [ ] update_core action
- [ ] update_plugins action
- [ ] repair_database action
- [ ] fix_permissions action
- [ ] disable_debug action

#### 8.4 Test WordPress Plugin
```bash
# Test discovery
POST /api/v1/healer/applications/discover
{
  "serverId": "test-server-id",
  "paths": ["/var/www/wordpress"]
}

# Expected: techStack = "WORDPRESS", confidence > 0.95

# Test diagnosis
POST /api/v1/healer/applications/{wp-app-id}/diagnose

# Expected: 7 checks executed

# Test healing
POST /api/v1/healer/applications/{wp-app-id}/heal
{
  "actionName": "clear_cache"
}

# Expected: Cache cleared successfully
```

#### 8.5 Backward Compatibility Testing
- [ ] Existing WordPress sites still work
- [ ] Old endpoints still functional
- [ ] No data loss during migration
- [ ] Health scores match old system
- [ ] Healing actions produce same results

**Acceptance Criteria:**
- WordPress plugin fully functional
- All checks migrated
- All healing actions migrated
- Backward compatibility maintained
- No regressions in WordPress functionality

---

### Task 9: Unified Frontend (Days 22-24)

**Objective:** Create single interface for all tech stacks

**Subtasks:**

#### 9.1 Merge Site Lists
```typescript
// Show WordPress sites and applications in single list
// Use tech stack badges to differentiate
// Unified filtering and sorting
```

#### 9.2 Unified Detail View
```typescript
// Single detail view for all tech stacks
// Conditional rendering based on tech stack
// Show tech-specific information
```

#### 9.3 Unified Diagnosis View
```typescript
// Same layout for all tech stacks
// Tech-specific checks grouped by category
// Consistent risk level indicators
```

#### 9.4 Unified Configuration
```typescript
// Same healing mode selector
// Same circuit breaker settings
// Tech-specific advanced settings
```

**Acceptance Criteria:**
- Single unified interface
- All tech stacks supported
- Consistent UX across tech stacks
- No confusion between old/new systems
- Clear tech stack identification

---

### Task 10: Integration Testing (Days 25-28)

**Objective:** End-to-end testing of complete system

**Test Scenarios:**

#### 10.1 Full Workflow Test
```
1. Discover applications on server
2. Verify all tech stacks detected
3. Run diagnosis on each application
4. Verify health scores calculated
5. Execute healing actions
6. Verify healing successful
7. Re-run diagnosis
8. Verify health scores improved
```

#### 10.2 Multi-Application Test
```
1. Create server with 10+ applications
2. Mix of different tech stacks
3. Run discovery
4. Run diagnosis on all
5. Verify performance acceptable
6. Test concurrent operations
```

#### 10.3 Error Handling Test
```
1. Test with invalid server
2. Test with inaccessible applications
3. Test with failing checks
4. Test with failing healing actions
5. Verify error messages clear
6. Verify system remains stable
```

**Acceptance Criteria:**
- All workflows complete successfully
- Performance acceptable (diagnosis <30s per app)
- Error handling robust
- System stable under load
- No data corruption

---

### Task 11: Performance Testing (Days 29-30)

**Objective:** Verify system meets performance targets

**Performance Targets:**
- API Response Time: <200ms (p95)
- Discovery Time: <10s per path
- Diagnosis Time: <30s per application
- Healing Time: <2min per action
- Concurrent Users: 10+
- Concurrent Diagnoses: 5+

**Test Scenarios:**

#### 11.1 Load Testing
```
- 10 concurrent users
- 50 applications
- Continuous diagnosis requests
- Monitor response times
- Monitor resource usage
```

#### 11.2 Stress Testing
```
- 20 concurrent users
- 100 applications
- Rapid-fire requests
- Monitor for failures
- Monitor for memory leaks
```

**Acceptance Criteria:**
- All performance targets met
- No memory leaks
- No connection pool exhaustion
- Graceful degradation under load

---

### Task 12: Documentation (Days 31-35)

**Objective:** Complete all documentation

**Documents to Create/Update:**

#### 12.1 User Documentation
- [ ] Tech stack support matrix
- [ ] Healing modes explained
- [ ] Risk levels guide
- [ ] Troubleshooting guide
- [ ] FAQ

#### 12.2 Developer Documentation
- [ ] Plugin development guide
- [ ] Adding new tech stacks
- [ ] Creating custom checks
- [ ] Implementing healing strategies
- [ ] Testing guidelines

#### 12.3 Operations Documentation
- [ ] Deployment guide
- [ ] Migration runbook
- [ ] Monitoring setup
- [ ] Backup and recovery
- [ ] Performance tuning

#### 12.4 API Documentation
- [ ] All endpoints documented
- [ ] Request/response examples
- [ ] Error codes explained
- [ ] Authentication guide
- [ ] Rate limiting info

**Acceptance Criteria:**
- All documentation complete
- Examples tested and working
- Clear and easy to follow
- No outdated information

---

### Task 13: Final Testing & Bug Fixes (Days 36-42)

**Objective:** Final polish and bug fixes

**Activities:**
- [ ] Review all test results
- [ ] Fix any remaining bugs
- [ ] Performance optimization
- [ ] Security audit
- [ ] Code review
- [ ] Final integration testing
- [ ] User acceptance testing
- [ ] Deployment preparation

**Acceptance Criteria:**
- All tests passing
- No critical bugs
- Performance targets met
- Security audit passed
- Ready for production deployment

---

## 📊 Success Criteria

### Functional Requirements
- [ ] All 6 tech stacks supported (WordPress, Node.js, Laravel, PHP, Express, Next.js)
- [ ] Discovery works for all tech stacks
- [ ] Diagnosis works for all tech stacks
- [ ] Healing works for all tech stacks
- [ ] Health scoring accurate
- [ ] Circuit breaker functional
- [ ] Backward compatibility maintained

### Non-Functional Requirements
- [ ] API response time <200ms (p95)
- [ ] Diagnosis time <30s per application
- [ ] Support 100+ applications
- [ ] 80%+ test coverage
- [ ] Zero data loss
- [ ] <1 hour downtime for deployment

### Quality Requirements
- [ ] All code reviewed
- [ ] Security audit passed
- [ ] Performance testing completed
- [ ] Documentation complete
- [ ] User acceptance testing passed

---

## 🎯 Milestones

| Week | Milestone | Status |
|------|-----------|--------|
| Week 1 | Discovery & Diagnosis Testing Complete | ⏳ Pending |
| Week 2 | Bug Fixes & Improvements Complete | ⏳ Pending |
| Week 3 | Healing Actions Tested | ⏳ Pending |
| Week 4 | Frontend Integration Complete | ⏳ Pending |
| Week 5 | WordPress Migration Started | ⏳ Pending |
| Week 6 | WordPress Migration Complete | ⏳ Pending |

---

## 🚀 Getting Started

### Day 1 Actions
1. Review this plan
2. Setup test environment
3. Create test server in database
4. Deploy sample applications
5. Configure SSH access
6. Run first discovery test

### Quick Start Commands
```bash
# Start backend
cd backend
npm run start:dev

# Run test script
./test-plugins.sh

# Test discovery (replace with real server ID)
curl -X POST http://localhost:3001/api/v1/healer/applications/discover \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"serverId": "test-server-id", "paths": ["/var/www"]}'
```

---

## 📞 Support

**Questions?** Review these documents:
- UNIVERSAL_HEALER_REFACTORING_PLAN.md
- IMPLEMENTATION_VERIFICATION.md
- PHASE2.5_COMPLETION_REPORT.md

**Issues?** Check:
- Backend logs: `backend/logs/`
- Health endpoint: `GET /api/v1/healer/health`
- Test script: `./test-plugins.sh`

---

**Plan Created:** February 26, 2026  
**Status:** 🚀 **READY TO START**  
**Next Review:** March 5, 2026 (End of Week 1)

