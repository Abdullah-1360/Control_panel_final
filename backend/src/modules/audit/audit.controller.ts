import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { Severity } from '@prisma/client';

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit', 'read')
  @ApiOperation({ summary: 'Get audit logs with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'severity', required: false, enum: Severity })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('severity') severity?: Severity,
  ) {
    return this.auditService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      userId,
      action,
      resource,
      severity,
    });
  }

  @Get('security')
  @RequirePermissions('audit', 'read')
  @ApiOperation({ summary: 'Get security-related audit logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findSecurityLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findSecurityLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
