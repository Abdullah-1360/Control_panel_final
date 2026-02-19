import { Injectable, Logger } from '@nestjs/common';
import {
  CheckResult,
  CheckStatus,
  CheckPriority,
  IDiagnosisCheckService,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class UptimeMonitoringService implements IDiagnosisCheckService {
  private readonly logger = new Logger(UptimeMonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const details: any = {};
    const recommendations: string[] = [];
    let score = 100;
    let status = CheckStatus.PASS;

    try {
      // Get site ID from domain
      const site = await this.prisma.wp_sites.findFirst({
        where: { domain },
        select: { id: true },
      });

      if (!site) {
        return {
          checkType: DiagnosisCheckType.UPTIME_MONITORING,
          status: CheckStatus.SKIPPED,
          score: 0,
          message: 'Site not found in database',
          details: {},
          recommendations: ['Register site in database to track uptime'],
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Calculate uptime from diagnosis history
      const uptimeStats = await this.calculateUptimeFromHistory(site.id);
      details.uptime = uptimeStats;

      if (uptimeStats.uptimePercentage < 95) {
        score -= (95 - uptimeStats.uptimePercentage) * 2;
        status = CheckStatus.FAIL;
        recommendations.push(
          `Uptime is ${uptimeStats.uptimePercentage.toFixed(2)}% (target: 99.9%)`,
        );
      } else if (uptimeStats.uptimePercentage < 99) {
        score -= (99 - uptimeStats.uptimePercentage);
        status = CheckStatus.WARNING;
        recommendations.push(
          `Uptime is ${uptimeStats.uptimePercentage.toFixed(2)}% (target: 99.9%)`,
        );
      }

      // Calculate response time trends
      const responseTimeStats = await this.calculateResponseTimeTrends(
        site.id,
      );
      details.responseTime = responseTimeStats;

      if (responseTimeStats.avgResponseTime > 3000) {
        score -= 20;
        status = CheckStatus.FAIL;
        recommendations.push(
          `Average response time is ${responseTimeStats.avgResponseTime}ms (target: <1000ms)`,
        );
      } else if (responseTimeStats.avgResponseTime > 1000) {
        score -= 10;
        if (status === CheckStatus.PASS) status = CheckStatus.WARNING;
        recommendations.push(
          `Response time is ${responseTimeStats.avgResponseTime}ms (target: <1000ms)`,
        );
      }

      // Check for recent downtime incidents
      const recentDowntime = await this.checkRecentDowntime(site.id);
      details.recentDowntime = recentDowntime;

      if (recentDowntime.count > 0) {
        score -= recentDowntime.count * 5;
        if (status === CheckStatus.PASS) status = CheckStatus.WARNING;
        recommendations.push(
          `${recentDowntime.count} downtime incident(s) in last 24 hours`,
        );
      }

      // Check for degraded performance patterns
      const degradationPattern = await this.detectDegradationPattern(site.id);
      details.degradation = degradationPattern;

      if (degradationPattern.detected) {
        score -= 15;
        if (status === CheckStatus.PASS) status = CheckStatus.WARNING;
        recommendations.push(
          'Performance degradation detected - investigate resource usage',
        );
      }

      score = Math.max(0, Math.min(100, score));

      return {
        checkType: DiagnosisCheckType.UPTIME_MONITORING,
        status,
        score,
        message: this.buildMessage(status, details),
        details,
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Uptime monitoring failed for ${domain}: ${errorMessage}`,
      );
      return {
        checkType: DiagnosisCheckType.UPTIME_MONITORING,
        status: CheckStatus.ERROR,
        score: 0,
        message: `Failed to monitor uptime: ${errorMessage}`,
        details: { error: errorMessage },
        recommendations: ['Verify database access and site registration'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  private async calculateUptimeFromHistory(siteId: string): Promise<any> {
    try {
      // Get diagnosis history for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const history = await this.prisma.diagnosis_history.findMany({
        where: {
          siteId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          diagnosisDetails: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (history.length === 0) {
        return {
          uptimePercentage: 100,
          totalChecks: 0,
          upChecks: 0,
          downChecks: 0,
          period: '30 days',
        };
      }

      // Count up vs down checks
      let upChecks = 0;
      let downChecks = 0;

      for (const record of history) {
        const result = record.diagnosisDetails as any;
        // Consider site "up" if it's not in CRITICAL state
        if (result.status !== 'CRITICAL' && result.status !== 'DOWN') {
          upChecks++;
        } else {
          downChecks++;
        }
      }

      const totalChecks = upChecks + downChecks;
      const uptimePercentage = (upChecks / totalChecks) * 100;

      return {
        uptimePercentage,
        totalChecks,
        upChecks,
        downChecks,
        period: '30 days',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to calculate uptime from history: ${errorMessage}`,
      );
      return {
        uptimePercentage: 100,
        totalChecks: 0,
        upChecks: 0,
        downChecks: 0,
        period: '30 days',
      };
    }
  }

  private async calculateResponseTimeTrends(siteId: string): Promise<any> {
    try {
      // Get health score history for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const healthHistory = await this.prisma.health_score_history.findMany({
        where: {
          siteId,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          createdAt: true,
          performanceScore: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (healthHistory.length === 0) {
        return {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          trend: 'stable',
          dataPoints: 0,
        };
      }

      // Extract performance scores (proxy for response time)
      // In a real implementation, you'd store actual response times
      const performanceScores = healthHistory
        .map((h) => h.performanceScore)
        .filter((s) => s > 0);

      if (performanceScores.length === 0) {
        return {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          trend: 'stable',
          dataPoints: 0,
        };
      }

      // Convert performance score to estimated response time
      // Score 100 = 500ms, Score 0 = 5000ms (linear approximation)
      const responseTimes = performanceScores.map(
        (score) => 5000 - (score / 100) * 4500,
      );

      const avgResponseTime = Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      );
      const minResponseTime = Math.round(Math.min(...responseTimes));
      const maxResponseTime = Math.round(Math.max(...responseTimes));

      // Detect trend (improving, degrading, stable)
      let trend = 'stable';
      if (responseTimes.length >= 3) {
        const recent = responseTimes.slice(0, 3);
        const older = responseTimes.slice(-3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        if (recentAvg > olderAvg * 1.2) {
          trend = 'degrading';
        } else if (recentAvg < olderAvg * 0.8) {
          trend = 'improving';
        }
      }

      return {
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        trend,
        dataPoints: responseTimes.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to calculate response time trends: ${errorMessage}`,
      );
      return {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        trend: 'stable',
        dataPoints: 0,
      };
    }
  }

  private async checkRecentDowntime(siteId: string): Promise<any> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const downtimeIncidents = await this.prisma.diagnosis_history.count({
        where: {
          siteId,
          createdAt: { gte: twentyFourHoursAgo },
          diagnosisType: 'WSOD', // White Screen of Death = critical
        },
      });

      return {
        count: downtimeIncidents,
        period: '24 hours',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to check recent downtime: ${errorMessage}`);
      return { count: 0, period: '24 hours' };
    }
  }

  private async detectDegradationPattern(siteId: string): Promise<any> {
    try {
      // Get last 10 health scores
      const recentScores = await this.prisma.health_score_history.findMany({
        where: { siteId },
        select: { score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (recentScores.length < 5) {
        return { detected: false, reason: 'insufficient_data' };
      }

      const scores = recentScores.map((s) => s.score);

      // Check for consistent decline
      let decliningCount = 0;
      for (let i = 0; i < scores.length - 1; i++) {
        if (scores[i] < scores[i + 1]) {
          decliningCount++;
        }
      }

      // If 70% of recent checks show decline, flag degradation
      if (decliningCount >= scores.length * 0.7) {
        return {
          detected: true,
          reason: 'consistent_decline',
          decliningChecks: decliningCount,
          totalChecks: scores.length,
        };
      }

      // Check for sudden drop
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const latestScore = scores[0];

      if (latestScore < avgScore * 0.7) {
        return {
          detected: true,
          reason: 'sudden_drop',
          latestScore,
          avgScore: Math.round(avgScore),
        };
      }

      return { detected: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to detect degradation pattern: ${errorMessage}`,
      );
      return { detected: false, reason: 'error' };
    }
  }

  private buildMessage(status: CheckStatus, details: any): string {
    const { uptime, responseTime, recentDowntime } = details;

    if (status === CheckStatus.PASS) {
      return `Uptime is excellent: ${uptime.uptimePercentage.toFixed(2)}% over ${uptime.period}`;
    }

    if (status === CheckStatus.WARNING) {
      return `Uptime issues detected: ${uptime.uptimePercentage.toFixed(2)}% uptime, ${recentDowntime.count} recent incidents`;
    }

    return `Critical uptime issues: ${uptime.uptimePercentage.toFixed(2)}% uptime, avg response ${responseTime.avgResponseTime}ms`;
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.UPTIME_MONITORING;
  }

  getPriority(): CheckPriority {
    return CheckPriority.LOW;
  }

  getName(): string {
    return 'Uptime Monitoring';
  }

  getDescription(): string {
    return 'Tracks historical uptime, response time trends, and detects performance degradation patterns';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.UPTIME_MONITORING;
  }
}
