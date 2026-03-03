import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus } from '../interfaces/diagnosis-check.interface';

/**
 * Correlation Pattern Interface
 * Represents a detected pattern with root cause and confidence
 */
export interface CorrelationPattern {
  name: string;
  symptoms: string[];
  rootCause: string;
  confidence: number; // 0-100
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  remediation: string;
  affectedChecks: string[];
}

/**
 * Correlation Result Interface
 * Complete analysis result with root causes and recommendations
 */
export interface CorrelationResult {
  rootCauses: CorrelationPattern[];
  overallHealthScore: number;
  criticalIssues: CheckResult[];
  recommendations: string[];
  correlationConfidence: number; // Overall confidence in the analysis
}

/**
 * Correlation Engine Service
 * Analyzes diagnostic results to identify root causes with confidence scores
 * 
 * PHASE 2 - Transforms raw data into actionable intelligence
 */
@Injectable()
export class CorrelationEngineService {
  private readonly logger = new Logger(CorrelationEngineService.name);

  /**
   * Master correlation method
   * Analyzes all diagnostic results and identifies root causes
   */
  async correlateResults(results: CheckResult[]): Promise<CorrelationResult> {
    this.logger.log(`Starting correlation analysis on ${results.length} check results`);

    const rootCauses: CorrelationPattern[] = [];
    const criticalIssues: CheckResult[] = [];
    const recommendations: string[] = [];

    // Filter critical and failed checks
    const failedChecks = results.filter(
      r => r.status === CheckStatus.FAIL || r.status === CheckStatus.ERROR
    );
    const warningChecks = results.filter(r => r.status === CheckStatus.WARNING);

    criticalIssues.push(...failedChecks);

    // Run all correlation patterns
    const patterns = await Promise.all([
      this.analyzeDatabaseConnectionFailure(results),
      this.analyzeWSOD(results),
      this.analyzePerformanceDegradation(results),
      this.calculateCompromiseScore(results),
      this.analyzeConfigurationIssues(results),
      this.analyzeDiskSpaceIssues(results),
    ]);

    // Filter out null patterns and add to root causes
    rootCauses.push(...patterns.filter(p => p !== null) as CorrelationPattern[]);

    // Sort by confidence (highest first)
    rootCauses.sort((a, b) => b.confidence - a.confidence);

    // Calculate overall health score
    const overallHealthScore = this.calculateOverallHealthScore(results);

    // Generate prioritized recommendations
    recommendations.push(...this.generateRecommendations(rootCauses, results));

    // Calculate overall correlation confidence
    const correlationConfidence = rootCauses.length > 0
      ? rootCauses.reduce((sum, rc) => sum + rc.confidence, 0) / rootCauses.length
      : 0;

    this.logger.log(
      `Correlation complete: ${rootCauses.length} root causes identified, ` +
      `overall health: ${overallHealthScore}, confidence: ${correlationConfidence.toFixed(1)}%`
    );

    return {
      rootCauses,
      overallHealthScore,
      criticalIssues,
      recommendations,
      correlationConfidence,
    };
  }

  /**
   * Pattern 1: Database Connection Error Cascade
   * Analyzes database connection failures and identifies root cause
   */
  private async analyzeDatabaseConnectionFailure(
    results: CheckResult[]
  ): Promise<CorrelationPattern | null> {
    const dbCheck = results.find(r => r.checkType.toString().includes('DATABASE'));
    
    if (!dbCheck || dbCheck.status !== CheckStatus.FAIL) {
      return null;
    }

    const symptoms: string[] = ['Database connection failed'];
    const affectedChecks: string[] = [dbCheck.checkType.toString()];
    let rootCause = 'Database connection failure';
    let confidence = 70;
    let remediation = 'Check database credentials and server status';

    // Check if MySQL service is running (from details)
    const details = dbCheck.details as any;
    
    if (details?.connectionTest?.message?.includes('denied')) {
      rootCause = 'Database credentials invalid or access denied';
      confidence = 90;
      remediation = 'Verify DB_USER and DB_PASSWORD in wp-config.php';
      symptoms.push('Access denied error');
    } else if (details?.connectionTest?.message?.includes('unknown database')) {
      rootCause = 'Database does not exist';
      confidence = 95;
      remediation = 'Create database or update DB_NAME in wp-config.php';
      symptoms.push('Unknown database error');
    } else if (details?.connectionTest?.message?.includes('too many connections')) {
      rootCause = 'Database max_connections limit reached';
      confidence = 85;
      remediation = 'Increase max_connections in MySQL config or optimize connection usage';
      symptoms.push('Too many connections');
    } else if (details?.connectionTest?.message?.includes('timeout')) {
      rootCause = 'Database server not responding (timeout)';
      confidence = 80;
      remediation = 'Check database server status and network connectivity';
      symptoms.push('Connection timeout');
    }

    // Check for related issues
    const diskCheck = results.find(r => r.checkType.toString().includes('DISK'));
    if (diskCheck && diskCheck.status === CheckStatus.FAIL) {
      rootCause = 'Disk full caused database crash';
      confidence = 95;
      remediation = 'Free up disk space immediately, then restart database';
      symptoms.push('Disk space critical');
      affectedChecks.push(diskCheck.checkType.toString());
    }

    return {
      name: 'Database Connection Failure',
      symptoms,
      rootCause,
      confidence,
      severity: 'CRITICAL',
      remediation,
      affectedChecks,
    };
  }

