'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Clock, Wifi, WifiOff } from 'lucide-react';
import { useDiagnosisProgress, DiagnosisCheck } from '@/hooks/use-diagnosis-progress';
import { formatDuration } from '@/lib/utils';

interface DiagnosisProgressModalProps {
  open: boolean;
  onClose: () => void;
  diagnosisId: string;
  siteName: string;
  onComplete?: () => void;
  onConnectionReady?: () => void;
}

export function DiagnosisProgressModal({
  open,
  onClose,
  diagnosisId,
  siteName,
  onComplete,
  onConnectionReady,
}: DiagnosisProgressModalProps) {
  const { progress, checks, isComplete, isConnected, connectionError } = useDiagnosisProgress({
    diagnosisId,
    autoConnect: open, // Only connect when modal is open
    onComplete: () => {
      if (onComplete) {
        onComplete();
      }
    },
    onConnectionReady,
  });

  const handleClose = () => {
    if (isComplete) {
      onClose();
    }
  };

  // Show connecting state only if we don't have a diagnosisId yet
  // Once we have diagnosisId, we should be receiving progress
  if (!progress && (!diagnosisId || diagnosisId === '')) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Connecting to Diagnosis Stream</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg">Establishing real-time connection...</p>
              <p className="text-sm text-muted-foreground">
                Diagnosis will start automatically once connected
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If we have diagnosisId but no progress, show waiting state
  if (!progress && diagnosisId && diagnosisId !== '') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Starting Diagnosis for {siteName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg">Diagnosis initiated...</p>
              <p className="text-sm text-muted-foreground">
                Waiting for first progress update
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Diagnosis ID: {diagnosisId}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={isComplete ? handleClose : undefined}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Diagnosing {siteName}</span>
            <div className="flex items-center gap-2">
              {!isConnected && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Disconnected
                </Badge>
              )}
              {isConnected && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  Live
                </Badge>
              )}
              <Badge variant={getStatusVariant(progress.status)}>
                {progress.status}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Connection Error */}
        {connectionError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            {connectionError}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{progress.message}</span>
            <span className="text-muted-foreground">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="h-2" />

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                {progress.completedChecks} / {progress.totalChecks} checks
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {progress.passedChecks}
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-yellow-500" />
                {progress.warningChecks}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {progress.failedChecks}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(progress.elapsedTime)}</span>
              {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
                <span className="text-muted-foreground">
                  / ~{formatDuration(progress.estimatedTimeRemaining)} remaining
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Check List */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          {checks.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Preparing checks...
            </div>
          ) : (
            <div className="divide-y">
              {checks.map((check, index) => (
                <DiagnosisCheckItem key={index} check={check} />
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {progress.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <strong>Error:</strong> {progress.error}
          </div>
        )}

        {/* Actions */}
        {isComplete && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              variant="default"
              onClick={() => {
                handleClose();
                if (onComplete) {
                  onComplete();
                }
              }}
            >
              View Results
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiagnosisCheckItem({ check }: { check: DiagnosisCheck }) {
  const getIcon = () => {
    switch (check.status) {
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'PASS':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'WARNING':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'FAIL':
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{check.checkName}</span>
          <Badge variant="outline" className="text-xs">
            {check.category}
          </Badge>
        </div>
        {check.message && (
          <p className="text-xs text-muted-foreground truncate">{check.message}</p>
        )}
      </div>
      {check.duration && (
        <span className="text-xs text-muted-foreground">
          {(check.duration / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'FAILED':
      return 'destructive';
    case 'RUNNING':
    case 'CHECK_STARTED':
    case 'CHECK_COMPLETED':
    case 'CORRELATING':
      return 'secondary';
    default:
      return 'outline';
  }
}
