import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { PasswordService } from './password.service';

@Module({
  imports: [ConfigModule],
  providers: [AuthService, MfaService, SessionService, PasswordService],
  controllers: [AuthController],
  exports: [AuthService, SessionService, PasswordService, MfaService],
})
export class AuthModule {}
