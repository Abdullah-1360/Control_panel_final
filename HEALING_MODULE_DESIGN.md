# WordPress Healing Module - Complete Design Specification

## Executive Summary

This document outlines the design for an automated healing module that remediates issues detected during WordPress diagnosis. The module leverages existing infrastructure (30+ diagnostic checks, correlation engine, verification service) to provide safe, auditable, and intelligent healing.

## 1. Architecture Overview

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Healing Module Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │  Diagnosis   │─────▶│   Healing    │─────▶│ Verification │  │
│  │   Service    │      │ Orchestrator │      │   Service    │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                      │                      │          │
│         │                      ▼                      │          │
│         │              ┌──────────────┐              │          │
│         │              │   Healing    │              │          │
│         │              │   Strategy   │              │          │
│         │              │   Selector   │              │          │
│         │              └──────────────┘              │          │
│         │                      │                      │          │
│         │                      ▼                      │          │
│         │              ┌──────────────┐              │          │
│         │              │   Backup     │              │          │
│         │              │   Service    │              │          │
│         │              └──────────────┘              │          │
│         │                      │                      │          │
│         │                      ▼                      │          │
│         │              ┌──────────────┐              │          │
│         │              │   Healing    │              │          │
│         │              │   Executor   │              │          │
│         │              └──────────────┘              │          │
│         │                      │                      │          │
│         │                      ▼                      │          │
│         │              ┌──────────────┐              │          │
│         └─────────────▶│   Rollback   │◀─────────────┘          │
│                        │   Service    │                          │
│                        └──────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Healing Flow

```
1. Diagnosis Completed
   ↓
2. Check Auto-Heal Enabled
   ↓
3. Verify Recent Diagnosis (<24h)
   ↓
4. Correlation Analysis (Root Cause)
   ↓
5. Strategy Selection
   ↓
6. Backup Creation
   ↓
7. Healing Execution
   ↓
8. Verification (5 layers)
   ↓
9. Success → Update Health Score
   ↓
10. Failure → Rollback → Alert
```

## 2. Database Schema Extensions

### 2.1 Existing Tables (Already Implemented)


```prisma
// applications table has healing fields
model applications {
  healingMode             HealingMode           @default(MANUAL)
  isHealerEnabled         Boolean               @default(false)
  maxHealingAttempts      Int                   @default(3)
  healingCooldown         Int                   @default(3600) // seconds
  currentHealingAttempts  Int                   @default(0)
  lastHealingAttempt      DateTime?
  circuitBreakerState     CircuitBreakerState   @default(CLOSED)
  circuitBreakerResetAt   DateTime?
  consecutiveFailures     Int                   @default(0)
}

// healing_executions_new table tracks healing workflow
model healing_executions_new {
  id                String          @id @default(uuid())
  applicationId     String
  trigger           HealerTrigger
  diagnosticResults Json
  healthScore       Int?
  healingPlan       Json
  approvedActions   String[]
  executionStatus   ExecutionStatus
  backupId          String?
  verificationScore Int?
  rollbackExecuted  Boolean         @default(false)
}
```

### 2.2 New Enums Needed

```prisma
enum HealingMode {
  MANUAL        // No auto-healing
  AUTO_SAFE     // Only safe actions (cache clear, transient cleanup)
  AUTO_MODERATE // Safe + moderate actions (plugin deactivation)
  AUTO_FULL     // All actions except database modifications
}

enum HealingActionType {
  // Safe Actions (auto-approvable)
  CACHE_CLEAR
  TRANSIENT_CLEANUP
  PERMISSION_FIX
  HTACCESS_RESET
  
  // Moderate Actions (requires approval or AUTO_MODERATE+)
  PLUGIN_DEACTIVATE
  THEME_SWITCH
  MEMORY_LIMIT_INCREASE
  DEBUG_MODE_DISABLE
  
  // High-Risk Actions (requires approval or AUTO_FULL)
  FILE_RESTORE
  DATABASE_REPAIR
  CORE_UPDATE
  PLUGIN_UPDATE
}

enum HealingActionStatus {
  PENDING
  APPROVED
  EXECUTING
  COMPLETED
  FAILED
  ROLLED_BACK
  SKIPPED
}
```

## 3. Healing Strategies

### 3.1 Strategy Mapping (Diagnosis → Healing)



#### Strategy 1: WSOD (White Screen of Death)
**Root Cause:** Plugin/theme fatal error, memory exhaustion, syntax error
**Healing Actions:**
1. Disable all plugins (via wp-cli or database)
2. Switch to default theme (twentytwentyfour)
3. Increase PHP memory limit (wp-config.php)
4. Check error logs for specific plugin/theme
5. Re-enable plugins one by one (if AUTO_FULL)

**Commands:**
```bash
# Disable all plugins
wp plugin deactivate --all --skip-plugins --skip-themes

# Switch to default theme
wp theme activate twentytwentyfour --skip-plugins --skip-themes

# Increase memory limit
sed -i "s/define('WP_MEMORY_LIMIT', '.*');/define('WP_MEMORY_LIMIT', '256M');/" wp-config.php
```

#### Strategy 2: Database Connection Error
**Root Cause:** Wrong credentials, MySQL down, connection limit reached
**Healing Actions:**
1. Verify database credentials (wp-config.php)
2. Test MySQL connection
3. Repair database tables
4. Optimize database
5. Check MySQL process list

