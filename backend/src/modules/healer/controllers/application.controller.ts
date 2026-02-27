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
import { ApplicationService } from '../services/application.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  DiscoverApplicationsDto,
  DiagnoseApplicationDto,
} from '../dto/application.dto';
import { TechStack, HealthStatus } from '@prisma/client';

@Controller('healer/applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

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
   * Discover applications on a server
   */
  @Post('discover')
  @RequirePermissions('healer', 'create')
  async discover(@Body() discoverDto: DiscoverApplicationsDto) {
    return this.applicationService.discover({
      serverId: discoverDto.serverId,
      techStacks: discoverDto.techStacks,
      autoDetect: discoverDto.autoDetect ?? true,
    });
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
    // This will be implemented when diagnostic checks are ready
    return {
      message: 'Diagnosis started',
      applicationId: id,
      checkIds: diagnoseDto.checkIds,
    };
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
    // This will be implemented when diagnostic results are ready
    return {
      applicationId: id,
      results: [],
    };
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
}
