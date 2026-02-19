'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertCircle,
  CheckCircle,
  Wrench,
  Terminal,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CommandOutput {
  command: string;
  output: string;
  success: boolean;
  duration: number;
}

interface DiagnosisPanelExtensiveProps {
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
    commandOutputs?: CommandOutput[];
  };
  onFix: (customCommands?: string[]) => void;
  isHealing: boolean;
  siteId?: string;
}

export function DiagnosisPanelExtensive({
  diagnosis,
  onFix,
  isHealing,
  siteId,
}: DiagnosisPanelExtensiveProps) {
  const router = useRouter();
  const [expandedCommands, setExpandedCommands] = useState<Set<number>>(new Set());
  const [showAllCommands, setShowAllCommands] = useState(false);
  const [editableCommands, setEditableCommands] = useState<string>(
    diagnosis.suggestedCommands.join('\n')
  );
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const commandsModified = editableCommands !== diagnosis.suggestedCommands.join('\n');

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

  const toggleCommand = (index: number) => {
    const newExpanded = new Set(expandedCommands);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCommands(newExpanded);
  };

  const commandOutputs = diagnosis.commandOutputs || [];
  const hasCommandOutputs = commandOutputs.length > 0;

  // Calculate summary stats
  const successCount = commandOutputs.filter((c) => c.success).length;
  const failureCount = commandOutputs.length - successCount;
  const totalDuration = commandOutputs.reduce((sum, c) => sum + c.duration, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Diagnosis Results</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getDiagnosisColor(diagnosis.diagnosisType)}>
              {diagnosis.diagnosisType}
            </Badge>
            <Badge variant="outline">{confidencePercent}% Confidence</Badge>
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
                The automated diagnosis has {confidencePercent}% confidence. Consider using manual
                mode to execute commands interactively and help the system learn.
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
          {isHealthy ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>
            {diagnosis.details.errorType || 'Status'}
            {diagnosis.details.culprit && ` - ${diagnosis.details.culprit}`}
          </AlertTitle>
          <AlertDescription>{diagnosis.details.errorMessage}</AlertDescription>
        </Alert>

        {/* Diagnostic Checks Summary */}
        {hasCommandOutputs && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Diagnostic Checks ({commandOutputs.length})</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{successCount} passed</span>
                </div>
                {failureCount > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{failureCount} failed</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{(totalDuration / 1000).toFixed(2)}s</span>
                </div>
              </div>
            </div>

            {/* Command Outputs */}
            <div className="space-y-2">
              {commandOutputs.slice(0, showAllCommands ? undefined : 5).map((cmd, index) => (
                <Collapsible
                  key={index}
                  open={expandedCommands.has(index)}
                  onOpenChange={() => toggleCommand(index)}
                >
                  <Card className={cn('border', cmd.success ? 'border-green-200' : 'border-red-200')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {cmd.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                          )}
                          <span className="font-mono text-sm truncate">{cmd.command}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {cmd.duration}ms
                          </Badge>
                          {expandedCommands.has(index) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3">
                        <div className="bg-muted rounded-md p-3 mt-2">
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                            {cmd.output}
                          </pre>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              {commandOutputs.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllCommands(!showAllCommands)}
                  className="w-full"
                >
                  {showAllCommands ? 'Show Less' : `Show ${commandOutputs.length - 5} More Checks`}
                </Button>
              )}
            </div>
          </div>
        )}

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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Commands to Execute</h4>
                  <div className="flex items-center gap-2">
                    {commandsModified && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Modified
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingCommands(!isEditingCommands)}
                    >
                      {isEditingCommands ? 'Preview' : 'Edit'}
                    </Button>
                  </div>
                </div>
                {isEditingCommands ? (
                  <div className="space-y-2">
                    <textarea
                      value={editableCommands}
                      onChange={(e) => setEditableCommands(e.target.value)}
                      className="w-full min-h-[150px] bg-muted p-3 rounded-md text-sm font-mono border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Enter commands to execute..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Edit the commands above. Each line will be executed separately. Lines starting with # are comments and will be skipped.
                    </p>
                    {commandsModified && (
                      <Alert className="border-blue-200 bg-blue-50">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800 text-xs">
                          Custom commands will be executed instead of the suggested commands. Make sure your commands are safe and correct.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                    {editableCommands}
                  </pre>
                )}
              </div>
            )}

            {/* Log Files */}
            {diagnosis.details.logFiles.length > 0 && (
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
            )}
          </>
        )}
      </CardContent>

      {!isHealthy && diagnosis.suggestedCommands.length > 0 && (
        <CardFooter>
          <Button 
            onClick={() => {
              // Parse edited commands into array
              const customCommands = commandsModified 
                ? editableCommands.split('\n').filter(cmd => cmd.trim())
                : undefined;
              onFix(customCommands);
            }} 
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
                {commandsModified ? 'Fix with Custom Commands' : 'Fix Now'}
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
