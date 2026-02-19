import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BaseAdapter } from './base.adapter';

/**
 * Discord Adapter
 * Implements Discord Webhook integration
 */
@Injectable()
export class DiscordAdapterService implements BaseAdapter {
  private readonly logger = new Logger(DiscordAdapterService.name);

  constructor(private readonly webhookUrl: string) {}

  /**
   * Test connection to Discord
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
        content: 'OpsManager connection test - please ignore this message',
        embeds: [
          {
            title: '✅ OpsManager Connection Test',
            description: 'Your Discord integration is working correctly!',
            color: 0x00ff00, // Green
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const latency = Date.now() - startTime;

      if (response.status === 204 || response.status === 200) {
        this.logger.log('Discord connection test successful');
        return {
          success: true,
          message: 'Successfully connected to Discord webhook',
          latency,
        };
      } else {
        this.logger.warn('Discord connection test failed', response.data);
        return {
          success: false,
          message: response.data?.message || 'Unknown error',
          latency,
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.logger.error('Discord connection test error', error);

      return {
        success: false,
        message: this.formatError(error),
        latency,
      };
    }
  }

  /**
   * Send a message to Discord channel
   * @param content - Plain text message
   * @param embeds - Optional Discord embeds for rich formatting
   */
  async sendMessage(
    content: string,
    embeds?: any[],
  ): Promise<{ success: boolean; message: string }> {
    try {
      const payload: any = { content };
      if (embeds) {
        payload.embeds = embeds;
      }

      const response = await axios.post(this.webhookUrl, payload);

      if (response.status === 204 || response.status === 200) {
        this.logger.log('Discord message sent successfully');
        return {
          success: true,
          message: 'Message sent successfully',
        };
      } else {
        this.logger.warn('Discord message failed', response.data);
        return {
          success: false,
          message: response.data?.message || 'Unknown error',
        };
      }
    } catch (error: any) {
      this.logger.error('Failed to send Discord message', error);
      return {
        success: false,
        message: this.formatError(error),
      };
    }
  }

  /**
   * Send an embed message to Discord
   * @param embed - Discord embed object
   */
  async sendEmbed(embed: {
    title: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
    timestamp?: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.sendMessage('', [embed]);
  }

  /**
   * Format error message for user-friendly display
   */
  private formatError(error: any): string {
    if (error.response) {
      // HTTP error response
      if (error.response.status === 404) {
        return 'Webhook URL not found - please verify the URL';
      } else if (error.response.status === 401) {
        return 'Unauthorized - webhook may be invalid';
      } else if (error.response.status === 429) {
        return 'Rate limited - too many requests';
      } else {
        return `HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
      }
    } else if (error.request) {
      // Network error
      return 'Network error: Unable to reach Discord';
    } else if (error.code === 'ECONNREFUSED') {
      return 'Connection refused: Discord is not reachable';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout: Discord did not respond';
    } else {
      return error.message || 'Unknown error';
    }
  }
}
