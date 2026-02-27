/**
 * Circuit Breaker Service
 * 
 * Implements circuit breaker pattern to prevent infinite healing loops
 * 
 * States:
 * - CLOSED: Normal operation, healing allowed
 * - OPEN: Too many failures, healing blocked (cooldown period)
 * - HALF_OPEN: Testing if system recovered, allow one healing attempt
 * 
 * Transitions:
 * - CLOSED → OPEN: After max consecutive failures
 * - OPEN → HALF_OPEN: After cooldown period
 * - HALF_OPEN → CLOSED: On successful healing
 * - HALF_OPEN → OPEN: On failed healing
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../stubs/prisma.service.stub';
import { CircuitBreakerState } from '@prisma/client';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  // Default cooldown period: 1 hour (in milliseconds)
  private readonly DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;
  
  // Default max consecutive failures before opening circuit
  private readonly DEFAULT_MAX_FAILURES = 3;
  
  constructor(private readonly prisma: PrismaService) {}
  
  /**
   * Check if healing is allowed for an application
   * Returns true if circuit is CLOSED or HALF_OPEN
   * Returns false if circuit is OPEN (and not ready to reset)
   */
  async canHeal(applicationId: string): Promise<{
    allowed: boolean;
    state: CircuitBreakerState;
    reason?: string;
  }> {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      select: {
        circuitBreakerState: true,
        circuitBreakerResetAt: true,
        consecutiveFailures: true,
        maxRetries: true,
      },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const state = application.circuitBreakerState;
    
    // CLOSED: Normal operation, healing allowed
    if (state === CircuitBreakerState.CLOSED) {
      return { allowed: true, state };
    }
    
    // HALF_OPEN: Testing recovery, healing allowed (one attempt)
    if (state === CircuitBreakerState.HALF_OPEN) {
      this.logger.log(`Circuit breaker in HALF_OPEN state for application ${applicationId}, allowing test healing`);
      return { allowed: true, state };
    }
    
    // OPEN: Check if cooldown period has passed
    if (state === CircuitBreakerState.OPEN) {
      const resetAt = application.circuitBreakerResetAt;
      
      if (!resetAt) {
        // No reset time set, should not happen, but allow healing
        this.logger.warn(`Circuit breaker OPEN but no reset time set for application ${applicationId}`);
        return { allowed: true, state };
      }
      
      const now = new Date();
      
      if (now >= resetAt) {
        // Cooldown period passed, transition to HALF_OPEN
        await this.transitionToHalfOpen(applicationId);
        return {
          allowed: true,
          state: CircuitBreakerState.HALF_OPEN,
        };
      }
      
      // Still in cooldown period
      const remainingMs = resetAt.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      this.logger.warn(
        `Circuit breaker OPEN for application ${applicationId}, ` +
        `cooldown remaining: ${remainingMinutes} minutes`,
      );
      
      return {
        allowed: false,
        state,
        reason: `Circuit breaker is open. Too many consecutive failures (${application.consecutiveFailures}). ` +
                `Healing will be available in ${remainingMinutes} minutes.`,
      };
    }
    
    // Unknown state, allow healing but log warning
    this.logger.warn(`Unknown circuit breaker state: ${state} for application ${applicationId}`);
    return { allowed: true, state };
  }
  
  /**
   * Record a successful healing execution
   * Resets consecutive failures and closes circuit if in HALF_OPEN state
   */
  async recordSuccess(applicationId: string): Promise<void> {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      select: { circuitBreakerState: true },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const state = application.circuitBreakerState;
    
    this.logger.log(`Recording successful healing for application ${applicationId} (state: ${state})`);
    
    // Reset consecutive failures
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        consecutiveFailures: 0,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        circuitBreakerResetAt: null,
      },
    });
    
    if (state === CircuitBreakerState.HALF_OPEN) {
      this.logger.log(`Circuit breaker transitioned from HALF_OPEN to CLOSED for application ${applicationId}`);
    }
  }
  
  /**
   * Record a failed healing execution
   * Increments consecutive failures and opens circuit if threshold exceeded
   */
  async recordFailure(applicationId: string): Promise<void> {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      select: {
        circuitBreakerState: true,
        consecutiveFailures: true,
        maxRetries: true,
      },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const state = application.circuitBreakerState;
    const failures = application.consecutiveFailures + 1;
    const maxFailures = application.maxRetries || this.DEFAULT_MAX_FAILURES;
    
    this.logger.warn(
      `Recording failed healing for application ${applicationId} ` +
      `(failures: ${failures}/${maxFailures}, state: ${state})`,
    );
    
    // If in HALF_OPEN state and failed, go back to OPEN
    if (state === CircuitBreakerState.HALF_OPEN) {
      await this.transitionToOpen(applicationId, failures);
      this.logger.warn(`Circuit breaker transitioned from HALF_OPEN to OPEN for application ${applicationId}`);
      return;
    }
    
    // Check if we've exceeded max failures
    if (failures >= maxFailures) {
      await this.transitionToOpen(applicationId, failures);
      this.logger.error(
        `Circuit breaker OPENED for application ${applicationId} ` +
        `after ${failures} consecutive failures`,
      );
    } else {
      // Just increment failure count
      await this.prisma.applications.update({
        where: { id: applicationId },
        data: { consecutiveFailures: failures },
      });
    }
  }
  
  /**
   * Transition circuit breaker to OPEN state
   * Sets cooldown period and records failure time
   */
  private async transitionToOpen(applicationId: string, failures: number): Promise<void> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.DEFAULT_COOLDOWN_MS);
    
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        circuitBreakerState: CircuitBreakerState.OPEN,
        consecutiveFailures: failures,
        lastCircuitBreakerOpen: now,
        circuitBreakerResetAt: resetAt,
      },
    });
    
    this.logger.warn(
      `Circuit breaker OPENED for application ${applicationId}. ` +
      `Will reset at ${resetAt.toISOString()}`,
    );
  }
  
  /**
   * Transition circuit breaker to HALF_OPEN state
   * Allows one healing attempt to test if system recovered
   */
  private async transitionToHalfOpen(applicationId: string): Promise<void> {
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        circuitBreakerState: CircuitBreakerState.HALF_OPEN,
        circuitBreakerResetAt: null,
      },
    });
    
    this.logger.log(`Circuit breaker transitioned to HALF_OPEN for application ${applicationId}`);
  }
  
  /**
   * Manually reset circuit breaker to CLOSED state
   * Used by admin to force reset after fixing underlying issues
   */
  async manualReset(applicationId: string): Promise<void> {
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        circuitBreakerState: CircuitBreakerState.CLOSED,
        consecutiveFailures: 0,
        circuitBreakerResetAt: null,
      },
    });
    
    this.logger.log(`Circuit breaker manually reset to CLOSED for application ${applicationId}`);
  }
  
  /**
   * Get circuit breaker status for an application
   */
  async getStatus(applicationId: string): Promise<{
    state: CircuitBreakerState;
    consecutiveFailures: number;
    maxRetries: number;
    resetAt: Date | null;
    canHeal: boolean;
  }> {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      select: {
        circuitBreakerState: true,
        consecutiveFailures: true,
        maxRetries: true,
        circuitBreakerResetAt: true,
      },
    });
    
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    
    const canHealResult = await this.canHeal(applicationId);
    
    return {
      state: application.circuitBreakerState,
      consecutiveFailures: application.consecutiveFailures,
      maxRetries: application.maxRetries || this.DEFAULT_MAX_FAILURES,
      resetAt: application.circuitBreakerResetAt,
      canHeal: canHealResult.allowed,
    };
  }
}
