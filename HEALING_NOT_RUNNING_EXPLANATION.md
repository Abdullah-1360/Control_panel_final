# Why Healing is Not Running - Explanation & Solution

## 🔍 Current Situation

From your logs:
```
Enabling healer for subdomain testing.uzairfarooq.pk of application 6a221740-81c9-47b9-950d-c6d43b1465d0
[Nest] 24081  - 03/11/2026, 12:14:31 PM     LOG [ApplicationService] Healer enabled for subdomain testing.uzairfarooq.pk
...
healer is not performing anything
```

**Status**: Healer is ENABLED but NOT RUNNING

## ❓ Why is Healing Not Running?

### The Issue
Enabling the healer toggle (`isHealerEnabled = true`) only **allows** healing to happen when triggered. It does NOT **automatically trigger** healing.

Think of it like this:
- **Healer Toggle = Permission Gate**: "Am I allowed to heal?"
- **Healing Trigger = Action**: "Actually perform healing"

### What's Missing
There is **NO automatic healing trigger** currently implemented. The system has:
- ✅ Healing orchestrator (can perform healing)
- ✅ Healing validation (checks if healing is allowed)
- ✅ WordPress healing strategies (knows how to heal)
- ❌ **Automatic healing trigger** (nothing to start healing automatically)

## 🔄 Current Healing Flow

### What Exists
```
1. User enables healer toggle (isHealerEnabled = true)
2. User sets healing mode (MANUAL, SEMI_AUTO, FULL_AUTO)
3. ??? (Nothing happens automatically)
4. User must manually trigger healing via API or UI button
```

### What's Expected (But Not Implemented)
```
1. User enables healer toggle (isHealerEnabled = true)
2. User sets healing mode (SEMI_AUTO or FULL_AUTO)
3. System automatically detects issues via diagnosis
4. System automatically triggers healing based on diagnosis results
5. Healing executes (with or without approval based on mode)
```

## 🎯 What Needs to Be Implemented

### Option 1: Scheduled Automatic Healing (Recommended)
Create a scheduled job that:
1. Runs every X minutes (e.g., 5, 10, 15 minutes)
2. Finds applications with `isHealerEnabled = true` and `healingMode != MANUAL`
3. Checks if diagnosis exists and shows issues
4. Automatically triggers healing for those applications

### Option 2: Diagnosis-Triggered Healing
Modify the diagnosis system to:
1. After diagnosis completes, check if healing is enabled
2. If `isHealerEnabled = true` and `healingMode = FULL_AUTO`
3. Automatically trigger healing immediately after diagnosis

### Option 3: Health Status Change Trigger
Create a listener that:
1. Monitors health status changes (HEALTHY → UNHEALTHY)
2. When status changes to UNHEALTHY and `isHealerEnabled = true`
3. Automatically trigger healing

## 💡 Recommended Solution: Scheduled Automatic Healing

### Implementation Plan

#### 1. Create Healing Scheduler Service
```typescript
// backend/src/modules/healer/services/healing-scheduler.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { TechStackAwareHealingOrchestratorService } from './tech-stack-aware-healing-orchestrator.service';
import { HealerTrigger, HealingMode } from '@prisma/client';

@Injectable()
export class HealingSchedulerService {
  private readonly logger = new Logger(HealingSchedulerService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly healingOrchestrator: TechStackAwareHealingOrchestratorService
  ) {}
  
  /**
   * Schedule automatic healing every 10 minutes
   * Runs at :00, :10, :20, :30, :40, :50 of every hour
   */
  @Cron('*/10 * * * *', {
    name: 'automatic-healing',
    timeZone: 'UTC',
  })
  async scheduleAutomaticHealing() {
    this.logger.log('Running scheduled automatic healing check');
    
    try {
      // Find applications with healing enabled and not in MANUAL mode
      const applicationsToHeal = await this.prisma.applications.findMany({
        where: {
          isHealerEnabled: true,
          healingMode: {
            in: [HealingMode.SEMI_AUTO, HealingMode.FULL_AUTO]
          },
          healthStatus: {
            in: ['UNHEALTHY', 'CRITICAL', 'DEGRADED']
          },
          // Only heal if last healing was more than cooldown period ago
          OR: [
            { lastHealedAt: null },
            {
              lastHealedAt: {
                lt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes cooldown
              }
            }
          ]
        },
        include: {
          servers: true
        }
      });
      
      this.logger.log(`Found ${applicationsToHeal.length} applications eligible for automatic healing`);
      
      // Trigger healing for each application
      for (const app of applicationsToHeal) {
        try {
          this.logger.log(`Triggering automatic healing for ${app.domain}`);
          
          await this.healingOrchestrator.heal(
            app.id,
            app.healingMode === HealingMode.SEMI_AUTO 
              ? HealerTrigger.SEMI_AUTO 
              : HealerTrigger.FULL_AUTO,
            'system-scheduler',
            {}
          );
          
          // Update last healed timestamp
          await this.prisma.applications.update({
            where: { id: app.id },
            data: { lastHealedAt: new Date() }
          });
          
        } catch (error) {
          const err = error as Error;
          this.logger.error(`Failed to heal ${app.domain}: ${err.message}`);
        }
      }
      
      this.logger.log(`Automatic healing completed for ${applicationsToHeal.length} applications`);
      
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to schedule automatic healing: ${err.message}`);
    }
  }
  
  /**
   * Trigger healing for a specific application
   */
  async triggerHealingForApplication(applicationId: string): Promise<void> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true }
    });
    
    if (!app) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    if (!app.isHealerEnabled) {
      throw new Error(`Healing is disabled for ${app.domain}`);
    }
    
    const trigger = app.healingMode === HealingMode.SEMI_AUTO 
      ? HealerTrigger.SEMI_AUTO 
      : app.healingMode === HealingMode.FULL_AUTO
        ? HealerTrigger.FULL_AUTO
        : HealerTrigger.MANUAL;
    
    await this.healingOrchestrator.heal(
      app.id,
      trigger,
      'manual-trigger',
      {}
    );
    
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: { lastHealedAt: new Date() }
    });
  }
}
```

#### 2. Add lastHealedAt Field to Schema
```prisma
// backend/prisma/schema.prisma

