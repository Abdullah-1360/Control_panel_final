'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DiagnosisPanel } from '@/components/healer/DiagnosisPanel';
import { HealingProgress } from '@/components/healer/HealingProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Activity, Globe, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DiagnosePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const siteId = params.id as string;

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [selectedSubdomain, setSelectedSubdomain] = useState<string>('');

  // Fetch site details
  const { data: siteData, isLoading: isLoadingSite } = useQuery({
    queryKey: ['healer-site', siteId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/healer/sites/${siteId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch site');
      }

      return response.json();
    },
  });

  // Fetch subdomains
  const { data: subdomainsData, isLoading: isLoadingSubdomains } = useQuery({
    queryKey: ['healer-subdomains', siteId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/healer/sites/${siteId}/subdomains`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subdomains');
      }

      return response.json();
    },
    enabled: !!siteId,
  });

  // Fetch execution details (includes diagnosis)
  const { data: executionData, isLoading: isLoadingExecution } = useQuery({
    queryKey: ['healer-execution', executionId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/healer/executions/${executionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch execution');
      }

      return response.json();
    },
    enabled: !!executionId,
    refetchInterval: (data) => {
      // Stop polling if execution is complete
      const status = data?.data?.status;
      if (status === 'SUCCESS' || status === 'FAILED' || status === 'ROLLED_BACK') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Trigger diagnosis mutation
  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const body = selectedSubdomain ? { subdomain: selectedSubdomain } : {};
      
      const response = await fetch(`/api/v1/healer/sites/${siteId}/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to diagnose site');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setExecutionId(data.data.executionId);
      toast({
        title: 'Diagnosis Complete',
        description: `Site diagnosis completed successfully${selectedSubdomain ? ` for ${selectedSubdomain}` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['healer-site', siteId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Diagnosis Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Trigger healing mutation
  const healMutation = useMutation({
    mutationFn: async (customCommands?: string[]) => {
      const response = await fetch(`/api/v1/healer/sites/${siteId}/heal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          executionId,
          customCommands,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start healing');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Healing Started',
        description: 'Healing process has been initiated',
      });
      queryClient.invalidateQueries({ queryKey: ['healer-execution', executionId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Healing Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDiagnose = () => {
    diagnoseMutation.mutate();
  };

  const handleBack = () => {
    router.push('/healer');
  };

  if (isLoadingSite) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const site = siteData?.data;
  const subdomains = subdomainsData?.data || [];
  const hasSubdomains = subdomains.length > 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{site?.domain}</h1>
          <p className="text-muted-foreground">Site Diagnosis</p>
        </div>
        <Button
          onClick={handleDiagnose}
          disabled={diagnoseMutation.isPending || site?.techStack !== 'WORDPRESS'}
          title={site?.techStack !== 'WORDPRESS' ? 'Only WordPress sites are supported for diagnosis' : 'Run comprehensive health diagnosis'}
        >
          {diagnoseMutation.isPending && (
            <Activity className="mr-2 h-4 w-4 animate-spin" />
          )}
          Run Diagnosis
        </Button>
      </div>
      
      {/* WordPress-only notice */}
      {site && site.techStack !== 'WORDPRESS' && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900">WordPress Sites Only</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Diagnosis is currently only supported for WordPress sites.
            {site.techStack === 'UNKNOWN' && ' Please detect the tech stack first.'}
            {site.techStack !== 'UNKNOWN' && site.techStack !== 'WORDPRESS' && ' Support for other platforms is coming soon.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Subdomain Selection Card */}
      {hasSubdomains && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Select Domain/Subdomain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Select value={selectedSubdomain} onValueChange={setSelectedSubdomain}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Main Domain (Root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
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
                        {sub.hasWordPress && (
                          <span className="text-xs text-green-600">(WordPress detected)</span>
                        )}
                        {!sub.hasWordPress && (
                          <span className="text-xs text-muted-foreground">(No WordPress)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {selectedSubdomain 
                  ? `Diagnosing: ${selectedSubdomain}` 
                  : `Diagnosing: ${site?.domain} (Main Domain)`}
              </p>
              {isLoadingSubdomains && (
                <p className="text-sm text-muted-foreground">Loading subdomains...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Server</p>
            <p className="font-medium">{site?.server?.hostname}</p>
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
            <p className="text-sm text-muted-foreground">Health Status</p>
            <p className="font-medium">{site?.healthStatus}</p>
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis Result or Progress */}
      {executionData?.data ? (
        <div className="space-y-6">
          {/* Show Diagnosis Panel */}
          {executionData.data.diagnosisDetails && (
            <DiagnosisPanel
              diagnosis={JSON.parse(executionData.data.diagnosisDetails)}
              onFix={() => healMutation.mutate()}
              isHealing={healMutation.isPending || ['HEALING', 'VERIFYING'].includes(executionData.data.status)}
              siteId={siteId}
            />
          )}

          {/* Show Healing Progress if healing started */}
          {['APPROVED', 'HEALING', 'VERIFYING', 'SUCCESS', 'FAILED', 'ROLLED_BACK'].includes(executionData.data.status) && (
            <HealingProgress 
              status={executionData.data.status}
              startedAt={executionData.data.createdAt}
              finishedAt={executionData.data.finishedAt}
            />
          )}
        </div>
      ) : diagnoseMutation.isPending ? (
        <Alert>
          <Activity className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Analyzing logs and diagnosing issues{selectedSubdomain ? ` for ${selectedSubdomain}` : ''}...
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertDescription>
            {hasSubdomains 
              ? 'Select a domain/subdomain above and click "Run Diagnosis" to analyze site health.' 
              : 'Click "Run Diagnosis" to analyze site health and detect issues.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
