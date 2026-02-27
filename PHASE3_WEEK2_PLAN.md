# Phase 3 Week 2: Frontend Integration & Healing Actions

**Date:** February 26, 2026  
**Status:** 🚀 **STARTING NOW**  
**Previous:** Week 1 Complete (Discovery & Diagnosis Testing)  
**Progress:** 18% → Target 36% (Week 2 of 6)

---

## 📋 Week 2 Overview

**Duration:** 7 days (Feb 26 - Mar 4, 2026)  
**Focus:** Frontend integration and healing actions testing

**Objectives:**
1. ✅ Test frontend with real diagnosis data
2. ✅ Fix any API response format mismatches
3. ✅ Implement healing actions execution
4. ✅ Test healing for all tech stacks
5. ✅ Verify circuit breaker functionality
6. ✅ Performance optimization

---

## 🎯 Day-by-Day Plan

### Day 1: Frontend Testing & API Fixes (Today)

**Morning Tasks:**
1. Start frontend dev server
2. Navigate to /healer page
3. Verify test applications visible
4. Test "Diagnose" button on each application
5. Identify API response format issues

**Afternoon Tasks:**
1. Fix API response format mismatches
2. Update DiagnosePage component if needed
3. Test diagnosis results display
4. Verify health score visualization
5. Test filters and search

**Expected Issues:**
- API response format may not match frontend expectations
- Diagnostic results structure may need adjustment
- Health score calculation display

**Success Criteria:**
- Frontend loads without errors
- All 5 test applications visible
- Diagnosis button works
- Results display correctly
- Health scores show accurately

---

### Day 2: Healing Actions Implementation

**Tasks:**
1. Review healing actions for each plugin
2. Create healing execution endpoint (if not exists)
3. Test healing action execution via API
4. Verify healing results stored in database
5. Test backup creation for MEDIUM+ risk actions

**Test Cases:**

#### NodeJS Healing
```bash
# Test npm_install
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "npm_install"
}

# Expected: Dependencies installed, no backup required
```

#### Laravel Healing
```bash
# Test cache_clear
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "cache_clear"
}

# Expected: Caches cleared successfully
```

#### PHP Generic Healing
```bash
# Test fix_permissions
POST /api/v1/healer/applications/{id}/heal
{
  "actionName": "fix_permissions"
}

# Expected: Permissions fixed
```

**Success Criteria:**
- All healing actions execute successfully
- Backups created for MEDIUM+ risk actions
- Execution results logged
- Database records created

---

### Day 3: Frontend Healing Integration

**Tasks:**
1. Add healing actions UI to DiagnosePage
2. Display available healing actions per check
3. Implement "Fix" button for each failed check
4. Show healing progress/status
5. Display healing results

**UI Components Needed:**
- HealingActionButton component
- HealingProgressModal component
- HealingResultsCard component

**Success Criteria:**
- Healing actions visible in UI
- "Fix" buttons work correctly
- Progress shown during healing
- Results displayed after completion

---

### Day 4: Circuit Breaker Testing

**Tasks:**
1. Test circuit breaker with failing healing actions
2. Verify max attempts limit (default: 3)
3. Test cooldown period enforcement
4. Verify circuit breaker reset after cooldown
5. Test manual circuit breaker reset

**Test Scenarios:**

#### Max Attempts Test
```
1. Set maxHealingAttempts = 3
2. Trigger healing that fails
3. Verify circuit breaker trips after 3 attempts
4. Verify cooldown period enforced (default: 1 hour)
```

#### Cooldown Test
```
1. Trip circuit breaker
2. Attempt healing before cooldown expires
3. Verify healing blocked
4. Wait for cooldown to expire
5. Verify healing allowed again
```

**Success Criteria:**
- Circuit breaker trips after max attempts
- Cooldown period enforced correctly
- Healing blocked during cooldown
- Circuit breaker resets after cooldown
- Manual reset works

---

### Day 5: Performance Optimization

**Tasks:**
1. Implement parallel check execution
2. Add SSH connection pooling
3. Optimize database queries
4. Add caching for frequently accessed data
5. Measure performance improvements

**Performance Targets:**
- Diagnosis time: <30s per application (currently ~25-30s)
- Target: <10s with parallel execution
- API response time: <200ms (p95)
- Concurrent diagnoses: 5+

