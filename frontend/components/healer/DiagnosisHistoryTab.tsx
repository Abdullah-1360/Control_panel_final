/**
 * Diagnosis History Tab Component
 * 
 * Displays the last 5 diagnosis records with complete diagnostic reports
 */

import { useDiagnosisHistory } from '@/hooks/use-healer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  User,
  Calendar,
  Filter
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DiagnosisHistoryTabProps {
  applicationId: string;
}

const DIAGNOSIS_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  HEALTHY: { label: 'Healthy', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  WSOD: { label: 'White Screen of Death', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  DB_ERROR: { label: 'Database Error', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  MAINTENANCE: { label: 'Maintenance Mode', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  INTEGRITY: { label: 'Integrity Issue', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  PERMISSION: { label: 'Permission Issue', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  CACHE: { label: 'Cache Issue', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  PLUGIN_CONFLICT: { label: 'Plugin Conflict', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  THEME_CONFLICT: { label: 'Theme Conflict', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  MEMORY_EXHAUSTION: { label: 'Memory Exhaustion', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  SYNTAX_ERROR: { label: 'Syntax Error', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  UNKNOWN: { label: 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

// Helper function to format check names
const formatCheckName = (name: string): string => {
  if (!name) return 'Unknown Check';
  
  // Convert SNAKE_CASE to Title Case
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to format error messages
const formatErrorMessage = (message: string, details?: any): string => {
  if (!message) return 'Check failed without error message';
  
  // Handle timeout errors
  if (message.includes('timed out')) {
    const match = message.match(/(\d+)ms/);
    const timeout = match ? parseInt(match[1]) / 1000 : 60;
    return `Check exceeded ${timeout}s timeout limit. This may indicate server performance issues or the check requires optimization.`;
  }
  
  // Handle command execution errors
  if (message.includes('Command execution failed')) {
    return 'Unable to execute diagnostic command. This may be due to insufficient permissions or missing dependencies.';
  }
  
  // Handle connection errors (but not success messages)
  if (message.includes('ECONNREFUSED')) {
    return 'Unable to connect to the service. Please verify the service is running and accessible.';
  }
  
  if (message.includes('Connection refused') || message.includes('connection failed')) {
    return 'Unable to connect to the service. Please verify the service is running and accessible.';
  }
  
  return message;
};

const TRIGGER_CONFIG: Record<string, { label: string; icon: any }> = {
  MANUAL: { label: 'Manual', icon: User },
  SEMI_AUTO: { label: 'Semi-Auto', icon: Activity },
  FULL_AUTO: { label: 'Automated', icon: Activity },
  SEARCH: { label: 'Search', icon: Activity },
};

const STATUS_ICON_CONFIG: Record<string, { icon: any; color: string }> = {
  PASS: { icon: CheckCircle2, color: 'text-green-600' },
  WARN: { icon: AlertTriangle, color: 'text-yellow-600' },
  FAIL: { icon: AlertCircle, color: 'text-red-600' },
  ERROR: { icon: AlertCircle, color: 'text-red-600' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-blue-100 text-blue-800' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-800' },
};

export function DiagnosisHistoryTab({ applicationId }: DiagnosisHistoryTabProps) {
  const { data, isLoading, error } = useDiagnosisHistory(applicationId, 5);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, failed, warning, passed

  // Debug logging
  console.log('[DiagnosisHistoryTab] Raw data received:', data);
  console.log('[DiagnosisHistoryTab] data?.data:', data?.data);
  
  // Handle different response formats
  // The API returns { data: { data: [...], pagination: {...} } }
  let historyRecords: any[] = [];
  
  if (data?.data?.data && Array.isArray(data.data.data)) {
    // Nested data structure: { data: { data: [...] } }
    historyRecords = data.data.data;
  } else if (data?.data && Array.isArray(data.data)) {
    // Direct data array: { data: [...] }
    historyRecords = data.data;
  } else if (Array.isArray(data)) {
    // Raw array
    historyRecords = data;
  }

  console.log('[DiagnosisHistoryTab] Extracted history records:', historyRecords);
  console.log('[DiagnosisHistoryTab] Records count:', historyRecords.length);

  const toggleRecord = (recordId: string) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading diagnosis history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('[DiagnosisHistoryTab] Error:', error);
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Failed to load diagnosis history</p>
          <p className="text-xs text-red-500 mt-2">{error?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  if (!Array.isArray(historyRecords)) {
    console.error('[DiagnosisHistoryTab] historyRecords is not an array:', historyRecords);
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Invalid data format received</p>
          <p className="text-xs text-red-500 mt-2">Expected array, got {typeof historyRecords}</p>
        </div>
      </div>
    );
  }

  if (historyRecords.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">No diagnosis history available</p>
          <p className="text-xs text-muted-foreground mt-2">
            Run a diagnosis to see results here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Diagnosis History</h3>
        <Badge variant="outline">
          Last {historyRecords.length} {historyRecords.length === 1 ? 'record' : 'records'}
        </Badge>
      </div>

      <div className="space-y-3">
        {historyRecords.map((record: any) => {
          const isExpanded = expandedRecords.has(record.id);
          const diagnosisConfig = DIAGNOSIS_TYPE_CONFIG[record.diagnosisType] || DIAGNOSIS_TYPE_CONFIG.UNKNOWN;
          const triggerConfig = TRIGGER_CONFIG[record.trigger] || TRIGGER_CONFIG.MANUAL;
          const TriggerIcon = triggerConfig.icon;
          
          // Extract check results from diagnosisDetails
          const checkResults = record.diagnosisDetails?.checkResults || [];
          const checksRun = record.checksRun || [];
          
          // Calculate stats from check results
          const passedChecks = checkResults.filter((c: any) => c.status === 'PASS').length;
          const failedChecks = checkResults.filter((c: any) => c.status === 'FAIL' || c.status === 'ERROR').length;
          const warningChecks = checkResults.filter((c: any) => c.status === 'WARN').length;
          
          // Debug logging
          console.log('[DiagnosisHistoryTab] Record:', record);
          console.log('[DiagnosisHistoryTab] Diagnosis Type:', record.diagnosisType);
          console.log('[DiagnosisHistoryTab] Check Results:', checkResults);
          console.log('[DiagnosisHistoryTab] Checks Run:', checksRun);

          return (
            <Card key={record.id} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleRecord(record.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      {/* Header Row */}
                      <div className="flex items-center gap-3">
                        <Badge className={diagnosisConfig.color}>
                          {diagnosisConfig.label}
                        </Badge>
                        {record.healthScore !== null && record.healthScore !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className={`text-sm font-semibold ${
                              record.healthScore >= 90 ? 'text-green-600' :
                              record.healthScore >= 70 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {Math.round(record.healthScore)}%
                            </span>
                          </div>
                        )}
                        {record.subdomain && (
                          <Badge variant="outline" className="text-xs">
                            {record.subdomain}
                          </Badge>
                        )}
                      </div>

                      {/* Metadata Row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(record.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TriggerIcon className="h-3.5 w-3.5" />
                          <span>{triggerConfig.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{(record.duration / 1000).toFixed(1)}s</span>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-3 text-xs">
                        {passedChecks > 0 && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{passedChecks} passed</span>
                          </div>
                        )}
                        {warningChecks > 0 && (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>{warningChecks} warnings</span>
                          </div>
                        )}
                        {failedChecks > 0 && (
                          <div className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{failedChecks} failed</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="ml-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t pt-4 space-y-4">
                      {/* Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Profile</p>
                          <Badge variant="outline">{record.profile}</Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Issues Found</p>
                          <p className="font-semibold">{record.issuesFound}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Critical</p>
                          <p className="font-semibold text-red-600">{record.criticalIssues}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Warnings</p>
                          <p className="font-semibold text-yellow-600">{record.warningIssues}</p>
                        </div>
                      </div>

                      {/* Check Results with Filtering */}
                      {checkResults.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">
                              Check Results ({checkResults.length} checks)
                            </h4>
                            <div className="flex gap-1">
                              <Button
                                variant={filterStatus === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('all')}
                                className="h-7 text-xs"
                              >
                                All
                              </Button>
                              <Button
                                variant={filterStatus === 'failed' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('failed')}
                                className="h-7 text-xs"
                              >
                                Failed ({checkResults.filter((c: any) => c.status === 'FAIL' || c.status === 'ERROR').length})
                              </Button>
                              <Button
                                variant={filterStatus === 'warning' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('warning')}
                                className="h-7 text-xs"
                              >
                                Warnings ({checkResults.filter((c: any) => c.status === 'WARN').length})
                              </Button>
                              <Button
                                variant={filterStatus === 'passed' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('passed')}
                                className="h-7 text-xs"
                              >
                                Passed ({checkResults.filter((c: any) => c.status === 'PASS').length})
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {checkResults
                              .filter((check: any) => {
                                if (filterStatus === 'all') return true;
                                if (filterStatus === 'failed') return check.status === 'FAIL' || check.status === 'ERROR';
                                if (filterStatus === 'warning') return check.status === 'WARN';
                                if (filterStatus === 'passed') return check.status === 'PASS';
                                return true;
                              })
                              .map((check: any, index: number) => {
                              const statusConfig = STATUS_ICON_CONFIG[check.status] || STATUS_ICON_CONFIG.ERROR;
                              const StatusIcon = statusConfig.icon;
                              const severityConfig = SEVERITY_CONFIG[check.severity] || SEVERITY_CONFIG.LOW;
                              
                              // Extract and format check information
                              const rawCheckName = check.name || check.checkType || `Check ${index + 1}`;
                              const checkName = formatCheckName(rawCheckName);
                              const checkCategory = check.category || check.checkCategory || 'SYSTEM';
                              const rawMessage = check.message || 'No message available';
                              const checkMessage = formatErrorMessage(rawMessage, check.details);
                              
                              // Check if this is a timeout
                              const isTimeout = check.details?.isTimeout || rawMessage.includes('timed out');
                              const duration = check.duration || check.details?.duration;

                              return (
                                <div
                                  key={index}
                                  data-check-index={`${record.id}-${index}`}
                                  className={cn(
                                    "flex items-start gap-3 p-4 rounded-lg border transition-all",
                                    "hover:shadow-md hover:border-primary/20",
                                    check.status === 'FAIL' || check.status === 'ERROR' 
                                      ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30'
                                      : check.status === 'WARN'
                                      ? 'bg-yellow-50/50 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-900/30'
                                      : 'bg-card'
                                  )}
                                >
                                  <StatusIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${statusConfig.color}`} />
                                  <div className="flex-1 min-w-0 space-y-2">
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <h5 className="text-sm font-semibold text-foreground mb-1">
                                          {checkName}
                                        </h5>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                          {checkMessage}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <Badge className={`text-xs ${severityConfig.color}`}>
                                          {severityConfig.label}
                                        </Badge>
                                        {duration && (
                                          <span className={cn(
                                            "text-xs font-mono",
                                            isTimeout ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"
                                          )}>
                                            {duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Category Badge */}
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs font-normal">
                                        {formatCheckName(checkCategory)}
                                      </Badge>
                                      {isTimeout && (
                                        <Badge variant="outline" className="text-xs font-normal border-red-300 text-red-700 dark:border-red-800 dark:text-red-400">
                                          ⏱️ Timeout
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Suggested Fix */}
                                    {check.suggestedFix && (
                                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-md">
                                        <div className="flex items-start gap-2">
                                          <span className="text-blue-600 dark:text-blue-400 text-sm">💡</span>
                                          <div className="flex-1">
                                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                              Suggested Fix
                                            </p>
                                            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                                              {check.suggestedFix}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Technical Details (Collapsible) */}
                                    {check.details && typeof check.details === 'object' && Object.keys(check.details).length > 0 && (
                                      <details className="group">
                                        <summary className="text-xs font-medium cursor-pointer text-primary hover:underline flex items-center gap-1">
                                          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                                          Technical Details
                                        </summary>
                                        <div className="mt-2 p-3 bg-muted/50 border border-border rounded-md">
                                          <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">
                                            {JSON.stringify(check.details, null, 2)}
                                          </pre>
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Checks Executed - Interactive Grid with Status Colors */}
                      {checksRun && checksRun.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                            Checks Executed ({checksRun.length})
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {checksRun.map((checkName: string, index: number) => {
                              // Find the corresponding check result to get its status
                              const checkResult = checkResults.find((c: any) => 
                                (c.name === checkName || c.checkType === checkName)
                              );
                              
                              const status = checkResult?.status || 'UNKNOWN';
                              const checkId = `check-${record.id}-${index}`;
                              
                              // Determine color based on status
                              let statusColor = 'bg-gray-500'; // Unknown
                              let bgColor = 'bg-muted/30';
                              let borderColor = 'border-border/50';
                              let hoverBg = 'hover:bg-muted/50';
                              
                              if (status === 'PASS') {
                                statusColor = 'bg-green-500';
                                bgColor = 'bg-green-50/50 dark:bg-green-950/20';
                                borderColor = 'border-green-200 dark:border-green-900/30';
                                hoverBg = 'hover:bg-green-100/50 dark:hover:bg-green-950/30';
                              } else if (status === 'WARN') {
                                statusColor = 'bg-yellow-500';
                                bgColor = 'bg-yellow-50/50 dark:bg-yellow-950/20';
                                borderColor = 'border-yellow-200 dark:border-yellow-900/30';
                                hoverBg = 'hover:bg-yellow-100/50 dark:hover:bg-yellow-950/30';
                              } else if (status === 'FAIL' || status === 'ERROR') {
                                statusColor = 'bg-red-500';
                                bgColor = 'bg-red-50/50 dark:bg-red-950/20';
                                borderColor = 'border-red-200 dark:border-red-900/30';
                                hoverBg = 'hover:bg-red-100/50 dark:hover:bg-red-950/30';
                              }
                              
                              return (
                                <button
                                  key={index}
                                  onClick={() => {
                                    // Find the check result element and scroll to it
                                    const checkIndex = checkResults.findIndex((c: any) => 
                                      (c.name === checkName || c.checkType === checkName)
                                    );
                                    if (checkIndex !== -1) {
                                      // Scroll to the check result
                                      const checkElement = document.querySelector(`[data-check-index="${record.id}-${checkIndex}"]`);
                                      if (checkElement) {
                                        checkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        // Highlight the check briefly
                                        checkElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                                        setTimeout(() => {
                                          checkElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                                        }, 2000);
                                      }
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded-md border text-xs transition-all cursor-pointer",
                                    bgColor,
                                    borderColor,
                                    hoverBg,
                                    "hover:shadow-sm active:scale-95"
                                  )}
                                  title={`Click to view ${formatCheckName(checkName)} details`}
                                >
                                  <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", statusColor)} />
                                  <span className="font-medium text-foreground truncate">
                                    {formatCheckName(checkName)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Command Outputs */}
                      {record.commandOutputs && Object.keys(record.commandOutputs).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Command Outputs</h4>
                          <div className="space-y-2">
                            {Object.entries(record.commandOutputs).map(([command, output]: [string, any], index: number) => (
                              <div key={index} className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs font-mono font-semibold mb-2 text-primary">$ {command}</p>
                                <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">
                                  {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
