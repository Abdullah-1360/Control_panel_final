import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntegrationsService } from './integrations.service';
import { ClientFactoryService } from './client-factory.service';
import { HealthMonitorService } from './health-monitor.service';
import { WebhookService } from './webhook.service';
import { IntegrationsController } from './integrations.controller';
import { WebhookController } from './webhook.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    AuditModule,
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
          },
          password: configService.get('REDIS_PASSWORD'),
          database: configService.get('REDIS_DB', 0),
        }),
      }),
    }),
    BullModule.registerQueue({
      name: 'integration-health',
    }),
  ],
  controllers: [IntegrationsController, WebhookController],
  providers: [
    IntegrationsService,
    ClientFactoryService,
    HealthMonitorService,
    WebhookService,
  ],
  exports: [IntegrationsService, ClientFactoryService],
})
export class IntegrationsModule {}
