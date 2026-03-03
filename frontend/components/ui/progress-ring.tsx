import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  color?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  className,
  children,
  color = 'hsl(var(--primary))'
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-20"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

interface HealthScoreRingProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

export function HealthScoreRing({ score, size = 120, showLabel = true }: HealthScoreRingProps) {
  const getColor = (score: number) => {
    if (score >= 90) return '#10b981'; // green-500
    if (score >= 70) return '#f59e0b'; // amber-500
    if (score >= 50) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
  };

  const getGradient = (score: number) => {
    if (score >= 90) return 'from-green-500 to-green-600';
    if (score >= 70) return 'from-amber-500 to-amber-600';
    if (score >= 50) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <ProgressRing
      progress={score}
      size={size}
      color={getColor(score)}
      className="drop-shadow-sm"
    >
      <div className="text-center">
        <div className={`text-2xl font-bold bg-gradient-to-r ${getGradient(score)} bg-clip-text text-transparent`}>
          {score}%
        </div>
        {showLabel && (
          <div className="text-xs text-muted-foreground font-medium">Health</div>
        )}
      </div>
    </ProgressRing>
  );
}