**Commands:**
```bash
# Test database connection
wp db check --skip-plugins --skip-themes

# Repair tables
wp db repair --skip-plugins --skip-themes

# Optimize database
wp db optimize --skip-plugins --skip-themes
```

#### Strategy 3: Maintenance Mode Stuck
**Root Cause:** .maintenance file not removed after update
**Healing Actions:**
1. Remove .maintenance file
2. Verify site accessibility
3. Check for failed updates

**Commands:**
```bash
# Remove maintenance file
rm -f .maintenance

# Verify WordPress is accessible
wp core version --skip-plugins --skip-themes
```

#### Strategy 4: Core Integrity Issues
**Root Cause:** Modified/corrupted core files
**Healing Actions:**
1. Backup current core files
2. Download fresh WordPress core
3. Replace core files (preserve wp-content, wp-config.php)
4. Verify checksums

**Commands:**
```bash
# Verify checksums
wp core verify-checksums --skip-plugins --skip-themes

# Download fresh core
wp core download --force --skip-content --skip-plugins --skip-themes
```

#### Strategy 5: Permission Issues
**Root Cause:** Wrong file/directory permissions
**Healing Actions:**
1. Set correct ownership (user:user)
2. Set directory permissions (755)
3. Set file permissions (644)
4. Set wp-config.php permissions (600)

**Commands:**
```bash
# Fix ownership
chown -R user:user /path/to/wordpress

# Fix directory permissions
find /path/to/wordpress -type d -exec chmod 755 {} \;

# Fix file permissions
find /path/to/wordpress -type f -exec chmod 644 {} \;

# Secure wp-config.php
chmod 600 wp-config.php
```

#### Strategy 6: Cache/Transient Issues
**Root Cause:** Stale cache, orphaned transients
**Healing Actions:**
1. Clear object cache
2. Delete expired transients
3. Flush rewrite rules
4. Clear opcache

**Commands:**
```bash
# Clear cache
wp cache flush --skip-plugins --skip-themes

# Delete transients
wp transient delete --all --skip-plugins --skip-themes

# Flush rewrite rules
wp rewrite flush --skip-plugins --skip-themes
```

#### Strategy 7: Plugin Conflict
**Root Cause:** Conflicting plugins
**Healing Actions:**
1. Identify conflicting plugins (from error logs)
2. Deactivate conflicting plugins
3. Test site functionality
4. Suggest alternatives

**Commands:**
```bash
# Deactivate specific plugin
wp plugin deactivate plugin-name --skip-plugins --skip-themes

# List active plugins
wp plugin list --status=active --skip-themes
```

#### Strategy 8: Memory Exhaustion
**Root Cause:** PHP memory limit too low
**Healing Actions:**
1. Increase WP_MEMORY_LIMIT (256M)
2. Increase WP_MAX_MEMORY_LIMIT (512M)
3. Verify PHP memory_limit
4. Optimize autoloaded data

**Commands:**
```bash
# Update wp-config.php
echo "define('WP_MEMORY_LIMIT', '256M');" >> wp-config.php
echo "define('WP_MAX_MEMORY_LIMIT', '512M');" >> wp-config.php

# Check autoloaded data
wp db query "SELECT SUM(LENGTH(option_value)) as autoload_size FROM wp_options WHERE autoload='yes';" --skip-plugins --skip-themes
```

#### Strategy 9: Security Compromise
**Root Cause:** Malware, backdoor, unauthorized access
**Healing Actions:**
1. Scan for malware signatures
2. Remove suspicious files
3. Reset all passwords
4. Regenerate security keys
5. Update all plugins/themes

**Commands:**
```bash
# Regenerate security keys
wp config shuffle-salts --skip-plugins --skip-themes

# Update all plugins
wp plugin update --all --skip-themes

# Update all themes
wp theme update --all --skip-plugins
```

#### Strategy 10: Database Table Corruption
**Root Cause:** Crashed tables, corrupted indexes
**Healing Actions:**
1. Check table status
2. Repair corrupted tables
3. Optimize tables
4. Verify data integrity

**Commands:**
```bash
# Check tables
wp db check --skip-plugins --skip-themes

# Repair tables
wp db repair --skip-plugins --skip-themes

# Optimize tables
wp db optimize --skip-plugins --skip-themes
```

## 4. Healing Service Implementation

### 4.1 HealingStrategySelector Service



