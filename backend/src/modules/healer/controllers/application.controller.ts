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
import { DiagnosisQueueService } from '../services/diagnosis-queue.service';
import { SiteTechStackService } from '../services/site-tech-stack.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  DiscoverApplicationsDto,
  DiagnoseApplicationDto,
  HealApplicationDto,
  UpdateSubdomainMetadataDto,
  ToggleSubdomainHealerDto,
} from '../dto/application.dto';
import { UpdateDomainAddonsDto, UpdateDomainTypeDto } from '../dto/site-tech-stack.dto';
import { TechStack, HealthStatus, DiagnosisProfile } from '@prisma/client';

@Controller('healer/applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly discoveryQueueService: DiscoveryQueueService,
    private readonly diagnosisQueueService: DiagnosisQueueService,
    private readonly siteTechStackService: SiteTechStackService,
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
   * Get dashboard statistics
   */
  @Get('stats/dashboard')
  @RequirePermissions('healer', 'read')
  async getDashboardStats() {
    return this.applicationService.getDashboardStats();
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
   * Uses queue by default for better performance and server protection
   */
  @Post(':id/diagnose')
  @RequirePermissions('healer', 'diagnose')
  async diagnose(
    @Param('id') id: string,
    @Body() diagnoseDto: DiagnoseApplicationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      console.log(`[ApplicationController] Starting diagnosis for application ${id}`);
      console.log(`[ApplicationController] diagnoseDto:`, JSON.stringify(diagnoseDto, null, 2));
      console.log(`[ApplicationController] subdomain:`, diagnoseDto.subdomain);
      
      // Use queue by default for better performance
      const application = await this.applicationService.findOne(id);

      const jobId = await this.diagnosisQueueService.enqueueDiagnosis({
        applicationId: id,
        serverId: application.serverId,
        domain: application.domain,
        path: application.path,
        subdomain: diagnoseDto.subdomain,
        profile: (diagnoseDto.profile as DiagnosisProfile) || DiagnosisProfile.FULL,
        triggeredBy: user.userId,
        trigger: 'MANUAL',
        priority: 1, // High priority for manual diagnosis
      });

      console.log('[ApplicationController] Diagnosis job enqueued:', jobId);
      
      // Return diagnosisId (same as jobId) for SSE tracking
      return {
        diagnosisId: jobId, // Frontend expects diagnosisId for SSE tracking
        jobId, // Also return jobId for queue tracking
        applicationId: application.id,
        subdomain: diagnoseDto.subdomain || null,
        techStack: application.techStack,
        message: 'Diagnosis started, progress will be sent via SSE',
        useQueue: true,
      };
    } catch (error) {
      console.error('[ApplicationController] Diagnosis error:', error);
      throw error;
    }
  }

  /**
   * Get diagnosis progress by diagnosisId
   */
  @Get('diagnosis/:diagnosisId/progress')
  @RequirePermissions('healer', 'read')
  async getDiagnosisProgress(@Param('diagnosisId') diagnosisId: string) {
    const progress = await this.applicationService.getDiagnosisProgress(diagnosisId);
    return { data: progress || null };
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

  /**
   * Diagnose application (queued - recommended for production)
   */
  @Post(':id/diagnose-queued')
  @RequirePermissions('healer', 'diagnose')
  async diagnoseQueued(
    @Param('id') id: string,
    @Body() diagnoseDto: DiagnoseApplicationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const application = await this.applicationService.findOne(id);

    const jobId = await this.diagnosisQueueService.enqueueDiagnosis({
      applicationId: id,
      serverId: application.serverId,
      domain: application.domain,
      path: application.path,
      subdomain: diagnoseDto.subdomain,
      profile: (diagnoseDto.profile as DiagnosisProfile) || DiagnosisProfile.FULL,
      triggeredBy: user.userId,
      trigger: 'MANUAL',
    });

    return {
      jobId,
      message: 'Diagnosis job enqueued successfully',
    };
  }

  /**
   * Diagnose all domains (main + subdomains + addons) - queued
   */
  @Post(':id/diagnose-all-queued')
  @RequirePermissions('healer', 'diagnose')
  async diagnoseAllQueued(
    @Param('id') id: string,
    @Query('profile') profile?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.diagnosisQueueService.enqueueDiagnosisForAllDomains(
      id,
      (profile as DiagnosisProfile) || DiagnosisProfile.FULL,
      user?.userId,
    );

    return {
      ...result,
      message: `Enqueued diagnosis for ${result.totalDomains} domains`,
    };
  }

  /**
   * Get diagnosis job status
   */
  @Get('diagnosis-jobs/:jobId/status')
  @RequirePermissions('healer', 'read')
  async getDiagnosisJobStatus(@Param('jobId') jobId: string) {
    const status = await this.diagnosisQueueService.getJobStatus(jobId);
    
    if (!status) {
      throw new Error('Job not found');
    }

    return status;
  }

  /**
   * Get batch diagnosis status
   */
  @Get('diagnosis-batches/:batchId/status')
  @RequirePermissions('healer', 'read')
  async getBatchDiagnosisStatus(@Param('batchId') batchId: string) {
    return this.diagnosisQueueService.getBatchStatus(batchId);
  }

  /**
   * Get diagnosis queue statistics
   */
  @Get('diagnosis-queue/stats')
  @RequirePermissions('healer', 'read')
  async getDiagnosisQueueStats() {
    return this.diagnosisQueueService.getQueueStats();
  }

  /**
   * Get recent diagnosis jobs
   */
  @Get('diagnosis-queue/recent')
  @RequirePermissions('healer', 'read')
  async getRecentDiagnosisJobs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.diagnosisQueueService.getRecentJobs(limitNum);
  }

  /**
   * Retry failed diagnosis job
   */
  @Post('diagnosis-jobs/:jobId/retry')
  @RequirePermissions('healer', 'diagnose')
  async retryDiagnosisJob(@Param('jobId') jobId: string) {
    await this.diagnosisQueueService.retryJob(jobId);
    return { message: 'Job retry initiated' };
  }

  /**
   * Cancel diagnosis job
   */
  @Delete('diagnosis-jobs/:jobId')
  @RequirePermissions('healer', 'diagnose')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelDiagnosisJob(@Param('jobId') jobId: string) {
    await this.diagnosisQueueService.cancelJob(jobId);
  }

  /**
   * Get persistent tech stack information for application
   */
  @Get(':id/tech-stack')
  @RequirePermissions('healer', 'read')
  async getTechStack(@Param('id') id: string) {
    return this.siteTechStackService.getTechStack(id);
  }

  /**
   * Update domain addon information (SSL, DNS, email)
   */
  @Put(':id/tech-stack/addons')
  @RequirePermissions('healer', 'update')
  async updateDomainAddons(
    @Param('id') id: string,
    @Body() updateDto: UpdateDomainAddonsDto,
  ) {
    return this.siteTechStackService.updateDomainAddons(id, updateDto);
  }

  /**
   * Update domain type information
   */
  @Put(':id/tech-stack/domain-type')
  @RequirePermissions('healer', 'update')
  async updateDomainType(
    @Param('id') id: string,
    @Body() updateDto: UpdateDomainTypeDto,
  ) {
    return this.siteTechStackService.updateDomainType(id, updateDto);
  }

  /**
   * Get all tech stacks with filters
   */
  @Get('tech-stacks/all')
  @RequirePermissions('healer', 'read')
  async getAllTechStacks(
    @Query('techStack') techStack?: TechStack,
    @Query('isMainDomain') isMainDomain?: string,
    @Query('isSubdomain') isSubdomain?: string,
    @Query('isParkedDomain') isParkedDomain?: string,
    @Query('isAddonDomain') isAddonDomain?: string,
  ) {
    return this.siteTechStackService.findAll({
      techStack,
      isMainDomain: isMainDomain === 'true',
      isSubdomain: isSubdomain === 'true',
      isParkedDomain: isParkedDomain === 'true',
      isAddonDomain: isAddonDomain === 'true',
    });
  }

  /**
   * Trigger diagnosis for all existing WordPress sites with multiple domains
   * This is useful for diagnosing sites that were discovered before auto-diagnosis was implemented
   */
  @Post('trigger-diagnosis-for-existing-wp-sites')
  @RequirePermissions('healer', 'diagnose')
  async triggerDiagnosisForExistingWpSites(
    @CurrentUser() user: JwtPayload,
    @Query('forceAll') forceAll?: string,
  ) {
    const prisma = this.applicationService['prisma'];
    
    // Find all WordPress applications
    const wpApps = await prisma.applications.findMany({
      where: {
        techStack: 'WORDPRESS',
      },
      select: {
        id: true,
        domain: true,
        metadata: true,
        healthScore: true,
        lastHealthCheck: true,
      },
    });

    let triggered = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const app of wpApps) {
      const metadata = app.metadata as any;
      const subdomains = metadata?.availableSubdomains || [];
      const totalDomains = 1 + subdomains.length;

      // Only trigger if:
      // 1. Has multiple domains (2+)
      // 2. Never diagnosed OR health score is 0 OR forceAll=true
      const shouldTrigger = totalDomains >= 2 && 
        (forceAll === 'true' || !app.lastHealthCheck || app.healthScore === 0);

      if (shouldTrigger) {
        try {
          const result = await this.diagnosisQueueService.enqueueDiagnosisForAllDomains(
            app.id,
            DiagnosisProfile.FULL,
            user.userId,
          );

          results.push({
            domain: app.domain,
            totalDomains,
            status: 'triggered',
            batchId: result.batchId,
            jobCount: result.totalDomains,
          });
          triggered++;
        } catch (error: any) {
          results.push({
            domain: app.domain,
            totalDomains,
            status: 'failed',
            error: error.message,
          });
        }
      } else {
        results.push({
          domain: app.domain,
          totalDomains,
          status: 'skipped',
          reason: totalDomains < 2 
            ? 'Only 1 domain' 
            : 'Already diagnosed',
        });
        skipped++;
      }
    }

    return {
      summary: {
        totalWordPressSites: wpApps.length,
        triggered,
        skipped,
      },
      results,
      message: `Triggered diagnosis for ${triggered} WordPress sites with multiple domains`,
    };
  }
}
