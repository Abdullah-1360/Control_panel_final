/**
 * Subdomain Configuration Modal
 * 
 * Allows configuring subdomain-specific settings:
 * - Tech stack override
 * - Healing mode
 * - Auto-healer settings
 * - Health check intervals
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';

interface SubdomainConfigModalProps {
  open: boolean;
  onClose: () => void;
  subdomain: string;
  currentConfig: {
    techStack?: string;
    isHealerEnabled?: boolean;
    healingMode?: string;
    healthScore?: number;
    healthStatus?: string;
  };
  onSave: (config: any) => Promise<void>;
}

const TECH_STACKS = [
  { value: 'WORDPRESS', label: 'WordPress' },
  { value: 'LARAVEL', label: 'Laravel' },
  { value: 'NODEJS', label: 'Node.js' },
  { value: 'NEXTJS', label: 'Next.js' },
  { value: 'EXPRESS', label: 'Express' },
  { value: 'PHP_GENERIC', label: 'PHP (Generic)' },
];

const HEALING_MODES = [
  { value: 'MANUAL', label: 'Manual', description: 'Require approval for all healing actions' },
  { value: 'SEMI_AUTO', label: 'Semi-Auto', description: 'Auto-heal safe issues, require approval for risky ones' },
  { value: 'FULL_AUTO', label: 'Full-Auto', description: 'Automatically heal all detected issues' },
];

export function SubdomainConfigModal({
  open,
  onClose,
  subdomain,
  currentConfig,
  onSave,
}: SubdomainConfigModalProps) {
  const [techStack, setTechStack] = useState(currentConfig.techStack || 'PHP_GENERIC');
  const [isHealerEnabled, setIsHealerEnabled] = useState(currentConfig.isHealerEnabled || false);
  const [healingMode, setHealingMode] = useState(currentConfig.healingMode || 'MANUAL');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        techStack,
        isHealerEnabled,
        healingMode,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure {subdomain}</DialogTitle>
          <DialogDescription>
            Customize healing and monitoring settings for this domain
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tech Stack */}
          <div className="space-y-2">
            <Label htmlFor="techStack">Tech Stack</Label>
            <Select value={techStack} onValueChange={setTechStack}>
              <SelectTrigger id="techStack">
                <SelectValue placeholder="Select tech stack" />
              </SelectTrigger>
              <SelectContent>
                {TECH_STACKS.map((stack) => (
                  <SelectItem key={stack.value} value={stack.value}>
                    {stack.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Override the detected tech stack if incorrect
            </p>
          </div>

          {/* Auto Healer Toggle */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="healer-enabled">Auto Healer</Label>
              <p className="text-sm text-muted-foreground">
                Enable automatic healing for this domain
              </p>
            </div>
            <Switch
              id="healer-enabled"
              checked={isHealerEnabled}
              onCheckedChange={setIsHealerEnabled}
            />
          </div>

          {/* Healing Mode */}
          {isHealerEnabled && (
            <div className="space-y-2">
              <Label htmlFor="healingMode">Healing Mode</Label>
              <Select value={healingMode} onValueChange={setHealingMode}>
                <SelectTrigger id="healingMode">
                  <SelectValue placeholder="Select healing mode" />
                </SelectTrigger>
                <SelectContent>
                  {HEALING_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div>
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {mode.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current Status */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm font-medium">Current Status</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Health Score:</span>
                <span className="ml-2 font-medium">
                  {currentConfig.healthScore !== undefined ? `${currentConfig.healthScore}%` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium">
                  {currentConfig.healthStatus || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
