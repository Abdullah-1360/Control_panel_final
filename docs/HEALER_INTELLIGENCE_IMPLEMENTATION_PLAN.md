# WordPress Auto-Healer Intelligence Implementation Plan

## Executive Summary

This document provides a comprehensive, production-ready implementation plan to transform the WordPress Auto-Healer module into an intelligent, self-learning system capable of autonomous diagnosis and healing with minimal human intervention.

**Current State:**
- ✅ Basic diagnosis with 13 comprehensive checks
- ✅ Manual healing with custom command support
- ✅ Pattern learning foundation (database schema exists)
- ✅ Backup/rollback functionality
- ✅ Circuit breaker protection

**Target State:**
- 🎯 AI-powered root cause analysis with 95%+ accuracy
- 🎯 Predictive maintenance preventing issues before they occur
- 🎯 Self-learning system improving from every execution
- 🎯 Production-grade monitoring, alerting, and observability
- 🎯 Comprehensive testing with 90%+ coverage
- 🎯 Enterprise-ready security and compliance

**Technology Stack:**
- Backend: NestJS 10+, TypeScript 5+, Node.js 20+
- Database: PostgreSQL 16 with Prisma ORM
- Queue: BullMQ with Redis 7
- AI/ML: OpenAI GPT-4 API (for root cause analysis)
- Monitoring: Built-in metrics collection
- Testing: Jest, Supertest

---

## Table of Contents

