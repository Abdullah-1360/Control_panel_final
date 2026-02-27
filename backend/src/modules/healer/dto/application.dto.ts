import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, IsUUID } from 'class-validator';
import { TechStack, DetectionMethod, HealingMode } from '@prisma/client';

export class CreateApplicationDto {
  @IsUUID()
  serverId!: string;

  @IsString()
  domain!: string;

  @IsString()
  path!: string;

  @IsEnum(TechStack)
  techStack!: TechStack;

  @IsEnum(DetectionMethod)
  @IsOptional()
  detectionMethod?: DetectionMethod;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;

  @IsString()
  @IsOptional()
  dbName?: string;

  @IsString()
  @IsOptional()
  dbHost?: string;
}

export class UpdateApplicationDto {
  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  path?: string;

  @IsEnum(TechStack)
  @IsOptional()
  techStack?: TechStack;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;

  @IsBoolean()
  @IsOptional()
  isHealerEnabled?: boolean;

  @IsEnum(HealingMode)
  @IsOptional()
  healingMode?: HealingMode;
}

export class DiscoverApplicationsDto {
  @IsUUID()
  serverId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paths?: string[];

  @IsArray()
  @IsEnum(TechStack, { each: true })
  @IsOptional()
  techStacks?: TechStack[];

  @IsBoolean()
  @IsOptional()
  forceRediscover?: boolean;
}

export class DiagnoseApplicationDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  checkIds?: string[];

  @IsBoolean()
  @IsOptional()
  forceRefresh?: boolean;

  @IsString()
  @IsOptional()
  subdomain?: string;
}

export class HealApplicationDto {
  @IsString()
  actionName!: string;

  @IsString()
  @IsOptional()
  subdomain?: string;
}

export class UpdateSubdomainMetadataDto {
  @IsEnum(TechStack)
  @IsOptional()
  techStack?: TechStack;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;

  @IsNumber()
  @IsOptional()
  healthScore?: number;

  @IsString()
  @IsOptional()
  healthStatus?: string;

  @IsBoolean()
  @IsOptional()
  isHealerEnabled?: boolean;

  @IsEnum(HealingMode)
  @IsOptional()
  healingMode?: HealingMode;
}

export class ToggleSubdomainHealerDto {
  @IsBoolean()
  enabled!: boolean;
}
