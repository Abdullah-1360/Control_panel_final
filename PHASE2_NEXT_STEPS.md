# Universal Healer - Phase 2: Plugin Implementation

## Overview
Phase 2 focuses on implementing tech stack plugins, starting with WordPress to maintain backward compatibility, followed by Node.js, Laravel, and other tech stacks.

## Phase 2 Goals
1. Implement WordPress plugin (maintain existing functionality)
2. Implement Node.js plugin
3. Implement Laravel plugin
4. Implement PHP Generic plugin
5. Implement Next.js plugin
6. Implement Express plugin
7. Implement MySQL diagnostic plugin
8. Update healer module to use new plugin system
9. Write comprehensive tests

## Priority Order

### P0 - Critical (Week 1-2)
1. **WordPress Plugin** - Maintain existing functionality
   - Detection logic (wp-config.php, wp-content, wp-includes)
   - WordPress-specific diagnostic checks
   - WordPress healing strategies
   - WordPress backup strategy
   - Register plugin in PluginRegistryService

### P1 - High Priority (Week 3-4)
2. **Node.js Plugin** - Second most common tech stack
   - Detection logic (package.json, node_modules, server.js)
   - Node.js diagnostic checks (npm audit, dependency check)
   - Node.js healing strategies (npm install, restart PM2)
   - Node.js backup strategy

3. **Update Healer Module** - Integrate new plugin system
   - Update healer.service.ts to use PluginRegistryService
   - Update diagnosis flow to use TechStackDetectorService
   - Update healing flow to use HealingStrategyEngineService
   - Maintain backward compatibility with wp_sites

### P2 - Medium Priority (Week 5-6)
4. **Laravel Plugin**
   - Detection logic (artisan, composer.json, app/, config/)
   - Laravel diagnostic checks (composer audit, config cache)
   - Laravel healing strategies (composer install, artisan optimize)
   - Laravel backup strategy

5. **PHP Generic Plugin**
   - Detection logic (index.php, composer.json without framework)
   - PHP diagnostic checks (PHP version, extensions, config)
   - PHP healing strategies (restart PHP-FPM, clear opcache)
   - PHP backup strategy

### P3 - Lower Priority (Week 7-8)
6. **Next.js Plugin**
   - Detection logic (next.config.js, .next/, pages/ or app/)
   - Next.js diagnostic checks (build errors, dependencies)
   - Next.js healing strategies (npm install, rebuild)
   - Next.js backup strategy

7. **Express Plugin**
   - Detection logic (express in package.json, app.js/server.js)
   - Express diagnostic checks (dependencies, routes)
   - Express healing strategies (npm install, restart)
   - Express backup strategy

8. **MySQL Diagnostic Plugin**
   - Detection logic (MySQL connection from application)
   - MySQL diagnostic checks (connection, slow queries, table health)
   - MySQL healing strategies (optimize tables, restart)
   - MySQL backup strategy

## Implementation Details

### WordPress Plugin Structure

```typescript
// backend/src/modules/healer/plugins/wordpress/wordpress.plugin.ts
export class WordPressPlugin extends StackPluginBase {
  readonly name = 'WordPress';
  readonly version = '1.0.0';
  readonly supportedVersions = ['5.0+', '6.0+'];
  readonly techStack = TechStack.WORDPRESS;
  
  async detect(server: any, path: string): Promise<DetectionResult> {
    // Check for wp-config.php, wp-content, wp-includes
    // Extract WordPress version
    // Return detection result with confidence
  }
  
  getDiagnosticChecks(): IDiagnosticCheck[] {
    return [
      // Shared checks
      new DiskSpaceCheck(this.sshExecutor),
      new MemoryCheck(this.sshExecutor),
      new CpuCheck(this.sshExecutor),
      new PermissionsCheck(this.sshExecutor),
      
      // WordPress-specific checks
      new WordPressVersionCheck(this.sshExecutor),
      new WordPressCoreIntegrityCheck(this.sshExecutor),
      new WordPressPluginCheck(this.sshExecutor),
      new WordPressThemeCheck(this.sshExecutor),
      new WordPressDatabaseCheck(this.sshExecutor),
      new WordPressPerformanceCheck(this.sshExecutor),
    ];
  }
  
  getHealingStrategies(): IHealingStrategy[] {
    return [
      new WordPressCoreRepairStrategy(),
      new WordPressPluginRepairStrategy(),
      new WordPressThemeRepairStrategy(),
      new WordPressDatabaseRepairStrategy(),
      new WordPressPermissionRepairStrategy(),
      new WordPressCacheRepairStrategy(),
    ];
  }
  
  getBackupStrategy(): IBackupStrategy {
    return new WordPressBackupStrategy();
  }
}
```

