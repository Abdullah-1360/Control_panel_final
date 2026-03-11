# Gradual Auto-Diagnosis Approach - Server-Friendly ✅

## Problem with Previous Approach

The original scheduler would process ALL undiagnosed WordPress sites at once:
- 100 sites × 3 domains each = 300 diagnosis jobs
- Even with rate limiting, this could overwhelm the server
- Long queue backlogs
- Potential timeouts

## New Gradual Approach

### Key Changes

1. **Batch Size Limit:** Only 5 sites per scheduler run
2. **Frequent Runs:** Every hour instead of every 6 hours
3. **Oldest First:** Processes oldest sites first (FIFO)
4. **Progress Tracking:** Logs remaining count

### How It Works

```
Hour 0: Scheduler runs
    ↓
Query: Get 5 oldest undiagnosed WordPress sites
    ↓
Process: Trigger diagnosis for these 5 sites
    ↓
Log: "5 triggered, 95 remaining"
    ↓
Wait 1 hour

Hour 1: Scheduler runs again
    ↓
Query: Get next 5 oldest undiagnosed sites
    ↓
Process: Trigger diagnosis for these 5 sites
    ↓
Log: "5 triggered, 90 remaining"
    ↓
Continue...
```

### Timeline Example

**Scenario:** 100 undiagnosed WordPress sites

| Time | Sites Processed | Sites Remaining | Queue Load |
|------|----------------|-----------------|------------|
| 00:00 | 5 | 95 | Low |
| 01:00 | 5 | 90 | Low |
| 02:00 | 5 | 85 | Low |
| 03:00 | 5 | 80 | Low |
| ... | ... | ... | ... |
| 20:00 | 5 | 0 | Low |

**Total Time:** 20 hours to process all 100 sites
**Server Load:** Always low (only 5 sites × 3 domains = 15 jobs per hour)

## Configuration

### Batch Size
**Current:** 5 sites per run

**To adjust:**
```typescript
const BATCH_SIZE = 10; // Process 10 sites per run instead of 5
```

**Recommendations:**
- **Small servers (1-2 CPU cores):** 3-5 sites
- **Medium servers (4-8 CPU cores):** 5-10 sites
- **Large servers (16+ CPU cores):** 10-20 sites

### Schedule Frequency
**Current:** Every hour (`0 * * * *`)

**To adjust:**
```typescript
// Every 30 minutes
@Cron('*/30 * * * *', { ... })

// Every 2 hours
@Cron('0 */2 * * *', { ... })

// Every 15 minutes (aggressive)
@Cron('*/15 * * * *', { ... })
```

### Processing Speed

Calculate how long it takes to process all sites:

```
Total Sites = 100
Batch Size = 5
Frequency = 1 hour

Time to Complete = (Total Sites / Batch Size) × Frequency
                 = (100 / 5) × 1 hour
                 = 20 hours
```

**To process faster:**
- Increase batch size: 5 → 10 (10 hours)
- Increase frequency: 1 hour → 30 min (10 hours)
- Both: 10 sites every 30 min (5 hours)

## Benefits

### ✅ Server-Friendly
- Never overwhelms the server
- Predictable load
- No sudden spikes

### ✅ Gradual Processing
- Processes sites over time
- Oldest sites get priority
- New sites automatically added to queue

### ✅ Self-Regulating
- Automatically stops when no sites need diagnosis
- Resumes when new sites are discovered
- No manual intervention needed

### ✅ Observable
- Logs remaining count
- Easy to track progress
- Clear audit trail

## Monitoring

### Backend Logs

**Typical Run:**
```
[AutoDiagnosisSchedulerService] Running scheduled auto-diagnosis check...
[AutoDiagnosisSchedulerService] Found 5 WordPress sites to diagnose (batch size: 5)
[AutoDiagnosisSchedulerService] Auto-triggering diagnosis for site1.com (3 domains)
[AutoDiagnosisSchedulerService] ✅ Enqueued diagnosis: batch-{id} for site1.com
[AutoDiagnosisSchedulerService] Auto-triggering diagnosis for site2.com (5 domains)
[AutoDiagnosisSchedulerService] ✅ Enqueued diagnosis: batch-{id} for site2.com
...
[AutoDiagnosisSchedulerService] Auto-diagnosis check completed: 5 triggered, 0 skipped, 95 remaining
```

