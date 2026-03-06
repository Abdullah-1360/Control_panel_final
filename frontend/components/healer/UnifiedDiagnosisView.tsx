'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface UnifiedDiagnosisViewProps {
  siteId: string;
  selectedSubdomain?: string;
}

export function UnifiedDiagnosisView({ siteId, selectedSubdomain }: UnifiedDiagnosisViewProps) {
  const queryClient = useQueryClient();
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Diagnose mutation
  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/diagnose`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subdomain: selectedSubdomain !== '__main__' ? selectedSubdomain : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Diagnosis failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setDiagnosisResult(data.data || data);
      toast.success('Diagnosis completed successfully');
      queryClient.invalidateQueries({ queryKey: ['healer-site', siteId] });
    },
    onError: (error: Error) => {
      toast.error(`Diagnosis failed: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Diagnosis Action */}
      {!diagnosisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Run Full Diagnosis
            </CardTitle>
            <CardDescription>
              Comprehensive analysis with all checks enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This will run a complete diagnosis including:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Availability & accessibility checks</li>
                <li>Core WordPress integrity verification</li>
                <li>Configuration validation</li>
                <li>Database health analysis</li>
                <li>Performance & resource monitoring</li>
                <li>Plugin & theme analysis</li>
                <li>Error log analysis</li>
                <li>Security hardening checks</li>
              </ul>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => diagnoseMutation.mutate()}
              disabled={diagnoseMutation.isPending || diagnoseMutation.isSuccess}
            >
              {diagnoseMutation.isPending ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" />
                  Running Diagnosis...
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  Start Diagnosis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Results */}
      {diagnosisResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Diagnosis Results</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDiagnosisResult(null);
                  }}
                >
                  Run New Diagnosis
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Health Score */}
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary">
                    {diagnosisResult.healthScore}
                  </div>
                  <div className="text-sm text-muted-foreground">Health Score</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <div className="text-2xl font-bold text-red-600">
                      {diagnosisResult.criticalIssues}
                    </div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                    <div className="text-2xl font-bold text-yellow-600">
                      {diagnosisResult.warningIssues}
                    </div>
                    <div className="text-xs text-muted-foreground">Warnings</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <div className="text-2xl font-bold text-blue-600">
                      {diagnosisResult.checksRun?.length || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Checks Run</div>
                  </div>
                </div>
              </div>

              {/* Check Results */}
              {diagnosisResult.checkResults && diagnosisResult.checkResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Check Results</h4>
                  <div className="space-y-2">
                    {diagnosisResult.checkResults.map((check: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              check.status === 'PASS'
                                ? 'default'
                                : check.status === 'FAIL'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {check.status}
                          </Badge>
                          <div>
                            <div className="font-medium text-sm">{check.checkType}</div>
                            <div className="text-xs text-muted-foreground">{check.message}</div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {check.duration}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {diagnosisResult.suggestedAction && (
                <div className="mt-6 p-4 rounded-lg bg-muted">
                  <h4 className="font-semibold text-sm mb-2">Suggested Action</h4>
                  <p className="text-sm text-muted-foreground">
                    {diagnosisResult.suggestedAction}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Healing Actions */}
          {diagnosisResult.canAutoHeal && (
            <Card>
              <CardHeader>
                <CardTitle>Auto-Healing Available</CardTitle>
                <CardDescription>
                  This issue can be automatically fixed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="lg" className="w-full">
                  <Wrench className="mr-2 h-4 w-4" />
                  Start Auto-Healing
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
