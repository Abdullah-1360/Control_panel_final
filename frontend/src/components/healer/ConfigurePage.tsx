/**
 * Configure Page Component
 * 
 * Page for configuring application healing settings
 */

'use client';

import { useState } from 'react';
import { Application } from '@/lib/api/healer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HealingModeSelector } from './HealingModeSelector';
import { 
  Settings, 
  Save,
  Shield,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUpdateApplication } from '@/hooks/use-healer';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConfigurePageProps {
  application: Application;
  onBack?: () => void;
  onSaved?: (updated: Application) => void;
}

type HealingMode = 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';

export function ConfigurePage({ 
  application, 
  onBack,
  onSaved 
}: ConfigurePageProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateApplication();
  
  const [isHealerEnabled, setIsHealerEnabled] = useState(application.isHealerEnabled);
  const [healingMode, setHealingMode] = useState<HealingMode>(application.healingMode);
  const [maxHealingAttempts, setMaxHealingAttempts] = useState(3);
  const [healingCooldown, setHealingCooldown] = useState(15);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateMutation.mutateAsync({
        id: application.id,
        data: {
          isHealerEnabled,
          healingMode,
          maxHealingAttempts,
          healingCooldown,
        },
      });
      
      toast({
        title: 'Settings Saved',
        description: 'Healing configuration updated successfully',
      });
      
      if (onSaved) {
        onSaved(updated);
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to update configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = 
    isHealerEnabled !== application.isHealerEnabled ||
    healingMode !== application.healingMode;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Healing Configuration</h2>
          <p className="text-muted-foreground mt-1">
            {application.domain} - {application.path}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Warning Alert */}
      {isHealerEnabled && healingMode === 'FULL_AUTO' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Full Auto mode will automatically heal LOW and MEDIUM risk issues without approval. 
            Make sure you understand the implications before enabling this mode.
          </AlertDescription>
        </Alert>
      )}

      {/* Healer Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Healer Status
          </CardTitle>
          <CardDescription>
            Enable or disable the Universal Healer for this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="healer-enabled" className="text-base">
                Enable Universal Healer
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically monitor and heal issues based on the selected healing mode
              </p>
            </div>
            <Switch
              id="healer-enabled"
              checked={isHealerEnabled}
              onCheckedChange={setIsHealerEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Healing Mode Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Healing Mode
          </CardTitle>
          <CardDescription>
            Configure how the healer should respond to detected issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <HealingModeSelector
            value={healingMode}
            onChange={setHealingMode}
            disabled={!isHealerEnabled}
          />

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p><strong>Manual:</strong> All healing actions require manual approval</p>
                <p><strong>Semi-Auto:</strong> Auto-heal LOW risk issues only. MEDIUM/HIGH require approval.</p>
                <p><strong>Full Auto:</strong> Auto-heal LOW and MEDIUM risk issues. HIGH requires approval.</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Advanced Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>
            Configure healing behavior and limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="max-attempts">
              Maximum Healing Attempts
            </Label>
            <Input
              id="max-attempts"
              type="number"
              min="1"
              max="10"
              value={maxHealingAttempts}
              onChange={(e) => setMaxHealingAttempts(parseInt(e.target.value) || 3)}
              disabled={!isHealerEnabled}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of times the healer will attempt to fix an issue before escalating (1-10)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cooldown">
              Healing Cooldown (minutes)
            </Label>
            <Input
              id="cooldown"
              type="number"
              min="5"
              max="1440"
              value={healingCooldown}
              onChange={(e) => setHealingCooldown(parseInt(e.target.value) || 15)}
              disabled={!isHealerEnabled}
            />
            <p className="text-sm text-muted-foreground">
              Minimum time to wait between healing attempts for the same issue (5-1440 minutes)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Blacklist Card (Placeholder for future) */}
      <Card>
        <CardHeader>
          <CardTitle>Blacklisted Plugins/Themes</CardTitle>
          <CardDescription>
            Plugins and themes that should never be automatically modified
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Blacklist configuration will be available in a future update. 
              Currently, the healer will not modify any plugins or themes automatically.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasChanges}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
