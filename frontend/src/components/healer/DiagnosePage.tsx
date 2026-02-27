/**
 * Diagnose Page Component
 * 
 * Page for running diagnostics and viewing results
 */

'use client';

import { useState, useEffect } from 'react';
import { Application, DiagnosticResult } from '@/lib/api/healer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DiagnosticCheckList } from './DiagnosticCheckList';
import { 
  RefreshCw, 
  Activity, 
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDiagnoseApplication, useDiagnostics } from '@/hooks/use-healer';
import { useToast } from '@/hooks/use-toast';

interface DiagnosePageProps {
  application: Application;
  onBack?: () => void;
}

export function DiagnosePage({ 
  application,
  onBack 
}: DiagnosePageProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  
  const diagnoseMutation = useDiagnoseApplication();
  
  // Fetch existing diagnostics
  const { data: diagnosticsData, refetch } = useDiagnostics(application.id);
  const results = diagnosticsData?.results || [];

  const handleRunDiagnosis = async () => {
    setIsRunning(true);
    try {
      await diagnoseMutation.mutateAsync({
        id: application.id,
        data: {},
      });
      
      toast({
        title: 'Diagnosis Started',
        description: 'Running diagnostic checks...',
      });
      
      // Wait a bit then refetch
      setTimeout(async () => {
        await refetch();
        setIsRunning(false);
        toast({
          title: 'Diagnosis Complete',
          description: 'Diagnostic results updated',
        });
      }, 2000);
    } catch (error: any) {
      toast({
        title: 'Diagnosis Failed',
        description: error.message || 'Failed to run diagnosis',
        variant: 'destructive',
      });
      setIsRunning(false);
    }
  };

  // Calculate statistics
  const stats = results.reduce(
    (acc, result) => {
      acc.total++;
      if (result.status === 'PASS') acc.passed++;
      if (result.status === 'FAIL') acc.failed++;
      if (result.status === 'WARN') acc.warnings++;
      if (result.severity === 'CRITICAL') acc.critical++;
      if (result.severity === 'HIGH') acc.high++;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, warnings: 0, critical: 0, high: 0 }
  );

  // Transform results to match DiagnosticCheckList format
  const transformedChecks = results.map(result => ({
    checkName: result.checkName,
    category: result.checkCategory as any,
    status: result.status as any,
    severity: result.severity as any,
    message: result.message,
    details: result.details || {},
    executionTime: result.executionTime,
    suggestedFix: result.suggestedFix || undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Diagnostic Results</h2>
          <p className="text-muted-foreground mt-1">
            {application.domain} - {application.path}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button 
            onClick={handleRunDiagnosis} 
            disabled={isRunning}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRunning && 'animate-spin')} />
            {isRunning ? 'Running...' : 'Run Diagnosis'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Checks</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Passed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical/High</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.critical + stats.high}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last Diagnosed Info */}
      {application.lastDiagnosedAt && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Last diagnosed: {new Date(application.lastDiagnosedAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnostic Results */}
      {results.length > 0 ? (
        <DiagnosticCheckList 
          checks={transformedChecks} 
          applicationId={application.id}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Diagnostic Results</CardTitle>
            <CardDescription>
              Run a diagnosis to see detailed check results for this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                Click "Run Diagnosis" to start checking your application's health.
              </p>
              <Button onClick={handleRunDiagnosis} disabled={isRunning}>
                <RefreshCw className={cn('h-4 w-4 mr-2', isRunning && 'animate-spin')} />
                {isRunning ? 'Running...' : 'Run Diagnosis'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
