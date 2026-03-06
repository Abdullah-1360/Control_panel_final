import { Injectable, Logger } from '@nestjs/common';
import { EventBusService, SystemEvent } from '../../../common/events/event-bus.service';
import {
  DiagnosisProgressEvent,
  DiagnosisProgressStatus,
  DiagnosisCheckProgress,
  DiagnosisProgressSummary,
} from '../dto/diagnosis-progress.dto';

/**
 * Diagnosis Progress Service
 * Tracks and broadcasts real-time diagnosis progress via SSE
 */
@Injectable()
export class DiagnosisProgressService {
  private readonly logger = new Logger(DiagnosisProgressService.name);
  private readonly progressMap = new Map<string, DiagnosisProgressSummary>();
  // Track active diagnoses by siteId to prevent duplicates
  private readonly activeDiagnoses = new Map<string, string>(); // siteId -> diagnosisId

  constructor(private readonly eventBus: EventBusService) {}

  /**
   * Check if a diagnosis is already running for a site
   */
  isRunning(siteId: string): string | null {
    const diagnosisId = this.activeDiagnoses.get(siteId);
    if (diagnosisId) {
      const summary = this.progressMap.get(diagnosisId);
      // Only return diagnosisId if diagnosis is actually still running
      if (summary && (summary.status === DiagnosisProgressStatus.STARTING || 
                      summary.status === DiagnosisProgressStatus.RUNNING ||
                      summary.status === DiagnosisProgressStatus.CHECK_STARTED ||
                      summary.status === DiagnosisProgressStatus.CHECK_COMPLETED ||
                      summary.status === DiagnosisProgressStatus.CORRELATING)) {
        return diagnosisId;
      } else {
        // Clean up stale entry
        this.activeDiagnoses.delete(siteId);
      }
    }
    return null;
  }

  /**
   * Start tracking diagnosis progress
   */
  startDiagnosis(
    diagnosisId: string,
    siteId: string,
    siteName: string,
    totalChecks: number,
  ): void {
    // Check if diagnosis is already running for this site
    const existingDiagnosisId = this.isRunning(siteId);
    if (existingDiagnosisId && existingDiagnosisId !== diagnosisId) {
      this.logger.warn(
        `Diagnosis already running for site ${siteId} (existing: ${existingDiagnosisId}, new: ${diagnosisId}). Skipping duplicate.`
      );
      return;
    }

    // Mark this site as having an active diagnosis
    this.activeDiagnoses.set(siteId, diagnosisId);

    const summary: DiagnosisProgressSummary = {
      diagnosisId,
      siteId,
      siteName,
      status: DiagnosisProgressStatus.STARTING,
      progress: 0,
      totalChecks,
      completedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
      passedChecks: 0,
      checks: [],
      startedAt: new Date(),
      elapsedTime: 0,
    };

    this.progressMap.set(diagnosisId, summary);

    this.emitProgress({
      diagnosisId,
      siteId,
      siteName,
      status: DiagnosisProgressStatus.STARTING,
      progress: 0,
      totalChecks,
      completedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
      passedChecks: 0,
      elapsedTime: 0,
      message: 'Initializing diagnosis...',
      timestamp: new Date(),
    });
  }

  /**
   * Update diagnosis to running status
   */
  setRunning(diagnosisId: string): void {
    const summary = this.progressMap.get(diagnosisId);
    if (!summary) return;

    summary.status = DiagnosisProgressStatus.RUNNING;
    this.progressMap.set(diagnosisId, summary);

    this.emitProgress({
      diagnosisId: summary.diagnosisId,
      siteId: summary.siteId,
      siteName: summary.siteName,
      status: DiagnosisProgressStatus.RUNNING,
      progress: 5,
      totalChecks: summary.totalChecks,
      completedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
      passedChecks: 0,
      elapsedTime: Date.now() - summary.startedAt.getTime(),
      message: 'Running diagnostic checks...',
      timestamp: new Date(),
    });
  }

