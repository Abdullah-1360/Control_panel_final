'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSSEContext } from '@/components/sse-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff } from 'lucide-react';

interface Server {
  id: string;
  name: string;
  host: string;
  lastTestStatus: string;
  lastTestedAt: string;
}

async function fetchServers(): Promise<Server[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`${apiUrl}/api/v1/servers`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch servers');
  }
  
  const data = await response.json();
  return data.servers || [];
}

export function ServerListWithSSE() {
  const { isConnected, reconnectAttempts } = useSSEContext();
  const [useFallback, setUseFallback] = useState(false);

  // Switch to fallback polling after 3 failed SSE reconnection attempts
  useEffect(() => {
    if (reconnectAttempts >= 3) {
      setUseFallback(true);
    } else if (isConnected) {
      setUseFallback(false);
    }
  }, [reconnectAttempts, isConnected]);

  // Fetch servers with conditional polling
  const { data: servers, isLoading, error } = useQuery({
    queryKey: ['servers'],
    queryFn: fetchServers,
    // Only poll if SSE is not connected (fallback mode)
    refetchInterval: useFallback ? 30000 : false, // 30s polling
    staleTime: useFallback ? 25000 : Infinity,
  });

  if (isLoading) {
    return <div>Loading servers...</div>;
  }

  if (error) {
    return <div>Error loading servers: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Show warning when using fallback */}
      {useFallback && (
        <Alert variant="default">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Real-time updates unavailable. Using 30-second polling fallback.
          </AlertDescription>
        </Alert>
      )}

      {/* Server list */}
      <div className="grid gap-4">
        {servers?.map((server) => (
          <div
            key={server.id}
            className="border rounded-lg p-4 hover:bg-accent transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{server.name}</h3>
                <p className="text-sm text-muted-foreground">{server.host}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    server.lastTestStatus === 'SUCCESS'
                      ? 'bg-green-100 text-green-800'
                      : server.lastTestStatus === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {server.lastTestStatus}
                </span>
              </div>
            </div>
            {server.lastTestedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Last tested: {new Date(server.lastTestedAt).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Connection status indicator */}
      <div className="text-xs text-muted-foreground text-center">
        {isConnected ? (
          <span className="text-green-600">● Live updates active</span>
        ) : useFallback ? (
          <span className="text-yellow-600">● Polling every 30 seconds</span>
        ) : (
          <span className="text-gray-600">● Connecting...</span>
        )}
      </div>
    </div>
  );
}