```typescript
interface HealingStrategy {
  name: string;
  description: string;
  rootCause: string;
  actions: HealingAction[];
  estimatedDuration: number; // seconds
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresBackup: boolean;
  requiresApproval: boolean;
}

interface HealingAction {
  type: HealingActionType;
  description: string;
  command?: string;
  params?: any;
  timeout: number;
  retryable: boolean;
  rollbackCommand?: string;
  verificationCheck?: string;
}

@Injectable()
export class HealingStrategySelectorService {
  selectStrategy(
    correlationResult: CorrelationResult,
    checkResults: CheckResult[],
    healingMode: HealingMode
  ): HealingStrategy {
    // Analyze root causes from correlation engine
    const primaryRootCause = correlationResult.rootCauses[0];
    
    // Map root cause to healing strategy
    switch (primaryRootCause.name) {
      case 'WSOD_CASCADE':
        return this.buildWSODStrategy(checkResults, healingMode);
      case 'DB_CONNECTION_FAILURE':
        return this.buildDatabaseStrategy(checkResults, healingMode);
      case 'MAINTENANCE_MODE_STUCK':
        return this.buildMaintenanceStrategy(checkResults, healingMode);
      // ... other strategies
    }
  }
  
  private buildWSODStrategy(
    checkResults: CheckResult[],
    healingMode: HealingMode
  ): HealingStrategy {
    const actions: HealingAction[] = [];
    
    // Always safe: Disable plugins
    actions.push({
      type: HealingActionType.PLUGIN_DEACTIVATE,
      description: 'Deactivate all plugins to isolate issue',
      command: 'wp plugin deactivate --all --skip-plugins --skip-themes',
      timeout: 30000,
      retryable: true,
      rollbackCommand: 'wp plugin activate --all --skip-themes',
      verificationCheck: 'HTTP_STATUS'
    });
    
    // Safe: Switch to default theme
    actions.push({
      type: HealingActionType.THEME_SWITCH,
      description: 'Switch to default WordPress theme',
      command: 'wp theme activate twentytwentyfour --skip-plugins --skip-themes',
      timeout: 30000,
      retryable: true,
      rollbackCommand: 'wp theme activate {previous_theme} --skip-plugins --skip-themes',
      verificationCheck: 'HTTP_STATUS'
    });
    
    // Moderate: Increase memory limit
    if (healingMode !== HealingMode.MANUAL) {
      actions.push({
        type: HealingActionType.MEMORY_LIMIT_INCREASE,
        description: 'Increase PHP memory limit to 256M',
        command: `sed -i "s/define('WP_MEMORY_LIMIT', '.*');/define('WP_MEMORY_LIMIT', '256M');/" wp-config.php`,
        timeout: 10000,
        retryable: false,
        rollbackCommand: 'restore from backup',
        verificationCheck: 'WP_VERSION'
      });
    }
    
    return {
      name: 'WSOD_RECOVERY',
      description: 'Recover from White Screen of Death',
      rootCause: 'Plugin/theme fatal error or memory exhaustion',
      actions,
      estimatedDuration: 120,
      riskLevel: 'MEDIUM',
      requiresBackup: true,
      requiresApproval: healingMode === HealingMode.MANUAL
    };
  }
}
```

### 4.2 HealingExecutor Service

```typescript
@Injectable()
export class HealingExecutorService {
  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService,
    private readonly backupService: BackupService,
    private readonly verificationService: VerificationService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}
  
  async executeHealing(
    applicationId: string,
    strategy: HealingStrategy,
    executionId: string
  ): Promise<HealingExecutionResult> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true }
    });
    
    // 1. Create backup
    let backupId: string | null = null;
    if (strategy.requiresBackup) {
      backupId = await this.backupService.createBackup(
        app.serverId,
        app.path,
        app.domain
      );
    }
    
    // 2. Execute actions sequentially
    const actionResults: ActionResult[] = [];
    let allSucceeded = true;
    
    for (const action of strategy.actions) {
      try {
        const result = await this.executeAction(
          app.serverId,
          app.path,
          app.domain,
          action
        );
        
        actionResults.push(result);
        
        if (!result.success) {
          allSucceeded = false;
          break; // Stop on first failure
        }
        
        // Verify after each action
        if (action.verificationCheck) {
          const verified = await this.verifyAction(
            app.serverId,
            app.path,
            app.domain,
            action.verificationCheck
          );
          
          if (!verified) {
            allSucceeded = false;
            break;
          }
        }
        
      } catch (error) {
        actionResults.push({
          action: action.type,
          success: false,
          error: error.message,
          duration: 0
        });
        allSucceeded = false;
        break;
      }
    }
    
    // 3. Final verification
    let verificationScore = 0;
    if (allSucceeded) {
      const verification = await this.verificationService.verify(
        app.serverId,
        app.path,
        app.domain,
        'HEALING'
      );
      verificationScore = verification.score;
      allSucceeded = verification.passed;
    }
    
    // 4. Rollback if failed
    if (!allSucceeded && backupId) {
      await this.rollback(app.serverId, app.path, backupId);
    }
    
    // 5. Update execution record
    await this.prisma.healing_executions_new.update({
      where: { id: executionId },
      data: {
        executionStatus: allSucceeded ? 'COMPLETED' : 'FAILED',
        verificationScore,
        rollbackExecuted: !allSucceeded && backupId !== null,
        completedAt: new Date()
      }
    });
    
    return {
      success: allSucceeded,
      actionResults,
      verificationScore,
      backupId,
      rolledBack: !allSucceeded && backupId !== null
    };
  }
  
  private async executeAction(
    serverId: string,
    sitePath: string,
    domain: string,
    action: HealingAction
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      // Execute command via SSH
      const result = await this.sshExecutor.executeCommand(
        serverId,
        action.command,
        { timeout: action.timeout, cwd: sitePath }
      );
      
      return {
        action: action.type,
        success: true,
        output: result,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      // Retry if retryable
      if (action.retryable) {
        try {
          const result = await this.sshExecutor.executeCommand(
            serverId,
            action.command,
            { timeout: action.timeout, cwd: sitePath }
          );
          
          return {
            action: action.type,
            success: true,
            output: result,
            duration: Date.now() - startTime,
            retried: true
          };
        } catch (retryError) {
          return {
            action: action.type,
            success: false,
            error: retryError.message,
            duration: Date.now() - startTime
          };
        }
      }
      
      return {
        action: action.type,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
}
```