**When Complete:**
```
[AutoDiagnosisSchedulerService] Running scheduled auto-diagnosis check...
[AutoDiagnosisSchedulerService] No WordPress sites need diagnosis
```

### Progress Tracking

Check remaining sites:
```sql
SELECT COUNT(*)
FROM applications
WHERE tech_stack = 'WORDPRESS'
  AND (last_health_check IS NULL OR health_score = 0 OR health_score IS NULL);
```

### Audit Logs

Each batch creates an audit log:
```json
{
  "action": "AUTO_DIAGNOSIS_BATCH_SCHEDULED",
  "description": "Automatically triggered diagnosis for 5 WordPress sites (95 remaining)",
  "metadata": {
    "totalProcessed": 5,
    "triggered": 5,
    "skipped": 0,
    "remaining": 95,
    "batchSize": 5,
    "timestamp": "2026-03-06T16:00:00Z"
  }
}
```

## Comparison: Old vs New Approach

### Old Approach (Flooding Risk)
```
Every 6 hours:
  - Process ALL undiagnosed sites at once
  - 100 sites × 3 domains = 300 jobs
  - Queue backlog: HIGH
  - Server load: SPIKE
  - Time to complete: 3-4 hours (with rate limiting)
```

### New Approach (Gradual)
```
Every 1 hour:
  - Process only 5 sites
  - 5 sites × 3 domains = 15 jobs
  - Queue backlog: LOW
  - Server load: STEADY
  - Time to complete: 20 hours (spread over time)
```

## Real-World Scenarios

### Scenario 1: Small Hosting (50 WordPress sites)
```
Batch Size: 5
Frequency: Every hour
Time to Complete: 10 hours
Server Load: Minimal
```

### Scenario 2: Medium Hosting (200 WordPress sites)
```
Batch Size: 10
Frequency: Every 30 minutes
Time to Complete: 10 hours
Server Load: Low
```

### Scenario 3: Large Hosting (1000 WordPress sites)
```
Batch Size: 20
Frequency: Every 15 minutes
Time to Complete: 12.5 hours
Server Load: Moderate
```

### Scenario 4: Enterprise (5000 WordPress sites)
```
Batch Size: 50
Frequency: Every 10 minutes
Time to Complete: 16.7 hours
Server Load: Moderate-High
```

## Adaptive Configuration

For very large deployments, you can make the batch size dynamic:

```typescript
// Calculate batch size based on queue load
const queueStats = await this.diagnosisQueue.getQueueStats();
const BATCH_SIZE = queueStats.waiting > 50 ? 3 : 10; // Reduce if queue is busy
```

Or based on server load:
```typescript
// Reduce batch size during peak hours
const hour = new Date().getHours();
const BATCH_SIZE = (hour >= 9 && hour <= 17) ? 3 : 10; // Smaller during business hours
```

## Emergency Override

If you need to process all sites immediately (e.g., after a critical fix):

1. **Temporarily increase batch size:**
   ```typescript
   const BATCH_SIZE = 50; // Process 50 sites per run
   ```

2. **Temporarily increase frequency:**
   ```typescript
   @Cron('*/10 * * * *', { ... }) // Every 10 minutes
   ```

3. **Or use manual trigger:**
   ```bash
   curl -X POST "http://localhost:3001/api/v1/healer/applications/trigger-diagnosis-for-existing-wp-sites?forceAll=true"
   ```

## Summary

The gradual approach ensures:

1. ✅ **No Server Flooding:** Only 5 sites processed per hour
2. ✅ **Predictable Load:** Steady, manageable queue size
3. ✅ **Automatic Processing:** Runs every hour without intervention
4. ✅ **Progress Tracking:** Clear visibility of remaining sites
5. ✅ **Configurable:** Easy to adjust batch size and frequency
6. ✅ **Self-Regulating:** Stops when done, resumes when needed

**Perfect for production environments with hundreds or thousands of WordPress sites!**

---

**Last Updated:** March 6, 2026
**Status:** ✅ PRODUCTION READY
**Batch Size:** 5 sites per run
**Frequency:** Every hour
**Approach:** Gradual, server-friendly
