import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { IpAddress } from '@/common/decorators/ip-address.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';

@ApiTags('Email Templates')
@ApiBearerAuth('JWT-auth')
@Controller('email-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailTemplatesController {
  constructor(private emailTemplatesService: EmailTemplatesService) {}

  @Get()
  @RequirePermissions('settings', 'read')
  @ApiOperation({ summary: 'Get all email templates' })
  @ApiResponse({ status: 200, description: 'Email templates retrieved' })
  async getAllTemplates() {
    const templates = await this.emailTemplatesService.getAllTemplates();
    return { data: templates };
  }

  @Get(':key')
  @RequirePermissions('settings', 'read')
  @ApiOperation({ summary: 'Get email template by key' })
  @ApiResponse({ status: 200, description: 'Email template retrieved' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(@Param('key') key: string) {
    const template = await this.emailTemplatesService.getTemplate(key);
    
    if (!template) {
      return {
        data: null,
        message: 'Template not found',
      };
    }

    return { data: template };
  }

  @Post()
  @RequirePermissions('settings', 'update')
  @ApiOperation({ summary: 'Create email template' })
  @ApiResponse({ status: 201, description: 'Email template created' })
  @ApiResponse({ status: 409, description: 'Template already exists' })
  async createTemplate(
    @Body() createDto: CreateEmailTemplateDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const template = await this.emailTemplatesService.createTemplate(
      createDto,
      user.sub,
      ipAddress,
      userAgent,
    );

    return {
      data: template,
      message: 'Email template created successfully',
    };
  }

  @Put(':key')
  @RequirePermissions('settings', 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update email template' })
  @ApiResponse({ status: 200, description: 'Email template updated' })
  @ApiResponse({ status: 403, description: 'Cannot modify system templates' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Param('key') key: string,
    @Body() updateDto: UpdateEmailTemplateDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const template = await this.emailTemplatesService.updateTemplate(
      key,
      updateDto,
      user.sub,
      ipAddress,
      userAgent,
    );

    return {
      data: template,
      message: 'Email template updated successfully',
    };
  }

  @Delete(':key')
  @RequirePermissions('settings', 'update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete email template' })
  @ApiResponse({ status: 200, description: 'Email template deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete system templates' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    await this.emailTemplatesService.deleteTemplate(
      key,
      user.sub,
      ipAddress,
      userAgent,
    );

    return {
      message: 'Email template deleted successfully',
    };
  }
}
