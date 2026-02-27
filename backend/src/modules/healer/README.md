# Healer Module - API Documentation

## Overview

The Healer module provides automated diagnostic and healing capabilities for web applications. Currently supports WordPress with plans to expand to multiple tech stacks.

**Current Status:** Dual System Architecture (Phase 2.5)
- **WordPress Healer:** Operational (v1.0)
- **Universal Healer:** Preview (v0.1)

---

## System Health

### GET /api/v1/healer/health

Get healer system health and migration status.

**Status:** ✅ Operational

**Response:**
```json
{
  "data": {
    "wordpress": {
      "status": "operational",
      "version": "1.0",
      "description": "WordPress healer fully functional",
      "endpoints": ["/api/v1/healer/sites", "/api/v1/healer/discover"]
    },
    "universal": {
      "status": "preview",
      "version": "0.1",
      "description": "Universal healer in development (Phase 3)",
      "endpoints": ["/api/v1/healer/applications"],
      "supportedTechStacks": ["WORDPRESS"],
      "plannedTechStacks": ["NODEJS", "PHP_GENERIC", "LARAVEL", "NEXTJS", "EXPRESS"]
    },
    "migration": {
      "phase": "2.5",
      "status": "stabilization",
      "nextPhase": "3",
      "nextPhaseEta": "4-6 weeks",
      "description": "Gradual migration strategy in progress"
    },
    "timestamp": "2026-02-26T10:00:00.000Z"
  }
}
```

---

## WordPress Healer Endpoints (Operational)

### POST /api/v1/healer/discover

Discover WordPress sites on a server.

**Status:** ✅ Operational  
**Permissions:** `healer.discover`

**Request Body:**
```json
{
  "serverId": "uuid"
}
```

**Response:**
```json
{
  "data": {
    "discovered": 5,
    "sites": [
      {
        "id": "uuid",
        "domain": "example.com",
        "path": "/var/www/html",
        "wpVersion": "6.4.2",
        "phpVersion": "8.1",
        "healthStatus": "HEALTHY"
      }
    ]
  }
}
```

---

### GET /api/v1/healer/sites

List all WordPress sites with filtering.

**Status:** ✅ Operational  
**Permissions:** `healer.read`

**Query Parameters:**
- `serverId` (optional): Filter by server ID
- `healthStatus` (optional): Filter by health status (HEALTHY, DEGRADED, DOWN, MAINTENANCE, HEALING, UNKNOWN)
- `isHealerEnabled` (optional): Filter by healer enabled status (true/false)
- `search` (optional): Search by domain
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "serverId": "uuid",
      "domain": "example.com",
      "path": "/var/www/html",
      "wpVersion": "6.4.2",
      "phpVersion": "8.1",
      "healthStatus": "HEALTHY",
      "healthScore": 95,
      "isHealerEnabled": true,
      "healingMode": "SUPERVISED",
      "lastHealthCheck": "2026-02-26T10:00:00.000Z",
      "createdAt": "2026-02-20T10:00:00.000Z",
      "updatedAt": "2026-02-26T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2
  }
}
```

---

### GET /api/v1/healer/sites/:id

Get WordPress site details.

**Status:** ✅ Operational  
**Permissions:** `healer.read`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "serverId": "uuid",
    "domain": "example.com",
    "path": "/var/www/html",
    "wpVersion": "6.4.2",
    "phpVersion": "8.1",
    "dbName": "wp_database",
    "dbHost": "localhost",
    "healthStatus": "HEALTHY",
    "healthScore": 95,
    "isHealerEnabled": true,
    "healingMode": "SUPERVISED",
    "maxHealingAttempts": 3,
    "currentHealingAttempts": 0,
    "lastHealthCheck": "2026-02-26T10:00:00.000Z",
    "lastHealingAttempt": null,
    "createdAt": "2026-02-20T10:00:00.000Z",
    "updatedAt": "2026-02-26T10:00:00.000Z",
    "server": {
      "id": "uuid",
      "name": "Production Server",
      "host": "192.168.1.100"
    }
  }
}
```

---

### POST /api/v1/healer/sites/:id/diagnose

Trigger diagnosis for a WordPress site.

**Status:** ✅ Operational  
**Permissions:** `healer.diagnose`

**Request Body (optional):**
```json
{
  "subdomain": "blog.example.com"
}
```

