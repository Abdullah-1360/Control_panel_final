# Implementation Next Steps

## Recent Fixes

### Bug Fix: SSH Authentication Failure in SiteDiscoveryService
**Date:** February 26, 2026  
**Status:** ✅ FIXED

**Problem:**
```
[SiteDiscoveryService] Failed to detect subdomains: Authentication failed - check credentials
```

**Root Cause:**
The `SSHExecutorService.buildSSHConfig()` method was using incorrect field names when accessing server credentials from the database:
- Used: `server.privateKey` (doesn't exist)
- Should be: `server.encryptedPrivateKey` (actual database field)
- Used: `server.passphrase` (doesn't exist)
- Should be: `server.encryptedPassphrase` (actual database field)
- Used: `server.password` (doesn't exist)
- Should be: `server.encryptedPassword` (actual database field)

**Solution:**
Updated `backend/src/modules/healer/services/ssh-executor.service.ts` line 165-180 to use correct field names:
```typescript
// Before (WRONG):
if (server.privateKey) {
  config.privateKey = await this.encryptionService.decrypt(server.privateKey);
  if (server.passphrase) {
    config.passphrase = await this.encryptionService.decrypt(server.passphrase);
  }
} else if (server.password) {
  config.password = await this.encryptionService.decrypt(server.password);
}

// After (CORRECT):
if (server.encryptedPrivateKey) {
  config.privateKey = await this.encryptionService.decrypt(server.encryptedPrivateKey);
  if (server.encryptedPassphrase) {
    config.passphrase = await this.encryptionService.decrypt(server.encryptedPassphrase);
  }
} else if (server.encryptedPassword) {
  config.password = await this.encryptionService.decrypt(server.encryptedPassword);
}
```

**Impact:**
- All SSH-based operations in the Universal Healer module will now work correctly
- Site discovery will successfully authenticate
- Subdomain detection will work
- Diagnostic checks will be able to execute SSH commands
- Healing actions will be able to execute SSH commands

**Testing:**
The fix should resolve the authentication error. The next subdomain detection attempt should succeed.

---

## Phase 2: Next Implementation Steps

### 1. WordPress Plugin Implementation (2-3 weeks)
**Priority:** P0 (CRITICAL)

**Tasks:**
- [ ] Create `WordPressStackPlugin` class extending `StackPluginBase`
- [ ] Implement WordPress-specific diagnostic checks:
  - [ ] Core file integrity check (compare with WordPress.org checksums)
  - [ ] Plugin status check (active, inactive, must-use)
  - [ ] Theme status check (active theme, parent/child)
  - [ ] Database connectivity check
  - [ ] wp-config.php validation (DB credentials, salts, debug mode)
  - [ ] .htaccess validation (permalink structure, security rules)
  - [ ] wp-content permissions check
  - [ ] PHP version compatibility check
  - [ ] Memory limit check (WP_MEMORY_LIMIT)
  - [ ] Upload directory permissions
- [ ] Implement WordPress healing strategies:
  - [ ] Core file repair (download and replace corrupted files)
  - [ ] Plugin disable/enable (deactivate problematic plugins)
  - [ ] Theme switch (fallback to default theme)
  - [ ] Database repair (wp db repair command)
  - [ ] Permission fixes (chmod/chown for wp-content, uploads)
  - [ ] Clear cache (object cache, transients)
  - [ ] Regenerate .htaccess
  - [ ] Update salts in wp-config.php
- [ ] Register plugin with PluginRegistryService
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Update documentation

**Acceptance Criteria:**
- WordPress sites can be diagnosed with 15+ checks
- All checks return proper risk levels
- Healing strategies can fix common WordPress issues
- Test coverage >80%
- No breaking changes to existing code

---

### 2. MySQL Diagnostic Plugin (1-2 weeks)
**Priority:** P1 (HIGH)

**Tasks:**
- [ ] Create `MySQLDiagnosticPlugin` class extending `StackPluginBase`
- [ ] Implement MySQL diagnostic checks:
  - [ ] Connection status (can connect to MySQL)
  - [ ] Table integrity (CHECK TABLE for all tables)
  - [ ] Index health (check for missing indexes)
  - [ ] Query performance (slow query log analysis)
  - [ ] Database size (check disk usage)
  - [ ] Replication status (if applicable)
  - [ ] InnoDB status (buffer pool, log files)
  - [ ] User permissions (check grants)
- [ ] Implement MySQL healing strategies:
  - [ ] Table repair (REPAIR TABLE)
  - [ ] Index rebuild (DROP INDEX + CREATE INDEX)
  - [ ] Connection pool reset (FLUSH HOSTS)
  - [ ] Optimize tables (OPTIMIZE TABLE)
  - [ ] Clear query cache (RESET QUERY CACHE)
- [ ] Register plugin with PluginRegistryService
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Update documentation

**Acceptance Criteria:**
- MySQL databases can be diagnosed with 8+ checks
- All checks return proper risk levels
- Healing strategies can fix common MySQL issues
- Test coverage >80%
- Works with WordPress and other tech stacks

---

### 3. Frontend Updates (1-2 weeks)
**Priority:** P1 (HIGH)

**Tasks:**
- [ ] Update main healer page (`/healer/page.tsx`):
  - [ ] Change "Sites" to "Applications"
  - [ ] Add tech stack filter dropdown
  - [ ] Add tech stack badges to application cards
  - [ ] Show "Coming Soon" for non-WordPress stacks
  - [ ] Update discovery button to "Discover Applications"
- [ ] Update diagnosis page (`/healer/sites/[id]/diagnose/page.tsx`):
  - [ ] Show tech stack badge at top
  - [ ] Display diagnostic results grouped by category
  - [ ] Show risk levels with color coding
  - [ ] Add health score visualization (0-100)
  - [ ] Update healing mode selector (MANUAL/SEMI_AUTO/FULL_AUTO)
- [ ] Create `DiscoverApplicationsModal` component:
  - [ ] Server selection dropdown
  - [ ] Tech stack selection (WordPress, Node.js, PHP, etc.)
  - [ ] Auto-detect option
  - [ ] Discovery progress indicator
- [ ] Create `ApplicationCard` component:
  - [ ] Tech stack badge
  - [ ] Health score indicator
  - [ ] Last diagnosed timestamp
  - [ ] Quick actions (Diagnose, Configure, Delete)
- [ ] Create API integration layer:
  - [ ] `useApplications` hook (React Query)
  - [ ] `useDiagnosis` hook (React Query)
  - [ ] `useHealingExecution` hook (React Query)
  - [ ] API client functions
- [ ] Write component tests
- [ ] Update documentation

**Acceptance Criteria:**
- UI shows universal terminology (Applications, not Sites)
- Tech stack badges visible everywhere
- Health score visualization works
- Diagnostic results grouped by category
- Healing mode selector shows correct options
- All components tested
- Responsive design maintained

---

### 4. Node.js Plugin Implementation (2-3 weeks)
**Priority:** P2 (MEDIUM)

**Tasks:**
- [ ] Create `NodeJSStackPlugin` class extending `StackPluginBase`
- [ ] Implement Node.js-specific diagnostic checks:
  - [ ] package.json validation
  - [ ] node_modules integrity
  - [ ] npm/yarn/pnpm version check
  - [ ] Process status (PM2, systemd, etc.)
  - [ ] Port availability
  - [ ] Environment variables check
  - [ ] Log file analysis
  - [ ] Memory leaks detection
- [ ] Implement Node.js healing strategies:
  - [ ] npm install (reinstall dependencies)
  - [ ] Process restart (PM2 restart, systemd restart)
  - [ ] Clear cache (npm cache clean)
  - [ ] Update dependencies (npm update)
- [ ] Register plugin with PluginRegistryService
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Update documentation

**Acceptance Criteria:**
- Node.js applications can be diagnosed with 8+ checks
- All checks return proper risk levels
- Healing strategies can fix common Node.js issues
- Test coverage >80%
- Works with Express, Next.js, and other Node.js frameworks

---

### 5. PHP/Laravel Plugin Implementation (2-3 weeks)
**Priority:** P2 (MEDIUM)

**Tasks:**
- [ ] Create `PHPStackPlugin` class extending `StackPluginBase`
- [ ] Create `LaravelStackPlugin` class extending `PHPStackPlugin`
- [ ] Implement PHP-specific diagnostic checks:
  - [ ] PHP version check
  - [ ] composer.json validation
  - [ ] vendor directory integrity
  - [ ] PHP extensions check
  - [ ] php.ini configuration check
  - [ ] Error log analysis
  - [ ] Opcache status
- [ ] Implement Laravel-specific diagnostic checks:
  - [ ] .env file validation
  - [ ] Artisan commands availability
  - [ ] Database migrations status
  - [ ] Queue worker status
  - [ ] Cache status
  - [ ] Storage permissions
- [ ] Implement PHP healing strategies:
  - [ ] composer install
  - [ ] Clear opcache
  - [ ] Fix permissions
- [ ] Implement Laravel healing strategies:
  - [ ] php artisan cache:clear
  - [ ] php artisan config:clear
  - [ ] php artisan route:clear
  - [ ] php artisan view:clear
  - [ ] php artisan queue:restart
- [ ] Register plugins with PluginRegistryService
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Update documentation

**Acceptance Criteria:**
- PHP applications can be diagnosed with 7+ checks
- Laravel applications can be diagnosed with 13+ checks
- All checks return proper risk levels
- Healing strategies can fix common PHP/Laravel issues
- Test coverage >80%

---

### 6. Testing & Documentation (1 week)
**Priority:** P1 (HIGH)

**Tasks:**
- [ ] Write unit tests for all plugins
- [ ] Write integration tests for plugin lifecycle
- [ ] Write E2E tests for diagnostic flow
- [ ] Write E2E tests for healing execution
- [ ] Update API documentation (Swagger)
- [ ] Write plugin development guide
- [ ] Write healing strategy guide
- [ ] Write deployment guide
- [ ] Update README with Universal Healer features

**Acceptance Criteria:**
- Test coverage >80% for all modules
- All E2E tests passing
- API documentation complete
- Plugin development guide complete
- Deployment guide complete

---

## Known Issues to Address

### 1. Frontend Not Updated
**Status:** ⏳ Pending  
**Priority:** P1 (HIGH)  
**Estimated Time:** 1-2 weeks

The frontend still uses old terminology and doesn't show tech stacks. This needs to be updated to match the new universal architecture.

### 2. No Tech Stack Plugins Yet
**Status:** ⏳ Pending  
**Priority:** P0 (CRITICAL)  
**Estimated Time:** 2-3 weeks per plugin

Only the framework is implemented. WordPress plugin needs to be created first, followed by MySQL, Node.js, PHP, and Laravel plugins.

### 3. No Healing Strategies Yet
**Status:** ⏳ Pending  
**Priority:** P0 (CRITICAL)  
**Estimated Time:** Included in plugin implementation

Only the framework is implemented. Actual healing actions need to be defined for each tech stack.

### 4. No Backup Strategies Yet
**Status:** ⏳ Pending  
**Priority:** P1 (HIGH)  
**Estimated Time:** 1 week

Backup strategies need to be implemented before healing actions can be executed safely.

---

## Timeline Estimate

**Phase 2 Total Duration:** 8-12 weeks

**Week 1-3:** WordPress Plugin Implementation  
**Week 4-5:** MySQL Diagnostic Plugin  
**Week 6-7:** Frontend Updates  
**Week 8-10:** Node.js Plugin Implementation  
**Week 11-13:** PHP/Laravel Plugin Implementation  
**Week 14:** Testing & Documentation

**Parallel Work Opportunities:**
- Frontend updates can be done in parallel with plugin implementation
- MySQL plugin can be done in parallel with WordPress plugin
- Testing can be done incrementally as each plugin is completed

---

## Success Metrics

**Phase 2 Goals:**
- ✅ WordPress plugin fully functional with 15+ checks
- ✅ MySQL plugin fully functional with 8+ checks
- ✅ Frontend updated with universal terminology
- ✅ Health score visualization working
- ✅ Diagnostic results grouped by category
- ✅ Healing mode selector working
- ✅ Test coverage >80% for all modules
- ✅ API documentation complete
- ✅ Plugin development guide complete

**Phase 2 Metrics:**
- API response time: <200ms (p95)
- Diagnostic check execution: <5 seconds per check
- Healing action execution: <30 seconds per action
- Test coverage: >80%
- TypeScript errors: 0
- Frontend Lighthouse score: >90

---

**Last Updated:** February 26, 2026  
**Status:** Phase 1 Complete, Phase 2 Planning

