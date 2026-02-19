/**
 * API Client for OpsManager Backend
 * Base URL: http://localhost:3001/api/v1
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public error?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', token);
  }

  private removeAccessToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
  }

  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { requiresAuth = true, headers = {}, ...restOptions } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers as Record<string, string>,
    };

    if (requiresAuth) {
      const token = this.getAccessToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...restOptions,
      headers: requestHeaders,
      credentials: 'include', // Include cookies for refresh token
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && requiresAuth && endpoint !== '/auth/refresh') {
      // If already refreshing, wait for it to complete
      if (this.isRefreshing && this.refreshPromise) {
        await this.refreshPromise;
        // Retry the original request with new token
        return this.request<T>(endpoint, options);
      }

      // Start refresh process
      this.isRefreshing = true;
      this.refreshPromise = this.attemptTokenRefresh();

      try {
        await this.refreshPromise;
        // Retry the original request with new token
        return this.request<T>(endpoint, options);
      } catch (error) {
        // Refresh failed, clear tokens and throw
        this.removeAccessToken();
        throw new ApiError(401, 'Session expired. Please login again.', 'UNAUTHORIZED');
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'An error occurred',
        error: 'Unknown',
      }));

      throw new ApiError(
        response.status,
        errorData.message || 'An error occurred',
        errorData.error,
      );
    }

    return response.json();
  }

  private async attemptTokenRefresh(): Promise<void> {
    try {
      // Call refresh endpoint (refresh token is in HTTP-only cookie)
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.setAccessToken(data.accessToken);
      // New refresh token is automatically set in HTTP-only cookie by backend
    } catch (error) {
      throw error;
    }
  }

  // Authentication endpoints
  async login(email: string, password: string, mfaCode?: string) {
    const response = await this.request<{
      accessToken: string;
      user: {
        id: string;
        email: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
        role: {
          id: string;
          name: string;
          displayName: string;
        };
        mfaEnabled: boolean;
        mustChangePassword: boolean;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaCode }),
      requiresAuth: false,
      credentials: 'include', // Include cookies
    });

    this.setAccessToken(response.accessToken);
    // Refresh token is now in HTTP-only cookie, not returned in response
    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
      });
    } finally {
      this.removeAccessToken();
    }
  }

  async refreshToken(refreshToken: string) {
    const response = await this.request<{
      accessToken: string;
      refreshToken: string;
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      requiresAuth: false,
      credentials: 'include', // Include cookies
    });

    this.setAccessToken(response.accessToken);
    return response;
  }

  async getCurrentUser() {
    return this.request<{
      user: {
        id: string;
        email: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
        mfaEnabled: boolean;
        mustChangePassword: boolean;
        role: {
          id: string;
          name: string;
          displayName: string;
        };
      };
    }>('/auth/me', {
      method: 'GET',
    });
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    return this.request<{ message: string }>('/auth/password/change', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  async requestPasswordReset(email: string) {
    return this.request<{ message: string }>('/auth/password/reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
      requiresAuth: false,
    });
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return this.request<{ message: string }>('/auth/password/reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword }),
      requiresAuth: false,
    });
  }

  async setupMfa() {
    return this.request<{
      secret: string;
      qrCode: string;
      backupCodes: string[];
    }>('/auth/mfa/setup', {
      method: 'POST',
    });
  }

  async verifyMfa(code: string) {
    return this.request<{ message: string }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disableMfa(password: string, code: string) {
    return this.request<{ message: string }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    });
  }

  async regenerateBackupCodes() {
    return this.request<{ backupCodes: string[] }>('/auth/mfa/backup-codes/regenerate', {
      method: 'POST',
    });
  }

  // Users endpoints
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    isActive?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.roleId) queryParams.append('roleId', params.roleId);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        email: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
        isActive: boolean;
        mfaEnabled: boolean;
        role: {
          id: string;
          name: string;
          displayName: string;
        };
        createdAt: string;
        lastLoginAt: string | null;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/users${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getUser(id: string) {
    return this.request<{
      id: string;
      email: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      isActive: boolean;
      mfaEnabled: boolean;
      role: {
        id: string;
        name: string;
        displayName: string;
      };
      createdAt: string;
      lastLoginAt: string | null;
    }>(`/users/${id}`, {
      method: 'GET',
    });
  }

  async createUser(data: {
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    roleId: string;
  }) {
    return this.request<{
      user: {
        id: string;
        email: string;
        username: string;
      };
      temporaryPassword: string;
    }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(
    id: string,
    data: {
      email?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      roleId?: string;
    },
  ) {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async activateUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}/activate`, {
      method: 'PUT',
    });
  }

  async deactivateUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}/deactivate`, {
      method: 'PUT',
    });
  }

  async unlockUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}/unlock`, {
      method: 'PUT',
    });
  }

  // Roles endpoints
  async getRoles() {
    return this.request<{
      data: Array<{
        id: string;
        name: string;
        displayName: string;
        description: string | null;
        userCount: number;
      }>;
    }>('/roles', {
      method: 'GET',
    });
  }

  async getRole(id: string) {
    return this.request<{
      id: string;
      name: string;
      displayName: string;
      description: string | null;
    }>(`/roles/${id}`, {
      method: 'GET',
    });
  }

  async getRolePermissions(id: string) {
    return this.request<{
      permissions: Array<{
        id: string;
        resource: string;
        action: string;
        description: string | null;
      }>;
    }>(`/roles/${id}/permissions`, {
      method: 'GET',
    });
  }

  // Sessions endpoints
  async getMySessions() {
    return this.request<{
      data: Array<{
        id: string;
        ipAddress: string;
        userAgent: string;
        createdAt: string;
        expiresAt: string;
        lastActivityAt: string;
        isCurrent: boolean;
      }>;
    }>('/sessions/me', {
      method: 'GET',
    });
  }

  async revokeSession(id: string) {
    return this.request<{ message: string }>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit logs endpoints
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.action) queryParams.append('action', params.action);
    if (params?.resource) queryParams.append('resource', params.resource);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        action: string;
        resource: string;
        resourceId: string | null;
        userId: string | null;
        user: {
          username: string;
          email: string;
        } | null;
        ipAddress: string;
        userAgent: string;
        severity: string;
        description: string;
        timestamp: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/audit-logs${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getSecurityLogs(params?: {
    page?: number;
    limit?: number;
    severity?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.severity) queryParams.append('severity', params.severity);

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        action: string;
        resource: string;
        userId: string | null;
        user: {
          username: string;
          email: string;
        } | null;
        ipAddress: string;
        severity: string;
        description: string;
        timestamp: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/audit-logs/security${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // Role assignment endpoint
  async assignRole(userId: string, roleId: string) {
    return this.request<{
      message: string;
      user: {
        id: string;
        email: string;
        username: string;
        role: {
          id: string;
          name: string;
          displayName: string;
        };
      };
    }>(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ roleId }),
    });
  }

  // Admin session management endpoints
  async getAllSessions(params?: {
    page?: number;
    limit?: number;
    userId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.userId) queryParams.append('userId', params.userId);

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        userId: string;
        user: {
          id: string;
          email: string;
          username: string;
          firstName: string | null;
          lastName: string | null;
        };
        ipAddress: string;
        userAgent: string;
        createdAt: string;
        expiresAt: string;
        lastActivityAt: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/sessions${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // SMTP Settings endpoints
  async getSmtpSettings() {
    return this.request<{
      host: string;
      port: number;
      username: string;
      fromAddress: string;
      fromName: string;
      secure: boolean;
      isConfigured: boolean;
    }>('/settings/smtp', {
      method: 'GET',
    });
  }

  async updateSmtpSettings(settings: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    fromAddress: string;
    fromName: string;
    secure: boolean;
  }) {
    return this.request<{
      host: string;
      port: number;
      username: string;
      fromAddress: string;
      fromName: string;
      secure: boolean;
      isConfigured: boolean;
    }>('/settings/smtp', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testSmtpSettings(to: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>('/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
  }

  // Email Templates endpoints
  async getEmailTemplates() {
    return this.request<{
      data: Array<{
        key: string;
        name: string;
        subject: string;
        htmlBody: string;
        textBody: string;
        variables: string[];
      }>;
    }>('/email-templates', {
      method: 'GET',
    });
  }

  async getEmailTemplate(key: string) {
    return this.request<{
      data: {
        key: string;
        name: string;
        subject: string;
        htmlBody: string;
        textBody: string;
        variables: string[];
      } | null;
    }>(`/email-templates/${key}`, {
      method: 'GET',
    });
  }

  async createEmailTemplate(data: {
    key: string;
    name: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    variables: string[];
  }) {
    return this.request<{
      data: {
        key: string;
        name: string;
        subject: string;
        htmlBody: string;
        textBody: string;
        variables: string[];
      };
      message: string;
    }>('/email-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailTemplate(
    key: string,
    data: {
      name?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variables?: string[];
    },
  ) {
    return this.request<{
      data: {
        key: string;
        name: string;
        subject: string;
        htmlBody: string;
        textBody: string;
        variables: string[];
      };
      message: string;
    }>(`/email-templates/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailTemplate(key: string) {
    return this.request<{ message: string }>(`/email-templates/${key}`, {
      method: 'DELETE',
    });
  }

  // Notification Rules endpoints
  async getNotificationRules() {
    return this.request<{
      data: Array<{
        id: string;
        name: string;
        description: string | null;
        trigger: string;
        templateKey: string;
        recipientType: string;
        recipientValue: any;
        conditions: any;
        priority: number;
        isActive: boolean;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/notifications/rules', {
      method: 'GET',
    });
  }

  async getNotificationRule(id: string) {
    return this.request<{
      data: {
        id: string;
        name: string;
        description: string | null;
        trigger: string;
        templateKey: string;
        recipientType: string;
        recipientValue: any;
        conditions: any;
        priority: number;
        isActive: boolean;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
      };
    }>(`/notifications/rules/${id}`, {
      method: 'GET',
    });
  }

  async createNotificationRule(data: {
    name: string;
    description?: string;
    trigger: string;
    templateKey: string;
    recipientType: string;
    recipientValue: any;
    conditions?: any;
    priority: number;
    isActive: boolean;
  }) {
    return this.request<{
      data: any;
      message: string;
    }>('/notifications/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNotificationRule(id: string, data: any) {
    return this.request<{
      data: any;
      message: string;
    }>(`/notifications/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNotificationRule(id: string) {
    return this.request<{ message: string }>(`/notifications/rules/${id}`, {
      method: 'DELETE',
    });
  }

  // Email History endpoints
  async getEmailHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
    ruleId?: string;
    triggeredBy?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.ruleId) queryParams.append('ruleId', params.ruleId);
    if (params?.triggeredBy) queryParams.append('triggeredBy', params.triggeredBy);

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        ruleId: string | null;
        rule: { id: string; name: string } | null;
        templateKey: string;
        recipients: string[];
        subject: string;
        htmlBody: string;
        textBody: string;
        variables: any;
        status: string;
        sentAt: string | null;
        failedAt: string | null;
        error: string | null;
        deliveryStatus: string | null;
        triggeredBy: string;
        triggerEvent: string;
        createdAt: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/notifications/history${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // Bulk Email endpoint
  async sendBulkEmail(data: {
    templateKey: string;
    recipients: string[];
    variables: Record<string, string>;
  }) {
    return this.request<{
      data: {
        total: number;
        sent: number;
        failed: number;
      };
      message: string;
    }>('/notifications/bulk-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Servers endpoints
  async getServers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    platformType?: 'LINUX' | 'WINDOWS';
    environment?: 'PROD' | 'STAGING' | 'DEV';
    tags?: string;
    lastTestStatus?: 'NEVER_TESTED' | 'OK' | 'FAILED';
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.platformType) queryParams.append('platformType', params.platformType);
    if (params?.environment) queryParams.append('environment', params.environment);
    if (params?.tags) queryParams.append('tags', params.tags);
    if (params?.lastTestStatus) queryParams.append('lastTestStatus', params.lastTestStatus);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order);

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        name: string;
        environment: string | null;
        tags: string[];
        notes: string | null;
        platformType: string;
        host: string;
        port: number;
        connectionProtocol: string;
        username: string;
        authType: string;
        privilegeMode: string;
        sudoMode: string;
        hostKeyStrategy: string;
        knownHostFingerprints: Array<{
          keyType: string;
          fingerprint: string;
          firstSeenAt: string;
          lastVerifiedAt: string;
        }>;
        lastTestStatus: string;
        lastTestAt: string | null;
        lastTestResult: any;
        hasPrivateKey: boolean;
        hasPassphrase: boolean;
        hasPassword: boolean;
        hasSudoPassword: boolean;
        createdByUserId: string;
        createdBy: {
          id: string;
          email: string;
          username: string;
        };
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/servers${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getServer(id: string) {
    return this.request<{
      id: string;
      name: string;
      environment: string | null;
      tags: string[];
      notes: string | null;
      platformType: string;
      host: string;
      port: number;
      connectionProtocol: string;
      username: string;
      authType: string;
      privilegeMode: string;
      sudoMode: string;
      hostKeyStrategy: string;
      knownHostFingerprints: Array<{
        keyType: string;
        fingerprint: string;
        firstSeenAt: string;
        lastVerifiedAt: string;
      }>;
      lastTestStatus: string;
      lastTestAt: string | null;
      lastTestResult: any;
      hasPrivateKey: boolean;
      hasPassphrase: boolean;
      hasPassword: boolean;
      hasSudoPassword: boolean;
      createdByUserId: string;
      createdBy: {
        id: string;
        email: string;
        username: string;
      };
      createdAt: string;
      updatedAt: string;
    }>(`/servers/${id}`, {
      method: 'GET',
    });
  }

  async createServer(data: {
    name: string;
    environment?: string;
    tags?: string[];
    notes?: string;
    platformType: 'LINUX' | 'WINDOWS';
    host: string;
    port: number;
    connectionProtocol: string;
    username: string;
    authType: 'SSH_KEY' | 'SSH_KEY_WITH_PASSPHRASE' | 'PASSWORD';
    credentials: {
      privateKey?: string;
      passphrase?: string;
      password?: string;
    };
    privilegeMode: 'ROOT' | 'SUDO' | 'USER_ONLY';
    sudoMode: 'NONE' | 'NOPASSWD' | 'PASSWORD_REQUIRED';
    sudoPassword?: string;
    hostKeyStrategy: 'STRICT_PINNED' | 'TOFU' | 'DISABLED';
    knownHostFingerprints?: Array<{
      keyType: string;
      fingerprint: string;
    }>;
  }) {
    return this.request<any>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServer(id: string, data: any) {
    return this.request<any>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteServer(id: string, force: boolean = false) {
    return this.request<{ success: boolean; message: string }>(
      `/servers/${id}${force ? '?force=true' : ''}`,
      {
        method: 'DELETE',
      },
    );
  }

  async testServerConnection(id: string, async: boolean = false) {
    return this.request<any>(`/servers/${id}/test${async ? '?async=true' : ''}`, {
      method: 'POST',
    });
  }

  async getServerTestHistory(id: string) {
    return this.request<{
      serverId: string;
      serverName: string;
      total: number;
      history: Array<{
        id: string;
        success: boolean;
        message: string;
        latency: number;
        details: any;
        detectedOS: string | null;
        detectedUsername: string | null;
        errors: string[];
        warnings: string[];
        testedAt: string;
        triggeredBy: {
          id: string;
          email: string;
          username: string;
        };
      }>;
    }>(`/servers/${id}/test-history`, {
      method: 'GET',
    });
  }

  async getServerDependencies(id: string) {
    return this.request<{
      serverId: string;
      serverName: string;
      hasDependencies: boolean;
      dependencies: {
        sites: {
          count: number;
          items: any[];
        };
        incidents: {
          count: number;
          items: any[];
        };
        jobs: {
          count: number;
          items: any[];
        };
      };
    }>(`/servers/${id}/dependencies`, {
      method: 'GET',
    });
  }

  // ============================================
  // METRICS ENDPOINTS
  // ============================================

  async collectServerMetrics(id: string) {
    return this.request<any>(`/servers/${id}/metrics/collect`, {
      method: 'POST',
    });
  }

  async getServerLatestMetrics(id: string) {
    return this.request<any>(`/servers/${id}/metrics/latest`, {
      method: 'GET',
    });
  }

  async getServerMetricsHistory(id: string, hours: number = 24) {
    return this.request<any[]>(`/servers/${id}/metrics/history?hours=${hours}`, {
      method: 'GET',
    });
  }

  async getAggregatedMetrics() {
    return this.request<{
      avgCpuUsage: number;
      avgMemoryUsage: number;
      avgDiskUsage: number;
      totalServers: number;
      serversWithMetrics: number;
      servers: Array<{
        serverId: string;
        serverName: string;
        metrics: any;
      }>;
    }>('/servers/metrics/aggregate', {
      method: 'GET',
    });
  }

  // ============================================
  // INTEGRATIONS ENDPOINTS
  // ============================================

  async getIntegrations(params?: {
    page?: number;
    limit?: number;
    provider?: string;
    isActive?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.provider) queryParams.append('provider', params.provider);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    const query = queryParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        name: string;
        provider: string;
        isActive: boolean;
        healthStatus: string;
        lastHealthCheck: string | null;
        lastHealthCheckResult: any;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/integrations${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getIntegration(id: string) {
    return this.request<{
      id: string;
      name: string;
      provider: string;
      config: any;
      isActive: boolean;
      healthStatus: string;
      lastHealthCheck: string | null;
      lastHealthCheckResult: any;
      createdAt: string;
      updatedAt: string;
    }>(`/integrations/${id}`, {
      method: 'GET',
    });
  }

  async createIntegration(data: {
    name: string;
    provider: string;
    config: any;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      provider: string;
      isActive: boolean;
      createdAt: string;
    }>('/integrations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIntegration(id: string, data: {
    name?: string;
    config?: any;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      provider: string;
      isActive: boolean;
      updatedAt: string;
    }>(`/integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteIntegration(id: string) {
    return this.request<{ message: string }>(`/integrations/${id}`, {
      method: 'DELETE',
    });
  }

  async testIntegration(id: string) {
    return this.request<{
      success: boolean;
      message: string;
      details?: any;
    }>(`/integrations/${id}/test`, {
      method: 'POST',
    });
  }

  async getIntegrationHealth(id: string) {
    return this.request<{
      integrationId: string;
      status: string;
      lastCheck: string | null;
      result: any;
    }>(`/integrations/${id}/health`, {
      method: 'GET',
    });
  }

  // Convenience HTTP methods
  async get<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> & { params?: Record<string, any> } = {}): Promise<T> {
    const { params, ...restOptions } = options;
    let url = endpoint;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }
    
    return this.request<T>(url, { ...restOptions, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> & { params?: Record<string, any> } = {}): Promise<T> {
    const { params, ...restOptions } = options;
    let url = endpoint;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }
    
    return this.request<T>(url, { ...restOptions, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
