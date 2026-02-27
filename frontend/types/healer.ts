/**
 * Universal Healer Types
 * 
 * Type definitions for the universal healer system
 */

// Tech Stack Enums
export enum TechStack {
  WORDPRESS = 'WORDPRESS',
  NODEJS = 'NODEJS',
  PHP = 'PHP',
  LARAVEL = 'LARAVEL',
  NEXTJS = 'NEXTJS',
  EXPRESS = 'EXPRESS',
}

export enum DetectionMethod {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
  HYBRID = 'HYBRID',
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
  MAINTENANCE = 'MAINTENANCE',
  HEALING = 'HEALING',
  UNKNOWN = 'UNKNOWN',
}

export enum HealingMode {
  MANUAL = 'MANUAL',
  SEMI_AUTO = 'SEMI_AUTO',
  FULL_AUTO = 'FULL_AUTO',
}

export enum CheckCategory {
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE',
  AVAILABILITY = 'AVAILABILITY',
  CONFIGURATION = 'CONFIGURATION',
}

export enum CheckStatus {
  PASS = 'PASS',
  WARN = 'WARN',
  FAIL = 'FAIL',
  ERROR = 'ERROR',
  SKIPPED = 'SKIPPED',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Application (formerly wp_sites)
export interface Application {
  id: string;
  serverId: string;
  domain: string;
  path: string;
  
  // Tech Stack
  techStack: TechStack;
  techStackVersion?: string;
  detectionMethod: DetectionMethod;
  detectionConfidence: number; // 0.0 to 1.0
  
  // Health
  healthStatus: HealthStatus;
  healthScore?: number; // 0-100
  lastHealthCheck?: string;
  
  // Healing Config
  healingMode: HealingMode;
  isHealerEnabled: boolean;
  maxHealingAttempts: number;
  healingCooldown: number;
  currentHealingAttempts: number;
  lastHealingAttempt?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Relations
  server?: {
    id: string;
    host: string;
  };
}

// Diagnostic Check Result
export interface CheckResult {
  checkName: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: RiskLevel;
  message: string;
  details: Record<string, any>;
  suggestedFix?: string;
  executionTime: number;
}

// Diagnostic Execution
export interface DiagnosticExecution {
  id: string;
  applicationId: string;
  profile?: string;
  results: CheckResult[];
  healthScore: number;
  status: string;
  triggeredBy: string;
  createdAt: string;
}

// Healing Execution
export interface HealingExecution {
  id: string;
  applicationId: string;
  status: string;
  healingMode: HealingMode;
  autoHealed: number;
  requiresApproval: number;
  cannotHeal: number;
  backupPath?: string;
  startedAt: string;
  completedAt?: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
}

// Tech Stack Metadata
export interface TechStackInfo {
  value: TechStack;
  label: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  isAvailable: boolean;
  comingSoon?: boolean;
}
