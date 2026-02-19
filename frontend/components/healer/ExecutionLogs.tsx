'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING';
  message: string;
}

interface ExecutionLogsProps {
  logs: LogEntry[];
}

export function ExecutionLogs({ logs }: ExecutionLogsProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-green-400';
      case 'ERROR':
        return 'text-red-400';
      case 'WARNING':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Logs</CardTitle>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border bg-black p-4">
          <div className="font-mono text-sm space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-gray-500">[{formatTime(log.timestamp)}]</span>
                  <span className={getLevelColor(log.level)}>{log.level}</span>
                  <span className="text-white">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
