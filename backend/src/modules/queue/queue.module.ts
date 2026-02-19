import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute initial delay
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
