import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

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
    const execution = await this.prisma.healer_executions.findUnique({
      where: { id: executionId },
      include: { wp_sites: true },
    });

    if (!execution) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Execution not found',
        attemptNumber: 1,
      };
    }

    const site = execution.wp_sites;

    // Check circuit breaker
    if (site.circuitBreakerState === 'OPEN') {
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
    strategy: string,
    attemptNumber: number,
    baseDelayMs: number,
  ): number {
    switch (strategy) {
      case 'IMMEDIATE':
        return 0;

      case 'LINEAR':
        return baseDelayMs * attemptNumber;

      case 'EXPONENTIAL':
        return baseDelayMs * Math.pow(2, attemptNumber - 1);

      case 'FIBONACCI':
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

    await this.prisma.wp_sites.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: 'OPEN',
        lastCircuitBreakerOpen: new Date(),
        circuitBreakerResetAt: resetAt,
      },
    });

    // Create alert
    await this.prisma.$executeRaw`
      INSERT INTO healer_alerts (
        id, alert_type, severity, title, message, site_id, status, created_at
      ) VALUES (
        gen_random_uuid(), 'CIRCUIT_BREAKER_OPEN', 'ERROR',
        'Circuit Breaker Opened',
        ${`Circuit breaker opened for site ${siteId}. Will reset at ${resetAt.toISOString()}`},
        ${siteId}, 'ACTIVE', NOW()
      )
    `;

    this.logger.warn(`Circuit breaker opened for site ${siteId}`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen(siteId: string): Promise<void> {
    await this.prisma.wp_sites.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: 'HALF_OPEN',
      },
    });

    this.logger.log(`Circuit breaker transitioned to HALF_OPEN for site ${siteId}`);
  }

  /**
   * Close circuit breaker (after successful healing)
   */
  async closeCircuitBreaker(siteId: string): Promise<void> {
    await this.prisma.wp_sites.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: 'CLOSED',
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
    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
    });

    if (!site) return;

    const consecutiveFailures = site.consecutiveFailures + 1;

    await this.prisma.wp_sites.update({
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
    const original = await this.prisma.healer_executions.findUnique({
      where: { id: originalExecutionId },
    });

    if (!original) {
      throw new Error('Original execution not found');
    }

    const retry = await this.prisma.healer_executions.create({
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

  /**
   * Reset circuit breaker manually
   */
  async resetCircuitBreaker(siteId: string): Promise<void> {
    await this.prisma.wp_sites.update({
      where: { id: siteId },
      data: {
        circuitBreakerState: 'CLOSED',
        consecutiveFailures: 0,
        circuitBreakerResetAt: null,
        healingAttempts: 0,
      },
    });

    this.logger.log(`Circuit breaker manually reset for site ${siteId}`);
  }
}
