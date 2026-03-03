import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { Card, CardContent } from './card';

interface StatusCardProps {
  title: string;
  value: string | number;
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
}

export function StatusCard({
  title,
  value,
  status,
  icon,
  description,
  trend,
  className
}: StatusCardProps) {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-green-500/10 to-green-600/10',
          border: 'border-green-500/20',
          iconBg: 'bg-green-500/20',
          iconColor: 'text-green-600',
          valueColor: 'text-green-600'
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-yellow-500/10 to-yellow-600/10',
          border: 'border-yellow-500/20',
          iconBg: 'bg-yellow-500/20',
          iconColor: 'text-yellow-600',
          valueColor: 'text-yellow-600'
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-500/10 to-red-600/10',
          border: 'border-red-500/20',
          iconBg: 'bg-red-500/20',
          iconColor: 'text-red-600',
          valueColor: 'text-red-600'
        };
      case 'info':
        return {
          bg: 'bg-gradient-to-r from-blue-500/10 to-blue-600/10',
          border: 'border-blue-500/20',
          iconBg: 'bg-blue-500/20',
          iconColor: 'text-blue-600',
          valueColor: 'text-blue-600'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-muted/50 to-muted/30',
          border: 'border-border',
          iconBg: 'bg-muted',
          iconColor: 'text-muted-foreground',
          valueColor: 'text-foreground'
        };
    }
  };

  const styles = getStatusStyles(status);

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md hover:scale-105',
      styles.bg,
      styles.border,
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              {icon && (
                <div className={cn('p-2 rounded-lg', styles.iconBg)}>
                  <div className={styles.iconColor}>
                    {icon}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className={cn('text-2xl font-bold', styles.valueColor)}>{value}</p>
              </div>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {trend && (
            <div className="text-right">
              <div className={cn(
                'flex items-center space-x-1 text-xs',
                trend.direction === 'up' ? 'text-green-600' :
                trend.direction === 'down' ? 'text-red-600' : 'text-muted-foreground'
              )}>
                <span>{trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'}</span>
                <span>{trend.value}%</span>
              </div>
              <p className="text-xs text-muted-foreground">{trend.label}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DiagnosisResultCardProps {
  check: {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
    message?: string;
    details?: any;
    duration?: number;
  };
  className?: string;
}

export function DiagnosisResultCard({ check, className }: DiagnosisResultCardProps) {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PASS':
        return {
          icon: '✅',
          color: 'text-green-600',
          bg: 'bg-green-500/10',
          border: 'border-green-500/20'
        };
      case 'FAIL':
        return {
          icon: '❌',
          color: 'text-red-600',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20'
        };
      case 'WARNING':
        return {
          icon: '⚠️',
          color: 'text-yellow-600',
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/20'
        };
      case 'SKIP':
        return {
          icon: '⏭️',
          color: 'text-muted-foreground',
          bg: 'bg-muted/10',
          border: 'border-muted/20'
        };
      default:
        return {
          icon: '❓',
          color: 'text-muted-foreground',
          bg: 'bg-muted/10',
          border: 'border-muted/20'
        };
    }
  };

  const statusInfo = getStatusInfo(check.status);

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-sm',
      statusInfo.bg,
      statusInfo.border,
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="text-lg">{statusInfo.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm truncate">{check.name}</h4>
              <Badge variant="outline" className={cn('text-xs', statusInfo.color)}>
                {check.status}
              </Badge>
            </div>
            {check.message && (
              <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
            )}
            {check.duration && (
              <p className="text-xs text-muted-foreground mt-1">
                Completed in {check.duration}ms
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}