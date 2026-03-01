'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface DiscoveryProgressTrackerProps {
  jobId: string;
  onComplete?: () => void;
}

export function DiscoveryProgressTracker({ jobId, onComplete }: DiscoveryProgressTrackerProps) {
  const { data: progress, isLoading } = useQuery({
    queryKey: ['discovery-progress', jobId],
    queryFn: () => apiClient.getDiscoveryProgress(jobId),
    refetchInterval: (data) => {
      // Stop polling if completed, failed, or partial
      if (data && ['COMPLETED', 'FAILED', 'PARTIAL'].includes(data.status)) {
        if (onComplete) {
          onComplete();
        }
        return false;
      }
      // Poll every 2 seconds while processing
      return 2000;
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Discovery progress not found
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'PARTIAL':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Loader2 className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      FAILED: 'destructive',
      PARTIAL: 'secondary',
      PROCESSING: 'outline',
      QUEUED: 'outline',
    };

    return (
      <Badge variant={variants[progress.status] || 'outline'}>
        {progress.status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle>Discovery Progress</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Job ID: {progress.jobId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="h-2" />
        </div>

        {/* Current Step */}
        <div className="space-y-1">
          <p className="text-sm font-medium">Current Step</p>
          <p className="text-sm text-muted-foreground">{progress.currentStep}</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Applications Found</p>
            <p className="text-2xl font-bold">{progress.applicationsFound}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Processed</p>
            <p className="text-2xl font-bold">{progress.applicationsProcessed}</p>
          </div>
        </div>

        {/* Timestamps */}
        {progress.startedAt && (
          <div className="text-sm text-muted-foreground">
            Started: {new Date(progress.startedAt).toLocaleString()}
          </div>
        )}
        {progress.completedAt && (
          <div className="text-sm text-muted-foreground">
            Completed: {new Date(progress.completedAt).toLocaleString()}
          </div>
        )}

        {/* Errors */}
        {progress.errors && progress.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Errors encountered:</p>
              <ul className="list-disc list-inside space-y-1">
                {progress.errors.slice(0, 5).map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
                {progress.errors.length > 5 && (
                  <li className="text-sm">
                    ... and {progress.errors.length - 5} more errors
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