1. [Phase 1: Production Readiness (Weeks 1-4)](#phase-1-production-readiness)
2. [Phase 2: Intelligence Layer (Weeks 5-8)](#phase-2-intelligence-layer)
3. [Phase 3: Advanced Features (Weeks 9-12)](#phase-3-advanced-features)
4. [Database Schema Changes](#database-schema-changes)
5. [API Endpoints](#api-endpoints)
6. [Service Architecture](#service-architecture)
7. [Frontend Components](#frontend-components)
8. [Testing Strategy](#testing-strategy)
9. [Deployment & Migration](#deployment-migration)
10. [Monitoring & Observability](#monitoring-observability)

---

## Phase 1: Production Readiness (Weeks 1-4)

### Priority: P0 (Must-Have)
### Goal: Make the healer production-ready with robust error handling, monitoring, and verification

### 1.1 Enhanced Verification System

**Problem:** Current verification only checks HTTP status, which can return 200 even with WSOD.

**Solution:** Multi-layered verification with content analysis, performance checks, and functional tests.

#### Database Schema Changes

```prisma
// Add to HealerExecution model
model HealerExecution {
  // ... existing fields ...
  
  // Enhanced verification
  verificationResults String?      @db.Text // JSON with detailed verification
  verificationScore   Int?         // 0-100
  verificationChecks  String?      @db.Text // JSON array of checks performed
  
  // Performance metrics
  preHealingMetrics   String?      @db.Text // JSON: response time, page size, etc.
  postHealingMetrics  String?      @db.Text // JSON: response time, page size, etc.
}
```

#### New Service: VerificationService

```typescript
// backend/src/modules/healer/services/verification.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from './ssh-executor.service';

interface VerificationResult {
  score: number; // 0-100
  checks: VerificationCheck[];
  passed: boolean;
  metrics: PerformanceMetrics;
}

interface VerificationCheck {
  name: string;
  passed: boolean;
  score: number;
  details: string;
  duration: number;
}

interface PerformanceMetrics {
  responseTime: number; // ms
  pageSize: number; // bytes
  httpStatus: number;
  hasErrors: boolean;
  errorCount: number;
  loadTime: number;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly sshService: SshExecutorService,
  ) {}

  /**
   * Perform comprehensive verification after healing
   * Returns score 0-100 (>80 = success)
   */
  async verify(
    serverId: string,
    sitePath: string,
    domain: string,
    diagnosisType: string,
  ): Promise<VerificationResult> {
    this.logger.log(`Starting verification for ${domain}`);

    const checks: VerificationCheck[] = [];
    let totalScore = 0;

    // 1. HTTP Status Check (20 points)
    const httpCheck = await this.checkHttpStatus(domain);
    checks.push(httpCheck);
    totalScore += httpCheck.score;

    // 2. Content Analysis (25 points)
    const contentCheck = await this.checkContent(domain);
    checks.push(contentCheck);
    totalScore += contentCheck.score;

    // 3. Error Log Check (20 points)
    const errorLogCheck = await this.checkErrorLogs(serverId, sitePath);
    checks.push(errorLogCheck);
    totalScore += errorLogCheck.score;

    // 4. WordPress Functionality (20 points)
    const wpCheck = await this.checkWordPressFunctionality(serverId, sitePath);
    checks.push(wpCheck);
    totalScore += wpCheck.score;

    // 5. Performance Check (15 points)
    const perfCheck = await this.checkPerformance(domain);
    checks.push(perfCheck);
    totalScore += perfCheck.score;

    // Collect metrics
    const metrics = await this.collectMetrics(domain);

    const passed = totalScore >= 80;

    this.logger.log(`Verification completed: ${totalScore}/100 (${passed ? 'PASSED' : 'FAILED'})`);

    return {
      score: totalScore,
      checks,
      passed,
      metrics,
    };
  }

  /**
   * Check HTTP status and response (20 points max)
   */
  private async checkHttpStatus(domain: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'OpsManager-Healer-Verification/1.0',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      
      clearTimeout(timeoutId);
      
      const body = await response.text();
      const duration = Date.now() - startTime;
      
      // Check for WSOD indicators
      const wsodIndicators = [
        'There has been a critical error',
        'Parse error:',
        'Fatal error:',
        'syntax error',
        'Call to undefined',
        'WordPress database error',
      ];
      
      const hasWsod = wsodIndicators.some(indicator => 
        body.toLowerCase().includes(indicator.toLowerCase())
      );
      
      const isBlank = body.trim().length < 100;
      
      if (response.status === 200 && !hasWsod && !isBlank) {
        return {
          name: 'HTTP Status',
          passed: true,
          score: 20,
          details: `HTTP 200 OK, ${body.length} bytes, no WSOD indicators`,
          duration,
        };
      } else if (response.status === 200 && (hasWsod || isBlank)) {
        return {
          name: 'HTTP Status',
          passed: false,
          score: 0,
          details: hasWsod ? 'WSOD detected in content' : 'Blank page detected',
          duration,
        };
      } else {
        return {
          name: 'HTTP Status',
          passed: false,
          score: 0,
          details: `HTTP ${response.status}`,
          duration,
        };
      }
    } catch (error) {
      return {
        name: 'HTTP Status',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze page content for errors (25 points max)
   */
  private async checkContent(domain: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const body = await response.text();
      const duration = Date.now() - startTime;
      
      let score = 25;
      const issues: string[] = [];
      
      // Check for error indicators
      const errorPatterns = [
        { pattern: /fatal error/i, penalty: 25, name: 'Fatal Error' },
        { pattern: /parse error/i, penalty: 25, name: 'Parse Error' },
        { pattern: /syntax error/i, penalty: 25, name: 'Syntax Error' },
        { pattern: /database error/i, penalty: 20, name: 'Database Error' },
        { pattern: /warning:/i, penalty: 5, name: 'PHP Warning' },
        { pattern: /notice:/i, penalty: 2, name: 'PHP Notice' },
      ];
      
      for (const { pattern, penalty, name } of errorPatterns) {
        if (pattern.test(body)) {
          score -= penalty;
          issues.push(name);
        }
      }
      
      // Check for positive indicators
      const hasHtmlStructure = /<html/i.test(body) && /<\/html>/i.test(body);
      const hasTitle = /<title>/i.test(body);
      const hasContent = body.length > 1000;
      
      if (!hasHtmlStructure) {
        score -= 10;
        issues.push('No HTML structure');
      }
      
      if (!hasTitle) {
        score -= 5;
        issues.push('No title tag');
      }
      
      if (!hasContent) {
        score -= 5;
        issues.push('Insufficient content');
      }
      
      score = Math.max(0, score);
      
      return {
        name: 'Content Analysis',
        passed: score >= 20,
        score,
        details: issues.length > 0 ? `Issues: ${issues.join(', ')}` : 'Content looks healthy',
        duration,
      };
    } catch (error) {
      return {
        name: 'Content Analysis',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check error logs for new errors (20 points max)
   */
  private async checkErrorLogs(serverId: string, sitePath: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      // Check last 50 lines of error logs (recent errors only)
      const errorLogResult = await this.sshService.executeCommand(
        serverId,
        `tail -50 ${sitePath}/wp-content/debug.log 2>/dev/null || tail -50 ${sitePath}/error_log 2>/dev/null || echo "No logs"`,
      );
      
      const duration = Date.now() - startTime;
      
      // Count recent errors (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentErrors = errorLogResult.split('\n').filter(line => {
        // Check if line has timestamp and is recent
        const timestampMatch = line.match(/\[(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2})\]/);
        if (timestampMatch) {
          const logTime = new Date(timestampMatch[1]);
          return logTime >= fiveMinutesAgo && (
            line.includes('Fatal error') ||
            line.includes('Parse error') ||
            line.includes('Warning')
          );
        }
        return false;
      });
      
      const errorCount = recentErrors.length;
      
      let score = 20;
      if (errorCount > 10) score = 0;
      else if (errorCount > 5) score = 5;
      else if (errorCount > 0) score = 15;
      
      return {
        name: 'Error Logs',
        passed: errorCount === 0,
        score,
        details: errorCount === 0 ? 'No recent errors' : `${errorCount} recent errors found`,
        duration,
      };
    } catch (error) {
      return {
        name: 'Error Logs',
        passed: true, // Don't fail if we can't check logs
        score: 15, // Partial credit
        details: `Could not check logs: ${(error as Error).message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check WordPress functionality (20 points max)
   */
  private async checkWordPressFunctionality(serverId: string, sitePath: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      // Test WP-CLI commands
      const commands = [
        { cmd: 'wp core version', points: 5, name: 'Core accessible' },
        { cmd: 'wp db check', points: 10, name: 'Database accessible' },
        { cmd: 'wp plugin list --status=active', points: 5, name: 'Plugins accessible' },
      ];
      
      let score = 0;
      const results: string[] = [];
      
      for (const { cmd, points, name } of commands) {
        try {
          const result = await this.sshService.executeCommand(
            serverId,
            `cd ${sitePath} && ${cmd} 2>&1`,
          );
          
          if (!result.toLowerCase().includes('error') && !result.toLowerCase().includes('failed')) {
            score += points;
            results.push(`✓ ${name}`);
          } else {
            results.push(`✗ ${name}`);
          }
        } catch {
          results.push(`✗ ${name}`);
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        name: 'WordPress Functionality',
        passed: score >= 15,
        score,
        details: results.join(', '),
        duration,
      };
    } catch (error) {
      return {
        name: 'WordPress Functionality',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check performance metrics (15 points max)
   */
  private async checkPerformance(domain: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const fetchStart = Date.now();
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        signal: controller.signal,
      });
      const responseTime = Date.now() - fetchStart;
      
      clearTimeout(timeoutId);
      
      const body = await response.text();
      const duration = Date.now() - startTime;
      
      let score = 15;
      const metrics: string[] = [];
      
      // Response time scoring
      if (responseTime > 5000) {
        score -= 10;
        metrics.push(`Slow response: ${responseTime}ms`);
      } else if (responseTime > 3000) {
        score -= 5;
        metrics.push(`Moderate response: ${responseTime}ms`);
      } else {
        metrics.push(`Fast response: ${responseTime}ms`);
      }
      
      // Page size check
      const pageSize = body.length;
      if (pageSize < 500) {
        score -= 5;
        metrics.push(`Small page: ${pageSize} bytes`);
      } else {
        metrics.push(`Normal page: ${pageSize} bytes`);
      }
      
      score = Math.max(0, score);
      
      return {
        name: 'Performance',
        passed: score >= 10,
        score,
        details: metrics.join(', '),
        duration,
      };
    } catch (error) {
      return {
        name: 'Performance',
        passed: false,
        score: 0,
        details: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(domain: string): Promise<PerformanceMetrics> {
    try {
      const startTime = Date.now();
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const responseTime = Date.now() - startTime;
      
      const body = await response.text();
      
      const errorIndicators = [
        'fatal error',
        'parse error',
        'syntax error',
        'database error',
        'warning:',
      ];
      
      const errorCount = errorIndicators.reduce((count, indicator) => {
        const regex = new RegExp(indicator, 'gi');
        const matches = body.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
      
      return {
        responseTime,
        pageSize: body.length,
        httpStatus: response.status,
        hasErrors: errorCount > 0,
        errorCount,
        loadTime: responseTime,
      };
    } catch (error) {
      return {
        responseTime: 0,
        pageSize: 0,
        httpStatus: 0,
        hasErrors: true,
        errorCount: 1,
        loadTime: 0,
      };
    }
  }
}
```

#### Update HealingProcessor

```typescript
// backend/src/modules/healer/processors/healing.processor.ts

// Add verification step after healing
private async verifyHealing(
  execution: any,
  site: any,
): Promise<boolean> {
  this.logger.log(`Verifying healing for execution ${execution.id}`);

  try {
    // Determine path and domain
    let verifyPath = site.path;
    let verifyDomain = site.domain;

    if (execution.subdomain) {
      const subdomains = (site.availableSubdomains as any) || [];
      const subdomainInfo = subdomains.find((s: any) => s.subdomain === execution.subdomain);
      if (subdomainInfo) {
        verifyPath = subdomainInfo.path;
        verifyDomain = execution.subdomain;
      }
    }

    // Perform verification
    const verificationResult = await this.verificationService.verify(
      site.serverId,
      verifyPath,
      verifyDomain,
      execution.diagnosisType,
    );

    // Update execution with verification results
    await this.prisma.healerExecution.update({
      where: { id: execution.id },
      data: {
        verificationResults: JSON.stringify(verificationResult),
        verificationScore: verificationResult.score,
        verificationChecks: JSON.stringify(verificationResult.checks),
        postHealingMetrics: JSON.stringify(verificationResult.metrics),
        wasSuccessful: verificationResult.passed,
      },
    });

    return verificationResult.passed;
  } catch (error) {
    this.logger.error(`Verification failed: ${(error as Error).message}`);
    return false;
  }
}
```



### 1.2 Monitoring & Alerting System

**Problem:** No visibility into healer performance, failures, or trends.

**Solution:** Comprehensive monitoring with metrics collection, alerting, and dashboards.

#### Database Schema Changes

```prisma
// New model for healer metrics
model HealerMetrics {
  id                String   @id @default(uuid())
  
  // Time period
  periodStart       DateTime
  periodEnd         DateTime
  periodType        MetricPeriodType // HOURLY, DAILY, WEEKLY, MONTHLY
  
  // Diagnosis metrics
  totalDiagnoses    Int      @default(0)
  healthyCount      Int      @default(0)
  wsodCount         Int      @default(0)
  dbErrorCount      Int      @default(0)
  syntaxErrorCount  Int      @default(0)
  otherErrorCount   Int      @default(0)
  
  // Healing metrics
  totalHealings     Int      @default(0)
  successfulHealings Int     @default(0)
  failedHealings    Int      @default(0)
  rolledBackHealings Int     @default(0)
  
  // Performance metrics
  avgDiagnosisTime  Int?     // milliseconds
  avgHealingTime    Int?     // milliseconds
  avgVerificationScore Float?
  
  // Success rates
  healingSuccessRate Float?  // 0.0-1.0
  firstAttemptSuccessRate Float?
  
  // Pattern learning
  patternsLearned   Int      @default(0)
  patternsApplied   Int      @default(0)
  patternSuccessRate Float?
  
  createdAt         DateTime @default(now())
  
  @@index([periodStart, periodType])
  @@index([periodType])
  @@map("healer_metrics")
}

enum MetricPeriodType {
  HOURLY
  DAILY
  WEEKLY
  MONTHLY
}

// New model for alerts
model HealerAlert {
  id              String   @id @default(uuid())
  
  // Alert details
  alertType       AlertType
  severity        AlertSeverity
  title           String
  message         String   @db.Text
  
  // Context
  siteId          String?
  executionId     String?
  metadata        String?  @db.Text // JSON
  
  // Status
  status          AlertStatus @default(ACTIVE)
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  resolvedAt      DateTime?
  
  createdAt       DateTime @default(now())
  
  @@index([status, severity])
  @@index([alertType])
  @@index([createdAt])
  @@map("healer_alerts")
}

enum AlertType {
  HIGH_FAILURE_RATE      // >30% failures in last hour
  CIRCUIT_BREAKER_OPEN   // Site hit max attempts
  VERIFICATION_FAILED    // Healing verification failed
  PATTERN_DEGRADATION    // Pattern success rate dropped
  SLOW_PERFORMANCE       // Diagnosis/healing taking too long
  BACKUP_FAILED          // Backup creation failed
  SYSTEM_ERROR           // Unexpected system error
}

enum AlertSeverity {
  INFO
  WARNING
  ERROR
  CRITICAL
}

enum AlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
  IGNORED
}
```

#### New Service: MetricsService

```typescript
// backend/src/modules/healer/services/metrics.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { MetricPeriodType, HealerStatus } from '@prisma/client';

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

    await this.collectMetrics(periodStart, periodEnd, MetricPeriodType.HOURLY);
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

    await this.collectMetrics(periodStart, periodEnd, MetricPeriodType.DAILY);
  }

  /**
   * Collect metrics for a time period
   */
  private async collectMetrics(
    periodStart: Date,
    periodEnd: Date,
    periodType: MetricPeriodType,
  ): Promise<void> {
    try {
      // Get all executions in period
      const executions = await this.prisma.healerExecution.findMany({
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
        e.status === HealerStatus.SUCCESS || 
        e.status === HealerStatus.FAILED || 
        e.status === HealerStatus.ROLLED_BACK
      );
      const totalHealings = healingExecutions.length;
      const successfulHealings = executions.filter(e => e.status === HealerStatus.SUCCESS).length;
      const failedHealings = executions.filter(e => e.status === HealerStatus.FAILED).length;
      const rolledBackHealings = executions.filter(e => e.status === HealerStatus.ROLLED_BACK).length;

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
        e.status === HealerStatus.SUCCESS && 
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
      const patternsLearned = await this.prisma.healingPattern.count({
        where: {
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      });

      // Create metrics record
      await this.prisma.healerMetrics.create({
        data: {
          periodStart,
          periodEnd,
          periodType,
          totalDiagnoses,
          healthyCount,
          wsodCount,
          dbErrorCount,
          syntaxErrorCount,
          otherErrorCount,
          totalHealings,
          successfulHealings,
          failedHealings,
          rolledBackHealings,
          avgDiagnosisTime,
          avgHealingTime,
          avgVerificationScore,
          healingSuccessRate,
          firstAttemptSuccessRate,
          patternsLearned,
          patternsApplied,
          patternSuccessRate,
        },
      });

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
      await this.prisma.healerAlert.create({ data: alert });
      this.logger.warn(`Alert created: ${alert.title}`);
    }
  }

  /**
   * Get metrics for dashboard
   */
  async getMetrics(
    periodType: MetricPeriodType,
    limit: number = 24,
  ): Promise<any[]> {
    return this.prisma.healerMetrics.findMany({
      where: { periodType },
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<any[]> {
    return this.prisma.healerAlert.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50,
    });
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.prisma.healerAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.prisma.healerAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }
}
```

#### API Endpoints

```typescript
// backend/src/modules/healer/healer.controller.ts

// Add metrics endpoints
@Get('metrics/:periodType')
@Permissions('healer.metrics.read')
async getMetrics(
  @Param('periodType') periodType: MetricPeriodType,
  @Query('limit') limit?: number,
) {
  return this.metricsService.getMetrics(periodType, limit ? parseInt(limit) : 24);
}

@Get('alerts')
@Permissions('healer.alerts.read')
async getActiveAlerts() {
  return this.metricsService.getActiveAlerts();
}

@Post('alerts/:id/acknowledge')
@Permissions('healer.alerts.manage')
async acknowledgeAlert(
  @Param('id') alertId: string,
  @CurrentUser() user: any,
) {
  await this.metricsService.acknowledgeAlert(alertId, user.id);
  return { message: 'Alert acknowledged' };
}

@Post('alerts/:id/resolve')
@Permissions('healer.alerts.manage')
async resolveAlert(@Param('id') alertId: string) {
  await this.metricsService.resolveAlert(alertId);
  return { message: 'Alert resolved' };
}
```



### 1.3 Retry Logic & Circuit Breaker Enhancement

**Problem:** Circuit breaker is too rigid, no intelligent retry logic.

**Solution:** Exponential backoff, retry strategies, and smarter circuit breaker.

#### Database Schema Changes

```prisma
// Add to WpSite model
model WpSite {
  // ... existing fields ...
  
  // Enhanced circuit breaker
  circuitBreakerState CircuitBreakerState @default(CLOSED)
  lastCircuitBreakerOpen DateTime?
  circuitBreakerResetAt DateTime?
  consecutiveFailures Int @default(0)
  
  // Retry configuration
  retryStrategy RetryStrategy @default(EXPONENTIAL)
  maxRetries Int @default(3)
  retryDelayMs Int @default(5000) // Initial delay
}

enum CircuitBreakerState {
  CLOSED      // Normal operation
  OPEN        // Too many failures, blocking requests
  HALF_OPEN   // Testing if system recovered
}

enum RetryStrategy {
  IMMEDIATE   // Retry immediately
  LINEAR      // Fixed delay between retries
  EXPONENTIAL // Exponential backoff
  FIBONACCI   // Fibonacci backoff
}

// Add to HealerExecution model
model HealerExecution {
  // ... existing fields ...
  
  // Retry tracking
  attemptNumber Int @default(1)
  maxAttempts Int @default(3)
  retryAfter DateTime?
  retryReason String?
  previousAttemptId String?
  previousAttempt HealerExecution? @relation("RetryChain", fields: [previousAttemptId], references: [id])
  retryAttempts HealerExecution[] @relation("RetryChain")
}
```

#### New Service: RetryService

```typescript
// backend/src/modules/healer/services/retry.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CircuitBreakerState, RetryStrategy } from '@prisma/client';

interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
  attemptNumber: number;
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine if healing should be retried
   */
  async shouldRetry(
    executionId: string,
    error: Error,
  ): Promise<RetryDecision> {
    const execution = await this.prisma.healerExecution.findUnique({
      where: { id: executionId },
      include: { site: true },
    });

    if (!execution) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Execution not found',
        attemptNumber: 1,
      };
    }

    const site = execution.site;

    // Check circuit breaker
    if (site.circuitBreakerState === CircuitBreakerState.OPEN) {
      // Check if circuit breaker should transition to HALF_OPEN
      if (site.circuitBreakerResetAt && new Date() >= site.circuitBreakerResetAt) {
        await this.transitionToHalfOpen(site.id);
        return {
          shouldRetry: true,
          delayMs: 0,
          reason: 'Circuit breaker transitioned to HALF_OPEN, testing recovery',
          attemptNumber: execution.attemptNumber + 1,
        };
      }

      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Circuit breaker is OPEN',
        attemptNumber: execution.attemptNumber,
      };
    }

    // Check max attempts
    if (execution.attemptNumber >= execution.maxAttempts) {
      await this.openCircuitBreaker(site.id);
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Max attempts reached',
        attemptNumber: execution.attemptNumber,
      };
    }

    // Determine if error is retryable
    const isRetryable = this.isRetryableError(error);
    if (!isRetryable) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Error is not retryable',
        attemptNumber: execution.attemptNumber,
      };
    }

    // Calculate retry delay based on strategy
    const delayMs = this.calculateRetryDelay(
      site.retryStrategy,
      execution.attemptNumber,
      site.retryDelayMs,
    );

    return {
      shouldRetry: true,
      delayMs,
      reason: `Retrying with ${site.retryStrategy} strategy`,
      attemptNumber: execution.attemptNumber + 1,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /connection/i,
      /network/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /temporary/i,
      /rate limit/i,
    ];

    const nonRetryablePatterns = [
      /authentication/i,
      /permission denied/i,
      /not found/i,
      /invalid/i,
      /syntax error/i,
    ];

    const message = error.message.toLowerCase();

    // Check non-retryable first
    if (nonRetryablePatterns.some(pattern => pattern.test(message))) {
      return false;
    }

    // Check retryable
    return retryablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(
    strategy: RetryStrategy,
    attemptNumber: number,
    baseDelayMs: number,
  ): number {
    switch (strategy) {
      case RetryStrategy.IMMEDIATE:
        return 0;

      case RetryStrategy.LINEAR:
        return baseDelayMs * attemptNumber;

      case RetryStrategy.EXPONENTIAL:
        return baseDelayMs * Math.pow(2, attemptNumber - 1);

      case RetryStrategy.FIBONACCI:
        return baseDelayMs * this.fibonacci(attemptNumber);

      default:
        return baseDelayMs;
    }
  }

  /**
   * Calculate Fibonacci number
   */
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Open circuit breaker
   */
  private async openCircuitBreaker(siteId: string): Promise<void> {
    const resetAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.wpSite.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: CircuitBreakerState.OPEN,
        lastCircuitBreakerOpen: new Date(),
        circuitBreakerResetAt: resetAt,
      },
    });

    // Create alert
    await this.prisma.healerAlert.create({
      data: {
        alertType: 'CIRCUIT_BREAKER_OPEN',
        severity: 'ERROR',
        title: 'Circuit Breaker Opened',
        message: `Circuit breaker opened for site ${siteId}. Will reset at ${resetAt.toISOString()}`,
        siteId,
      },
    });

    this.logger.warn(`Circuit breaker opened for site ${siteId}`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen(siteId: string): Promise<void> {
    await this.prisma.wpSite.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: CircuitBreakerState.HALF_OPEN,
      },
    });

    this.logger.log(`Circuit breaker transitioned to HALF_OPEN for site ${siteId}`);
  }

  /**
   * Close circuit breaker (after successful healing)
   */
  async closeCircuitBreaker(siteId: string): Promise<void> {
    await this.prisma.wpSite.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: CircuitBreakerState.CLOSED,
        consecutiveFailures: 0,
        circuitBreakerResetAt: null,
      },
    });

    this.logger.log(`Circuit breaker closed for site ${siteId}`);
  }

  /**
   * Record failure
   */
  async recordFailure(siteId: string): Promise<void> {
    const site = await this.prisma.wpSite.findUnique({
      where: { id: siteId },
    });

    if (!site) return;

    const consecutiveFailures = site.consecutiveFailures + 1;

    await this.prisma.wpSite.update({
      where: { id: siteId },
      data: { consecutiveFailures },
    });

    // Open circuit breaker if too many failures
    if (consecutiveFailures >= site.maxHealingAttempts) {
      await this.openCircuitBreaker(siteId);
    }
  }

  /**
   * Create retry execution
   */
  async createRetryExecution(
    originalExecutionId: string,
    attemptNumber: number,
    retryReason: string,
  ): Promise<string> {
    const original = await this.prisma.healerExecution.findUnique({
      where: { id: originalExecutionId },
    });

    if (!original) {
      throw new Error('Original execution not found');
    }

    const retry = await this.prisma.healerExecution.create({
      data: {
        siteId: original.siteId,
        subdomain: original.subdomain,
        trigger: original.trigger,
        triggeredBy: original.triggeredBy,
        diagnosisType: original.diagnosisType,
        diagnosisDetails: original.diagnosisDetails,
        confidence: original.confidence,
        logsAnalyzed: original.logsAnalyzed,
        suggestedAction: original.suggestedAction,
        suggestedCommands: original.suggestedCommands,
        status: 'PENDING',
        attemptNumber,
        maxAttempts: original.maxAttempts,
        previousAttemptId: originalExecutionId,
        retryReason,
        executionLogs: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `Retry attempt ${attemptNumber} - ${retryReason}`,
          },
        ]),
      },
    });

    return retry.id;
  }
}
```

#### Update HealingProcessor

```typescript
// backend/src/modules/healer/processors/healing.processor.ts

