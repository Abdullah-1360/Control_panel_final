import {
  DiagnosisProfile,
  DiagnosisCheckType,
  DiagnosisProfileConfig,
} from '../enums/diagnosis-profile.enum';

/**
 * Predefined diagnosis profile configurations
 */
export const DIAGNOSIS_PROFILE_CONFIGS: Record<
  DiagnosisProfile,
  DiagnosisProfileConfig
> = {
  [DiagnosisProfile.FULL]: {
    profile: DiagnosisProfile.FULL,
    checks: [
      // Critical checks
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.MAINTENANCE_MODE,
      DiagnosisCheckType.DATABASE_CONNECTION,
      DiagnosisCheckType.WP_VERSION,
      // Standard checks
      DiagnosisCheckType.CORE_INTEGRITY,
      DiagnosisCheckType.PHP_ERRORS,
      DiagnosisCheckType.APACHE_NGINX_LOGS,
      DiagnosisCheckType.DISK_SPACE,
      DiagnosisCheckType.FILE_PERMISSIONS,
      DiagnosisCheckType.HTACCESS,
      DiagnosisCheckType.WP_CONFIG,
      DiagnosisCheckType.MEMORY_LIMIT,
      DiagnosisCheckType.SSL_CERTIFICATE,
      // Advanced checks
      DiagnosisCheckType.PLUGIN_STATUS,
      DiagnosisCheckType.THEME_STATUS,
      DiagnosisCheckType.UPDATE_STATUS,
    ],
    timeout: 120000, // 120 seconds
    logDepth: 500,
    parallelExecution: true,
    useCache: false,
    cacheTTL: 0,
    description: 'Complete diagnosis with all checks - for manual diagnosis',
  },

  [DiagnosisProfile.LIGHT]: {
    profile: DiagnosisProfile.LIGHT,
    checks: [
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.MAINTENANCE_MODE,
      DiagnosisCheckType.DATABASE_CONNECTION,
      DiagnosisCheckType.WP_VERSION,
      DiagnosisCheckType.PHP_ERRORS,
      DiagnosisCheckType.DISK_SPACE,
    ],
    timeout: 60000, // 60 seconds
    logDepth: 100,
    parallelExecution: true,
    useCache: true,
    cacheTTL: 300, // 5 minutes
    description: 'Critical checks only - for scheduled auto-diagnosis',
  },

  [DiagnosisProfile.QUICK]: {
    profile: DiagnosisProfile.QUICK,
    checks: [
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.MAINTENANCE_MODE,
    ],
    timeout: 30000, // 30 seconds
    logDepth: 0,
    parallelExecution: true,
    useCache: true,
    cacheTTL: 60, // 1 minute
    description: 'Minimal checks for fast feedback',
  },

  [DiagnosisProfile.CUSTOM]: {
    profile: DiagnosisProfile.CUSTOM,
    checks: [], // Will be populated by user selection
    timeout: 90000, // 90 seconds
    logDepth: 200,
    parallelExecution: true,
    useCache: false,
    cacheTTL: 0,
    description: 'User-defined check combinations',
  },
};

/**
 * Get profile configuration
 */
export function getProfileConfig(
  profile: DiagnosisProfile,
  customChecks?: DiagnosisCheckType[],
): DiagnosisProfileConfig {
  const config = { ...DIAGNOSIS_PROFILE_CONFIGS[profile] };

  // Override checks for CUSTOM profile
  if (profile === DiagnosisProfile.CUSTOM && customChecks) {
    config.checks = customChecks;
  }

  return config;
}

/**
 * Check if a specific check is enabled in a profile
 */
export function isCheckEnabled(
  profile: DiagnosisProfile,
  checkType: DiagnosisCheckType,
  customChecks?: DiagnosisCheckType[],
): boolean {
  const config = getProfileConfig(profile, customChecks);
  return config.checks.includes(checkType);
}
