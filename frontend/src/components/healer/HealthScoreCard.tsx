/**
 * Health Score Card Component
 * 
 * Displays health score with visual indicator (0-100)
 */

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { HealthStatus } from '@/types/healer';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Wrench, 
  Loader2,
  HelpCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthScoreCardProps {
  score?: number;
  status: HealthStatus;
  lastCheck?: string;
  className?: string;
}

const STATUS_CONFIG = {
  [HealthStatus.HEALTHY]: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    label: 'Healthy',
    badgeVariant: 'default' as const,
  },
  [HealthStatus.DEGRADED]: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    label: 'Degraded',
    badgeVariant: 'secondary' as const,
  },
  [HealthStatus.DOWN]: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    label: 'Down',
    badgeVariant: 'destructive' as const,
  },
  [HealthStatus.MAINTENANCE]: {
    icon: Wrench,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    label: 'Maintenance',
    badgeVariant: 'outline' as const,
  },
  [HealthStatus.HEALING]: {
    icon: Loader2,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    label: 'Healing',
    badgeVariant: 'secondary' as const,
  },
  [HealthStatus.UNKNOWN]: {
    icon: HelpCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    label: 'Unknown',
    badgeVariant: 'outline' as const,
  },
};

export function HealthScoreCard({ 
  score, 
  status, 
  lastCheck,
  className 
}: HealthScoreCardProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <Badge variant={config.badgeVariant} className="flex items-center gap-1.5">
          <Icon className={cn('h-3 w-3', status === HealthStatus.HEALING && 'animate-spin')} />
          <span>{config.label}</span>
        </Badge>
        
        {lastCheck && (
          <span className="text-xs text-muted-foreground">
            Last check: {new Date(lastCheck).toLocaleString()}
          </span>
        )}
      </div>
      
      {/* Health Score */}
      {score !== undefined && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Health Score</span>
            <span className="text-2xl font-bold">{score}/100</span>
          </div>
          <Progress 
            value={score} 
            className="h-2"
            indicatorClassName={getScoreColor(score)}
          />
        </div>
      )}
    </div>
  );
}
