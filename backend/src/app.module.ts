import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './modules/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AuditModule } from './modules/audit/audit.module';
import { EncryptionModule } from './modules/encryption/encryption.module';
import { EmailModule } from './modules/email/email.module';
import { SettingsModule } from './modules/settings/settings.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ServersModule } from './modules/servers/servers.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { HealerModule } from './modules/healer/healer.module';
import { EventsModule } from './common/events/events.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Cache (for request deduplication)
    CacheModule.register({
      isGlobal: true,
      ttl: 5000, // 5 seconds default TTL
      max: 1000, // Maximum number of items in cache
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },
    ]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Queue (BullMQ)
    QueueModule,

    // Core modules
    PrismaModule,
    EncryptionModule,
    EmailModule,
    AuditModule,
    EventsModule,

    // Feature modules
    AuthModule,
    UsersModule,
    RolesModule,
    SessionsModule,
    SettingsModule,
    EmailTemplatesModule,
    NotificationsModule,
    ServersModule,
    IntegrationsModule,
    HealerModule,
  ],
})
export class AppModule {}