### WordPress-Specific Diagnostic Checks

1. **WordPressVersionCheck**
   - Check WordPress version
   - Compare with latest stable version
   - Warn if outdated or unsupported

2. **WordPressCoreIntegrityCheck**
   - Verify core files haven't been modified
   - Check for missing core files
   - Detect malware in core files

3. **WordPressPluginCheck**
   - List installed plugins
   - Check for outdated plugins
   - Check for vulnerable plugins
   - Check for deactivated plugins

4. **WordPressThemeCheck**
   - List installed themes
   - Check for outdated themes
   - Check for vulnerable themes
   - Check for unused themes

5. **WordPressDatabaseCheck**
   - Check database connection
   - Check database size
   - Check for corrupted tables
   - Check for orphaned data

6. **WordPressPerformanceCheck**
   - Check for caching plugins
   - Check for optimization plugins
   - Check for large media files
   - Check for slow queries

### WordPress Healing Strategies

1. **WordPressCoreRepairStrategy**
   - Repair corrupted core files
   - Update WordPress core
   - Fix file permissions

2. **WordPressPluginRepairStrategy**
   - Update plugins
   - Deactivate problematic plugins
   - Remove vulnerable plugins

3. **WordPressThemeRepairStrategy**
   - Update themes
   - Switch to default theme if broken
   - Remove vulnerable themes

4. **WordPressDatabaseRepairStrategy**
   - Repair corrupted tables
   - Optimize database
   - Clean up orphaned data

5. **WordPressPermissionRepairStrategy**
   - Fix file permissions (644 for files, 755 for directories)
   - Fix ownership
   - Secure wp-config.php (400)

6. **WordPressCacheRepairStrategy**
   - Clear object cache
   - Clear page cache
   - Clear transients

### Node.js Plugin Structure

```typescript
// backend/src/modules/healer/plugins/nodejs/nodejs.plugin.ts
export class NodeJsPlugin extends StackPluginBase {
  readonly name = 'Node.js';
  readonly version = '1.0.0';
  readonly supportedVersions = ['14+', '16+', '18+', '20+'];
  readonly techStack = TechStack.NODEJS;
  
  async detect(server: any, path: string): Promise<DetectionResult> {
    // Check for package.json, node_modules, server.js/index.js
    // Extract Node.js version
    // Return detection result with confidence
  }
  
  getDiagnosticChecks(): IDiagnosticCheck[] {
    return [
      // Shared checks
      new DiskSpaceCheck(this.sshExecutor),
      new MemoryCheck(this.sshExecutor),
      new CpuCheck(this.sshExecutor),
      new PermissionsCheck(this.sshExecutor),
      
      // Node.js-specific checks
      new NodeVersionCheck(this.sshExecutor),
      new NodeDependencyCheck(this.sshExecutor),
      new NodeSecurityCheck(this.sshExecutor),
      new NodeProcessCheck(this.sshExecutor),
      new NodePerformanceCheck(this.sshExecutor),
    ];
  }
  
  getHealingStrategies(): IHealingStrategy[] {
    return [
      new NodeDependencyRepairStrategy(),
      new NodeProcessRepairStrategy(),
      new NodeSecurityRepairStrategy(),
      new NodePerformanceRepairStrategy(),
    ];
  }
  
  getBackupStrategy(): IBackupStrategy {
    return new NodeJsBackupStrategy();
  }
}
```

## Integration with Existing Healer Module

### Update healer.service.ts

```typescript
// Before (WordPress-specific)
async diagnose(siteId: string, triggeredBy?: string, subdomain?: string) {
  // WordPress-specific diagnosis logic
}

// After (Universal)
async diagnose(applicationId: string, triggeredBy?: string) {
  // 1. Get application from database
  const application = await this.prisma.applications.findUnique({
    where: { id: applicationId },
    include: { servers: true },
  });
  
  // 2. Get plugin for tech stack
  const plugin = this.pluginRegistry.getPlugin(application.techStack);
  
  // 3. Get diagnostic checks from plugin
  const checks = plugin.getDiagnosticChecks();
  
  // 4. Execute all checks
  const results = await Promise.all(
    checks.map(check => check.execute(application, application.servers))
  );
  
  // 5. Store results in database
  await this.storeDiagnosticResults(applicationId, results);
  
  // 6. Determine healing plan
  const healingPlan = await this.healingStrategyEngine.determineHealingPlan(
    application,
    results,
    application.healingMode,
  );
  
  // 7. Return diagnosis with healing plan
  return { results, healingPlan };
}
```

