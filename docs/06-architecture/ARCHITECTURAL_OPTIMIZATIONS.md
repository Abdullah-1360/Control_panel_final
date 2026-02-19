# Architectural Optimizations - Real-Time & Scalability

**Date:** February 11, 2026  
**Priority:** P0 (Critical for Production Scalability)  
**Status:** Design Complete - Ready for Implementation

---

## Executive Summary

The current polling-based real-time update strategy will not scale in a production NOC environment. This document outlines critical architectural optimizations to handle 1000+ concurrent users without overwhelming the backend.

**Key Problems Identified:**
1. **Polling Overhead:** 1000 users × 5s polling = 200 req/s just for incidents (2000+ req/s total)
2. **Thundering Herd:** 50 users loading dashboard simultaneously = 50 identical database queries
3. **High Latency:** 5-30 second delays unacceptable during outages
4. **Database Hammering:** Identical queries executed repeatedly with no changes

**Solutions:**
1. **Server-Sent Events (SSE)** for real-time updates (92% request reduction)
2. **Request Deduplication** for expensive queries (98% reduction during spikes)
3. **Polling as Fallback** for reliability

---

## Problem 1: The "Real-Time" Trap

### Current State (Polling)

**Module 9 (Admin Panel) - Current Implementation:**
```typescript
// Incident list polling every 5 seconds
const { data: incidents } = useQuery({
  queryKey: ['incidents'],
  queryFn: fetchIncidents,
  refetchInterval: 5000 // ❌ PROBLEM
});

// Dashboard widgets polling every 30 seconds
const { data: stats } = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: fetchDashboardStats,
  refetchInterval: 30000 // ❌ PROBLEM
});
```

**Scalability Analysis:**
```
1000 concurrent users:
- Incidents: 1000 users × (1 req / 5s) = 200 req/s
- Dashboard: 1000 users × (1 req / 30s) = 33 req/s
- Server stats: 1000 users × (1 req / 30s) = 33 req/s
- Logs: 1000 users × (1 req / 2s) = 500 req/s
- Automation: 1000 users × (1 req / 5s) = 200 req/s

TOTAL: ~1000 requests/second
Database queries: ~1000/second (most returning "no changes")
Network bandwidth: Wasted on redundant responses
Latency: 5-30 seconds (unacceptable during outages)
```

### Why This Fails in Production

**NOC Environment Reality:**
- During a P0 outage, 5 seconds feels like an eternity
- Engineers need instant updates on incident status changes
- Polling creates artificial delays in critical information flow
- Database gets hammered with identical queries returning no changes
- Network bandwidth wasted on "304 Not Modified" responses

---

## Solution 1: Server-Sent Events (SSE)

### Why SSE Over WebSocket?

**SSE Advantages:**
- ✅ Unidirectional (server→client) - perfect for our use case
- ✅ Built on HTTP - works through proxies/firewalls
- ✅ Auto-reconnection built into browser EventSource API
- ✅ Simpler to implement and maintain
- ✅ Lower overhead than WebSocket
- ✅ No special proxy configuration needed

