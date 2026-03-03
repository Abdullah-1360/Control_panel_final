'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Activity, Terminal, Wrench, History, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiagnosisPanelExtensive } from './DiagnosisPanelExtensive';
import { HealingProgress } from './HealingProgress';
import { ExecutionLogs } from './ExecutionLogs';
import { SkeletonCard, SkeletonStats } from '@/components/ui/skeleton';
import { HealthScoreRing } from '@/components/ui/progress-ring';
import { StatusCard } from '@/components/ui/status-card';

interface SiteDetailViewProps {
  siteId: string;
  onBack: () => void;
}

export function SiteDetailView({ siteId, onBack }: SiteDetailViewProps) {
  const queryClient = useQueryClient();
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'history'>('diagnosis');
  const [selectedProfile, setSelectedProfile] = useState<'FULL' | 'LIGHT' | 'QUICK' | 'CUSTOM'>('FULL');
  const [selectedSubdomain, setSelectedSubdomain] = useState<string>('__main__');

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Fetch site details
  const { data: site, isLoading: isSiteLoading, isFetching: isSiteFetching } = useQuery({
    queryKey: ['healer-site', siteId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch site');
      const result = await response.json();
      return result.data || result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Fetch subdomains
  const { data: subdomainsData, isLoading: isLoadingSubdomains } = useQuery({
    queryKey: ['healer-subdomains', siteId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/subdomains`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subdomains');
      }

      return response.json();
    },
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch execution details (real-time polling)
  const { data: execution } = useQuery({
    queryKey: ['healer-execution', executionId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/executions/${executionId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch execution');
      const result = await response.json();
      return result.data || result;
    },
    enabled: !!executionId,
    refetchInterval: (query) => {
      // Stop polling when healing is complete
      const status = query.state.data?.status;
      if (status === 'SUCCESS' || status === 'FAILED' || status === 'ROLLED_BACK') {
        return false;
      }
      return 2000; // Poll every 2 seconds during healing
    },
  });

  // Diagnose mutation
  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const subdomain = selectedSubdomain === '__main__' ? undefined : selectedSubdomain;
      const body = {
        profile: selectedProfile,
        ...(subdomain ? { subdomain } : {}),
      };
      
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/diagnose`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to diagnose site');
      const result = await response.json();
      return result.data || result;
    },
    onSuccess: (data) => {
      setExecutionId(data.executionId);
      setDiagnosis(data.diagnosis);
      toast.success(`${selectedProfile} diagnosis completed!`);
    },
    onError: (error: any) => {
      toast.error(`Diagnosis failed: ${error.message}`);
    },
  });

  // Heal mutation
  const healMutation = useMutation({
    mutationFn: async (customCommands?: string[]) => {
      const body: any = { executionId };
      if (customCommands && customCommands.length > 0) {
        body.customCommands = customCommands;
      }
      
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/heal`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start healing');
      }
      const result = await response.json();
      return result.data || result;
    },
    onSuccess: () => {
      toast.success('Healing started!');
      queryClient.invalidateQueries({ queryKey: ['healer-execution', executionId] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Healing failed';
      
      // Check if it's a circuit breaker error
      if (errorMessage.includes('Circuit breaker') || errorMessage.includes('max healing attempts')) {
        toast.error(
          <div className="space-y-2">
            <p className="font-semibold">Circuit Breaker Triggered</p>
            <p className="text-sm">{errorMessage}</p>
            <p className="text-xs text-muted-foreground">
              Tip: Use custom commands to bypass the circuit breaker, or reset it below.
            </p>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.error(`Healing failed: ${errorMessage}`);
      }
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `http://localhost:3001/api/v1/healer/sites/${siteId}/rollback/${executionId}`,
        { 
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('Failed to rollback');
      const result = await response.json();
      return result.data || result;
    },
    onSuccess: () => {
      toast.success('Rollback completed!');
      queryClient.invalidateQueries({ queryKey: ['healer-execution', executionId] });
    },
    onError: (error: any) => {
      toast.error(`Rollback failed: ${error.message}`);
    },
  });

  // Reset circuit breaker mutation
  const resetCircuitBreakerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `http://localhost:3001/api/v1/healer/sites/${siteId}/reset-circuit-breaker`,
        { 
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('Failed to reset circuit breaker');
      const result = await response.json();
      return result.data || result;
    },
    onSuccess: () => {
      toast.success('Circuit breaker reset! You can now try healing again.');
      queryClient.invalidateQueries({ queryKey: ['healer-site', siteId] });
    },
    onError: (error: any) => {
      toast.error(`Reset failed: ${error.message}`);
    },
  });

  // Don't automatically reset diagnosis state - let user decide
  // useEffect removed - user will manually start new diagnosis

  // Reset diagnosis state when subdomain changes
  useEffect(() => {
    // Reset diagnosis when subdomain changes
    setDiagnosis(null);
    setExecutionId(null);
  }, [selectedSubdomain]);

  // Manual reset function
  const handleStartNewDiagnosis = () => {
    setDiagnosis(null);
    setExecutionId(null);
    toast.info('Ready for new diagnosis');
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700';
      case 'DOWN':
        return 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700';
      case 'DEGRADED':
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700';
      case 'MAINTENANCE':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700';
      case 'HEALING':
        return 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 animate-pulse';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return '✅';
      case 'DOWN':
        return '🔴';
      case 'DEGRADED':
        return '⚠️';
      case 'MAINTENANCE':
        return '🔧';
      case 'HEALING':
        return '🔄';
      default:
        return '❓';
    }
  };

  const subdomains = subdomainsData?.data || [];
  const currentDomain = selectedSubdomain === '__main__' ? site?.domain : selectedSubdomain;

  // Show enhanced loading state with skeleton
  if (isSiteLoading && !site) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
        <div className="container mx-auto px-6 py-8 space-y-8">
          {/* Header Skeleton */}
          <div className="bg-card/60 backdrop-blur-sm border rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sites
                </Button>
                <SkeletonCard />
              </div>
              <SkeletonStats />
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error state
  if (!site) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
        <div className="container mx-auto px-6 py-8">
          <div className="bg-card/60 backdrop-blur-sm border rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sites
              </Button>
            </div>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🚫</div>
              <h2 className="text-2xl font-bold mb-2">Site Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The requested site could not be loaded. It may have been removed or you may not have access.
              </p>
              <Button onClick={onBack} variant="default">
                Return to Sites List
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Enhanced Header with Better Visual Hierarchy */}
        <div className="bg-card/60 backdrop-blur-sm border rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack}
                className="hover:bg-primary/10 transition-all duration-200 hover:scale-105"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sites
              </Button>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                      {site?.domain}
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium">{site?.path}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Health Status</div>
                  <Badge 
                    className={`${getHealthStatusColor(site?.healthStatus)} text-white font-semibold px-3 py-1 shadow-sm`}
                  >
                    {site?.healthStatus}
                  </Badge>
                </div>
                {site?.healthScore && (
                  <HealthScoreRing score={site.healthScore} size={100} />
                )}
              </div>
            </div>
          </div>
          
          {/* Enhanced Site Metadata */}
          {site && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2 text-sm">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Platform:</span>
                  <span className="font-medium">{site.platformType}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{site.status}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last Check:</span>
                  <span className="font-medium">
                    {site.lastChecked ? new Date(site.lastChecked).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Domain:</span>
                  <span className="font-medium">{currentDomain}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Enhanced Site Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard
            title="Server Host"
            value={site?.server?.host || 'Unknown'}
            status="info"
            icon={<Server className="h-4 w-4" />}
            description="Primary server location"
          />
          <StatusCard
            title="WordPress Version"
            value={site?.wpVersion || 'Unknown'}
            status={site?.wpVersion ? 'success' : 'warning'}
            icon={<Globe className="h-4 w-4" />}
            description="Current WP installation"
          />
          <StatusCard
            title="PHP Version"
            value={site?.phpVersion || 'Unknown'}
            status={site?.phpVersion ? 'success' : 'warning'}
            icon={<Terminal className="h-4 w-4" />}
            description="Server PHP version"
          />
          <StatusCard
            title="Healing Mode"
            value={site?.healingMode || 'AUTO'}
            status="neutral"
            icon={<Wrench className="h-4 w-4" />}
            description="Current healing strategy"
          />
        </div>

        {/* Healing Attempts Status */}
        {site && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatusCard
              title="Healing Attempts"
              value={`${site?.healingAttempts || 0} / ${site?.maxHealingAttempts || 5}`}
              status={
                (site?.healingAttempts || 0) >= (site?.maxHealingAttempts || 5) ? 'error' :
                (site?.healingAttempts || 0) > 0 ? 'warning' : 'success'
              }
              icon={<Activity className="h-4 w-4" />}
              description="Circuit breaker status"
            />
            {site?.healingAttempts >= site?.maxHealingAttempts && (
              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => resetCircuitBreakerMutation.mutate()}
                  disabled={resetCircuitBreakerMutation.isPending}
                  className="bg-gradient-to-r from-red-500/10 to-red-600/10 border-red-500/20 hover:from-red-500/20 hover:to-red-600/20"
                >
                  {resetCircuitBreakerMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500 mr-2"></div>
                      Resetting Circuit Breaker...
                    </>
                  ) : (
                    <>
                      <Wrench className="mr-2 h-4 w-4" />
                      Reset Circuit Breaker
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Subdomain Selection */}
        <div className="bg-card/60 backdrop-blur-sm border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Domain Selection</h3>
                <p className="text-sm text-muted-foreground">Choose which domain to diagnose</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['healer-subdomains', siteId] });
                toast.success('Refreshing domains...');
              }}
              disabled={isLoadingSubdomains}
              className="hover:bg-primary/10 transition-colors"
            >
              <Activity className="mr-2 h-4 w-4" />
              {isLoadingSubdomains ? 'Detecting...' : 'Refresh Domains'}
            </Button>
          </div>
          
          {isLoadingSubdomains ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Detecting domains...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <Select value={selectedSubdomain} onValueChange={setSelectedSubdomain}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__main__">
                    <div className="flex items-center gap-3 py-2">
                      <div className="p-1 bg-primary/20 rounded">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium">Main Domain</span>
                        <p className="text-xs text-muted-foreground">{site?.domain}</p>
                      </div>
                    </div>
                  </SelectItem>
                  {subdomains.map((sub: any) => (
                    <SelectItem key={sub.subdomain} value={sub.subdomain}>
                      <div className="flex items-center gap-3 py-2">
                        <div className="p-1 bg-blue-500/20 rounded">
                          <Globe className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{sub.subdomain}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {sub.type && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                sub.type === 'subdomain' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              }`}>
                                {sub.type}
                              </span>
                            )}
                            {sub.hasWordPress && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                WordPress
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-sm">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Currently selected:</span>
                  <span className="font-medium text-primary">{currentDomain}</span>
                </div>
                {subdomains.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Found {subdomains.filter((s: any) => s.type === 'subdomain').length} subdomain(s) and {subdomains.filter((s: any) => s.type === 'addon').length} addon domain(s)
                  </div>
                )}
                {subdomains.length === 0 && !isLoadingSubdomains && (
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    No additional domains detected. Click "Refresh Domains" to scan again.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Diagnosis Tabs */}
        <div className="bg-card/40 backdrop-blur-sm border rounded-xl p-1 shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'diagnosis' | 'history')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-12">
              <TabsTrigger 
                value="diagnosis" 
                className="flex items-center space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
              >
                <div className="p-1 rounded bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">Diagnosis & Healing</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="flex items-center space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
              >
                <div className="p-1 rounded bg-primary/10">
                  <History className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">Execution History</span>
              </TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="diagnosis" className="space-y-6 mt-0">
                {/* Enhanced Profile Selection */}
                {!diagnosis && !executionId && (
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="p-2 bg-primary/20 rounded-lg">
                        <Wrench className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">WordPress Diagnosis</h3>
                        <p className="text-sm text-muted-foreground">Select a diagnosis profile to analyze your site</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {[
                        {
                          value: 'FULL',
                          title: 'Full Diagnosis',
                          description: 'Comprehensive analysis with all checks',
                          duration: '~2-3 minutes',
                          icon: '🔍',
                          color: 'from-blue-500/10 to-blue-600/10 border-blue-500/20'
                        },
                        {
                          value: 'LIGHT',
                          title: 'Light Diagnosis',
                          description: 'Critical checks only for quick assessment',
                          duration: '~1 minute',
                          icon: '⚡',
                          color: 'from-green-500/10 to-green-600/10 border-green-500/20'
                        },
                        {
                          value: 'QUICK',
                          title: 'Quick Check',
                          description: 'HTTP status and maintenance mode only',
                          duration: '~30 seconds',
                          icon: '🚀',
                          color: 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/20'
                        },
                        {
                          value: 'CUSTOM',
                          title: 'Custom Profile',
                          description: 'Select specific checks to run',
                          duration: 'Variable',
                          icon: '⚙️',
                          color: 'from-purple-500/10 to-purple-600/10 border-purple-500/20'
                        }
                      ].map((profile) => (
                        <div
                          key={profile.value}
                          className={`bg-gradient-to-r ${profile.color} border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105 ${
                            selectedProfile === profile.value ? 'ring-2 ring-primary shadow-lg' : ''
                          }`}
                          onClick={() => setSelectedProfile(profile.value as any)}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">{profile.icon}</div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm">{profile.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{profile.description}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <span className="text-xs bg-background/50 px-2 py-1 rounded">{profile.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-center">
                      <Button
                        onClick={() => diagnoseMutation.mutate()}
                        disabled={diagnoseMutation.isPending}
                        size="lg"
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        {diagnoseMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Running {selectedProfile} Diagnosis...
                          </>
                        ) : (
                          <>
                            <Activity className="mr-2 h-4 w-4" />
                            Start {selectedProfile} Diagnosis
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

          {/* Diagnosis Results */}
          {diagnosis && !execution && (
            <>
              <DiagnosisPanelExtensive
                diagnosis={diagnosis}
                onFix={(customCommands) => healMutation.mutate(customCommands)}
                isHealing={healMutation.isPending || execution?.status === 'HEALING'}
                siteId={siteId}
              />
              {diagnosis.diagnosisType === 'HEALTHY' && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleStartNewDiagnosis}
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Start New Diagnosis
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Show diagnosis with healing in progress */}
          {diagnosis && execution && (
            <DiagnosisPanelExtensive
              diagnosis={diagnosis}
              onFix={(customCommands) => healMutation.mutate(customCommands)}
              isHealing={healMutation.isPending || execution?.status === 'HEALING'}
              siteId={siteId}
            />
          )}

          {/* Healing Progress */}
          {execution && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HealingProgress
                status={execution.status}
                startedAt={execution.startedAt}
                finishedAt={execution.finishedAt}
              />
              <ExecutionLogs 
                logs={typeof execution.executionLogs === 'string' 
                  ? JSON.parse(execution.executionLogs || '[]')
                  : (execution.executionLogs || [])} 
              />
            </div>
          )}

          {/* Action Buttons after Healing Completes */}
          {execution?.status === 'SUCCESS' && (
            <div className="flex justify-center gap-4">
              <Button
                variant="default"
                onClick={handleStartNewDiagnosis}
              >
                <Activity className="mr-2 h-4 w-4" />
                Start New Diagnosis
              </Button>
            </div>
          )}

          {/* Rollback Button */}
          {execution?.status === 'FAILED' && execution?.backupId && (
            <div className="flex justify-center gap-4">
              <Button
                variant="destructive"
                onClick={() => rollbackMutation.mutate()}
                disabled={rollbackMutation.isPending}
              >
                {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback to Backup'}
              </Button>
              <Button
                variant="outline"
                onClick={handleStartNewDiagnosis}
              >
                <Activity className="mr-2 h-4 w-4" />
                Start New Diagnosis
              </Button>
            </div>
          )}

          {/* Start New Diagnosis after Rollback */}
          {execution?.status === 'ROLLED_BACK' && (
            <div className="flex justify-center">
              <Button
                variant="default"
                onClick={handleStartNewDiagnosis}
              >
                <Activity className="mr-2 h-4 w-4" />
                Start New Diagnosis
              </Button>
            </div>
          )}
        </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="bg-gradient-to-r from-muted/30 to-muted/10 border rounded-xl p-8 text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-bold mb-2">History Coming Soon</h3>
                  <p className="text-muted-foreground mb-4">
                    View past diagnosis results, health score trends, and healing history
                  </p>
                  <div className="text-sm text-muted-foreground">
                    This feature will include:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Historical health scores and trends</li>
                      <li>Past diagnosis results comparison</li>
                      <li>Healing success/failure rates</li>
                      <li>Performance metrics over time</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
