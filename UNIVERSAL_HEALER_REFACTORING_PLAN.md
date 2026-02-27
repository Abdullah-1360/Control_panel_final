# Universal Healer Module - Refactoring Plan

## Executive Summary

Transform the WordPress-specific healer module into a universal, tech-stack-agnostic diagnostic and healing system with pluggable architecture, supporting multiple web frameworks and databases.

**Timeline:** 11 weeks  
**Priority:** High  
**Status:** Planning Phase

---

## 1. Project Scope

### 1.1 Included Tech Stacks (Phase 1)

**Web Applications:**
- WordPress (maintain existing functionality)
- Node.js (generic)
- PHP (generic)
- Laravel
- Next.js
- Express.js

**Databases:**
- MySQL (diagnostic checks only)

### 1.2 Future Expansion (Phase 2+)

**Web Applications:**
- Django (Python)
- Flask (Python)
- Ruby on Rails
- FastAPI (Python)

**Databases:**
- PostgreSQL
- MongoDB
- Redis

**Services:**
- Message Queues (RabbitMQ, Redis Queue)
- Caching Layers (Redis, Memcached)

---

## 2. Architecture Overview

### 2.0 Migration Strategy (ACTIVE)

**Current Status:** Phase 2.5 - Stabilization  
**Decision:** Gradual Migration (Option 1)  
**Timeline:** 10 weeks total (Feb 26 - May 6, 2026)

**Rationale:**
- WordPress healer is fully functional and production-ready
- Universal healer requires per-tech-stack plugins (Phase 3)
- Cannot identify all tech stacks at once during discovery
- Dual system approach minimizes risk and maintains stability

**Implementation Approach:**
1. **Phase 2.5 (NOW):** Keep WordPress working, document strategy, add UI banners
2. **Phase 3 (4-6 weeks):** Implement plugins, migrate WordPress to universal system
3. **Phase 4 (2-3 weeks):** Deprecate old endpoints, cleanup code

**Key Principles:**
- No breaking changes to working WordPress functionality
- Clean separation during development
- Easy to test new features without affecting production
- Gradual rollout with feature flags

**Reference:** See `GRADUAL_MIGRATION_STRATEGY.md` for complete details

### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────┐
│                  Application Registry                    │
│         (Replaces wp_sites with applications)           │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Tech Stack Detection Engine                 │
│    (Auto-detect via file signatures + manual override)  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Plugin Registry & Loader                │
│         (Manages tech stack plugins lifecycle)          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│            Diagnostic Check Framework                    │
│     (Shared checks + tech-specific checks)              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Healing Strategy Engine                     │
│   (MANUAL / SUPERVISED / AUTO modes with risk levels)   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│          Circuit Breaker & Retry Logic                   │
│      (Prevents infinite loops, cooldown periods)        │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│             Backup & Rollback System                     │
│        (Tech-stack-specific backup strategies)          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Plugin Architecture

Each tech stack is implemented as a plugin with standardized interface:

```typescript
interface IStackPlugin {
  // Plugin metadata
  name: string;
  version: string;
  supportedVersions: string[];
  
  // Detection
  detect(server: Server, path: string): Promise<DetectionResult>;
  
  // Diagnostic checks
  getDiagnosticChecks(): DiagnosticCheck[];
  
  // Healing strategies
  getHealingStrategies(): HealingStrategy[];
  
  // Backup/restore
  getBackupStrategy(): BackupStrategy;
}
```

---

## 3. Database Schema Changes

### 3.1 New Schema (Prisma)


