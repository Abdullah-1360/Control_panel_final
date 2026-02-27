'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Server, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SiteList } from './SiteList';
import { SiteDetailView } from './SiteDetailView';
import { DiscoverSitesModal } from './DiscoverSitesModal';

type HealerView = 'list' | 'detail';

interface HealerViewProps {
  onBack?: () => void;
}

export function HealerView({ onBack }: HealerViewProps) {
  const [currentView, setCurrentView] = useState<HealerView>('list');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);

  // Helper to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Fetch WordPress sites
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['healer-sites', page, searchQuery, healthFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (healthFilter && healthFilter !== 'all') {
        params.append('healthStatus', healthFilter);
      }

      const response = await fetch(
        `http://localhost:3001/api/v1/healer/sites?${params}`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sites');
      }

      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch servers for discovery modal
  const { data: serversData } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/api/v1/servers?page=1&limit=100', {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }

      return response.json();
    },
  });

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedSiteId(null);
  };

  // Render detail view
  if (currentView === 'detail' && selectedSiteId) {
    return <SiteDetailView siteId={selectedSiteId} onBack={handleBackToList} />;
  }

  // Render list view
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WP Auto-Healer</h1>
          <p className="text-muted-foreground">
            Monitor and automatically fix issues across all your WordPress sites
          </p>
        </div>
        <Button onClick={() => setIsDiscoverModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Discover Sites
        </Button>
      </div>

      {/* Phase 3 Coming Soon Banner */}
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Currently showing WordPress sites. Support for Node.js, PHP, Laravel, 
          Next.js, and Express coming in Phase 3! Universal Healer with multi-tech-stack 
          support is under development.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="HEALTHY">Healthy</SelectItem>
            <SelectItem value="DEGRADED">Degraded</SelectItem>
            <SelectItem value="DOWN">Down</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="HEALING">Healing</SelectItem>
            <SelectItem value="UNKNOWN">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sites List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading sites...</p>
        </div>
      ) : sitesData?.data?.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Server className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No WordPress sites found</h3>
          <p className="mt-2 text-muted-foreground">
            Click "Discover Sites" to scan your servers for WordPress installations
          </p>
          <Button
            onClick={() => setIsDiscoverModalOpen(true)}
            className="mt-4"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Discover Sites
          </Button>
        </div>
      ) : (
        <SiteList
          sites={sitesData?.data || []}
          pagination={sitesData?.pagination}
          onPageChange={setPage}
          onSelectSite={handleSelectSite}
        />
      )}

      {/* Discover Sites Modal */}
      <DiscoverSitesModal
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
        servers={serversData?.data || []}
      />
    </div>
  );
}
