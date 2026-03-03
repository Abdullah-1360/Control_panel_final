/**
 * Correlation Pattern Interface
 * Represents a detected pattern with root cause and confidence
 */
export interface CorrelationPattern {
  name: string;
  symptoms: string[];
  rootCause: string;
  confidence: number; // 0-100
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  remediation: string;
  affectedChecks: string[];
}

/**
 * Correlation Result Interface
 * Complete analysis result with root causes and recommendations
 */
export interface CorrelationResult {
  rootCauses: CorrelationPattern[];
  overallHealthScore: number;
  criticalIssues: any[]; // CheckResult[] but avoiding circular dependency
  recommendations: string[];
  correlationConfidence: number; // Overall confidence in the analysis
}
