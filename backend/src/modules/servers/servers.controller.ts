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
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ServersService } from './servers.service';
import { ServerMetricsService } from './server-metrics.service';
import { MetricsQueueService } from './metrics-queue.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { QueryServersDto } from './dto/query-servers.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ConnectionTestThrottlerGuard } from '../../common/guards/connection-test-throttler.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('servers')
@ApiBearerAuth()
@Controller('servers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServersController {
  constructor(
    private readonly serversService: ServersService,
    private readonly metricsService: ServerMetricsService,
    private readonly metricsQueueService: MetricsQueueService,
  ) {}

  @Post()
  @RequirePermissions('servers', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new server profile' })
  @ApiResponse({ status: 201, description: 'Server profile created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or credentials' })
  @ApiResponse({ status: 409, description: 'Server name already exists' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  create(@Body() createServerDto: CreateServerDto, @CurrentUser('sub') userId: string) {
    return this.serversService.create(createServerDto, userId);
  }

  @Get()
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'List all server profiles' })
  @ApiResponse({ status: 200, description: 'Server list retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Query() query: QueryServersDto, @CurrentUser('sub') userId: string) {
    return this.serversService.findAll(query, userId);
  }

  @Get(':id')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get server profile by ID' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Server profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.serversService.findOne(id, userId);
  }

  @Patch(':id')
  @RequirePermissions('servers', 'update')
  @ApiOperation({ summary: 'Update server profile' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Server profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server name conflict' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  update(
    @Param('id') id: string,
    @Body() updateServerDto: UpdateServerDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.serversService.update(id, updateServerDto, userId);
  }

  @Delete(':id')
  @RequirePermissions('servers', 'delete')
  @ApiOperation({ summary: 'Delete server profile' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiQuery({ name: 'force', required: false, description: 'Force delete even with dependencies' })
  @ApiResponse({ status: 200, description: 'Server deleted successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server has active dependencies' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  remove(
    @Param('id') id: string,
    @Query('force') force: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.serversService.remove(id, userId, force === 'true');
  }

  @Get(':id/dependencies')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Check server dependencies' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Dependencies retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  checkDependencies(@Param('id') id: string) {
    return this.serversService.checkDependencies(id);
  }

  @Post(':id/test')
  @RequirePermissions('servers', 'test')
  @UseGuards(ConnectionTestThrottlerGuard)
  @Throttle({ 'connection-test': { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test server connection' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiQuery({ name: 'async', required: false, description: 'Run test asynchronously (true/false)' })
  @ApiResponse({ status: 200, description: 'Connection test completed or started' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Test already in progress' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (10 tests per minute)' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  testConnection(
    @Param('id') id: string,
    @Query('async') async: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.serversService.testConnection(id, userId, async === 'true');
  }

  @Get(':id/test-history')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get connection test history' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Test history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getTestHistory(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.serversService.getTestHistory(id, userId);
  }

  // ============================================
  // METRICS ENDPOINTS
  // ============================================

  @Post(':id/metrics/collect')
  @RequirePermissions('servers', 'read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Collect metrics from server (on-demand)' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Metrics collected successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Failed to collect metrics' })
  async collectMetrics(@Param('id') id: string) {
    try {
      return await this.metricsService.collectMetrics(id);
    } catch (error: any) {
      // Return error response instead of throwing
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to collect metrics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/metrics/latest')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get latest metrics for a server' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Latest metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getLatestMetrics(@Param('id') id: string) {
    return this.metricsService.getLatestMetrics(id);
  }

  @Get(':id/metrics/history')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get metrics history for a server' })
  @ApiParam({ name: 'id', description: 'Server ID (UUID)' })
  @ApiQuery({ name: 'hours', required: false, description: 'Number of hours of history (default: 24)' })
  @ApiResponse({ status: 200, description: 'Metrics history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getMetricsHistory(
    @Param('id') id: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours) : 24;
    return this.metricsService.getMetricsHistory(id, hoursNum);
  }

  @Get('metrics/aggregate')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get aggregated metrics across all servers' })
  @ApiResponse({ status: 200, description: 'Aggregated metrics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAggregatedMetrics() {
    return this.metricsService.getAggregatedMetrics();
  }

  @Get('metrics/aggregate/history')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get aggregated metrics history' })
  @ApiQuery({ name: 'hours', required: false, description: 'Number of hours of history (default: 2)' })
  @ApiResponse({ status: 200, description: 'Aggregated metrics history retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAggregatedMetricsHistory(@Query('hours') hours?: string) {
    const hoursNum = hours ? parseInt(hours) : 2;
    return this.metricsService.getAggregatedMetricsHistory(hoursNum);
  }

  // ============================================
  // QUEUE MANAGEMENT ENDPOINTS
  // ============================================

  @Post('metrics/collect-all')
  @RequirePermissions('servers', 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger metrics collection for all servers' })
  @ApiResponse({ status: 200, description: 'Collection jobs queued successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async collectAllMetrics() {
    return this.metricsQueueService.collectAllMetricsNow();
  }

  @Get('metrics/queue/stats')
  @RequirePermissions('servers', 'read')
  @ApiOperation({ summary: 'Get metrics queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue stats retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getQueueStats() {
    return this.metricsQueueService.getQueueStats();
  }

  @Post('metrics/queue/pause')
  @RequirePermissions('servers', 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause metrics collection queue' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async pauseQueue() {
    await this.metricsQueueService.pauseQueue();
    return { message: 'Metrics collection queue paused' };
  }

  @Post('metrics/queue/resume')
  @RequirePermissions('servers', 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume metrics collection queue' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async resumeQueue() {
    await this.metricsQueueService.resumeQueue();
    return { message: 'Metrics collection queue resumed' };
  }

  @Post('metrics/queue/clean')
  @RequirePermissions('servers', 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old completed and failed jobs' })
  @ApiResponse({ status: 200, description: 'Queue cleaned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async cleanQueue() {
    await this.metricsQueueService.cleanQueue();
    return { message: 'Queue cleaned successfully' };
  }
}

