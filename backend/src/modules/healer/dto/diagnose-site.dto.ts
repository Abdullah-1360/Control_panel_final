import { IsEnum, IsOptional, IsArray, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiagnosisProfile, DiagnosisCheckType } from '../enums/diagnosis-profile.enum';

/**
 * DTO for diagnosing a site with profile support
 */
export class DiagnoseSiteDto {
  @ApiProperty({
    description: 'Diagnosis profile to use',
    enum: DiagnosisProfile,
    default: DiagnosisProfile.FULL,
    example: DiagnosisProfile.FULL,
  })
  @IsEnum(DiagnosisProfile)
  profile: DiagnosisProfile = DiagnosisProfile.FULL;

  @ApiPropertyOptional({
    description: 'Custom checks to run (only for CUSTOM profile)',
    type: [String],
    enum: DiagnosisCheckType,
    example: [DiagnosisCheckType.HTTP_STATUS, DiagnosisCheckType.DATABASE_CONNECTION],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DiagnosisCheckType, { each: true })
  customChecks?: DiagnosisCheckType[];

  @ApiPropertyOptional({
    description: 'Subdomain to diagnose (null for main domain)',
    example: 'shop.example.com',
  })
  @IsOptional()
  @IsString()
  subdomain?: string;

  @ApiPropertyOptional({
    description: 'Force fresh diagnosis (bypass cache)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  bypassCache?: boolean;
}

/**
 * DTO for diagnosis result
 */
export interface DiagnosisResultDto {
  // Profile & Configuration
  profile: DiagnosisProfile;
  checksRun: DiagnosisCheckType[];
  
  // Health Score
  healthScore: number; // 0-100
  previousScore?: number;
  scoreChange?: number;
  
  // Issues Summary
  issuesFound: number;
  criticalIssues: number;
  warningIssues: number;
  
  // Diagnosis
  diagnosisType: string;
  confidence: number;
  details: {
    errorType?: string;
    errorMessage?: string;
    logFiles?: string[];
    affectedComponents?: string[];
  };
  
  // Suggested Actions
  suggestedAction?: string;
  suggestedCommands?: string[];
  canAutoHeal: boolean;
  requiresApproval: boolean;
  
  // Check Results
  checkResults: DiagnosisCheckResult[];
  
  // Metadata
  duration: number; // milliseconds
  timestamp: Date;
  cached: boolean;
  cacheExpiresAt?: Date;
}

/**
 * Individual check result
 */
export interface DiagnosisCheckResult {
  checkType: DiagnosisCheckType;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  message: string;
  details?: any;
  duration: number;
}
