'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Activity,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagnosisCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  message?: string;
  details?: any;
  duration?: number;
}

interface DiagnosisResultsCompactProps {
  checks: DiagnosisCheck[];
  className?: string;
}

export function DiagnosisResultsCompact({ checks, className }: DiagnosisResultsCompactProps) {
  const [expandedChecks, setExpandedChecks] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

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
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800',
          badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        };
      case 'FAIL':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800',
          badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        };
      case 'WARNING':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800',
          badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        };
      case 'SKIP':
        return {
          icon: Info,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/20 border-muted',
          badgeColor: 'bg-muted text-muted-foreground'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/20 border-muted',
          badgeColor: 'bg-muted text-muted-foreground'
        };
    }
  };

  const passCount = checks.filter(c => c.status === 'PASS').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warningCount = checks.filter(c => c.status === 'WARNING').length;
  const skipCount = checks.filter(c => c.status === 'SKIP').length;
  const totalDuration = checks.reduce((sum, c) => sum + (c.duration || 0), 0);

  const visibleChecks = showAll ? checks : checks.slice(0, 10);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Diagnosis Results</CardTitle>
          <div className="flex items-center space-x-3 text-sm">
            {passCount > 0 && (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{passCount}</span>
              </div>
            )}
            {failCount > 0 && (
              <div className="flex items-center space-x-1 text-red-600">
                <XCircle className="h-4 w-4" />
                <span>{failCount}</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{warningCount}</span>
              </div>
            )}
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{(totalDuration / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[60vh] w-full">
          <div className="space-y-2 pr-4">
            {visibleChecks.map((check, index) => {
              const statusInfo = getStatusInfo(check.status);
              const IconComponent = statusInfo.icon;
              
              return (
                <Collapsible
                  key={index}
                  open={expandedChecks.has(index)}
                  onOpenChange={() => toggleCheck(index)}
                >
                  <div className={cn(
                    'border rounded-lg transition-all duration-200',
                    statusInfo.bgColor
                  )}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <IconComponent className={cn('h-4 w-4 flex-shrink-0', statusInfo.color)} />
                          <span className="text-sm font-medium truncate text-left">{check.name}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Badge className={cn('text-xs', statusInfo.badgeColor)}>
                            {check.status}
                          </Badge>
                          {check.duration && (
                            <Badge variant="outline" className="text-xs">
                              {check.duration}ms
                            </Badge>
                          )}
                          {expandedChecks.has(index) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-3 space-y-2">
                        {check.message && (
                          <p className="text-sm text-muted-foreground">{check.message}</p>
                        )}
                        {check.details && (
                          <div className="bg-muted/50 rounded p-2">
                            <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                              {typeof check.details === 'string' ? check.details : JSON.stringify(check.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
            
            {checks.length > 10 && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full"
                >
                  {showAll ? 'Show Less' : `Show ${checks.length - 10} More Checks`}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}