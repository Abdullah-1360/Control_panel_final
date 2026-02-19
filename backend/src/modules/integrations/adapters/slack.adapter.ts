import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { BaseAdapter } from './base.adapter';

/**
 * Slack Adapter
 * Implements Slack Webhook and API integration
 */
@Injectable()
export class SlackAdapterService implements BaseAdapter {
  private readonly logger = new Logger(SlackAdapterService.name);
  private client?: AxiosInstance;

  constructor(
    private readonly webhookUrl: string,
    private readonly botToken?: string, // Optional for API access
  ) {
    // Create axios client for Slack API (if bot token provided)
    if (botToken) {
      this.client = axios.create({
        baseURL: 'https://slack.com/api',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
    }
  }

  /**
   * Test connection to Slack
   * Sends a test message to the webhook URL
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      // Send test message to webhook
      const response = await axios.post(this.webhookUrl, {
        text: 'OpsManager connection test - please ignore this message',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *OpsManager Connection Test*\nYour Slack integration is working correctly!',
            },
          },
        ],
      });

      const latency = Date.now() - startTime;

      if (response.status === 200 && response.data === 'ok') {
        this.logger.log('Slack connection test successful');
        return {
          success: true,
          message: 'Successfully connected to Slack webhook',
          latency,
        };
      } else {
        this.logger.warn('Slack connection test failed', response.data);
        return {
          success: false,
          message: response.data || 'Unknown error',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.logger.error('Slack connection test error', error);

      return {
        success: false,
        message: this.formatError(error),
        latency,
      };
    }
  }

  /**
   * Send a message to Slack channel
   * @param text - Plain text message
   * @param blocks - Optional Slack blocks for rich formatting
   */
  async sendMessage(
    text: string,
    blocks?: any[],
  ): Promise<{ success: boolean; message: string }> {
    try {
      const payload: any = { text };
      if (blocks) {
        payload.blocks = blocks;
      }

      const response = await axios.post(this.webhookUrl, payload);

      if (response.status === 200 && response.data === 'ok') {
        this.logger.log('Slack message sent successfully');
        return {
          success: true,
          message: 'Message sent successfully',
        };
      } else {
        this.logger.warn('Slack message failed', response.data);
        return {
          success: false,
          message: response.data || 'Unknown error',
        };
      }
    } catch (error: any) {
      this.logger.error('Failed to send Slack message', error);
      return {
        success: false,
        message: this.formatError(error),
      };
    }
  }

  /**
   * Get channel list (requires bot token)
   */
  async listChannels(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Bot token required for API access');
    }

    try {
      const response = await this.client.get('/conversations.list');

      if (response.data.ok) {
        return response.data.channels || [];
      } else {
        throw new Error(response.data.error || 'Failed to list channels');
      }
    } catch (error: any) {
      this.logger.error('Failed to list Slack channels', error);
      throw new Error(`Failed to list channels: ${this.formatError(error)}`);
    }
  }

  /**
   * Get user list (requires bot token)
   */
  async listUsers(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Bot token required for API access');
    }

    try {
      const response = await this.client.get('/users.list');

      if (response.data.ok) {
        return response.data.members || [];
      } else {
        throw new Error(response.data.error || 'Failed to list users');
      }
    } catch (error: any) {
      this.logger.error('Failed to list Slack users', error);
      throw new Error(`Failed to list users: ${this.formatError(error)}`);
    }
  }

  /**
   * Format error message for user-friendly display
   */
  private formatError(error: any): string {
    if (error.response) {
      // HTTP error response
      if (error.response.status === 404) {
        return 'Webhook URL not found - please verify the URL';
      } else if (error.response.status === 403) {
        return 'Access forbidden - webhook may be disabled';
      } else {
        return `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Network error
      return 'Network error: Unable to reach Slack';
    } else if (error.code === 'ECONNREFUSED') {
      return 'Connection refused: Slack is not reachable';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout: Slack did not respond';
    } else {
      return error.message || 'Unknown error';
    }
  }
}