**WebSocket Disadvantages:**
- ❌ Bi-directional (overkill - we don't need client→server messaging)
- ❌ Stateful connections harder to scale horizontally
- ❌ Requires special proxy/load balancer configuration
- ❌ More complex to implement
- ❌ Higher memory overhead per connection

**Decision:** Use SSE with polling as fallback.

---

## SSE Architecture Design

### Backend Implementation (NestJS)

#### 1. Event Bus (Central Event Emitter)

```typescript
// backend/src/common/events/event-bus.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum SystemEvent {
  INCIDENT_CREATED = 'incident.created',
  INCIDENT_UPDATED = 'incident.updated',
  INCIDENT_STATUS_CHANGED = 'incident.status.changed',
  LOG_ADDED = 'log.added',
  SERVER_STATUS_CHANGED = 'server.status.changed',
  AUTOMATION_STARTED = 'automation.started',
  AUTOMATION_COMPLETED = 'automation.completed',
  NOTIFICATION_SENT = 'notification.sent'
}

export interface SystemEventPayload {
  type: SystemEvent;
  data: any;
  timestamp: Date;
  userId?: string; // For user-specific events
  permissions?: string[]; // For RBAC filtering
}

@Injectable()
export class EventBusService {
  constructor(private eventEmitter: EventEmitter2) {}

  emit(event: SystemEventPayload): void {
    this.eventEmitter.emit(event.type, event);
  }

  on(event: SystemEvent, handler: (payload: SystemEventPayload) => void): void {
    this.eventEmitter.on(event, handler);
  }
}
```

#### 2. Event Stream Controller

```typescript
// backend/src/common/events/event-stream.controller.ts
import { Controller, Sse, UseGuards, Req } from '@nestjs/common';
import { Observable, fromEvent, merge } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EventBusService, SystemEvent } from './event-bus.service';

interface MessageEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventStreamController {
  constructor(private eventBus: EventBusService) {}

  @Sse('stream')
  stream(@Req() req): Observable<MessageEvent> {
    const user = req.user;
    
    // Create observables for each event type
    const incidentEvents$ = fromEvent(
      this.eventBus.eventEmitter,
      SystemEvent.INCIDENT_CREATED
    );
    
    const statusEvents$ = fromEvent(
      this.eventBus.eventEmitter,
      SystemEvent.INCIDENT_STATUS_CHANGED
    );
    
    const logEvents$ = fromEvent(
      this.eventBus.eventEmitter,
      SystemEvent.LOG_ADDED
    );
    
    const automationEvents$ = fromEvent(
      this.eventBus.eventEmitter,
      SystemEvent.AUTOMATION_COMPLETED
    );
    
    // Merge all event streams
    return merge(
      incidentEvents$,
      statusEvents$,
      logEvents$,
      automationEvents$
    ).pipe(
      // Filter by user permissions
      filter((event: any) => this.hasPermission(user, event)),
      // Transform to SSE format
      map((event: any) => ({
        data: JSON.stringify(event),
        id: event.id || Date.now().toString(),
        type: event.type,
        retry: 10000 // Retry after 10s if connection drops
      }))
    );
  }

  private hasPermission(user: any, event: any): boolean {
    // RBAC filtering
    if (!event.permissions || event.permissions.length === 0) {
      return true; // Public event
    }
    
    return event.permissions.some(permission => 
      user.permissions.includes(permission)
    );
  }
}
```

#### 3. Module Integration (Example: Incident Service)

```typescript
// backend/src/modules/incidents/incident.service.ts
import { Injectable } from '@nestjs/common';
import { EventBusService, SystemEvent } from '../../common/events/event-bus.service';

@Injectable()
export class IncidentService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService
  ) {}

  async createIncident(dto: CreateIncidentDto): Promise<Incident> {
    const incident = await this.prisma.incident.create({
      data: dto
    });

    // Emit event for SSE
    this.eventBus.emit({
      type: SystemEvent.INCIDENT_CREATED,
      data: incident,
      timestamp: new Date(),
      permissions: ['incidents.read']
    });

    return incident;
  }

  async updateStatus(id: string, status: IncidentStatus): Promise<Incident> {
    const incident = await this.prisma.incident.update({
      where: { id },
      data: { status }
    });

    // Emit event for SSE
    this.eventBus.emit({
      type: SystemEvent.INCIDENT_STATUS_CHANGED,
      data: { id, status, incident },
      timestamp: new Date(),
      permissions: ['incidents.read']
    });

    return incident;
  }
}
```

### Frontend Implementation (Next.js)

#### 1. SSE Hook

```typescript
// frontend/src/hooks/useSSE.ts
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseSSEOptions {
  url: string;
  onEvent?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export function useSSE({ url, onEvent, onError, enabled = true }: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const connect = () => {
      try {
        const token = localStorage.getItem('accessToken');
        const eventSource = new EventSource(`${url}?token=${token}`);

        eventSource.onopen = () => {
          console.log('SSE connected');
          setIsConnected(true);
          setReconnectAttempts(0);
        };

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          // Update React Query cache based on event type
          handleEvent(data, queryClient);
          
          // Call custom handler
          onEvent?.(event);
        };

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          setIsConnected(false);
          eventSource.close();
          
          // Exponential backoff reconnection
          const attempts = reconnectAttempts + 1;
          setReconnectAttempts(attempts);
          
          if (attempts < 3) {
            const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            setTimeout(connect, delay);
          } else {
            console.log('Max reconnection attempts reached. Falling back to polling.');
            onError?.(error);
          }
        };

        eventSourceRef.current = eventSource;
      } catch (error) {
        console.error('Failed to create EventSource:', error);
        onError?.(error as Event);
      }
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [url, enabled, reconnectAttempts]);

  return { isConnected, reconnectAttempts };
}

function handleEvent(event: any, queryClient: any) {
  switch (event.type) {
    case 'incident.created':
      // Invalidate incidents list
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      // Optimistically add to cache
      queryClient.setQueryData(['incidents'], (old: any) => ({
        ...old,
        incidents: [event.data, ...(old?.incidents || [])]
      }));
      break;

    case 'incident.status.changed':
      // Update specific incident in cache
      queryClient.setQueryData(['incident', event.data.id], event.data.incident);
      // Update in list
      queryClient.setQueryData(['incidents'], (old: any) => ({
        ...old,
        incidents: old?.incidents?.map((inc: any) =>
          inc.id === event.data.id ? event.data.incident : inc
        )
      }));
      break;

    case 'log.added':
      // Append to logs
      queryClient.setQueryData(['logs', event.data.executionId], (old: any) => ({
        ...old,
        logs: [...(old?.logs || []), event.data]
      }));
      break;

    case 'automation.completed':
      // Update execution status
      queryClient.invalidateQueries({ queryKey: ['execution', event.data.id] });
      break;
  }
}
```

#### 2. Component Integration with Fallback

```typescript
// frontend/src/app/(dashboard)/incidents/page.tsx
import { useSSE } from '@/hooks/useSSE';
import { useQuery } from '@tanstack/react-query';

export default function IncidentsPage() {
  const [useFallback, setUseFallback] = useState(false);

  // SSE connection
  const { isConnected, reconnectAttempts } = useSSE({
    url: '/api/v1/events/stream',
    enabled: !useFallback,
    onError: () => {
      if (reconnectAttempts >= 3) {
        setUseFallback(true);
      }
    }
  });

  // Fallback polling (only if SSE fails)
  const { data: incidents } = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: useFallback ? 5000 : false, // Only poll if SSE failed
    enabled: useFallback
  });

  return (
    <div>
      {!isConnected && useFallback && (
        <Alert variant="warning">
          Real-time updates unavailable. Using polling fallback.
        </Alert>
      )}
      <IncidentList incidents={incidents} />
    </div>
  );
}
```

---

## Problem 2: The "Thundering Herd"

### Current State

**Scenario:** 50 users load dashboard simultaneously at 9:00 AM.

```
User 1: GET /api/v1/dashboard/stats → Database query
User 2: GET /api/v1/dashboard/stats → Database query (identical)
User 3: GET /api/v1/dashboard/stats → Database query (identical)
...
User 50: GET /api/v1/dashboard/stats → Database query (identical)

Result: 50 identical database queries executed within 100ms
Database: Overwhelmed
Response time: Degraded for all users
```

---

## Solution 2: Request Deduplication

### Architecture

```typescript
// backend/src/common/interceptors/request-deduplication.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';
import { Observable, defer, from } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

@Injectable()
export class RequestDeduplicationInterceptor implements NestInterceptor {
  private inFlightRequests = new Map<string, Observable<any>>();

  constructor(private redis: Redis) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      request.url,
      request.query,
      user?.role
    );

    // Check if request is already in-flight
    if (this.inFlightRequests.has(cacheKey)) {
      console.log(`[Dedup] Reusing in-flight request: ${cacheKey}`);
      return this.inFlightRequests.get(cacheKey)!;
    }

    // Check Redis cache
    return defer(async () => {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        console.log(`[Dedup] Cache hit: ${cacheKey}`);
        return JSON.parse(cached);
      }

      // Execute request and cache result
      const observable = next.handle().pipe(
        tap(async (data) => {
          // Cache for 5 seconds
          await this.redis.setex(cacheKey, 5, JSON.stringify(data));
        }),
        shareReplay(1) // Share result with concurrent requests
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
        }
      });

      return observable;
    }).pipe(shareReplay(1));
  }

  private generateCacheKey(url: string, query: any, role: string): string {
    const data = `${url}:${JSON.stringify(query)}:${role}`;
    return `dedup:${createHash('md5').update(data).digest('hex')}`;
  }
}
```

### Apply to Expensive Endpoints

```typescript
// backend/src/modules/dashboard/dashboard.controller.ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { RequestDeduplicationInterceptor } from '../../common/interceptors/request-deduplication.interceptor';

@Controller('dashboard')
export class DashboardController {
  @Get('stats')
  @UseInterceptors(RequestDeduplicationInterceptor)
  async getStats() {
    // Expensive aggregation query
    return this.dashboardService.getSystemStats();
  }

  @Get('server-utilization')
  @UseInterceptors(RequestDeduplicationInterceptor)
  async getServerUtilization() {
    // Expensive query across all servers
    return this.dashboardService.getServerUtilization();
  }
}
```

---

## Performance Impact Analysis

### Before Optimizations

```
1000 concurrent users:
- Requests/second: ~2000 (polling)
- Database queries/second: ~2000
- Network bandwidth: High (redundant responses)
- Latency: 5-30 seconds
- Database load: Very high
- Scalability: Limited to ~500 users
```

### After Optimizations

```
1000 concurrent users:
- SSE connections: 1000 (persistent)
- Events/second: ~167 (only on actual changes)
- Database queries/second: ~50 (95% reduction)
- Network bandwidth: Low (only changes sent)
- Latency: <100ms (real-time)
- Database load: Very low
- Scalability: 10,000+ users
```

**Improvements:**
- 92% reduction in requests
- 95% reduction in database queries
- 98% reduction during traffic spikes (with deduplication)
- 50-300x latency improvement (5s → <100ms)
- 20x scalability improvement (500 → 10,000 users)

---

## Implementation Roadmap

### Phase 1: SSE Infrastructure (Week 1)
- [ ] Implement EventBusService
- [ ] Implement EventStreamController
- [ ] Add SSE support to Module 6 (Incidents)
- [ ] Add SSE support to Module 7 (Logging)
- [ ] Test with 100 concurrent connections

### Phase 2: Frontend Integration (Week 2)
- [ ] Implement useSSE hook
- [ ] Update Incident list to use SSE
- [ ] Update Log viewer to use SSE
- [ ] Implement fallback to polling
- [ ] Test reconnection logic

### Phase 3: Request Deduplication (Week 3)
- [ ] Implement RequestDeduplicationInterceptor
- [ ] Apply to dashboard endpoints
- [ ] Apply to expensive query endpoints
- [ ] Load test with 1000 concurrent users
- [ ] Measure performance improvements

### Phase 4: Rollout (Week 4)
- [ ] Add SSE to remaining modules
- [ ] Monitor SSE connection stability
- [ ] Tune cache TTLs
- [ ] Document SSE architecture
- [ ] Train team on SSE debugging

---

## Monitoring & Observability

### Metrics to Track

```typescript
// SSE Metrics
- sse_connections_active: Gauge (current connections)
- sse_connections_total: Counter (total connections)
- sse_events_sent: Counter (events sent by type)
- sse_reconnections: Counter (reconnection attempts)
- sse_connection_duration: Histogram (connection lifetime)

// Deduplication Metrics
- dedup_cache_hits: Counter (cache hits)
- dedup_cache_misses: Counter (cache misses)
- dedup_requests_deduplicated: Counter (requests saved)
- dedup_cache_size: Gauge (in-flight requests)
```

### Alerts

```yaml
- alert: SSEConnectionsHigh
  expr: sse_connections_active > 5000
  for: 5m
  annotations:
    summary: "High number of SSE connections"

- alert: SSEReconnectionRateHigh
  expr: rate(sse_reconnections[5m]) > 10
  for: 5m
  annotations:
    summary: "High SSE reconnection rate"

- alert: DedupCacheHitRateLow
  expr: rate(dedup_cache_hits[5m]) / rate(dedup_cache_misses[5m]) < 0.5
  for: 10m
  annotations:
    summary: "Low deduplication cache hit rate"
```

---

## Edge Cases & Failure Modes

### SSE Edge Cases

1. **Connection Drops**
   - Frontend: Auto-reconnect with exponential backoff
   - Backend: Clean up connection on close

2. **Missed Events During Reconnection**
   - Solution: Send "Last-Event-ID" header on reconnect
   - Backend: Replay missed events from Redis buffer

3. **Load Balancer Issues**
   - Solution: Use sticky sessions OR Redis-backed event replay
   - Nginx: `ip_hash` or `sticky cookie`

4. **Mobile/Flaky Networks**
   - Solution: Fallback to polling after 3 failed reconnections
   - Heartbeat every 30s to detect dead connections

### Request Deduplication Edge Cases

1. **Different Users, Different Permissions**
   - Solution: Include user role in cache key
   - Cache key: `dedup:${endpoint}:${params}:${role}`

2. **Stale Data**
   - Solution: 5s TTL acceptable for dashboard stats
   - Critical data: Don't cache (e.g., incident creation)

3. **Redis Failure**
   - Solution: Gracefully degrade to normal execution
   - In-memory Map as fallback

4. **Race Conditions**
   - Solution: Use Redis SETNX for atomic in-flight marking
   - RxJS shareReplay for in-memory deduplication

---

## Security Considerations

### SSE Authentication

```typescript
// Option 1: JWT in query parameter (simple but less secure)
const eventSource = new EventSource(`/api/events/stream?token=${jwt}`);

// Option 2: Initial POST with JWT, then SSE (more secure)
const response = await fetch('/api/events/connect', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` }
});
const { streamId } = await response.json();
const eventSource = new EventSource(`/api/events/stream/${streamId}`);
```

### RBAC Filtering

```typescript
// Backend filters events by user permissions
private hasPermission(user: any, event: any): boolean {
  if (!event.permissions) return true;
  return event.permissions.some(p => user.permissions.includes(p));
}
```

### Rate Limiting

```typescript
// Limit SSE connections per user
@UseGuards(SSEConnectionLimitGuard)
@Sse('stream')
stream(@Req() req): Observable<MessageEvent> {
  // Max 3 concurrent connections per user
}
```

---

## Testing Strategy

### Load Testing

```bash
# Test 1000 concurrent SSE connections
artillery run sse-load-test.yml

