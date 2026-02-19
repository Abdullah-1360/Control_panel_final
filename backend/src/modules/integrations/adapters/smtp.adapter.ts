import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { BaseAdapter, SmtpAdapter, SmtpConfig } from './base.adapter';

/**
 * SMTP Adapter
 * Implements SMTP email provider integration
 */
@Injectable()
export class SmtpAdapterService implements SmtpAdapter {
  private readonly logger = new Logger(SmtpAdapterService.name);
  private transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    // Create nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure, // true for 465, false for other ports
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      // Connection timeout
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 30000, // 30 seconds
    });
  }

  /**
   * Test connection to SMTP server
   * Verifies SMTP credentials and connectivity
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      // Verify connection
      await this.transporter.verify();
      const latency = Date.now() - startTime;

      this.logger.log('SMTP connection test successful');
      return {
        success: true,
        message: 'Successfully connected to SMTP server',
        latency,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.logger.error('SMTP connection test error', error);

      return {
        success: false,
        message: this.formatError(error),
        latency,
      };
    }
  }

  /**
   * Send a test email to verify SMTP configuration
   * @param to - Recipient email address
   */
  async sendTestEmail(to: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const from = this.config.from || this.config.username;

      const info = await this.transporter.sendMail({
        from: `"OpsManager" <${from}>`,
        to,
        subject: 'OpsManager SMTP Test Email',
        text: 'This is a test email from OpsManager to verify SMTP configuration.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>OpsManager SMTP Test Email</h2>
            <p>This is a test email to verify your SMTP configuration.</p>
            <p>If you received this email, your SMTP integration is working correctly.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">
              Sent from OpsManager at ${new Date().toISOString()}
            </p>
          </div>
        `,
      });

      this.logger.log(`Test email sent successfully: ${info.messageId}`);

      return {
        success: true,
        message: `Test email sent successfully to ${to}`,
      };
    } catch (error: any) {
      this.logger.error('Failed to send test email', error);

      return {
        success: false,
        message: this.formatError(error),
      };
    }
  }

  /**
   * Format error message for user-friendly display
   */
  private formatError(error: any): string {
    if (error.code === 'EAUTH') {
      return 'Authentication failed: Invalid username or password';
    } else if (error.code === 'ECONNECTION') {
      return 'Connection failed: Unable to reach SMTP server';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout: SMTP server did not respond';
    } else if (error.code === 'ECONNREFUSED') {
      return 'Connection refused: SMTP server is not reachable';
    } else if (error.responseCode === 535) {
      return 'Authentication failed: Invalid credentials';
    } else if (error.responseCode === 550) {
      return 'Email rejected: Invalid recipient or sender';
    } else {
      return error.message || 'Unknown error';
    }
  }

  /**
   * Close the SMTP connection
   */
  async close(): Promise<void> {
    this.transporter.close();
  }
}
