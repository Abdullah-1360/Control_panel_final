'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HealingProgressProps {
  status: string;
  startedAt: string;
  finishedAt?: string;
}

export function HealingProgress({ status, startedAt, finishedAt }: HealingProgressProps) {
  const getProgressPercentage = () => {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'ANALYZING':
        return 20;
      case 'DIAGNOSED':
        return 40;
      case 'APPROVED':
        return 50;
      case 'HEALING':
        return 75;
      case 'VERIFYING':
        return 90;
      case 'SUCCESS':
      case 'FAILED':
      case 'ROLLED_BACK':
        return 100;
      default:
        return 0;
    }
  };

  const isComplete = ['SUCCESS', 'FAILED', 'ROLLED_BACK'].includes(status);
  const isSuccess = status === 'SUCCESS';
  const isFailed = status === 'FAILED' || status === 'ROLLED_BACK';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Healing Progress</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={getProgressPercentage()} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {status.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <Step
            completed={status !== 'PENDING'}
            active={status === 'ANALYZING' || status === 'DIAGNOSED'}
            label="Diagnosis Complete"
          />
          <Step
            completed={['APPROVED', 'HEALING', 'VERIFYING', 'SUCCESS', 'FAILED'].includes(status)}
            active={status === 'APPROVED'}
            label="Creating Backup"
          />
          <Step
            completed={['HEALING', 'VERIFYING', 'SUCCESS', 'FAILED'].includes(status)}
            active={status === 'HEALING'}
            label="Executing Fix"
          />
          <Step
            completed={['VERIFYING', 'SUCCESS', 'FAILED'].includes(status)}
            active={status === 'VERIFYING'}
            label="Verifying Healing"
          />
          <Step
            completed={isComplete}
            active={false}
            label="Complete"
          />
        </div>

        {/* Status Alert */}
        {isSuccess && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              Healing completed successfully!
            </AlertDescription>
          </Alert>
        )}

        {isFailed && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Healing failed. Site has been rolled back to backup.
            </AlertDescription>
          </Alert>
        )}

        {/* Timing */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Started: {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}
          </p>
          {finishedAt && (
            <p>
              Finished: {formatDistanceToNow(new Date(finishedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Step({
  completed,
  active,
  label,
}: {
  completed: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        {completed ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : active ? (
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted" />
        )}
      </div>
      <span className={completed || active ? 'font-medium' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}