// Add retry logic to healing job
private async handleHealingWithRetry(job: Job): Promise<void> {
  const { executionId } = job.data;

  try {
    await this.handleHealingJob(job);
    
    // Success - close circuit breaker
    const execution = await this.prisma.healerExecution.findUnique({
      where: { id: executionId },
    });
    
    if (execution) {
      await this.retryService.closeCircuitBreaker(execution.siteId);
    }
  } catch (error) {
    const err = error as Error;
    this.logger.error(`Healing failed: ${err.message}`);

    // Record failure
    const execution = await this.prisma.healerExecution.findUnique({
      where: { id: executionId },
    });
    
    if (execution) {
      await this.retryService.recordFailure(execution.siteId);

      // Check if should retry
      const retryDecision = await this.retryService.shouldRetry(executionId, err);

      if (retryDecision.shouldRetry) {
        this.logger.log(`Scheduling retry in ${retryDecision.delayMs}ms`);

        // Create retry execution
        const retryExecutionId = await this.retryService.createRetryExecution(
          executionId,
          retryDecision.attemptNumber,
          retryDecision.reason,
        );

        // Schedule retry job
        await this.healerQueue.add(
          'heal',
          {
            executionId: retryExecutionId,
            siteId: execution.siteId,
            diagnosisType: execution.diagnosisType,
          },
          {
            delay: retryDecision.delayMs,
          },
        );
      } else {
        this.logger.warn(`Not retrying: ${retryDecision.reason}`);
      }
    }

    throw error;
  }
}
```



### 1.4 Security Hardening

**Problem:** Command execution needs better validation, audit logging incomplete.

**Solution:** Enhanced command validation, comprehensive audit logging, and security controls.

#### Database Schema Changes

```prisma
// New model for audit logs
model HealerAuditLog {
  id              String   @id @default(uuid())
  
  // Actor
  userId          String?
  userEmail       String?
  ipAddress       String?
  userAgent       String?
  
  // Action
  action          AuditAction
  resource        String   // e.g., "site:abc123", "execution:def456"
  resourceType    AuditResourceType
  
  // Details
  details         String   @db.Text // JSON
  changes         String?  @db.Text // JSON: before/after
  
  // Context
  siteId          String?
  executionId     String?
  
  // Result
  success         Boolean
  errorMessage    String?
  
  // Timing
  timestamp       DateTime @default(now())
  duration        Int?     // milliseconds
  
  @@index([userId, timestamp])
  @@index([action, timestamp])
  @@index([siteId, timestamp])
  @@index([timestamp])
  @@map("healer_audit_logs")
}