**Optimization Strategies:**
1. **Parallel Execution:** Run checks concurrently instead of sequentially
2. **Connection Pooling:** Reuse SSH connections between checks
3. **Caching:** Cache server connection details
4. **Batch Operations:** Group similar checks together

**Success Criteria:**
- Diagnosis time reduced to <10s
- API response time <200ms
- Support 5+ concurrent diagnoses
- No connection pool exhaustion

---

### Day 6: Bug Fixes & Polish

**Tasks:**
1. Review all test results from Week 1-2
2. Fix any remaining bugs
3. Improve error messages
4. Add more detailed logging
5. Update documentation

**Common Issues to Address:**
- SSH timeout errors
- Connection pool exhaustion
- Race conditions in concurrent operations
- Memory leaks in long-running processes

**Success Criteria:**
- All critical bugs fixed
- Error messages clear and actionable
- Logging comprehensive
- Documentation updated

---

### Day 7: Integration Testing & Documentation

**Tasks:**
1. End-to-end testing of complete workflow
2. Test all tech stacks together
3. Verify concurrent operations
4. Performance testing under load
5. Update documentation

**Test Workflow:**
```
1. Discover applications on server
2. Run diagnosis on all applications
3. Execute healing actions on failed checks
4. Re-run diagnosis to verify fixes
5. Verify health scores improved
```

**Success Criteria:**
- All workflows complete successfully
- Performance targets met
- System stable under load
- Documentation complete

---

## 🔧 Technical Implementation

### 1. Healing Actions Endpoint

**Backend Implementation:**
```typescript
// backend/src/modules/healer/controllers/application.controller.ts

@Post(':id/heal')
@RequirePermissions('healer', 'heal')
async heal(
  @Param('id') id: string,
  @Body() healDto: HealApplicationDto,
) {
  return this.applicationService.heal(id, healDto.actionName);
}
```

**Service Implementation:**
```typescript
// backend/src/modules/healer/services/application.service.ts

async heal(applicationId: string, actionName: string) {
  const application = await this.findOne(applicationId);
  const server = await this.prisma.servers.findUnique({
    where: { id: application.serverId },
  });

  const plugin = this.pluginRegistry.getPlugin(application.techStack);
  if (!plugin) {
    throw new NotFoundException(`No plugin found for tech stack: ${application.techStack}`);
  }

  // Check circuit breaker
  const canHeal = await this.checkCircuitBreaker(applicationId, actionName);
  if (!canHeal) {
    throw new BadRequestException('Circuit breaker is open. Please wait before retrying.');
  }

  // Execute healing action
  const result = await plugin.executeHealingAction(actionName, application, server);

  // Store healing result
  await this.prisma.healing_actions.create({
    data: {
      applicationId,
      actionName,
      status: result.success ? 'SUCCESS' : 'FAILED',
      message: result.message,
      details: result.details || {},
      executedAt: new Date(),
    },
  });

  // Update circuit breaker
  await this.updateCircuitBreaker(applicationId, actionName, result.success);

  return result;
}
```

### 2. Parallel Check Execution

**Current Implementation (Sequential):**
```typescript
// Execute each check sequentially
for (const checkName of checkNames) {
  const result = await plugin.executeDiagnosticCheck(checkName, application, server);
  results.push(result);
}
```

**Optimized Implementation (Parallel):**
```typescript
// Execute all checks in parallel
const checkPromises = checkNames.map(checkName =>
  plugin.executeDiagnosticCheck(checkName, application, server)
    .catch(error => ({
      checkName,
      category: 'SYSTEM',
      status: 'ERROR',
      severity: 'MEDIUM',
      message: `Check failed: ${error.message}`,
      executionTime: 0,
    }))
);

const results = await Promise.all(checkPromises);
```

**Expected Performance Improvement:**
- Current: 6 checks × 4s = 24s
- Optimized: max(6 checks) = ~5s (80% reduction)

### 3. SSH Connection Pooling

