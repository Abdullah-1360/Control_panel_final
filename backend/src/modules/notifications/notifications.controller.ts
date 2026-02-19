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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { IpAddress } from '@/common/decorators/ip-address.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';
import {
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
  SendBulkEmailDto,
} from './dto/notification-rule.dto';
import { EmailStatus } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // ==================== Notification Rules ====================

  @Get('rules')
  @RequirePermissions('settings', 'read')
  @ApiOperation({ summary: 'Get all notification rules (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Notification rules retrieved' })
  async getAllRules() {
    const rules = await this.notificationsService.getAllRules();
    return { data: rules };
  }

  @Get('rules/:id')
  @RequirePermissions('settings', 'read')
  @ApiOperation({ summary: 'Get notification rule by ID (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Notification rule retrieved' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getRule(@Param('id') id: string) {
    const rule = await this.notificationsService.getRule(id);
    return { data: rule };
  }

  @Post('rules')
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Create notification rule (SUPER_ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Notification rule created' })
  async createRule(
    @Body() dto: CreateNotificationRuleDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const rule = await this.notificationsService.createRule(
      dto,
      user.sub,
      ipAddress,
      userAgent,
    );
    return {
      data: rule,
      message: 'Notification rule created successfully',
    };
  }

  @Put('rules/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Update notification rule (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Notification rule updated' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationRuleDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const rule = await this.notificationsService.updateRule(
      id,
      dto,
      user.sub,
      ipAddress,
      userAgent,
    );
    return {
      data: rule,
      message: 'Notification rule updated successfully',
    };
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Delete notification rule (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Notification rule deleted' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    await this.notificationsService.deleteRule(id, user.sub, ipAddress, userAgent);
    return { message: 'Notification rule deleted successfully' };
  }

  // ==================== Email History ====================

  @Get('history')
  @RequirePermissions('settings', 'read')
  @ApiOperation({ summary: 'Get email history (SUPER_ADMIN only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: EmailStatus })
  @ApiQuery({ name: 'ruleId', required: false, type: String })
  @ApiQuery({ name: 'triggeredBy', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Email history retrieved' })
  async getEmailHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: EmailStatus,
    @Query('ruleId') ruleId?: string,
    @Query('triggeredBy') triggeredBy?: string,
  ) {
    return this.notificationsService.getEmailHistory({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      ruleId,
      triggeredBy,
    });
  }

  // ==================== Bulk Email ====================

  @Post('bulk-email')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Send bulk email (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Bulk email sent' })
  async sendBulkEmail(
    @Body() dto: SendBulkEmailDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const results = await this.notificationsService.sendBulkEmail(
      dto,
      user.sub,
      ipAddress,
      userAgent,
    );
    return {
      data: results,
      message: `Bulk email sent: ${results.sent}/${results.total} successful`,
    };
  }
}
