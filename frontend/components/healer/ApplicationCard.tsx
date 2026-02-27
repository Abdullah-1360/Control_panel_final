import { Application } from '@/lib/api/healer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TechStackBadge } from './TechStackBadge';
import { HealthScoreCard } from './HealthScoreCard';
import { Activity, Server, Calendar, Settings, Trash2, Eye, Shield, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ApplicationCardProps {
  application: Application;
  onViewDetails?: (id: string) => void;
  onDiagnose: (id: string) => void;
  onConfigure: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ApplicationCard({
  application,
  onViewDetails,
  onDiagnose,
  onConfigure,
  onDelete,
}: ApplicationCardProps) {
  
  return (
    <Card className={cn(
      "p-6 hover:shadow-lg transition-all duration-200 relative",
      "border-l-4",
      {
        "border-l-green-500": application.healthStatus === 'HEALTHY',
        "border-l-yellow-500": application.healthStatus === 'DEGRADED',
        "border-l-red-500": application.healthStatus === 'DOWN',
        "border-l-blue-500": application.healthStatus === 'HEALING',
        "border-l-gray-500": application.healthStatus === 'UNKNOWN',
      }
    )}>
      <div className="space-y-4">
        {/* Healer Status Indicator */}
        {application.isHealerEnabled && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
              <Shield className="h-3 w-3" />
              <span>Protected</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold truncate">{application.domain}</h3>
              <TechStackBadge techStack={application.techStack} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                <span className="truncate">{application.servers?.name || 'Unknown Server'}</span>
              </div>
              {application.lastDiagnosedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(application.lastDiagnosedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Health Score */}
          <div className="ml-4">
            <HealthScoreCard
              score={application.healthScore}
              status={application.healthStatus}
              size="sm"
              className={cn({
                "animate-pulse": application.healthStatus === 'DOWN'
              })}
            />
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Path:</span>
            <p className="font-mono text-xs truncate mt-1">{application.path}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Healing Mode:</span>
            <div className="mt-1">
              <Badge variant={application.healingMode === 'MANUAL' ? 'outline' : 'default'}>
                {application.healingMode === 'MANUAL' && 'Manual'}
                {application.healingMode === 'SEMI_AUTO' && 'Semi-Auto'}
                {application.healingMode === 'FULL_AUTO' && 'Full Auto'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Version Info */}
        {(application.version || application.phpVersion) && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {application.version && (
              <span>
                Version: <span className="font-mono">{application.version}</span>
              </span>
            )}
            {application.phpVersion && (
              <span>
                PHP: <span className="font-mono">{application.phpVersion}</span>
              </span>
            )}
          </div>
        )}

        {/* Last Activity Timeline */}
        {application.lastHealedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-green-500" />
              <span>Healed {formatDistanceToNow(new Date(application.lastHealedAt), { addSuffix: true })}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails?.(application.id)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button
            size="sm"
            onClick={() => onDiagnose(application.id)}
          >
            <Activity className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConfigure(application.id)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(application.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
