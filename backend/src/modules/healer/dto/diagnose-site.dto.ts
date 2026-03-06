import { IsOptional, IsArray, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiagnosisProfile, DiagnosisCheckType } from '../enums/diagnosis-profile.enum';

/**
 * DTO for diagnosing a site (always runs FULL diagnosis)
 */
export class DiagnoseSiteDto {
  @ApiPropertyOptional({
    description: 'Custom checks to run (optional, defaults to all checks)',
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
  // Identification
  diagnosisId?: string; // PHASE 4: For real-time progress tracking
  siteId?: string;
  domain?: string;
  
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
    // PHASE 2: Correlation Engine insights
    correlation?: {
      rootCauses: any[];
      correlationConfidence: number;
      criticalIssuesCount: number;
    };
  };
  
  // Suggested Actions
  suggestedAction?: string;
  suggestedCommands?: string[];
  recommendations?: string[]; // PHASE 2: Prioritized recommendations from correlation engine
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