enum AuditAction {
  DIAGNOSE_SITE
  APPROVE_HEALING
  EXECUTE_HEALING
  ROLLBACK_HEALING
  RESET_CIRCUIT_BREAKER
  MODIFY_SITE_CONFIG
  VIEW_EXECUTION
  ACKNOWLEDGE_ALERT
  RESOLVE_ALERT
  EXECUTE_CUSTOM_COMMAND
}

enum AuditResourceType {
  SITE
  EXECUTION
  ALERT
  PATTERN
  BACKUP
}
```

#### New Service: SecurityService

```typescript
// backend/src/modules/healer/services/security.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  // Dangerous command patterns (expanded list)
  private readonly dangerousPatterns = [
    // Destructive operations
    /rm\s+-rf\s+\//,           // rm -rf /
    /rm\s+-fr\s+\//,           // rm -fr /
    /rm\s+.*\.\.\//,           // rm with parent directory traversal
    /rm\s+.*~\//,              // rm with home directory
    /dd\s+if=/,                // dd command (disk operations)
    /mkfs/,                    // filesystem formatting
    /fdisk/,                   // disk partitioning
    
    // System control
    /shutdown/,                // system shutdown
    /reboot/,                  // system reboot
    /halt/,                    // system halt
    /poweroff/,                // power off
    /init\s+0/,                // init 0 (shutdown)
    /init\s+6/,                // init 6 (reboot)
    
    // User/permission manipulation
    /userdel/,                 // delete user
    /passwd/,                  // change password
    /chmod\s+777/,             // overly permissive permissions
    /chown\s+root/,            // change owner to root
    
    // Network attacks
    /wget.*\|\s*sh/,           // download and execute
    /curl.*\|\s*sh/,           // download and execute
    /nc\s+-l/,                 // netcat listener
    /ncat\s+-l/,               // ncat listener
    
    // Code injection
    /eval\s*\(/,               // eval() in shell
    /exec\s*\(/,               // exec() in shell
    /system\s*\(/,             // system() call
    /`.*`/,                    // backtick execution
    /\$\(.*\)/,                // command substitution
    
    // File manipulation
    />\s*\/etc\//,             // redirect to /etc
    />\s*\/var\//,             // redirect to /var
    />\s*\/usr\//,             // redirect to /usr
    />\s*\/bin\//,             // redirect to /bin
    
    // Database operations
    /DROP\s+DATABASE/i,        // drop database
    /DROP\s+TABLE/i,           // drop table
    /TRUNCATE/i,               // truncate table
    
    // Compression bombs
    /tar\s+.*bomb/,            // tar bomb
    /zip\s+.*bomb/,            // zip bomb
    
    // Fork bombs
    /:\(\)\{.*:\|:&\};:/,      // bash fork bomb
  ];

  // Safe command whitelist
  private readonly safeCommands = [
    'wp',                      // WP-CLI commands
    'ls',                      // list files
    'cat',                     // read files
    'grep',                    // search
    'tail',                    // read file tail
    'head',                    // read file head
    'find',                    // find files
    'stat',                    // file stats
    'test',                    // test conditions
    'echo',                    // print
    'pwd',                     // print working directory
    'whoami',                  // current user
    'date',                    // current date
    'df',                      // disk space
    'du',                      // disk usage
    'quota',                   // disk quota
    'mysql',                   // database client
    'php',                     // PHP CLI
    'openssl',                 // SSL operations
    'mv',                      // move/rename (with restrictions)
    'cp',                      // copy (with restrictions)
    'mkdir',                   // create directory
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate command for security
   */
  validateCommand(command: string): { safe: boolean; reason?: string } {
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason: `Command contains dangerous pattern: ${pattern.source}`,
        };
      }
    }

    // Extract base command
    const baseCommand = command.trim().split(/\s+/)[0];

    // Check if command is in whitelist
    const isWhitelisted = this.safeCommands.some(safe => 
      baseCommand === safe || baseCommand.startsWith(safe + '/')
    );

    if (!isWhitelisted) {
      return {
        safe: false,
        reason: `Command '${baseCommand}' is not in whitelist`,
      };
    }

    // Additional checks for specific commands
    if (baseCommand === 'mv' || baseCommand === 'cp') {
      // Ensure not moving/copying to system directories
      if (/\/(etc|var|usr|bin|sbin|boot|sys|proc)\//.test(command)) {
        return {
          safe: false,
          reason: 'Cannot move/copy to system directories',
        };
      }
    }

    if (baseCommand === 'mysql') {
      // Ensure no DROP/TRUNCATE commands
      if (/DROP|TRUNCATE/i.test(command)) {
        return {
          safe: false,
          reason: 'Destructive database operations not allowed',
        };
      }
    }

    return { safe: true };
  }

  /**
   * Validate multiple commands
   */
  validateCommands(commands: string[]): { safe: boolean; invalidCommands: string[] } {
    const invalidCommands: string[] = [];

    for (const command of commands) {
      // Skip comments
      if (command.trim().startsWith('#')) continue;

      const validation = this.validateCommand(command);
      if (!validation.safe) {
        invalidCommands.push(`${command} (${validation.reason})`);
      }
    }

    return {
      safe: invalidCommands.length === 0,
      invalidCommands,
    };
  }

  /**
   * Log audit event
   */
  async logAudit(params: {
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    resource: string;
    resourceType: string;
    details: any;
    changes?: any;
    siteId?: string;
    executionId?: string;
    success: boolean;
    errorMessage?: string;
    duration?: number;
  }): Promise<void> {
    try {
      await this.prisma.healerAuditLog.create({
        data: {
          userId: params.userId,
          userEmail: params.userEmail,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          action: params.action as any,
          resource: params.resource,
          resourceType: params.resourceType as any,
          details: JSON.stringify(params.details),
          changes: params.changes ? JSON.stringify(params.changes) : null,
          siteId: params.siteId,
          executionId: params.executionId,
          success: params.success,
          errorMessage: params.errorMessage,
          duration: params.duration,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${(error as Error).message}`);
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters: {
    userId?: string;
    siteId?: string;
    executionId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.executionId) where.executionId = filters.executionId;
    if (filters.action) where.action = filters.action;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.healerAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.healerAuditLog.count({ where }),
    ]);

    return {
      data: logs.map(log => ({
        ...log,
        details: JSON.parse(log.details),
        changes: log.changes ? JSON.parse(log.changes) : null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

#### Update Controllers with Audit Logging

```typescript
// backend/src/modules/healer/healer.controller.ts

// Add audit logging to all endpoints
@Post('sites/:id/diagnose')
@Permissions('healer.diagnose')
async diagnoseSite(
  @Param('id') siteId: string,
  @Query('subdomain') subdomain?: string,
  @CurrentUser() user?: any,
  @IpAddress() ipAddress?: string,
  @UserAgent() userAgent?: string,
) {
  const startTime = Date.now();
  
  try {
    const result = await this.healerService.diagnose(siteId, user?.id, subdomain);
    
    // Log successful diagnosis
    await this.securityService.logAudit({
      userId: user?.id,
      userEmail: user?.email,
      ipAddress,
      userAgent,
      action: 'DIAGNOSE_SITE',
      resource: `site:${siteId}`,
      resourceType: 'SITE',
      details: { subdomain, diagnosisType: result.diagnosis.diagnosisType },
      siteId,
      executionId: result.executionId,
      success: true,
      duration: Date.now() - startTime,
    });
    
    return result;
  } catch (error) {
    // Log failed diagnosis
    await this.securityService.logAudit({
      userId: user?.id,
      userEmail: user?.email,
      ipAddress,
      userAgent,
      action: 'DIAGNOSE_SITE',
      resource: `site:${siteId}`,
      resourceType: 'SITE',
      details: { subdomain },
      siteId,
      success: false,
      errorMessage: (error as Error).message,
      duration: Date.now() - startTime,
    });
    
    throw error;
  }
}

@Post('executions/:id/heal')
@Permissions('healer.heal')
async heal(
  @Param('id') executionId: string,
  @Body() body: HealSiteDto,
  @CurrentUser() user?: any,
  @IpAddress() ipAddress?: string,
  @UserAgent() userAgent?: string,
) {
  const startTime = Date.now();
  
  try {
    // Validate custom commands if provided
    if (body.customCommands && body.customCommands.length > 0) {
      const validation = this.securityService.validateCommands(body.customCommands);
      
      if (!validation.safe) {
        throw new Error(`Invalid commands: ${validation.invalidCommands.join(', ')}`);
      }
    }
    
    const result = await this.healerService.heal(executionId, body.customCommands);
    
    // Log successful healing approval
    await this.securityService.logAudit({
      userId: user?.id,
      userEmail: user?.email,
      ipAddress,
      userAgent,
      action: 'APPROVE_HEALING',
      resource: `execution:${executionId}`,
      resourceType: 'EXECUTION',
      details: { 
        customCommands: body.customCommands,
        hasCustomCommands: !!body.customCommands && body.customCommands.length > 0,
      },
      executionId,
      success: true,
      duration: Date.now() - startTime,
    });
    
    return result;
  } catch (error) {
    // Log failed healing approval
    await this.securityService.logAudit({
      userId: user?.id,
      userEmail: user?.email,
      ipAddress,
      userAgent,
      action: 'APPROVE_HEALING',
      resource: `execution:${executionId}`,
      resourceType: 'EXECUTION',
      details: { customCommands: body.customCommands },
      executionId,
      success: false,
      errorMessage: (error as Error).message,
      duration: Date.now() - startTime,
    });
    
    throw error;
  }
}

// Add audit log endpoint
@Get('audit-logs')
@Permissions('healer.audit.read')
async getAuditLogs(
  @Query('userId') userId?: string,
  @Query('siteId') siteId?: string,
  @Query('executionId') executionId?: string,
  @Query('action') action?: string,
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
  @Query('page') page?: string,
  @Query('limit') limit?: string,
) {
  return this.securityService.getAuditLogs({
    userId,
    siteId,
    executionId,
    action,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    page: page ? parseInt(page) : undefined,
    limit: limit ? parseInt(limit) : undefined,
  });
}
```



### 1.5 Comprehensive Testing

**Problem:** Limited test coverage, no integration or E2E tests.

**Solution:** Comprehensive test suite with unit, integration, and E2E tests.

#### Test Structure

```
backend/src/modules/healer/
├── __tests__/
│   ├── unit/
│   │   ├── diagnosis.service.spec.ts
│   │   ├── healing-orchestrator.service.spec.ts
│   │   ├── verification.service.spec.ts
│   │   ├── retry.service.spec.ts
│   │   ├── security.service.spec.ts
│   │   ├── metrics.service.spec.ts
│   │   └── pattern-learning.service.spec.ts
│   ├── integration/
│   │   ├── healer-flow.integration.spec.ts
│   │   ├── circuit-breaker.integration.spec.ts
│   │   ├── retry-logic.integration.spec.ts
│   │   └── pattern-learning.integration.spec.ts
│   └── e2e/
│       ├── diagnosis-to-healing.e2e-spec.ts
│       ├── custom-commands.e2e-spec.ts
│       └── rollback.e2e-spec.ts
```

#### Example Unit Test

```typescript
// backend/src/modules/healer/__tests__/unit/verification.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { VerificationService } from '../../services/verification.service';
import { SshExecutorService } from '../../services/ssh-executor.service';

describe('VerificationService', () => {
  let service: VerificationService;
  let sshService: jest.Mocked<SshExecutorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: SshExecutorService,
          useValue: {
            executeCommand: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    sshService = module.get(SshExecutorService);
  });

  describe('verify', () => {
    it('should return score 100 for healthy site', async () => {
      // Mock HTTP response
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => '<html><head><title>Test Site</title></head><body>Content here</body></html>',
      });

      // Mock SSH commands
      sshService.executeCommand.mockResolvedValue('No errors');

      const result = await service.verify(
        'server-id',
        '/home/user/public_html',
        'example.com',
        'WSOD',
      );

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(5);
    });

    it('should return score 0 for WSOD site', async () => {
      // Mock HTTP response with WSOD
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => 'Fatal error: Call to undefined function',
      });

      const result = await service.verify(
        'server-id',
        '/home/user/public_html',
        'example.com',
        'WSOD',
      );

      expect(result.score).toBeLessThan(50);
      expect(result.passed).toBe(false);
    });

    it('should detect blank page as WSOD', async () => {
      // Mock blank page
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => '',
      });

      const result = await service.verify(
        'server-id',
        '/home/user/public_html',
        'example.com',
        'WSOD',
      );

      expect(result.passed).toBe(false);
      expect(result.checks[0].details).toContain('Blank page');
    });
  });
});
```

#### Example Integration Test

```typescript
// backend/src/modules/healer/__tests__/integration/healer-flow.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';

