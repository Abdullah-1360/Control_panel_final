'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Trash2, Edit, TestTube, Activity, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Integration {
  id: string;
  name: string;
  provider: string;
  healthStatus: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'DOWN';
  isActive: boolean;
  lastTestAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string | null;
  lastTestLatency: number | null;
  createdAt: string;
}

interface IntegrationsListProps {
  onEdit: (integration: Integration) => void;
}

export function IntegrationsList({ onEdit }: IntegrationsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const response = await api.getIntegrations({ page: 1, limit: 100 });
      return response.data as Integration[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteIntegration(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: 'Integration deleted',
        description: 'The integration has been deleted successfully.',
      });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete integration',
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.testIntegration(id);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: data.success ? 'Connection successful' : 'Connection failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
      setTestingId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Test failed',
        description: error.response?.data?.message || 'Failed to test connection',
        variant: 'destructive',
      });
      setTestingId(null);
    },
  });

  const getHealthBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      HEALTHY: { variant: 'default', label: 'Healthy' },
      DEGRADED: { variant: 'secondary', label: 'Degraded' },
      DOWN: { variant: 'destructive', label: 'Down' },
      UNKNOWN: { variant: 'outline', label: 'Unknown' },
    };

    const config = variants[status] || variants.UNKNOWN;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      WHM: 'WHM',
      SMTP: 'SMTP',
      SLACK: 'Slack',
      DISCORD: 'Discord',
      ANSIBLE: 'Ansible',
      GIT_GITHUB: 'GitHub',
      GIT_GITLAB: 'GitLab',
      WHMCS: 'WHMCS',
    };
    return names[provider] || provider;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading integrations...</div>
      </div>
    );
  }

  if (!integrations || integrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No integrations yet</h3>
        <p className="text-muted-foreground text-center max-w-sm">
          Get started by adding your first integration to connect external services.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Linked Server</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Last Test</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrations.map((integration) => (
              <TableRow key={integration.id}>
                <TableCell className="font-medium">{integration.name}</TableCell>
                <TableCell>{getProviderName(integration.provider)}</TableCell>
                <TableCell>
                  {(integration as any).linkedServer?.name || (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={integration.isActive ? 'default' : 'secondary'}>
                    {integration.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>{getHealthBadge(integration.healthStatus)}</TableCell>
                <TableCell>
                  {integration.lastTestAt
                    ? formatDistanceToNow(new Date(integration.lastTestAt), {
                        addSuffix: true,
                      })
                    : 'Never'}
                </TableCell>
                <TableCell>
                  {integration.lastTestLatency
                    ? `${integration.lastTestLatency}ms`
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          testMutation.mutate(integration.id)
                        }
                        disabled={testingId === integration.id}
                      >
                        <TestTube className="mr-2 h-4 w-4" />
                        {testingId === integration.id ? 'Testing...' : 'Test Connection'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(integration)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(integration.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the integration and all associated webhook
              events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
