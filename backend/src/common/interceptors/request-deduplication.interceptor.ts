import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, defer, from, of } from 'rxjs';
import { shareReplay, tap, catchError } from 'rxjs/operators';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class RequestDeduplicationInterceptor implements NestInterceptor {
  private inFlightRequests = new Map<string, Observable<any>>();

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Generate cache key based on URL, query params, and user role
    const cacheKey = this.generateCacheKey(
      request.url,
      request.query,
      user?.role || 'anonymous',
    );

    // Check if request is already in-flight
    if (this.inFlightRequests.has(cacheKey)) {
      console.log(`[Dedup] Reusing in-flight request: ${cacheKey}`);
      return this.inFlightRequests.get(cacheKey)!;
    }

    // Check cache first
    return defer(async () => {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log(`[Dedup] Cache hit: ${cacheKey}`);
        return of(cached);
      }

      // Execute request and cache result
      const observable = next.handle().pipe(
        tap(async (data) => {
          // Cache for 5 seconds
          await this.cacheManager.set(cacheKey, data, 5000);
        }),
        catchError((error) => {
          // Remove from in-flight on error
          this.inFlightRequests.delete(cacheKey);
          throw error;
        }),
        shareReplay(1), // Share result with concurrent requests
      );

      // Store in-flight request
      this.inFlightRequests.set(cacheKey, observable);

      // Clean up after completion
      observable.subscribe({
        complete: () => {
          setTimeout(() => {
            this.inFlightRequests.delete(cacheKey);
          }, 100);
        },
        error: () => {
          this.inFlightRequests.delete(cacheKey);
        },
      });

      return observable;
    }).pipe(shareReplay(1)) as Observable<any>;
  }

  /**
   * Generate a unique cache key for the request
   */
  private generateCacheKey(
    url: string,
    query: any,
    role: string,
  ): string {
    const data = `${url}:${JSON.stringify(query)}:${role}`;
    return `dedup:${createHash('md5').update(data).digest('hex')}`;
  }
}
