import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseSSEOptions {
  url: string;
  enabled?: boolean;
  onEvent?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
}

interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
  correlationId?: string;
  traceId?: string;
}

export function useSSE({ url, enabled = true, onEvent, onError }: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEvent = useCallback((event: SSEEvent) => {
    setLastEventTime(new Date());

    // Update React Query cache based on event type
    switch (event.type) {
      case 'connected':
        console.log('[SSE] Connected:', event.data.message);
        break;

      case 'heartbeat':
        // Keep connection alive
        break;

      // Incident events
      case 'incident.created':
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.setQueryData(['incidents'], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            incidents: [event.data, ...(old?.incidents || [])],
          };
        });
        break;

      case 'incident.updated':
      case 'incident.status.changed':
        queryClient.setQueryData(['incident', event.data.id], event.data.incident || event.data);
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        break;

      case 'incident.comment.added':
        queryClient.invalidateQueries({ queryKey: ['incident', event.data.incidentId] });
        break;

      // Server events
      case 'server.created':
        queryClient.invalidateQueries({ queryKey: ['servers'] });
        break;

      case 'server.updated':
        queryClient.setQueryData(['server', event.data.id], event.data);
        queryClient.invalidateQueries({ queryKey: ['servers'] });
        break;

      case 'server.status.changed':
        queryClient.setQueryData(['server', event.data.id], (old: any) => ({
          ...old,
          lastTestStatus: event.data.newStatus,
          lastTestedAt: event.data.timestamp,
        }));
        queryClient.invalidateQueries({ queryKey: ['servers'] });
        break;

      // Automation events
      case 'automation.started':
        queryClient.invalidateQueries({ queryKey: ['executions'] });
        break;

      case 'automation.completed':
      case 'automation.failed':
        queryClient.setQueryData(['execution', event.data.id], event.data);
        queryClient.invalidateQueries({ queryKey: ['executions'] });
        break;

      case 'automation.step.completed':
        queryClient.invalidateQueries({ queryKey: ['execution', event.data.executionId] });
        break;

      // Log events
      case 'log.added':
        queryClient.setQueryData(['logs', event.data.executionId], (old: any) => ({
          ...old,
          logs: [...(old?.logs || []), event.data],
        }));
        break;

      // Notification events
      case 'notification.sent':
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        break;

      // SLO events
      case 'slo.breached':
      case 'slo.warning':
        queryClient.invalidateQueries({ queryKey: ['slos'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        break;

      default:
        console.log('[SSE] Unknown event type:', event.type);
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      // Get token from localStorage (adjust based on your auth implementation)
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('[SSE] No access token found');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const fullUrl = `${apiUrl}${url}`;
      
      console.log('[SSE] Connecting to:', fullUrl);
      
      // Create EventSource with token in URL (alternative: use POST to get stream ID)
      const eventSource = new EventSource(`${fullUrl}?token=${token}`);

      eventSource.onopen = () => {
        console.log('[SSE] Connection opened');
        setIsConnected(true);
        setReconnectAttempts(0);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          handleEvent(data);
          onEvent?.(event);
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        setIsConnected(false);
        eventSource.close();

        // Exponential backoff reconnection
        const attempts = reconnectAttempts + 1;
        setReconnectAttempts(attempts);

        if (attempts < 3) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attempts}/3)...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log('[SSE] Max reconnection attempts reached. Falling back to polling.');
          onError?.(error);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      onError?.(error as Event);
    }
  }, [enabled, url, reconnectAttempts, handleEvent, onEvent, onError]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        console.log('[SSE] Closing connection');
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setReconnectAttempts(0);
    connect();
  }, [disconnect, connect]);

  return {
    isConnected,
    reconnectAttempts,
    lastEventTime,
    disconnect,
    reconnect,
  };
}
