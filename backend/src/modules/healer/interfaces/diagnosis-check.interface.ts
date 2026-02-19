import { DiagnosisCheckType } from '../enums/diagnosis-profile.enum';

/**
 * Result of a diagnosis check
 */
export interface CheckResult {
  checkType: DiagnosisCheckType;
  status: CheckStatus;
  score: number; // 0-100 (100 = perfect, 0 = critical failure)
  message: string;
  details: any;
  recommendations?: string[];
  duration: number; // milliseconds
  timestamp: Date;
}

/**
 * Check status enum
 */
export enum CheckStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  SKIPPED = 'SKIPPED',
  ERROR = 'ERROR',
}

/**
 * Check priority enum
 */
export enum CheckPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
}

/**
 * Base interface for all diagnosis check services
 */
export interface IDiagnosisCheckService {
  /**
   * Execute the check
   */
  check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult>;

  /**
   * Get the check type this service handles
   */
  getCheckType(): DiagnosisCheckType;

  /**
   * Get the priority of this check
   */
  getPriority(): CheckPriority;

  /**
   * Get human-readable name
   */
  getName(): string;

  /**
   * Get description of what this check does
   */
  getDescription(): string;

  /**
   * Check if this service can handle the given check type
   */
  canHandle(checkType: DiagnosisCheckType): boolean;
}

/**
 * Check configuration
 */
export interface CheckConfig {
  enabled: boolean;
  threshold?: any;
  timeout?: number;
  customParams?: any;
}

/**
 * Check execution context
 */
export interface CheckContext {
  serverId: string;
  sitePath: string;
  domain: string;
  siteId?: string;
  config?: CheckConfig;
  timeout?: number;
}
