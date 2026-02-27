import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HealerService } from './healer.service';
import { PatternLearningService } from './services/pattern-learning.service';
import { ManualDiagnosisService } from './services/manual-diagnosis.service';
import { UnifiedDiagnosisService } from './services/unified-diagnosis.service';
import { MetricsService } from './services/metrics.service';
import { SecurityService } from './services/security.service';
// TODO: Import these from Module 1 when available
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { PermissionsGuard } from '../auth/guards/permissions.guard';
// import { Permissions } from '../auth/decorators/permissions.decorator';
// import { CurrentUser } from '../auth/decorators/current-user.decorator';
// import { IpAddress } from '../auth/decorators/ip-address.decorator';
// import { UserAgent } from '../auth/decorators/user-agent.decorator';
import { DiscoverSitesDto } from './dto/discover-sites.dto';
import { HealSiteDto } from './dto/heal-site.dto';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { DiagnoseSiteDto } from './dto/diagnose-site.dto';
import { DiagnosisProfile } from './enums/diagnosis-profile.enum';
import { MetricPeriodType } from '@prisma/client';

@Controller('healer')
// @UseGuards(JwtAuthGuard, PermissionsGuard) // TODO: Enable when Module 1 is integrated
export class HealerController {
  constructor(
    private readonly healerService: HealerService,
    private readonly patternLearning: PatternLearningService,
    private readonly manualDiagnosis: ManualDiagnosisService,
    private readonly unifiedDiagnosis: UnifiedDiagnosisService,
    private readonly metricsService: MetricsService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * GET /api/v1/healer/health
   * Get healer system health and migration status
   */
  @Get('health')
  async getHealth() {
    return {
      data: {
        wordpress: {
          status: 'operational',
          version: '1.0',
          description: 'WordPress healer fully functional',
          endpoints: ['/api/v1/healer/sites', '/api/v1/healer/discover'],
        },
        universal: {
          status: 'testing',
          version: '0.3',
          description: 'Universal healer - Phase 3 Week 2 in progress',
          endpoints: ['/api/v1/healer/applications'],
          supportedTechStacks: ['NODEJS', 'PHP_GENERIC', 'LARAVEL', 'NEXTJS', 'EXPRESS'],
          pluginsRegistered: 5,
          testApplications: 5,
          note: 'WordPress uses separate endpoint: /api/v1/healer/sites (fully functional)',
        },
        migration: {
          phase: '3',
          status: 'week-2',
          progress: '25%',
          nextPhase: '4',
          nextPhaseEta: '4-5 weeks',
          description: 'Phase 3 Week 2: Frontend integration & WordPress migration',
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * POST /api/v1/healer/discover
   * Discover WordPress sites on a server
   */
  @Post('discover')
  // @Permissions('healer.discover') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async discoverSites(@Body() dto: DiscoverSitesDto) {
    const result = await this.healerService.discoverSites(dto.serverId);
    return { data: result };
  }

  /**
   * GET /api/v1/healer/sites
   * List all sites with filtering
   */
  @Get('sites')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async listSites(
    @Query('serverId') serverId?: string,
    @Query('healthStatus') healthStatus?: string,
    @Query('isHealerEnabled') isHealerEnabled?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      serverId,
      healthStatus,
      isHealerEnabled: isHealerEnabled === 'true' ? true : undefined,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    };

    return this.healerService.listSites(filters);
  }

  /**
   * GET /api/v1/healer/sites/:id
   * Get site details
   */
  @Get('sites/:id')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getSite(@Param('id') siteId: string) {
    const site = await this.healerService.getSite(siteId);
    return { data: site };
  }

  /**
   * GET /api/v1/healer/search
   * Fuzzy search sites by domain
   */
  @Get('search')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async searchSites(@Query('q') query: string) {
    const results = await this.healerService.searchSites(query);
    return { data: results };
  }

  /**
   * POST /api/v1/healer/sites/:id/diagnose
   * Trigger diagnosis for a site (with optional subdomain)
   */
  @Post('sites/:id/diagnose')
  // @Permissions('healer.diagnose') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async diagnose(
    @Param('id') siteId: string,
    @Body() body?: { subdomain?: string },
    // @CurrentUser() user: any, // TODO: Enable when Module 1 is integrated
  ) {
    const result = await this.healerService.diagnose(siteId, 'system', body?.subdomain); // TODO: Use user.id when available
    return { data: result };
  }

  /**
   * GET /api/v1/healer/sites/:id/subdomains
   * Get available subdomains for a site
   */
  @Get('sites/:id/subdomains')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getSubdomains(@Param('id') siteId: string) {
    const subdomains = await this.healerService.getSubdomains(siteId);
    return { data: subdomains };
  }

  /**
   * POST /api/v1/healer/sites/:id/heal
   * Execute healing (manual button click)
   */
  @Post('sites/:id/heal')
  // @Permissions('healer.heal') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async heal(
    @Param('id') siteId: string,
    @Body() dto: HealSiteDto,
  ) {
    const result = await this.healerService.heal(dto.executionId, dto.customCommands);
    return { data: result };
  }

  /**
   * POST /api/v1/healer/sites/:id/rollback/:executionId
   * Rollback to backup
   */
  @Post('sites/:id/rollback/:executionId')
  // @Permissions('healer.rollback') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async rollback(
    @Param('id') siteId: string,
    @Param('executionId') executionId: string,
  ) {
    await this.healerService.rollback(executionId);
    return {
      data: {
        message: 'Rollback completed successfully',
        executionId,
      },
    };
  }

