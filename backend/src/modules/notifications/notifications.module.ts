import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { EmailTemplatesModule } from '@/modules/email-templates/email-templates.module';
import { EmailModule } from '@/modules/email/email.module';

@Module({
  imports: [PrismaModule, AuditModule, EmailTemplatesModule, EmailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
