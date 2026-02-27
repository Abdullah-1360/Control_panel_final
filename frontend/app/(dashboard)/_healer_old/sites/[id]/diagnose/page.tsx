'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Activity, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DiagnosisPanel } from '@/components/healer/DiagnosisPanel';
import { HealingProgress } from '@/components/healer/HealingProgress';
import { ExecutionLogs } from '@/components/healer/ExecutionLogs';
import { toast } from 'sonner';

export default function DiagnosePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const siteId = params.id as string;

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Fetch site details
  const { data: site } = useQuery({
    queryKey: ['healer-site', siteId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch site');
      const result = await response.json();
      return result.data || result;
    },
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
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/diagnose`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to diagnose site');
      const result = await response.json();
      return result.data || result;
    },
    onSuccess: (data) => {
      setExecutionId(data.executionId);
      setDiagnosis(data.diagnosis);
      toast.success('Diagnosis completed!');
    },
    onError: (error: any) => {
      toast.error(`Diagnosis failed: ${error.message}`);
    },
  });

  // Heal mutation
  const healMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/heal`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ executionId }),
      });
      if (!response.ok) throw new Error('Failed to start healing');
      const result = await response.json();
      return result.data || result;
    },
    onSuccess: () => {
      toast.success('Healing started!');
      queryClient.invalidateQueries({ queryKey: ['healer-execution', executionId] });
    },
    onError: (error: any) => {
      toast.error(`Healing failed: ${error.message}`);
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
        </CardContent>
      </Card>

      {/* Diagnose Button */}
      {!diagnosis && !executionId && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Ready to Diagnose</h3>
          <p className="mt-2 text-muted-foreground">
            Choose automatic diagnosis or manual interactive mode
          </p>
          <div className="mt-6 flex gap-4 justify-center">
            <Button
              onClick={() => diagnoseMutation.mutate()}
              disabled={diagnoseMutation.isPending}
              size="lg"
            >
              <Activity className="mr-2 h-4 w-4" />
              {diagnoseMutation.isPending ? 'Diagnosing...' : 'Auto Diagnosis'}
            </Button>
            <Button
              onClick={() => router.push(`/healer/sites/${siteId}/diagnose/manual`)}
              variant="outline"
              size="lg"
            >
              <Terminal className="mr-2 h-4 w-4" />
              Manual Diagnosis
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Manual mode lets you execute commands step-by-step and teach the system
          </p>
        </div>
      )}

      {/* Diagnosis Results */}
      {diagnosis && (
        <DiagnosisPanel
          diagnosis={diagnosis}
          onFix={() => healMutation.mutate()}
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

      {/* Rollback Button */}
      {execution?.status === 'FAILED' && execution?.backupId && (
        <div className="flex justify-center">
          <Button
            variant="destructive"
            onClick={() => rollbackMutation.mutate()}
            disabled={rollbackMutation.isPending}
          >
            {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback to Backup'}
          </Button>
        </div>
      )}
    </div>
  );
}
