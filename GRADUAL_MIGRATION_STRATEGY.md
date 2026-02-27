# Universal Healer - Gradual Migration Strategy

## Decision: Option 1 - Gradual Migration

**Date:** February 26, 2026  
**Status:** APPROVED - Implementation in Progress

---

## Overview

Migrate from WordPress-specific healer to Universal Healer gradually across 3 phases, ensuring zero downtime and no breaking changes.

---

## Current State (Phase 2 Complete)

### Working Systems
✅ **WordPress Healer** - Fully Functional
- Endpoint: `/api/v1/healer/sites`
- Database: `wp_sites` table
- Features: Discovery, diagnosis, healing, rollback, circuit breaker
- Frontend: State-based routing with HealerView component
- Status: Production-ready, all features working

❌ **Universal Healer** - Placeholder Only
- Endpoint: `/api/v1/healer/applications`
- Database: `applications` table
- Features: CRUD operations only, no discovery/diagnosis
- Frontend: Components created but not used
- Status: Not production-ready, awaiting Phase 3 plugins

### Code Duplication
- Two separate endpoints doing similar things
- Two separate database tables
- Two separate frontend implementations
- Reason: Tech stack detection requires per-stack plugins (Phase 3)

---

## Migration Phases

### Phase 2.5: Current State (NOW)
**Duration:** Immediate  
**Goal:** Document and stabilize current WordPress functionality

**Tasks:**
- [x] Keep WordPress healer fully functional
- [x] Document migration strategy
- [x] Update all related documentation
- [ ] Add banner indicating Phase 3 features coming soon
- [ ] Mark universal endpoints as "preview" in API docs

**Deliverables:**
- WordPress healer working perfectly
- Clear documentation of migration path
- No breaking changes

---

### Phase 3: Plugin Implementation (4-6 weeks)
**Goal:** Implement tech stack plugins and migrate WordPress to universal system

#### Week 1-2: WordPress Plugin
**Tasks:**
1. Implement WordPress plugin for universal system
2. Create migration script: `wp_sites` → `applications`
3. Test WordPress plugin with existing sites
4. Ensure feature parity with old system

**Validation:**
- All WordPress features work through new plugin
- Migration script tested on staging
- Rollback plan documented

#### Week 3-4: Additional Plugins
**Tasks:**
1. Implement Node.js plugin
2. Implement PHP Generic plugin
3. Implement Laravel plugin
4. Test discovery for each tech stack

**Validation:**
- Each plugin can discover its tech stack
- Diagnostic checks work for each stack
- No interference between plugins

#### Week 5-6: Unified Frontend
**Tasks:**
1. Update HealerView to fetch from BOTH endpoints
2. Merge WordPress sites and applications in UI
3. Show tech stack badges for all sites
4. Conditional rendering based on tech stack

**Validation:**
- All sites visible in unified view
- WordPress sites show full functionality
- New tech stacks show available features
- No UI regressions

---

### Phase 4: Deprecation & Cleanup (2-3 weeks)
**Goal:** Remove old WordPress-specific code and consolidate

#### Week 1: Dual System Operation
**Tasks:**
1. Run both systems in parallel
2. Monitor for issues
3. Collect user feedback
4. Fix any migration bugs

**Validation:**
- No data loss
- All features working
- Performance acceptable

#### Week 2: Deprecation
**Tasks:**
1. Mark `/api/v1/healer/sites` as deprecated
2. Add deprecation warnings in API responses
3. Update documentation
4. Notify users of upcoming changes

**Validation:**
- Deprecation notices visible
- Migration guide available
- Support channels ready

#### Week 3: Removal
**Tasks:**
1. Remove old `/api/v1/healer/sites` endpoints
2. Drop `wp_sites` table (after backup)
3. Remove old frontend components
4. Clean up unused code

**Validation:**
- All functionality in new system
- No references to old endpoints
- Database cleaned up
- Documentation updated

