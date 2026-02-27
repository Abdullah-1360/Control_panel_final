import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Collect hourly metrics (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async collectHourlyMetrics(): Promise<void> {
    this.logger.log('Collecting hourly metrics');

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    await this.collectMetrics(periodStart, periodEnd, 'HOURLY');
  }

  /**
   * Collect daily metrics (runs at midnight)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async collectDailyMetrics(): Promise<void> {
    this.logger.log('Collecting daily metrics');

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await this.collectMetrics(periodStart, periodEnd, 'DAILY');
  }

  /**
   * Collect metrics for a time period
   */
  private async collectMetrics(
    periodStart: Date,
    periodEnd: Date,
    periodType: string,
  ): Promise<void> {
    try {
      // Get all executions in period
      const executions = await this.prisma.healer_executions.findMany({
        where: {
          startedAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      });

      if (executions.length === 0) {
        this.logger.log(`No executions in period ${periodStart} - ${periodEnd}`);
        return;
      }

      // Calculate diagnosis metrics
      const totalDiagnoses = executions.length;
      const healthyCount = executions.filter(e => e.diagnosisType === 'HEALTHY').length;
      const wsodCount = executions.filter(e => e.diagnosisType === 'WSOD').length;
      const dbErrorCount = executions.filter(e => e.diagnosisType === 'DB_ERROR').length;
      const syntaxErrorCount = executions.filter(e => e.diagnosisType === 'SYNTAX_ERROR').length;
      const otherErrorCount = totalDiagnoses - healthyCount - wsodCount - dbErrorCount - syntaxErrorCount;

      // Calculate healing metrics
      const healingExecutions = executions.filter(e => 
        e.status === 'SUCCESS' || 
        e.status === 'FAILED' || 
        e.status === 'ROLLED_BACK'
      );
      const totalHealings = healingExecutions.length;
      const successfulHealings = executions.filter(e => e.status === 'SUCCESS').length;
      const failedHealings = executions.filter(e => e.status === 'FAILED').length;
      const rolledBackHealings = executions.filter(e => e.status === 'ROLLED_BACK').length;

      // Calculate performance metrics
      const diagnosisTimes = executions
        .filter(e => e.diagnosedAt && e.startedAt)
        .map(e => e.diagnosedAt!.getTime() - e.startedAt.getTime());
      const avgDiagnosisTime = diagnosisTimes.length > 0
        ? Math.round(diagnosisTimes.reduce((a, b) => a + b, 0) / diagnosisTimes.length)
        : null;

      const healingTimes = executions
        .filter(e => e.healedAt && e.approvedAt)
        .map(e => e.healedAt!.getTime() - e.approvedAt!.getTime());
      const avgHealingTime = healingTimes.length > 0
        ? Math.round(healingTimes.reduce((a, b) => a + b, 0) / healingTimes.length)
        : null;

      const verificationScores = executions
        .filter(e => e.verificationScore !== null)
        .map(e => e.verificationScore!);
      const avgVerificationScore = verificationScores.length > 0
        ? verificationScores.reduce((a, b) => a + b, 0) / verificationScores.length
        : null;

      // Calculate success rates
      const healingSuccessRate = totalHealings > 0
        ? successfulHealings / totalHealings
        : null;

      const firstAttemptSuccesses = executions.filter(e => 
        e.status === 'SUCCESS' && 
        e.wasSuccessful === true
      ).length;
      const firstAttemptSuccessRate = totalHealings > 0
        ? firstAttemptSuccesses / totalHealings
        : null;

      // Calculate pattern metrics
      const executionsWithPatterns = executions.filter(e => {
        try {
          const details = JSON.parse(e.diagnosisDetails);
          return details.patternId !== undefined;
        } catch {
          return false;
        }
      });
      const patternsApplied = executionsWithPatterns.length;
      const patternSuccesses = executionsWithPatterns.filter(e => e.wasSuccessful).length;
      const patternSuccessRate = patternsApplied > 0
        ? patternSuccesses / patternsApplied
        : null;

      // Count new patterns learned
      const patternsLearned = await this.prisma.healing_patterns.count({
        where: {
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      });

      // Create metrics record
      await this.prisma.$executeRaw`
        INSERT INTO healer_metrics (
          id, "periodStart", "periodEnd", "periodType",
          "totalDiagnoses", "healthyCount", "wsodCount", "dbErrorCount", "syntaxErrorCount", "otherErrorCount",
          "totalHealings", "successfulHealings", "failedHealings", "rolledBackHealings",
          "avgDiagnosisTime", "avgHealingTime", "avgVerificationScore",
          "healingSuccessRate", "firstAttemptSuccessRate",
          "patternsLearned", "patternsApplied", "patternSuccessRate",
          "createdAt"
        ) VALUES (
          gen_random_uuid(), ${periodStart}, ${periodEnd}, ${periodType},
          ${totalDiagnoses}, ${healthyCount}, ${wsodCount}, ${dbErrorCount}, ${syntaxErrorCount}, ${otherErrorCount},
          ${totalHealings}, ${successfulHealings}, ${failedHealings}, ${rolledBackHealings},
          ${avgDiagnosisTime}, ${avgHealingTime}, ${avgVerificationScore},
          ${healingSuccessRate}, ${firstAttemptSuccessRate},
          ${patternsLearned}, ${patternsApplied}, ${patternSuccessRate},
          NOW()
        )
      `;

      this.logger.log(`Metrics collected for ${periodType}: ${totalDiagnoses} diagnoses, ${totalHealings} healings`);

      // Check for alerts
      await this.checkAlerts(periodStart, periodEnd, {
        totalHealings,
        successfulHealings,
        failedHealings,
        healingSuccessRate,
        avgDiagnosisTime,
        avgHealingTime,
        patternSuccessRate,
      });
    } catch (error) {
      this.logger.error(`Failed to collect metrics: ${(error as Error).message}`);
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(
    periodStart: Date,
    periodEnd: Date,
    metrics: any,
  ): Promise<void> {
    const alerts: any[] = [];

    // Alert: High failure rate (>30%)
    if (metrics.healingSuccessRate !== null && metrics.healingSuccessRate < 0.7) {
      alerts.push({
        alertType: 'HIGH_FAILURE_RATE',
        severity: 'ERROR',
        title: 'High Healing Failure Rate',
        message: `Healing success rate is ${(metrics.healingSuccessRate * 100).toFixed(1)}% (${metrics.successfulHealings}/${metrics.totalHealings} successful)`,
        metadata: JSON.stringify({ periodStart, periodEnd, ...metrics }),
      });
    }

    // Alert: Slow performance (avg diagnosis >60s)
    if (metrics.avgDiagnosisTime && metrics.avgDiagnosisTime > 60000) {
      alerts.push({
        alertType: 'SLOW_PERFORMANCE',
        severity: 'WARNING',
        title: 'Slow Diagnosis Performance',
        message: `Average diagnosis time is ${(metrics.avgDiagnosisTime / 1000).toFixed(1)}s`,
        metadata: JSON.stringify({ periodStart, periodEnd, avgDiagnosisTime: metrics.avgDiagnosisTime }),
      });
    }

    // Alert: Pattern degradation (success rate <60%)
    if (metrics.patternSuccessRate !== null && metrics.patternSuccessRate < 0.6) {
      alerts.push({
        alertType: 'PATTERN_DEGRADATION',
        severity: 'WARNING',
        title: 'Pattern Success Rate Degraded',
        message: `Pattern-based healing success rate is ${(metrics.patternSuccessRate * 100).toFixed(1)}%`,
        metadata: JSON.stringify({ periodStart, periodEnd, patternSuccessRate: metrics.patternSuccessRate }),
      });
    }

    // Create alerts
    for (const alert of alerts) {
      await this.prisma.$executeRaw`
        INSERT INTO healer_alerts (
          id, "alertType", severity, title, message, metadata, status, "createdAt"
        ) VALUES (
          gen_random_uuid(), ${alert.alertType}, ${alert.severity}, ${alert.title}, 
          ${alert.message}, ${alert.metadata}, 'ACTIVE', NOW()
        )
      `;
      this.logger.warn(`Alert created: ${alert.title}`);
    }
  }

  /**
   * Get metrics for dashboard
   */
  async getMetrics(periodType: string, limit: number = 24): Promise<any[]> {
    const metrics = await this.prisma.$queryRaw`
      SELECT * FROM healer_metrics
      WHERE "periodType" = ${periodType}
      ORDER BY "periodStart" DESC
      LIMIT ${limit}
    `;
    return metrics as any[];
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<any[]> {
    const alerts = await this.prisma.$queryRaw`
      SELECT * FROM healer_alerts
      WHERE status = 'ACTIVE'
      ORDER BY 
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'ERROR' THEN 2
          WHEN 'WARNING' THEN 3
          WHEN 'INFO' THEN 4
        END,
        "createdAt" DESC
      LIMIT 50
    `;
    return alerts as any[];
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE healer_alerts
      SET status = 'ACKNOWLEDGED',
          "acknowledgedBy" = ${userId},
          "acknowledgedAt" = NOW()
      WHERE id = ${alertId}
    `;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE healer_alerts
      SET status = 'RESOLVED',
          "resolvedAt" = NOW()
      WHERE id = ${alertId}
    `;
  }
}
