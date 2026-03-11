import { apiClient } from './client';

export interface SiteTechStack {
  id: string;
  applicationId: string;
  techStack: string;
  techStackVersion?: string;
  detectionMethod: string;
  detectionConfidence: number;
  detectedAt: string;
  sslEnabled?: boolean;
  sslIssuer?: string;
  sslExpiryDate?: string;
  dnsRecords?: any;
  emailAccountsCount?: number;
  emailQuotaUsedMB?: number;
  emailQuotaTotalMB?: number;
  isMainDomain: boolean;
  isSubdomain: boolean;
  isParkedDomain: boolean;
  isAddonDomain: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export const siteTechStackApi = {
  /**
   * Get tech stack information for an application
   */
  async getTechStack(applicationId: string): Promise<SiteTechStack> {
    const response = await apiClient.get(`/healer/applications/${applicationId}/tech-stack`);
    return response.data;
  },

  /**
   * Update domain addon information
   */
  async updateDomainAddons(
    applicationId: string,
    addons: {
      sslEnabled?: boolean;
      sslIssuer?: string;
      sslExpiryDate?: Date;
      dnsRecords?: any;
      emailAccountsCount?: number;
      emailQuotaUsedMB?: number;
      emailQuotaTotalMB?: number;
    }
  ): Promise<SiteTechStack> {
    const response = await apiClient.put(
      `/healer/applications/${applicationId}/tech-stack/addons`,
      addons
    );
    return response.data;
  },

  /**
   * Update domain type information
   */
  async updateDomainType(
    applicationId: string,
    domainType: {
      isMainDomain?: boolean;
      isSubdomain?: boolean;
      isParkedDomain?: boolean;
      isAddonDomain?: boolean;
    }
  ): Promise<SiteTechStack> {
    const response = await apiClient.put(
      `/healer/applications/${applicationId}/tech-stack/domain-type`,
      domainType
    );
    return response.data;
  },

  /**
   * Get all tech stacks with filters
   */
  async getAllTechStacks(filters?: {
    techStack?: string;
    isMainDomain?: boolean;
    isSubdomain?: boolean;
    isParkedDomain?: boolean;
    isAddonDomain?: boolean;
  }): Promise<SiteTechStack[]> {
    const params = new URLSearchParams();
    if (filters?.techStack) params.append('techStack', filters.techStack);
    if (filters?.isMainDomain !== undefined) params.append('isMainDomain', String(filters.isMainDomain));
    if (filters?.isSubdomain !== undefined) params.append('isSubdomain', String(filters.isSubdomain));
    if (filters?.isParkedDomain !== undefined) params.append('isParkedDomain', String(filters.isParkedDomain));
    if (filters?.isAddonDomain !== undefined) params.append('isAddonDomain', String(filters.isAddonDomain));

    const response = await apiClient.get(`/healer/applications/tech-stacks/all?${params.toString()}`);
    return response.data;
  },
};
