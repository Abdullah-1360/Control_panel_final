import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class SmtpSettingsDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  host!: string;

  @ApiProperty({ example: 587 })
  @IsNumber()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'password', required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ example: 'noreply@opsmanager.local' })
  @IsEmail()
  fromAddress!: string;

  @ApiProperty({ example: 'OpsManager' })
  @IsString()
  fromName!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  secure!: boolean;
}

export class TestEmailDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  to!: string;
}

export class SmtpSettingsResponseDto {
  @ApiProperty()
  host!: string;

  @ApiProperty()
  port!: number;

  @ApiProperty({ required: false })
  username?: string;

  @ApiProperty()
  fromAddress!: string;

  @ApiProperty()
  fromName!: string;

  @ApiProperty()
  secure!: boolean;

  @ApiProperty()
  isConfigured!: boolean;
}