```prisma
// Rename wp_sites to applications
model applications {
  id                    String   @id @default(uuid())
  serverId              String   @map("server_id")
  domain                String
  path                  String
  
  // Tech Stack Information
  techStack             TechStack
  techStackVersion      String?  @map("tech_stack_version")
  detectionMethod       DetectionMethod @default(AUTO)
  detectionConfidence   Float    @default(0.0) // 0.0 to 1.0
  
  // Health & Status
  healthStatus          HealthStatus @default(UNKNOWN)
  healthScore           Int      @default(0) // 0-100
  lastHealthCheck       DateTime? @map("last_health_check")
  
  // Healing Configuration
  healingMode           HealingMode @default(MANUAL)
  isHealerEnabled       Boolean  @default(false) @map("is_healer_enabled")
  maxHealingAttempts    Int      @default(3) @map("max_healing_attempts")
  healingCooldown       Int      @default(3600) @map("healing_cooldown") // seconds
  currentHealingAttempts Int     @default(0) @map("current_healing_attempts")
  lastHealingAttempt    DateTime? @map("last_healing_attempt")
  
  // Metadata (JSONB for flexibility)
  metadata              Json     @default("{}")
  
  // Timestamps
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")
  
  // Relations
  servers               servers  @relation(fields: [serverId], references: [id])
  diagnostic_results    diagnostic_results[]
  healing_executions    healing_executions[]
  
  @@map("applications")
}

enum TechStack {
  WORDPRESS
  NODEJS
  PHP_GENERIC
  LARAVEL
  NEXTJS
  EXPRESS
  DJANGO      // Future
  FLASK       // Future
  RAILS       // Future
  MYSQL       // Database
  POSTGRESQL  // Future
  MONGODB     // Future
}

enum DetectionMethod {
  AUTO
  MANUAL
  HYBRID
}

enum HealingMode {
  MANUAL      // Always require approval
  SUPERVISED  // Auto-heal LOW risk, require approval for MEDIUM/HIGH
  AUTO        // Auto-heal LOW/MEDIUM, require approval for HIGH only
}

// New table for diagnostic check results
model diagnostic_results {
  id                String   @id @default(uuid())
  applicationId     String   @map("application_id")
  checkName         String   @map("check_name")
  checkCategory     CheckCategory @map("check_category")
  status            CheckStatus
  severity          RiskLevel
  message           String
  details           Json     @default("{}")
  suggestedFix      String?  @map("suggested_fix")
  executionTime     Int      @map("execution_time") // milliseconds
  createdAt         DateTime @default(now()) @map("created_at")
  
  applications      applications @relation(fields: [applicationId], references: [id])
  
  @@map("diagnostic_results")
}

enum CheckCategory {
  SYSTEM        // Disk, memory, CPU
  SECURITY      // Permissions, vulnerabilities
  PERFORMANCE   // Slow queries, caching
  CONFIGURATION // Config files, environment
  DEPENDENCIES  // Package versions, updates
  DATABASE      // Connection, integrity
}

enum CheckStatus {
  PASS
  WARN
  FAIL
  ERROR
}

enum RiskLevel {
  LOW       // Safe to auto-heal
  MEDIUM    // Requires caution
  HIGH      // Requires manual approval
  CRITICAL  // Never auto-heal
}

// Tech stack plugins metadata
model tech_stack_plugins {
  id              String   @id @default(uuid())
  name            String   @unique
  techStack       TechStack @map("tech_stack")
  version         String
  isEnabled       Boolean  @default(true) @map("is_enabled")
  isBuiltIn       Boolean  @default(true) @map("is_built_in")
  npmPackage      String?  @map("npm_package") // For community plugins
  configuration   Json     @default("{}")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@map("tech_stack_plugins")
}
```

### 3.2 Migration Strategy

**Approach:** Dual system temporarily (Option C)

1. Create new `applications` table alongside `wp_sites`
2. Migrate existing WordPress sites to `applications` with `techStack = WORDPRESS`
3. Keep both tables operational during transition period
4. Deprecate `wp_sites` after 2 release cycles
5. Remove `wp_sites` in major version bump

---

## 4. Tech Stack Detection

### 4.1 Detection Signatures


```typescript
const DETECTION_SIGNATURES = {
  WORDPRESS: {
    files: ['wp-config.php', 'wp-content/', 'wp-includes/'],
    confidence: 0.95,
    versionFile: 'wp-includes/version.php',
    versionRegex: /\$wp_version = '([^']+)'/
  },
  NODEJS: {
    files: ['package.json'],
    confidence: 0.90,
    versionCommand: 'node --version',
    packageJsonCheck: (pkg) => !pkg.dependencies?.wordpress
  },
  LARAVEL: {
    files: ['artisan', 'composer.json'],
    confidence: 0.95,
    composerCheck: (composer) => composer.require?.['laravel/framework']
  },
  NEXTJS: {
    files: ['package.json', 'next.config.js'],
    confidence: 0.95,
    packageJsonCheck: (pkg) => pkg.dependencies?.next
  },
  EXPRESS: {
    files: ['package.json'],
    confidence: 0.85,
    packageJsonCheck: (pkg) => pkg.dependencies?.express && !pkg.dependencies?.next
  },
  PHP_GENERIC: {
    files: ['index.php', 'composer.json'],
    confidence: 0.70,
    fallback: true // Used when PHP detected but no specific framework
  },
  MYSQL: {
    portCheck: 3306,
    processCheck: 'mysqld',
    confidence: 0.90
  }
};
```

### 4.2 Detection Algorithm

```typescript
class TechStackDetector {
  async detect(server: Server, path: string): Promise<DetectionResult> {
    const results: DetectionResult[] = [];
    
    // Run all detection signatures in parallel
    for (const [stack, signature] of Object.entries(DETECTION_SIGNATURES)) {
      const result = await this.checkSignature(server, path, stack, signature);
      if (result.detected) {
        results.push(result);
      }
    }
    
    // Sort by confidence and return highest
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results[0] || {
      techStack: 'UNKNOWN',
      confidence: 0,
      detected: false
    };
  }
}
```

---

## 5. Diagnostic Check Framework

### 5.1 Base Check Class


```typescript
abstract class DiagnosticCheck {
  abstract name: string;
  abstract category: CheckCategory;
  abstract riskLevel: RiskLevel;
  abstract description: string;
  
  abstract execute(
    application: Application,
    server: Server
  ): Promise<CheckResult>;
  
  protected createResult(
    status: CheckStatus,
    message: string,
    details?: any,
    suggestedFix?: string
  ): CheckResult {
    return {
      checkName: this.name,
      category: this.category,
      status,
      severity: this.riskLevel,
      message,
      details: details || {},
      suggestedFix,
      executionTime: 0 // Set by framework
    };
  }
}
```

