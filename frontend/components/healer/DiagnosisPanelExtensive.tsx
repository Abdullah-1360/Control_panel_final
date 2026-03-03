'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  FileText,
  Activity,
  AlertTriangle,
  Info,
  Eye,
  Edit3,
  Play,
  BarChart3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { HealthScoreRing } from '@/components/ui/progress-ring';
import { StatusCard } from '@/components/ui/status-card';

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
  const [editableCommands, setEditableCommands] = useState<string>(
    diagnosis.suggestedCommands.join('\n')
  );
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const commandsModified = editableCommands !== diagnosis.suggestedCommands.join('\n');

  const isHealthy = diagnosis.diagnosisType === 'HEALTHY';
t = Math.round(diagnosis.confidence * 100);
  const isLowConfidence = diagnosis.confidence < 0.7;

  const getDiagnosisInfo = (type: string) => {
    switch (type) {
      case 'HEALTHY':
        return { 
          color: 'success', 
          icon: '✅', 
          label: 'Healthy',
          description: 'Site is functioning normally'
        };
      case 'WSOD':
        return { 
          color: 'error', 
          icon: '💀', 
          label: 'White Screen',
          description: 'Critical error preventing site display'
        };
      case 'DB_ERROR':
        return { 
          color: 'error', 
          icon: '🗄️', 
          label: 'Database Error',
          description: 'Database connection or query issues'
        };
      case 'SYNTAX_ERROR':
        return { 
          color: 'error', 
          icon: '⚠️', 
          label: 'Syntax Error',
          description: 'PHP syntax or code errors'
        };
      case 'MAINTENANCE':
        return { 
          color: 'info', 
          icon: '🔧', 
          label: 'Maintenance',
          description: 'Site is in maintenance mode'
        };
      case 'MEMORY_EXHAUSTION':
        return { 
          color: 'warning', 
          icon: '🧠', 
          label: 'Memory Issue',
          description: 'PHP memory limit exceeded'
        };
      case 'PERMISSION':
        return { 
          color: 'warning', 
          icon: '🔒', 
          label: 'Permission Error',
          description: 'File or directory permission issues'
        };
      default:
        return { 
          color: 'neutral', 
          icon: '❓', 
          label: 'Unknown',
          description: 'Unidentified issue'
        };
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

  const diagnosisInfo = getDiagnosisInfo(diagnosis.diagnosisType);

  return (
    <div className="space-y-6 max-w-full">
      {/* Diagnosis Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Diagnosis Result"
          value={diagnosisInfo.label}
          status={diagnosisInfo.color as any}
          icon={<span className="text-lg">{diagnosisInfo.icon}</span>}
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

        {hasCommandOutputs && (
          <StatusCard
            title="Diagnostic Checks"
            value={`${successCount}/${commandOutputs.length}`}
            status={failureCount === 0 ? 'success' : failureCount > successCount ? 'error' : 'warning'}
            icon={<BarChart3 className="h-4 w-4" />}
            description={`${(totalDuration / 1000).toFixed(1)}s total time`}
          />
        )}
      </div>

      {/* Low Confidence Warning */}
      {isLowConfidence && !isHealthy && siteId && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">Low Confidence Diagnosis</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>Automated diagnosis has {confidencePercent}% confidence. Consider manual mode for better accuracy.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/healer/sites/${siteId}/diagnose/manual`)}
                className="w-fit"
              >
                <Terminal className="mr-2 h-4 w-4" />
                Manual Mode
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <div className="w-full">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="flex items-center space-x-2 text-xs sm:text-sm">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            {hasCommandOutputs && (
              <TabsTrigger value="checks" className="flex items-center space-x-2 text-xs sm:text-sm">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Checks</span>
                <span className="sm:hidden">({commandOutputs.length})</span>
                <span className="hidden sm:inline">({commandOutputs.length})</span>
              </TabsTrigger>
            )}
            {!isHealthy && diagnosis.suggestedCommands.length > 0 && (
              <TabsTrigger value="commands" className="flex items-center space-x-2 text-xs sm:text-sm">
                <Terminal clsName="h-4 w-4" />
                <span className="hidden sm:inline">Commands</span>
              </TabsTrigger>
            )}
            {diagnosis.details.logFiles.length > 0 && (
              <TabsTrigger value="logs" className="flex items-center space-x-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Logs</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-start space-x-3">
                  <span className="text-2xl flex-shrink-0">{diagnosisInfo.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold">{diagnosis.details.errorType || 'Site Status'}</div>
                    {diagnosis.details.culprit && (
                      <div className="text-smxt-muted-foreground font-normal">
                        Affected: {diagnosis.details.culprit}
                      </div>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm leading-relaxed">{diagnosis.details.errorMessage}</p>
                  </div>
                  
                  {!isHealthy && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center space-x-2">
                        <Wrench className="h-4 w-4" />
                        <span>Recommended Action</span>
                      </h4>
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <p className="text-sm leading-relaxed">{diagnosis.suggestedAction}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Diagnostic Checks Tab */}
          {hasCommandOutputs && (
            <TabsContent value="checks" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Diagnostic Checks Results</CardTitle>
                    <ms-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{successCount} passed</span>
                      </div>
                      {failureCount > 0 && (
                        <div className="flex items-center space-x-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span>{failureCount} failed</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{(totalDuration / 1000).toFixed(2)}s</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[50vh] w-full">
                    < pr-4">
                      {commandOutputs.map((cmd, index) => (
                        <Collapsible
                          key={index}
                          open={expandedCommands.has(index)}
                          onOpenChange={() => toggleCommand(index)}
                        >
                          <Card className={cn(
                            'border transition-all duration-200 hover:shadow-sm',
                            cmd.success 
                              ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50' 
                              : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50'
                          )}>
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  {cmd.success ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                  ) : (
  </div>
    </div>
  );
}           <div key={index} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border">
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono text-sm break-all">{file}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
     )}

          {/* Log Files Tab */}
          {diagnosis.details.logFiles.length > 0 && (
            <TabsContent value="logs" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Analyzed Log Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-60 w-full">
                    <div className="space-y-3">
                      {diagnosis.details.logFiles.map((file, index) => (
             -spin rounded-full border-2 border-current border-t-transparent" />
                        Healing in Progress...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {commandsModified ? 'Execute Custom Commands' : 'Start Healing Process'}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            const customCommands = commandsModified 
                        ? editableCommands.split('\n').filter(cmd => cmd.trim() && !cmd.trim().startsWith('#'))
                        : undefined;
                      onFix(customCommands);
                    }} 
                    disabled={isHealing} 
                    className="w-full" 
                    size="lg"
                  >
                    {isHealing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate              </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-60 w-full">
                    <pre className="text-sm font-mono bg-muted/50 p-4 rounded-lg whitespace-pre-wrap border">
                      {editableCommands}
                    </pre>
                  </ScrollArea>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => {
                    justify-end space-x-2">
                              <Button variant="outline" onClick={() => setShowCommandDialog(false)}>
                                Cancel
                              </Button>
                              <Button onClick={() => setShowCommandDialog(false)}>
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
      sName="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                              <Info className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                                Custom commands will replace the suggested ones. Lines starting with # are comments and will be ignored.
                              </AlertDescription>
                            </Alert>
                            <div className="flexd">
                              <textarea
                                value={editableCommands}
                                onChange={(e) => setEditableCommands(e.target.value)}
                                className="w-full h-full min-h-[300px] bg-transparent p-4 text-sm font-mono resize-none focus:outline-none"
                                placeholder="Enter commands to execute..."
                              />
                            </ScrollArea>
                            <Alert clas                  <DialogHeader>
                            <DialogTitle>Edit Healing Commands</DialogTitle>
                            <DialogDescription>
                              Modify the commands that will be executed to fix the issues. Each line represents a separate command.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <ScrollArea className="h-80 w-full border rounded-md
                        </Badge>
                      )}
                      <Dialog open={showCommandDialog} onOpenChange={setShowCommandDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                  <TabsContent value="commands" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Healing Commands</CardTitle>
                    <div className="flex items-center space-x-2">
                      {commandsModified && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          Modifie                      </pre>
                                </ScrollArea>
                              </div>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Fix Commands Tab */}
          {!isHealthy && diagnosis.suggestedCommands.length > 0 && (
                     </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Separator />
                              <div className="p-4">
                                <ScrollArea className="h-40 w-full">
                                  <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-muted/50 p-3 rounded border">
                                    {cmd.output}
                                             <Badge variant="outline" className="text-xs">
                                    {cmd.duration}ms
                                  </Badge>
                                  {expandedCommands.has(index) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                                 <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                  )}
                                  <span className="font-mono text-sm truncate text-left">{cmd.command}</span>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
 