**Implementation:**
```typescript
// backend/src/modules/healer/services/ssh-executor.service.ts

private connectionPool: Map<string, SSHConnection> = new Map();

async getConnection(serverId: string): Promise<SSHConnection> {
  if (this.connectionPool.has(serverId)) {
    return this.connectionPool.get(serverId)!;
  }

  const connection = await this.createConnection(serverId);
  this.connectionPool.set(serverId, connection);
  
  // Auto-cleanup after 5 minutes of inactivity
  setTimeout(() => {
    this.connectionPool.delete(serverId);
    connection.close();
  }, 5 * 60 * 1000);

  return connection;
}
```

### 4. Circuit Breaker Implementation

**Database Schema:**
```prisma
model circuit_breaker {
  id            String   @id @default(uuid())
  applicationId String
  actionName    String
  failureCount  Int      @default(0)
  lastFailureAt DateTime?
  isOpen        Boolean  @default(false)
  cooldownUntil DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([applicationId, actionName])
}
```

**Logic:**
```typescript
async checkCircuitBreaker(applicationId: string, actionName: string): Promise<boolean> {
  const breaker = await this.prisma.circuit_breaker.findUnique({
    where: {
      applicationId_actionName: { applicationId, actionName },
    },
  });

  if (!breaker) return true; // No breaker = allow

  if (breaker.isOpen) {
    // Check if cooldown expired
    if (breaker.cooldownUntil && new Date() > breaker.cooldownUntil) {
      // Reset breaker
      await this.prisma.circuit_breaker.update({
        where: { id: breaker.id },
        data: {
          isOpen: false,
          failureCount: 0,
          cooldownUntil: null,
        },
      });
      return true;
    }
    return false; // Still in cooldown
  }

  return true; // Breaker closed = allow
}

async updateCircuitBreaker(
  applicationId: string,
  actionName: string,
  success: boolean,
): Promise<void> {
  const breaker = await this.prisma.circuit_breaker.upsert({
    where: {
      applicationId_actionName: { applicationId, actionName },
    },
    create: {
      applicationId,
      actionName,
      failureCount: success ? 0 : 1,
      lastFailureAt: success ? null : new Date(),
      isOpen: false,
    },
    update: {
      failureCount: success ? 0 : { increment: 1 },
      lastFailureAt: success ? null : new Date(),
    },
  });

  // Trip breaker if max attempts reached
  if (!success && breaker.failureCount >= 3) {
    await this.prisma.circuit_breaker.update({
      where: { id: breaker.id },
      data: {
        isOpen: true,
        cooldownUntil: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
  }
}
```

---

## 📊 Success Metrics

### Week 2 Targets

**Functionality:**
- ✅ Frontend displays all 5 test applications
- ✅ Diagnosis works from UI
- ✅ Healing actions execute successfully
- ✅ Circuit breaker prevents infinite loops
- ✅ All tech stacks supported

**Performance:**
- ✅ Diagnosis time <10s (with parallel execution)
- ✅ API response time <200ms (p95)
- ✅ Support 5+ concurrent diagnoses
- ✅ No connection pool exhaustion

**Quality:**
- ✅ All critical bugs fixed
- ✅ Error messages clear
- ✅ Logging comprehensive
- ✅ Documentation updated

---

## 🚀 Getting Started (Today)

### Step 1: Start Frontend
```bash
cd frontend
npm run dev
```

### Step 2: Navigate to Healer Page
```
http://localhost:3000/healer
```

### Step 3: Test Diagnosis
1. Click on any test application
2. Go to "Diagnostics" tab
3. Click "Run Diagnosis"
4. Verify results display correctly

### Step 4: Identify Issues
- Check browser console for errors
- Check network tab for API responses
- Note any format mismatches
- Document bugs found

---

## 📝 Notes

**Current State:**
- Backend: All plugins working, diagnosis tested
- Frontend: Components exist, needs testing
- API: Response format may need adjustment
- Database: All tables ready

**Known Issues:**
- API response format mismatch (to be confirmed)
- Healing actions endpoint may not exist
- Circuit breaker not implemented yet
- Parallel execution not implemented

**Next Steps After Week 2:**
- Week 3: WordPress migration
- Week 4: Final integration testing
- Week 5-6: Bug fixes and polish

---

**Plan Created:** February 26, 2026  
**Status:** 🚀 **READY TO START**  
**Next Review:** March 4, 2026 (End of Week 2)
