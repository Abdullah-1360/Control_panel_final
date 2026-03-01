# Stack-Aware Diagnosis and Healing - Implementation Complete

**Date:** February 27, 2026  
**Status:** ✅ COMPLETE

---

## Overview

Implemented stack-aware routing to ensure WordPress applications use the old WordPress healer while other tech stacks use the new Universal Healer system. This prevents cross-stack diagnosis and healing (e.g., WordPress checks on Node.js apps).

---

## Backend Implementation ✅

### Plugin-Based Diagnosis

**File:** `backend/src/modules/healer/services/application.service.ts`

The `diagnose()` method correctly uses the plugin registry to get the appropriate plugin based on tech stack:

```typescript
async diagnose(applicationId: string, subdomain?: string) {
  const application = await this.findOne(applicationId);
  
  // Get the correct plugin for this tech stack
  const plugin = this.pluginRegistry.getPlugin(application.techStack);
  
  if (!plugin) {
    throw new NotFoundException(
      `No plugin found for tech stack: ${application.techStack}`
    );
  }
  
  // Get diagnostic checks specific to this tech stack
  const checkNames = plugin.getDiagnosticChecks();
  
  // Execute each check using the plugin
  for (const checkName of checkNames) {
    const result = await plugin.executeDiagnosticCheck(
      checkName, 
      application, 
      server
    );
    // Store results...
  }
}
```

**Key Features:**
- ✅ Uses `pluginRegistry.getPlugin(techStack)` to get the correct plugin
- ✅ Each plugin has its own diagnostic checks (WordPress checks for WordPress, Laravel checks for Laravel, etc.)
- ✅ Throws error if no plugin found for tech stack
- ✅ Prevents cross-stack diagnosis

### Plugin Registry

**File:** `backend/src/modules/healer/services/plugin-registry.service.ts`

Manages all tech stack plugins:

```typescript
getPlugin(techStack: TechStack): IStackPlugin | null {
  return this.plugins.get(techStack) || null;
}
```

**Registered Plugins:**
- WordPress Plugin → `TechStack.WORDPRESS`
- Laravel Plugin → `TechStack.LARAVEL`
- Node.js Plugin → `TechStack.NODEJS`
- Express Plugin → `TechStack.EXPRESS`
- Next.js Plugin → `TechStack.NEXTJS`
- PHP Generic Plugin → `TechStack.PHP_GENERIC`
- MySQL Plugin → `TechStack.MYSQL`

---

## Frontend Implementation ✅

### Stack-Aware Routing

**Modified Files:**
1. `frontend/src/app/(dashboard)/healer/page.tsx`
2. `frontend/src/components/healer/ApplicationCard.tsx`
3. `frontend/src/components/healer/ApplicationList.tsx`

### Main Healer Page

**File:** `frontend/src/app/(dashboard)/healer/page.tsx`

```typescript
const handleDiagnose = (id: string, techStack: string) => {
  // Route WordPress applications to the old WordPress healer
  if (techStack === 'WORDPRESS') {
    router.push(`/healer/sites/${id}`);
  } else {
    router.push(`/healer/applications/${id}/diagnose`);
  }
};

const handleConfigure = (id: string, techStack: string) => {
  // Route WordPress applications to the old WordPress healer
  if (techStack === 'WORDPRESS') {
    router.push(`/healer/sites/${id}`);
  } else {
    router.push(`/healer/applications/${id}/configure`);
  }
};
```

### Application Card

**File:** `frontend/src/components/healer/ApplicationCard.tsx`

```typescript
const handleViewDetails = () => {
  if (application.techStack === 'WORDPRESS') {
    router.push(`/healer/sites/${application.id}`);
  } else {
    router.push(`/healer/${application.id}`);
  }
};

// Diagnose button
<Button onClick={() => onDiagnose(application.id, application.techStack)}>
  <Activity className="h-4 w-4" />
</Button>

// Configure button
<Button onClick={() => onConfigure(application.id, application.techStack)}>
  <Settings className="h-4 w-4" />
</Button>
```

### Application List

**File:** `frontend/src/components/healer/ApplicationList.tsx`

Updated prop types to accept techStack:

```typescript
interface ApplicationListProps {
  onDiagnose: (id: string, techStack: string) => void;
  onConfigure: (id: string, techStack: string) => void;
  // ...
}
```

---

## Routing Logic

### WordPress Applications
- **List View:** `/healer` (Universal Healer page)
- **Detail View:** `/healer/sites/${id}` (Old WordPress healer)
- **Diagnose:** `/healer/sites/${id}` (Old WordPress healer with diagnosis panel)
- **Configure:** `/healer/sites/${id}` (Old WordPress healer with config)
- **Backend API:** `/api/v1/healer/sites/${id}/*` (Old WordPress endpoints)

### Other Tech Stacks (Laravel, Node.js, Express, Next.js, PHP, MySQL)
- **List View:** `/healer` (Universal Healer page)
- **Detail View:** `/healer/${id}` (New Universal Healer detail view)
- **Diagnose:** `/healer/applications/${id}/diagnose` (New diagnosis view)
- **Configure:** `/healer/applications/${id}/configure` (New config view)
- **Backend API:** `/api/v1/healer/applications/${id}/*` (New Universal Healer endpoints)

---

## Benefits

