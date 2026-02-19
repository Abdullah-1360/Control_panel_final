import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { SSHConnectionService } from './ssh-connection.service';
import { ServerMetricsService } from './server-metrics.service';
import { MetricsQueueModule } from './metrics-queue.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    AuditModule,
    MetricsQueueModule,
    ThrottlerModule.forRoot([
      {
        name: 'connection-test',
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per minute
      },
    ]),
  ],
  controllers: [ServersController],
  providers: [ServersService, SSHConnectionService, ServerMetricsService],
  exports: [ServersService, SSHConnectionService, ServerMetricsService],
})
export class ServersModule {}

