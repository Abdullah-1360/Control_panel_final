'use client';

import { useState } from 'react';
import { useApplications, useDeleteApplication } from '@/hooks/use-healer';
import { useServers } from '@/hooks/use-servers';
import { Search, Plus, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApplicationList } from '@/components/healer/ApplicationList';
import { DiscoverApplicationsModal } from '@/components/healer/DiscoverApplicationsModal';
import { TECH_STACKS } from '@/lib/tech-stacks';
import { useRouter } from 'next/navigation';

export default function HealerPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [techStackFilter, setTechStackFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);

  // Fetch applications with filters
  const { data: applicationsData, isLoading } = useApplications({
    page,
    limit: 50,
    search: searchQuery || undefined,
    techStack: techStackFilter !== 'all' ? techStackFilter : undefined,
    healthStatus: healthFilter !== 'all' ? healthFilter : undefined,
  });

  // Fetch servers for discover modal
  const { data: serversData } = useServers();

  // Delete mutation
  const deleteMutation = useDeleteApplication();

  const handleDiagnose = (id: string, techStack: string) => {
    // Route WordPress applications to the old WordPress healer
    if (techStack === 'WORDPRESS') {
      router.push(`/healer/sites/${id}`);
    } else {
      router.push(`/healer/applications/${id}/diagnose`);
    }
  };

  const handleConfigure = (id: string, techStack: string) => {
    // Route WordPress applications to the old WordPress healer
    if (techStack === 'WORDPRESS') {
      router.push(`/healer/sites/${id}`);
    } else {
      router.push(`/healer/applications/${id}/configure`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this application?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Universal Healer</h1>
          <p className="text-muted-foreground">
            Monitor and automatically fix issues across all your applications
          </p>
        </div>
        <Button onClick={() => setIsDiscoverModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Discover Applications
        </Button>
      </div>

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
        <Select value={techStackFilter} onValueChange={setTechStackFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by tech stack" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tech Stacks</SelectItem>
            {Object.entries(TECH_STACKS).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Applications List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading applications...</p>
        </div>
      ) : applicationsData?.data?.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Server className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No applications found</h3>
          <p className="mt-2 text-muted-foreground">
            Click "Discover Applications" to scan your servers for applications
          </p>
          <Button
            onClick={() => setIsDiscoverModalOpen(true)}
            className="mt-4"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Discover Applications
          </Button>
        </div>
      ) : (
        <ApplicationList
          applications={applicationsData?.data || []}
          pagination={applicationsData?.pagination}
          onPageChange={setPage}
          onDiagnose={handleDiagnose}
          onConfigure={handleConfigure}
          onDelete={handleDelete}
        />
      )}

      {/* Discover Applications Modal */}
      <DiscoverApplicationsModal
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
        servers={serversData?.data || []}
      />
    </div>
  );
}
