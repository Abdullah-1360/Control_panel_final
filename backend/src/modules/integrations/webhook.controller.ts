import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { WebhookService } from './webhook.service';

/**
 * Webhook Controller
 * Universal webhook receiver for all integration providers
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Universal webhook receiver
   * Handles webhooks from all providers (GitHub, GitLab, Slack, WHMCS, etc.)
   */
  @Post(':integrationId')
  @Public() // Webhooks come from external services, no JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive webhook from integration provider' })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid signature or payload' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async receiveWebhook(
    @Param('integrationId') integrationId: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log(`Received webhook for integration ${integrationId}`);

    try {
      // Process webhook (includes signature verification)
      const result = await this.webhookService.processWebhook(
        integrationId,
        headers,
        payload,
        req.rawBody, // Raw body for signature verification
        req.ip,
        req.get('user-agent'),
      );

      return {
        received: true,
        eventId: result.eventId,
        message: 'Webhook processed successfully',
      };
    } catch (error: any) {
      this.logger.error(
        `Webhook processing failed for integration ${integrationId}`,
        error,
      );

      throw new BadRequestException(
        error.message || 'Failed to process webhook',
      );
    }
  }

  /**
   * GitHub-specific webhook endpoint (alternative)
   * Provides better GitHub-specific handling
   */
  @Post('github/:integrationId')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive GitHub webhook' })
  async receiveGitHubWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-delivery') delivery: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log(`Received GitHub ${event} webhook for integration ${integrationId}`);

    const result = await this.webhookService.processWebhook(
      integrationId,
      {
        'x-github-event': event,
        'x-hub-signature-256': signature,
        'x-github-delivery': delivery,
      },
      payload,
      req.rawBody,
      req.ip,
      req.get('user-agent'),
    );

    return {
      received: true,
      eventId: result.eventId,
      event,
      delivery,
    };
  }

  /**
   * GitLab-specific webhook endpoint (alternative)
   */
  @Post('gitlab/:integrationId')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive GitLab webhook' })
  async receiveGitLabWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-gitlab-event') event: string,
    @Headers('x-gitlab-token') token: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log(`Received GitLab ${event} webhook for integration ${integrationId}`);

    const result = await this.webhookService.processWebhook(
      integrationId,
      {
        'x-gitlab-event': event,
        'x-gitlab-token': token,
      },
      payload,
      req.rawBody,
      req.ip,
      req.get('user-agent'),
    );

    return {
      received: true,
      eventId: result.eventId,
      event,
    };
  }

  /**
   * Slack-specific webhook endpoint (alternative)
   */
  @Post('slack/:integrationId')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Slack webhook' })
  async receiveSlackWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log(`Received Slack webhook for integration ${integrationId}`);

    // Handle Slack URL verification challenge
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    const result = await this.webhookService.processWebhook(
      integrationId,
      {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp,
      },
      payload,
      req.rawBody,
      req.ip,
      req.get('user-agent'),
    );

    return {
      received: true,
      eventId: result.eventId,
    };
  }
}