### 4.3 BackupService Implementation



```typescript
@Injectable()
export class BackupService {
  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly prisma: PrismaService
  ) {}
  
  async createBackup(
    serverId: string,
    sitePath: string,
    domain: string
  ): Promise<string> {
    const backupId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `/tmp/healer-backups/${backupId}`;
    
    try {
      // 1. Create backup directory
      await this.sshExecutor.executeCommand(
        serverId,
        `mkdir -p ${backupDir}`
      );
      
      // 2. Backup wp-config.php
      await this.sshExecutor.executeCommand(
        serverId,
        `cp ${sitePath}/wp-config.php ${backupDir}/wp-config.php.bak`
      );
      
      // 3. Backup .htaccess
      await this.sshExecutor.executeCommand(
        serverId,
        `cp ${sitePath}/.htaccess ${backupDir}/.htaccess.bak 2>/dev/null || true`
      );
      
      // 4. Backup wp-content (plugins, themes, uploads)
      await this.sshExecutor.executeCommand(
        serverId,
        `tar -czf ${backupDir}/wp-content.tar.gz -C ${sitePath} wp-content`,
        { timeout: 300000 } // 5 minutes
      );
      
      // 5. Backup database
      const dbBackup = await this.backupDatabase(serverId, sitePath, backupDir);
      
      // 6. Store backup metadata
      await this.prisma.healing_backups.create({
        data: {
          id: backupId,
          applicationId: domain,
          backupPath: backupDir,
          backupSize: await this.getBackupSize(serverId, backupDir),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          createdAt: new Date()
        }
      });
      
      return backupId;
      
    } catch (error) {
      // Cleanup on failure
      await this.sshExecutor.executeCommand(
        serverId,
        `rm -rf ${backupDir}`
      ).catch(() => {});
      
      throw new Error(`Backup failed: ${error.message}`);
    }
  }
  
  async restoreBackup(
    serverId: string,
    sitePath: string,
    backupId: string
  ): Promise<void> {
    const backup = await this.prisma.healing_backups.findUnique({
      where: { id: backupId }
    });
    
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    const backupDir = backup.backupPath;
    
    try {
      // 1. Restore wp-config.php
      await this.sshExecutor.executeCommand(
        serverId,
        `cp ${backupDir}/wp-config.php.bak ${sitePath}/wp-config.php`
      );
      
      // 2. Restore .htaccess
      await this.sshExecutor.executeCommand(
        serverId,
        `cp ${backupDir}/.htaccess.bak ${sitePath}/.htaccess 2>/dev/null || true`
      );
      
      // 3. Restore wp-content
      await this.sshExecutor.executeCommand(
        serverId,
        `tar -xzf ${backupDir}/wp-content.tar.gz -C ${sitePath}`,
        { timeout: 300000 }
      );
      
      // 4. Restore database
      await this.restoreDatabase(serverId, sitePath, backupDir);
      
    } catch (error) {
      throw new Error(`Restore failed: ${error.message}`);
    }
  }
  
  private async backupDatabase(
    serverId: string,
    sitePath: string,
    backupDir: string
  ): Promise<void> {
    // Use WP-CLI to export database
    await this.sshExecutor.executeCommand(
      serverId,
      `cd ${sitePath} && wp db export ${backupDir}/database.sql --skip-plugins --skip-themes`,
      { timeout: 300000 }
    );
  }
  
  private async restoreDatabase(
    serverId: string,
    sitePath: string,
    backupDir: string
  ): Promise<void> {
    // Use WP-CLI to import database
    await this.sshExecutor.executeCommand(
      serverId,
      `cd ${sitePath} && wp db import ${backupDir}/database.sql --skip-plugins --skip-themes`,
      { timeout: 300000 }
    );
  }
}
```

## 5. Auto-Heal Trigger Logic

### 5.1 When to Trigger Auto-Heal