**Response:**
```json
{
  "data": {
    "executionId": "uuid",
    "siteId": "uuid",
    "status": "COMPLETED",
    "diagnosticResults": [
      {
        "checkName": "wp_core_update",
        "category": "DEPENDENCIES",
        "status": "PASS",
        "severity": "LOW",
        "message": "WordPress core is up to date",
        "executionTime": 150
      },
      {
        "checkName": "wp_plugin_updates",
        "category": "DEPENDENCIES",
        "status": "WARN",
        "severity": "MEDIUM",
        "message": "3 plugin updates available",
        "suggestedFix": "Update plugins via WP-CLI or admin panel",
        "executionTime": 200
      }
    ],
    "healthScore": 85,
    "healthStatus": "DEGRADED",
    "executionTime": 5000,
    "createdAt": "2026-02-26T10:00:00.000Z"
  }
}
```

---

### POST /api/v1/healer/sites/:id/heal

Execute healing for a WordPress site.

**Status:** ✅ Operational  
**Permissions:** `healer.heal`

**Request Body:**
```json
{
  "executionId": "uuid",
  "customCommands": [
    "wp plugin update --all",
    "wp cache flush"
  ]
}
```

**Response:**
```json
{
  "data": {
    "executionId": "uuid",
    "siteId": "uuid",
    "status": "SUCCESS",
    "actionsExecuted": 5,
    "issuesFixed": 3,
    "backupCreated": true,
    "backupPath": "/backups/site_uuid_20260226.tar.gz",
    "executionTime": 15000,
    "logs": [
      {
        "timestamp": "2026-02-26T10:00:00.000Z",
        "level": "INFO",
        "message": "Starting healing process"
      },
      {
        "timestamp": "2026-02-26T10:00:05.000Z",
        "level": "SUCCESS",
        "message": "Updated 3 plugins successfully"
      }
    ],
    "createdAt": "2026-02-26T10:00:00.000Z",
    "completedAt": "2026-02-26T10:00:15.000Z"
  }
}
```

---

### POST /api/v1/healer/sites/:id/rollback/:executionId

Rollback to backup after healing.

**Status:** ✅ Operational  
**Permissions:** `healer.rollback`

**Response:**
```json
{
  "data": {
    "message": "Rollback completed successfully",
    "executionId": "uuid"
  }
}
```

---

### PATCH /api/v1/healer/sites/:id/config

Update WordPress site healer configuration.

**Status:** ✅ Operational  
**Permissions:** `healer.configure`

**Request Body:**
```json
{
  "isHealerEnabled": true,
  "healingMode": "SUPERVISED",
  "maxHealingAttempts": 3,
  "healingCooldown": 3600
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "isHealerEnabled": true,
    "healingMode": "SUPERVISED",
    "maxHealingAttempts": 3,
    "healingCooldown": 3600,
    "updatedAt": "2026-02-26T10:00:00.000Z"
  }
}
```

---

### GET /api/v1/healer/sites/:id/executions

Get healing history for a WordPress site.

**Status:** ✅ Operational  
**Permissions:** `healer.read`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "siteId": "uuid",
      "status": "SUCCESS",
      "actionsExecuted": 5,
      "issuesFixed": 3,
      "executionTime": 15000,
      "createdAt": "2026-02-26T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

## Universal Healer Endpoints (Preview)

### GET /api/v1/healer/applications

List all applications (multi-tech-stack).

**Status:** 🟡 Preview (CRUD only, no discovery/diagnosis)  
**Permissions:** `healer.read`

**Query Parameters:**
- `serverId` (optional): Filter by server ID
- `techStack` (optional): Filter by tech stack (WORDPRESS, NODEJS, PHP_GENERIC, LARAVEL, NEXTJS, EXPRESS)
- `healthStatus` (optional): Filter by health status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "serverId": "uuid",
      "domain": "example.com",
      "path": "/var/www/html",
      "techStack": "WORDPRESS",
      "techStackVersion": "6.4.2",
      "detectionMethod": "AUTO",
      "detectionConfidence": 0.95,
      "healthStatus": "HEALTHY",
      "healthScore": 95,
      "isHealerEnabled": true,
      "healingMode": "SUPERVISED",
      "metadata": {
        "phpVersion": "8.1",
        "dbName": "wp_database"
      },
      "createdAt": "2026-02-20T10:00:00.000Z",
      "updatedAt": "2026-02-26T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2
  }
}
```

---

### POST /api/v1/healer/applications/:id/diagnose

Trigger diagnosis for an application.

**Status:** 🟡 Preview (Not implemented, awaiting Phase 3 plugins)  
**Permissions:** `healer.diagnose`

**Note:** Currently returns empty results. Full implementation coming in Phase 3.

---

## Metrics & Monitoring Endpoints

### GET /api/v1/healer/metrics/:periodType

Get metrics for dashboard.

**Status:** ✅ Operational  
**Permissions:** `healer.metrics.read`

**Path Parameters:**
- `periodType`: HOURLY, DAILY, WEEKLY, MONTHLY

**Query Parameters:**
- `limit` (optional): Number of periods to return (default: 24)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "periodType": "HOURLY",
      "periodStart": "2026-02-26T10:00:00.000Z",
      "periodEnd": "2026-02-26T11:00:00.000Z",
      "totalSites": 100,
      "healthySites": 85,
      "degradedSites": 10,
      "downSites": 5,
      "diagnosticsRun": 50,
      "healingAttempts": 15,
      "successfulHeals": 12,
      "failedHeals": 3,
      "avgHealthScore": 87.5,
      "avgExecutionTime": 5000,
      "createdAt": "2026-02-26T11:00:00.000Z"
    }
  ]
}
```

