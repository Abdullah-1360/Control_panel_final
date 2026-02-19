import { IsString, IsUUID, IsOptional, IsArray } from 'class-validator';

export class HealSiteDto {
  @IsString()
  @IsUUID()
  executionId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customCommands?: string[];
}
