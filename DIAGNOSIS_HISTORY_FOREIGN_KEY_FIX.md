# Diagnosis History Foreign Key Fix - COMPLETED

## Issue
Diagnosis was running successfully but failing when saving to `diagnosis_history` table with error:
```
Foreign key constraint violated: `diagnosis_history_siteId_fkey (index)`
```

## Root Cause
The `diagnosis_history` and `health_score_history` tables had foreign keys pointing to the old `wp_sites` table, but the universal healer system uses the new `applications` table. When diagnosis completed, it tried to save results with `applications.id` but the foreign key expected `wp_sites.id`.

## Solution Applied

### 1. Created Migration: `20260306112500_update_diagnosis_history_to_applications`
Updated both `diagnosis_history` and `health_score_history` tables to reference `applications` instead of `wp_sites`:

```sql
-- Delete orphaned records
DELETE FROM "diagnosis_history" 
WHERE "siteId" NOT IN (SELECT "id" FROM "applications");

DELETE FROM "health_score_history" 
WHERE "siteId" NOT IN (SELECT "id" FROM "applications");

-- Drop old foreign keys
ALTER TABLE "diagnosis_history" DROP CONSTRAINT "diagnosis_history_siteId_fkey";
ALTER TABLE "health_score_history" DROP CONSTRAINT "health_score_history_siteId_fkey";

-- Add new foreign keys to applications
ALTER TABLE "diagnosis_history" ADD CONSTRAINT "diagnosis_history_siteId_fkey" 
  FOREIGN KEY ("siteId") REFERENCES "applications"("id") ON DELETE CASCADE;

ALTER TABLE "health_score_history" ADD CONSTRAINT "health_score_history_siteId_fkey" 
  FOREIGN KEY ("siteId") REFERENCES "applications"("id") ON DELETE CASCADE;
```

### 2. Updated Prisma Schema
- Changed `diagnosis_history` relation from `wp_sites` to `applications`
- Changed `health_score_history` relation from `wp_sites` to `applications`
- Added relations to `applications` model:
  - `diagnosis_history[]`
  - `health_score_history[]`
- Removed these relations from `wp_sites` model (no longer needed)

### 3. Applied Migration
```bash
npx prisma migrate deploy
npx prisma generate
```

## Files Modified
1. `backend/prisma/schema.prisma` - Updated relations
2. `backend/prisma/migrations/20260306112500_update_diagnosis_history_to_applications/migration.sql` - New migration

## Testing Required
After restarting the backend:
1. Wait for auto-diagnosis scheduler to run (every hour)
2. Or manually trigger diagnosis for a site
3. Verify diagnosis completes successfully
4. Check that `diagnosis_history` records are created
5. Check that health scores are updated in `applications` table
6. Verify no foreign key constraint errors in logs

## Impact
- All new diagnosis results will be saved to `diagnosis_history` with `applications.id`
- Old diagnosis history records that didn't have matching applications were deleted
- The system is now fully aligned with the universal healer architecture
- Both WordPress and future tech stacks (Node.js, Laravel, etc.) will use the same history tables

## Next Steps
1. Restart backend to load new Prisma client
2. Monitor auto-diagnosis scheduler
3. Verify health scores update correctly
4. Check frontend displays updated health scores

## Status
✅ Migration applied successfully
✅ Prisma client regenerated
⏳ Awaiting backend restart and testing
