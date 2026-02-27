/**
 * Application Detail View Component - V2
 * 
 * Redesigned to show each domain (main, subdomain, addon) as separate entity
 * Each domain can have different tech stack, health score, and healing settings
 */

import { Application } from '@/lib/api/healer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ApplicationDetailViewProps {
  application: Application;
  onDiagnose?: () => void;
  onDiagnoseSubdomain?: (subdomain: string) => void;
  onToggleHealer?: () => void;
  onToggleSubdomainHealer?: (subdomain: string, enabled: boolean) => void;
  onConfigure?: () => void;
  onConfigureSubdomain?: (subdomain: string) => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

const TECH_STACK_CONFIG = {
  WORDPRESS: { label: 'WordPress', color: 'bg-blue-100 text-blue-800', icon: '🔷' },
  NODEJS: { label: 'Node.js', color: 'bg-green-100 text-green-800', icon: '🟢' },
  PHP: { label: 'PHP', color: 'bg-purple-100 text-purple-800', icon: '🟣' },
  PHP_GENERIC: { label: 'PHP (Generic)', color: 'bg-purple-100 text-purple-700', icon: '🟣' },
  LARAVEL: { label: 'Laravel', color: 'bg-red-100 text-red-800', icon: '🔴' },
  NEXTJS: { label: 'Next.js', color: 'bg-gray-100 text-gray-800', icon: '⚫' },
  EXPRESS: { label: 'Express', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
};

const DOMAIN_TYPE_CONFIG = {
  main: { label: 'Main Domain', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🏠' },
  subdomain: { label: 'Subdomain', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🔗' },
  addon: { label: 'Addon Domain', color: 'bg-green-50 text-green-700 border-green-200', icon: '➕' },
  parked: { label: 'Parked Domain', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: '🅿️' },
};

interface DomainCardProps {
  domain: string;
  path: string;
  type: 'main' | 'subdomain' | 'addon' | 'parked';
  techStack?: string;
  healthScore?: number;
  healthStatus?: string;
  isHealerEnabled?: boolean;
  version?: string;
  phpVersion?: string;
  dbName?: string;
  isMain?: boolean;
  onDiagnose: () => void;
  onToggleHealer: () => void;
  onConfigure: () => void;
  onVisit: () => void;
  isLoading?: boolean;
}

function DomainCard({
  domain,
  path,
  type,
  techStack = 'PHP_GENERIC',
  healthScore = 0,
  healthStatus = 'UNKNOWN',
  isHealerEnabled = false,
  version,
  phpVersion,
  dbName,
  isMain = false,
  onDiagnose,
  onToggleHealer,
  onConfigure,
  onVisit,
  isLoading,
}: DomainCardProps) {
  const [expanded, setExpanded] = useState(isMain);
  
  const techStackConfig = TECH_STACK_CONFIG[techStack as keyof typeof TECH_STACK_CONFIG] || { 
    label: techStack, 
    color: 'bg-gray-100 text-gray-800',
    icon: '❓'
  };
  
  const domainTypeConfig = DOMAIN_TYPE_CONFIG[type];
  
  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-100 text-green-800';
      case 'DEGRADED': return 'bg-yellow-100 text-yellow-800';
      case 'DOWN': return 'bg-red-100 text-red-800';
      case 'MAINTENANCE': return 'bg-blue-100 text-blue-800';
      case 'HEALING': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={cn(
      "transition-all",
      isMain && "border-2 border-primary"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setExpanded(!expanded)}
              >
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-90"
                )} />
              </Button>
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{domain}</CardTitle>
              {isMain && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Primary
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-8">
              <Badge variant="outline" className={domainTypeConfig.color}>
                {domainTypeConfig.icon} {domainTypeConfig.label}
              </Badge>
              <Badge className={techStackConfig.color}>
                {techStackConfig.icon} {techStackConfig.label}
              </Badge>
              <Badge className={getHealthStatusColor(healthStatus)}>
                {healthStatus}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Health Score</div>
              <div className={cn('text-2xl font-bold', getHealthScoreColor(healthScore))}>
                {healthScore}%
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {/* Path and Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Document Root</div>
                <div className="flex items-center gap-2 text-sm font-mono bg-muted p-2 rounded">
                  <FolderOpen className="h-3 w-3" />
                  {path}
                </div>
              </div>
              
              {version && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Version</div>
                  <div className="font-medium">{version}</div>
                </div>
              )}
              
              {phpVersion && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">PHP Version</div>
                  <div className="font-medium">{phpVersion}</div>
                </div>
              )}
              
              {dbName && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Database</div>
                  <div className="font-medium">{dbName}</div>
                </div>
              )}
            </div>
            
            {/* Health Score Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Health Status</span>
                <span className={getHealthScoreColor(healthScore)}>{healthScore}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    healthScore >= 90 ? 'bg-green-500' :
                    healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
            
            {/* Healer Controls */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Auto Healer</div>
                  <div className="text-sm text-muted-foreground">
                    {isHealerEnabled ? 'Monitoring and auto-fixing issues' : 'Disabled'}
                  </div>
                </div>
              </div>
              <Button
                variant={isHealerEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleHealer}
                disabled={isLoading}
              >
                {isHealerEnabled ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Disable
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Enable
                  </>
                )}
              </Button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={onDiagnose} disabled={isLoading} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Diagnosis
              </Button>
              
              <Button variant="outline" onClick={onConfigure} disabled={isLoading} size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              
              <Button variant="outline" onClick={onVisit} size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Site
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function ApplicationDetailView({
  application,
  onDiagnose,
  onDiagnoseSubdomain,
  onToggleHealer,
  onToggleSubdomainHealer,
  onConfigure,
  onConfigureSubdomain,
  onDelete,
  isLoading,
}: ApplicationDetailViewProps) {
  const availableSubdomains = (application.metadata as any)?.availableSubdomains || [];
  
  // Separate main domain from other domains
  const mainDomain = {
    domain: application.domain,
    path: application.path,
    type: (application.metadata as any)?.domainType || 'main',
    techStack: application.techStack,
    healthScore: application.healthScore || 0,
    healthStatus: application.healthStatus,
    isHealerEnabled: application.isHealerEnabled,
    version: application.techStackVersion,
    phpVersion: (application.metadata as any)?.phpVersion,
    dbName: (application.metadata as any)?.dbName,
  };
  
  const relatedDomains = availableSubdomains.filter((d: any) => d.domain !== application.domain);

  return (
    <div className="space-y-6">
      {/* Server Info Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle>
                  {application.servers?.name || 'Unknown Server'}
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {application.servers?.host} • {application.servers?.platformType}
                </div>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Application
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Main Domain */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Main Domain</h3>
          <Badge variant="outline">{application.metadata?.cPanelUsername || 'N/A'}</Badge>
        </div>
        
        <DomainCard
          domain={mainDomain.domain}
          path={mainDomain.path}
          type={mainDomain.type as any}
          techStack={mainDomain.techStack}
          healthScore={mainDomain.healthScore}
          healthStatus={mainDomain.healthStatus}
          isHealerEnabled={mainDomain.isHealerEnabled}
          version={mainDomain.version}
          phpVersion={mainDomain.phpVersion}
          dbName={mainDomain.dbName}
          isMain={true}
          onDiagnose={() => onDiagnose?.()}
          onToggleHealer={() => onToggleHealer?.()}
          onConfigure={() => onConfigure?.()}
          onVisit={() => window.open(`https://${mainDomain.domain}`, '_blank')}
          isLoading={isLoading}
        />
      </div>

      {/* Related Domains */}
      {relatedDomains.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Related Domains</h3>
            <Badge variant="outline">{relatedDomains.length} domains</Badge>
          </div>
          
          <div className="space-y-3">
            {relatedDomains.map((subdomain: any, index: number) => (
              <DomainCard
                key={index}
                domain={subdomain.domain}
                path={subdomain.path}
                type={subdomain.type}
                techStack={subdomain.techStack || 'PHP_GENERIC'}
                healthScore={subdomain.healthScore || 0}
                healthStatus={subdomain.healthStatus || 'UNKNOWN'}
                isHealerEnabled={subdomain.isHealerEnabled || false}
                version={subdomain.version}
                phpVersion={subdomain.phpVersion}
                dbName={subdomain.dbName}
                onDiagnose={() => onDiagnoseSubdomain?.(subdomain.domain)}
                onToggleHealer={() => onToggleSubdomainHealer?.(subdomain.domain, !subdomain.isHealerEnabled)}
                onConfigure={() => onConfigureSubdomain?.(subdomain.domain)}
                onVisit={() => window.open(`https://${subdomain.domain}`, '_blank')}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium text-blue-900">Independent Domain Management</div>
              <div className="text-sm text-blue-700">
                Each domain can have its own tech stack, health monitoring, and healing settings. 
                Diagnose and configure them independently based on their specific requirements.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
