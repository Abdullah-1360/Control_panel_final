import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  ValidateNested,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PlatformType {
  LINUX = 'LINUX',
  WINDOWS = 'WINDOWS',
}

export enum AuthType {
  SSH_KEY = 'SSH_KEY',
  SSH_KEY_WITH_PASSPHRASE = 'SSH_KEY_WITH_PASSPHRASE',
  PASSWORD = 'PASSWORD',
}

export enum PrivilegeMode {
  ROOT = 'ROOT',
  SUDO = 'SUDO',
  USER_ONLY = 'USER_ONLY',
}

export enum SudoMode {
  NONE = 'NONE',
  NOPASSWD = 'NOPASSWD',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
}

export enum HostKeyStrategy {
  STRICT_PINNED = 'STRICT_PINNED',
  TOFU = 'TOFU',
  DISABLED = 'DISABLED',
}

export class HostKeyFingerprintDto {
  @IsString()
  @IsNotEmpty()
  keyType!: string;

  @IsString()
  @IsNotEmpty()
  fingerprint!: string;
}

export class ServerCredentialsDto {
  @IsOptional()
  @IsString()
  privateKey?: string;

  @IsOptional()
  @IsString()
  passphrase?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class CreateServerDto {
  // Identity
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @IsEnum(['PROD', 'STAGING', 'DEV'])
  environment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Connection
  @IsEnum(PlatformType)
  platformType!: PlatformType;

  @IsString()
  @IsNotEmpty()
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsString()
  @IsNotEmpty()
  connectionProtocol!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  // Authentication
  @IsEnum(AuthType)
  authType!: AuthType;

  @IsObject()
  @ValidateNested()
  @Type(() => ServerCredentialsDto)
  credentials!: ServerCredentialsDto;

  // Privilege & Execution
  @IsEnum(PrivilegeMode)
  privilegeMode!: PrivilegeMode;

  @IsEnum(SudoMode)
  sudoMode!: SudoMode;

  @IsOptional()
  @IsString()
  sudoPassword?: string;

  // Host Key Verification
  @IsEnum(HostKeyStrategy)
  hostKeyStrategy!: HostKeyStrategy;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HostKeyFingerprintDto)
  knownHostFingerprints?: HostKeyFingerprintDto[];

  // Metrics Configuration (optional - have defaults in DB)
  @IsOptional()
  metricsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  metricsInterval?: number;

  // Alert Thresholds (optional - have defaults in DB)
  @IsOptional()
  @Min(1)
  @Max(100)
  alertCpuThreshold?: number;

  @IsOptional()
  @Min(1)
  @Max(100)
  alertRamThreshold?: number;

  @IsOptional()
  @Min(1)
  @Max(100)
  alertDiskThreshold?: number;
}