### 5.2 Shared Checks (All Tech Stacks)

```typescript
// Disk Space Check
class DiskSpaceCheck extends DiagnosticCheck {
  name = 'disk_space';
  category = CheckCategory.SYSTEM;
  riskLevel = RiskLevel.MEDIUM;
  description = 'Check available disk space';
  
  async execute(app: Application, server: Server): Promise<CheckResult> {
    const result = await this.ssh.exec(server, 'df -h /');
    const usage = this.parseDiskUsage(result);
    
    if (usage > 90) {
      return this.createResult(
        CheckStatus.FAIL,
        `Disk usage at ${usage}% - critically low`,
        { usage },
        'Free up disk space or expand storage'
      );
    }
    
    return this.createResult(CheckStatus.PASS, `Disk usage: ${usage}%`);
  }
}

// Memory Check
class MemoryCheck extends DiagnosticCheck {
  name = 'memory_usage';
  category = CheckCategory.SYSTEM;
  riskLevel = RiskLevel.LOW;
  description = 'Check memory usage';
  
  async execute(app: Application, server: Server): Promise<CheckResult> {
    const result = await this.ssh.exec(server, 'free -m');
    const { used, total } = this.parseMemory(result);
    const percentage = (used / total) * 100;
    
    if (percentage > 85) {
      return this.createResult(
        CheckStatus.WARN,
        `Memory usage at ${percentage.toFixed(1)}%`,
        { used, total, percentage }
      );
    }
    
    return this.createResult(CheckStatus.PASS, `Memory usage: ${percentage.toFixed(1)}%`);
  }
}
```

### 5.3 Tech-Specific Checks


```typescript
// Node.js: NPM Audit Check
class NpmAuditCheck extends DiagnosticCheck {
  name = 'npm_audit';
  category = CheckCategory.SECURITY;
  riskLevel = RiskLevel.HIGH;
  description = 'Check for npm package vulnerabilities';
  
  async execute(app: Application, server: Server): Promise<CheckResult> {
    const result = await this.ssh.exec(
      server,
      `cd ${app.path} && npm audit --json`
    );
    
    const audit = JSON.parse(result);
    const { high, critical } = audit.metadata.vulnerabilities;
    
    if (critical > 0) {
      return this.createResult(
        CheckStatus.FAIL,
        `${critical} critical vulnerabilities found`,
        audit,
        'Run: npm audit fix --force'
      );
    }
    
    return this.createResult(CheckStatus.PASS, 'No critical vulnerabilities');
  }
}

// WordPress: Plugin Update Check
class WpPluginUpdateCheck extends DiagnosticCheck {
  name = 'wp_plugin_updates';
  category = CheckCategory.DEPENDENCIES;
  riskLevel = RiskLevel.MEDIUM;
  description = 'Check for WordPress plugin updates';
  
  async execute(app: Application, server: Server): Promise<CheckResult> {
    const result = await this.ssh.exec(
      server,
      `cd ${app.path} && wp plugin list --update=available --format=json`
    );
    
    const updates = JSON.parse(result);
    
    if (updates.length > 0) {
      return this.createResult(
        CheckStatus.WARN,
        `${updates.length} plugin updates available`,
        { updates },
        'Update plugins via WP-CLI or admin panel'
      );
    }
    
    return this.createResult(CheckStatus.PASS, 'All plugins up to date');
  }
}

// MySQL: Connection Check
class MysqlConnectionCheck extends DiagnosticCheck {
  name = 'mysql_connection';
  category = CheckCategory.DATABASE;
  riskLevel = RiskLevel.HIGH;
  description = 'Check MySQL database connection';
  
  async execute(app: Application, server: Server): Promise<CheckResult> {
    try {
      await this.ssh.exec(
        server,
        `mysql -u${app.metadata.dbUser} -p${app.metadata.dbPass} -e "SELECT 1"`
      );
      
      return this.createResult(CheckStatus.PASS, 'Database connection successful');
    } catch (error) {
      return this.createResult(
        CheckStatus.FAIL,
        'Cannot connect to database',
        { error: error.message },
        'Check database credentials and service status'
      );
    }
  }
}
```

---

## 6. Healing Strategy Engine

### 6.1 Healing Modes


```typescript
class HealingStrategyEngine {
  async determineHealingApproach(
    diagnosticResults: DiagnosticResult[],
    healingMode: HealingMode
  ): Promise<HealingPlan> {
    const failedChecks = diagnosticResults.filter(r => r.status === CheckStatus.FAIL);
    
    const plan: HealingPlan = {
      autoHeal: [],
      requireApproval: [],
      cannotHeal: []
    };
    
    for (const check of failedChecks) {
      const action = this.getHealingAction(check);
      
      if (!action) {
        plan.cannotHeal.push(check);
        continue;
      }
      
      // Determine if auto-heal based on mode and risk level
      if (this.canAutoHeal(healingMode, check.severity)) {
        plan.autoHeal.push({ check, action });
      } else {
        plan.requireApproval.push({ check, action });
      }
    }
    
    return plan;
  }
  
  private canAutoHeal(mode: HealingMode, risk: RiskLevel): boolean {
    switch (mode) {
      case HealingMode.MANUAL:
        return false; // Never auto-heal
        
      case HealingMode.SUPERVISED:
        return risk === RiskLevel.LOW; // Only LOW risk
        
      case HealingMode.AUTO:
        return risk === RiskLevel.LOW || risk === RiskLevel.MEDIUM; // LOW and MEDIUM
        
      default:
        return false;
    }
  }
}
```

