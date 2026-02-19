import { Controller, Sse, UseGuards, Req, Logger } from '@nestjs/common';
import { Observable, fromEvent, merge, interval } from 'rxjs';
import { map, filter, startWith } from 'rxjs/operators';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EventBusService, SystemEvent, SystemEventPayload } from './event-bus.service';
import { Request } from 'express';

interface MessageEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventStreamController {
  private readonly logger = new Logger(EventStreamController.name);

  constructor(
    private eventBus: EventBusService,
  ) {}

  @Sse('stream')
  stream(@Req() req: Request): Observable<MessageEvent> {
    const user = req.user as any;
    
    this.logger.log(`SSE connection established for user: ${user.id}`);

    // Create observables for each event type
    const incidentEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.INCIDENT_CREATED,
    );

    const incidentUpdatedEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.INCIDENT_UPDATED,
    );

    const incidentStatusEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.INCIDENT_STATUS_CHANGED,
    );

    const incidentCommentEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.INCIDENT_COMMENT_ADDED,
    );

    const serverEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.SERVER_STATUS_CHANGED,
    );

    const serverCreatedEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.SERVER_CREATED,
    );

    const serverUpdatedEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.SERVER_UPDATED,
    );

    const logEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.LOG_ADDED,
    );

    const automationStartedEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.AUTOMATION_STARTED,
    );

    const automationCompletedEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.AUTOMATION_COMPLETED,
    );

    const automationFailedEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.AUTOMATION_FAILED,
    );

    const notificationEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.NOTIFICATION_SENT,
    );

    const sloEvents$ = fromEvent(
      this.eventBus['eventEmitter'],
      SystemEvent.SLO_BREACHED,
    );

    // Heartbeat to keep connection alive (every 30 seconds)
    const heartbeat$ = interval(30000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: new Date() },
        timestamp: new Date(),
      })),
    );

    // Merge all event streams
    return merge(
      incidentEvents$,
      incidentUpdatedEvents$,
      incidentStatusEvents$,
      incidentCommentEvents$,
      serverEvents$,
      serverCreatedEvents$,
      serverUpdatedEvents$,
      logEvents$,
      automationStartedEvents$,
      automationCompletedEvents$,
      automationFailedEvents$,
      notificationEvents$,
      sloEvents$,
      heartbeat$,
    ).pipe(
      // Filter by user permissions
      filter((event: any) => this.hasPermission(user, event)),
      // Transform to SSE format
      map((event: any) => {
        const messageEvent: MessageEvent = {
          data: JSON.stringify({
            type: event.type,
            data: event.data,
            timestamp: event.timestamp || new Date(),
            correlationId: event.correlationId,
            traceId: event.traceId,
          }),
          id: event.id || Date.now().toString(),
          type: event.type,
          retry: 10000, // Retry after 10s if connection drops
        };

        return messageEvent;
      }),
      // Send initial connection message
      startWith({
        data: JSON.stringify({
          type: 'connected',
          data: { message: 'SSE connection established' },
          timestamp: new Date(),
        }),
        id: Date.now().toString(),
        type: 'connected',
      }),
    );
  }

  /**
   * Check if user has permission to receive this event
   */
  private hasPermission(user: any, event: SystemEventPayload | any): boolean {
    // Heartbeat events are always allowed
    if (event.type === 'heartbeat') {
      return true;
    }

    // If no permissions specified, event is public
    if (!event.permissions || event.permissions.length === 0) {
      return true;
    }

    // Check if user has any of the required permissions
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }

    return event.permissions.some((permission: string) =>
      user.permissions.includes(permission),
    );
  }
}
