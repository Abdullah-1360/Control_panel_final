import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