### 6.2 Healing Actions

```typescript
interface HealingAction {
  name: string;
  description: string;
  commands: string[];
  requiresBackup: boolean;
  estimatedDuration: number; // seconds
  rollbackStrategy?: () => Promise<void>;
}

// Example: Clear cache action
const CLEAR_CACHE_ACTION: HealingAction = {
  name: 'clear_cache',
  description: 'Clear application cache',
  commands: [
    'rm -rf /tmp/cache/*',
    'php artisan cache:clear', // Laravel
    'npm run build' // Rebuild if needed
  ],
  requiresBackup: false,
  estimatedDuration: 30
};

// Example: Update dependencies action
const UPDATE_DEPENDENCIES_ACTION: HealingAction = {
  name: 'update_dependencies',
  description: 'Update application dependencies',
  commands: [
    'npm audit fix',
    'npm install'
  ],
  requiresBackup: true,
  estimatedDuration: 120,
  rollbackStrategy: async () => {
    // Restore package-lock.json from backup
  }
};
```

---

## 7. Plugin Implementation

### 7.1 WordPress Plugin (Maintain Compatibility)


```typescript
// backend/src/modules/healer/plugins/wordpress.plugin.ts
export class WordPressPlugin implements IStackPlugin {
  name = 'wordpress';
  version = '1.0.0';
  supportedVersions = ['5.x', '6.x'];
  
  async detect(server: Server, path: string): Promise<DetectionResult> {
    const hasWpConfig = await this.ssh.fileExists(server, `${path}/wp-config.php`);
    const hasWpContent = await this.ssh.dirExists(server, `${path}/wp-content`);
    
    if (hasWpConfig && hasWpContent) {
      const version = await this.getWpVersion(server, path);
      return {
        detected: true,
        techStack: TechStack.WORDPRESS,
        version,
        confidence: 0.95
      };
    }
    
    return { detected: false, confidence: 0 };
  }
  
  getDiagnosticChecks(): DiagnosticCheck[] {
    return [
      new WpCoreUpdateCheck(),
      new WpPluginUpdateCheck(),
      new WpThemeUpdateCheck(),
      new WpDatabaseCheck(),
      new WpPermissionsCheck(),
      new WpDebugModeCheck(),
      new WpPluginConflictCheck()
    ];
  }
  
  getHealingStrategies(): HealingStrategy[] {
    return [
      new WpClearCacheStrategy(),
      new WpUpdateCoreStrategy(),
      new WpUpdatePluginsStrategy(),
      new WpRepairDatabaseStrategy(),
      new WpFixPermissionsStrategy(),
      new WpDisableDebugStrategy()
    ];
  }
  
  getBackupStrategy(): BackupStrategy {
    return new WpBackupStrategy(); // Database + files
  }
}
```

### 7.2 Node.js Plugin

```typescript
// backend/src/modules/healer/plugins/nodejs.plugin.ts
export class NodeJsPlugin implements IStackPlugin {
  name = 'nodejs';
  version = '1.0.0';
  supportedVersions = ['18.x', '20.x', '22.x'];
  
  async detect(server: Server, path: string): Promise<DetectionResult> {
    const hasPackageJson = await this.ssh.fileExists(server, `${path}/package.json`);
    
    if (hasPackageJson) {
      const pkg = await this.readPackageJson(server, path);
      const version = await this.getNodeVersion(server);
      
      return {
        detected: true,
        techStack: TechStack.NODEJS,
        version,
        confidence: 0.90,
        metadata: { packageName: pkg.name }
      };
    }
    
    return { detected: false, confidence: 0 };
  }
  
  getDiagnosticChecks(): DiagnosticCheck[] {
    return [
      new NpmAuditCheck(),
      new NodeVersionCheck(),
      new PackageLockCheck(),
      new EnvironmentVariablesCheck(),
      new ProcessHealthCheck()
    ];
  }
  
  getHealingStrategies(): HealingStrategy[] {
    return [
      new NpmInstallStrategy(),
      new NpmAuditFixStrategy(),
      new RestartProcessStrategy(),
      new ClearNodeModulesStrategy()
    ];
  }
  
  getBackupStrategy(): BackupStrategy {
    return new NodeJsBackupStrategy(); // package.json, package-lock.json, .env
  }
}
```

### 7.3 Laravel Plugin