describe('Healer Flow (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testSiteId: string;
  let testExecutionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test site
    const testSite = await prisma.wpSite.create({
      data: {
        domain: 'test-integration.example.com',
        path: '/home/test/public_html',
        serverId: 'test-server-id',
        isHealerEnabled: true,
      },
    });
    testSiteId = testSite.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.healerExecution.deleteMany({ where: { siteId: testSiteId } });
    await prisma.wpSite.delete({ where: { id: testSiteId } });
    await app.close();
  });

  it('should complete full diagnosis-to-healing flow', async () => {
    // Step 1: Diagnose
    const diagnoseResponse = await request(app.getHttpServer())
      .post(`/api/v1/healer/sites/${testSiteId}/diagnose`)
      .expect(201);

    expect(diagnoseResponse.body).toHaveProperty('executionId');
    expect(diagnoseResponse.body).toHaveProperty('diagnosis');
    testExecutionId = diagnoseResponse.body.executionId;

    // Step 2: Verify execution created
    const execution = await prisma.healerExecution.findUnique({
      where: { id: testExecutionId },
    });
    expect(execution).toBeDefined();
    expect(execution?.status).toBe('DIAGNOSED');

    // Step 3: Approve healing
    const healResponse = await request(app.getHttpServer())
      .post(`/api/v1/healer/executions/${testExecutionId}/heal`)
      .send({ customCommands: [] })
      .expect(201);

    expect(healResponse.body).toHaveProperty('jobId');

    // Step 4: Wait for healing to complete (poll status)
    let healingComplete = false;
    let attempts = 0;
    while (!healingComplete && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/v1/healer/executions/${testExecutionId}`)
        .expect(200);

      if (['SUCCESS', 'FAILED'].includes(statusResponse.body.status)) {
        healingComplete = true;
      }
      attempts++;
    }

    expect(healingComplete).toBe(true);
  });

  it('should handle circuit breaker correctly', async () => {
    // Trigger multiple failures to open circuit breaker
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/api/v1/healer/sites/${testSiteId}/diagnose`)
        .expect(201);
    }

    // Next diagnosis should fail due to circuit breaker
    const response = await request(app.getHttpServer())
      .post(`/api/v1/healer/sites/${testSiteId}/diagnose`)
      .expect(400);

    expect(response.body.message).toContain('Circuit breaker');
  });
});
```

#### Test Coverage Goals

- **Unit Tests:** >85% coverage
  - All services
  - All utility functions
  - All validation logic

- **Integration Tests:** >70% coverage
  - Full diagnosis-to-healing flow
  - Circuit breaker behavior
  - Retry logic
  - Pattern learning
  - Verification system

- **E2E Tests:** Critical user journeys
  - Diagnose → Heal → Verify → Success
  - Diagnose → Heal → Verify → Fail → Rollback
  - Custom commands execution
  - Circuit breaker reset

---

## Phase 2: Intelligence Layer (Weeks 5-8)

### Priority: P1 (Should-Have)
### Goal: Add AI-powered intelligence for root cause analysis and predictive maintenance

### 2.1 AI-Powered Root Cause Analysis

**Problem:** Current diagnosis relies on pattern matching, limited intelligence.

**Solution:** Integrate OpenAI GPT-4 for intelligent root cause analysis.

#### Database Schema Changes

```prisma
// Add to HealerExecution model
model HealerExecution {
  // ... existing fields ...
  
  // AI Analysis
  aiAnalysis          String?  @db.Text // JSON with AI insights
  aiConfidence        Float?   // 0.0-1.0
  aiRecommendations   String?  @db.Text // JSON array
  aiReasoning         String?  @db.Text // Explanation
  aiModel             String?  // e.g., "gpt-4"
  aiTokensUsed        Int?
}