```typescript
@Injectable()
export class AutoHealTriggerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healingOrchestrator: HealingOrchestratorService
  ) {}
  
  async checkAndTriggerAutoHeal(
    applicationId: string,
    diagnosisResult: DiagnosisResult
  ): Promise<void> {
    // 1. Check if auto-heal is enabled
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId }
    });
    
    if (!app.isHealerEnabled) {
      return; // Auto-heal disabled
    }
    
    if (app.healingMode === HealingMode.MANUAL) {
      return; // Manual mode only
    }
    
    // 2. Check circuit breaker
    if (app.circuitBreakerState === CircuitBreakerState.OPEN) {
      const now = new Date();
      if (app.circuitBreakerResetAt && now < app.circuitBreakerResetAt) {
        return; // Circuit breaker still open
      }
      
      // Reset circuit breaker to HALF_OPEN
      await this.prisma.applications.update({
        where: { id: applicationId },
        data: { circuitBreakerState: CircuitBreakerState.HALF_OPEN }
      });
    }
    
    // 3. Check healing cooldown
    if (app.lastHealingAttempt) {
      const cooldownEnd = new Date(
        app.lastHealingAttempt.getTime() + app.healingCooldown * 1000
      );
      
      if (new Date() < cooldownEnd) {
        return; // Still in cooldown period
      }
    }
    
    // 4. Check max healing attempts
    if (app.currentHealingAttempts >= app.maxHealingAttempts) {
      // Open circuit breaker
      await this.prisma.applications.update({
        where: { id: applicationId },
        data: {
          circuitBreakerState: CircuitBreakerState.OPEN,
          circuitBreakerResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
        }
      });
      return;
    }
    
    // 5. Check if diagnosis found issues
    const healthScore = diagnosisResult.overallHealthScore;
    if (healthScore >= 80) {
      return; // Site is healthy, no healing needed
    }
    
    // 6. Check if recent diagnosis exists
    const recentDiagnosis = await this.prisma.diagnosis_history.findFirst({
      where: {
        applicationId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!recentDiagnosis) {
      return; // No recent diagnosis, trigger diagnosis first
    }
    
    // 7. Trigger healing
    await this.healingOrchestrator.heal(
      applicationId,
      HealerTrigger.AUTO,
      'SYSTEM'
    );
    
    // 8. Update healing attempt counter
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        currentHealingAttempts: { increment: 1 },
        lastHealingAttempt: new Date()
      }
    });
  }
}
```

### 5.2 Integration with Diagnosis Service

```typescript
// In UnifiedDiagnosisService.diagnose() method
async diagnose(...): Promise<DiagnosisResult> {
  // ... existing diagnosis logic ...
  
  // After diagnosis completes
  const result = {
    overallHealthScore,
    checkResults,
    correlationResult,
    // ...
  };
  
  // Trigger auto-heal if enabled
  await this.autoHealTrigger.checkAndTriggerAutoHeal(
    applicationId,
    result
  );
  
  return result;
}
```

## 6. Approval Workflow

### 6.1 Action Risk Classification



```typescript
enum ActionRiskLevel {
  LOW = 'LOW',       // Auto-approvable in AUTO_SAFE mode
  MEDIUM = 'MEDIUM', // Auto-approvable in AUTO_MODERATE mode
  HIGH = 'HIGH'      // Requires manual approval or AUTO_FULL mode
}

const ACTION_RISK_MAP = {
  // Low Risk (Safe)
  [HealingActionType.CACHE_CLEAR]: ActionRiskLevel.LOW,
  [HealingActionType.TRANSIENT_CLEANUP]: ActionRiskLevel.LOW,
  [HealingActionType.PERMISSION_FIX]: ActionRiskLevel.LOW,
  [HealingActionType.HTACCESS_RESET]: ActionRiskLevel.LOW,
  
  // Medium Risk
  [HealingActionType.PLUGIN_DEACTIVATE]: ActionRiskLevel.MEDIUM,
  [HealingActionType.THEME_SWITCH]: ActionRiskLevel.MEDIUM,
  [HealingActionType.MEMORY_LIMIT_INCREASE]: ActionRiskLevel.MEDIUM,
  [HealingActionType.DEBUG_MODE_DISABLE]: ActionRiskLevel.MEDIUM,
  
  // High Risk
  [HealingActionType.FILE_RESTORE]: ActionRiskLevel.HIGH,
  [HealingActionType.DATABASE_REPAIR]: ActionRiskLevel.HIGH,
  [HealingActionType.CORE_UPDATE]: ActionRiskLevel.HIGH,
  [HealingActionType.PLUGIN_UPDATE]: ActionRiskLevel.HIGH,
};
```

### 6.2 Approval Service

```typescript
@Injectable()
export class HealingApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}
  
  async requiresApproval(
    action: HealingAction,
    healingMode: HealingMode
  ): boolean {
    const riskLevel = ACTION_RISK_MAP[action.type];
    
    switch (healingMode) {
      case HealingMode.MANUAL:
        return true; // All actions require approval
        
      case HealingMode.AUTO_SAFE:
        return riskLevel !== ActionRiskLevel.LOW;
        
      case HealingMode.AUTO_MODERATE:
        return riskLevel === ActionRiskLevel.HIGH;
        
      case HealingMode.AUTO_FULL:
        return false; // No approval needed
        
      default:
        return true;
    }
  }
  
  async requestApproval(
    executionId: string,
    action: HealingAction,
    applicationId: string
  ): Promise<void> {
    // Create approval request
    await this.prisma.healing_approval_requests.create({
      data: {
        id: uuidv4(),
        executionId,
        actionType: action.type,
        actionDescription: action.description,
        riskLevel: ACTION_RISK_MAP[action.type],
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      }
    });
    
    // Send notification to admin
    await this.notificationService.sendApprovalRequest(
      applicationId,
      action
    );
  }
  
  async approveAction(
    approvalId: string,
    approvedBy: string
  ): Promise<void> {
    await this.prisma.healing_approval_requests.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date()
      }
    });
  }
  
  async rejectAction(
    approvalId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    await this.prisma.healing_approval_requests.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectionReason: reason,
        rejectedAt: new Date()
      }
    });
  }
}
```