```typescript
// backend/src/modules/healer/plugins/laravel.plugin.ts
export class LaravelPlugin implements IStackPlugin {
  name = 'laravel';
  version = '1.0.0';
  supportedVersions = ['9.x', '10.x', '11.x'];
  
  async detect(server: Server, path: string): Promise<DetectionResult> {
    const hasArtisan = await this.ssh.fileExists(server, `${path}/artisan`);
    const hasComposer = await this.ssh.fileExists(server, `${path}/composer.json`);
    
    if (hasArtisan && hasComposer) {
      const composer = await this.readComposerJson(server, path);
      const isLaravel = composer.require?.['laravel/framework'];
      
      if (isLaravel) {
        const version = await this.getLaravelVersion(server, path);
        return {
          detected: true,
          techStack: TechStack.LARAVEL,
          version,
          confidence: 0.95
        };
      }
    }
    
    return { detected: false, confidence: 0 };
  }
  
  getDiagnosticChecks(): DiagnosticCheck[] {
    return [
      new LaravelConfigCacheCheck(),
      new LaravelRouteCacheCheck(),
      new LaravelStoragePermissionsCheck(),
      new LaravelDatabaseConnectionCheck(),
      new LaravelQueueWorkerCheck(),
      new ComposerDependenciesCheck()
    ];
  }
  
  getHealingStrategies(): HealingStrategy[] {
    return [
      new LaravelCacheClearStrategy(),
      new LaravelOptimizeStrategy(),
      new LaravelMigrateStrategy(),
      new LaravelQueueRestartStrategy(),
      new ComposerUpdateStrategy()
    ];
  }
  
  getBackupStrategy(): BackupStrategy {
    return new LaravelBackupStrategy(); // Database + storage + .env
  }
}
```

---

## 8. Implementation Phases

### Phase 2.5: Stabilization & Documentation (1 week) - IN PROGRESS

**Status:** ACTIVE  
**Start Date:** February 26, 2026  
**End Date:** March 4, 2026

**Objectives:**
- Stabilize WordPress healer functionality
- Document migration strategy
- Prepare for Phase 3 plugin development
- Add user-facing communication about upcoming features

**Tasks:**
- [x] Keep WordPress healer fully functional
- [x] Document gradual migration strategy (GRADUAL_MIGRATION_STRATEGY.md)
- [x] Update all related documentation
- [x] Add "Phase 3 coming soon" banner to HealerView component
- [x] Add health check endpoint showing migration status
- [x] Update UNIVERSAL_HEALER_REFACTORING_PLAN.md with migration strategy
- [x] Update PHASE2_IMPLEMENTATION_COMPLETE.md to reflect dual system
- [ ] Create API documentation marking endpoints as "operational" vs "preview"
- [ ] Create migration tracking dashboard/checklist

**Deliverables:**
- WordPress healer working perfectly ✅
- Clear documentation of migration path ✅
- No breaking changes ✅
- User communication in place ✅
- Health endpoint operational ✅

---

### Phase 1: Core Framework (2 weeks) - PLANNED

**Note:** This is Phase 3 in the migration timeline (after Phase 2.5 stabilization)

**Week 1:**
- [ ] Create new database schema (applications, diagnostic_results, tech_stack_plugins)
- [ ] Write Prisma migration scripts
- [ ] Implement dual system (keep wp_sites temporarily)
- [ ] Create base classes (DiagnosticCheck, HealingStrategy, BackupStrategy)
- [ ] Implement Plugin Registry & Loader

**Week 2:**
- [ ] Implement Tech Stack Detection Engine
- [ ] Create shared diagnostic checks (disk, memory, CPU, permissions)
- [ ] Implement Healing Strategy Engine with three modes
- [ ] Update Circuit Breaker logic for new schema
- [ ] Write unit tests for core framework

**Deliverables:**
- New database schema deployed
- Core framework operational
- Shared checks working
- 80%+ test coverage

---

### Phase 2: WordPress Plugin (2 weeks)

**Week 3:**
- [ ] Migrate WordPress plugin from old healer
- [ ] Adapt to new plugin interface
- [ ] Update all WordPress-specific checks
- [ ] Test with existing WordPress sites

**Week 4:**
- [ ] Migrate existing wp_sites data to applications table
- [ ] Verify backward compatibility
- [ ] Update frontend to support both schemas
- [ ] Integration testing

**Deliverables:**
- WordPress plugin fully functional
- All existing sites migrated
- No regression in WordPress functionality

---

### Phase 3: Node.js, PHP, Laravel Plugins (3 weeks)

**Week 5:**
- [ ] Implement Node.js plugin
- [ ] Create Node.js diagnostic checks (npm audit, version check, etc.)
- [ ] Create Node.js healing strategies
- [ ] Test with Express and generic Node.js apps

**Week 6:**
- [ ] Implement PHP Generic plugin
- [ ] Create PHP diagnostic checks (composer, version, extensions)
- [ ] Create PHP healing strategies
- [ ] Test with vanilla PHP applications

**Week 7:**
- [ ] Implement Laravel plugin
- [ ] Create Laravel-specific checks (artisan, cache, queue)
- [ ] Create Laravel healing strategies
- [ ] Integration testing with Laravel apps

