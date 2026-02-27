import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TechStackBadge } from './TechStackBadge';
import { useDiscoverApplications } from '@/hooks/use-healer';
import { Loader2, Search } from 'lucide-react';
import { TECH_STACKS } from '@/lib/tech-stacks';

interface DiscoverApplicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: Array<{ id: string; name: string; host: string }>;
}

export function DiscoverApplicationsModal({
  isOpen,
  onClose,
  servers,
}: DiscoverApplicationsModalProps) {
  const [serverId, setServerId] = useState<string>('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [selectedTechStacks, setSelectedTechStacks] = useState<string[]>([]);

  const discoverMutation = useDiscoverApplications();

  const handleDiscover = async () => {
    if (!serverId) return;

    // Build payload - only include fields that backend expects
    const payload: any = {
      serverId,
    };
    
    // If specific tech stacks selected, include them
    // Otherwise backend will auto-detect all tech stacks
    if (!autoDetect && selectedTechStacks.length > 0) {
      payload.techStacks = selectedTechStacks;
    }

    await discoverMutation.mutateAsync(payload);

    // Reset and close
    setServerId('');
    setAutoDetect(true);
    setSelectedTechStacks([]);
    onClose();
  };

  const toggleTechStack = (techStack: string) => {
    setSelectedTechStacks((prev) =>
      prev.includes(techStack)
        ? prev.filter((ts) => ts !== techStack)
        : [...prev, techStack],
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Discover Applications</DialogTitle>
          <DialogDescription>
            Scan a server to automatically detect applications and their tech stacks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Server Selection */}
          <div className="space-y-2">
            <Label htmlFor="server">Server</Label>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger id="server">
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {servers.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.name} ({server.host})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-Detect Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-detect"
              checked={autoDetect}
              onCheckedChange={(checked) => setAutoDetect(checked as boolean)}
            />
            <Label
              htmlFor="auto-detect"
              className="text-sm font-normal cursor-pointer"
            >
              Auto-detect all tech stacks
            </Label>
          </div>

          {/* Tech Stack Selection */}
          {!autoDetect && (
            <div className="space-y-3">
              <Label>Select Tech Stacks to Discover</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TECH_STACKS).map(([key, config]) => (
                  <div
                    key={key}
                    className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTechStacks.includes(key)
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    } ${!config.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => config.available && toggleTechStack(key)}
                  >
                    <Checkbox
                      id={`tech-${key}`}
                      checked={selectedTechStacks.includes(key)}
                      disabled={!config.available}
                      onCheckedChange={() => config.available && toggleTechStack(key)}
                    />
                    <Label
                      htmlFor={`tech-${key}`}
                      className="flex-1 cursor-pointer"
                    >
                      <TechStackBadge techStack={key as any} />
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only WordPress is currently available. Other tech stacks coming soon.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={discoverMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleDiscover}
            disabled={!serverId || discoverMutation.isPending}
          >
            {discoverMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Discover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