  /**
   * Pattern 2: WSOD (White Screen of Death) Cascade
   * Analyzes white screen errors and identifies root cause
   */
  private async analyzeWSOD(results: CheckResult[]): Promise<CorrelationPattern | null> {
    // Check for HTTP 500 or empty response
    const httpCheck = results.find(r => r.message?.includes('HTTP') || r.message?.includes('status'));
    
    if (!httpCheck || (!httpCheck.message?.includes('500') && !httpCheck.message?.includes('blank'))) {
      return null;
    }

    const symptoms: string[] = ['White screen or HTTP 500 error'];
    const affectedChecks: string[] = [];
    let rootCause = 'Unknown PHP error causing WSOD';
    let confidence = 60;
    let remediation = 'Enable WP_DEBUG and check error logs';

    // Check PHP error logs
    const errorLogCheck = results.find(r => 
      r.details && typeof r.details === 'object' && 'phpErrors' in r.details
    );

    if (errorLogCheck) {
      const details = errorLogCheck.details as any;
      
      if (details.phpErrors?.hasErrors) {
        affectedChecks.push(errorLogCheck.checkType.toString());
        
        // Check for memory exhaustion
        if (details.phpErrors.errors?.some((e: string) => e.includes('memory') || e.includes('exhausted'))) {
          rootCause = 'PHP memory limit exhausted';
          confidence = 95;
          remediation = 'Increase PHP memory_limit to 256M or higher';
          symptoms.push('Memory exhausted error in logs');
        }
        // Check for fatal errors
        else if (details.phpErrors.errors?.some((e: string) => e.includes('Fatal error'))) {
          const fatalError = details.phpErrors.errors.find((e: string) => e.includes('Fatal error'));
          
          if (fatalError?.includes('undefined function')) {
            rootCause = 'Missing plugin/theme file or PHP extension';
            confidence = 90;
            remediation = 'Reinstall the plugin/theme or enable required PHP extension';
            symptoms.push('Undefined function error');
          } else if (fatalError?.includes('Cannot redeclare')) {
            rootCause = 'Plugin/theme conflict (duplicate function)';
            confidence = 85;
            remediation = 'Deactivate recently activated plugins one by one';
            symptoms.push('Function redeclaration error');
          } else {
            rootCause = 'PHP fatal error in plugin or theme';
            confidence = 80;
            remediation = 'Check error logs for specific file and line number';
            symptoms.push('Fatal error in logs');
          }
        }
        // Check for parse errors
        else if (details.phpErrors.errors?.some((e: string) => e.includes('Parse error'))) {
          rootCause = 'PHP syntax error in code';
          confidence = 95;
          remediation = 'Fix syntax error in the file mentioned in error log';
          symptoms.push('Parse error in logs');
        }
      }
    }

    // Check memory limit
    const memoryCheck = results.find(r => r.checkType.toString().includes('MEMORY'));
    if (memoryCheck && memoryCheck.status === CheckStatus.FAIL) {
      if (rootCause === 'Unknown PHP error causing WSOD') {
        rootCause = 'PHP memory limit too low';
        confidence = 85;
        remediation = 'Increase memory_limit in php.ini or wp-config.php';
      }
      symptoms.push('Low memory limit');
      affectedChecks.push(memoryCheck.checkType.toString());
    }

    return {
      name: 'White Screen of Death (WSOD)',
      symptoms,
      rootCause,
      confidence,
      severity: 'CRITICAL',
      remediation,
      affectedChecks,
    };
  }

