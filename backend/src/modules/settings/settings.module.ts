import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { EncryptionModule } from '@/modules/encryption/encryption.module';
import { EmailModule } from '@/modules/email/email.module';
import { AuditModule } from '@/modules/audit/audit.module';

@Module({
  imports: [PrismaModule, EncryptionModule, EmailModule, AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
