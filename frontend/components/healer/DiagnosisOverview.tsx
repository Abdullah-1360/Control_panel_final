'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Wrench,
  Terminal,
  Info,
} from 'lucide-react';
import { HealthScoreRing } from '@/components/ui/progress-ring';
import { StatusCard } from '@/components/ui/status-card';

interface DiagnosisOverviewProps {
  diagnosisType: string;
  confidence: number;
  errorType?: string;
  errorMessage: string;
  culprit?: string;
  suggestedAction: string;
  isLowConfidence?: boolean;
  onManualMode?: () => void;
  checksCount?: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  totalDuration?: number;
}

export function DiagnosisOverview({
  diagnosisType,
  confidence,
  errorType,
  errorMessage,
  culprit,
  suggestedAction,
  isLowConfidence = false,
  onManualMode,
  checksCount,
  totalDuration = 0,
}: DiagnosisOverviewProps) {
  const confidencePercent = Math.round(confidence * 100);
  const isHealthy = diagnosisType === 'HEALTHY';

  const getDiagnosisInfo = (type: string) => {
    switch (type) {
      case 'HEALTHY':
        return { 
          color: 'success', 
          icon: '✅', 
          label: 'Healthy',
          description: 'Site is functioning normally',
          bgGradient: 'from-green-500/10 to-green-600/5'
        };
      case 'WSOD':
        return { 
          color: 'error', 
          icon: '💀', 
          label: 'White Screen of Death',
          description: 'Critical error preventing site display',
          bgGradient: 'from-red-500/10 to-red-600/5'
        };
      case 'DB_ERROR':
        return { 
          color: 'error', 
          icon: '🗄️', 
          label: 'Database Error',
          description: 'Database connection or query issues',
          bgGradient: 'from-red-500/10 to-red-600/5'
        };
      case 'SYNTAX_ERROR':
        return { 
          color: 'error', 
          icon: '⚠️', 
          label: 'Syntax Error',
          description: 'PHP syntax or code errors',
          bgGradient: 'from-red-500/10 to-red-600/5'
        };
      case 'MAINTENANCE':
        return { 
          color: 'info', 
          icon: '🔧', 
          label: 'Maintenance Mode',
          description: 'Site is in maintenance mode',
          bgGradient: 'from-blue-500/10 to-blue-600/5'
        };
      case 'MEMORY_EXHAUSTION':
        return { 
          color: 'warning', 
          icon: '🧠', 
          label: 'Memory Exhaustion',
          description: 'PHP memory limit exceeded',
          bgGradient: 'from-yellow-500/10 to-yellow-600/5'
        };
      case 'PERMISSION':
        return { 
          color: 'warning', 
          icon: '🔒', 
          label: 'Permission Error',
          description: 'File or directory permission issues',
          bgGradient: 'from-yellow-500/10 to-yellow-600/5'
        };
      default:
        return { 
          color: 'neutral', 
          icon: '❓', 
          label: 'Unknown Issue',
          description: 'Unidentified problem detected',
          bgGradient: 'from-muted/20 to-muted/10'
        };
    }
  };

  const diagnosisInfo = getDiagnosisInfo(diagnosisType);

  return (
    <div className="space-y-6">
      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Diagnosis Result"
          value={diagnosisInfo.label}
          status={diagnosisInfo.color as any}
          icon={<span className="text-xl">{diagnosisInfo.icon}</span>}
          description={diagnosisInfo.description}
        />
        
        <div className="flex items-center justify-center">
          <HealthScoreRing score={confidencePercent} size={100} showLabel={false}>
            <div className="text-center">
              <div className="text-2xl font-bold">{confidencePercent}%</div>
              <div className="text-xs text-muted-foreground">Confidence</div>
            </div>
          </HealthScoreRing>
        </div>

        {checksCount && (
          <StatusCard
            title="Diagnostic Checks"
            value={`${checksCount.passed}/${checksCount.total}`}
            status={
              checksCount.failed === 0 ? 'success' : 
              checksCount.failed > checksCount.passed ? 'error' : 'warning'
            }
            icon={<Activity className="h-4 w-4" />}
            description={`${(totalDuration / 1000).toFixed(1)}s total time`}
          />
        )}
      </div>

      {/* Low Confidence Warning */}
      {isLowConfidence && !isHealthy && onManualMode && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Low Confidence Diagnosis
          </AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span>
                Automated diagnosis has {confidencePercent}% confidence. Consider manual mode for better accuracy.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onManualMode}
                className="w-fit"
              >
                <Terminal className="mr-2 h-4 w-4" />
                Switch to Manual Mode
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Status Card */}
      <Card className={`bg-gradient-to-r ${diagnosisInfo.bgGradient} border-2`}>
        <CardHeader>
          <CardTitle className="flex items-start space-x-3">
            <span className="text-3xl flex-shrink-0">{diagnosisInfo.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xl font-bold">{errorType || 'Site Status'}</div>
              {culprit && (
                <div className="text-sm text-muted-foreground font-normal mt-1">
                  Affected Component: <span className="font-medium">{culprit}</span>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Message */}
          <div className="bg-background/50 backdrop-blur-sm border rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          
          {/* Suggested Action */}
          {!isHealthy && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Wrench className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary mb-2">Recommended Action</h4>
                  <p className="text-sm leading-relaxed">{suggestedAction}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}