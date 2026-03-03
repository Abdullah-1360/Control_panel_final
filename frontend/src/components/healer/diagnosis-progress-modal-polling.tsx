/**
 * Diagnosis Progress Modal - React Query Polling Implementation
 * 
 * Replaces SSE with HTTP polling for better reliability
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Clock, Loader2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useDiagnosisProgressPolling, DiagnosisProgressData } from '@/hooks/use-diagnosis-progress-polling';
import { cn } from '@/lib/utils';

interface DiagnosisProgressModalPollingProps {
  open: boolean;
  onClose: () => void;
  diagnosisId: string;
  siteName: string;
  onComplete?: (data: DiagnosisProgressData) => void;
  onConnectionReady?: () => void; // For compatibility, but not used in polling
}

export function DiagnosisProgressModalPolling({
  open,
  onClose,
  diagnosisId,
  siteName,
  onComplete,
  onConnectionReady,
}: DiagnosisProgressModalPollingProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  
  // Update ref when onComplete changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const {
    progress,
    error,
    isLoading,
    isError,
    isPolling,
    startPolling,
    stopPolling,
  } = useDiagnosisProgressPolling({
    diagnosisId,
    enabled: open && !!diagnosisId,
    onComplete: (data) => {
      console.log('[DiagnosisProgressModalPolling] Diagnosis completed:', data);
      console.log('[DiagnosisProgressModalPolling] Immediately calling onComplete callback');
      
      // Stop polling immediately
      stopPolling();
      
      // Call onComplete immediately
      if (onCompleteRef.current) {
        console.log('[DiagnosisProgressModalPolling] onComplete callback exists, invoking it NOW');
        // Use setTimeout to ensure state updates are processed
        setTimeout(() => {
          onCompleteRef.current?.(data);
        }, 100);
      } else {
        console.warn('[DiagnosisProgressModalPolling] onComplete callback is undefined!');
      }
    },
    onError: (error) => {
      console.error('[DiagnosisProgressModalPolling] Polling error:', error);
    },
    pollInterval: 2000, // Poll every 2 seconds
  });

  // Call onConnectionReady when modal opens and we have diagnosisId
  useEffect(() => {
    if (open && !hasStarted) {
      console.log('[DiagnosisProgressModalPolling] Modal opened, calling onConnectionReady');
      setHasStarted(true);
      // Call onConnectionReady immediately since polling doesn't need connection setup
      onConnectionReady?.();
    }
    
    // Reset hasStarted when modal closes
    if (!open && hasStarted) {
      console.log('[DiagnosisProgressModalPolling] Modal closed, resetting hasStarted');
      setHasStarted(false);
    }
  }, [open, hasStarted, onConnectionReady]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setHasStarted(false);
      stopPolling();
      
      // Clear auto-close timer if modal is manually closed
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
  }, [open, stopPolling]);

  const handleClose = () => {
    // Clear auto-close timer
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    stopPolling();
    onClose();
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'RUNNING':
      case 'CHECK_STARTED':
      case 'CHECK_COMPLETED':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'CORRELATING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'RUNNING':
      case 'CHECK_STARTED':
      case 'CHECK_COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CORRELATING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getProgressMessage = () => {
    if (isError) {
      return 'Error fetching diagnosis progress';
    }

    if (!progress) {
      if (!diagnosisId) {
        return 'Waiting for diagnosis to start...';
      }
      return 'Connecting to diagnosis...';
    }

    if (progress.status === 'STARTING') {
      return 'Initializing diagnosis...';
    }

    if (progress.status === 'RUNNING' || progress.status === 'CHECK_STARTED' || progress.status === 'CHECK_COMPLETED') {
      if (progress.currentCheck && progress.checkName) {
        return `Running: ${progress.checkName}`;
      }
      return progress.message || 'Running diagnostic checks...';
    }

    if (progress.status === 'CORRELATING') {
      return 'Analyzing results and identifying root causes...';
    }

    if (progress.status === 'COMPLETED') {
      return `Diagnosis completed successfully`;
    }

    if (progress.status === 'FAILED') {
      return progress.error || 'Diagnosis failed';
    }

    return progress.message || 'Processing...';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon(progress?.status)}
              Diagnosing {siteName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto overflow-x-hidden pr-2">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className={cn('px-3 py-1', getStatusColor(progress?.status))}>
              {progress?.status || 'CONNECTING'}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress?.progress || 0}%</span>
            </div>
            <Progress 
              value={progress?.progress || 0} 
              className="h-2"
            />
          </div>

          {/* Progress Message */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {getProgressMessage()}
            </p>
          </div>

          {/* Real-time Check Results */}
          {progress && progress.checks && progress.checks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Diagnostic Checks</div>
                <div className="text-xs text-muted-foreground">
                  {progress.completedChecks} of {progress.totalChecks} completed
                </div>
              </div>
              
              <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md bg-gray-50/50">
                {progress.checks
                  .sort((a, b) => {
                    // Sort by status priority: RUNNING > FAIL/ERROR > WARNING > PASS > PENDING
                    const statusPriority = {
                      'RUNNING': 5,
                      'FAIL': 4,
                      'ERROR': 4,
                      'WARNING': 3,
                      'PASS': 2,
                      'PENDING': 1
                    };
                    return (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
                  })
                  .map((check, index) => (
                    <div key={`${check.checkType}-${index}`}>
                      <div
                        className={cn(
                          "flex items-center gap-3 p-2 text-sm hover:bg-white/50 transition-colors cursor-pointer",
                          index !== progress.checks.length - 1 && "border-b border-gray-200/50"
                        )}
                        onClick={() => setExpandedCheck(
                          expandedCheck === check.checkType ? null : check.checkType
                        )}
                      >
                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {check.status === 'PASS' && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {(check.status === 'FAIL' || check.status === 'ERROR') && <XCircle className="h-4 w-4 text-red-600" />}
                          {check.status === 'WARNING' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                          {check.status === 'RUNNING' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                          {check.status === 'PENDING' && <Clock className="h-4 w-4 text-gray-400" />}
                        </div>

                        {/* Check Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{check.checkName}</span>
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              {check.category}
                            </Badge>
                          </div>
                          {check.message && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {check.message.length > 60 
                                ? `${check.message.substring(0, 60)}...` 
                                : check.message}
                            </div>
                          )}
                        </div>

                        {/* Duration & Status */}
                        <div className="flex-shrink-0 text-right flex items-center gap-2">
                          {check.duration && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {check.duration}ms
                            </div>
                          )}
                          <div className={cn(
                            "text-xs font-medium",
                            {
                              "text-green-600": check.status === 'PASS',
                              "text-red-600": check.status === 'FAIL' || check.status === 'ERROR',
                              "text-yellow-600": check.status === 'WARNING',
                              "text-blue-600": check.status === 'RUNNING',
                              "text-gray-500": check.status === 'PENDING',
                            }
                          )}>
                            {check.status}
                          </div>
                          {check.message && (
                            <div className="flex-shrink-0">
                              {expandedCheck === check.checkType ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded Message */}
                      {expandedCheck === check.checkType && check.message && (
                        <div className="px-9 pb-2">
                          <div className={cn(
                            "text-xs p-2 rounded border bg-white/80",
                            {
                              "text-green-700 border-green-200 bg-green-50/50": check.status === 'PASS',
                              "text-red-700 border-red-200 bg-red-50/50": check.status === 'FAIL' || check.status === 'ERROR',
                              "text-yellow-700 border-yellow-200 bg-yellow-50/50": check.status === 'WARNING',
                              "text-blue-700 border-blue-200 bg-blue-50/50": check.status === 'RUNNING',
                              "text-gray-700 border-gray-200": check.status === 'PENDING',
                            }
                          )}>
                            {check.message}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Check Statistics - Simplified */}
          {progress && progress.totalChecks > 0 && (
            <div className="grid grid-cols-4 gap-2 text-center text-xs border-t pt-2">
              <div>
                <div className="font-semibold text-blue-600">{progress.totalChecks}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="font-semibold text-green-600">{progress.passedChecks}</div>
                <div className="text-muted-foreground">Passed</div>
              </div>
              <div>
                <div className="font-semibold text-yellow-600">{progress.warningChecks}</div>
                <div className="text-muted-foreground">Warnings</div>
              </div>
              <div>
                <div className="font-semibold text-red-600">{progress.failedChecks}</div>
                <div className="text-muted-foreground">Failed</div>
              </div>
            </div>
          )}

          {/* Time Information */}
          {progress && progress.elapsedTime > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Elapsed: {formatTime(progress.elapsedTime)}</span>
              {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
                <span>ETA: {formatTime(progress.estimatedTimeRemaining)}</span>
              )}
            </div>
          )}

          {/* Error Display */}
          {isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Connection Error</span>
              </div>
              <p className="text-xs text-red-600 mt-1">
                {error?.message || 'Failed to fetch diagnosis progress'}
              </p>
            </div>
          )}

          {/* Polling Status */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {isPolling ? (
                <>
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
                  Polling for updates every 2 seconds
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                  Polling stopped
                </>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 flex-shrink-0 border-t mt-4">
            {progress?.status === 'COMPLETED' ? (
              <Button 
                onClick={() => {
                  console.log('[DiagnosisProgressModalPolling] Close button clicked for COMPLETED status');
                  handleClose();
                  // Also trigger onComplete to ensure tab switch
                  if (onCompleteRef.current && progress) {
                    onCompleteRef.current(progress);
                  }
                }} 
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                View Full Results
              </Button>
            ) : progress?.status === 'FAILED' ? (
              <Button onClick={handleClose} size="sm" variant="destructive">
                Close
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose} size="sm">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}