import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryServersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  @IsEnum(['name', 'createdAt', 'lastTestAt'])
  sort?: string = 'name';

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['LINUX', 'WINDOWS'])
  platformType?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['PROD', 'STAGING', 'DEV'])
  environment?: string;

  @IsOptional()
  @IsString()
  tags?: string; // Comma-separated

  @IsOptional()
  @IsString()
  @IsEnum(['NEVER_TESTED', 'OK', 'FAILED'])
  lastTestStatus?: string;
}
