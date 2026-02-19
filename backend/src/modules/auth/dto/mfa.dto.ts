import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsOptional } from 'class-validator';

export class SetupMfaResponseDto {
  @ApiProperty({
    description: 'Base32 encoded TOTP secret',
  })
  secret!: string;

  @ApiProperty({
    description: 'QR code data URL for authenticator app',
  })
  qrCode!: string;

  @ApiProperty({
    description: 'Backup codes for account recovery',
    type: [String],
  })
  backupCodes!: string[];
}

export class VerifyMfaDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code from authenticator app',
  })
  @IsString()
  @Length(6, 6, { message: 'MFA code must be 6 digits' })
  code!: string;
}

export class DisableMfaDto {
  @ApiProperty({
    example: 'CurrentPassword123!',
    description: 'Current password for verification',
  })
  @IsString()
  password!: string;

  @ApiProperty({
    example: '123456',
    description: 'MFA code or backup code',
  })
  @IsString()
  code!: string;
}

export class VerifyMfaLoginDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code or 8-digit backup code',
  })
  @IsString()
  code!: string;

  @ApiProperty({
    example: 'temp-session-token',
    description: 'Temporary session token from initial login',
  })
  @IsString()
  tempToken!: string;
}
