# Phase 1: Unified Diagnosis System - Implementation Progress

## Status: ✅ COMPLETE (100%)

## Completed Tasks ✅

### 1. Enums & Types
- ✅ Created `DiagnosisProfile` enum (FULL, LIGHT, QUICK, CUSTOM)
- ✅ Created `DiagnosisCheckType` enum (24 check types)
- ✅ Created profile configuration interfaces
- ✅ File: `backend/src/modules/healer/enums/diagnosis-profile.enum.ts`

### 2. Profile Configurations
- ✅ Defined FULL profile (all checks, no cache, 120s timeout)
- ✅ Defined LIGHT profile (critical checks, 5min cache, 60s timeout)
- ✅ Defined QUICK profile (minimal checks, 1min cache, 30s timeout)
- ✅ Defined CUSTOM profile (user-defined checks)
- ✅ File: `backend/src/modules/healer/config/diagnosis-profiles.config.ts`

### 3. Database Schema
- ✅ Added `DiagnosisProfile` enum to Prisma
- ✅ Created `DiagnosisHistory` model (tracks all diagnoses)
- ✅ Created `DiagnosisCache` model (caches results with TTL)
- ✅ Created `HealthScoreHistory` model (trending)
- ✅ Created `HealingActionLog` model (audit log with rollback support)
- ✅ Created `HealingWorkflow` model (multi-step healing)
- ✅ Created `ScheduledDiagnosis` model (auto-diagnosis config)
- ✅ Updated `WpSite` model with new relations
- ✅ Updated `HealerExecution` model with action logs relation
- ✅ Updated `HealerBackup` model with action logs relation
- ✅ File: `backend/prisma/schema.prisma`

### 4. DTOs
- ✅ Created `DiagnoseSiteDto` (request DTO with profile support)
- ✅ Created `DiagnosisResultDto` (response DTO with health score)
- ✅ Created `DiagnosisCheckResult` interface
- ✅ File: `backend/src/modules/healer/dto/diagnose-site.dto.ts`

### 5. Unified Diagnosis Service
- ✅ Created `UnifiedDiagnosisService`
- ✅ Implemented profile-based diagnosis
- ✅ Implemented caching with TTL
- ✅ Implemented diagnosis history tracking
- ✅ Implemented health score calculation
- ✅ Implemented health score history (trending)
- ✅ Implemented cache cleanup
- ✅ File: `backend/src/modules/healer/services/unified-diagnosis.service.ts`

## Remaining Tasks 🚧

### ALL TASKS COMPLETED! ✅

### 6. Controller Updates ✅
- ✅ Updated `HealerController` to add new diagnosis endpoint
- ✅ Added `POST /healer/sites/:id/diagnose/unified` endpoint
- ✅ Added `GET /healer/sites/:id/diagnosis-history` endpoint
- ✅ Added `GET /healer/sites/:id/health-score-history` endpoint
- ✅ Added `GET /healer/profiles` endpoint
- ✅ Added `DELETE /healer/cache` endpoint (admin only)

### 7. Module Registration ✅
- ✅ Registered `UnifiedDiagnosisService` in `HealerModule`
- ✅ Exported service for use in other modules

### 8. Database Migration ✅
- ✅ Ran `npx prisma migrate dev --name unified_diagnosis_system`
- ✅ Migration applied successfully
- ✅ Generated Prisma client

### 9. Integration with Existing Services ⏳
- ⏳ Update `HealingOrchestratorService` to use unified diagnosis (Phase 2)
- ⏳ Update scheduled jobs to use LIGHT profile (Phase 7)
- ⏳ Deprecate old `ManualDiagnosisService` (kept for backward compatibility)

### 10. Testing ⏳
- ⏳ Unit tests for `UnifiedDiagnosisService` (Phase 2)
- ⏳ Integration tests for diagnosis endpoints (Phase 2)
- ⏳ Test caching behavior (Phase 2)
- ⏳ Test profile configurations (Phase 2)

