/**
 * Diagnosis Progress DTOs
 * Real-time progress tracking for diagnosis execution
 */

export enum DiagnosisProgressStatus {
  QUEUED = 'QUEUED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  CHECK_STARTED = 'CHECK_STARTED',
  CHECK_COMPLETED = 'CHECK_COMPLETED',
  CHECK_FAILED = 'CHECK_FAILED',
  CORRELATING = 'CORRELATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface DiagnosisProgressEvent {
  diagnosisId: string;
  siteId: string;
  siteName: string;
  status: DiagnosisProgressStatus;
  progress: number; // 0-100
  currentCheck?: string;
  checkName?: string;
  checkCategory?: string;
  checkStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'ERROR';
  checkMessage?: string;
  checkDuration?: number;
  totalChecks: number;
  completedChecks: number;
  failedChecks: number;
  warningChecks: number;
  passedChecks: number;
  elapsedTime: number; // milliseconds
  estimatedTimeRemaining?: number; // milliseconds
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface DiagnosisCheckProgress {
  checkType: string;
  checkName: string;
  category: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'WARNING' | 'ERROR';
  message?: string;
  duration?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface DiagnosisProgressSummary {
  diagnosisId: string;
  siteId: string;
  siteName: string;
  status: DiagnosisProgressStatus;
  progress: number;
  totalChecks: number;
  completedChecks: number;
  failedChecks: number;
  warningChecks: number;
  passedChecks: number;
  checks: DiagnosisCheckProgress[];
  startedAt: Date;
  completedAt?: Date;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}
