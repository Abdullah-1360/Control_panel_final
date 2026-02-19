import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type {
  Server,
  CreateServerInput,
  UpdateServerInput,
  ServerFilters,
  TestHistoryItem,
  ServerDependencies,
} from '@/lib/types/server';
import { toast } from 'sonner';

// Query keys
export const serverKeys = {
  all: ['servers'] as const,
  lists: () => [...serverKeys.all, 'list'] as const,
  list: (filters: ServerFilters & { page?: number; limit?: number }) =>
    [...serverKeys.lists(), filters] as const,
  details: () => [...serverKeys.all, 'detail'] as const,
  detail: (id: string) => [...serverKeys.details(), id] as const,
  testHistory: (id: string) => [...serverKeys.detail(id), 'test-history'] as const,
  dependencies: (id: string) => [...serverKeys.detail(id), 'dependencies'] as const,
};

// Fetch servers list
export function useServers(
  filters: ServerFilters & { page?: number; limit?: number } = {},
  options?: { refetchInterval?: number },
) {
  return useQuery({
    queryKey: serverKeys.list(filters),
    queryFn: () => apiClient.getServers(filters),
    ...options,
  });
}

// Fetch single server
export function useServer(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverKeys.detail(id),
    queryFn: () => apiClient.getServer(id),
    enabled: options?.enabled !== false && !!id,
  });
}

// Fetch server test history
export function useServerTestHistory(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverKeys.testHistory(id),
    queryFn: () => apiClient.getServerTestHistory(id),
    enabled: options?.enabled !== false && !!id,
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

// Fetch server dependencies
export function useServerDependencies(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverKeys.dependencies(id),
    queryFn: () => apiClient.getServerDependencies(id),
    enabled: options?.enabled !== false && !!id,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}

// Create server mutation
export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateServerInput) => apiClient.createServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      toast.success('Server created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create server');
    },
  });
}

// Update server mutation
export function useUpdateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServerInput }) =>
      apiClient.updateServer(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(variables.id) });
      toast.success('Server updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update server');
    },
  });
}

// Delete server mutation
export function useDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      apiClient.deleteServer(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      toast.success('Server deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete server');
    },
  });
}

// Test server connection mutation
export function useTestServerConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, async }: { id: string; async?: boolean }) =>
      apiClient.testServerConnection(id, async),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: serverKeys.testHistory(variables.id) });
      
      if (data.async) {
        toast.info('Connection test started in background');
      } else if (data.success) {
        toast.success('Connection test successful');
      } else {
        toast.error('Connection test failed');
      }
    },
    onError: (error: any) => {
      if (error.error === 'RATE_LIMIT_EXCEEDED') {
        toast.error('Rate limit exceeded. Please wait before testing again.');
      } else if (error.error === 'CONNECTION_TEST_IN_PROGRESS') {
        toast.error('A connection test is already in progress for this server');
      } else {
        toast.error(error.message || 'Failed to test connection');
      }
    },
  });
}
