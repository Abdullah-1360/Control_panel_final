import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RateLimitExceededException } from '../exceptions/server.exceptions';

/**
 * Custom throttler guard for connection tests
 * Limits: 10 tests per minute per user
 */
@Injectable()
export class ConnectionTestThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new RateLimitExceededException(60); // Retry after 60 seconds
  }
}