  /**
   * GET /api/v1/healer/sites/:id/executions
   * Get healing history for a site
   */
  @Get('sites/:id/executions')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getHealingHistory(
    @Param('id') siteId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.healerService.getHealingHistory(
      siteId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * GET /api/v1/healer/executions/:id
   * Get execution details with logs
   */
  @Get('executions/:id')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getExecution(@Param('id') executionId: string) {
    const execution = await this.healerService.getExecution(executionId);
    return { data: execution };
  }

  /**
   * PATCH /api/v1/healer/sites/:id/config
   * Update site healer configuration
   */
  @Patch('sites/:id/config')
  // @Permissions('healer.configure') // TODO: Enable when Module 1 is integrated
  async updateSiteConfig(
    @Param('id') siteId: string,
    @Body() config: UpdateSiteConfigDto,
  ) {
    const site = await this.healerService.updateSiteConfig(siteId, config);
    return { data: site };
  }

  /**
   * POST /api/v1/healer/sites/:id/reset-circuit-breaker
   * Reset circuit breaker for a site (clears healing attempt counter)
   */
  @Post('sites/:id/reset-circuit-breaker')
  // @Permissions('healer.admin') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async resetCircuitBreaker(@Param('id') siteId: string) {
    await this.healerService.resetCircuitBreaker(siteId);
    return {
      data: {
        message: 'Circuit breaker reset successfully',
        siteId,
      },
    };
  }

  // ============================================================================
  // METRICS & MONITORING ENDPOINTS (Phase 1)
  // ============================================================================

  /**
   * GET /api/v1/healer/metrics/:periodType
   * Get metrics for dashboard
   */
  @Get('metrics/:periodType')
  // @Permissions('healer.metrics.read') // TODO: Enable when Module 1 is integrated
  async getMetrics(
    @Param('periodType') periodType: string,
    @Query('limit') limit?: string,
  ) {
    const metrics = await this.metricsService.getMetrics(
      periodType as MetricPeriodType,
      limit ? parseInt(limit) : 24,
    );
    return { data: metrics };
  }

  /**
   * GET /api/v1/healer/alerts
   * Get active alerts
   */
  @Get('alerts')
  // @Permissions('healer.alerts.read') // TODO: Enable when Module 1 is integrated
  async getActiveAlerts() {
    const alerts = await this.metricsService.getActiveAlerts();
    return { data: alerts };
  }

  /**
   * POST /api/v1/healer/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  @Post('alerts/:id/acknowledge')
  // @Permissions('healer.alerts.manage') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async acknowledgeAlert(
    @Param('id') alertId: string,
    // @CurrentUser() user: any, // TODO: Enable when Module 1 is integrated
  ) {
    await this.metricsService.acknowledgeAlert(alertId, 'system'); // TODO: Use user.id
    return {
      data: {
        message: 'Alert acknowledged successfully',
        alertId,
      },
    };
  }

  /**
   * POST /api/v1/healer/alerts/:id/resolve
   * Resolve an alert
   */
  @Post('alerts/:id/resolve')
  // @Permissions('healer.alerts.manage') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async resolveAlert(@Param('id') alertId: string) {
    await this.metricsService.resolveAlert(alertId);
    return {
      data: {
        message: 'Alert resolved successfully',
        alertId,
      },
    };
  }