### 1. Reuses Existing WordPress Healer ✅
- No need to rewrite WordPress-specific logic
- Maintains all existing WordPress features
- Preserves subdomain support
- Keeps wp-cli integration

### 2. Prevents Cross-Stack Issues ✅
- WordPress checks only run on WordPress apps
- Laravel checks only run on Laravel apps
- Node.js checks only run on Node.js apps
- No confusion or errors from wrong tech stack

### 3. Seamless User Experience ✅
- Users see all applications in one list
- WordPress apps automatically route to old healer
- Other apps use new Universal Healer
- Transparent to the user

### 4. Gradual Migration Path ✅
- WordPress healer remains fully functional
- New tech stacks use new system
- Can migrate WordPress to new system later if needed
- No breaking changes

---

## Tech Stack Detection

### Backend Detection

**File:** `backend/src/modules/healer/services/application.service.ts`

```typescript
// During discovery, tech stack is detected
const detectionResult = await plugin.detect(server, path);

if (detectionResult.detected) {
  // Create application with detected tech stack
  await this.prisma.applications.create({
    data: {
      techStack: detectionResult.techStack, // WORDPRESS, LARAVEL, etc.
      version: detectionResult.version,
      // ...
    }
  });
}
```

### Plugin Detection Methods

Each plugin implements its own detection logic:

**WordPress Plugin:**
```typescript
async detect(server: Server, path: string): Promise<DetectionResult> {
  // Check for wp-config.php
  // Check for wp-includes directory
  // Get WordPress version
  return {
    detected: true,
    techStack: 'WORDPRESS',
    version: '6.4.0',
    confidence: 0.95
  };
}
```

**Laravel Plugin:**
```typescript
async detect(server: Server, path: string): Promise<DetectionResult> {
  // Check for artisan file
  // Check composer.json for laravel/framework
  // Get Laravel version
  return {
    detected: true,
    techStack: 'LARAVEL',
    version: '10.0.0',
    confidence: 0.95
  };
}
```

---

## Diagnostic Checks by Tech Stack

### WordPress
- `wp_core_update` - Check for WordPress core updates
- `wp_plugin_updates` - Check for plugin updates
- `wp_theme_updates` - Check for theme updates
- `wp_database_check` - Check database integrity
- `wp_permissions` - Check file permissions
- `wp_debug_mode` - Check if debug mode is enabled
- `wp_plugin_conflicts` - Check for plugin conflicts

### Laravel
- `laravel_config_cache` - Check config cache status
- `laravel_route_cache` - Check route cache status
- `laravel_storage_permissions` - Check storage permissions
- `laravel_database_connection` - Check database connection
- `laravel_queue_worker` - Check queue worker status
- `composer_dependencies` - Check for outdated dependencies
- `laravel_env_file` - Check .env file validity
- `laravel_app_key` - Check APP_KEY is set

### Node.js / Express / Next.js
- `npm_audit` - Check for security vulnerabilities
- `node_version` - Check Node.js version compatibility
- `package_lock` - Check package-lock.json integrity
- `environment_variables` - Check required env vars
- `process_health` - Check if process is running
- `dependencies_outdated` - Check for outdated packages

### MySQL
- `mysql_connection` - Check database connection
- `mysql_status` - Check server status and uptime
- `mysql_slow_queries` - Analyze slow queries
- `mysql_table_integrity` - Check table integrity
- `mysql_replication_status` - Check replication status
- `mysql_buffer_pool` - Check buffer pool configuration
- `mysql_disk_usage` - Check disk usage
- `mysql_thread_count` - Check connection thread count

---

## Healing Actions by Tech Stack

### WordPress
- Clear cache
- Update plugins
- Update themes
- Update core
- Repair database
- Fix permissions
- Disable debug mode

### Laravel
- Clear all caches
- Run optimize commands
- Run migrations
- Restart queue workers
- Update dependencies
- Fix storage permissions
- Generate APP_KEY

### Node.js / Express / Next.js
- Install dependencies
- Fix security vulnerabilities
- Restart application
- Clear node_modules and reinstall
- Create .env from example
- Rebuild application

### MySQL
- Optimize tables
- Repair tables
- Restart MySQL service
- Flush privileges
- Enable slow query log
- Analyze tables
- Kill long-running queries

---

## Testing

### Backend Testing ✅
- Plugin registry correctly returns the right plugin for each tech stack
- Diagnosis uses the correct plugin based on application tech stack
- Each plugin has its own diagnostic checks
- Cross-stack diagnosis is prevented

### Frontend Testing ✅
- WordPress applications route to `/healer/sites/${id}`
- Other applications route to `/healer/applications/${id}`
- Tech stack is passed to all handlers
- Routing logic works correctly

---

## Summary

✅ **Backend:** Stack-aware diagnosis using plugin registry  
✅ **Frontend:** Stack-aware routing to old/new healers  
✅ **WordPress:** Reuses old WordPress healer completely  
✅ **Other Stacks:** Use new Universal Healer system  
✅ **Prevention:** Cross-stack diagnosis/healing prevented  
✅ **User Experience:** Seamless and transparent  
✅ **Migration:** Gradual path with no breaking changes

---

**Implementation Date:** February 27, 2026  
**Status:** Production-Ready  
**Breaking Changes:** None

