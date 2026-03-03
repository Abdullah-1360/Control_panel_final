# WordPress Healer - API Documentation

**Version:** 1.0.0  
**Last Updated:** March 1, 2026  
**Base URL:** `http://localhost:3001/api/v1/healer`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Diagnosis Endpoints](#diagnosis-endpoints)
4. [Diagnosis Profiles](#diagnosis-profiles)
5. [Check Types](#check-types)
6. [Response Schemas](#response-schemas)
7. [Error Handling](#error-handling)
8. [Examples](#examples)

---

## Overview

The WordPress Healer API provides comprehensive diagnosis and healing capabilities for WordPress sites. The system performs 30+ diagnostic checks across 8 layers, correlates results to identify root causes, and provides actionable recommendations.

### Key Features

- **8-Layer Diagnosis System:** Comprehensive checks from availability to security
- **Intelligent Correlation:** Identifies root causes with confidence scores
- **Profile-Based Execution:** QUICK, LIGHT, FULL, and CUSTOM profiles
- **Parallel Execution:** 50% faster than sequential execution
- **Smart Caching:** 67-75% faster with cache hits
- **Comprehensive Error Handling:** Graceful degradation with detailed logging

---

## Authentication

All API endpoints require JWT authentication.

### Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Required Permissions

- `healer.diagnose` - Run diagnosis
- `healer.heal` - Execute healing
- `healer.read` - View diagnosis history

---

## Diagnosis Endpoints

### 1. Run Diagnosis

Executes a comprehensive diagnosis on a WordPress site.

**Endpoint:** `POST /sites/:siteId/diagnose`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| siteId | string (UUID) | Yes | WordPress site ID |
| profile | DiagnosisProfile | No | Diagnosis profile (default: STANDARD) |
| checks | DiagnosisCheckType[] | No | Custom check types (for CUSTOM profile) |
| skipCache | boolean | No | Skip cache and force fresh diagnosis |

**Request Body:**

```json
{
  "profile": "FULL",
  "skipCache": false
}
```

**Response:** `200 OK`

```json
{
  "id": "diag-uuid",
  "siteId": "site-uuid",
  "profile": "FULL",
  "status": "COMPLETED",
  "healthScore": 85,
  "healthStatus": "HEALTHY",
  "executionTime": 45000,
  "checksPerformed": 20,
  "issuesFound": 3,
  "criticalIssues": 0,
  "warningIssues": 3,
  "checks": [
    {
      "checkType": "CORE_INTEGRITY",
      "status": "PASS",
      "score": 100,
      "message": "WordPress core files are intact",
      "executionTime": 2500,
      "details": {
        "filesChecked": 1250,
        "modifiedFiles": 0,
        "missingFiles": 0
      },
      "recommendations": []
    }
  ],
  "correlation": {
    "rootCauses": [
      {
        "name": "Plugin Conflict",
        "symptoms": ["slow_page_load", "high_query_count"],
        "rootCause": "WooCommerce + Elementor conflict",
        "confidence": 85,
        "remediation": "Disable Elementor page builder on product pages"
      }
    ],
    "overallHealthScore": 85,
    "criticalIssues": [],
    "recommendations": [
      "Update 3 plugins with known vulnerabilities",
      "Enable object caching to reduce database load",
      "Optimize 5 database tables with overhead"
    ],
    "correlationConfidence": 90
  },
  "timestamp": "2026-03-01T10:00:00Z"
}
```

---

### 2. Get Diagnosis History

Retrieves diagnosis history for a site.

**Endpoint:** `GET /sites/:siteId/diagnosis-history`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Results per page (default: 50, max: 100) |
| profile | DiagnosisProfile | No | Filter by profile |
| startDate | ISO 8601 | No | Filter from date |
| endDate | ISO 8601 | No | Filter to date |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "diag-uuid",
      "profile": "FULL",
      "healthScore": 85,
      "healthStatus": "HEALTHY",
      "issuesFound": 3,
      "executionTime": 45000,
      "timestamp": "2026-03-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

---

### 3. Get Health Score History

Retrieves health score trends over time.

**Endpoint:** `GET /sites/:siteId/health-score-history`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| days | number | No | Number of days (default: 30, max: 365) |
| interval | string | No | Data interval: hourly, daily, weekly (default: daily) |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "timestamp": "2026-03-01T00:00:00Z",
      "healthScore": 85,
      "healthStatus": "HEALTHY",
      "issuesCount": 3,
      "criticalIssues": 0
    }
  ],
  "summary": {
    "averageScore": 87,
    "minScore": 75,
    "maxScore": 95,
    "trend": "improving"
  }
}
```

---

### 4. Clear Diagnosis Cache

Clears cached diagnosis results for a site.

**Endpoint:** `DELETE /sites/:siteId/diagnosis-cache`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| profile | DiagnosisProfile | No | Clear specific profile only |

**Response:** `200 OK`

```json
{
  "message": "Cache cleared successfully",
  "deletedCount": 10
}
```

---

### 5. Get Available Profiles

Lists all available diagnosis profiles with descriptions.

**Endpoint:** `GET /diagnosis-profiles`

**Response:** `200 OK`

```json
{
  "profiles": [
    {
      "name": "QUICK",
      "description": "Fast diagnosis with essential checks only",
      "checksCount": 5,
      "estimatedTime": "5-10 seconds",
      "checks": ["UPTIME", "CORE_INTEGRITY", "DATABASE_CONNECTION", "DISK_SPACE", "SECURITY_BASIC"]
    },
    {
      "name": "LIGHT",
      "description": "Balanced diagnosis with common issues",
      "checksCount": 9,
      "estimatedTime": "20-30 seconds",
      "checks": ["QUICK checks + PLUGIN_UPDATES", "THEME_UPDATES", "BACKUP_STATUS", "PERFORMANCE_BASIC"]
    },
    {
      "name": "FULL",
      "description": "Comprehensive diagnosis with all checks",
      "checksCount": 20,
      "estimatedTime": "45-90 seconds",
      "checks": ["All available checks across 8 layers"]
    },
    {
      "name": "CUSTOM",
      "description": "User-defined check selection",
      "checksCount": "Variable",
      "estimatedTime": "Variable",
      "checks": ["User-specified checks"]
    }
  ]
}
```

---

## Diagnosis Profiles

### QUICK Profile

**Purpose:** Fast health check for monitoring  
**Checks:** 5 essential checks  
**Execution Time:** 5-10 seconds  
**Use Case:** Automated monitoring, quick status check

**Checks Included:**
- Uptime Monitoring
- Core Integrity (basic)
- Database Connection
- Disk Space
- Security Audit (basic)

---

### LIGHT Profile

**Purpose:** Balanced diagnosis for regular maintenance  
**Checks:** 9 common checks  
**Execution Time:** 20-30 seconds  
**Use Case:** Daily/weekly maintenance, issue investigation

**Checks Included:**
- All QUICK checks
- Plugin Updates
- Theme Updates
- Backup Status
- Performance Metrics (basic)

---

### FULL Profile

**Purpose:** Comprehensive diagnosis for deep analysis  
**Checks:** 20+ checks across 8 layers  
**Execution Time:** 45-90 seconds (with caching: 20-30 seconds)  
**Use Case:** Monthly audits, pre-deployment, incident investigation

**Checks Included:**
- All LIGHT checks
- Malware Detection
- Security Hardening
- Performance Optimization
- Database Health (advanced)
- SEO Health
- Resource Monitoring
- Plugin/Theme Analysis (advanced)
- Error Log Analysis
- Backup Verification

---

### CUSTOM Profile

**Purpose:** User-defined check selection  
**Checks:** Variable (user-specified)  
**Execution Time:** Variable  
**Use Case:** Targeted diagnosis, specific issue investigation

**Example Request:**

```json
{
  "profile": "CUSTOM",
  "checks": [
    "MALWARE_DETECTION",
    "SECURITY_AUDIT",
    "ERROR_LOG_ANALYSIS"
  ]
}
```

---

## Check Types

### Layer 1: Availability & Accessibility

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| UPTIME_MONITORING | HTTP status, response time, SSL validity | 2-3s |

### Layer 2: Core WordPress Integrity

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| CORE_INTEGRITY | Core file checksums, malware signatures | 5-10s (cached: 1s) |
| SECURITY_AUDIT | File permissions, .htaccess validation | 3-5s |

### Layer 3: Configuration Validation

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| SECURITY_AUDIT | wp-config.php validation, security keys | 2-3s |

### Layer 4: Database Health

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| DATABASE_HEALTH | Connection, corruption, performance, transients | 5-8s |

### Layer 5: Performance & Resource Monitoring

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| PERFORMANCE_METRICS | PHP memory, query count, cache hit ratio | 3-5s |
| RESOURCE_MONITORING | Disk space, CPU, memory usage | 2-3s |

### Layer 6: Plugin & Theme Analysis

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| PLUGIN_THEME_ANALYSIS | Vulnerabilities, conflicts, abandoned plugins | 8-12s (cached: 2s) |
| UPDATE_STATUS | Available updates for core, plugins, themes | 3-5s |

### Layer 7: Error Log Analysis

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| ERROR_LOG_ANALYSIS | Error categorization, frequency, 404 patterns | 5-8s |

### Layer 8: Security Hardening

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| MALWARE_DETECTION | Login attempts, backdoors, content injection | 10-15s (cached: 2s) |
| SECURITY_AUDIT | User accounts, file changes, suspicious files | 5-8s |

### Additional Checks

| Check Type | Description | Execution Time |
|------------|-------------|----------------|
| SEO_HEALTH | SEO configuration, sitemap, robots.txt | 3-5s |
| BACKUP_STATUS | Backup existence, age, integrity | 2-3s |

---

## Response Schemas

### DiagnosisResult

```typescript
interface DiagnosisResult {
  id: string;                    // Diagnosis UUID
  siteId: string;                // WordPress site UUID
  profile: DiagnosisProfile;     // Profile used
  status: DiagnosisStatus;       // COMPLETED, FAILED, PARTIAL
  healthScore: number;           // 0-100
  healthStatus: HealthStatus;    // HEALTHY, DEGRADED, DOWN
  executionTime: number;         // Milliseconds
  checksPerformed: number;       // Number of checks executed
  issuesFound: number;           // Total issues
  criticalIssues: number;        // Critical issues count
  warningIssues: number;         // Warning issues count
  checks: CheckResult[];         // Individual check results
  correlation: CorrelationResult; // Root cause analysis
  timestamp: string;             // ISO 8601
}
```

### CheckResult

```typescript
interface CheckResult {
  checkType: DiagnosisCheckType; // Check identifier
  status: CheckStatus;           // PASS, FAIL, WARNING, ERROR
  score: number;                 // 0-100
  message: string;               // Human-readable summary
  executionTime: number;         // Milliseconds
  details: Record<string, any>;  // Check-specific details
  recommendations: string[];     // Actionable recommendations
}
```

### CorrelationResult

```typescript
interface CorrelationResult {
  rootCauses: CorrelationPattern[];  // Identified root causes
  overallHealthScore: number;        // Correlated health score
  criticalIssues: CheckResult[];     // Critical issues
  recommendations: string[];         // Prioritized recommendations
  correlationConfidence: number;     // 0-100 confidence score
}
```

### CorrelationPattern

```typescript
interface CorrelationPattern {
  name: string;              // Pattern name
  symptoms: string[];        // Observed symptoms
  rootCause: string;         // Identified root cause
  confidence: number;        // 0-100 confidence score
  remediation: string;       // Recommended fix
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "DiagnosisError",
  "message": "Failed to execute diagnosis",
  "statusCode": 500,
  "details": {
    "siteId": "site-uuid",
    "profile": "FULL",
    "failedChecks": ["MALWARE_DETECTION"],
    "reason": "SSH connection timeout"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (site not found) |
| 409 | Conflict (diagnosis already running) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (system overload) |

### Common Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| SITE_NOT_FOUND | Site ID not found | Verify site ID |
| DIAGNOSIS_IN_PROGRESS | Diagnosis already running | Wait for completion |
| SSH_CONNECTION_FAILED | Cannot connect to server | Check SSH credentials |
| INVALID_PROFILE | Invalid diagnosis profile | Use QUICK, LIGHT, FULL, or CUSTOM |
| TIMEOUT | Diagnosis timeout | Retry with LIGHT profile |
| INSUFFICIENT_PERMISSIONS | Missing required permissions | Request healer.diagnose permission |

---

## Examples

### Example 1: Quick Health Check

**Request:**

```bash
curl -X POST http://localhost:3001/api/v1/healer/sites/abc-123/diagnose \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"profile": "QUICK"}'
```

**Response:**

```json
{
  "id": "diag-001",
  "siteId": "abc-123",
  "profile": "QUICK",
  "status": "COMPLETED",
  "healthScore": 95,
  "healthStatus": "HEALTHY",
  "executionTime": 8500,
  "checksPerformed": 5,
  "issuesFound": 0,
  "criticalIssues": 0,
  "warningIssues": 0,
  "checks": [
    {
      "checkType": "UPTIME_MONITORING",
      "status": "PASS",
      "score": 100,
      "message": "Site is accessible and responding normally",
      "executionTime": 1500,
      "details": {
        "httpStatus": 200,
        "responseTime": 250,
        "sslValid": true
      },
      "recommendations": []
    }
  ],
  "correlation": {
    "rootCauses": [],
    "overallHealthScore": 95,
    "criticalIssues": [],
    "recommendations": [],
    "correlationConfidence": 100
  },
  "timestamp": "2026-03-01T10:00:00Z"
}
```

---

### Example 2: Full Diagnosis with Issues

**Request:**

```bash
curl -X POST http://localhost:3001/api/v1/healer/sites/abc-123/diagnose \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"profile": "FULL", "skipCache": false}'
```

**Response:**

```json
{
  "id": "diag-002",
  "siteId": "abc-123",
  "profile": "FULL",
  "status": "COMPLETED",
  "healthScore": 65,
  "healthStatus": "DEGRADED",
  "executionTime": 52000,
  "checksPerformed": 20,
  "issuesFound": 8,
  "criticalIssues": 2,
  "warningIssues": 6,
  "checks": [
    {
      "checkType": "MALWARE_DETECTION",
      "status": "FAIL",
      "score": 40,
      "message": "Security threats detected",
      "executionTime": 12500,
      "details": {
        "loginAnalysis": {
          "totalAttempts": 150,
          "failedAttempts": 120,
          "bruteForceDetected": true,
          "suspiciousIPs": ["192.168.1.100", "10.0.0.50"]
        },
        "executableUploads": {
          "phpFiles": ["/wp-content/uploads/2026/03/shell.php"],
          "executableFiles": []
        },
        "backdoorScan": {
          "count": 1,
          "backdoorFiles": ["/wp-content/themes/custom/functions.php"]
        }
      },
      "recommendations": [
        "CRITICAL: Brute force attack detected - implement rate limiting",
        "CRITICAL: 1 PHP file found in uploads directory - quarantine immediately",
        "CRITICAL: Potential backdoor detected - review and remove malicious code"
      ]
    },
    {
      "checkType": "PERFORMANCE_METRICS",
      "status": "WARNING",
      "score": 70,
      "message": "Performance issues detected",
      "executionTime": 4500,
      "details": {
        "phpMemory": {
          "current": 45,
          "peak": 58,
          "limit": 64,
          "percentage": 90.6
        },
        "queryCount": 125,
        "cacheHitRatio": 45
      },
      "recommendations": [
        "PHP memory usage at 90.6% - increase memory_limit",
        "High query count (125) - optimize database queries",
        "Low cache hit ratio (45%) - configure object caching"
      ]
    }
  ],
  "correlation": {
    "rootCauses": [
      {
        "name": "Security Compromise",
        "symptoms": ["brute_force_attack", "backdoor_detected", "php_in_uploads"],
        "rootCause": "Site has been compromised",
        "confidence": 95,
        "remediation": "Immediate action required: 1) Change all passwords, 2) Remove malicious files, 3) Restore from clean backup, 4) Implement security hardening"
      },
      {
        "name": "Performance Degradation",
        "symptoms": ["high_memory_usage", "high_query_count", "low_cache_ratio"],
        "rootCause": "Unoptimized database queries and missing object cache",
        "confidence": 85,
        "remediation": "Enable Redis object caching and optimize database queries"
      }
    ],
    "overallHealthScore": 65,
    "criticalIssues": [
      {
        "checkType": "MALWARE_DETECTION",
        "status": "FAIL",
        "score": 40,
        "message": "Security threats detected"
      }
    ],
    "recommendations": [
      "URGENT: Address security compromise immediately",
      "Enable object caching (Redis/Memcached)",
      "Increase PHP memory limit to 128M",
      "Optimize database queries",
      "Implement rate limiting for login attempts"
    ],
    "correlationConfidence": 90
  },
  "timestamp": "2026-03-01T10:05:00Z"
}
```

---

### Example 3: Custom Diagnosis

**Request:**

```bash
curl -X POST http://localhost:3001/api/v1/healer/sites/abc-123/diagnose \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "CUSTOM",
    "checks": [
      "MALWARE_DETECTION",
      "SECURITY_AUDIT",
      "ERROR_LOG_ANALYSIS"
    ]
  }'
```

**Response:**

```json
{
  "id": "diag-003",
  "siteId": "abc-123",
  "profile": "CUSTOM",
  "status": "COMPLETED",
  "healthScore": 80,
  "healthStatus": "HEALTHY",
  "executionTime": 25000,
  "checksPerformed": 3,
  "issuesFound": 2,
  "criticalIssues": 0,
  "warningIssues": 2,
  "checks": [
    {
      "checkType": "MALWARE_DETECTION",
      "status": "PASS",
      "score": 100,
      "message": "No security threats detected"
    },
    {
      "checkType": "SECURITY_AUDIT",
      "status": "WARNING",
      "score": 85,
      "message": "Minor security improvements recommended"
    },
    {
      "checkType": "ERROR_LOG_ANALYSIS",
      "status": "WARNING",
      "score": 75,
      "message": "Some errors detected in logs"
    }
  ],
  "correlation": {
    "rootCauses": [],
    "overallHealthScore": 80,
    "criticalIssues": [],
    "recommendations": [
      "Update security keys in wp-config.php",
      "Fix 5 PHP warnings in error log"
    ],
    "correlationConfidence": 85
  },
  "timestamp": "2026-03-01T10:10:00Z"
}
```

---

## Performance Considerations

### Caching Strategy

**Expensive Checks (Cached):**
- CORE_INTEGRITY: 24 hours TTL
- PLUGIN_THEME_ANALYSIS: 6 hours TTL
- MALWARE_DETECTION: 1 hour TTL

**Real-Time Checks (Not Cached):**
- UPTIME_MONITORING
- DATABASE_CONNECTION
- DISK_SPACE
- ERROR_LOG_ANALYSIS

### Execution Time Optimization

**Parallel Execution:**
- Independent checks run in parallel
- Database-dependent checks run sequentially
- 50% faster than sequential execution

**Cache Hit Performance:**
- FULL profile: 90s → 30s (67% faster)
- LIGHT profile: 45s → 15s (67% faster)

### Rate Limiting

- Max 10 diagnoses per site per hour
- Max 100 concurrent diagnoses system-wide
- Automatic queuing for excess requests

---

## Best Practices

### 1. Profile Selection

- Use QUICK for monitoring (every 5 minutes)
- Use LIGHT for daily maintenance
- Use FULL for weekly audits
- Use CUSTOM for targeted investigation

### 2. Caching

- Don't skip cache unless investigating active issues
- Clear cache after making changes to site
- Cache automatically expires based on check type

### 3. Error Handling

- Always check `status` field in response
- Handle partial results gracefully
- Retry failed diagnoses with LIGHT profile

### 4. Performance

- Schedule FULL diagnoses during low-traffic periods
- Use QUICK profile for frequent monitoring
- Leverage caching for repeated diagnoses

---

## Changelog

### Version 1.0.0 (March 1, 2026)
- Initial release
- 30+ diagnostic checks across 8 layers
- Intelligent correlation engine
- Profile-based execution
- Parallel execution optimization
- Smart caching implementation

---

**Documentation Status:** COMPLETE ✅  
**Last Updated:** March 1, 2026  
**Next Review:** April 1, 2026

