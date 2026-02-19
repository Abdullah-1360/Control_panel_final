import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@opsmanager.local',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'User password',
  })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({
    example: '123456',
    description: 'MFA code (required if MFA is enabled)',
    required: false,
  })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty()
  user!: {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    role: {
      id: string;
      name: string;
      displayName: string;
    };
    mfaEnabled: boolean;
    mustChangePassword: boolean;
  };
}
