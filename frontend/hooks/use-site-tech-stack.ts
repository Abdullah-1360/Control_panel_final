import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { siteTechStackApi, SiteTechStack } from '../lib/api/site-tech-stack';

/**
 * Hook to fetch tech stack information for an application
 */
export function useSiteTechStack(applicationId: string) {
  return useQuery<SiteTechStack, Error>({
    queryKey: ['siteTechStack', applicationId],
    queryFn: () => siteTechStackApi.getTechStack(applicationId),
    enabled: !!applicationId,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update domain addon information
 */
export function useUpdateDomainAddons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      addons,
    }: {
      applicationId: string;
      addons: {
        sslEnabled?: boolean;
        sslIssuer?: string;
        sslExpiryDate?: Date;
        dnsRecords?: any;
        emailAccountsCount?: number;
        emailQuotaUsedMB?: number;
        emailQuotaTotalMB?: number;
      };
    }) => siteTechStackApi.updateDomainAddons(applicationId, addons),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['siteTechStack', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['application', variables.applicationId] });
    },
  });
}

/**
 * Hook to update domain type information
 */
export function useUpdateDomainType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      domainType,
    }: {
      applicationId: string;
      domainType: {
        isMainDomain?: boolean;
        isSubdomain?: boolean;
        isParkedDomain?: boolean;
        isAddonDomain?: boolean;
      };
    }) => siteTechStackApi.updateDomainType(applicationId, domainType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['siteTechStack', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['application', variables.applicationId] });
    },
  });
}

/**
 * Hook to fetch all tech stacks with filters
 */
export function useAllSiteTechStacks(filters?: {
  techStack?: string;
  isMainDomain?: boolean;
  isSubdomain?: boolean;
  isParkedDomain?: boolean;
  isAddonDomain?: boolean;
}) {
  return useQuery<SiteTechStack[], Error>({
    queryKey: ['siteTechStacks', filters],
    queryFn: () => siteTechStackApi.getAllTechStacks(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