// New model for AI analysis cache
model AiAnalysisCache {
  id              String   @id @default(uuid())
  
  // Input hash (for deduplication)
  inputHash       String   @unique
  
  // Input data
  diagnosisType   DiagnosisType
  errorSignature  String   @db.Text // Normalized error signature
  logSample       String   @db.Text // Sample of logs
  
  // AI response
  analysis        String   @db.Text // JSON
  confidence      Float
  recommendations String   @db.Text // JSON array
  reasoning       String   @db.Text
  
  // Metadata
  model           String
  tokensUsed      Int
  responseTime    Int      // milliseconds
  
  // Usage tracking
  hitCount        Int      @default(1)
  lastUsedAt      DateTime @default(now())
  
  createdAt       DateTime @default(now())
  expiresAt       DateTime // Cache for 30 days
  
  @@index([inputHash])
  @@index([diagnosisType])
  @@index([expiresAt])
  @@map("ai_analysis_cache")
}
```

#### New Service: AiAnalysisService

```typescript
// backend/src/modules/healer/services/ai-analysis.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiagnosisType } from '@prisma/client';
import * as crypto from 'crypto';

interface AiAnalysisResult {
  rootCause: string;
  confidence: number;
  recommendations: string[];
  reasoning: string;
  suggestedCommands: string[];
  model: string;
  tokensUsed: number;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private readonly openaiApiKey: string;
  private readonly openaiModel = 'gpt-4-turbo-preview';

