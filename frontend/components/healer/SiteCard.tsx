'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Server, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SiteCardProps {
  site: {
    id: string;
    domain: string;
    path: string;
    healthStatus: string;
    wpVersion?: string;
    phpVersion?: string;
    lastHealthCheck?: string;
    server: {
      id: string;
      host: string;
    };
  };
  onDiagnose: (siteId: string) => void;
  isMainDomain?: boolean;
  subdomainCount?: number;
}

export function SiteCard({ site, onDiagnose, isMainDomain, subdomainCount }: SiteCardProps) {
  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-500 hover:bg-green-600';
      case 'DOWN':
        return 'bg-red-500 hover:bg-red-600';
      case 'DEGRADED':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'MAINTENANCE':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'HEALING':
        return 'bg-purple-500 hover:bg-purple-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{site.domain}</h3>
              {isMainDomain && subdomainCount && subdomainCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{subdomainCount}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{site.path}</p>
          </div>
          <Badge className={getHealthStatusColor(site.healthStatus)}>
            {site.healthStatus}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Server className="h-4 w-4" />
          <span className="truncate">{site.server?.host || site.servers?.host || 'Unknown'}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">WordPress</p>
            <p className="font-medium">{site.wpVersion || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">PHP</p>
            <p className="font-medium">{site.phpVersion || 'Unknown'}</p>
          </div>
        </div>

        {site.lastHealthCheck && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="h-3 w-3" />
            <span>
              Checked {formatDistanceToNow(new Date(site.lastHealthCheck), { addSuffix: true })}
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <Button
          onClick={() => onDiagnose(site.id)}
          className="w-full"
          variant="outline"
        >
          <Activity className="mr-2 h-4 w-4" />
          Diagnose
        </Button>
      </CardFooter>
    </Card>
  );
}
