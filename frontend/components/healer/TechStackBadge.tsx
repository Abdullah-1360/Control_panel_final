/**
 * Tech Stack Badge Component
 * 
 * Displays tech stack with icon and "Coming Soon" indicator
 */

import { Badge } from '@/components/ui/badge';
import { getTechStackInfo } from '@/lib/tech-stacks';
import { TechStack } from '@/types/healer';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface TechStackBadgeProps {
  techStack: TechStack;
  showComingSoon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TechStackBadge({ 
  techStack, 
  showComingSoon = true,
  size = 'md',
  className 
}: TechStackBadgeProps) {
  const info = getTechStackInfo(techStack);
  
  // Fallback for unknown tech stacks
  if (!info) {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          'flex items-center gap-1.5',
          sizeClasses[size],
          className
        )}
      >
        <Icons.HelpCircle className={iconSizes[size]} />
        <span>{techStack}</span>
      </Badge>
    );
  }
  
  const Icon = (Icons as any)[info.icon] || Icons.HelpCircle;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };
  
  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="secondary" 
        className={cn(
          'flex items-center gap-1.5',
          sizeClasses[size],
          className
        )}
      >
        <Icon className={iconSizes[size]} />
        <span>{info.label}</span>
      </Badge>
      
      {showComingSoon && info.comingSoon && (
        <Badge variant="outline" className="text-xs">
          Coming Soon
        </Badge>
      )}
    </div>
  );
}