  /**
   * Pattern 3: Performance Degradation Cascade
   * Analyzes performance issues and identifies root cause
   */
  private async analyzePerformanceDegradation(
    results: CheckResult[]
  ): Promise<CorrelationPattern | null> {
    const symptoms: string[] = [];
    const affectedChecks: string[] = [];
    let hasPerformanceIssue = false;
    let rootCause = 'Performance degradation detected';
    let confidence = 60;
    let remediation = 'Optimize database and enable caching';

    // Check for slow page load (would need HTTP response time check)
    // For now, we'll infer from other checks

    // Check database health
    const dbHealthCheck = results.find(r => r.checkType.toString().includes('DATABASE'));
    if (dbHealthCheck && dbHealthCheck.details) {
      const details = dbHealthCheck.details as any;
      
      // Check for slow queries
      if (details.queryPerformance?.slowQueriesCount > 100) {
        hasPerformanceIssue = true;
        symptoms.push(`${details.queryPerformance.slowQueriesCount} slow queries detected`);
        affectedChecks.push(dbHealthCheck.checkType.toString());
        rootCause = 'Unoptimized database queries causing slowdown';
        confidence = 80;
        remediation = 'Optimize slow queries and add missing indexes';
      }

      // Check for transient bloat
      if (details.transientsCheck?.cleanupRecommended) {
        hasPerformanceIssue = true;
        symptoms.push(`${details.transientsCheck.expiredTransients} expired transients`);
        affectedChecks.push(dbHealthCheck.checkType.toString());
        
        if (rootCause === 'Performance degradation detected') {
          rootCause = 'Database bloat from expired transients';
          confidence = 75;
          remediation = 'Clean up expired transients: wp transient delete --expired';
        }
      }

      // Check for large database
      if (details.growthTracking?.currentSizeMB > 5000) {
        hasPerformanceIssue = true;
        symptoms.push(`Large database: ${details.growthTracking.currentSizeMB.toFixed(0)}MB`);
        
        if (rootCause === 'Performance degradation detected') {
          rootCause = 'Large database size affecting performance';
          confidence = 70;
          remediation = 'Archive old data and optimize database tables';
        }
      }
    }

    // Check for missing object cache
    // (Would need to add object cache check in future)

    if (!hasPerformanceIssue) {
      return null;
    }

    return {
      name: 'Performance Degradation',
      symptoms,
      rootCause,
      confidence,
      severity: 'MEDIUM',
      remediation,
      affectedChecks,
    };
  }

  /**
   * Pattern 4: Security Compromise Score
   * Calculates likelihood of security compromise
   */
  private async calculateCompromiseScore(
    results: CheckResult[]
  ): Promise<CorrelationPattern | null> {
    let score = 0;
    const symptoms: string[] = [];
    const affectedChecks: string[] = [];

    const securityCheck = results.find(r => r.checkType.toString().includes('SECURITY'));
    
    if (!securityCheck || !securityCheck.details) {
      return null;
    }

    const details = securityCheck.details as any;

    // Check for modified core files
    if (details.checksumResults?.modifiedFiles?.length > 0) {
      score += 40;
      symptoms.push(`${details.checksumResults.modifiedFiles.length} modified core files`);
      affectedChecks.push(securityCheck.checkType.toString());
    }

    // Check for malware signatures
    if (details.malwareScan?.suspiciousFiles?.length > 0) {
      const highConfidence = details.malwareScan.suspiciousFiles.filter(
        (f: any) => f.confidence === 'HIGH'
      ).length;
      score += highConfidence * 15;
      symptoms.push(`${details.malwareScan.suspiciousFiles.length} suspicious files (${highConfidence} high confidence)`);
      affectedChecks.push(securityCheck.checkType.toString());
    }

    // Check for .htaccess issues
    if (details.htaccessSecurity && !details.htaccessSecurity.isClean) {
      const critical = details.htaccessSecurity.issues?.filter(
        (i: any) => i.severity === 'CRITICAL'
      ).length || 0;
      score += critical * 25;
      symptoms.push(`${details.htaccessSecurity.issues?.length || 0} .htaccess security issues`);
      affectedChecks.push(securityCheck.checkType.toString());
    }

    // Check for weak security keys
    if (details.securityKeys && !details.securityKeys.allKeysPresent) {
      score += 15;
      symptoms.push('Weak or missing security keys');
    }

    // Check for file editing enabled
    if (details.fileEditingPerms && !details.fileEditingPerms.isSecure) {
      score += 10;
      symptoms.push('File editing enabled in admin');
    }

    if (score === 0) {
      return null;
    }

    let rootCause: string;
    let confidence: number;
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    let remediation: string;

    if (score >= 50) {
      rootCause = 'Site likely compromised - immediate action required';
      confidence = 90;
      severity = 'CRITICAL';
      remediation = 'Quarantine site, scan for malware, restore from clean backup';
    } else if (score >= 30) {
      rootCause = 'High security risk - potential compromise';
      confidence = 75;
      severity = 'HIGH';
      remediation = 'Run full security scan, update all software, change passwords';
    } else {
      rootCause = 'Security vulnerabilities detected';
      confidence = 60;
      severity = 'MEDIUM';
      remediation = 'Address security issues and harden WordPress configuration';
    }

    return {
      name: 'Security Compromise Analysis',
      symptoms,
      rootCause,
      confidence,
      severity,
      remediation,
      affectedChecks,
    };
  }