# Test thundering herd scenario
artillery run thundering-herd-test.yml
```

```yaml
# sse-load-test.yml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 100
      name: "Ramp up to 1000 connections"

scenarios:
  - name: "SSE Connection"
    engine: "sse"
    flow:
      - get:
          url: "/api/v1/events/stream?token={{ token }}"
          sse:
            - match:
                json: "$.type"
                value: "incident.created"
              capture:
                - json: "$.data.id"
                  as: "incidentId"
```

### Integration Tests

```typescript
describe('SSE Integration', () => {
  it('should receive incident created event', (done) => {
    const eventSource = new EventSource('/api/events/stream?token=test');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      expect(data.type).toBe('incident.created');
      eventSource.close();
      done();
    };

    // Trigger incident creation
    createIncident({ title: 'Test' });
  });
});
```

---

## Migration Strategy

### Phase 1: Parallel Run (Week 1-2)
- Deploy SSE alongside existing polling
- 10% of users use SSE (feature flag)
- Monitor stability and performance
- Compare metrics: SSE vs Polling

### Phase 2: Gradual Rollout (Week 3-4)
- 25% of users use SSE
- 50% of users use SSE
- 75% of users use SSE
- Monitor error rates and reconnections

### Phase 3: Full Rollout (Week 5)
- 100% of users use SSE
- Polling remains as fallback only
- Remove polling refetchInterval from code
- Document SSE as primary real-time mechanism

### Phase 4: Cleanup (Week 6)
- Remove feature flags
- Optimize SSE performance
- Add comprehensive monitoring
- Update documentation

---

## Success Metrics

### Performance Metrics
- [ ] 95% reduction in database queries
- [ ] 92% reduction in API requests
- [ ] <100ms event delivery latency
- [ ] >99.9% SSE connection uptime
- [ ] <1% fallback to polling rate

### Scalability Metrics
- [ ] Support 10,000 concurrent SSE connections
- [ ] Handle 1000 events/second
- [ ] <5% CPU increase per 1000 connections
- [ ] <100MB memory increase per 1000 connections

### User Experience Metrics
- [ ] <100ms perceived latency for updates
- [ ] Zero "stale data" complaints
- [ ] >95% user satisfaction with real-time updates

---

**Status:** Design Complete - Ready for Implementation  
**Priority:** P0 (Critical for Production)  
**Estimated Effort:** 4 weeks (1 backend dev + 1 frontend dev)  
**Dependencies:** None (can be implemented immediately)

---

**Last Updated:** February 11, 2026  
**Author:** Architecture Team  
**Reviewers:** Backend Lead, Frontend Lead, DevOps Lead
