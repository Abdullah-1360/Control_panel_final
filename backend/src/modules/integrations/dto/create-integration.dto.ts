import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProviderType } from '@prisma/client';

// Provider-specific configuration classes
export class WhmConfig {
  @ApiProperty({ example: 'https://server.example.com:2087' })
  @IsString()
  baseUrl!: string;

  @ApiProperty({ example: 'root' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'your-api-token-here' })
  @IsString()
  apiToken!: string;
}

export class SmtpConfig {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  host!: string;

  @ApiProperty({ example: 587 })
  @IsString()
  port!: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'your-password' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  secure?: boolean;
}

export class CreateIntegrationDto {
  @ApiProperty({ example: 'Production WHM Server' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Main hosting panel for production servers' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.WHM })
  @IsEnum(ProviderType)
  provider!: ProviderType;

  @ApiProperty({
    description: 'Provider-specific configuration (will be encrypted)',
    example: { baseUrl: 'https://server.example.com:2087', username: 'root', apiToken: 'token' }
  })
  @IsObject()
  config!: WhmConfig | SmtpConfig | Record<string, any>;

  @ApiPropertyOptional({ example: 'server-id-here' })
  @IsString()
  @IsOptional()
  linkedServerId?: string;
}
