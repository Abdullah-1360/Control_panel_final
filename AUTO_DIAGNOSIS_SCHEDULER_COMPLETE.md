# Auto-Diagnosis Scheduler - COMPLETE ✅

## What It Does

Automatically checks for undiagnosed WordPress sites every 6 hours and triggers diagnosis via BullMQ queues WITHOUT any manual intervention.

## How It Works

### On Startup
- Waits 30 seconds for system to stabilize
- Runs initial check for undiagnosed WordPress sites
- Triggers diagnosis for sites with multiple domains

### Every 6 Hours (Scheduled)
- Cron job runs at: 00:00, 06:00, 12:00, 18:00 UTC
- Finds WordPress sites with:
  - `lastHealthCheck` is null (never diagnosed)
  - `healthScore` is 0 or null
- Checks if they have multiple domains (2+)
- Automatically enqueues diagnosis via BullMQ

### Process Flow
```
Scheduler (every 6 hours)
    ↓
Query: WordPress sites with healthScore = 0 or null
    ↓
For each site:
    ↓
Check: Has 2+ domains?
    ├─ YES → Enqueue diagnosis via BullMQ
    │         ↓
    │    DiagnosisQueueService.enqueueDiagnosisForAllDomains()
    │         ↓
    │    BullMQ Queue (rate limited, staggered)
    │         ↓
    │    Diagnose all domains
    │
    └─ NO → Skip (only 1 domain)
```

## Features

### ✅ Fully Automatic
- No manual API calls needed
- No manual scripts to run
- Runs on startup + every 6 hours

### ✅ BullMQ Queue Integration
- Uses `DiagnosisQueueService.enqueueDiagnosisForAllDomains()`
- Rate limited (max 3 concurrent, 10/minute)
- Staggered delays (10s between domains)
- Priority-based (main domain first)

### ✅ Smart Detection
- Only triggers for WordPress sites
- Only triggers for sites with 2+ domains
- Only triggers if never diagnosed OR health score = 0
- Skips already diagnosed sites

### ✅ Audit Logging
- Logs each triggered diagnosis
- Logs batch summary
- All actions tracked in audit_logs table

### ✅ Prevents Duplicates
- Checks if already running before starting
- Won't trigger if scheduler is already processing

## Configuration

### Schedule (Cron Expression)
**Current:** `0 */6 * * *` (every 6 hours)

**To change frequency:**

Edit `backend/src/modules/healer/services/auto-diagnosis-scheduler.service.ts`:

```typescript
// Every 3 hours
@Cron('0 */3 * * *', { ... })

// Every 12 hours
@Cron('0 */12 * * *', { ... })

// Daily at 2 AM
@Cron('0 2 * * *', { ... })

// Every hour
@Cron('0 * * * *', { ... })
```

### Startup Delay
**Current:** 30 seconds

**To change:**
```typescript
setTimeout(() => {
  this.checkAndTriggerDiagnosis();
}, 60000); // Change to 60 seconds
```

### Diagnosis Profile
**Current:** `DiagnosisProfile.FULL` (comprehensive)

**To change:**
```typescript
const result = await this.diagnosisQueue.enqueueDiagnosisForAllDomains(
  app.id,
  DiagnosisProfile.QUICK, // Change to QUICK for faster diagnosis
  'SYSTEM',
);
```

## Monitoring

### Backend Logs

**Startup Check:**
```
[AutoDiagnosisSchedulerService] Running initial auto-diagnosis check on startup...
[AutoDiagnosisSchedulerService] Found 15 WordPress sites that need diagnosis
[AutoDiagnosisSchedulerService] Auto-triggering diagnosis for example.com (3 domains)
[AutoDiagnosisSchedulerService] ✅ Enqueued diagnosis: batch-{id} for example.com
[AutoDiagnosisSchedulerService] Auto-diagnosis check completed: 15 triggered, 3 skipped
```

**Scheduled Check:**
```
[AutoDiagnosisSchedulerService] Running scheduled auto-diagnosis check...
[AutoDiagnosisSchedulerService] Found 5 WordPress sites that need diagnosis
[AutoDiagnosisSchedulerService] Auto-triggering diagnosis for site1.com (5 domains)
[AutoDiagnosisSchedulerService] ✅ Enqueued diagnosis: batch-{id} for site1.com
[AutoDiagnosisSchedulerService] Auto-diagnosis check completed: 5 triggered, 0 skipped
```

**No Sites Need Diagnosis:**
```
[AutoDiagnosisSchedulerService] Running scheduled auto-diagnosis check...
[AutoDiagnosisSchedulerService] No WordPress sites need diagnosis
```

### Audit Logs

Check audit logs for scheduler activity:

```sql
SELECT *
FROM audit_logs
WHERE action IN ('AUTO_DIAGNOSIS_SCHEDULED', 'AUTO_DIAGNOSIS_BATCH_SCHEDULED')
ORDER BY created_at DESC
LIMIT 20;
```