**Deliverables:**
- 3 new tech stack plugins operational
- Comprehensive test coverage
- Documentation for each plugin

---

### Phase 4: Next.js, Express Plugins (2 weeks)

**Week 8:**
- [ ] Implement Next.js plugin
- [ ] Create Next.js diagnostic checks (build, SSR, API routes)
- [ ] Create Next.js healing strategies
- [ ] Test with Next.js applications

**Week 9:**
- [ ] Implement Express plugin
- [ ] Create Express diagnostic checks (middleware, routes, dependencies)
- [ ] Create Express healing strategies
- [ ] Integration testing

**Deliverables:**
- 2 additional plugins operational
- Full test coverage
- Plugin documentation

---

### Phase 5: MySQL Diagnostic Plugin (1 week)

**Week 10:**
- [ ] Implement MySQL plugin
- [ ] Create MySQL diagnostic checks (connection, slow queries, table integrity)
- [ ] Create MySQL healing strategies (optimize tables, repair, restart)
- [ ] Test with various MySQL configurations

**Deliverables:**
- MySQL plugin operational
- Database diagnostic capabilities
- Documentation

---

### Phase 6: Testing, Documentation, Deployment (1 week)

**Week 11:**
- [ ] End-to-end testing across all plugins
- [ ] Performance testing (handle 100+ applications)
- [ ] Security audit
- [ ] Complete API documentation
- [ ] Write user guide
- [ ] Deployment to staging
- [ ] Production deployment

**Deliverables:**
- Production-ready system
- Complete documentation
- Deployment runbook

---

## 9. API Changes

### 9.1 New Endpoints

```typescript
// Discovery with tech stack detection
POST /api/v1/healer/discover
Body: { serverId: string, paths?: string[] }
Response: { applications: Application[], detected: number }

// List applications (replaces listSites)
GET /api/v1/healer/applications
Query: { serverId?, techStack?, healthStatus?, page?, limit? }
Response: { data: Application[], pagination: {...} }

// Get application details
GET /api/v1/healer/applications/:id
Response: Application

// Diagnose application
POST /api/v1/healer/applications/:id/diagnose
Body: { triggeredBy?: string }
Response: { diagnosticResults: DiagnosticResult[], healingPlan: HealingPlan }

// Execute healing
POST /api/v1/healer/applications/:id/heal
Body: { executionId: string, approvedActions?: string[] }
Response: { execution: HealingExecution }

// Get tech stack plugins
GET /api/v1/healer/plugins
Response: { plugins: TechStackPlugin[] }

// Enable/disable plugin
PATCH /api/v1/healer/plugins/:id
Body: { isEnabled: boolean }
Response: { plugin: TechStackPlugin }
```

### 9.2 Deprecated Endpoints (Maintain for 2 releases)

```typescript
// Old WordPress-specific endpoints (still work but deprecated)
POST /api/v1/healer/discover-sites  // Use /discover instead
GET /api/v1/healer/sites            // Use /applications instead
GET /api/v1/healer/sites/:id        // Use /applications/:id instead
```

---

## 10. Frontend Changes

### 10.1 New UI Components


```typescript
// Tech Stack Badge Component
<TechStackBadge 
  techStack={application.techStack} 
  version={application.techStackVersion} 
/>

// Healing Mode Selector
<HealingModeSelector
  value={application.healingMode}
  onChange={(mode) => updateHealingMode(mode)}
  options={[
    { value: 'MANUAL', label: 'Manual', description: 'Always require approval' },
    { value: 'SUPERVISED', label: 'Supervised', description: 'Auto-heal low risk only' },
    { value: 'AUTO', label: 'Auto', description: 'Auto-heal low and medium risk' }
  ]}
/>

// Diagnostic Results Table
<DiagnosticResultsTable
  results={diagnosticResults}
  groupBy="category"
  showRiskLevel={true}
  onHealClick={(result) => handleHeal(result)}
/>

// Plugin Management Panel
<PluginManagementPanel
  plugins={techStackPlugins}
  onToggle={(pluginId, enabled) => togglePlugin(pluginId, enabled)}
  onConfigure={(pluginId) => configurePlugin(pluginId)}
/>
```

### 10.2 Updated Pages

1. **Applications List Page** (replaces Sites List)
   - Filter by tech stack
   - Show tech stack badges
   - Display health score
   - Healing mode indicator

2. **Application Details Page** (replaces Site Details)
   - Tech stack information section
   - Diagnostic results grouped by category
   - Healing history with risk levels
   - Configuration panel with healing mode

3. **Plugin Management Page** (new)
   - List all tech stack plugins
   - Enable/disable plugins
   - View plugin details
   - Configure plugin settings

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// Test diagnostic check
describe('DiskSpaceCheck', () => {
  it('should fail when disk usage > 90%', async () => {
    const check = new DiskSpaceCheck();
    const result = await check.execute(mockApp, mockServer);
    expect(result.status).toBe(CheckStatus.FAIL);
  });
});