model applications {
  // ... existing fields
  
  isHealerEnabled           Boolean                     @default(false)
  healingMode               HealingMode                 @default(MANUAL)
  maxHealingAttempts        Int                         @default(3)
  healingCooldown           Int                         @default(15)
  lastHealedAt              DateTime?                   @map("last_healed_at") // NEW FIELD
  
  // ... rest of model
}
```

#### 3. Register Service in Module
```typescript
// backend/src/modules/healer/healer.module.ts

import { HealingSchedulerService } from './services/healing-scheduler.service';

@Module({
  imports: [
    // ... existing imports
  ],
  providers: [
    // ... existing providers
    HealingSchedulerService, // ADD THIS
  ],
  exports: [
    // ... existing exports
    HealingSchedulerService, // ADD THIS
  ],
})
export class HealerModule {}
```

#### 4. Run Migration
```bash
cd backend
npx prisma migrate dev --name add_last_healed_at
```

## 🚀 How It Will Work After Implementation

### Automatic Healing Flow
```
1. Scheduler runs every 10 minutes
   ↓
2. Finds applications with:
   - isHealerEnabled = true
   - healingMode = SEMI_AUTO or FULL_AUTO
   - healthStatus = UNHEALTHY, CRITICAL, or DEGRADED
   - lastHealedAt > 30 minutes ago (cooldown)
   ↓
3. For each application:
   - Trigger healing with appropriate trigger type
   - Update lastHealedAt timestamp
   ↓
4. Healing orchestrator:
   - Validates auto-heal permission
   - Gets latest diagnosis
   - Performs healing based on diagnosis
   - Saves healing execution to history
```

### Cooldown Mechanism
- **Purpose**: Prevent healing from running too frequently
- **Default**: 30 minutes between healing attempts
- **Configurable**: Can be adjusted per application via `healingCooldown` field

### Healing Modes Behavior
- **MANUAL**: Never triggered automatically (requires manual button click)
- **SEMI_AUTO**: Triggered automatically, but requires approval before execution
- **FULL_AUTO**: Triggered automatically, executes immediately without approval

## 📊 Expected Logs After Implementation

```
[Nest] 24081  - 03/11/2026, 12:20:00 PM     LOG [HealingSchedulerService] Running scheduled automatic healing check
[Nest] 24081  - 03/11/2026, 12:20:00 PM     LOG [HealingSchedulerService] Found 5 applications eligible for automatic healing
[Nest] 24081  - 03/11/2026, 12:20:00 PM     LOG [HealingSchedulerService] Triggering automatic healing for testing.uzairfarooq.pk
[Nest] 24081  - 03/11/2026, 12:20:00 PM     LOG [TechStackAwareHealingOrchestratorService] Healing request for application 6a221740-81c9-47b9-950d-c6d43b1465d0 (trigger: FULL_AUTO, by: system-scheduler)
[Nest] 24081  - 03/11/2026, 12:20:01 PM     LOG [WordPressHealingService] WordPress healing for testing.uzairfarooq.pk (diagnosis: WSOD)
[Nest] 24081  - 03/11/2026, 12:20:05 PM     LOG [WordPressHealingService] Healing completed: 4/4 actions successful
[Nest] 24081  - 03/11/2026, 12:20:05 PM     LOG [HealingSchedulerService] Automatic healing completed for 5 applications
```

## ✅ Summary

### Current State
- ✅ Healer toggle enabled
- ✅ Healing mode set
- ❌ No automatic trigger mechanism
- ❌ Healing not running

### What's Needed
1. Create `HealingSchedulerService` with `@Cron` decorator
2. Add `lastHealedAt` field to database schema
3. Register service in `HealerModule`
4. Run database migration

### After Implementation
- ✅ Automatic healing every 10 minutes
- ✅ Only heals applications with healing enabled
- ✅ Respects healing mode (SEMI_AUTO vs FULL_AUTO)
- ✅ Cooldown prevents too-frequent healing
- ✅ Logs show healing activity

## 🎯 Quick Fix for Testing

If you want to test healing immediately without implementing the scheduler:

### Option A: Manual API Call
```bash
curl -X POST http://localhost:3001/api/v1/healer/heal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "applicationId": "6a221740-81c9-47b9-950d-c6d43b1465d0",
    "trigger": "MANUAL",
    "triggeredBy": "admin@example.com"
  }'
```

### Option B: UI Button
Click the "Heal Now" button in the application details page (if it exists)

### Option C: Run Diagnosis First
1. Click "Run Diagnosis" button
2. Wait for diagnosis to complete
3. Then manually trigger healing

---

**Status**: ❌ Automatic healing NOT implemented
**Required**: Implement `HealingSchedulerService` with scheduled job
**Workaround**: Manually trigger healing via API or UI button