  /**
   * GET /api/v1/healer/audit-logs
   * Get audit logs with filtering
   */
  @Get('audit-logs')
  // @Permissions('healer.audit.read') // TODO: Enable when Module 1 is integrated
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('siteId') siteId?: string,
    @Query('executionId') executionId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.securityService.getAuditLogs({
      userId,
      siteId,
      executionId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ============================================================================
  // PATTERN LEARNING ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v1/healer/patterns
   * List all learned healing patterns
   */
  @Get('patterns')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async listPatterns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patternLearning.getAllPatterns(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  /**
   * DELETE /api/v1/healer/patterns/:id
   * Delete a learned pattern
   */
  @Delete('patterns/:id')
  // @Permissions('healer.admin') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePattern(@Param('id') patternId: string) {
    await this.patternLearning.deletePattern(patternId);
  }

  /**
   * PATCH /api/v1/healer/patterns/:id/approval
   * Manually approve or disapprove a pattern
   */
  @Patch('patterns/:id/approval')
  // @Permissions('healer.admin') // TODO: Enable when Module 1 is integrated
  async setPatternApproval(
    @Param('id') patternId: string,
    @Body() body: { approved: boolean },
  ) {
    await this.patternLearning.setPatternApproval(patternId, body.approved);
    return {
      data: {
        message: `Pattern ${body.approved ? 'approved' : 'disapproved'} successfully`,
        patternId,
      },
    };
  }

  // ============================================================================
  // UNIFIED DIAGNOSIS ENDPOINTS (Phase 1)
  // ============================================================================

  /**
   * POST /api/v1/healer/sites/:id/diagnose/unified
   * Unified diagnosis with profile support
   */
  @Post('sites/:id/diagnose/unified')
  // @Permissions('healer.diagnose') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async diagnoseUnified(
    @Param('id') siteId: string,
    @Body() dto: DiagnoseSiteDto,
    // @CurrentUser() user: any, // TODO: Enable when Module 1 is integrated
  ) {
    const result = await this.unifiedDiagnosis.diagnose(siteId, dto.profile, {
      customChecks: dto.customChecks,
      subdomain: dto.subdomain,
      bypassCache: dto.bypassCache,
      triggeredBy: 'system', // TODO: Use user.id when available
      trigger: 'MANUAL' as any,
    });
    return { data: result };
  }

  /**
   * GET /api/v1/healer/sites/:id/diagnosis-history
   * Get diagnosis history for a site
   */
  @Get('sites/:id/diagnosis-history')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getDiagnosisHistory(
    @Param('id') siteId: string,
    @Query('profile') profile?: DiagnosisProfile,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const history = await this.unifiedDiagnosis.getDiagnosisHistory(
      siteId,
      {
        profile,
        limit: limit ? parseInt(limit) : 20,
        page: page ? parseInt(page) : 1,
      },
    );
    return { data: history };
  }

  /**
   * GET /api/v1/healer/sites/:id/health-score-history
   * Get health score history for trending
   */
  @Get('sites/:id/health-score-history')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getHealthScoreHistory(
    @Param('id') siteId: string,
    @Query('days') days?: string,
    @Query('profile') profile?: DiagnosisProfile,
  ) {
    const history = await this.unifiedDiagnosis.getHealthScoreHistory(
      siteId,
      {
        days: days ? parseInt(days) : 30,
        profile,
      },
    );
    return { data: history };
  }

  /**
   * GET /api/v1/healer/profiles
   * Get available diagnosis profiles
   */
  @Get('profiles')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getDiagnosisProfiles() {
    const profiles = await this.unifiedDiagnosis.getAvailableProfiles();
    return { data: profiles };
  }

  /**
   * DELETE /api/v1/healer/cache
   * Clear diagnosis cache (admin only)
   */
  @Delete('cache')
  // @Permissions('healer.admin') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async clearDiagnosisCache(
    @Query('siteId') siteId?: string,
    @Query('profile') profile?: DiagnosisProfile,
  ) {
    const count = await this.unifiedDiagnosis.clearCache(siteId, profile);
    return {
      data: {
        message: `Cleared ${count} cache entries`,
        count,
      },
    };
  }

  // ============================================================================
  // MANUAL DIAGNOSIS ENDPOINTS (Legacy - kept for backward compatibility)
  // ============================================================================

  /**
   * POST /api/v1/healer/manual/:sessionId/execute
   * Execute command in manual diagnosis session
   */
  @Post('manual/:sessionId/execute')
  // @Permissions('healer.diagnose') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async executeManualCommand(
    @Param('sessionId') sessionId: string,
    @Body() body: { command: string },
  ) {
    const result = await this.manualDiagnosis.executeCommand(sessionId, body.command);
    return { data: result };
  }

  /**
   * POST /api/v1/healer/manual/:sessionId/suggest
   * Get next command suggestions
   */
  @Post('manual/:sessionId/suggest')
  // @Permissions('healer.diagnose') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async suggestNextCommand(
    @Param('sessionId') sessionId: string,
    @Body() body: { lastCommand: string; lastOutput: string },
  ) {
    const suggestions = await this.manualDiagnosis.suggestNextCommand(
      sessionId,
      body.lastCommand,
      body.lastOutput,
    );
    return { data: suggestions };
  }

  /**
   * POST /api/v1/healer/manual/:sessionId/auto
   * Switch to auto mode
   */
  @Post('manual/:sessionId/auto')
  // @Permissions('healer.diagnose') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async switchToAutoMode(@Param('sessionId') sessionId: string) {
    const result = await this.manualDiagnosis.switchToAutoMode(sessionId);
    return { data: result };
  }

  /**
   * POST /api/v1/healer/manual/:sessionId/complete
   * Complete manual diagnosis
   */
  @Post('manual/:sessionId/complete')
  // @Permissions('healer.diagnose') // TODO: Enable when Module 1 is integrated
  @HttpCode(HttpStatus.OK)
  async completeManualDiagnosis(
    @Param('sessionId') sessionId: string,
    @Body() body: { findings: any },
  ) {
    const result = await this.manualDiagnosis.completeManualDiagnosis(sessionId, body.findings);
    return { data: result };
  }

  /**
   * GET /api/v1/healer/manual/:sessionId
   * Get manual diagnosis session details
   */
  @Get('manual/:sessionId')
  // @Permissions('healer.read') // TODO: Enable when Module 1 is integrated
  async getManualSession(@Param('sessionId') sessionId: string) {
    const session = await this.manualDiagnosis.getSession(sessionId);
    return { data: session };
  }
}