**Example Audit Log:**
```json
{
  "action": "AUTO_DIAGNOSIS_SCHEDULED",
  "resource": "APPLICATION",
  "resourceId": "app-uuid",
  "description": "Automatically triggered diagnosis for 3 domains via scheduler",
  "metadata": {
    "applicationId": "app-uuid",
    "domain": "example.com",
    "totalDomains": 3,
    "batchId": "batch-1234567890-app-uuid",
    "jobCount": 3,
    "trigger": "SCHEDULER",
    "reason": "Undiagnosed WordPress site with multiple domains"
  },
  "severity": "INFO",
  "actorType": "SYSTEM"
}
```

### Queue Stats

Monitor diagnosis queue:

```bash
curl http://localhost:3001/api/v1/healer/applications/diagnosis-queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Testing

### Test Startup Check

1. Restart backend
2. Wait 30 seconds
3. Check logs for "Running initial auto-diagnosis check"
4. Verify diagnosis jobs enqueued

### Test Scheduled Check

**Option 1: Wait 6 hours** (not practical)

**Option 2: Temporarily change cron to every minute:**
```typescript
@Cron('* * * * *', { // Every minute
  name: 'auto-diagnosis-check',
  timeZone: 'UTC',
})
```

**Option 3: Trigger manually via API** (see below)

### Manual Trigger (For Testing)

Add this endpoint to `ApplicationController`:

```typescript
@Post('trigger-auto-diagnosis-check')
@RequirePermissions('healer', 'diagnose')
async triggerAutoDiagnosisCheck() {
  const scheduler = this.moduleRef.get(AutoDiagnosisSchedulerService);
  const result = await scheduler.triggerManualCheck();
  return {
    message: 'Auto-diagnosis check completed',
    ...result,
  };
}
```

Then call:
```bash
curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-auto-diagnosis-check" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Issue: Scheduler not running

**Check 1: Is ScheduleModule imported?**
```typescript
// In healer.module.ts
imports: [
  ScheduleModule.forRoot(), // Required for @Cron decorator
  ...
]
```

**Check 2: Is service registered?**
```typescript
// In healer.module.ts
providers: [
  AutoDiagnosisSchedulerService, // Must be in providers
  ...
]
```

**Check 3: Check logs for startup message**
```bash
grep "Running initial auto-diagnosis check" backend.log
```

### Issue: No sites being triggered

**Check 1: Are there WordPress sites with healthScore = 0?**
```sql
SELECT id, domain, tech_stack, health_score, last_health_check
FROM applications
WHERE tech_stack = 'WORDPRESS'
  AND (last_health_check IS NULL OR health_score = 0 OR health_score IS NULL);
```

**Check 2: Do they have subdomains?**
```sql
SELECT domain, metadata->'availableSubdomains'
FROM applications
WHERE tech_stack = 'WORDPRESS';
```

**Check 3: Check logs for skip reasons**
```bash
grep "Skipping" backend.log | grep "only 1 domain"
```

### Issue: Scheduler running too often

**Solution:** Increase cron interval
```typescript
@Cron('0 */12 * * *', { // Every 12 hours instead of 6
  name: 'auto-diagnosis-check',
  timeZone: 'UTC',
})
```

### Issue: Too many diagnoses at once

**Solution:** The scheduler uses BullMQ which has rate limiting built-in. But you can also add a limit to how many sites to process per run:

```typescript
const wpApps = await this.prisma.applications.findMany({
  where: { ... },
  take: 10, // Only process 10 sites per run
  orderBy: { createdAt: 'asc' }, // Oldest first
});
```

## Comparison: Scheduler vs Manual Trigger

### Auto-Diagnosis Scheduler (NEW) ✅
- **Trigger:** Automatic (every 6 hours + on startup)
- **User Action:** None required
- **Use Case:** Continuous monitoring, catch new sites
- **Best For:** Production environments

### Manual API Endpoint
- **Trigger:** Manual API call
- **User Action:** Call API endpoint
- **Use Case:** One-time migration, force re-diagnosis
- **Best For:** Initial setup, troubleshooting

### Subdomain Detection Processor
- **Trigger:** After subdomain detection completes
- **User Action:** None required
- **Use Case:** New discoveries only
- **Best For:** Real-time diagnosis of newly discovered sites

## All Three Work Together

```
New Site Discovered
    ↓
Subdomain Detection Processor
    ↓
Auto-diagnosis triggered immediately ✅
    ↓
(If it fails or is skipped)
    ↓
Scheduler catches it in next run (6 hours) ✅
    ↓
(If still not diagnosed)
    ↓
Admin can manually trigger via API ✅
```

## Summary

The Auto-Diagnosis Scheduler provides a **safety net** that ensures:

1. ✅ All WordPress sites with multiple domains eventually get diagnosed
2. ✅ No manual intervention required
3. ✅ Runs automatically every 6 hours + on startup
4. ✅ Uses BullMQ queues with rate limiting
5. ✅ Comprehensive audit logging
6. ✅ Smart detection (only undiagnosed sites)

Combined with the subdomain detection processor, this creates a **fully automatic diagnosis system** that requires zero manual work.

---

**Last Updated:** March 6, 2026
**Status:** ✅ ACTIVE AND OPERATIONAL
**Schedule:** Every 6 hours + on startup
**File:** `backend/src/modules/healer/services/auto-diagnosis-scheduler.service.ts`
