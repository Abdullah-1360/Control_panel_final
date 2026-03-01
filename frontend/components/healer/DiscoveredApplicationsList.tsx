'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Server, Globe } from 'lucide-react';
import { TechStackBadge } from './TechStackBadge';

export function DiscoveredApplicationsList() {
  // Fetch all applications
  const { data: applicationsData, isLoading } = useQuery({
    queryKey: ['discovered-applications'],
    queryFn: () => apiClient.get('/healer/applications', { params: { limit: 100 } }),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'DEGRADED':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'DOWN':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      HEALTHY: 'default',
      DEGRADED: 'secondary',
      DOWN: 'destructive',
      UNKNOWN: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="gap-1">
        {getHealthIcon(status)}
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const applications = applicationsData?.data || [];

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No Applications Discovered</p>
          <p className="text-sm text-muted-foreground">
            Start a discovery to see applications here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Discovered Applications</h3>
          <p className="text-sm text-muted-foreground">
            {applications.length} applications found across all servers
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {applications.map((app: any) => {
          const metadata = app.metadata || {};
          const subdomains = metadata.availableSubdomains || [];
          const addonDomains = subdomains.filter((s: any) => s.type === 'addon');
          const actualSubdomains = subdomains.filter((s: any) => s.type === 'subdomain');

          return (
            <Card key={app.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{app.domain}</CardTitle>
                      {getHealthBadge(app.healthStatus)}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <TechStackBadge techStack={app.techStack} />
                      {app.version && (
                        <span className="text-xs">v{app.version}</span>
                      )}
                      {app.phpVersion && (
                        <Badge variant="outline" className="text-xs">
                          PHP {app.phpVersion}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {app.healthScore !== null ? `${app.healthScore}%` : 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">Health Score</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Server Info */}
                  <div className="flex items-center gap-2 text-sm">
                    <Server className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Server:</span>
                    <span className="font-medium">{app.servers?.name || 'Unknown'}</span>
                  </div>

                  {/* Path */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Path:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {app.path}
                    </code>
                  </div>

                  {/* Subdomains */}
                  {actualSubdomains.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Subdomains ({actualSubdomains.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {actualSubdomains.slice(0, 5).map((subdomain: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {subdomain.domain}
                            {subdomain.techStack && subdomain.techStack !== 'UNKNOWN' && (
                              <span className="ml-1 text-muted-foreground">
                                ({subdomain.techStack})
                              </span>
                            )}
                          </Badge>
                        ))}
                        {actualSubdomains.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{actualSubdomains.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Addon Domains */}
                  {addonDomains.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Addon Domains ({addonDomains.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {addonDomains.slice(0, 5).map((addon: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {addon.domain}
                            {addon.techStack && addon.techStack !== 'UNKNOWN' && (
                              <span className="ml-1 text-muted-foreground">
                                ({addon.techStack})
                              </span>
                            )}
                          </Badge>
                        ))}
                        {addonDomains.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{addonDomains.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status Indicators */}
                  <div className="flex items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Healer:</span>
                      <Badge variant={app.isHealerEnabled ? 'default' : 'outline'} className="text-xs">
                        {app.isHealerEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {app.lastDiagnosedAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        Last diagnosed: {new Date(app.lastDiagnosedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
