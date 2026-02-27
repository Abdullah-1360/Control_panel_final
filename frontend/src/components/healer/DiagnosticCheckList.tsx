/**
 * Diagnostic Check List Component
 * 
 * Displays diagnostic check results with categories and risk levels
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckResult, CheckStatus, CheckCategory, RiskLevel } from '@/types/healer';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  AlertCircle,
  MinusCircle,
  Shield,
  Zap,
  Activity,
  Settings,
  Server,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealApplication } from '@/hooks/use-healer';

interface DiagnosticCheckListProps {
  checks: CheckResult[];
  applicationId?: string;
  showPlaceholder?: boolean;
}

// Map check names to healing action names
const CHECK_TO_ACTION_MAP: Record<string, string> = {
  'npm_audit': 'npm_audit_fix',
  'composer_audit': 'composer_update',
  'outdated_dependencies': 'update_dependencies',
  'security_vulnerabilities': 'fix_vulnerabilities',
  'file_permissions': 'fix_permissions',
  'disk_space': 'cleanup_disk',
  'memory_usage': 'optimize_memory',
  'php_errors': 'fix_php_errors',
  'database_connection': 'fix_database',
  'cache_issues': 'clear_cache',
};

const STATUS_CONFIG = {
  [CheckStatus.PASS]: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    label: 'Pass',
  },
  [CheckStatus.WARN]: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    label: 'Warning',
  },
  [CheckStatus.FAIL]: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    label: 'Fail',
  },
  [CheckStatus.ERROR]: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    label: 'Error',
  },
  [CheckStatus.SKIPPED]: {
    icon: MinusCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    label: 'Skipped',
  },
};

const CATEGORY_CONFIG = {
  [CheckCategory.SYSTEM]: {
    icon: Server,
    label: 'System',
    color: 'text-blue-600',
  },
  [CheckCategory.SECURITY]: {
    icon: Shield,
    label: 'Security',
    color: 'text-red-600',
  },
  [CheckCategory.PERFORMANCE]: {
    icon: Zap,
    label: 'Performance',
    color: 'text-yellow-600',
  },
  [CheckCategory.AVAILABILITY]: {
    icon: Activity,
    label: 'Availability',
    color: 'text-green-600',
  },
  [CheckCategory.CONFIGURATION]: {
    icon: Settings,
    label: 'Configuration',
    color: 'text-purple-600',
  },
};

const RISK_LEVEL_CONFIG = {
  [RiskLevel.LOW]: {
    label: 'Low',
    color: 'bg-green-100 text-green-800',
  },
  [RiskLevel.MEDIUM]: {
    label: 'Medium',
    color: 'bg-yellow-100 text-yellow-800',
  },
  [RiskLevel.HIGH]: {
    label: 'High',
    color: 'bg-orange-100 text-orange-800',
  },
  [RiskLevel.CRITICAL]: {
    label: 'Critical',
    color: 'bg-red-100 text-red-800',
  },
};

export function DiagnosticCheckList({ checks, applicationId, showPlaceholder }: DiagnosticCheckListProps) {
  const [healingCheck, setHealingCheck] = useState<string | null>(null);
  const healMutation = useHealApplication();

  const handleFix = async (checkName: string) => {
    if (!applicationId) return;
    
    const actionName = CHECK_TO_ACTION_MAP[checkName];
    if (!actionName) {
      console.warn(`No healing action mapped for check: ${checkName}`);
      return;
    }

    setHealingCheck(checkName);
    try {
      await healMutation.mutateAsync({
        id: applicationId,
        actionName,
      });
    } finally {
      setHealingCheck(null);
    }
  };

  if (showPlaceholder || checks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No diagnostic results available yet.</p>
            <p className="text-sm mt-2">
              Run a diagnosis to see detailed check results.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Group checks by category
  const groupedChecks = checks.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = [];
    }
    acc[check.category].push(check);
    return acc;
  }, {} as Record<CheckCategory, CheckResult[]>);
  
  return (
    <div className="space-y-4">
      {Object.entries(groupedChecks).map(([category, categoryChecks]) => {
        const categoryConfig = CATEGORY_CONFIG[category as CheckCategory];
        const CategoryIcon = categoryConfig.icon;
        
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CategoryIcon className={cn('h-5 w-5', categoryConfig.color)} />
                <span>{categoryConfig.label}</span>
                <Badge variant="secondary" className="ml-auto">
                  {categoryChecks.length} checks
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryChecks.map((check, index) => {
                  const statusConfig = STATUS_CONFIG[check.status];
                  const StatusIcon = statusConfig.icon;
                  const riskConfig = RISK_LEVEL_CONFIG[check.severity];
                  
                  return (
                    <div 
                      key={index}
                      className={cn(
                        'p-4 rounded-lg border',
                        statusConfig.bgColor
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <StatusIcon className={cn('h-5 w-5 mt-0.5', statusConfig.color)} />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{check.checkName}</span>
                              <Badge variant="outline" className={riskConfig.color}>
                                {riskConfig.label} Risk
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {check.message}
                            </p>
                            {check.suggestedFix && (
                              <div className="text-sm bg-white/50 p-2 rounded border">
                                <span className="font-medium">Suggested Fix:</span> {check.suggestedFix}
                              </div>
                            )}
                            {Object.keys(check.details).length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  View Details
                                </summary>
                                <pre className="mt-2 p-2 bg-white/50 rounded overflow-x-auto">
                                  {JSON.stringify(check.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {check.executionTime}ms
                          </span>
                          {/* Show Fix button for FAIL or WARN checks that have a mapped action */}
                          {applicationId && 
                           (check.status === CheckStatus.FAIL || check.status === CheckStatus.WARN) && 
                           CHECK_TO_ACTION_MAP[check.checkName] && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFix(check.checkName)}
                              disabled={healingCheck === check.checkName}
                              className="whitespace-nowrap"
                            >
                              <Wrench className={cn(
                                'h-3 w-3 mr-1',
                                healingCheck === check.checkName && 'animate-spin'
                              )} />
                              {healingCheck === check.checkName ? 'Fixing...' : 'Fix'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
