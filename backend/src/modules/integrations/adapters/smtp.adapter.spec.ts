import { SmtpAdapterService } from './smtp.adapter';
import * as nodemailer from 'nodemailer';

// Mock nodemailer module
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('SmtpAdapterService', () => {
  let adapter: SmtpAdapterService;
  const mockConfig = {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    username: 'test@example.com',
    password: 'password123',
    from: 'noreply@example.com',
  };

  const mockTransporter = {
    verify: jest.fn(),
    sendMail: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    adapter = new SmtpAdapterService(mockConfig);
  });

  describe('testConnection', () => {
    it('should return success when connection is successful', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully connected to SMTP server');
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return failure when connection fails', async () => {
      const mockError: any = new Error('Connection refused');
      mockError.code = 'ECONNREFUSED';
      mockTransporter.verify.mockRejectedValue(mockError);

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection refused: SMTP server is not reachable');
    });

    it('should return failure when authentication fails', async () => {
      const mockError: any = new Error('Authentication failed');
      mockError.code = 'EAUTH';
      mockTransporter.verify.mockRejectedValue(mockError);

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication failed: Invalid username or password');
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      const mockInfo = {
        messageId: '<test-message-id@example.com>',
        accepted: ['recipient@example.com'],
        rejected: [],
      };

      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const result = await adapter.sendTestEmail('recipient@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Test email sent successfully');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'OpsManager SMTP Test Email',
        }),
      );
    });

    it('should return failure when email sending fails', async () => {
      const mockError: any = new Error('Email rejected');
      mockError.responseCode = 550;
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await adapter.sendTestEmail('invalid@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email rejected: Invalid recipient or sender');
    });
  });

  describe('close', () => {
    it('should close the transporter', async () => {
      await adapter.close();

      expect(mockTransporter.close).toHaveBeenCalled();
    });
  });
});