## Testing Strategy

### Unit Tests
- Test each diagnostic check in isolation
- Test each healing strategy in isolation
- Test plugin detection logic
- Test healing strategy engine logic
- Mock SSH executor for fast tests

### Integration Tests
- Test full diagnosis flow with real SSH connections
- Test healing execution with real servers
- Test plugin registration and lifecycle
- Test tech stack detection with real applications

### E2E Tests
- Test complete workflow: detect → diagnose → heal → verify
- Test with multiple tech stacks
- Test healing modes (MANUAL, SUPERVISED, AUTO)
- Test rollback functionality

## Migration Strategy

### Backward Compatibility
1. Keep wp_sites table for existing WordPress sites
2. Gradually migrate wp_sites to applications table
3. Support both tables during transition period
4. Provide migration script for bulk migration

### Migration Script
```typescript
// backend/scripts/migrate-wp-sites-to-applications.ts
async function migrateWpSitesToApplications() {
  const wpSites = await prisma.wp_sites.findMany();
  
  for (const site of wpSites) {
    await prisma.applications.create({
      data: {
        serverId: site.serverId,
        name: site.domain,
        path: site.path,
        techStack: TechStack.WORDPRESS,
        techStackVersion: site.wpVersion,
        detectionMethod: DetectionMethod.MANUAL,
        detectionConfidence: 1.0,
        healingMode: site.healingMode,
        isHealerEnabled: site.isHealerEnabled,
        // ... other fields
      },
    });
  }
}
```

## Success Criteria

### Phase 2 Complete When:
- ✅ WordPress plugin implemented and tested
- ✅ Node.js plugin implemented and tested
- ✅ Laravel plugin implemented and tested
- ✅ Healer module updated to use plugin system
- ✅ Backward compatibility maintained
- ✅ Unit tests written (80%+ coverage)
- ✅ Integration tests written
- ✅ Manual testing with real servers successful
- ✅ Migration script tested
- ✅ Documentation updated

## Timeline

### Week 1-2: WordPress Plugin
- Day 1-2: Detection logic
- Day 3-5: Diagnostic checks
- Day 6-8: Healing strategies
- Day 9-10: Backup strategy, testing

### Week 3-4: Node.js Plugin + Integration
- Day 1-2: Node.js detection logic
- Day 3-5: Node.js diagnostic checks
- Day 6-7: Node.js healing strategies
- Day 8-9: Update healer module
- Day 10: Testing and bug fixes

### Week 5-6: Laravel + PHP Generic
- Day 1-3: Laravel plugin
- Day 4-6: PHP Generic plugin
- Day 7-10: Testing and refinement

### Week 7-8: Next.js + Express + MySQL
- Day 1-2: Next.js plugin
- Day 3-4: Express plugin
- Day 5-6: MySQL diagnostic plugin
- Day 7-10: Comprehensive testing

## Risk Mitigation

### Risks
1. **Breaking existing WordPress functionality**
   - Mitigation: Maintain backward compatibility, extensive testing
   
2. **SSH command failures on different OS**
   - Mitigation: Test on multiple OS (Ubuntu, CentOS, Debian)
   
3. **Performance degradation with multiple checks**
   - Mitigation: Run checks in parallel, implement timeouts
   
4. **Plugin conflicts or errors**
   - Mitigation: Isolate plugin errors, graceful degradation

## Next Actions

1. ✅ Review Phase 1 completion
2. ⏳ Start WordPress plugin implementation
3. ⏳ Create WordPress-specific diagnostic checks
4. ⏳ Create WordPress healing strategies
5. ⏳ Test WordPress plugin with real server
6. ⏳ Update healer module integration
7. ⏳ Write unit tests
8. ⏳ Proceed to Node.js plugin

---

**Status:** Ready to begin Phase 2  
**Next Task:** Implement WordPress Plugin  
**Estimated Completion:** 8 weeks from start