---

## Technical Implementation Plan

### Phase 2.5: Stabilization (NOW)

#### 1. Update HealerView Component
**File:** `frontend/components/healer/HealerView.tsx`

**Changes:**
```typescript
// Add banner at top
<Alert className="mb-4">
  <Info className="h-4 w-4" />
  <AlertDescription>
    Currently showing WordPress sites. Support for Node.js, PHP, Laravel, 
    Next.js, and Express coming in Phase 3!
  </AlertDescription>
</Alert>
```

#### 2. Update API Documentation
**File:** `backend/src/modules/healer/README.md`

**Add sections:**
- Current endpoints (WordPress)
- Preview endpoints (Universal)
- Migration timeline
- Breaking changes notice

#### 3. Add Health Check Endpoint
**File:** `backend/src/modules/healer/healer.controller.ts`

**New endpoint:**
```typescript
@Get('health')
async getHealth() {
  return {
    wordpress: { status: 'operational', version: '1.0' },
    universal: { status: 'preview', version: '0.1' },
    migration: { phase: '2.5', nextPhase: '3', eta: 'TBD' }
  };
}
```

---

### Phase 3: Plugin Implementation

#### 1. WordPress Plugin Structure
**File:** `backend/src/modules/healer/plugins/wordpress.plugin.ts`

```typescript
export class WordPressPlugin implements IStackPlugin {
  name = 'wordpress';
  version = '1.0.0';
  
  async discover(server: Server, paths: string[]): Promise<Application[]> {
    // Reuse existing WordPress discovery logic
    // Write to applications table instead of wp_sites
  }
  
  async diagnose(application: Application): Promise<DiagnosticResult[]> {
    // Reuse existing WordPress diagnostic checks
  }
  
  async heal(application: Application, issues: DiagnosticResult[]): Promise<HealingExecution> {
    // Reuse existing WordPress healing strategies
  }
}
```

#### 2. Migration Script
**File:** `backend/scripts/migrate-wp-sites-to-applications.ts`

```typescript
async function migrateWordPressSites() {
  const wpSites = await prisma.wp_sites.findMany();
  
  for (const site of wpSites) {
    await prisma.applications.create({
      data: {
        serverId: site.serverId,
        domain: site.domain,
        path: site.path,
        techStack: 'WORDPRESS',
        techStackVersion: site.wpVersion,
        detectionMethod: 'AUTO',
        healthStatus: site.healthStatus,
        healthScore: site.healthScore,
        isHealerEnabled: site.isHealerEnabled,
        healingMode: site.healingMode,
        metadata: {
          phpVersion: site.phpVersion,
          dbName: site.dbName,
          dbHost: site.dbHost,
          // Preserve all WordPress-specific data
        },
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      }
    });
  }
  
  console.log(`Migrated ${wpSites.length} WordPress sites`);
}
```

#### 3. Unified Frontend
**File:** `frontend/components/healer/UnifiedHealerView.tsx`

```typescript
export function UnifiedHealerView() {
  // Fetch BOTH endpoints
  const { data: wpSites } = useQuery(['healer-sites']);
  const { data: applications } = useQuery(['healer-applications']);
  
  // Merge and deduplicate
  const allSites = useMemo(() => {
    const wp = wpSites?.data?.map(site => ({
      ...site,
      techStack: 'WORDPRESS',
      source: 'legacy'
    })) || [];
    
    const apps = applications?.data || [];
    
    // Deduplicate by domain
    const merged = [...wp, ...apps];
    const unique = merged.filter((site, index, self) =>
      index === self.findIndex(s => s.domain === site.domain)
    );
    
    return unique;
  }, [wpSites, applications]);
  
  return (
    <div>
      {/* Show all sites with tech stack badges */}
      {allSites.map(site => (
        <SiteCard 
          key={site.id} 
          site={site}
          techStack={site.techStack}
        />
      ))}
    </div>
  );
}
```