  constructor(private readonly prisma: PrismaService) {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY not set - AI analysis will be disabled');
    }
  }

  /**
   * Analyze diagnosis with AI
   */
  async analyze(
    diagnosisType: DiagnosisType,
    diagnosisDetails: any,
    logsAnalyzed: any[],
    commandOutputs: any[],
  ): Promise<AiAnalysisResult | null> {
    if (!this.openaiApiKey) {
      this.logger.warn('AI analysis skipped - API key not configured');
      return null;
    }

    try {
      // Create input hash for caching
      const inputHash = this.createInputHash(diagnosisType, diagnosisDetails, logsAnalyzed);

      // Check cache first
      const cached = await this.getCachedAnalysis(inputHash);
      if (cached) {
        this.logger.log('Using cached AI analysis');
        return cached;
      }

      // Prepare context for AI
      const context = this.prepareContext(diagnosisType, diagnosisDetails, logsAnalyzed, commandOutputs);

      // Call OpenAI API
      const startTime = Date.now();
      const response = await this.callOpenAI(context);
      const responseTime = Date.now() - startTime;

      // Parse response
      const analysis = this.parseAiResponse(response);

      // Cache result
      await this.cacheAnalysis(inputHash, diagnosisType, analysis, responseTime);

      this.logger.log(`AI analysis completed in ${responseTime}ms`);

      return analysis;
    } catch (error) {
      this.logger.error(`AI analysis failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Create input hash for caching
   */
  private createInputHash(
    diagnosisType: DiagnosisType,
    diagnosisDetails: any,
    logsAnalyzed: any[],
  ): string {
    const input = JSON.stringify({
      diagnosisType,
      errorType: diagnosisDetails.errorType,
      errorMessage: diagnosisDetails.errorMessage,
      culprit: diagnosisDetails.culprit,
      // Include normalized log samples (first 1000 chars of each)
      logSamples: logsAnalyzed.map(log => 
        JSON.stringify(log.errors).substring(0, 1000)
      ),
    });

    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get cached analysis
   */
  private async getCachedAnalysis(inputHash: string): Promise<AiAnalysisResult | null> {
    try {
      const cached = await this.prisma.aiAnalysisCache.findUnique({
        where: { inputHash },
      });

      if (!cached) return null;

      // Check if expired
      if (new Date() > cached.expiresAt) {
        await this.prisma.aiAnalysisCache.delete({ where: { id: cached.id } });
        return null;
      }

      // Update hit count and last used
      await this.prisma.aiAnalysisCache.update({
        where: { id: cached.id },
        data: {
          hitCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      const analysis = JSON.parse(cached.analysis);

      return {
        rootCause: analysis.rootCause,
        confidence: cached.confidence,
        recommendations: JSON.parse(cached.recommendations),
        reasoning: cached.reasoning,
        suggestedCommands: analysis.suggestedCommands || [],
        model: cached.model,
        tokensUsed: cached.tokensUsed,
      };
    } catch (error) {
      this.logger.error(`Failed to get cached analysis: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Prepare context for AI
   */
  private prepareContext(
    diagnosisType: DiagnosisType,
    diagnosisDetails: any,
    logsAnalyzed: any[],
    commandOutputs: any[],
  ): string {
    const context = {
      diagnosisType,
      details: diagnosisDetails,
      logs: logsAnalyzed.map(log => ({
        path: log.logPath,
        errorCount: log.errors.length,
        sampleErrors: log.errors.slice(0, 5), // First 5 errors
      })),
      checks: commandOutputs.map(output => ({
        command: output.command,
        success: output.success,
        output: output.output.substring(0, 500), // First 500 chars
      })),
    };

    return JSON.stringify(context, null, 2);
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(context: string): Promise<any> {
    const systemPrompt = `You are an expert WordPress site reliability engineer specializing in diagnosing and fixing WordPress issues.

Your task is to analyze the provided diagnosis data and provide:
1. Root cause analysis (what is the actual problem)
2. Confidence level (0.0-1.0)
3. Specific recommendations (actionable steps)
4. Reasoning (why you think this is the issue)
5. Suggested WP-CLI or shell commands to fix the issue

Be specific and actionable. Focus on the most likely root cause based on the evidence.

Respond in JSON format:
{
  "rootCause": "string",
  "confidence": 0.0-1.0,
  "recommendations": ["string"],
  "reasoning": "string",
  "suggestedCommands": ["string"]
}`;

    const userPrompt = `Analyze this WordPress site diagnosis:

${context}

Provide your analysis in JSON format.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Parse AI response
   */
  private parseAiResponse(response: any): AiAnalysisResult {
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      rootCause: parsed.rootCause || 'Unknown',
      confidence: parsed.confidence || 0.5,
      recommendations: parsed.recommendations || [],
      reasoning: parsed.reasoning || '',
      suggestedCommands: parsed.suggestedCommands || [],
      model: response.model,
      tokensUsed: response.usage.total_tokens,
    };
  }

  /**
   * Cache analysis result
   */
  private async cacheAnalysis(
    inputHash: string,
    diagnosisType: DiagnosisType,
    analysis: AiAnalysisResult,
    responseTime: number,
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await this.prisma.aiAnalysisCache.create({
        data: {
          inputHash,
          diagnosisType,
          errorSignature: analysis.rootCause,
          logSample: '', // Could store sample if needed
          analysis: JSON.stringify({
            rootCause: analysis.rootCause,
            suggestedCommands: analysis.suggestedCommands,
          }),
          confidence: analysis.confidence,
          recommendations: JSON.stringify(analysis.recommendations),
          reasoning: analysis.reasoning,
          model: analysis.model,
          tokensUsed: analysis.tokensUsed,
          responseTime,
          expiresAt,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to cache analysis: ${(error as Error).message}`);
    }
  }

  /**
   * Clean expired cache entries (run daily)
   */
  async cleanExpiredCache(): Promise<void> {
    try {
      const result = await this.prisma.aiAnalysisCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Cleaned ${result.count} expired AI analysis cache entries`);
    } catch (error) {
      this.logger.error(`Failed to clean cache: ${(error as Error).message}`);
    }
  }
}
```

#### Update DiagnosisService

```typescript
// backend/src/modules/healer/services/diagnosis.service.ts

// Add AI analysis after diagnosis
async diagnose(
  serverId: string,
  sitePath: string,
  domain: string,
): Promise<DiagnosisResult> {
  // ... existing diagnosis logic ...

  const diagnosis = await this.aggregateAndDiagnose(
    logResults,
    httpStatus,
    serverId,
    sitePath,
    commandOutputs,
  );

  // Add AI analysis if available
  if (diagnosis.diagnosisType !== DiagnosisType.HEALTHY) {
    const aiAnalysis = await this.aiAnalysisService.analyze(
      diagnosis.diagnosisType,
      diagnosis.details,
      logResults,
      commandOutputs,
    );

    if (aiAnalysis) {
      // Enhance diagnosis with AI insights
      diagnosis.details.aiRootCause = aiAnalysis.rootCause;
      diagnosis.details.aiConfidence = aiAnalysis.confidence;
      diagnosis.details.aiRecommendations = aiAnalysis.recommendations;
      diagnosis.details.aiReasoning = aiAnalysis.reasoning;

      // Use AI suggested commands if confidence is high
      if (aiAnalysis.confidence > 0.8 && aiAnalysis.suggestedCommands.length > 0) {
        diagnosis.suggestedCommands = aiAnalysis.suggestedCommands;
        diagnosis.suggestedAction = aiAnalysis.rootCause;
      }
    }
  }

  return diagnosis;
}
```

