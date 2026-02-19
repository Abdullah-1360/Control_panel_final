import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from './integrations.service';
import * as crypto from 'crypto';

describe('WebhookService', () => {
  let service: WebhookService;
  let prismaService: any;
  let integrationsService: jest.Mocked<IntegrationsService>;

  beforeEach(async () => {
    const mockWebhookEvent = {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: PrismaService,
          useValue: {
            webhookEvent: mockWebhookEvent,
          },
        },
        {
          provide: IntegrationsService,
          useValue: {
            findOne: jest.fn(),
            getDecryptedConfig: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    prismaService = module.get(PrismaService);
    integrationsService = module.get(IntegrationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    it('should process webhook and store event', async () => {
      const mockIntegration = {
        id: 'int1',
        name: 'Test Integration',
        provider: 'DISCORD', // Use Discord which doesn't require signature
        isActive: true,
      };

      const mockConfig = {
        webhookUrl: 'https://discord.com/api/webhooks/test',
      };

      const mockWebhookEvent = {
        id: 'evt1',
        integrationId: 'int1',
        eventType: 'webhook_received',
        payload: { content: 'Hello' },
      };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);
      prismaService.webhookEvent.create.mockResolvedValue(mockWebhookEvent as any);
      prismaService.webhookEvent.update.mockResolvedValue(mockWebhookEvent as any);

      const result = await service.processWebhook(
        'int1',
        {},
        { content: 'Hello' },
        undefined,
        '192.168.1.1',
        'Test Agent',
      );

      expect(result.eventId).toBe('evt1');
      expect(prismaService.webhookEvent.create).toHaveBeenCalled();
      expect(prismaService.webhookEvent.update).toHaveBeenCalled();
    });

    it('should throw error if integration is not active', async () => {
      const mockIntegration = {
        id: 'int1',
        name: 'Test Integration',
        provider: 'SLACK',
        isActive: false,
      };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);

      await expect(
        service.processWebhook('int1', {}, {}, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GitHub signature verification', () => {
    it('should verify valid GitHub signature', async () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ action: 'opened' });
      const rawBody = Buffer.from(payload);

      const hmac = crypto.createHmac('sha256', secret);
      const signature = 'sha256=' + hmac.update(rawBody).digest('hex');

      const mockIntegration = {
        id: 'int1',
        provider: 'GIT_GITHUB',
        isActive: true,
      };

      const mockConfig = { webhookSecret: secret };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);
      prismaService.webhookEvent.create.mockResolvedValue({ id: 'evt1' } as any);
      prismaService.webhookEvent.update.mockResolvedValue({ id: 'evt1' } as any);

      await expect(
        service.processWebhook(
          'int1',
          { 'x-hub-signature-256': signature, 'x-github-event': 'push' },
          JSON.parse(payload),
          rawBody,
        ),
      ).resolves.toBeDefined();
    });

    it('should reject invalid GitHub signature', async () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ action: 'opened' });
      const rawBody = Buffer.from(payload);

      const mockIntegration = {
        id: 'int1',
        provider: 'GIT_GITHUB',
        isActive: true,
      };

      const mockConfig = { webhookSecret: secret };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);

      await expect(
        service.processWebhook(
          'int1',
          { 'x-hub-signature-256': 'sha256=invalid', 'x-github-event': 'push' },
          JSON.parse(payload),
          rawBody,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GitLab signature verification', () => {
    it('should verify valid GitLab token', async () => {
      const secret = 'test-token';

      const mockIntegration = {
        id: 'int1',
        provider: 'GIT_GITLAB',
        isActive: true,
      };

      const mockConfig = { webhookSecret: secret };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);
      prismaService.webhookEvent.create.mockResolvedValue({ id: 'evt1' } as any);
      prismaService.webhookEvent.update.mockResolvedValue({ id: 'evt1' } as any);

      await expect(
        service.processWebhook(
          'int1',
          { 'x-gitlab-token': secret, 'x-gitlab-event': 'Push Hook' },
          {},
          undefined,
        ),
      ).resolves.toBeDefined();
    });

    it('should reject invalid GitLab token', async () => {
      const secret = 'test-token';

      const mockIntegration = {
        id: 'int1',
        provider: 'GIT_GITLAB',
        isActive: true,
      };

      const mockConfig = { webhookSecret: secret };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);

      await expect(
        service.processWebhook(
          'int1',
          { 'x-gitlab-token': 'wrong-token', 'x-gitlab-event': 'Push Hook' },
          {},
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Slack signature verification', () => {
    it('should verify valid Slack signature', async () => {
      const signingSecret = 'test-secret';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ type: 'event_callback' });
      const rawBody = Buffer.from(payload);

      const sigBasestring = `v0:${timestamp}:${rawBody.toString()}`;
      const hmac = crypto.createHmac('sha256', signingSecret);
      const signature = 'v0=' + hmac.update(sigBasestring).digest('hex');

      const mockIntegration = {
        id: 'int1',
        provider: 'SLACK',
        isActive: true,
      };

      const mockConfig = { signingSecret };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);
      prismaService.webhookEvent.create.mockResolvedValue({ id: 'evt1' } as any);
      prismaService.webhookEvent.update.mockResolvedValue({ id: 'evt1' } as any);

      await expect(
        service.processWebhook(
          'int1',
          {
            'x-slack-signature': signature,
            'x-slack-request-timestamp': timestamp,
          },
          JSON.parse(payload),
          rawBody,
        ),
      ).resolves.toBeDefined();
    });

    it('should reject old Slack timestamp', async () => {
      const signingSecret = 'test-secret';
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
      const payload = JSON.stringify({ type: 'event_callback' });
      const rawBody = Buffer.from(payload);

      const sigBasestring = `v0:${oldTimestamp}:${rawBody.toString()}`;
      const hmac = crypto.createHmac('sha256', signingSecret);
      const signature = 'v0=' + hmac.update(sigBasestring).digest('hex');

      const mockIntegration = {
        id: 'int1',
        provider: 'SLACK',
        isActive: true,
      };

      const mockConfig = { signingSecret };

      integrationsService.findOne.mockResolvedValue(mockIntegration as any);
      integrationsService.getDecryptedConfig.mockResolvedValue(mockConfig);

      await expect(
        service.processWebhook(
          'int1',
          {
            'x-slack-signature': signature,
            'x-slack-request-timestamp': oldTimestamp,
          },
          JSON.parse(payload),
          rawBody,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
