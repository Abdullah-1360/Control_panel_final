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
  AlertTriangle,
  Info,
  FileText,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface DiagnosisCheckResult {
  checkType: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  message: string;
  details?: any;
  duration: number;
}

interface DiagnosisPanelProps {
  diagnosis: {
    diagnosisType: string;
    confidence: number;
    healthScore?: number;
    previousScore?: number;
    scoreChange?: number;
    issuesFound?: number;
    criticalIssues?: number;
    warningIssues?: number;
    details: {
      errorType?: string;
      culprit?: string;
      errorMessage: string;
      logFiles: string[];
      affectedComponents?: string[];
    };
    suggestedAction: string;
    suggestedCommands: string[];
    checkResults?: DiagnosisCheckResult[];
    duration?: number;
  };
  onFix: () => void;
  isHealing: boolean;
  siteId?: string;
}

export function DiagnosisPanel({ diagnosis, onFix, isHealing, siteId }: DiagnosisPanelProps) {
  const router = useRouter();
  const [expandedChecks, setExpandedChecks] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState('overview');
  
  const isHealthy = diagnosis.diagnosisType === 'HEALTHY';
  const confidencePercent = Math.round(diagnosis.confidence * 100);
  const isLowConfidence = diagnosis.confidence < 0.7;
  const checkResults = diagnosis.checkResults || [];
  
  // Calculate check statistics
  const passCount = checkResults.filter(c => c.status === 'PASS').length;
  const failCount = checkResults.filter(c => c.status === 'FAIL').length;
  const warningCount = checkResults.filter(c => c.status === 'WARNING').length;
  const skippedCount = checkResults.filter(c => c.status === 'SKIPPED').length;
  const totalDuration = checkResults.reduce((sum, c) => sum + (c.duration || 0), 0);

  const toggleCheck = (index: number) => {
    const newExpanded = new Set(expandedChecks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChecks(newExpanded);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PASS':
        return {
          icon: CheckCircle2,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
          badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        };
      case 'FAIL':
        return {
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
          badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        };
      case 'WARNING':
        return {
          icon: AlertTriangle,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
        };
      case 'SKIPPED':
        return {
          icon: Info,
          color: 'text-slate-500 dark:text-slate-400',
          bgColor: 'bg-slate-50 border-slate-200 dark:bg-slate-950/30 dark:border-slate-800',
          badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-slate-500',
          bgColor: 'bg-slate-50 border-slate-200',
          badgeColor: 'bg-slate-100 text-slate-800'
        };
    }
  };

  const getDiagnosisColor = (type: string) => {
    switch (type) {
      case 'HEALTHY':
        return 'bg-green-500 dark:bg-green-600';
      case 'WSOD':
      case 'DB_ERROR':
      case 'SYNTAX_ERROR':
        return 'bg-red-500 dark:bg-red-600';
      case 'MAINTENANCE':
        return 'bg-blue-500 dark:bg-blue-600';
      case 'MEMORY_EXHAUSTION':
      case 'PERMISSION':
        return 'bg-amber-500 dark:bg-amber-600';
      default:
        return 'bg-slate-500 dark:bg-slate-600';
    }
  };

  const getScoreTrendIcon = () => {
    if (!diagnosis.scoreChange) return <Minus className="h-4 w-4" />;
    if (diagnosis.scoreChange > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Health Score */}
        {diagnosis.healthScore !== undefined && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{diagnosis.healthScore}</div>
                <div className="flex items-center gap-1 text-sm">
                  {getScoreTrendIcon()}
                  {diagnosis.scoreChange !== undefined && (
                    <span className={cn(
                      diagnosis.scoreChange > 0 ? 'text-green-600' : diagnosis.scoreChange < 0 ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {diagnosis.scoreChange > 0 ? '+' : ''}{diagnosis.scoreChange}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnosis Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diagnosis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getDiagnosisColor(diagnosis.diagnosisType)}>
                {diagnosis.diagnosisType.replace(/_/g, ' ')}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {confidencePercent}% confidence
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issues Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Issues Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{diagnosis.issuesFound || failCount + warningCount}</div>
              <div className="flex gap-3 text-sm">
                {(diagnosis.criticalIssues || failCount) > 0 && (
                  <span className="text-red-600">{diagnosis.criticalIssues || failCount} critical</span>
                )}
                {(diagnosis.warningIssues || warningCount) > 0 && (
                  <span className="text-amber-600">{diagnosis.warningIssues || warningCount} warnings</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check Results Summary */}
        {checkResults.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Checks Run</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{checkResults.length}</div>
                <div className="flex gap-2 text-xs">
                  {passCount > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{passCount}</span>
                    </div>
                  )}
                  {failCount > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" />
                      <span>{failCount}</span>
                    </div>
                  )}
                  {warningCount > 0 && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{warningCount}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{(totalDuration / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Low Confidence Warning */}
      {isLowConfidence && !isHealthy && siteId && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="checks" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Checks</span>
            <Badge variant="outline" className="ml-1">{checkResults.length}</Badge>
          </TabsTrigger>
          {!isHealthy && diagnosis.suggestedCommands.length > 0 && (
            <TabsTrigger value="fix" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Fix</span>
            </TabsTrigger>
          )}
          {diagnosis.details.logFiles.length > 0 && (
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isHealthy ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                {diagnosis.details.errorType || 'Site Status'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant={isHealthy ? 'default' : 'destructive'}>
                <AlertDescription className="text-base">
                  {diagnosis.details.errorMessage}
                </AlertDescription>
              </Alert>

              {diagnosis.details.affectedComponents && diagnosis.details.affectedComponents.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Affected Components
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {diagnosis.details.affectedComponents.map((component, index) => (
                      <Badge key={index} variant="outline">{component}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {!isHealthy && diagnosis.suggestedAction && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Recommended Action
                  </h4>
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                    <p className="text-sm leading-relaxed">{diagnosis.suggestedAction}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checks Tab */}
        <TabsContent value="checks" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Diagnostic Check Results</CardTitle>
                <div className="flex items-center gap-3 text-sm">
                  {passCount > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{passCount} passed</span>
                    </div>
                  )}
                  {failCount > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>{failCount} failed</span>
                    </div>
                  )}
                  {warningCount > 0 && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{warningCount} warnings</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] w-full pr-4">
                <div className="space-y-3">
                  {checkResults.map((check, index) => {
                    const statusInfo = getStatusInfo(check.status);
                    const IconComponent = statusInfo.icon;
                    const isExpanded = expandedChecks.has(index);

                    return (
                      <Collapsible
                        key={index}
                        open={isExpanded}
                        onOpenChange={() => toggleCheck(index)}
                      >
                        <Card className={cn(
                          'border-2 transition-all duration-200',
                          statusInfo.bgColor
                        )}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <IconComponent className={cn('h-5 w-5 flex-shrink-0', statusInfo.color)} />
                                <div className="text-left min-w-0 flex-1">
                                  <div className="font-medium truncate">
                                    {check.checkType.replace(/_/g, ' ')}
                                  </div>
                                  {check.message && (
                                    <div className="text-sm text-muted-foreground truncate">
                                      {check.message}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge className={statusInfo.badgeColor}>
                                  {check.status}
                                </Badge>
                                {check.duration && (
                                  <Badge variant="outline" className="text-xs">
                                    {check.duration}ms
                                  </Badge>
                                )}
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Separator />
                            <div className="p-4 space-y-3">
                              {check.message && (
                                <div>
                                  <h5 className="text-sm font-semibold mb-1">Message</h5>
                                  <p className="text-sm text-muted-foreground">{check.message}</p>
                                </div>
                              )}
                              {check.details && (
                                <div>
                                  <h5 className="text-sm font-semibold mb-2">Details</h5>
                                  <ScrollArea className="h-60 w-full">
                                    <pre className="text-xs font-mono bg-muted/50 p-3 rounded border whitespace-pre-wrap break-words">
                                      {typeof check.details === 'string' 
                                        ? check.details 
                                        : JSON.stringify(check.details, null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fix Tab */}
        {!isHealthy && diagnosis.suggestedCommands.length > 0 && (
          <TabsContent value="fix" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Healing Commands</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Commands to Execute</h4>
                  <ScrollArea className="h-60 w-full">
                    <pre className="text-sm font-mono bg-muted/50 p-4 rounded-lg border whitespace-pre-wrap">
                      {diagnosis.suggestedCommands.join('\n')}
                    </pre>
                  </ScrollArea>
                </div>
              </CardContent>
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
                      Start Healing Process
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )}

        {/* Logs Tab */}
        {diagnosis.details.logFiles.length > 0 && (
          <TabsContent value="logs" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Analyzed Log Files</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-60 w-full">
                  <div className="space-y-2">
                    {diagnosis.details.logFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
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
    </div>
  );
}
