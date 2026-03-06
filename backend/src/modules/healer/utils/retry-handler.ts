/**
 * Retry Handler Utility
 * Implements retry logic with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export class RetryHandler {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH'],
  };

  /**
   * Execute function with retry logic
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error as Error, opts.retryableErrors)) {
          throw error;
        }

        // Don't wait after last attempt
        if (attempt === opts.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
          opts.maxDelay
        );

        console.log(`Retry attempt ${attempt}/${opts.maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorCode = (error as any).code;
    const errorMessage = error.message.toLowerCase();

    // Check error code
    if (errorCode && retryableErrors.includes(errorCode)) {
      return true;
    }

    // Check error message for common transient errors
    const transientKeywords = ['timeout', 'connection', 'network', 'temporary'];
    return transientKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with timeout
   */
  static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }

  /**
   * Execute with both retry and timeout
   */
  static async executeWithRetryAndTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    retryOptions: RetryOptions = {}
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.executeWithTimeout(fn, timeoutMs),
      retryOptions
    );
  }
}
