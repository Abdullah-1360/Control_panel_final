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
  
  // Phase 3: Advanced analysis check types
  ERROR_LOG_ANALYSIS = 'ERROR_LOG_ANALYSIS', // Layer 7: Error log analysis with categorization, frequency, 404 patterns
  
  // Layer 1: Availability & Accessibility (missing checks)
  DNS_RESOLUTION = 'DNS_RESOLUTION',
  SSL_CERTIFICATE_VALIDATION = 'SSL_CERTIFICATE_VALIDATION',
  MIXED_CONTENT_DETECTION = 'MIXED_CONTENT_DETECTION',
  RESPONSE_TIME_BASELINE = 'RESPONSE_TIME_BASELINE',
  
  // Layer 2: Core WordPress Integrity (missing checks)
  CHECKSUM_VERIFICATION = 'CHECKSUM_VERIFICATION',
  HTACCESS_SECURITY_VALIDATION = 'HTACCESS_SECURITY_VALIDATION',
  MALWARE_SIGNATURE_SCANNING = 'MALWARE_SIGNATURE_SCANNING',
  
  // Layer 3: Configuration Validation (missing checks)
  SECURITY_KEYS_VALIDATION = 'SECURITY_KEYS_VALIDATION',
  ABSOLUTE_PATH_VERIFICATION = 'ABSOLUTE_PATH_VERIFICATION',
  CRON_CONFIGURATION_VALIDATION = 'CRON_CONFIGURATION_VALIDATION',
  FILE_EDITING_PERMISSIONS = 'FILE_EDITING_PERMISSIONS',
  
  // Layer 4: Database Health (missing checks)
  TABLE_CORRUPTION_CHECK = 'TABLE_CORRUPTION_CHECK',
  QUERY_PERFORMANCE_ANALYSIS = 'QUERY_PERFORMANCE_ANALYSIS',
  ORPHANED_TRANSIENTS_DETECTION = 'ORPHANED_TRANSIENTS_DETECTION',
  AUTO_INCREMENT_CAPACITY_CHECK = 'AUTO_INCREMENT_CAPACITY_CHECK',
  DATABASE_GROWTH_TRACKING = 'DATABASE_GROWTH_TRACKING',
  
  // Layer 5: Performance & Resource Monitoring (missing checks)
  PHP_MEMORY_USAGE_TRACKING = 'PHP_MEMORY_USAGE_TRACKING',
  MYSQL_QUERY_COUNT_MONITORING = 'MYSQL_QUERY_COUNT_MONITORING',
  OBJECT_CACHE_HIT_RATIO = 'OBJECT_CACHE_HIT_RATIO',
  EXTERNAL_HTTP_REQUEST_MONITORING = 'EXTERNAL_HTTP_REQUEST_MONITORING',
  CORE_WEB_VITALS_SIMULATION = 'CORE_WEB_VITALS_SIMULATION',
  
  // Layer 6: Plugin & Theme Analysis (missing checks)
  VULNERABILITY_DATABASE_INTEGRATION = 'VULNERABILITY_DATABASE_INTEGRATION',
  ABANDONED_PLUGIN_DETECTION = 'ABANDONED_PLUGIN_DETECTION',
  PLUGIN_CONFLICT_DETECTION = 'PLUGIN_CONFLICT_DETECTION',
  VERSION_CURRENCY_CHECKING = 'VERSION_CURRENCY_CHECKING',
  
  // Layer 7: Error Log Analysis (missing checks)
  ERROR_CATEGORIZATION = 'ERROR_CATEGORIZATION',
  ERROR_FREQUENCY_ANALYSIS = 'ERROR_FREQUENCY_ANALYSIS',
  ERROR_404_PATTERN_DETECTION = 'ERROR_404_PATTERN_DETECTION',
  ERROR_CORRELATION_BY_SOURCE = 'ERROR_CORRELATION_BY_SOURCE',
  
  // Layer 8: Security Hardening (missing checks)
  FILE_CHANGE_DETECTION = 'FILE_CHANGE_DETECTION',
  USER_ACCOUNT_AUDIT = 'USER_ACCOUNT_AUDIT',
  SUSPICIOUS_FILE_SCANNING = 'SUSPICIOUS_FILE_SCANNING',
  LOGIN_ATTEMPT_ANALYSIS = 'LOGIN_ATTEMPT_ANALYSIS',
  EXECUTABLE_UPLOAD_DETECTION = 'EXECUTABLE_UPLOAD_DETECTION',
  BACKDOOR_DETECTION = 'BACKDOOR_DETECTION',
  CONTENT_INJECTION_DETECTION = 'CONTENT_INJECTION_DETECTION'
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
