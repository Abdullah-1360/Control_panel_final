import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { EmailService } from '@/modules/email/email.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { IpAddress } from '@/common/decorators/ip-address.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';
import {
  SmtpSettingsDto,
  TestEmailDto,
  SmtpSettingsResponseDto,
} from './dto/smtp-settings.dto';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private emailService: EmailService,
  ) {}

  @Get('smtp')
  @RequirePermissions('settings', 'read')
  @ApiOperation({ summary: 'Get SMTP settings (SUPER_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'SMTP settings retrieved',
    type: SmtpSettingsResponseDto,
  })
  async getSmtpSettings(): Promise<SmtpSettingsResponseDto> {
    return this.settingsService.getSmtpSettings();
  }

  @Put('smtp')
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Update SMTP settings (SUPER_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'SMTP settings updated',
    type: SmtpSettingsResponseDto,
  })
  async updateSmtpSettings(
    @Body() dto: SmtpSettingsDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<SmtpSettingsResponseDto> {
    return this.settingsService.updateSmtpSettings(
      dto,
      user.sub,
      ipAddress,
      userAgent,
    );
  }

  @Post('smtp/test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Send test email (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 400, description: 'SMTP not configured or test failed' })
  async testSmtpSettings(@Body() dto: TestEmailDto) {
    const success = await this.emailService.sendEmail({
      to: dto.to,
      subject: 'OpsManager - SMTP Test Email',
      html: `
        <h2>SMTP Configuration Test</h2>
        <p>This is a test email from OpsManager.</p>
        <p>If you received this email, your SMTP configuration is working correctly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
      text: `
        SMTP Configuration Test
        
        This is a test email from OpsManager.
        If you received this email, your SMTP configuration is working correctly.
        
        Sent at: ${new Date().toISOString()}
      `,
    });

    if (!success) {
      return {
        success: false,
        message: 'Failed to send test email. Please check your SMTP configuration.',
      };
    }

    return {
      success: true,
      message: `Test email sent successfully to ${dto.to}`,
    };
  }
}