// Test healing strategy
describe('HealingStrategyEngine', () => {
  it('should auto-heal LOW risk in SUPERVISED mode', () => {
    const engine = new HealingStrategyEngine();
    const canHeal = engine.canAutoHeal(HealingMode.SUPERVISED, RiskLevel.LOW);
    expect(canHeal).toBe(true);
  });
  
  it('should require approval for HIGH risk in AUTO mode', () => {
    const engine = new HealingStrategyEngine();
    const canHeal = engine.canAutoHeal(HealingMode.AUTO, RiskLevel.HIGH);
    expect(canHeal).toBe(false);
  });
});
```

### 11.2 Integration Tests

```typescript
describe('WordPress Plugin Integration', () => {
  it('should detect WordPress installation', async () => {
    const plugin = new WordPressPlugin();
    const result = await plugin.detect(testServer, '/var/www/wordpress');
    expect(result.detected).toBe(true);
    expect(result.techStack).toBe(TechStack.WORDPRESS);
  });
  
  it('should run all WordPress diagnostic checks', async () => {
    const checks = plugin.getDiagnosticChecks();
    const results = await Promise.all(
      checks.map(check => check.execute(testApp, testServer))
    );
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### 11.3 E2E Tests (Using Playwright for development)

```typescript
// Note: Playwright used for development testing only, not in production
test('should discover and diagnose Node.js application', async ({ page }) => {
  await page.goto('/healer/discover');
  await page.fill('[name="serverId"]', testServerId);
  await page.click('button:has-text("Discover")');
  
  await expect(page.locator('.application-card')).toBeVisible();
  await expect(page.locator('.tech-stack-badge:has-text("Node.js")')).toBeVisible();
  
  await page.click('button:has-text("Diagnose")');
  await expect(page.locator('.diagnostic-results')).toBeVisible();
});
```

---

## 12. Security Considerations

### 12.1 Plugin Security


- **Built-in plugins only** in Phase 1 (no dynamic loading)
- **Code review required** for all plugins
- **Sandboxed execution** for diagnostic checks (timeout, resource limits)
- **Input validation** for all plugin configurations
- **Audit logging** for all plugin actions

### 12.2 Healing Action Security

- **Backup before healing** for all MEDIUM+ risk actions
- **Rollback capability** for all destructive actions
- **Command injection prevention** (parameterized commands only)
- **Permission checks** before executing healing actions
- **Rate limiting** on healing attempts (circuit breaker)

### 12.3 Data Security

- **Encrypt sensitive metadata** (database credentials, API keys)
- **Audit log all healing actions** with actor, timestamp, result
- **RBAC enforcement** (only ADMIN/ENGINEER can trigger healing)
- **Secure credential storage** (use existing encryption service)

---

## 13. Performance Optimization

### 13.1 Diagnostic Check Optimization

```typescript
// Run checks in parallel with timeout
async runDiagnostics(application: Application): Promise<DiagnosticResult[]> {
  const checks = this.getChecksForTechStack(application.techStack);
  
  const results = await Promise.allSettled(
    checks.map(check => 
      this.runWithTimeout(check.execute(application, server), 30000)
    )
  );
  
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}
```

### 13.2 Caching Strategy

- **Cache tech stack detection** for 24 hours
- **Cache diagnostic results** for 5 minutes
- **Cache plugin metadata** indefinitely (invalidate on update)
- **Use Redis** for distributed caching

### 13.3 Database Optimization

- **Index on techStack, healthStatus, serverId**
- **Partition diagnostic_results** by createdAt (monthly)
- **Archive old healing_executions** after 90 days
- **Use connection pooling** (already implemented)

---

## 14. Monitoring & Observability

### 14.1 Metrics to Track

```typescript
// Prometheus metrics
const metrics = {
  'healer.diagnostics.total': Counter,
  'healer.diagnostics.duration': Histogram,
  'healer.healing.success_rate': Gauge,
  'healer.healing.attempts': Counter,
  'healer.circuit_breaker.trips': Counter,
  'healer.plugin.errors': Counter
};
```

### 14.2 Logging

```typescript
// Structured logging for all operations
this.logger.log('Diagnostic check executed', {
  applicationId,
  techStack,
  checkName,
  status,
  duration,
  riskLevel
});

this.logger.error('Healing action failed', {
  applicationId,
  actionName,
  error: error.message,
  rollbackPerformed: true
});
```

---

## 15. Documentation Requirements

### 15.1 Developer Documentation

- [ ] Plugin development guide
- [ ] Adding new tech stacks
- [ ] Creating custom diagnostic checks
- [ ] Implementing healing strategies
- [ ] Testing guidelines

### 15.2 User Documentation

- [ ] Tech stack support matrix
- [ ] Healing modes explained
- [ ] Risk levels guide
- [ ] Troubleshooting common issues
- [ ] API reference

### 15.3 Operations Documentation

- [ ] Deployment guide
- [ ] Migration runbook
- [ ] Monitoring setup
- [ ] Backup and recovery
- [ ] Performance tuning

---

## 16. Migration Checklist

### 16.1 Pre-Migration

- [ ] Backup production database
- [ ] Test migration script on staging
- [ ] Notify users of upcoming changes
- [ ] Prepare rollback plan

### 16.2 Migration Steps


```sql
-- Step 1: Create new tables
CREATE TABLE applications (...);
CREATE TABLE diagnostic_results (...);
CREATE TABLE tech_stack_plugins (...);

-- Step 2: Migrate existing wp_sites
INSERT INTO applications (
  id, server_id, domain, path, tech_stack, tech_stack_version,
  health_status, healing_mode, is_healer_enabled, created_at, updated_at
)
SELECT 
  id, server_id, domain, path, 'WORDPRESS', wp_version,
  health_status, healing_mode, is_healer_enabled, created_at, updated_at
FROM wp_sites;

-- Step 3: Verify migration
SELECT COUNT(*) FROM applications WHERE tech_stack = 'WORDPRESS';
SELECT COUNT(*) FROM wp_sites;
-- Counts should match

-- Step 4: Update foreign keys in healing_executions
ALTER TABLE healing_executions 
  ADD COLUMN application_id VARCHAR REFERENCES applications(id);

UPDATE healing_executions he
SET application_id = ws.id
FROM wp_sites ws
WHERE he.site_id = ws.id;

-- Step 5: Keep wp_sites for backward compatibility (2 releases)
-- Do NOT drop wp_sites yet
```

### 16.3 Post-Migration

- [ ] Verify all data migrated correctly
- [ ] Test WordPress plugin with migrated sites
- [ ] Monitor for errors in production
- [ ] Update frontend to use new API endpoints
- [ ] Deprecate old endpoints (keep functional)

---

## 17. Rollback Plan

### 17.1 If Migration Fails

```sql
-- Rollback: Drop new tables
DROP TABLE IF EXISTS diagnostic_results;
DROP TABLE IF EXISTS tech_stack_plugins;
DROP TABLE IF EXISTS applications;

-- Restore from backup
pg_restore -d opsmanager_dev backup.dump
```

### 17.2 If Issues Found Post-Migration

- Keep wp_sites table active
- Revert API endpoints to old implementation
- Fix issues in new system
- Re-migrate when ready

---

## 18. Success Criteria

### 18.1 Functional Requirements

- [ ] All 6 tech stacks supported (WordPress, Node.js, PHP, Laravel, Next.js, Express)
- [ ] MySQL diagnostic checks operational
- [ ] Three healing modes working correctly
- [ ] Auto-detection accuracy > 90%
- [ ] Backward compatibility maintained for WordPress sites
- [ ] Plugin system extensible for future tech stacks

### 18.2 Non-Functional Requirements

- [ ] API response time < 200ms (p95)
- [ ] Diagnostic check execution < 30s per application
- [ ] Support 100+ applications per server
- [ ] 80%+ test coverage
- [ ] Zero data loss during migration
- [ ] < 1 hour downtime for migration

### 18.3 Quality Requirements

- [ ] All code reviewed
- [ ] Security audit passed
- [ ] Performance testing completed
- [ ] Documentation complete
- [ ] User acceptance testing passed

---

## 19. Risk Assessment

### 19.1 High Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | HIGH | Comprehensive backups, test on staging first |
| Breaking existing WordPress functionality | HIGH | Maintain dual system, extensive testing |
| Plugin bugs causing system instability | MEDIUM | Sandboxed execution, timeouts, error handling |
| Performance degradation | MEDIUM | Load testing, caching, optimization |

### 19.2 Medium Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Incomplete tech stack detection | MEDIUM | Manual override option, confidence scores |
| Healing actions causing damage | MEDIUM | Backup before healing, rollback capability |
| Plugin compatibility issues | LOW | Version checking, graceful degradation |

---

## 20. Future Enhancements (Post-Phase 1)

### 20.1 Phase 2 Additions

- Python tech stacks (Django, Flask, FastAPI)
- Ruby on Rails support
- PostgreSQL and MongoDB diagnostic plugins
- Community plugin marketplace
- AI-powered diagnostic suggestions

### 20.2 Phase 3 Additions

- Container support (Docker, Kubernetes)
- Cloud platform integrations (AWS, GCP, Azure)
- Automated performance optimization
- Predictive healing (ML-based)
- Multi-region support

---

## 21. Team & Resources

### 21.1 Required Team

- **2 Backend Engineers** (NestJS, TypeScript, Prisma)
- **1 Frontend Engineer** (Next.js, React, TypeScript)
- **1 DevOps Engineer** (Deployment, monitoring)
- **1 QA Engineer** (Testing, automation)

### 21.2 Timeline

- **Total Duration:** 11 weeks
- **Start Date:** TBD
- **Target Completion:** TBD

---

## 22. Conclusion

This refactoring transforms the WordPress-specific healer into a universal, production-ready diagnostic and healing system. The plugin architecture ensures extensibility, while the three healing modes provide flexibility for different risk tolerances. The phased approach minimizes risk and maintains backward compatibility.

**Next Steps:**
1. Review and approve this plan
2. Allocate team resources
3. Set start date
4. Begin Phase 1 implementation

---

**Document Version:** 1.0  
**Last Updated:** February 26, 2026  
**Status:** Awaiting Approval
