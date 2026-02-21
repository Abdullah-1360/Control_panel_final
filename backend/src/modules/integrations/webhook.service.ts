import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from './integrations.service';
import * as crypto from 'crypto';

/**
 * Webhook Service
 * Handles webhook processing and signature verification
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Process incoming webhook
   * @param integrationId - Integration ID
   * @param headers - Request headers
   * @param payload - Webhook payload
   * @param rawBody - Raw request body (for signature verification)
   * @param sourceIp - Source IP address
   * @param userAgent - User agent string
   */
  async processWebhook(
    integrationId: string,
    headers: Record<string, string>,
    payload: any,
    rawBody: Buffer | undefined,
    sourceIp?: string,
    userAgent?: string,
  ): Promise<{ eventId: string }> {
    // Get integration
    const integration = await this.integrationsService.findOne(integrationId);

    if (!integration.isActive) {
      throw new UnauthorizedException('Integration is not active');
    }

    // Get decrypted configuration for signature verification
    const config = await this.integrationsService.getDecryptedConfig(integrationId);

    // Verify signature based on provider
    await this.verifySignature(
      integration.provider,
      headers,
      payload,
      rawBody,
      config,
    );

    // Extract event type
    const eventType = this.extractEventType(integration.provider, headers, payload);

    // Store webhook event
    const webhookEvent = await this.prisma.webhook_events.create({
      data: {
        integrationId,
        eventType,
        payload,
        headers: headers as any,
        sourceIp,
        userAgent,
        processed: false,
      },
    });

    this.logger.log(
      `Webhook event stored: ${webhookEvent.id} (${eventType}) for integration ${integrationId}`,
    );

    // TODO: Dispatch to Module 7 (Event Store) when available
    // For now, just mark as processed
    await this.prisma.webhook_events.update({
      where: { id: webhookEvent.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return { eventId: webhookEvent.id };
  }

  /**
   * Verify webhook signature based on provider
   */
  private async verifySignature(
    provider: string,
    headers: Record<string, string>,
    payload: any,
    rawBody: Buffer | undefined,
    config: any,
  ): Promise<void> {
    switch (provider) {
      case 'GIT_GITHUB':
        this.verifyGitHubSignature(headers, rawBody, config.webhookSecret);
        break;

      case 'GIT_GITLAB':
        this.verifyGitLabSignature(headers, config.webhookSecret);
        break;

      case 'SLACK':
        this.verifySlackSignature(headers, rawBody, config.signingSecret);
        break;

      case 'WHMCS':
        this.verifyWHMCSSignature(payload, config.webhookSecret);
        break;

      default:
        // No signature verification for other providers
        this.logger.warn(`No signature verification for provider: ${provider}`);
    }
  }

  /**
   * Verify GitHub webhook signature (HMAC SHA256)
   */
  private verifyGitHubSignature(
    headers: Record<string, string>,
    rawBody: Buffer | undefined,
    secret: string,
  ): void {
    const signature = headers['x-hub-signature-256'];

    if (!signature) {
      throw new UnauthorizedException('Missing GitHub signature');
    }

    if (!rawBody) {
      throw new UnauthorizedException('Raw body required for signature verification');
    }

    if (!secret) {
      this.logger.warn('GitHub webhook secret not configured, skipping verification');
      return;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    // Use constant-time comparison to prevent timing attacks
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        throw new UnauthorizedException('Invalid GitHub signature');
      }
    } catch (error) {
      // If buffers are different lengths, timingSafeEqual throws RangeError
      throw new UnauthorizedException('Invalid GitHub signature');
    }

    this.logger.debug('GitHub signature verified successfully');
  }

  /**
   * Verify GitLab webhook signature (Token-based)
   */
  private verifyGitLabSignature(
    headers: Record<string, string>,
    secret: string,
  ): void {
    const token = headers['x-gitlab-token'];

    if (!token) {
      throw new UnauthorizedException('Missing GitLab token');
    }

    if (!secret) {
      this.logger.warn('GitLab webhook secret not configured, skipping verification');
      return;
    }

    if (token !== secret) {
      throw new UnauthorizedException('Invalid GitLab token');
    }

    this.logger.debug('GitLab token verified successfully');
  }

  /**
   * Verify Slack webhook signature (HMAC SHA256 with timestamp)
   */
  private verifySlackSignature(
    headers: Record<string, string>,
    rawBody: Buffer | undefined,
    signingSecret: string,
  ): void {
    const signature = headers['x-slack-signature'];
    const timestamp = headers['x-slack-request-timestamp'];

    if (!signature || !timestamp) {
      throw new UnauthorizedException('Missing Slack signature or timestamp');
    }

    if (!rawBody) {
      throw new UnauthorizedException('Raw body required for signature verification');
    }

    if (!signingSecret) {
      this.logger.warn('Slack signing secret not configured, skipping verification');
      return;
    }

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
      throw new UnauthorizedException('Slack request timestamp too old');
    }

    // Compute signature
    const sigBasestring = `v0:${timestamp}:${rawBody.toString()}`;
    const hmac = crypto.createHmac('sha256', signingSecret);
    const digest = 'v0=' + hmac.update(sigBasestring).digest('hex');

    // Use constant-time comparison to prevent timing attacks
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        throw new UnauthorizedException('Invalid Slack signature');
      }
    } catch (error) {
      // If buffers are different lengths, timingSafeEqual throws RangeError
      throw new UnauthorizedException('Invalid Slack signature');
    }

    this.logger.debug('Slack signature verified successfully');
  }

  /**
   * Verify WHMCS webhook signature (MD5 hash)
   */
  private verifyWHMCSSignature(payload: any, secret: string): void {
    const receivedHash = payload.hash;

    if (!receivedHash) {
      throw new UnauthorizedException('Missing WHMCS hash');
    }

    if (!secret) {
      this.logger.warn('WHMCS webhook secret not configured, skipping verification');
      return;
    }

    // WHMCS uses MD5 hash of specific fields + secret
    // Format: MD5(field1|field2|field3|secret)
    // Note: Actual fields depend on webhook type
    const dataToHash = `${payload.userid || ''}|${payload.id || ''}|${secret}`;
    const computedHash = crypto.createHash('md5').update(dataToHash).digest('hex');

    if (receivedHash !== computedHash) {
      throw new UnauthorizedException('Invalid WHMCS signature');
    }

    this.logger.debug('WHMCS signature verified successfully');
  }

  /**
   * Extract event type from webhook
   */
  private extractEventType(
    provider: string,
    headers: Record<string, string>,
    payload: any,
  ): string {
    switch (provider) {
      case 'GIT_GITHUB':
        return headers['x-github-event'] || 'unknown';

      case 'GIT_GITLAB':
        return headers['x-gitlab-event'] || 'unknown';

      case 'SLACK':
        return payload.type || payload.event?.type || 'unknown';

      case 'WHMCS':
        return payload.action || 'unknown';

      default:
        return 'webhook_received';
    }
  }

  /**
   * Get webhook events for an integration
   */
  async getWebhookEvents(
    integrationId: string,
    options?: {
      limit?: number;
      offset?: number;
      processed?: boolean;
    },
  ) {
    return this.prisma.webhook_events.findMany({
      where: {
        integrationId,
        processed: options?.processed,
      },
      orderBy: {
        receivedAt: 'desc',
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  /**
   * Get webhook event by ID
   */
  async getWebhookEvent(eventId: string) {
    const event = await this.prisma.webhook_events.findUnique({
      where: { id: eventId },
      include: {
        integrations: {
          select: {
            id: true,
            name: true,
            provider: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Webhook event ${eventId} not found`);
    }

    return event;
  }
}
