'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiteListWithSubdomains } from '@/components/healer/SiteListWithSubdomains';
import { DiscoverSitesModal } from '@/components/healer/DiscoverSitesModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus } from 'lucide-react';

export default function HealerPage() {
  const [search, setSearch] = useState('');
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['healer-sites', { search, healthStatus, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (search) params.append('search', search);
      if (healthStatus) params.append('healthStatus', healthStatus);

      const response = await fetch(`http://localhost:3001/api/v1/healer/sites?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sites');
      }

      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds for health status updates
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WordPress Auto-Healer</h1>
          <p className="text-muted-foreground">
            Monitor and heal WordPress sites automatically
          </p>
        </div>
        <Button onClick={() => setIsDiscoverModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Discover Sites
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={healthStatus} onValueChange={setHealthStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Health Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="HEALTHY">Healthy</SelectItem>
            <SelectItem value="DEGRADED">Degraded</SelectItem>
            <SelectItem value="DOWN">Down</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="HEALING">Healing</SelectItem>
            <SelectItem value="UNKNOWN">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Site List with Subdomain Hierarchy */}
      <SiteListWithSubdomains
        data={data}
        isLoading={isLoading}
        error={error}
        page={page}
        onPageChange={setPage}
      />

      {/* Discover Sites Modal */}
      <DiscoverSitesModal
        open={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
      />
    </div>
  );
}
