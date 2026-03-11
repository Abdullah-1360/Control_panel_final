import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsDate, IsObject } from 'class-validator';
import { TechStack, DetectionMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateDomainAddonsDto {
  @IsOptional()
  @IsBoolean()
  sslEnabled?: boolean;

  @IsOptional()
  @IsString()
  sslIssuer?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  sslExpiryDate?: Date;

  @IsOptional()
  @IsObject()
  dnsRecords?: any;

  @IsOptional()
  @IsNumber()
  emailAccountsCount?: number;

  @IsOptional()
  @IsNumber()
  emailQuotaUsedMB?: number;

  @IsOptional()
  @IsNumber()
  emailQuotaTotalMB?: number;
}

export class UpdateDomainTypeDto {
  @IsOptional()
  @IsBoolean()
  isMainDomain?: boolean;

  @IsOptional()
  @IsBoolean()
  isSubdomain?: boolean;

  @IsOptional()
  @IsBoolean()
  isParkedDomain?: boolean;

  @IsOptional()
  @IsBoolean()
  isAddonDomain?: boolean;
}

export class SiteTechStackResponseDto {
  id!: string;
  applicationId!: string;
  techStack!: TechStack;
  techStackVersion?: string;
  detectionMethod!: DetectionMethod;
  detectionConfidence!: number;
  detectedAt!: Date;
  sslEnabled?: boolean;
  sslIssuer?: string;
  sslExpiryDate?: Date;
  dnsRecords?: any;
  emailAccountsCount?: number;
  emailQuotaUsedMB?: number;
  emailQuotaTotalMB?: number;
  isMainDomain!: boolean;
  isSubdomain!: boolean;
  isParkedDomain!: boolean;
  isAddonDomain!: boolean;
  metadata!: any;
  createdAt!: Date;
  updatedAt!: Date;
}
