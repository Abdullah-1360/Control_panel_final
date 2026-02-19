'use client';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Globe, FolderTree } from 'lucide-react';

interface SubdomainCardProps {
  site: {
    id: string;
    domain: string;
    path: string;
    healthStatus: string;
    wpVersion?: string;
    phpVersion?: string;
  };
  onDiagnose: (siteId: string) => void;
  type: 'SUBDOMAIN' | 'ADDON';
}

export function SubdomainCard({ site, onDiagnose, type }: SubdomainCardProps) {
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
    <Card className="hover:shadow-md transition-shadow bg-muted/30">
      <CardContent className="pt-4 pb-2">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {type === 'SUBDOMAIN' ? (
              <FolderTree className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{site.domain}</h4>
              <p className="text-xs text-muted-foreground truncate">{site.path}</p>
            </div>
          </div>
          <Badge className={`${getHealthStatusColor(site.healthStatus)} text-xs`}>
            {site.healthStatus}
          </Badge>
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">WP:</span> {site.wpVersion || 'N/A'}
          </div>
          <div>
            <span className="font-medium">PHP:</span> {site.phpVersion || 'N/A'}
          </div>
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-3">
        <Button
          onClick={() => onDiagnose(site.id)}
          className="w-full"
          variant="outline"
          size="sm"
        >
          <Activity className="mr-2 h-3 w-3" />
          Diagnose
        </Button>
      </CardFooter>
    </Card>
  );
}
