import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EncryptionService } from '@/modules/encryption/encryption.service';
import { AuditService } from '@/modules/audit/audit.service';
import { SmtpSettingsDto, SmtpSettingsResponseDto } from './dto/smtp-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private audit: AuditService,
  ) {}

  async getSmtpSettings(): Promise<SmtpSettingsResponseDto> {
    try {
      const settings = await this.getSettingsByPrefix('smtp');

      const host = settings['smtp.host'] || '';
      const port = settings['smtp.port'] ? parseInt(settings['smtp.port'], 10) : 587;
      const username = settings['smtp.username'] || '';
      const fromAddress = settings['smtp.fromAddress'] || '';
      const fromName = settings['smtp.fromName'] || 'OpsManager';
      const secure = settings['smtp.secure'] === 'true';

      const isConfigured = !!(host && port && fromAddress);

      return {
        host,
        port,
        username,
        fromAddress,
        fromName,
        secure,
        isConfigured,
      };
    } catch (error) {
      this.logger.error('Failed to get SMTP settings', error);
      throw new HttpException(
        'Failed to retrieve SMTP settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateSmtpSettings(
    dto: SmtpSettingsDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<SmtpSettingsResponseDto> {
    try {
      // Encrypt password if provided
      const encryptedPassword = dto.password
        ? await this.encryption.encrypt(dto.password)
        : null;

      // Store settings
      await this.setSetting('smtp.host', dto.host, false);
      await this.setSetting('smtp.port', dto.port.toString(), false);
      await this.setSetting('smtp.username', dto.username || '', false);
      if (encryptedPassword) {
        await this.setSetting('smtp.password', encryptedPassword, true);
      }
      await this.setSetting('smtp.fromAddress', dto.fromAddress, false);
      await this.setSetting('smtp.fromName', dto.fromName, false);
      await this.setSetting('smtp.secure', dto.secure.toString(), false);

      // Audit log
      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'settings.smtp.update',
        resource: 'settings',
        resourceId: 'smtp',
        description: 'SMTP settings updated',
        ipAddress,
        userAgent,
        severity: 'INFO',
      });

      this.logger.log(`SMTP settings updated by user ${userId}`);

      return this.getSmtpSettings();
    } catch (error) {
      this.logger.error('Failed to update SMTP settings', error);
      throw new HttpException(
        'Failed to update SMTP settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async setSetting(
    key: string,
    value: string,
    isEncrypted: boolean,
  ): Promise<void> {
    await this.prisma.settings.upsert({
      where: { key },
      update: { value, isEncrypted },
      create: { key, value, isEncrypted },
    });
  }

  private async getSetting(key: string): Promise<string | null> {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    if (setting.isEncrypted) {
      return this.encryption.decrypt(setting.value);
    }

    return setting.value;
  }

  private async getSettingsByPrefix(prefix: string): Promise<Record<string, string>> {
    const settings = await this.prisma.settings.findMany({
      where: {
        key: {
          startsWith: prefix,
        },
      },
    });

    const result: Record<string, string> = {};

    for (const setting of settings) {
      const value = setting.isEncrypted
        ? await this.encryption.decrypt(setting.value)
        : setting.value;
      result[setting.key] = value;
    }

    return result;
  }
}
