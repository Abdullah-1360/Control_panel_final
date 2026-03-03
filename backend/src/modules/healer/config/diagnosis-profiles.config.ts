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
      // Layer 1: Availability & Accessibility
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.DNS_RESOLUTION,
      DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
      DiagnosisCheckType.MIXED_CONTENT_DETECTION,
      DiagnosisCheckType.RESPONSE_TIME_BASELINE,
      DiagnosisCheckType.MAINTENANCE_MODE,
      
      // Layer 2: Core WordPress Integrity
      DiagnosisCheckType.CORE_INTEGRITY,
      DiagnosisCheckType.CHECKSUM_VERIFICATION,
      DiagnosisCheckType.SECURITY_AUDIT,
      DiagnosisCheckType.WP_VERSION,
      
      // Layer 3: Configuration Validation
      DiagnosisCheckType.SECURITY_KEYS_VALIDATION,
      
      // Layer 4: Database Health
      DiagnosisCheckType.DATABASE_CONNECTION,
      DiagnosisCheckType.DATABASE_HEALTH,
      DiagnosisCheckType.TABLE_CORRUPTION_CHECK,
      DiagnosisCheckType.ORPHANED_TRANSIENTS_DETECTION,
      
      // Layer 5: Performance & Resource Monitoring
      DiagnosisCheckType.PERFORMANCE_METRICS,
      DiagnosisCheckType.RESOURCE_MONITORING,
      DiagnosisCheckType.UPTIME_MONITORING,
      
      // Layer 6: Plugin & Theme Analysis
      DiagnosisCheckType.PLUGIN_THEME_ANALYSIS, // Comprehensive analysis includes plugin/theme status
      DiagnosisCheckType.UPDATE_STATUS,
      
      // Layer 7: Error Log Analysis
      DiagnosisCheckType.ERROR_LOG_ANALYSIS,
      
      // Layer 8: Security Hardening
      DiagnosisCheckType.MALWARE_DETECTION,
      DiagnosisCheckType.LOGIN_ATTEMPT_ANALYSIS,
      DiagnosisCheckType.BACKDOOR_DETECTION,
      
      // Additional Health Checks
      DiagnosisCheckType.SEO_HEALTH,
      DiagnosisCheckType.BACKUP_STATUS,
    ],
    timeout: 300000, // 300 seconds (5 minutes) - increased for comprehensive checks
    logDepth: 1000,
    parallelExecution: true,
    useCache: false,
    cacheTTL: 0,
    description: 'Comprehensive diagnosis with 28+ checks across WordPress layers',
  },

  [DiagnosisProfile.LIGHT]: {
    profile: DiagnosisProfile.LIGHT,
    checks: [
      // Layer 1: Critical availability checks
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.DNS_RESOLUTION,
      DiagnosisCheckType.MAINTENANCE_MODE,
      DiagnosisCheckType.DATABASE_CONNECTION,
      
      // Layer 2: Core integrity
      DiagnosisCheckType.SECURITY_AUDIT,
      DiagnosisCheckType.CHECKSUM_VERIFICATION,
      
      // Layer 3: Configuration validation
      DiagnosisCheckType.SECURITY_KEYS_VALIDATION,
      
      // Layer 4: Database health
      DiagnosisCheckType.DATABASE_HEALTH,
      DiagnosisCheckType.TABLE_CORRUPTION_CHECK,
      
      // Layer 5: Performance
      DiagnosisCheckType.PERFORMANCE_METRICS,
      
      // Layer 6: Updates
      DiagnosisCheckType.UPDATE_STATUS,
      
      // Layer 7: Error logs
      DiagnosisCheckType.ERROR_LOG_ANALYSIS,
      
      // Layer 8: Security
      DiagnosisCheckType.MALWARE_DETECTION,
      DiagnosisCheckType.LOGIN_ATTEMPT_ANALYSIS,
      DiagnosisCheckType.BACKDOOR_DETECTION,
    ],
    timeout: 120000, // 120 seconds (increased for additional checks)
    logDepth: 100,
    parallelExecution: true,
    useCache: true,
    cacheTTL: 300, // 5 minutes
    description: 'Essential checks for scheduled auto-diagnosis with enhanced security validation',
  },

  [DiagnosisProfile.QUICK]: {
    profile: DiagnosisProfile.QUICK,
    checks: [
      DiagnosisCheckType.HTTP_STATUS,
      DiagnosisCheckType.MAINTENANCE_MODE,
      DiagnosisCheckType.DATABASE_CONNECTION,
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
