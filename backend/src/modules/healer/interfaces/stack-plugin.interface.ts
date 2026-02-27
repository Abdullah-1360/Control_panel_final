import { Server } from '@prisma/client';

export interface DetectionResult {
  detected: boolean;
  techStack?: string;
  version?: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface DiagnosticCheckResult {
  checkName: string;
  category: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'ERROR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: Record<string, any>;
  suggestedFix?: string;
  executionTime: number;
}

export interface HealingAction {
  name: string;
  description: string;
  commands: string[];
  requiresBackup: boolean;
  estimatedDuration: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface IStackPlugin {
  name: string;
  version: string;
  supportedVersions: string[];
  
  detect(server: Server, path: string): Promise<DetectionResult>;
  getDiagnosticChecks(): string[];
  executeDiagnosticCheck(
    checkName: string,
    application: any,
    server: Server
  ): Promise<DiagnosticCheckResult>;
  getHealingActions(): HealingAction[];
  executeHealingAction(
    actionName: string,
    application: any,
    server: Server
  ): Promise<{ success: boolean; message: string; details?: any }>;
}