  /**
   * Pattern 5: Configuration Issues
   * Analyzes configuration problems
   */
  private async analyzeConfigurationIssues(
    results: CheckResult[]
  ): Promise<CorrelationPattern | null> {
    const symptoms: string[] = [];
    const affectedChecks: string[] = [];
    let hasConfigIssue = false;

    // Check for security keys issues
    const configCheck = results.find(r => 
      r.details && typeof r.details === 'object' && 'securityKeys' in r.details
    );

    if (configCheck) {
      const details = configCheck.details as any;
      
      if (details.securityKeys && !details.securityKeys.allKeysPresent) {
        hasConfigIssue = true;
        symptoms.push('Security keys missing or weak');
        affectedChecks.push(configCheck.checkType.toString());
      }

      if (details.absolutePath && !details.absolutePath.valid) {
        hasConfigIssue = true;
        symptoms.push('ABSPATH configuration incorrect');
        affectedChecks.push(configCheck.checkType.toString());
      }

      if (details.cronConfig && details.cronConfig.issues?.length > 0) {
        hasConfigIssue = true;
        symptoms.push(`Cron configuration issues: ${details.cronConfig.issues.join(', ')}`);
        affectedChecks.push(configCheck.checkType.toString());
      }
    }

    if (!hasConfigIssue) {
      return null;
    }

    return {
      name: 'Configuration Issues',
      symptoms,
      rootCause: 'WordPress configuration not optimized',
      confidence: 85,
      severity: 'MEDIUM',
      remediation: 'Update wp-config.php with recommended settings',
      affectedChecks,
    };
  }

  /**
   * Pattern 6: Disk Space Issues
   * Analyzes disk space problems
   */
  private async analyzeDiskSpaceIssues(
    results: CheckResult[]
  ): Promise<CorrelationPattern | null> {
    const diskCheck = results.find(r => r.checkType.toString().includes('DISK'));
    
    if (!diskCheck || diskCheck.status !== CheckStatus.FAIL) {
      return null;
    }

    const symptoms: string[] = ['Disk space critical'];
    const affectedChecks: string[] = [diskCheck.checkType.toString()];

    return {
      name: 'Disk Space Critical',
      symptoms,
      rootCause: 'Disk space exhausted - preventing file operations',
      confidence: 95,
      severity: 'CRITICAL',
      remediation: 'Free up disk space immediately by removing old files, logs, or backups',
      affectedChecks,
    };
  }

  /**
   * Calculate overall health score from all check results
   */
  private calculateOverallHealthScore(results: CheckResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    // Calculate weighted average of all scores
    const totalScore = results.reduce((sum, result) => sum + (result.score || 0), 0);
    const averageScore = totalScore / results.length;

    // Apply penalties for critical failures
    const criticalFailures = results.filter(r => r.status === CheckStatus.FAIL).length;
    const penalty = criticalFailures * 5;

    return Math.max(0, Math.min(100, averageScore - penalty));
  }

  /**
   * Generate prioritized recommendations based on root causes
   */
  private generateRecommendations(
    rootCauses: CorrelationPattern[],
    results: CheckResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Add recommendations from root causes (sorted by confidence)
    for (const rootCause of rootCauses) {
      if (rootCause.severity === 'CRITICAL') {
        recommendations.push(`🚨 CRITICAL: ${rootCause.remediation}`);
      } else if (rootCause.severity === 'HIGH') {
        recommendations.push(`⚠️ HIGH: ${rootCause.remediation}`);
      } else {
        recommendations.push(`💡 ${rootCause.remediation}`);
      }
    }

    // Add recommendations from individual checks (if not already covered)
    for (const result of results) {
      if (result.status === CheckStatus.FAIL && result.recommendations) {
        for (const rec of result.recommendations) {
          // Only add if not similar to existing recommendations
          const isDuplicate = recommendations.some(r => 
            r.toLowerCase().includes(rec.toLowerCase().substring(0, 20))
          );
          if (!isDuplicate) {
            recommendations.push(`💡 ${rec}`);
          }
        }
      }
    }

    // Limit to top 10 recommendations
    return recommendations.slice(0, 10);
  }
}
