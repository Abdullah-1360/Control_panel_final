import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { EncryptionModule } from '@/modules/encryption/encryption.module';

@Global()
@Module({
  imports: [PrismaModule, EncryptionModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
