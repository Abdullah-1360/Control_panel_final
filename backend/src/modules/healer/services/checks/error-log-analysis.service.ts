import { Injectable, Logger } from '@nestjs/common';
import { LogAnalysisService } from '../log-analysis.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Error Log Analysis Check Service
 * Wrapper for LogAnalysisService that implements IDiagnosisCheckService
 * 
 * PHASE 3 - LAYER 7: Error Log Analysis
 * - Categorizes errors by severity (fatal, warning, notice, deprecated)
 * - Analyzes error frequency and detects spikes
 * - Detects 404 patterns and probing attacks
 * - Correlates errors by plugin/theme/type
 * - Generates comprehensive analysis report
 */
@Injectable()
export class ErrorLogAnalysisService implements IDiagnosisCheckService {
  private readonly logger = new Logger(ErrorLogAnalysisService.name);

  constructor(private readonly logAnalysis: LogAnalysisService) {}

  /**
   * Execute error log analysis check
   */
  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Starting error log analysis for ${domain || sitePath}`);

      // Use LogAnalysisService to generate comprehensive report
      const report = await this.logAnalysis.generateComprehensiveReport(
        serverId,
        sitePath,
        domain,
      );

      // Calculate score based on severity and error counts
      let score = 100;
      let status = CheckStatus.PASS;
      const issues: string[] = [];
      const recommendations: string[] = [...report.recommendations];

      // Deduct points based on severity
      if (report.severity === 'critical') {
        score -= 50;
        status = CheckStatus.FAIL;
        issues.push('Critical severity errors detected');
      } else if (report.severity === 'high') {
        score -= 30;
        status = CheckStatus.WARNING;
        issues.push('High severity errors detected');
      } else if (report.severity === 'medium') {
        score -= 15;
        status = CheckStatus.WARNING;
        issues.push('Medium severity errors detected');
      } else if (report.severity === 'low') {
        score -= 5;
      }

      // Additional deductions for specific issues
      if (report.categorization.fatal.length > 0) {
        score -= Math.min(20, report.categorization.fatal.length * 2);
        issues.push(`${report.categorization.fatal.length} fatal error(s) found`);
      }

      if (report.frequency.hasSpike) {
        score -= 15;
        issues.push('Error spike detected');
      }

      if (report.patterns404.probingAttack) {
        score -= 20;
        issues.push('Probing attack detected');
      }

      // Add general recommendations if no specific ones
      if (recommendations.length === 0) {
        if (report.categorization.fatal.length > 0) {
          recommendations.push('Review and fix fatal errors immediately');
        }
        if (report.categorization.warning.length > 10) {
          recommendations.push('Address warning messages to improve stability');
        }
        if (report.frequency.errorsPerHour > 10) {
          recommendations.push('Monitor error logs regularly');
        }
      }

      const message = issues.length > 0
        ? `Error log analysis: ${issues.join(', ')}`
        : report.summary;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: {
          summary: report.summary,
          categorization: {
            fatal: report.categorization.fatal.length,
            warning: report.categorization.warning.length,
            notice: report.categorization.notice.length,
            deprecated: report.categorization.deprecated.length,
            // Include sample errors from each category
            fatalSamples: report.categorization.fatal.slice(0, 10),
            warningSamples: report.categorization.warning.slice(0, 10),
            noticeSamples: report.categorization.notice.slice(0, 10),
          },
          frequency: {
            totalErrors: report.frequency.totalErrors,
            errorsPerHour: report.frequency.errorsPerHour,
            hasSpike: report.frequency.hasSpike,
            recentErrors: report.frequency.recentErrors,
            analysis: report.frequency.frequencyAnalysis,
          },
          patterns404: {
            total404s: report.patterns404.total404s,
            probingAttack: report.patterns404.probingAttack,
            attackVectors: report.patterns404.attackVectors,
            suspiciousPatterns: report.patterns404.suspiciousPatterns.slice(0, 10), // Top 10
          },
          correlation: {
            topCulprits: report.correlation.topCulprits.slice(0, 10), // Top 10
            pluginErrors: report.correlation.byPlugin.size,
            themeErrors: report.correlation.byTheme.size,
            errorTypes: Array.from(report.correlation.byType.keys()),
            // Include detailed culprit information
            pluginErrorDetails: Array.from(report.correlation.byPlugin.entries()).slice(0, 5).map((entry: any) => ({
              plugin: entry[0],
              errorCount: entry[1].length,
              samples: entry[1].slice(0, 3),
            })),
            themeErrorDetails: Array.from(report.correlation.byTheme.entries()).slice(0, 5).map((entry: any) => ({
              theme: entry[0],
              errorCount: entry[1].length,
              samples: entry[1].slice(0, 3),
            })),
          },
          severity: report.severity,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error log analysis failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Error log analysis failed: ${err.message}`,
        details: { error: err.message },
        recommendations: [
          'Retry error log analysis',
          'Check log file permissions',
          'Verify SSH access to server',
        ],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get the check type this service handles
   */
  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.ERROR_LOG_ANALYSIS;
  }

  /**
   * Get the priority of this check
   */
  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  /**
   * Get human-readable name
   */
  getName(): string {
    return 'Error Log Analysis';
  }

  /**
   * Get description of what this check does
   */
  getDescription(): string {
    return 'Analyzes WordPress, PHP, and web server error logs with categorization by severity, frequency analysis with spike detection, 404 pattern detection for probing attacks, and error correlation by plugin/theme/type';
  }

  /**
   * Check if this service can handle the given check type
   */
  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.ERROR_LOG_ANALYSIS;
  }
}
