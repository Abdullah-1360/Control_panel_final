import { Module } from '@nestjs/common';
import { MetricsQueueService } from './metrics-queue.service';
import { ServerMetricsService } from './server-metrics.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { AuditModule } from '../audit/audit.module';
import { SSHConnectionService } from './ssh-connection.service';
import { SSHSessionManager } from './ssh-session-manager.service';

@Module({
  imports: [PrismaModule, EncryptionModule, AuditModule],
  providers: [MetricsQueueService, ServerMetricsService, SSHConnectionService, SSHSessionManager],
  exports: [MetricsQueueService, SSHSessionManager],
})
export class MetricsQueueModule {}
