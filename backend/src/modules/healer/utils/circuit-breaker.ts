/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests to failing services
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  monitoringPeriod?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime: Date | null = null;
  private nextAttemptTime: Date | null = null;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly monitoringPeriod: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN state');
      } else {
        const error = new Error('Circuit breaker is OPEN');
        if (fallback) {
          console.log('[CircuitBreaker] Using fallback due to OPEN circuit');
          return fallback();
        }
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        console.log('[CircuitBreaker] Using fallback after failure');
        return fallback();
      }
      
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.successThreshold) {
        console.log('[CircuitBreaker] Transitioning to CLOSED state after successful recovery');
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.successes = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      console.log('[CircuitBreaker] Transitioning to OPEN state after failure in HALF_OPEN');
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.timeout);
    } else if (this.failures >= this.failureThreshold) {
      console.log(`[CircuitBreaker] Transitioning to OPEN state after ${this.failures} failures`);
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.timeout);
    }
  }

  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return false;
    }

    return Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: Date | null;
    nextAttemptTime: Date | null;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    console.log('[CircuitBreaker] Manual reset');
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    console.log('[CircuitBreaker] Forced to OPEN state');
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.timeout);
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers by key
 */
export class CircuitBreakerManager {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for key
   */
  static getBreaker(key: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(key)) {
      this.breakers.set(key, new CircuitBreaker(options));
    }
    return this.breakers.get(key)!;
  }

  /**
   * Execute with circuit breaker by key
   */
  static async execute<T>(
    key: string,
    fn: () => Promise<T>,
    fallback?: () => T,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    const breaker = this.getBreaker(key, options);
    return breaker.execute(fn, fallback);
  }

  /**
   * Get all circuit breaker statistics
   */
  static getAllStats(): Map<string, any> {
    const stats = new Map();
    this.breakers.forEach((breaker, key) => {
      stats.set(key, breaker.getStats());
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Clear all circuit breakers
   */
  static clear(): void {
    this.breakers.clear();
  }
}