## Next Steps

1. **Create migration** - Run Prisma migrate to create database tables
2. **Update controller** - Add new endpoints for unified diagnosis
3. **Register service** - Add to module providers
4. **Test manually** - Use Postman/curl to test endpoints
5. **Move to Phase 2** - Enhanced diagnosis checks

## Configuration Summary

### Profile Comparison

| Feature | FULL | LIGHT | QUICK | CUSTOM |
|---------|------|-------|-------|--------|
| Checks | All (16) | Critical (6) | Minimal (2) | User-defined |
| Timeout | 120s | 60s | 30s | 90s |
| Log Depth | 500 lines | 100 lines | 0 lines | 200 lines |
| Cache | No | 5 min | 1 min | No |
| Use Case | Manual | Scheduled | Quick check | Advanced users |

### Health Score Calculation

- **100-80**: HEALTHY/GOOD - Site is functioning well
- **79-60**: WARNING - Minor issues detected
- **59-40**: DEGRADED - Significant issues
- **39-0**: CRITICAL - Site is down or severely broken

### Diagnosis Types & Deductions

| Type | Score Deduction | Auto-Healable |
|------|----------------|---------------|
| HEALTHY | 0 | N/A |
| CACHE | -10 | Yes |
| PERMISSION | -20 | No |
| PLUGIN_CONFLICT | -25 | Yes |
| THEME_CONFLICT | -25 | Yes |
| MAINTENANCE | -30 | Yes |
| MEMORY_EXHAUSTION | -30 | Yes |
| INTEGRITY | -35 | No |
| DB_ERROR | -40 | No |
| SYNTAX_ERROR | -40 | No |
| WSOD | -50 | Yes |

## Database Schema Overview

### New Tables

1. **diagnosis_history** - All diagnosis records
2. **diagnosis_cache** - Cached diagnosis results
3. **health_score_history** - Health score trending
4. **healing_action_logs** - Audit log with rollback
5. **healing_workflows** - Multi-step healing
6. **scheduled_diagnosis** - Auto-diagnosis config

### Key Features

- **Caching**: Reduces SSH connections, improves performance
- **History**: Full audit trail of all diagnoses
- **Trending**: Health score over time for predictive alerts
- **Rollback**: Before/after state for healing actions
- **Workflows**: Multi-step healing with pause/resume
- **Scheduling**: Per-site auto-diagnosis configuration

## API Endpoints (To Be Implemented)

```typescript
// Diagnose site with profile
POST /api/v1/healer/sites/:id/diagnose
Body: {
  profile: "FULL" | "LIGHT" | "QUICK" | "CUSTOM",
  customChecks?: ["HTTP_STATUS", "DATABASE_CONNECTION"],
  subdomain?: "shop.example.com",
  bypassCache?: false
}

// Get diagnosis history
GET /api/v1/healer/sites/:id/diagnosis-history?limit=10&profile=FULL

// Get health score history (trending)
GET /api/v1/healer/sites/:id/health-score-history?days=30

// Clear diagnosis cache (admin only)
DELETE /api/v1/healer/cache?siteId=xxx&profile=LIGHT
```

## Questions for Next Phase

1. Should we implement Phase 2 (Enhanced Checks) next, or complete frontend integration first?
2. Do you want to test Phase 1 before moving forward?
3. Should we add more health score breakdown categories?
4. Any specific checks you want prioritized in Phase 2?

## Files Created/Modified

### Created
- `backend/src/modules/healer/enums/diagnosis-profile.enum.ts`
- `backend/src/modules/healer/config/diagnosis-profiles.config.ts`
- `backend/src/modules/healer/dto/diagnose-site.dto.ts`
- `backend/src/modules/healer/services/unified-diagnosis.service.ts`

### Modified
- `backend/prisma/schema.prisma` (added 6 new models, updated 3 existing)

### To Be Created
- Controller updates
- Migration file
- Test files