## 7. Error Handling & Rollback

### 7.1 Command Execution Failures

```typescript
interface CommandExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  duration: number;
}

async executeWithErrorHandling(
  serverId: string,
  command: string,
  options: ExecutionOptions
): Promise<CommandExecutionResult> {
  const startTime = Date.now();
  
  try {
    const output = await this.sshExecutor.executeCommand(
      serverId,
      command,
      options
    );
    
    return {
      success: true,
      output,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    // Parse error type
    const errorType = this.classifyError(error);
    
    // Log error with context
    this.logger.error(`Command failed: ${command}`, {
      error: error.message,
      errorType,
      serverId,
      duration: Date.now() - startTime
    });
    
    return {
      success: false,
      error: error.message,
      exitCode: error.exitCode,
      duration: Date.now() - startTime
    };
  }
}

private classifyError(error: any): ErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout')) {
    return ErrorType.TIMEOUT;
  }
  if (message.includes('permission denied')) {
    return ErrorType.PERMISSION_DENIED;
  }
  if (message.includes('no such file')) {
    return ErrorType.FILE_NOT_FOUND;
  }
  if (message.includes('command not found')) {
    return ErrorType.COMMAND_NOT_FOUND;
  }
  if (message.includes('connection')) {
    return ErrorType.CONNECTION_ERROR;
  }
  
  return ErrorType.UNKNOWN;
}
```

### 7.2 Rollback Strategy

```typescript
@Injectable()
export class RollbackService {
  constructor(
    private readonly backupService: BackupService,
    private readonly verificationService: VerificationService,
    private readonly auditService: AuditService
  ) {}
  
  async rollback(
    applicationId: string,
    executionId: string,
    backupId: string
  ): Promise<RollbackResult> {
    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: { servers: true }
    });
    
    try {
      // 1. Restore from backup
      await this.backupService.restoreBackup(
        app.serverId,
        app.path,
        backupId
      );
      
      // 2. Verify restoration
      const verification = await this.verificationService.verify(
        app.serverId,
        app.path,
        app.domain,
        'ROLLBACK'
      );
      
      // 3. Update execution record
      await this.prisma.healing_executions_new.update({
        where: { id: executionId },
        data: {
          rollbackExecuted: true,
          rollbackVerificationScore: verification.score,
          rollbackCompletedAt: new Date()
        }
      });
      
      // 4. Audit log
      await this.auditService.log({
        action: 'HEALING_ROLLBACK',
        resource: 'APPLICATION',
        resourceId: applicationId,
        description: `Rolled back healing execution ${executionId}`,
        metadata: {
          executionId,
          backupId,
          verificationScore: verification.score,
          passed: verification.passed
        },
        severity: 'WARNING',
        actorType: 'SYSTEM'
      });
      
      return {
        success: verification.passed,
        verificationScore: verification.score,
        message: verification.passed 
          ? 'Rollback successful' 
          : 'Rollback completed but verification failed'
      };
      
    } catch (error) {
      // Rollback failed - critical situation
      await this.auditService.log({
        action: 'HEALING_ROLLBACK_FAILED',
        resource: 'APPLICATION',
        resourceId: applicationId,
        description: `CRITICAL: Rollback failed for ${executionId}`,
        metadata: {
          executionId,
          backupId,
          error: error.message
        },
        severity: 'CRITICAL',
        actorType: 'SYSTEM'
      });
      
      // Open circuit breaker
      await this.prisma.applications.update({
        where: { id: applicationId },
        data: {
          circuitBreakerState: CircuitBreakerState.OPEN,
          circuitBreakerResetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });
      
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }
}
```

## 8. Monitoring & Alerting

### 8.1 Healing Metrics

```typescript
interface HealingMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  rolledBackExecutions: number;
  averageExecutionTime: number;
  averageVerificationScore: number;
  successRate: number;
  
  byStrategy: {
    [strategyName: string]: {
      executions: number;
      successes: number;
      failures: number;
      successRate: number;
    };
  };
  
  byAction: {
    [actionType: string]: {
      executions: number;
      successes: number;
      failures: number;
      averageDuration: number;
    };
  };
}

@Injectable()
export class HealingMetricsService {
  async getMetrics(
    applicationId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<HealingMetrics> {
    // Query healing_executions_new table
    // Aggregate metrics
    // Return structured metrics
  }
}
```

### 8.2 Alert Conditions

```typescript
enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

const ALERT_CONDITIONS = {
  HEALING_FAILED: {
    severity: AlertSeverity.ERROR,
    message: 'Healing execution failed',
    notifyAdmin: true
  },
  
  ROLLBACK_EXECUTED: {
    severity: AlertSeverity.WARNING,
    message: 'Healing rolled back due to failure',
    notifyAdmin: true
  },
  
  CIRCUIT_BREAKER_OPEN: {
    severity: AlertSeverity.CRITICAL,
    message: 'Circuit breaker opened - max healing attempts reached',
    notifyAdmin: true
  },
  
  ROLLBACK_FAILED: {
    severity: AlertSeverity.CRITICAL,
    message: 'CRITICAL: Rollback failed - manual intervention required',
    notifyAdmin: true,
    escalate: true
  },
  
  VERIFICATION_FAILED: {
    severity: AlertSeverity.ERROR,
    message: 'Post-healing verification failed',
    notifyAdmin: true
  }
};
```

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] HealingStrategySelector service
- [ ] HealingExecutor service
- [ ] BackupService implementation
- [ ] RollbackService implementation
- [ ] Database schema updates

