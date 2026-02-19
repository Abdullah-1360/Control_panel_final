'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Zap, Clock, Settings, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface UnifiedDiagnosisViewProps {
  siteId: string;
  selectedSubdomain?: string;
}

type DiagnosisProfile = 'FULL' | 'LIGHT' | 'QUICK' | 'CUSTOM';

const PROFILE_INFO = {
  FULL: {
    icon: Activity,
    label: 'Full Diagnosis',
    description: 'Comprehensive analysis with all checks (120s timeout)',
    color: 'blue',
    checks: 'All checks enabled',
    cache: 'No caching',
    useCase: 'Manual troubleshooting, deep investigation',
  },
  LIGHT: {
    icon: Zap,
    label: 'Light Diagnosis',
    description: 'Critical checks only (60s timeout)',
    color: 'green',
    checks: 'Critical checks only',
    cache: '5-minute cache',
    useCase: 'Scheduled monitoring, quick health check',
  },
  QUICK: {
    icon: Clock,
    label: 'Quick Check',
    description: 'Fast feedback with minimal checks (30s timeout)',
    color: 'yellow',
    checks: 'HTTP status + maintenance mode',
    cache: '1-minute cache',
    useCase: 'Rapid status verification',
  },
  CUSTOM: {
    icon: Settings,
    label: 'Custom Diagnosis',
    description: 'Select specific checks to run',
    color: 'purple',
    checks: 'User-defined',
    cache: 'No caching',
    useCase: 'Targeted investigation',
  },
};

export function UnifiedDiagnosisView({ siteId, selectedSubdomain }: UnifiedDiagnosisViewProps) {
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<DiagnosisProfile>('FULL');
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
          profile: selectedProfile,
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

  // Get available profiles
  const { data: profiles } = useQuery({
    queryKey: ['diagnosis-profiles'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/api/v1/healer/profiles', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch profiles');
      const result = await response.json();
      return result.data || result;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const profileInfo = PROFILE_INFO[selectedProfile];
  const ProfileIcon = profileInfo.icon;

  return (
    <div className="space-y-6">
      {/* Profile Selection */}
      {!diagnosisResult && (
        <Card>
          <CardHeader>
            <CardTitle>Select Diagnosis Profile</CardTitle>
            <CardDescription>
              Choose the depth and scope of analysis based on your needs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(PROFILE_INFO) as DiagnosisProfile[]).map((profile) => {
                const info = PROFILE_INFO[profile];
                const Icon = info.icon;
                const isSelected = selectedProfile === profile;

                return (
                  <Card
                    key={profile}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary shadow-lg'
                        : 'hover:shadow-md hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedProfile(profile)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Icon className={`h-5 w-5 text-${info.color}-500`} />
                        {isSelected && (
                          <Badge variant="default" className="text-xs">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">{info.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">{info.description}</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Checks:</span> {info.checks}
                        </div>
                        <div>
                          <span className="font-medium">Cache:</span> {info.cache}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Selected Profile Details */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-background">
                    <ProfileIcon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{profileInfo.label}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{profileInfo.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Use Case:</span>
                        <p className="text-muted-foreground">{profileInfo.useCase}</p>
                      </div>
                      <div>
                        <span className="font-medium">Checks Included:</span>
                        <p className="text-muted-foreground">{profileInfo.checks}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Start Diagnosis Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => diagnoseMutation.mutate()}
                disabled={diagnoseMutation.isPending}
                size="lg"
                className="min-w-[200px]"
              >
                <Activity className="mr-2 h-4 w-4" />
                {diagnoseMutation.isPending ? 'Running Diagnosis...' : 'Start Diagnosis'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Results */}
      {diagnosisResult && (
        <div className="space-y-6">
          {/* Health Score Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Diagnosis Results</CardTitle>
                  <CardDescription>
                    Profile: {PROFILE_INFO[diagnosisResult.profile]?.label || diagnosisResult.profile}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDiagnosisResult(null);
                    setSelectedProfile('FULL');
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