---

### Phase 4: Cleanup

#### 1. Remove Old Endpoints
**File:** `backend/src/modules/healer/healer.controller.ts`

```typescript
// Remove all @Get('sites/*') and @Post('sites/*') endpoints
// Keep only @Get('applications/*') and @Post('applications/*')
```

#### 2. Drop Old Table
**File:** `backend/prisma/migrations/YYYYMMDD_drop_wp_sites.sql`

```sql
-- Backup first
CREATE TABLE wp_sites_backup AS SELECT * FROM wp_sites;

-- Then drop
DROP TABLE wp_sites CASCADE;
```

#### 3. Remove Old Components
**Files to remove:**
- `frontend/components/healer/SiteList.tsx` (old)
- `frontend/components/healer/SiteCard.tsx` (old)
- `frontend/components/healer/SiteDetailView.tsx` (old)

**Keep:**
- `frontend/components/healer/ApplicationList.tsx` (new)
- `frontend/components/healer/ApplicationCard.tsx` (new)
- `frontend/components/healer/ApplicationDetailView.tsx` (new)

---

## Risk Mitigation

### Data Loss Prevention
1. **Backup before migration:** Full database backup before Phase 3
2. **Dual write period:** Write to both tables during Phase 3
3. **Rollback plan:** Script to restore from backup if needed

### Zero Downtime
1. **Blue-green deployment:** Run old and new systems in parallel
2. **Feature flags:** Toggle between old and new systems
3. **Gradual rollout:** Migrate 10% → 50% → 100% of traffic

### Testing Strategy
1. **Unit tests:** All plugins have >80% coverage
2. **Integration tests:** Test migration script on staging
3. **E2E tests:** Test full user journeys with Playwright
4. **Load tests:** Ensure performance with 1000+ sites

---

## Success Criteria

### Phase 2.5 (Current)
- [x] WordPress healer fully functional
- [ ] Documentation updated
- [ ] Migration strategy approved
- [ ] No breaking changes

### Phase 3 (Plugins)
- [ ] WordPress plugin feature parity
- [ ] 3+ additional tech stacks supported
- [ ] Migration script tested and validated
- [ ] Unified frontend working

### Phase 4 (Cleanup)
- [ ] Old endpoints removed
- [ ] Old table dropped
- [ ] Code cleaned up
- [ ] Documentation complete

---

## Timeline

| Phase | Duration | Start Date | End Date | Status |
|-------|----------|------------|----------|--------|
| 2.5 - Stabilization | 1 week | Feb 26, 2026 | Mar 4, 2026 | In Progress |
| 3 - Plugins | 6 weeks | Mar 5, 2026 | Apr 15, 2026 | Not Started |
| 4 - Cleanup | 3 weeks | Apr 16, 2026 | May 6, 2026 | Not Started |
| **Total** | **10 weeks** | **Feb 26** | **May 6** | **10% Complete** |

---

## Communication Plan

### Internal Team
- Weekly status updates
- Migration progress dashboard
- Slack channel: #healer-migration

### Users
- Announcement: Phase 3 features coming soon
- Migration guide: How to prepare
- Support: Dedicated channel for questions

---

## Rollback Plan

### If Phase 3 Fails
1. Revert to Phase 2.5 (WordPress only)
2. Restore database from backup
3. Redeploy old frontend
4. Investigate issues before retry

### If Phase 4 Fails
1. Keep dual system running
2. Fix issues in new system
3. Retry cleanup when stable

---

## Next Steps (Immediate)

1. ✅ Document migration strategy (this file)
2. ⏳ Update related documentation
3. ⏳ Add "Phase 3 coming soon" banner to UI
4. ⏳ Create migration tracking dashboard
5. ⏳ Set up monitoring for both systems

---

**Status:** APPROVED - Ready for Implementation  
**Last Updated:** February 26, 2026  
**Next Review:** March 5, 2026
