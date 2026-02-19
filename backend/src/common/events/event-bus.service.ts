import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum SystemEvent {
  // Incident events
  INCIDENT_CREATED = 'incident.created',
  INCIDENT_UPDATED = 'incident.updated',
  INCIDENT_STATUS_CHANGED = 'incident.status.changed',
  INCIDENT_ASSIGNED = 'incident.assigned',
  INCIDENT_COMMENT_ADDED = 'incident.comment.added',

  // Server events
  SERVER_CREATED = 'server.created',
  SERVER_UPDATED = 'server.updated',
  SERVER_DELETED = 'server.deleted',
  SERVER_STATUS_CHANGED = 'server.status.changed',
  SERVER_CONNECTION_TESTED = 'server.connection.tested',

  // Automation events
  AUTOMATION_STARTED = 'automation.started',
  AUTOMATION_COMPLETED = 'automation.completed',
  AUTOMATION_FAILED = 'automation.failed',
  AUTOMATION_STEP_COMPLETED = 'automation.step.completed',

  // Log events
  LOG_ADDED = 'log.added',

  // Notification events
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',

  // Integration events
  INTEGRATION_CREATED = 'integration.created',
  INTEGRATION_UPDATED = 'integration.updated',
  INTEGRATION_TESTED = 'integration.tested',

  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',

  // SLO events
  SLO_BREACHED = 'slo.breached',
  SLO_WARNING = 'slo.warning',
}

export interface SystemEventPayload {
  type: SystemEvent;
  data: any;
  timestamp: Date;
  userId?: string; // For user-specific events
  permissions?: string[]; // For RBAC filtering
  correlationId?: string; // For distributed tracing
  traceId?: string; // Distributed trace ID
  spanId?: string; // Span ID within trace
}

@Injectable()
export class EventBusService {
  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Emit a system event to all listeners
   */
  emit(event: SystemEventPayload): void {
    // Ensure timestamp is set
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    this.eventEmitter.emit(event.type, event);
  }

  /**
   * Subscribe to a specific event type
   */
  on(
    event: SystemEvent,
    handler: (payload: SystemEventPayload) => void,
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Subscribe to multiple event types
   */
  onMany(
    events: SystemEvent[],
    handler: (payload: SystemEventPayload) => void,
  ): void {
    events.forEach((event) => {
      this.eventEmitter.on(event, handler);
    });
  }

  /**
   * Unsubscribe from an event
   */
  off(
    event: SystemEvent,
    handler: (payload: SystemEventPayload) => void,
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: SystemEvent): void {
    if (event) {
      this.eventEmitter.removeAllListeners(event);
    } else {
      this.eventEmitter.removeAllListeners();
    }
  }
}
