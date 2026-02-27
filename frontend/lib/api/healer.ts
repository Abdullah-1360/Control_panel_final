import { apiClient } from './client';

export interface Application {
  id: string;
  serverId: string;
  domain: string;
  path: string;
  techStack: 'WORDPRESS' | 'NODEJS' | 'PHP' | 'LARAVEL' | 'NEXTJS' | 'EXPRESS';
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
  checkId: string;
  checkName: string;
  category: 'SYSTEM' | 'DATABASE' | 'APPLICATION' | 'SECURITY' | 'PERFORMANCE';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
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

    const response = await apiClient.get(`/healer/applications?${queryParams}`);
    return response.data;
  },

  getApplication: async (id: string): Promise<Application> => {
    const response = await apiClient.get(`/healer/applications/${id}`);
    return response.data;
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
    const response = await apiClient.post('/healer/applications', data);
    return response.data;
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
    const response = await apiClient.put(`/healer/applications/${id}`, data);
    return response.data;
  },

  deleteApplication: async (id: string): Promise<void> => {
    await apiClient.delete(`/healer/applications/${id}`);
  },

  discoverApplications: async (data: {
    serverId: string;
    techStacks?: string[];
    autoDetect?: boolean;
  }): Promise<{ discovered: number; applications: Application[] }> => {
    const response = await apiClient.post('/healer/applications/discover', data);
    return response.data;
  },

  // Diagnostics
  diagnoseApplication: async (
    id: string,
    data?: {
      checkIds?: string[];
      forceRefresh?: boolean;
    },
  ): Promise<{ message: string; applicationId: string }> => {
    const response = await apiClient.post(`/healer/applications/${id}/diagnose`, data || {});
    return response.data;
  },

  getDiagnostics: async (
    id: string,
    limit?: number,
  ): Promise<{ applicationId: string; results: DiagnosticResult[] }> => {
    const queryParams = limit ? `?limit=${limit}` : '';
    const response = await apiClient.get(`/healer/applications/${id}/diagnostics${queryParams}`);
    return response.data;
  },

  getHealthScore: async (id: string): Promise<{ applicationId: string; healthScore: number }> => {
    const response = await apiClient.get(`/healer/applications/${id}/health-score`);
    return response.data;
  },
};