  /**
   * Mark check as started
   */
  checkStarted(
    diagnosisId: string,
    checkType: string,
    checkName: string,
    category: string,
  ): void {
    const summary = this.progressMap.get(diagnosisId);
    if (!summary) return;

    // Check if this check is already started to avoid duplicates
    const existingCheck = summary.checks.find(c => c.checkType === checkType);
    if (existingCheck) {
      this.logger.debug(`Check ${checkType} already started, skipping duplicate event`);
      return;
    }

    const check: DiagnosisCheckProgress = {
      checkType,
      checkName,
      category,
      status: 'RUNNING',
      startedAt: new Date(),
    };

    summary.checks.push(check);
    this.progressMap.set(diagnosisId, summary);

    const elapsedTime = Date.now() - summary.startedAt.getTime();
    const avgTimePerCheck = summary.completedChecks > 0 
      ? elapsedTime / summary.completedChecks 
      : 5000; // Estimate 5s per check
    const estimatedTimeRemaining = avgTimePerCheck * (summary.totalChecks - summary.completedChecks);

    // Calculate progress based on started checks (not completed)
    const startedChecks = summary.checks.length;
    const baseProgress = Math.round((summary.completedChecks / summary.totalChecks) * 100);
    const startProgress = Math.round((startedChecks / summary.totalChecks) * 10); // 10% boost for started checks
    const currentProgress = Math.min(95, baseProgress + startProgress); // Cap at 95% until completion

    this.emitProgress({
      diagnosisId: summary.diagnosisId,
      siteId: summary.siteId,
      siteName: summary.siteName,
      status: DiagnosisProgressStatus.CHECK_STARTED,
      progress: currentProgress,
      currentCheck: checkType,
      checkName,
      checkCategory: category,
      totalChecks: summary.totalChecks,
      completedChecks: summary.completedChecks,
      failedChecks: summary.failedChecks,
      warningChecks: summary.warningChecks,
      passedChecks: summary.passedChecks,
      elapsedTime,
      estimatedTimeRemaining,
      message: `Running: ${checkName}`,
      timestamp: new Date(),
    });
  }

  /**
   * Mark check as completed
   */
  checkCompleted(
    diagnosisId: string,
    checkType: string,
    status: 'PASS' | 'FAIL' | 'WARNING' | 'ERROR',
    message: string,
    duration: number,
  ): void {
    const summary = this.progressMap.get(diagnosisId);
    if (!summary) return;

    const check = summary.checks.find(c => c.checkType === checkType);
    if (check) {
      check.status = status;
      check.message = message;
      check.duration = duration;
      check.completedAt = new Date();
    }

    summary.completedChecks++;
    if (status === 'FAIL' || status === 'ERROR') {
      summary.failedChecks++;
    } else if (status === 'WARNING') {
      summary.warningChecks++;
    } else if (status === 'PASS') {
      summary.passedChecks++;
    }

    const progress = Math.round((summary.completedChecks / summary.totalChecks) * 100);
    summary.progress = progress;
    this.progressMap.set(diagnosisId, summary);

    const elapsedTime = Date.now() - summary.startedAt.getTime();
    const avgTimePerCheck = elapsedTime / summary.completedChecks;
    const estimatedTimeRemaining = avgTimePerCheck * (summary.totalChecks - summary.completedChecks);

    this.emitProgress({
      diagnosisId: summary.diagnosisId,
      siteId: summary.siteId,
      siteName: summary.siteName,
      status: DiagnosisProgressStatus.CHECK_COMPLETED,
      progress,
      currentCheck: checkType,
      checkName: check?.checkName || checkType,
      checkCategory: check?.category || 'SYSTEM',
      checkStatus: status,
      checkMessage: message,
      checkDuration: duration,
      totalChecks: summary.totalChecks,
      completedChecks: summary.completedChecks,
      failedChecks: summary.failedChecks,
      warningChecks: summary.warningChecks,
      passedChecks: summary.passedChecks,
      elapsedTime,
      estimatedTimeRemaining,
      message: `Completed: ${check?.checkName || checkType} - ${status}`,
      timestamp: new Date(),
    });
  }

  /**
   * Mark diagnosis as correlating results
   */
  setCorrelating(diagnosisId: string): void {
    const summary = this.progressMap.get(diagnosisId);
    if (!summary) return;

    summary.status = DiagnosisProgressStatus.CORRELATING;
    summary.progress = 95;
    this.progressMap.set(diagnosisId, summary);

    this.emitProgress({
      diagnosisId: summary.diagnosisId,
      siteId: summary.siteId,
      siteName: summary.siteName,
      status: DiagnosisProgressStatus.CORRELATING,
      progress: 95,
      totalChecks: summary.totalChecks,
      completedChecks: summary.completedChecks,
      failedChecks: summary.failedChecks,
      warningChecks: summary.warningChecks,
      passedChecks: summary.passedChecks,
      elapsedTime: Date.now() - summary.startedAt.getTime(),
      message: 'Analyzing results and identifying root causes...',
      timestamp: new Date(),
    });
  }

