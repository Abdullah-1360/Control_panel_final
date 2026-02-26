/**
 * Universal Healer - Core Interfaces
 * 
 * Defines the plugin architecture interfaces for tech stack support
 */

import { TechStack, CheckCategory, CheckStatus, RiskLevel, HealingMode } from '@prisma/client';

// ============================================================================
// Detection Interfaces
// ============================================================================

export interface DetectionResult {
  detected: boolean;
  techStack?: TechStack;
  version?: string;
  confidence: number; // 0.0 to 1.0
  metadata?: Record<string, any>;
}

export interface DetectionSignature {
  files?: string[];
  directories?: string[];
  commands?: string[];
  portCheck?: number;
  processCheck?: string;
  confidence: number;
  versionCommand?: string;
  versionRegex?: RegExp;
  customCheck?: (server: any, path: string) => Promise<boolean>;
}

// ============================================================================
// Diagnostic Check Interfaces
// ============================================================================

export interface CheckResult {
  checkName: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: RiskLevel;
  message: string;
  details: Record<string, any>;
  suggestedFix?: string;
  executionTime: number; // milliseconds
}

export interface DiagnosticCheckMetadata {
  name: string;
  category: CheckCategory;
  riskLevel: RiskLevel;
  description: string;
  applicableTo: TechStack[];
  requiresRoot?: boolean;
  timeout?: number; // milliseconds
}

// ============================================================================
// Healing Strategy Interfaces
// ============================================================================

export interface HealingAction {
  name: string;
  description: string;
  commands: string[];
  requiresBackup: boolean;
  estimatedDuration: number; // seconds
  riskLevel: RiskLevel;
  rollbackStrategy?: () => Promise<void>;
}

export interface HealingPlan {
  autoHeal: Array<{ check: CheckResult; action: HealingAction }>;
  requireApproval: Array<{ check: CheckResult; action: HealingAction }>;
  cannotHeal: CheckResult[];
}

// ============================================================================
// Backup Strategy Interfaces
// ============================================================================

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  backupSize?: number;
  duration: number; // milliseconds
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  duration: number; // milliseconds
  error?: string;
}

// ============================================================================
// Plugin Interface
// ============================================================================

export interface IStackPlugin {
  // Plugin metadata
  readonly name: string;
  readonly version: string;
  readonly supportedVersions: string[];
  readonly techStack: TechStack;
  
  // Detection
  detect(server: any, path: string): Promise<DetectionResult>;
  
  // Diagnostic checks
  getDiagnosticChecks(): IDiagnosticCheck[];
  
  // Healing strategies
  getHealingStrategies(): IHealingStrategy[];
  
  // Backup/restore
  getBackupStrategy(): IBackupStrategy;
  
  // Lifecycle hooks
  onPluginLoad?(): Promise<void>;
  onPluginUnload?(): Promise<void>;
}

// ============================================================================
// Component Interfaces
// ============================================================================

export interface IDiagnosticCheck {
  readonly metadata: DiagnosticCheckMetadata;
  execute(application: any, server: any): Promise<CheckResult>;
}

export interface IHealingStrategy {
  readonly name: string;
  readonly description: string;
  readonly applicableTo: CheckCategory[];
  
  canHandle(check: CheckResult): boolean;
  getAction(check: CheckResult): HealingAction | null;
  execute(application: any, server: any, action: HealingAction): Promise<void>;
}

export interface IBackupStrategy {
  readonly name: string;
  readonly description: string;
  
  createBackup(application: any, server: any): Promise<BackupResult>;
  restoreBackup(application: any, server: any, backupPath: string): Promise<RestoreResult>;
  validateBackup(backupPath: string): Promise<boolean>;
}

// ============================================================================
// Plugin Registry Interfaces
// ============================================================================

export interface PluginRegistryEntry {
  plugin: IStackPlugin;
  isEnabled: boolean;
  loadedAt: Date;
  metadata: {
    name: string;
    version: string;
    techStack: TechStack;
  };
}