### Phase 2: Healing Strategies (Week 3-4)
- [ ] WSOD recovery strategy
- [ ] Database connection strategy
- [ ] Maintenance mode strategy
- [ ] Core integrity strategy
- [ ] Permission fix strategy

### Phase 3: Auto-Heal Logic (Week 5)
- [ ] AutoHealTrigger service
- [ ] Circuit breaker logic
- [ ] Cooldown management
- [ ] Integration with diagnosis service

### Phase 4: Approval Workflow (Week 6)
- [ ] HealingApproval service
- [ ] Approval request UI
- [ ] Notification system integration
- [ ] Admin dashboard

### Phase 5: Monitoring & Alerts (Week 7)
- [ ] HealingMetrics service
- [ ] Alert system
- [ ] Admin notifications
- [ ] Healing history UI

### Phase 6: Testing & Refinement (Week 8)
- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance testing
- [ ] Security audit

## 10. API Endpoints



```typescript
// Healing Controller
@Controller('healer/healing')
export class HealingController {
  
  // Trigger manual healing
  @Post(':applicationId/heal')
  async triggerHealing(
    @Param('applicationId') applicationId: string,
    @Body() body: { strategy?: string; actions?: string[] }
  ) {
    return this.healingOrchestrator.heal(
      applicationId,
      HealerTrigger.MANUAL,
      'USER'
    );
  }
  
  // Get healing history
  @Get(':applicationId/history')
  async getHealingHistory(
    @Param('applicationId') applicationId: string,
    @Query('limit') limit: number = 10
  ) {
    return this.prisma.healing_executions_new.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
  
  // Get healing metrics
  @Get(':applicationId/metrics')
  async getHealingMetrics(
    @Param('applicationId') applicationId: string
  ) {
    return this.healingMetrics.getMetrics(applicationId);
  }
  
  // Approve healing action
  @Post('approvals/:approvalId/approve')
  async approveAction(
    @Param('approvalId') approvalId: string,
    @Body() body: { approvedBy: string }
  ) {
    return this.healingApproval.approveAction(
      approvalId,
      body.approvedBy
    );
  }
  
  // Reject healing action
  @Post('approvals/:approvalId/reject')
  async rejectAction(
    @Param('approvalId') approvalId: string,
    @Body() body: { rejectedBy: string; reason: string }
  ) {
    return this.healingApproval.rejectAction(
      approvalId,
      body.rejectedBy,
      body.reason
    );
  }
  
  // Get pending approvals
  @Get('approvals/pending')
  async getPendingApprovals() {
    return this.prisma.healing_approval_requests.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  // Update healing configuration
  @Patch(':applicationId/config')
  async updateHealingConfig(
    @Param('applicationId') applicationId: string,
    @Body() config: {
      isHealerEnabled?: boolean;
      healingMode?: HealingMode;
      maxHealingAttempts?: number;
      healingCooldown?: number;
    }
  ) {
    return this.prisma.applications.update({
      where: { id: applicationId },
      data: config
    });
  }
  
  // Reset circuit breaker
  @Post(':applicationId/circuit-breaker/reset')
  async resetCircuitBreaker(
    @Param('applicationId') applicationId: string
  ) {
    return this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        circuitBreakerState: CircuitBreakerState.CLOSED,
        circuitBreakerResetAt: null,
        currentHealingAttempts: 0,
        consecutiveFailures: 0
      }
    });
  }
}
```

## 11. Frontend Integration

### 11.1 Healing Configuration UI

