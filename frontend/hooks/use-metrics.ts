import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useAggregatedMetrics() {
  return useQuery({
    queryKey: ['metrics', 'aggregate'],
    queryFn: () => apiClient.getAggregatedMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000,
  });
}

export function useServerLatestMetrics(serverId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['metrics', 'server', serverId, 'latest'],
    queryFn: () => apiClient.getServerLatestMetrics(serverId),
    enabled,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000,
  });
}

export function useServerMetricsHistory(serverId: string, hours: number = 24) {
  return useQuery({
    queryKey: ['metrics', 'server', serverId, 'history', hours],
    queryFn: () => apiClient.getServerMetricsHistory(serverId, hours),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

export function useCollectMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => apiClient.collectServerMetrics(serverId),
    onSuccess: (_, serverId) => {
      // Invalidate metrics queries
      queryClient.invalidateQueries({ queryKey: ['metrics', 'server', serverId] });
      queryClient.invalidateQueries({ queryKey: ['metrics', 'aggregate'] });
    },
  });
}
