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
import { DiscoveryProgressTracker } from './DiscoveryProgressTracker';
import { useDiscoverApplications } from '@/hooks/use-healer';
import { Loader2, Search } from 'lucide-react';
import { TECH_STACKS } from '@/lib/tech-stacks';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [serverId, setServerId] = useState<string>('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [selectedTechStacks, setSelectedTechStacks] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);

  const discoverMutation = useDiscoverApplications();

  const handleDiscover = async () => {
    if (!serverId) return;

    setIsDiscovering(true);

    try {
      // Use the new queued discovery endpoint
      const result = await apiClient.enqueueDiscovery(serverId, {
        forceRediscover: false,
        techStacks: !autoDetect && selectedTechStacks.length > 0 ? selectedTechStacks : undefined,
      });

      setDiscoveryJobId(result.jobId);

      toast({
        title: 'Discovery Started',
        description: result.message || 'Application discovery has been queued',
      });
    } catch (error: any) {
      toast({
        title: 'Discovery Failed',
        description: error.message || 'Failed to start discovery',
        variant: 'destructive',
      });
      setIsDiscovering(false);
    }
  };

  const handleComplete = () => {
    // Reset state
    setServerId('');
    setAutoDetect(true);
    setSelectedTechStacks([]);
    setIsDiscovering(false);
    setDiscoveryJobId(null);
    
    toast({
      title: 'Discovery Complete',
      description: 'Applications have been discovered successfully',
    });
    
    onClose();
  };

  const handleCancel = () => {
    setServerId('');
    setAutoDetect(true);
    setSelectedTechStacks([]);
    setIsDiscovering(false);
    setDiscoveryJobId(null);
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
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Discover Applications</DialogTitle>
          <DialogDescription>
            {isDiscovering 
              ? 'Discovery in progress - tracking job status'
              : 'Scan a server to automatically detect applications and their tech stacks'
            }
          </DialogDescription>
        </DialogHeader>

        {isDiscovering && discoveryJobId ? (
          <div className="py-4">
            <DiscoveryProgressTracker 
              jobId={discoveryJobId} 
              onComplete={handleComplete}
            />
          </div>
        ) : (
          <>
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
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleDiscover}
                disabled={!serverId}
              >
                <Search className="mr-2 h-4 w-4" />
                Start Discovery
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
