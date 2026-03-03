/**
 * Diagnostic Check List Component
 * 
 * Displays diagnostic check results with categories and risk levels
 */

import { Badge } from '@/components/ui/badge';
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
  Server
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagnosticCheckListProps {
  checks: CheckResult[];
  showPlaceholder?: boolean;
}

const STATUS_CONFIG = {
  [CheckStatus.PASS]: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-950/30 border-green-800/50',
    label: 'Pass',
  },
  [CheckStatus.WARN]: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950/30 border-yellow-800/50',
    label: 'Warning',
  },
  [CheckStatus.FAIL]: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-950/30 border-red-800/50',
    label: 'Fail',
  },
  [CheckStatus.ERROR]: {
    icon: AlertCircle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/30 border-orange-800/50',
    label: 'Error',
  },
  [CheckStatus.SKIPPED]: {
    icon: MinusCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-900/30 border-gray-700/50',
    label: 'Skipped',
  },
  // Add aliases for common variations
  'WARNING': {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950/30 border-yellow-800/50',
    label: 'Warning',
  },
};

const CATEGORY_CONFIG = {
  [CheckCategory.SYSTEM]: {
    icon: Server,
    label: 'System',
    color: 'text-blue-400',
  },
  [CheckCategory.SECURITY]: {
    icon: Shield,
    label: 'Security',
    color: 'text-red-400',
  },
  [CheckCategory.PERFORMANCE]: {
    icon: Zap,
    label: 'Performance',
    color: 'text-yellow-400',
  },
  [CheckCategory.AVAILABILITY]: {
    icon: Activity,
    label: 'Availability',
    color: 'text-green-400',
  },
  [CheckCategory.CONFIGURATION]: {
    icon: Settings,
    label: 'Configuration',
    color: 'text-purple-400',
  },
  // Add common variations and fallbacks
  'DATABASE': {
    icon: Server,
    label: 'Database',
    color: 'text-indigo-400',
  },
  'APPLICATION': {
    icon: Activity,
    label: 'Application',
    color: 'text-cyan-400',
  },
  'DEPENDENCIES': {
    icon: Settings,
    label: 'Dependencies',
    color: 'text-orange-400',
  },
  'MAINTENANCE': {
    icon: Settings,
    label: 'Maintenance',
    color: 'text-purple-400',
  },
  'undefined': {
    icon: Server,
    label: 'General',
    color: 'text-gray-400',
  },
};

const RISK_LEVEL_CONFIG = {
  [RiskLevel.LOW]: {
    label: 'Low',
    color: 'bg-green-900/50 text-green-300 border-green-700',
  },
  [RiskLevel.MEDIUM]: {
    label: 'Medium',
    color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  },
  [RiskLevel.HIGH]: {
    label: 'High',
    color: 'bg-orange-900/50 text-orange-300 border-orange-700',
  },
  [RiskLevel.CRITICAL]: {
    label: 'Critical',
    color: 'bg-red-900/50 text-red-300 border-red-700',
  },
};

export function DiagnosticCheckList({ checks, showPlaceholder }: DiagnosticCheckListProps) {
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
        const categoryConfig = CATEGORY_CONFIG[category as CheckCategory] || {
          icon: Server,
          label: category,
          color: 'text-gray-600',
        };
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
                  // Normalize status (handle WARNING -> WARN)
                  const normalizedStatus = check.status === 'WARNING' ? 'WARN' : check.status;
                  
                  const statusConfig = STATUS_CONFIG[normalizedStatus] || {
                    icon: AlertCircle,
                    color: 'text-gray-500',
                    bgColor: 'bg-gray-50',
                    label: check.status,
                  };
                  const StatusIcon = statusConfig.icon;
                  const riskConfig = RISK_LEVEL_CONFIG[check.severity] || {
                    label: check.severity || 'Unknown',
                    color: 'bg-gray-100 text-gray-800',
                  };
                  
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
                              <div className="text-sm bg-blue-950/30 border border-blue-800/50 p-2 rounded">
                                <span className="font-medium text-blue-400">Suggested Fix:</span>{' '}
                                <span className="text-blue-300">{check.suggestedFix}</span>
                              </div>
                            )}
                            {Object.keys(check.details).length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  View Details
                                </summary>
                                <pre className="mt-2 p-2 bg-gray-950/50 border border-gray-800/50 rounded overflow-x-auto text-gray-300">
                                  {JSON.stringify(check.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {check.executionTime}ms
                        </span>
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
