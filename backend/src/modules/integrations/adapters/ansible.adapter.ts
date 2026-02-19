import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { BaseAdapter } from './base.adapter';

/**
 * Ansible Adapter
 * Implements Ansible Tower/AWX API integration
 */
@Injectable()
export class AnsibleAdapterService implements BaseAdapter {
  private readonly logger = new Logger(AnsibleAdapterService.name);
  private client: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
  ) {
    // Create axios client with Ansible-specific configuration
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v2`,
      auth: {
        username: this.username,
        password: this.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
      }),
    });
  }

  /**
   * Test connection to Ansible Tower/AWX
   * Uses the ping endpoint
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.client.get('/ping/');
      const latency = Date.now() - startTime;

      if (response.status === 200) {
        this.logger.log('Ansible connection test successful');
        return {
          success: true,
          message: 'Successfully connected to Ansible Tower/AWX',
          latency,
        };
      } else {
        this.logger.warn('Ansible connection test failed', response.data);
        return {
          success: false,
          message: 'Unexpected response from Ansible',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.logger.error('Ansible connection test error', error);

      return {
        success: false,
        message: this.formatError(error),
        latency,
      };
    }
  }

  /**
   * List all job templates
   */
  async listJobTemplates(): Promise<any[]> {
    try {
      const response = await this.client.get('/job_templates/');

      if (response.status === 200) {
        return response.data.results || [];
      } else {
        throw new Error('Failed to list job templates');
      }
    } catch (error: any) {
      this.logger.error('Failed to list Ansible job templates', error);
      throw new Error(
        `Failed to list job templates: ${this.formatError(error)}`,
      );
    }
  }

  /**
   * Get job template details
   * @param templateId - Job template ID
   */
  async getJobTemplate(templateId: number): Promise<any> {
    try {
      const response = await this.client.get(`/job_templates/${templateId}/`);

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Job template ${templateId} not found`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to get job template ${templateId}`,
        error,
      );
      throw new Error(
        `Failed to get job template: ${this.formatError(error)}`,
      );
    }
  }

  /**
   * Launch a job template
   * @param templateId - Job template ID
   * @param extraVars - Optional extra variables
   */
  async launchJob(
    templateId: number,
    extraVars?: Record<string, any>,
  ): Promise<{
    success: boolean;
    jobId?: number;
    message: string;
  }> {
    try {
      const payload: any = {};
      if (extraVars) {
        payload.extra_vars = extraVars;
      }

      const response = await this.client.post(
        `/job_templates/${templateId}/launch/`,
        payload,
      );

      if (response.status === 201 || response.status === 200) {
        this.logger.log(
          `Job launched successfully: ${response.data.id}`,
        );
        return {
          success: true,
          jobId: response.data.id,
          message: 'Job launched successfully',
        };
      } else {
        this.logger.warn('Job launch failed', response.data);
        return {
          success: false,
          message: 'Failed to launch job',
        };
      }
    } catch (error: any) {
      this.logger.error(`Failed to launch job template ${templateId}`, error);
      return {
        success: false,
        message: this.formatError(error),
      };
    }
  }

  /**
   * Get job status
   * @param jobId - Job ID
   */
  async getJobStatus(jobId: number): Promise<{
    status: string;
    finished?: string;
    failed?: boolean;
  }> {
    try {
      const response = await this.client.get(`/jobs/${jobId}/`);

      if (response.status === 200) {
        return {
          status: response.data.status,
          finished: response.data.finished,
          failed: response.data.failed,
        };
      } else {
        throw new Error(`Job ${jobId} not found`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to get job status for ${jobId}`, error);
      throw new Error(`Failed to get job status: ${this.formatError(error)}`);
    }
  }

  /**
   * Cancel a running job
   * @param jobId - Job ID
   */
  async cancelJob(jobId: number): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await this.client.post(`/jobs/${jobId}/cancel/`);

      if (response.status === 202 || response.status === 200) {
        this.logger.log(`Job ${jobId} cancelled successfully`);
        return {
          success: true,
          message: 'Job cancelled successfully',
        };
      } else {
        return {
          success: false,
          message: 'Failed to cancel job',
        };
      }
    } catch (error: any) {
      this.logger.error(`Failed to cancel job ${jobId}`, error);
      return {
        success: false,
        message: this.formatError(error),
      };
    }
  }

  /**
   * List inventories
   */
  async listInventories(): Promise<any[]> {
    try {
      const response = await this.client.get('/inventories/');

      if (response.status === 200) {
        return response.data.results || [];
      } else {
        throw new Error('Failed to list inventories');
      }
    } catch (error: any) {
      this.logger.error('Failed to list Ansible inventories', error);
      throw new Error(
        `Failed to list inventories: ${this.formatError(error)}`,
      );
    }
  }

  /**
   * Format error message for user-friendly display
   */
  private formatError(error: any): string {
    if (error.response) {
      // HTTP error response
      if (error.response.status === 401) {
        return 'Authentication failed: Invalid username or password';
      } else if (error.response.status === 403) {
        return 'Access forbidden: Insufficient permissions';
      } else if (error.response.status === 404) {
        return 'Resource not found';
      } else {
        return `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Network error
      return 'Network error: Unable to reach Ansible Tower/AWX';
    } else if (error.code === 'ECONNREFUSED') {
      return 'Connection refused: Ansible Tower/AWX is not reachable';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout: Ansible Tower/AWX did not respond';
    } else {
      return error.message || 'Unknown error';
    }
  }
}
