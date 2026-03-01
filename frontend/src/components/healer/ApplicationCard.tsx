import { Application } from '@/lib/api/healer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TechStackBadge } from './TechStackBadge';
import { HealthScoreCard } from './HealthScoreCard';
import { Activity, Server, Calendar, Settings, Trash2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

interface ApplicationCardProps {
  application: Application;
  onDiagnose: (id: string, techStack: string) => void;
  onConfigure: (id: string, techStack: string) => void;
  onDelete: (id: string) => void;
}

export function ApplicationCard({
  application,
  onDiagnose,
  onConfigure,
  onDelete,
}: ApplicationCardProps) {
  const router = useRouter();
  
  // Route WordPress applications to old healer, others to new healer
  const handleViewDetails = () => {
    if (application.techStack === 'WORDPRESS') {
      router.push(`/healer/sites/${application.id}`);
    } else {
      router.push(`/healer/${application.id}`);
    }
  };
  
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="space-y-4">
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

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={handleViewDetails}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button
            size="sm"
            onClick={() => onDiagnose(application.id, application.techStack)}
          >
            <Activity className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConfigure(application.id, application.techStack)}
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