  /**
   * Mark diagnosis as completed
   */
  completeDiagnosis(diagnosisId: string, healthScore: number): void {
    this.logger.log(`[completeDiagnosis] Called for ${diagnosisId} with healthScore ${healthScore}`);
    
    const summary = this.progressMap.get(diagnosisId);
    if (!summary) {
      this.logger.warn(`[completeDiagnosis] No progress summary found for ${diagnosisId}`);
      return;
    }

    this.logger.log(`[completeDiagnosis] Current status: ${summary.status}, progress: ${summary.progress}%`);

    summary.status = DiagnosisProgressStatus.COMPLETED;
    summary.progress = 100;
    summary.completedAt = new Date();
    summary.elapsedTime = summary.completedAt.getTime() - summary.startedAt.getTime();
    this.progressMap.set(diagnosisId, summary);

    // Remove from active diagnoses
    this.activeDiagnoses.delete(summary.siteId);

    this.logger.log(`[completeDiagnosis] Updated status to COMPLETED, progress to 100%`);

    this.emitProgress({
      diagnosisId: summary.diagnosisId,
      siteId: summary.siteId,
      siteName: summary.siteName,
      status: DiagnosisProgressStatus.COMPLETED,
      progress: 100,
      totalChecks: summary.totalChecks,
      completedChecks: summary.completedChecks,
      failedChecks: summary.failedChecks,
      warningChecks: summary.warningChecks,
      passedChecks: summary.passedChecks,
      elapsedTime: summary.elapsedTime,
      message: `Diagnosis completed - Health Score: ${healthScore}/100`,
      timestamp: new Date(),
    });

    this.logger.log(`[completeDiagnosis] Emitted COMPLETED progress event`);

    // Clean up after 5 minutes
    setTimeout(() => {
      this.logger.log(`[completeDiagnosis] Cleaning up progress map for ${diagnosisId}`);
      this.progressMap.delete(diagnosisId);
    }, 5 * 60 * 1000);
  }

  /**
   * Mark diagnosis as failed
   */
  failDiagnosis(diagnosisId: string, error: string): void {
    const summary = this.progressMap.get(diagnosisId);
    if (!summary) return;

    summary.status = DiagnosisProgressStatus.FAILED;
    summary.completedAt = new Date();
    summary.elapsedTime = summary.completedAt.getTime() - summary.startedAt.getTime();
    this.progressMap.set(diagnosisId, summary);

    // Remove from active diagnoses
    this.activeDiagnoses.delete(summary.siteId);

    this.emitProgress({
      diagnosisId: summary.diagnosisId,
      siteId: summary.siteId,
      siteName: summary.siteName,
      status: DiagnosisProgressStatus.FAILED,
      progress: summary.progress,
      totalChecks: summary.totalChecks,
      completedChecks: summary.completedChecks,
      failedChecks: summary.failedChecks,
      warningChecks: summary.warningChecks,
      passedChecks: summary.passedChecks,
      elapsedTime: summary.elapsedTime,
      error,
      message: `Diagnosis failed: ${error}`,
      timestamp: new Date(),
    });

    // Clean up after 5 minutes
    setTimeout(() => {
      this.progressMap.delete(diagnosisId);
    }, 5 * 60 * 1000);
  }

  /**
   * Get current progress summary
   */
  getProgress(diagnosisId: string): DiagnosisProgressSummary | undefined {
    const progress = this.progressMap.get(diagnosisId);
    
    if (progress) {
      this.logger.debug(`[getProgress] Found progress for ${diagnosisId}: status=${progress.status}, progress=${progress.progress}%`);
    } else {
      this.logger.debug(`[getProgress] No progress found for ${diagnosisId}`);
    }
    
    return progress;
  }

  /**
   * Emit progress event via SSE
   */
  private emitProgress(event: DiagnosisProgressEvent): void {
    this.logger.debug(
      `Diagnosis progress: ${event.diagnosisId} - ${event.status} - ${event.progress}%`,
    );

    this.eventBus.emit({
      type: SystemEvent.DIAGNOSIS_PROGRESS,
      data: event,
      timestamp: new Date(),
    });
  }
}
