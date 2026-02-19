import {
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  IsString,
  Min,
} from 'class-validator';
import { HealingMode } from '@prisma/client';

export class UpdateSiteConfigDto {
  @IsOptional()
  @IsEnum(HealingMode)
  healingMode?: HealingMode;

  @IsOptional()
  @IsBoolean()
  isHealerEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxHealingAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  healingCooldown?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedPlugins?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedThemes?: string[];
}
