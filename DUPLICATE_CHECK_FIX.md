# Duplicate Database Connection Check - Fixed

## Issue
Two DATABASE_CONNECTION checks were appearing in the diagnostics results.

## Root Cause
`DatabaseHealthService` was incorrectly configured to return `DATABASE_CONNECTION` instead of `DATABASE_HEALTH` in its `getCheckType()` and `canHandle()` methods.

```typescript
// BEFORE (INCORRECT)
getCheckType(): DiagnosisCheckType {
  return DiagnosisCheckType.DATABASE_CONNECTION; // ❌ Wrong!
}

canHandle(checkType: DiagnosisCheckType): boolean {
  return checkType === DiagnosisCheckType.DATABASE_CONNECTION; // ❌ Wrong!
}
```

This caused both `DatabaseConnectionService` and `DatabaseHealthService` to register for the same check type, resulting in duplicate checks.

## Fix Applied
Updated `DatabaseHealthService` to return the correct check type:

```typescript
// AFTER (CORRECT)
getCheckType(): DiagnosisCheckType {
  return DiagnosisCheckType.DATABASE_HEALTH; // ✅ Correct!
}

canHandle(checkType: DiagnosisCheckType): boolean {
  return checkType === DiagnosisCheckType.DATABASE_HEALTH; // ✅ Correct!
}
```

## Verification
- ✅ No duplicate check type registrations found
- ✅ DATABASE_CONNECTION properly handled by `DatabaseConnectionService`
- ✅ DATABASE_HEALTH properly handled by `DatabaseHealthService`
- ✅ Both checks properly registered in `UnifiedDiagnosisService`
- ✅ Both checks included in diagnosis profiles (FULL, LIGHT, QUICK)

## Files Modified
- `backend/src/modules/healer/services/checks/database-health.service.ts`

## Expected Behavior After Fix
- DATABASE_CONNECTION check: Tests basic database connectivity
- DATABASE_HEALTH check: Analyzes database optimization, size, transients, revisions, and orphaned data
- No duplicate checks in diagnosis results

## Testing
Run a full diagnosis and verify:
1. Only one DATABASE_CONNECTION check appears
2. DATABASE_HEALTH check appears separately
3. Both checks show different results and purposes
