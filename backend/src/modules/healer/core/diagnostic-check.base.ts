/**
 * Base class for all diagnostic checks
 * 
 * Provides common functionality and enforces interface compliance
 */

import { CheckCategory, CheckStatus, RiskLevel } from '@prisma/client';
import { IDiagnosticCheck, CheckResult, DiagnosticCheckMetadata } from './interfaces';

export abstract class DiagnosticCheckBase implements IDiagnosticCheck {
  abstract readonly metadata: DiagnosticCheckMetadata;
  
  /**
   * Execute the diagnostic check
   * Must be implemented by subclasses
   */
  abstract execute(application: any, server: any): Promise<CheckResult>;
  
  /**
   * Helper method to create a check result
   */
  protected createResult(
    status: CheckStatus,
    message: string,
    details?: Record<string, any>,
    suggestedFix?: string,
  ): CheckResult {
    return {
      checkName: this.metadata.name,
      category: this.metadata.category,
      status,
      severity: this.metadata.riskLevel,
      message,
      details: details || {},
      suggestedFix,
      executionTime: 0, // Will be set by the framework
    };
  }
  
  /**
   * Helper method to create a PASS result
   */
  protected pass(message: string, details?: Record<string, any>): CheckResult {
    return this.createResult(CheckStatus.PASS, message, details);
  }
  
  /**
   * Helper method to create a WARN result
   */
  protected warn(
    message: string,
    details?: Record<string, any>,
    suggestedFix?: string,
  ): CheckResult {
    return this.createResult(CheckStatus.WARN, message, details, suggestedFix);
  }
  
  /**
   * Helper method to create a FAIL result
   */
  protected fail(
    message: string,
    details?: Record<string, any>,
    suggestedFix?: string,
  ): CheckResult {
    return this.createResult(CheckStatus.FAIL, message, details, suggestedFix);
  }
  
  /**
   * Helper method to create an ERROR result
   */
  protected error(
    message: string,
    details?: Record<string, any>,
  ): CheckResult {
    return this.createResult(CheckStatus.ERROR, message, details);
  }
}
