'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { DiscoveredApplicationsList } from './DiscoveredApplicationsList';

export function DiscoveryMonitoringDashboard() {
  // Fetch queue statistics
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['discovery-stats'],
    queryFn: () => apiClient.getDiscoveryStats(),
    refetchInterval: 3000, // Poll every 3 seconds
    retry: 3,
  });

  // Fetch recent discoveries
  const { data: recentJobs, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['recent-discoveries'],
    queryFn: () => apiClient.getRecentDiscoveries(10),
    refetchInterval: 3000, // Poll every 3 seconds
    retry: 3,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PARTIAL':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      FAILED: 'destructive',
      PARTIAL: 'secondary',
      PROCESSING: 'outline',
      QUEUED: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const calculateSuccessRate = () => {
    if (!stats) return 0;
    const total = stats.discovery.completed + stats.discovery.failed;
    if (total === 0) return 0;
    return Math.round((stats.discovery.completed / total) * 100);
  };

  if (statsLoading || jobsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading queue statistics...</span>
      </div>
    );
  }

  if (statsError || jobsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load discovery queue data. Please check if the backend is running.
          <br />
          <span className="text-xs mt-2 block">
            Error: {(statsError as any)?.message || (jobsError as any)?.message || 'Unknown error'}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            {(stats?.discovery.active || 0) > 0 ? (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.discovery.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.metadata.active || 0} metadata, {stats?.subdomain.active || 0} subdomain
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queued</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.discovery.waiting || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.metadata.waiting || 0} metadata, {stats?.subdomain.waiting || 0} subdomain
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.discovery.completed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total successful discoveries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calculateSuccessRate()}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.discovery.failed || 0} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Discoveries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Discoveries</CardTitle>
          <CardDescription>
            Latest discovery jobs and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recentJobs || recentJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent discoveries
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(job.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{job.serverName}</p>
                        {getStatusBadge(job.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.applicationsFound} applications found
                      </p>
                      {job.error && (
                        <p className="text-sm text-red-500 mt-1">{job.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Progress value={job.progress} className="w-24" />
                      <span className="text-sm text-muted-foreground">
                        {job.progress}%
                      </span>
                    </div>
                    {job.completedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(job.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discovered Applications List */}
      <DiscoveredApplicationsList />
    </div>
  );
}
