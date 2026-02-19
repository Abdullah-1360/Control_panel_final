import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/modules/encryption/encryption.service';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private smtpSettings: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromAddress: string;
    fromName: string;
    secure: boolean;
  } | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Load SMTP settings from database and create transporter
   * This is called before each email send to ensure latest settings are used
   */
  private async initializeTransporter(): Promise<boolean> {
    try {
      // Load SMTP settings from database
      const settings = await this.getSmtpSettingsFromDb();

      if (!settings || !settings.host || !settings.port || !settings.fromAddress) {
        this.logger.warn('SMTP not configured in database. Email notifications will be disabled.');
        return false;
      }

      // Cache settings
      this.smtpSettings = settings;

      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: settings.username && settings.password
          ? {
              user: settings.username,
              pass: settings.password,
            }
          : undefined,
        tls: {
          // Ignore certificate validation errors (for self-signed or mismatched certs)
          rejectUnauthorized: false,
        },
      });

      this.logger.log(`Email service initialized with ${settings.host}:${settings.port}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize email service:', error);
      return false;
    }
  }

  /**
   * Get SMTP settings from database
   */
  private async getSmtpSettingsFromDb() {
    try {
      const settings = await this.prisma.settings.findMany({
        where: {
          key: {
            startsWith: 'smtp.',
          },
        },
      });

      if (settings.length === 0) {
        return null;
      }

      const settingsMap: Record<string, string> = {};
      for (const setting of settings) {
        const value = setting.isEncrypted
          ? await this.encryption.decrypt(setting.value)
          : setting.value;
        settingsMap[setting.key] = value;
      }

      return {
        host: settingsMap['smtp.host'] || '',
        port: parseInt(settingsMap['smtp.port'] || '587', 10),
        username: settingsMap['smtp.username'] || '',
        password: settingsMap['smtp.password'] || '',
        fromAddress: settingsMap['smtp.fromAddress'] || '',
        fromName: settingsMap['smtp.fromName'] || 'OpsManager',
        secure: settingsMap['smtp.secure'] === 'true',
      };
    } catch (error) {
      this.logger.error('Failed to load SMTP settings from database:', error);
      return null;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Initialize transporter with latest settings from database
    const isConfigured = await this.initializeTransporter();
    
    if (!isConfigured || !this.transporter || !this.smtpSettings) {
      this.logger.warn(`Email not sent (SMTP not configured): ${options.subject} to ${options.to}`);
      return false;
    }

    try {
      const from = `${this.smtpSettings.fromName} <${this.smtpSettings.fromAddress}>`;

      this.logger.debug(`Sending email via ${this.smtpSettings.host}:${this.smtpSettings.port} (secure: ${this.smtpSettings.secure})`);
      this.logger.debug(`From: ${from}, To: ${options.to}`);
      this.logger.debug(`Auth: ${this.smtpSettings.username ? 'Yes' : 'No'}`);

      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      this.logger.log(`Email sent successfully: ${options.subject} to ${options.to} (MessageID: ${info.messageId})`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${options.subject} to ${options.to}`);
      this.logger.error(`Error details: ${error.message}`);
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.responseCode) {
        this.logger.error(`Response Code: ${error.responseCode}`);
      }
      return false;
    }
  }

  async sendWelcomeEmail(email: string, username: string, temporaryPassword: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .credentials { background: #fff; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to OpsManager</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${username}</strong>,</p>
              <p>Your OpsManager account has been created successfully. Below are your login credentials:</p>
              
              <div class="credentials">
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
              </div>

              <div class="warning">
                <p><strong>⚠️ Important Security Notice:</strong></p>
                <ul>
                  <li>You must change your password on first login</li>
                  <li>Do not share your credentials with anyone</li>
                  <li>Use a strong, unique password</li>
                </ul>
              </div>

              <p>You can log in at: <a href="${this.configService.get<string>('FRONTEND_URL')}/login">${this.configService.get<string>('FRONTEND_URL')}/login</a></p>
            </div>
            <div class="footer">
              <p>This is an automated message from OpsManager. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to OpsManager - Your Account Details',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your OpsManager account.</p>
              
              <p>Click the button below to reset your password:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border: 1px solid #e5e7eb;">${resetUrl}</p>

              <div class="warning">
                <p><strong>⚠️ Security Notice:</strong></p>
                <ul>
                  <li>This link expires in 1 hour</li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Your password won't change until you create a new one</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from OpsManager. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request - OpsManager',
      html,
    });
  }

  async sendPasswordChangedEmail(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .warning { background: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Changed Successfully</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${username}</strong>,</p>
              <p>Your password has been changed successfully.</p>

              <div class="warning">
                <p><strong>⚠️ Didn't make this change?</strong></p>
                <p>If you didn't change your password, please contact your administrator immediately.</p>
              </div>

              <p>For security reasons, all other active sessions have been terminated. You'll need to log in again with your new password.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from OpsManager. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Changed - OpsManager',
      html,
    });
  }

  async sendAccountLockedEmail(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .info { background: #dbeafe; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Locked</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${username}</strong>,</p>
              <p>Your account has been locked due to multiple failed login attempts.</p>

              <div class="info">
                <p><strong>What happens next?</strong></p>
                <ul>
                  <li>Your account will automatically unlock in 15 minutes</li>
                  <li>Or contact your administrator for immediate unlock</li>
                </ul>
              </div>

              <p>If you didn't attempt to log in, please contact your administrator immediately as this may indicate unauthorized access attempts.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from OpsManager. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Account Locked - OpsManager',
      html,
    });
  }

  async sendMFAEnabledEmail(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MFA Enabled</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${username}</strong>,</p>
              <p>Multi-factor authentication (MFA) has been successfully enabled on your account.</p>
              <p>From now on, you'll need to provide a verification code from your authenticator app when logging in.</p>
              <p>Make sure to keep your backup codes in a safe place.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from OpsManager. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'MFA Enabled - OpsManager',
      html,
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}
