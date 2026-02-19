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
import { toast } from 'sonner';

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
        return 'bg-green-500';
      case 'DOWN':
        return 'bg-red-500';
      case 'DEGRADED':
        return 'bg-yellow-500';
      case 'MAINTENANCE':
        return 'bg-blue-500';
      case 'HEALING':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const subdomains = subdomainsData?.data || [];
  const currentDomain = selectedSubdomain === '__main__' ? site?.domain : selectedSubdomain;

  // Show loading state only on initial load, not during tab switches
  if (isSiteLoading && !site) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-muted-foreground">Loading site details...</div>
        </div>
      </div>
    );
  }

  // If site data is not available after loading, show error
  if (!site) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-destructive">Failed to load site details</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{site?.domain}</h1>
          <p className="text-muted-foreground">{site?.path}</p>
        </div>
        <Badge className={getHealthStatusColor(site?.healthStatus)}>
          {site?.healthStatus}
        </Badge>
      </div>

      {/* Site Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Server</p>
            <p className="font-medium">{site?.server?.host}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">WordPress Version</p>
            <p className="font-medium">{site?.wpVersion || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">PHP Version</p>
            <p className="font-medium">{site?.phpVersion || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Healing Mode</p>
            <p className="font-medium">{site?.healingMode}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Healing Attempts</p>
            <p className="font-medium">{site?.healingAttempts || 0} / {site?.maxHealingAttempts || 5}</p>
          </div>
          <div className="col-span-2 md:col-span-3 flex items-center gap-2">
            {site?.healingAttempts >= site?.maxHealingAttempts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetCircuitBreakerMutation.mutate()}
                disabled={resetCircuitBreakerMutation.isPending}
              >
                {resetCircuitBreakerMutation.isPending ? 'Resetting...' : 'Reset Circuit Breaker'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subdomain Selection - Always show */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Select Domain/Subdomain
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['healer-subdomains', siteId] });
                toast.success('Refreshing domains...');
              }}
              disabled={isLoadingSubdomains}
            >
              <Activity className="mr-2 h-4 w-4" />
              {isLoadingSubdomains ? 'Detecting...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoadingSubdomains ? (
            <div className="text-sm text-muted-foreground">Detecting domains...</div>
          ) : (
            <>
              <Select value={selectedSubdomain} onValueChange={setSelectedSubdomain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__main__">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Main Domain: {site?.domain}</span>
                    </div>
                  </SelectItem>
                  {subdomains.map((sub: any) => (
                    <SelectItem key={sub.subdomain} value={sub.subdomain}>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>{sub.subdomain}</span>
                        {sub.type && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            sub.type === 'subdomain' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {sub.type}
                          </span>
                        )}
                        {sub.hasWordPress && (
                          <span className="text-xs text-green-600">(WordPress)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Currently selected: {currentDomain}
              </p>
              {subdomains.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {subdomains.filter((s: any) => s.type === 'subdomain').length} subdomain(s), {subdomains.filter((s: any) => s.type === 'addon').length} addon domain(s)
                </p>
              )}
              {subdomains.length === 0 && !isLoadingSubdomains && (
                <p className="text-xs text-yellow-600">
                  No additional domains detected. Click Refresh to detect again.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Diagnosis Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'diagnosis' | 'history')} className="scroll-mt-6">
        <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-background">
          <TabsTrigger value="diagnosis">
            <Activity className="mr-2 h-4 w-4" />
            Diagnosis
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnosis" className="space-y-6">
          {/* Profile Selection */}
          {!diagnosis && !executionId && (
            <Card>
              <CardHeader>
                <CardTitle>Select Diagnosis Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedProfile} onValueChange={(v) => setSelectedProfile(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Full Diagnosis</span>
                        <span className="text-xs text-muted-foreground">All checks, 120s timeout</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="LIGHT">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Light Diagnosis</span>
                        <span className="text-xs text-muted-foreground">Critical checks only, 60s timeout</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="QUICK">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Quick Check</span>
                        <span className="text-xs text-muted-foreground">HTTP + maintenance, 30s timeout</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="CUSTOM">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Custom</span>
                        <span className="text-xs text-muted-foreground">Select specific checks</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Ready to Diagnose</h3>
                  <p className="mt-2 text-muted-foreground">
                    {selectedProfile === 'FULL' && 'Comprehensive analysis with all checks'}
                    {selectedProfile === 'LIGHT' && 'Quick health check with critical checks only'}
                    {selectedProfile === 'QUICK' && 'Fast status verification'}
                    {selectedProfile === 'CUSTOM' && 'Custom check selection'}
                  </p>
                  <Button
                    onClick={() => diagnoseMutation.mutate()}
                    disabled={diagnoseMutation.isPending}
                    size="lg"
                    className="mt-6"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    {diagnoseMutation.isPending ? 'Diagnosing...' : `Start ${selectedProfile} Diagnosis`}
                  </Button>
                </div>
              </CardContent>
            </Card>
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

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Diagnosis History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View past diagnosis results and health score trends
              </p>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                History view coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
