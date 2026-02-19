import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { ClientFactoryService } from './client-factory.service';
import { HealthMonitorService } from './health-monitor.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProviderType } from '@prisma/client';
import { SmtpAdapter } from './adapters/base.adapter';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly clientFactory: ClientFactoryService,
    private readonly healthMonitor: HealthMonitorService,
  ) {}

  @Post()
  @RequirePermissions('integrations', 'create')
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid configuration' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(
    @Body() createIntegrationDto: CreateIntegrationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.integrationsService.create(createIntegrationDto, userId);
  }

  @Get()
  @RequirePermissions('integrations', 'read')
  @ApiOperation({ summary: 'Get all integrations' })
  @ApiResponse({ status: 200, description: 'List of integrations' })
  async findAll(
    @Query('provider') provider?: ProviderType,
    @Query('isActive') isActive?: string,
    @Query('linkedServerId') linkedServerId?: string,
  ) {
    const integrations = await this.integrationsService.findAll({
      provider,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      linkedServerId,
    });

    // Return in expected format with pagination
    return {
      data: integrations,
      pagination: {
        total: integrations.length,
        page: 1,
        limit: integrations.length,
        totalPages: 1,
      },
    };
  }

  @Get('providers')
  @RequirePermissions('integrations', 'read')
  @ApiOperation({ summary: 'Get list of supported providers' })
  @ApiResponse({ status: 200, description: 'List of supported providers' })
  getSupportedProviders() {
    return this.integrationsService.getSupportedProviders();
  }

  @Get(':id')
  @RequirePermissions('integrations', 'read')
  @ApiOperation({ summary: 'Get integration by ID' })
  @ApiResponse({ status: 200, description: 'Integration details' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  findOne(@Param('id') id: string) {
    return this.integrationsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('integrations', 'update')
  @ApiOperation({ summary: 'Update an integration' })
  @ApiResponse({ status: 200, description: 'Integration updated successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async update(
    @Param('id') id: string,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
    @CurrentUser('sub') userId: string,
  ) {
    const integration = await this.integrationsService.update(id, updateIntegrationDto, userId);
    
    // Clear cache when config is updated
    await this.clientFactory.clearCache(id);
    
    return integration;
  }

  @Delete(':id')
  @RequirePermissions('integrations', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an integration' })
  @ApiResponse({ status: 204, description: 'Integration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.integrationsService.remove(id, userId);
  }

  @Post(':id/test')
  @RequirePermissions('integrations', 'update')
  @ApiOperation({ summary: 'Test integration connection' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async testConnection(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    // Get the adapter client
    const client = await this.clientFactory.getClient(id);

    // Test connection
    const result = await client.testConnection();

    // Update health status in database
    await this.integrationsService.updateHealthStatus(
      id,
      result.success,
      result.message,
      result.latency,
    );

    return {
      success: result.success,
      message: result.message,
      latency: result.latency,
      testedAt: new Date().toISOString(),
    };
  }

  @Post(':id/send-test-email')
  @RequirePermissions('integrations', 'update')
  @ApiOperation({ summary: 'Send test email (SMTP only)' })
  @ApiResponse({ status: 200, description: 'Test email sent' })
  @ApiResponse({ status: 400, description: 'Not an SMTP integration' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async sendTestEmail(
    @Param('id') id: string,
    @Body('to') to: string,
  ) {
    const integration = await this.integrationsService.findOne(id);

    if (integration.provider !== ProviderType.SMTP) {
      throw new BadRequestException('This endpoint is only for SMTP integrations');
    }

    const client = (await this.clientFactory.getClient(id)) as SmtpAdapter;
    return client.sendTestEmail(to);
  }

  @Post(':id/health-check')
  @RequirePermissions('integrations', 'update')
  @ApiOperation({ summary: 'Manually trigger health check' })
  @ApiResponse({ status: 200, description: 'Health check queued' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async triggerHealthCheck(@Param('id') id: string) {
    // Verify integration exists
    await this.integrationsService.findOne(id);

    // Queue health check
    await this.healthMonitor.triggerHealthCheck(id);

    return {
      message: 'Health check queued successfully',
      integrationId: id,
    };
  }

  @Get('health/stats')
  @RequirePermissions('integrations', 'read')
  @ApiOperation({ summary: 'Get health check queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics' })
  async getHealthStats() {
    return this.healthMonitor.getQueueStats();
  }
}