```typescript
// HealingConfigModal.tsx
interface HealingConfig {
  isHealerEnabled: boolean;
  healingMode: HealingMode;
  maxHealingAttempts: number;
  healingCooldown: number;
}

export function HealingConfigModal({ applicationId }: Props) {
  const [config, setConfig] = useState<HealingConfig>({
    isHealerEnabled: false,
    healingMode: HealingMode.MANUAL,
    maxHealingAttempts: 3,
    healingCooldown: 3600
  });
  
  const handleSave = async () => {
    await api.patch(`/healer/healing/${applicationId}/config`, config);
  };
  
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Auto-Heal Configuration</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <Label>Enable Auto-Heal</Label>
            <Switch
              checked={config.isHealerEnabled}
              onCheckedChange={(checked) => 
                setConfig({ ...config, isHealerEnabled: checked })
              }
            />
          </div>
          
          {/* Healing Mode */}
          <div>
            <Label>Healing Mode</Label>
            <Select
              value={config.healingMode}
              onValueChange={(value) => 
                setConfig({ ...config, healingMode: value as HealingMode })
              }
            >
              <SelectItem value="MANUAL">Manual (Requires Approval)</SelectItem>
              <SelectItem value="AUTO_SAFE">Auto-Safe (Low Risk Only)</SelectItem>
              <SelectItem value="AUTO_MODERATE">Auto-Moderate (Low + Medium Risk)</SelectItem>
              <SelectItem value="AUTO_FULL">Auto-Full (All Actions)</SelectItem>
            </Select>
          </div>
          
          {/* Max Attempts */}
          <div>
            <Label>Max Healing Attempts</Label>
            <Input
              type="number"
              value={config.maxHealingAttempts}
              onChange={(e) => 
                setConfig({ ...config, maxHealingAttempts: parseInt(e.target.value) })
              }
            />
          </div>
          
          {/* Cooldown */}
          <div>
            <Label>Cooldown Period (seconds)</Label>
            <Input
              type="number"
              value={config.healingCooldown}
              onChange={(e) => 
                setConfig({ ...config, healingCooldown: parseInt(e.target.value) })
              }
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 11.2 Healing History UI

```typescript
// HealingHistoryTab.tsx
export function HealingHistoryTab({ applicationId }: Props) {
  const { data: history } = useQuery({
    queryKey: ['healing-history', applicationId],
    queryFn: () => api.get(`/healer/healing/${applicationId}/history`)
  });
  
  return (
    <div className="space-y-4">
      {history?.map((execution) => (
        <Card key={execution.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{execution.strategy}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {new Date(execution.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge variant={
                execution.executionStatus === 'COMPLETED' ? 'success' :
                execution.executionStatus === 'FAILED' ? 'destructive' :
                'default'
              }>
                {execution.executionStatus}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Verification Score:</span>
                <span className="font-medium">
                  {execution.verificationScore}/100
                </span>
              </div>
              
              {execution.rollbackExecuted && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Healing was rolled back due to failure
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Actions Executed:</h4>
                <div className="space-y-1">
                  {execution.actions?.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {action.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>{action.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## 12. Security Considerations

### 12.1 Command Injection Prevention

```typescript
// Sanitize all user inputs before command execution
function sanitizeInput(input: string): string {
  // Remove dangerous characters
  return input.replace(/[;&|`$(){}[\]<>]/g, '');
}

// Use parameterized commands
function buildCommand(template: string, params: Record<string, string>): string {
  let command = template;
  for (const [key, value] of Object.entries(params)) {
    const sanitized = sanitizeInput(value);
    command = command.replace(`{{${key}}}`, sanitized);
  }
  return command;
}
```

### 12.2 Audit Logging

```typescript
// Log all healing actions
await this.auditService.log({
  action: 'HEALING_ACTION_EXECUTED',
  resource: 'APPLICATION',
  resourceId: applicationId,
  description: `Executed ${action.type}: ${action.description}`,
  metadata: {
    executionId,
    actionType: action.type,
    command: action.command,
    success: result.success,
    duration: result.duration
  },
  severity: result.success ? 'INFO' : 'ERROR',
  actorType: 'SYSTEM'
});
```

### 12.3 Rate Limiting

```typescript
// Prevent healing spam
@Injectable()
export class HealingRateLimiter {
  private readonly limits = new Map<string, number>();
  
  async checkRateLimit(applicationId: string): Promise<boolean> {
    const key = `healing:${applicationId}`;
    const count = this.limits.get(key) || 0;
    
    if (count >= 5) { // Max 5 healing attempts per hour
      return false;
    }
    
    this.limits.set(key, count + 1);
    
    // Reset after 1 hour
    setTimeout(() => {
      this.limits.delete(key);
    }, 60 * 60 * 1000);
    
    return true;
  }
}
```

## 13. Testing Strategy

### 13.1 Unit Tests

```typescript
describe('HealingStrategySelector', () => {
  it('should select WSOD strategy for plugin fatal error', () => {
    const correlationResult = {
      rootCauses: [{
        name: 'WSOD_CASCADE',
        confidence: 95
      }]
    };
    
    const strategy = selector.selectStrategy(
      correlationResult,
      checkResults,
      HealingMode.AUTO_MODERATE
    );
    
    expect(strategy.name).toBe('WSOD_RECOVERY');
    expect(strategy.actions).toHaveLength(3);
  });
});
```

### 13.2 Integration Tests

```typescript
describe('HealingExecutor', () => {
  it('should execute healing and rollback on failure', async () => {
    // Mock SSH executor to fail
    sshExecutor.executeCommand.mockRejectedValue(new Error('Command failed'));
    
    const result = await executor.executeHealing(
      applicationId,
      strategy,
      executionId
    );
    
    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(backupService.restoreBackup).toHaveBeenCalled();
  });
});
```

## 14. Summary

This healing module design provides:

✅ **Comprehensive Coverage**: 10 healing strategies for common WordPress issues
✅ **Safety First**: Backup before healing, rollback on failure
✅ **Intelligent Automation**: Auto-heal with circuit breaker and cooldown
✅ **Flexible Approval**: 4 healing modes (MANUAL, AUTO_SAFE, AUTO_MODERATE, AUTO_FULL)
✅ **Error Handling**: Command failure detection, retry logic, rollback procedures
✅ **Monitoring**: Metrics, alerts, audit logs
✅ **Security**: Command sanitization, rate limiting, audit trail
✅ **Extensibility**: Easy to add new strategies and actions

**Next Steps:**
1. Review and approve design
2. Create database migrations
3. Implement Phase 1 (Core Infrastructure)
4. Begin Phase 2 (Healing Strategies)
