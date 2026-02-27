/**
 * Application Detail View Component
 * 
 * Displays detailed information about a single application
 */

import { Application } from '@/lib/api/healer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Server, 
  Globe, 
  FolderOpen, 
  Activity, 
  Shield, 
  Settings,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApplicationDetailViewProps {
  application: Application;
  onDiagnose?: () => void;
  onToggleHealer?: () => void;
  onConfigure?: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

const TECH_STACK_CONFIG = {
  WORDPRESS: { label: 'WordPress', color: 'bg-blue-100 text-blue-800' },
  NODEJS: { label: 'Node.js', color: 'bg-green-100 text-green-800' },
  PHP: { label: 'PHP', color: 'bg-purple-100 text-purple-800' },
  LARAVEL: { label: 'Laravel', color: 'bg-red-100 text-red-800' },
  NEXTJS: { label: 'Next.js', color: 'bg-gray-100 text-gray-800' },
  EXPRESS: { label: 'Express', color: 'bg-yellow-100 text-yellow-800' },
};

const HEALTH_STATUS_CONFIG = {
  HEALTHY: { label: 'Healthy', color: 'bg-green-100 text-green-800' },
  DEGRADED: { label: 'Degraded', color: 'bg-yellow-100 text-yellow-800' },
  DOWN: { label: 'Down', color: 'bg-red-100 text-red-800' },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-blue-100 text-blue-800' },
  HEALING: { label: 'Healing', color: 'bg-orange-100 text-orange-800' },
  UNKNOWN: { label: 'Unknown', color: 'bg-gray-100 text-gray-800' },
};

const HEALING_MODE_CONFIG = {
  MANUAL: { label: 'Manual', color: 'bg-blue-100 text-blue-800' },
  SEMI_AUTO: { label: 'Semi-Auto', color: 'bg-yellow-100 text-yellow-800' },
  FULL_AUTO: { label: 'Full Auto', color: 'bg-green-100 text-green-800' },
};

export function ApplicationDetailView({
  application,
  onDiagnose,
  onToggleHealer,
  onConfigure,
  onDelete,
  isLoading,
}: ApplicationDetailViewProps) {
  const techStackConfig = TECH_STACK_CONFIG[application.techStack];
  const healthStatusConfig = HEALTH_STATUS_CONFIG[application.healthStatus];
  const healingModeConfig = HEALING_MODE_CONFIG[application.healingMode];

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Globe className="h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-2xl">{application.domain}</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>{application.path}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={techStackConfig.color}>
                {techStackConfig.label}
              </Badge>
              <Badge className={healthStatusConfig.color}>
                {healthStatusConfig.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Health Score */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>Health Score</span>
              </div>
              <div className={cn('text-3xl font-bold', getHealthScoreColor(application.healthScore))}>
                {application.healthScore}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    application.healthScore >= 90 ? 'bg-green-500' :
                    application.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${application.healthScore}%` }}
                />
              </div>
            </div>

            {/* Healer Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Healer Status</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={application.isHealerEnabled ? 'default' : 'secondary'}>
                  {application.isHealerEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Badge className={healingModeConfig.color}>
                  {healingModeConfig.label}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleHealer}
                disabled={isLoading}
                className="w-full"
              >
                {application.isHealerEnabled ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Disable Healer
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Enable Healer
                  </>
                )}
              </Button>
            </div>

            {/* Server Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Server className="h-4 w-4" />
                <span>Server</span>
              </div>
              {application.servers ? (
                <div className="space-y-1">
                  <div className="font-medium">{application.servers.name}</div>
                  <div className="text-sm text-muted-foreground">{application.servers.host}</div>
                  <Badge variant="outline">{application.servers.platformType}</Badge>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No server info</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Technical Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Tech Stack</div>
              <div className="font-medium">{techStackConfig.label}</div>
            </div>
            
            {application.version && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Version</div>
                <div className="font-medium">{application.version}</div>
              </div>
            )}
            
            {application.phpVersion && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">PHP Version</div>
                <div className="font-medium">{application.phpVersion}</div>
              </div>
            )}
            
            {application.dbName && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Database</div>
                <div className="font-medium">{application.dbName}</div>
              </div>
            )}
            
            {application.dbHost && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Database Host</div>
                <div className="font-medium">{application.dbHost}</div>
              </div>
            )}
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Detection Method</div>
              <div className="font-medium">{application.detectionMethod}</div>
            </div>
            
            {application.lastDiagnosedAt && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Last Diagnosed</div>
                <div className="font-medium">
                  {new Date(application.lastDiagnosedAt).toLocaleString()}
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium">
                {new Date(application.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onDiagnose} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Diagnosis
            </Button>
            
            <Button variant="outline" onClick={onConfigure} disabled={isLoading}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.open(`https://${application.domain}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit Site
            </Button>
            
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isLoading}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
