'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { toast } from 'sonner';

interface SSEContextValue {
  isConnected: boolean;
  reconnectAttempts: number;
  lastEventTime: Date | null;
  disconnect: () => void;
  reconnect: () => void;
}

const SSEContext = createContext<SSEContextValue | undefined>(undefined);

export function SSEProvider({ children }: { children: ReactNode }) {
  const sseState = useSSE({
    url: '/api/v1/events/stream',
    enabled: true,
    onEvent: (event) => {
      // Optional: Show toast notifications for important events
      try {
        const data = JSON.parse(event.data);
        
        // Example: Show toast for critical events
        if (data.type === 'slo.breached') {
          toast.error('SLO Breached', {
            description: `Service: ${data.data.service}`,
          });
        }
        
        if (data.type === 'incident.created') {
          toast.info('New Incident', {
            description: `${data.data.title}`,
          });
        }
      } catch (error) {
        // Ignore parse errors
      }
    },
    onError: () => {
      toast.warning('Real-time updates unavailable', {
        description: 'Using polling fallback',
      });
    },
  });

  return (
    <SSEContext.Provider value={sseState}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSEContext() {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error('useSSEContext must be used within SSEProvider');
  }
  return context;
}