---

### GET /api/v1/healer/alerts

Get active alerts.

**Status:** ✅ Operational  
**Permissions:** `healer.alerts.read`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "alertType": "HEALTH_DEGRADED",
      "severity": "MEDIUM",
      "message": "Site health degraded: example.com",
      "siteId": "uuid",
      "isAcknowledged": false,
      "isResolved": false,
      "createdAt": "2026-02-26T10:00:00.000Z"
    }
  ]
}
```

---

## Healing Modes

### MANUAL
- **Description:** Always require manual approval before healing
- **Auto-heal:** Never
- **Use case:** Production environments, critical sites

### SUPERVISED
- **Description:** Auto-heal LOW risk issues, require approval for MEDIUM/HIGH
- **Auto-heal:** LOW risk only
- **Use case:** Staging environments, monitored sites

### AUTO (Full Auto)
- **Description:** Auto-heal LOW and MEDIUM risk, require approval for HIGH only
- **Auto-heal:** LOW and MEDIUM risk
- **Use case:** Development environments, non-critical sites

---

## Health Status

- **HEALTHY:** Health score 90-100, all checks passing
- **DEGRADED:** Health score 70-89, some warnings
- **DOWN:** Health score 0-69, critical issues
- **MAINTENANCE:** Site in maintenance mode
- **HEALING:** Healing in progress
- **UNKNOWN:** Not yet diagnosed

---

## Risk Levels

- **LOW:** Safe to auto-heal (e.g., clear cache, restart service)
- **MEDIUM:** Requires caution (e.g., update plugins, fix permissions)
- **HIGH:** Requires manual approval (e.g., database repair, core updates)
- **CRITICAL:** Never auto-heal (e.g., data migration, major version upgrades)

---

## Circuit Breaker

The healer includes a circuit breaker to prevent infinite healing loops:

- **Max Attempts:** Configurable per site (default: 3)
- **Cooldown Period:** Configurable per site (default: 3600 seconds)
- **Behavior:** After max attempts, healing is disabled until cooldown expires
- **Reset:** Manual reset via POST /api/v1/healer/sites/:id/reset-circuit-breaker

---

## Migration Timeline

| Phase | Duration | Status | Description |
|-------|----------|--------|-------------|
| 2.5 | 1 week | 🟡 In Progress | Stabilization and documentation |
| 3 | 6 weeks | ⏳ Planned | Plugin implementation (WordPress, Node.js, PHP, Laravel, Next.js, Express) |
| 4 | 3 weeks | ⏳ Planned | Deprecation and cleanup |

**Total Timeline:** 10 weeks (Feb 26 - May 6, 2026)

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Site or resource not found |
| 409 | Conflict | Circuit breaker tripped or healing in progress |
| 500 | Internal Server Error | Server error during operation |

---

## Rate Limiting

- **Discovery:** 10 requests per hour per server
- **Diagnosis:** 60 requests per hour per site
- **Healing:** 30 requests per hour per site
- **Metrics:** 120 requests per hour

---

## Changelog

### v1.0 (February 26, 2026)
- ✅ WordPress healer fully operational
- ✅ Discovery, diagnosis, healing, rollback
- ✅ Circuit breaker implementation
- ✅ Metrics and monitoring
- ✅ Audit logging
- ✅ Health check endpoint

### v0.1 (February 26, 2026)
- ✅ Universal healer framework (CRUD only)
- ✅ Multi-tech-stack database schema
- ✅ Frontend components
- ⏳ Plugin system (Phase 3)
- ⏳ Tech stack detection (Phase 3)
- ⏳ Universal diagnosis (Phase 3)

---

## Support

For questions or issues:
- Review this documentation
- Check `GRADUAL_MIGRATION_STRATEGY.md` for migration details
- Check `UNIVERSAL_HEALER_REFACTORING_PLAN.md` for technical architecture
- Test health endpoint: GET /api/v1/healer/health

---

**Last Updated:** February 26, 2026  
**Version:** 1.0 (WordPress) / 0.1 (Universal)  
**Status:** Operational (WordPress) / Preview (Universal)
