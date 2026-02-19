import { Controller, Get, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { IpAddress } from '@/common/decorators/ip-address.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';

@ApiTags('Sessions')
@ApiBearerAuth('JWT-auth')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('sessions', 'read')
  @ApiOperation({ summary: 'Get all sessions (SUPER_ADMIN only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getAllSessions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    return this.sessionsService.getAllSessions({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      userId,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user sessions' })
  async getUserSessions(@CurrentUser() user: JwtPayload) {
    const sessions = await this.sessionsService.getUserSessions(user.sub);
    return { data: sessions };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a session' })
  async revokeSession(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.sessionsService.revokeSession(id, user.sub, ipAddress, userAgent);
  }
}
