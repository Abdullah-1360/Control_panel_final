import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { ApplicationService } from '../services/application.service';
import { DiscoveryQueueService } from '../services/discovery-queue.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  DiscoverApplicationsDto,
  DiagnoseApplicationDto,
  HealApplicationDto,
  UpdateSubdomainMetadataDto,
  ToggleSubdomainHealerDto,
} from '../dto/application.dto';
import { TechStack, HealthStatus } from '@prisma/client';

@Controller('healer/applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly discoveryQueueService: DiscoveryQueueService,
  ) {}

  /**
   * Get all applications with filters
   */
  @Get()
  @RequirePermissions('healer', 'read')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('techStack') techStack?: TechStack,
    @Query('healthStatus') healthStatus?: HealthStatus,
    @Query('serverId') serverId?: string,
  ) {
    return this.applicationService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      techStack,
      healthStatus,
      serverId,
    });
  }

  /**
   * Get application by ID
   */
  @Get(':id')
  @RequirePermissions('healer', 'read')
  async findOne(@Param('id') id: string) {
    return this.applicationService.findOne(id);
  }

  /**
   * Create new application
   */
  @Post()
  @RequirePermissions('healer', 'create')
  async create(@Body() createDto: CreateApplicationDto) {
    return this.applicationService.create(createDto);
  }

  /**
   * Update application
   */
  @Put(':id')
  @RequirePermissions('healer', 'update')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateApplicationDto,
  ) {
    return this.applicationService.update(id, updateDto);
  }

  /**
   * Delete application
   */
  @Delete(':id')
  @RequirePermissions('healer', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    return this.applicationService.delete(id);
  }

  /**
   * Discover applications on a server (synchronous - legacy)
   */
  @Post('discover')
  @RequirePermissions('healer', 'create')
  async discover(@Body() discoverDto: DiscoverApplicationsDto) {
    return this.applicationService.discover({
      serverId: discoverDto.serverId,
      paths: discoverDto.paths,
      techStacks: discoverDto.techStacks,
      forceRediscover: discoverDto.forceRediscover,
    });
  }

  /**
   * Discover applications on a server (queued - recommended)
   */
  @Post('discover-queued')
  @RequirePermissions('healer', 'create')
  async discoverQueued(
    @Body() discoverDto: DiscoverApplicationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const server = await this.applicationService['prisma'].servers.findUnique({
      where: { id: discoverDto.serverId },
      select: { name: true },
    });

    if (!server) {
      throw new Error('Server not found');
    }

    const jobId = await this.discoveryQueueService.enqueueDiscovery({
      serverId: discoverDto.serverId,
      serverName: server.name,
      triggeredBy: user.userId,
      triggerType: 'MANUAL',
      options: {
        forceRediscover: discoverDto.forceRediscover,
        paths: discoverDto.paths,
        techStacks: discoverDto.techStacks,
      },
    });

    return {
      jobId,
      message: 'Discovery job enqueued successfully',
    };
  }

  /**
   * Get discovery job progress
   */
  @Get('discovery/:jobId/progress')
  @RequirePermissions('healer', 'read')
  async getDiscoveryProgress(@Param('jobId') jobId: string) {
    const progress = await this.discoveryQueueService.getProgress(jobId);
    if (!progress) {
      throw new Error('Discovery job not found');
    }
    return progress;
  }

  /**
   * Get discovery queue statistics
   */
  @Get('discovery/stats')
  @RequirePermissions('healer', 'read')
  async getDiscoveryStats() {
    return this.discoveryQueueService.getQueueStats();
  }

  /**
   * Get recent discovery jobs
   */
  @Get('discovery/recent')
  @RequirePermissions('healer', 'read')
  async getRecentDiscoveryJobs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.discoveryQueueService.getRecentJobs(limitNum);
  }

  /**
   * Diagnose application
   */
  @Post(':id/diagnose')
  @RequirePermissions('healer', 'diagnose')
  async diagnose(
    @Param('id') id: string,
    @Body() diagnoseDto: DiagnoseApplicationDto,
  ) {
    return this.applicationService.diagnose(id, diagnoseDto.subdomain);
  }

  /**
   * Get diagnostic results for application
   */
  @Get(':id/diagnostics')
  @RequirePermissions('healer', 'read')
  async getDiagnostics(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.applicationService.getDiagnosticResults(
      id,
      limit ? parseInt(limit, 10) : 50,
    );
    return { applicationId: id, results };
  }

  /**
   * Get health score for application
   */
  @Get(':id/health-score')
  @RequirePermissions('healer', 'read')
  async getHealthScore(@Param('id') id: string) {
    const score = await this.applicationService.calculateHealthScore(id);
    return { applicationId: id, healthScore: score };
  }

  /**
   * Execute healing action on application
   */
  @Post(':id/heal')
  @RequirePermissions('healer', 'heal')
  async heal(
    @Param('id') id: string,
    @Body() healDto: HealApplicationDto,
  ) {
    return this.applicationService.heal(id, healDto.actionName, healDto.subdomain);
  }

  /**
   * Collect detailed metadata for application (on-demand)
   */
  @Post(':id/collect-metadata')
  @RequirePermissions('healer', 'read')
  async collectMetadata(@Param('id') id: string) {
    await this.applicationService.collectDetailedMetadata(id);
    return { message: 'Metadata collection completed', applicationId: id };
  }

  /**
   * Update subdomain metadata
   */
  @Put(':id/subdomains/:domain')
  @RequirePermissions('healer', 'update')
  async updateSubdomainMetadata(
    @Param('id') id: string,
    @Param('domain') domain: string,
    @Body() updateDto: UpdateSubdomainMetadataDto,
  ) {
    return this.applicationService.updateSubdomainMetadata(id, domain, updateDto);
  }

  /**
   * Toggle subdomain healer
   */
  @Post(':id/subdomains/:domain/toggle-healer')
  @RequirePermissions('healer', 'update')
  async toggleSubdomainHealer(
    @Param('id') id: string,
    @Param('domain') domain: string,
    @Body() toggleDto: ToggleSubdomainHealerDto,
  ) {
    return this.applicationService.toggleSubdomainHealer(id, domain, toggleDto.enabled);
  }

  /**
   * Get subdomain-specific diagnostics
   */
  @Get(':id/subdomains/:domain/diagnostics')
  @RequirePermissions('healer', 'read')
  async getSubdomainDiagnostics(
    @Param('id') id: string,
    @Param('domain') domain: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.applicationService.getSubdomainDiagnostics(
      id,
      domain,
      limit ? parseInt(limit, 10) : 50,
    );
    return { applicationId: id, subdomain: domain, results };
  }

  /**
   * Detect tech stack for application
   */
  @Post(':id/detect-tech-stack')
  @RequirePermissions('healer', 'read')
  async detectTechStack(@Param('id') id: string) {
    return this.applicationService.detectTechStack(id);
  }

  /**
   * Detect tech stack for subdomain
   */
  @Post(':id/subdomains/:domain/detect-tech-stack')
  @RequirePermissions('healer', 'read')
  async detectSubdomainTechStack(
    @Param('id') id: string,
    @Param('domain') domain: string,
  ) {
    return this.applicationService.detectSubdomainTechStack(id, domain);
  }

  /**
   * Detect tech stack for application and all subdomains
   */
  @Post(':id/detect-all-tech-stacks')
  @RequirePermissions('healer', 'read')
  async detectAllTechStacks(@Param('id') id: string) {
    return this.applicationService.detectAllTechStacks(id);
  }
}
