'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, Server } from 'lucide-react';
import { toast } from 'sonner';

interface DiscoverSitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: Array<{
    id: string;
    name: string;
    host: string;
  }>;
}

export function DiscoverSitesModal({ isOpen, onClose, servers }: DiscoverSitesModalProps) {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const queryClient = useQueryClient();

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const discoverMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const response = await fetch('http://localhost:3001/api/v1/healer/discover', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ serverId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to discover sites' }));
        throw new Error(error.message || 'Failed to discover sites');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const sitesFound = data.data?.sitesFound || data.sitesFound || 0;
      toast.success(`Found ${sitesFound} WordPress sites!`);
      queryClient.invalidateQueries({ queryKey: ['healer-sites'] });
      handleClose();
    },
    onError: (error: any) => {
      toast.error(`Discovery failed: ${error.message}`);
    },
  });

  const handleDiscover = () => {
    if (!selectedServer) {
      toast.error('Please select a server');
      return;
    }
    discoverMutation.mutate(selectedServer);
  };

  const handleClose = () => {
    setSelectedServer('');
    discoverMutation.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discover WordPress Sites</DialogTitle>
          <DialogDescription>
            Select a server to scan for WordPress installations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {servers.length === 0 ? (
            <Alert>
              <Server className="h-4 w-4" />
              <AlertDescription>
                No servers available. Please add a server first.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Server</label>
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger>
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

              {discoverMutation.isPending && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Scanning server for WordPress sites... This may take a few minutes.
                  </AlertDescription>
                </Alert>
              )}

              {discoverMutation.isSuccess && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600">
                    Found {discoverMutation.data?.sitesFound} WordPress sites!
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleDiscover}
            disabled={!selectedServer || discoverMutation.isPending || servers.length === 0}
          >
            {discoverMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Discovering...
              </>
            ) : (
              'Discover Sites'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
