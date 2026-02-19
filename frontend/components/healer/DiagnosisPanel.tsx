'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Wrench, Terminal } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DiagnosisPanelProps {
  diagnosis: {
    diagnosisType: string;
    confidence: number;
    details: {
      errorType?: string;
      culprit?: string;
      errorMessage: string;
      logFiles: string[];
    };
    suggestedAction: string;
    suggestedCommands: string[];
  };
  onFix: () => void;
  isHealing: boolean;
  siteId?: string;
}

export function DiagnosisPanel({ diagnosis, onFix, isHealing, siteId }: DiagnosisPanelProps) {
  const router = useRouter();
  const isHealthy = diagnosis.diagnosisType === 'HEALTHY';
  const confidencePercent = (diagnosis.confidence * 100).toFixed(0);
  const isLowConfidence = diagnosis.confidence < 0.7;

  const getDiagnosisColor = (type: string) => {
    switch (type) {
      case 'HEALTHY':
        return 'bg-green-500';
      case 'WSOD':
      case 'DB_ERROR':
      case 'SYNTAX_ERROR':
        return 'bg-red-500';
      case 'MAINTENANCE':
        return 'bg-blue-500';
      case 'MEMORY_EXHAUSTION':
      case 'PERMISSION':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Diagnosis Results</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getDiagnosisColor(diagnosis.diagnosisType)}>
              {diagnosis.diagnosisType}
            </Badge>
            <Badge variant="outline">
              {confidencePercent}% Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Low Confidence Warning */}
        {isLowConfidence && !isHealthy && siteId && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-900">Low Confidence Diagnosis</AlertTitle>
            <AlertDescription className="text-yellow-800">
              <p className="mb-2">
                The automated diagnosis has {confidencePercent}% confidence. Consider using manual mode
                to execute commands interactively and help the system learn.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/healer/sites/${siteId}/diagnose/manual`)}
                className="mt-2"
              >
                <Terminal className="mr-2 h-4 w-4" />
                Switch to Manual Mode
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        <Alert variant={isHealthy ? 'default' : 'destructive'}>
          {isHealthy ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {diagnosis.details.errorType || 'Status'}
            {diagnosis.details.culprit && ` - ${diagnosis.details.culprit}`}
          </AlertTitle>
          <AlertDescription>{diagnosis.details.errorMessage}</AlertDescription>
        </Alert>

        {/* Suggested Action */}
        {!isHealthy && (
          <>
            <div>
              <h4 className="font-semibold mb-2">Suggested Action</h4>
              <p className="text-sm text-muted-foreground">{diagnosis.suggestedAction}</p>
            </div>

            {/* Commands */}
            {diagnosis.suggestedCommands.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Commands to Execute</h4>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                  {diagnosis.suggestedCommands.join('\n')}
                </pre>
              </div>
            )}

            {/* Log Files */}
            <div>
              <h4 className="font-semibold mb-2">Analyzed Log Files</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {diagnosis.details.logFiles.map((file, index) => (
                  <li key={index} className="font-mono">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>

      {!isHealthy && diagnosis.suggestedCommands.length > 0 && (
        <CardFooter>
          <Button
            onClick={onFix}
            disabled={isHealing}
            className="w-full"
            size="lg"
          >
            {isHealing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Healing in Progress...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Fix Now
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
