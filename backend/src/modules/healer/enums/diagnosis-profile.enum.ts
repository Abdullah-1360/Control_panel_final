/**
 * Diagnosis Profile Enum
 * Defines the depth and scope of diagnosis checks
 */
export enum DiagnosisProfile {
  /**
   * FULL - Manual diagnosis with all checks
   * - All checks enabled
   * - No caching
   * - Timeout: 120s
   * - Log depth: 500 lines
   */
  FULL = 'FULL',

  /**
   * LIGHT - Scheduled/auto diagnosis with critical checks only
   * - Critical checks only
   * - 5-minute cache
   * - Timeout: 60s
   * - Log depth: 100 lines
   */
  LIGHT = 'LIGHT',

  /**
   * QUICK - Fast feedback with minimal checks
   * - HTTP status and maintenance mode only
   * - 1-minute cache
   * - Timeout: 30s
   * - No log analysis
   */
  QUICK = 'QUICK',

  /**
   * CUSTOM - User-defined check combinations
   * - User selects specific checks
   * - No caching
   * - Configurable timeout
   * - Configurable log depth
   */
  CUSTOM = 'CUSTOM',
}

/**
 * Individual diagnosis check types
 */
export enum DiagnosisCheckType {
  // Critical checks (included in LIGHT profile)
  HTTP_STATUS = 'HTTP_STATUS',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  WP_VERSION = 'WP_VERSION',

  // Standard checks (included in FULL profile)
  CORE_INTEGRITY = 'CORE_INTEGRITY',
  PHP_ERRORS = 'PHP_ERRORS',
  APACHE_NGINX_LOGS = 'APACHE_NGINX_LOGS',
  DISK_SPACE = 'DISK_SPACE',
  FILE_PERMISSIONS = 'FILE_PERMISSIONS',
  HTACCESS = 'HTACCESS',
  WP_CONFIG = 'WP_CONFIG',
  MEMORY_LIMIT = 'MEMORY_LIMIT',
  SSL_CERTIFICATE = 'SSL_CERTIFICATE',

  // Advanced checks (optional)
  PLUGIN_STATUS = 'PLUGIN_STATUS',
  THEME_STATUS = 'THEME_STATUS',
  MALWARE_SCAN = 'MALWARE_SCAN',
  PERFORMANCE_METRICS = 'PERFORMANCE_METRICS',
  SECURITY_AUDIT = 'SECURITY_AUDIT',
  SEO_HEALTH = 'SEO_HEALTH',
  BACKUP_STATUS = 'BACKUP_STATUS',
  UPDATE_STATUS = 'UPDATE_STATUS',
  RESOURCE_USAGE = 'RESOURCE_USAGE',
  
  // Phase 2: Enhanced check types
  MALWARE_DETECTION = 'MALWARE_DETECTION',
  DATABASE_HEALTH = 'DATABASE_HEALTH',
  RESOURCE_MONITORING = 'RESOURCE_MONITORING',
  PLUGIN_THEME_ANALYSIS = 'PLUGIN_THEME_ANALYSIS',
  UPTIME_MONITORING = 'UPTIME_MONITORING',
  LOG_ANALYSIS = 'LOG_ANALYSIS',
}

/**
 * Diagnosis check configuration
 */
export interface DiagnosisCheckConfig {
  type: DiagnosisCheckType;
  enabled: boolean;
  timeout?: number;
  priority?: number; // Lower number = higher priority
}

/**
 * Diagnosis profile configuration
 */
export interface DiagnosisProfileConfig {
  profile: DiagnosisProfile;
  checks: DiagnosisCheckType[];
  timeout: number;
  logDepth: number;
  parallelExecution: boolean;
  useCache: boolean;
  cacheTTL: number; // seconds
  description: string;
}
