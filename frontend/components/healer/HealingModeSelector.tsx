/**
 * Healing Mode Selector Component
 * 
 * Allows selection of healing mode with descriptions
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HealingMode } from '@/types/healer';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HealingModeSelectorProps {
  value: HealingMode;
  onChange: (mode: HealingMode) => void;
  disabled?: boolean;
}

const HEALING_MODE_INFO = {
  [HealingMode.MANUAL]: {
    label: 'Manual',
    description: 'All healing actions require manual approval',
    color: 'text-blue-600',
  },
  [HealingMode.SEMI_AUTO]: {
    label: 'Semi-Auto (Supervised)',
    description: 'Auto-heal LOW risk issues only. MEDIUM/HIGH require approval.',
    color: 'text-yellow-600',
  },
  [HealingMode.FULL_AUTO]: {
    label: 'Full Auto',
    description: 'Auto-heal LOW and MEDIUM risk issues. HIGH requires approval.',
    color: 'text-green-600',
  },
};

export function HealingModeSelector({ 
  value, 
  onChange, 
  disabled 
}: HealingModeSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Healing Mode</label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-2">
                <p className="font-semibold">Healing Modes:</p>
                {Object.entries(HEALING_MODE_INFO).map(([mode, info]) => (
                  <div key={mode} className="text-xs">
                    <span className={info.color}>{info.label}:</span> {info.description}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Select 
        value={value} 
        onValueChange={(val) => onChange(val as HealingMode)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(HEALING_MODE_INFO).map(([mode, info]) => (
            <SelectItem key={mode} value={mode}>
              <div className="flex flex-col items-start">
                <span className={info.color}>{info.label}</span>
                <span className="text-xs text-muted-foreground">
                  {info.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
