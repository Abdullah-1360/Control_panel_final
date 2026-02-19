'use client';

import { useSSE } from '@/hooks/use-sse';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({ className, showLabel = true }: ConnectionStatusProps) {
  const { isConnected, reconnectAttempts, lastEventTime, reconnect } = useSSE({
    url: '/api/v1/events/stream',
    enabled: true,
  });

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500';
    if (reconnectAttempts > 0 && reconnectAttempts < 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected) return 'Live';
    if (reconnectAttempts > 0 && reconnectAttempts < 3) {
      return `Reconnecting (${reconnectAttempts}/3)`;
    }
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnected) return <Wifi className="h-4 w-4" />;
    if (reconnectAttempts > 0 && reconnectAttempts < 3) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    return <WifiOff className="h-4 w-4" />;
  };

  const getTooltipContent = () => {
    if (isConnected) {
      return (
        <div className="text-xs">
          <div className="font-semibold">Connected</div>
          <div className="text-muted-foreground">
            Real-time updates active
          </div>
          {lastEventTime && (
            <div className="text-muted-foreground mt-1">
              Last event: {lastEventTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      );
    }

    if (reconnectAttempts > 0 && reconnectAttempts < 3) {
      return (
        <div className="text-xs">
          <div className="font-semibold">Reconnecting...</div>
          <div className="text-muted-foreground">
            Attempt {reconnectAttempts} of 3
          </div>
        </div>
      );
    }

    return (
      <div className="text-xs">
        <div className="font-semibold">Disconnected</div>
        <div className="text-muted-foreground">
          Using polling fallback
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reconnect}
          className="mt-2 w-full"
        >
          Retry Connection
        </Button>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              className
            )}
          >
            <div className="relative">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  getStatusColor(),
                  isConnected && 'animate-pulse'
                )}
              />
            </div>
            {showLabel && (
              <>
                {getStatusIcon()}
                <span className="text-sm text-muted-foreground">
                  {getStatusText()}
                </span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
