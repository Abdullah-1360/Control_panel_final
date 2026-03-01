import { apiClient } from './client';

export interface Application {
  id: string;
  serverId: string;
  domain: string;
  path: string;
  techStack: 'UNKNOWN' | 'WORDPRESS' | 'NODEJS' | 'PHP' | 'PHP_GENERIC' | 'LARAVEL' | 'NEXTJS' | 'EXPRESS';
  detectionMethod: 'AUTO' | 'MANUAL' | 'HYBRID';
  version?: string;
  phpVersion?: string;
  dbName?: string;
  dbHost?: string;
  isHealerEnabled: boolean;
  healingMode: 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'MAINTENANCE' | 'HEALING' | 'UNKNOWN';
  healthScore: number;
  lastDiagnosedAt?: string;
  createdAt: string;
  updatedAt: string;
  servers?: {
    id: string;
    name: string;
    host: string;
    platformType: string;
  };
}

export interface DiagnosticResult {
  id: string;
  applicationId: string;
  checkName: string;
  checkCategory: 'SYSTEM' | 'DATABASE' | 'APPLICATION' | 'SECURITY' | 'PERFORMANCE' | 'CONFIGURATION' | 'DEPENDENCIES';
  status: 'PASS' | 'FAIL' | 'WARN' | 'ERROR' | 'SKIPPED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
  suggestedFix?: string | null;
  executionTime: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const healerApi = {
  // Applications
  getApplications: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    techStack?: string;
    healthStatus?: string;
    serverId?: string;
  }): Promise<PaginatedResponse<Application>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.techStack) queryParams.append('techStack', params.techStack);
    if (params?.healthStatus) queryParams.append('healthStatus', params.healthStatus);
    if (params?.serverId) queryParams.append('serverId', params.serverId);

    return await apiClient.get(`/healer/applications?${queryParams}`);
  },

  getApplication: async (id: string): Promise<Application> => {
    return await apiClient.get(`/healer/applications/${id}`);
  },

  createApplication: async (data: {
    serverId: string;
    domain: string;
    path: string;
    techStack: string;
    detectionMethod?: string;
    version?: string;
    phpVersion?: string;
    dbName?: string;
    dbHost?: string;
  }): Promise<Application> => {
    return await apiClient.post('/healer/applications', data);
  },

  updateApplication: async (
    id: string,
    data: {
      domain?: string;
      path?: string;
      techStack?: string;
      version?: string;
      phpVersion?: string;
      isHealerEnabled?: boolean;
      healingMode?: string;
    },
  ): Promise<Application> => {
    return await apiClient.put(`/healer/applications/${id}`, data);
  },

  deleteApplication: async (id: string): Promise<void> => {
    await apiClient.delete(`/healer/applications/${id}`);
  },

  deleteServerApplications: async (serverId: string): Promise<{ deletedCount: number }> => {
    return await apiClient.delete(`/healer/servers/${serverId}/applications`);
  },

  discoverApplications: async (data: {
    serverId: string;
    techStacks?: string[];
    paths?: string[];
  }): Promise<{ discovered: number; applications: Application[] }> => {
    // Build payload matching backend DTO
    const payload: any = {
      serverId: data.serverId,
    };
    
    // Only include techStacks if specified
    if (data.techStacks && data.techStacks.length > 0) {
      payload.techStacks = data.techStacks;
    }
    
    // Only include paths if specified
    if (data.paths && data.paths.length > 0) {
      payload.paths = data.paths;
    }
    
    return await apiClient.post('/healer/applications/discover', payload);
  },

  // Diagnostics
  diagnoseApplication: async (
    id: string,
    data?: {
      checkIds?: string[];
      forceRefresh?: boolean;
      subdomain?: string;
    },
  ): Promise<{ message: string; applicationId: string }> => {
    return await apiClient.post(`/healer/applications/${id}/diagnose`, data || {});
  },

  getDiagnostics: async (
    id: string,
    limit?: number,
  ): Promise<{ applicationId: string; results: DiagnosticResult[] }> => {
    const queryParams = limit ? `?limit=${limit}` : '';
    return await apiClient.get(`/healer/applications/${id}/diagnostics${queryParams}`);
  },

  getHealthScore: async (id: string): Promise<{ applicationId: string; healthScore: number }> => {
    return await apiClient.get(`/healer/applications/${id}/health-score`);
  },

  // Healing
  healApplication: async (
    id: string,
    actionName: string,
  ): Promise<{ applicationId: string; actionName: string; success: boolean; message: string; details?: any }> => {
    return await apiClient.post(`/healer/applications/${id}/heal`, { actionName });
  },

  getHealingActions: async (id: string): Promise<{ actions: any[] }> => {
    // This would come from the plugin, for now we'll handle it in the component
    return { actions: [] };
  },

  // Tech Stack Detection
  detectTechStack: async (id: string): Promise<{
    techStack: string;
    version?: string;
    confidence: number;
  }> => {
    return await apiClient.post(`/healer/applications/${id}/detect-tech-stack`, {});
  },

  detectSubdomainTechStack: async (id: string, subdomain: string): Promise<{
    techStack: string;
    version?: string;
    confidence: number;
  }> => {
    return await apiClient.post(`/healer/applications/${id}/subdomains/${subdomain}/detect-tech-stack`, {});
  },

  detectAllTechStacks: async (id: string): Promise<{
    main: {
      techStack: string;
      version?: string;
      confidence: number;
    };
    subdomains: Array<{
      domain: string;
      techStack: string;
      version?: string;
      confidence: number;
    }>;
  }> => {
    return await apiClient.post(`/healer/applications/${id}/detect-all-tech-stacks`, {});
  },
};
