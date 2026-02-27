import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healerApi, Application } from '@/lib/api/healer';
import { toast } from 'sonner';

// Query keys
export const healerKeys = {
  all: ['healer'] as const,
  applications: () => [...healerKeys.all, 'applications'] as const,
  applicationsList: (filters?: any) => [...healerKeys.applications(), 'list', filters] as const,
  application: (id: string) => [...healerKeys.applications(), 'detail', id] as const,
  diagnostics: (id: string) => [...healerKeys.application(id), 'diagnostics'] as const,
  healthScore: (id: string) => [...healerKeys.application(id), 'health-score'] as const,
};

// Get applications with filters
export function useApplications(params?: {
  page?: number;
  limit?: number;
  search?: string;
  techStack?: string;
  healthStatus?: string;
  serverId?: string;
}) {
  return useQuery({
    queryKey: healerKeys.applicationsList(params),
    queryFn: () => healerApi.getApplications(params),
    refetchInterval: 5000, // Poll every 5 seconds for health status updates
  });
}

// Get single application
export function useApplication(id: string) {
  return useQuery({
    queryKey: healerKeys.application(id),
    queryFn: () => healerApi.getApplication(id),
    enabled: !!id,
  });
}

// Get diagnostics for application
export function useDiagnostics(id: string, limit?: number) {
  return useQuery({
    queryKey: healerKeys.diagnostics(id),
    queryFn: () => healerApi.getDiagnostics(id, limit),
    enabled: !!id,
  });
}

// Get health score
export function useHealthScore(id: string) {
  return useQuery({
    queryKey: healerKeys.healthScore(id),
    queryFn: () => healerApi.getHealthScore(id),
    enabled: !!id,
  });
}

// Create application
export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healerApi.createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healerKeys.applications() });
      toast.success('Application created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create application');
    },
  });
}

// Update application
export function useUpdateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      healerApi.updateApplication(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: healerKeys.application(variables.id) });
      queryClient.invalidateQueries({ queryKey: healerKeys.applications() });
      toast.success('Application updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update application');
    },
  });
}

// Delete application
export function useDeleteApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healerApi.deleteApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healerKeys.applications() });
      toast.success('Application deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete application');
    },
  });
}

// Discover applications
export function useDiscoverApplications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healerApi.discoverApplications,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: healerKeys.applications() });
      const count = data?.discovered ?? 0;
      toast.success(`Discovered ${count} application(s)`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to discover applications');
    },
  });
}

// Diagnose application
export function useDiagnoseApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      healerApi.diagnoseApplication(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: healerKeys.diagnostics(variables.id) });
      queryClient.invalidateQueries({ queryKey: healerKeys.application(variables.id) });
      toast.success('Diagnosis started');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start diagnosis');
    },
  });
}
