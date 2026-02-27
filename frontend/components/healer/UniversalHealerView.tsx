/**
 * Universal Healer View - State-Based Routing
 * 
 * Combines WordPress sites and multi-tech-stack applications
 * Uses state-based routing (no URL navigation)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useApplications, useDeleteApplication } from '@/hooks/use-healer';
import { useServers } from '@/hooks/use-servers';
import { Search, Plus, Server, ArrowLeft, CheckCircle, AlertCircle, Shield, Grid, List as ListIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApplicationList } from '@/components/healer/ApplicationList';
import { ApplicationDetailView } from '@/components/healer/ApplicationDetailView-v2';
import { DiagnosePage } from '@/components/healer/DiagnosePage';
import { ConfigurePage } from '@/components/healer/ConfigurePage';
import { SubdomainConfigModal } from '@/components/healer/SubdomainConfigModal';
import { DiscoverApplicationsModal } from '@/components/healer/DiscoverApplicationsModal';
import { TECH_STACKS } from '@/lib/tech-stacks';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { healerApi } from '@/lib/api/healer';
import { useApplication, useDiagnoseApplication, useUpdateApplication } from '@/hooks/use-healer';
import { cn } from '@/lib/utils';

type View = 'list' | 'detail';
type DetailTab = 'overview' | 'diagnostics' | 'configure';

export function UniversalHealerView() {
  const { toast } = useToast();
  
  // View state
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  
  // List view state
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [techStackFilter, setTechStackFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Detail view state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedSubdomain, setSelectedSubdomain] = useState<string | null>(null);
  const [subdomainConfig, setSubdomainConfig] = useState<any>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fix hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Cmd/Ctrl + N: New discovery
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsDiscoverModalOpen(true);
      }
      
      // Escape: Close modals or go back
      if (e.key === 'Escape') {
        if (currentView === 'detail') {
          handleBackToList();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentView]);

  // Fetch applications list
  const { data: applicationsData, isLoading, refetch: refetchList } = useApplications({
    page,
    limit: 50,
    search: searchQuery || undefined,
    techStack: techStackFilter !== 'all' ? techStackFilter : undefined,
    healthStatus: healthFilter !== 'all' ? healthFilter : undefined,
  });

  // Fetch selected application details
  const { data: selectedApplication, refetch: refetchDetail } = useApplication(
    selectedApplicationId || '',
    { enabled: !!selectedApplicationId }
  );

  // Fetch servers for discover modal
  const { data: serversData } = useServers();

  // Mutations
  const deleteMutation = useDeleteApplication();
  const diagnoseMutation = useDiagnoseApplication();
  const updateMutation = useUpdateApplication();

  // Auto-detect tech stack when detail view loads if tech stack is UNKNOWN
  useEffect(() => {
    if (currentView !== 'detail' || !selectedApplication) return;
    
    const detectTechStackIfNeeded = async () => {
      // Check if main application or any subdomain has UNKNOWN tech stack
      const needsDetection = selectedApplication.techStack === 'UNKNOWN';
      const metadata = (selectedApplication.metadata as any) || {};
      const subdomains = metadata.availableSubdomains || [];
      const hasUnknownSubdomains = subdomains.some((s: any) => s.techStack === 'UNKNOWN' || !s.techStack);
      
      if (!needsDetection && !hasUnknownSubdomains) {
        return;
      }
      
      try {
        // Step 1: Collect metadata first if subdomains array is empty
        if (subdomains.length === 0) {
          toast({
            title: 'Preparing Detection',
            description: 'Collecting application metadata...',
          });
          
          await apiClient.post(`/healer/applications/${selectedApplicationId}/collect-metadata`, {});
          await new Promise(resolve => setTimeout(resolve, 1000));
          await refetchDetail();
        }
        
        // Step 2: Run tech stack detection
        toast({
          title: 'Detecting Tech Stacks',
          description: 'Analyzing application and all domains...',
        });
        
        const result = await healerApi.detectAllTechStacks(selectedApplicationId!);
        
        await refetchDetail();
        
        toast({
          title: 'Tech Stack Detection Complete',
          description: `Main: ${result.main.techStack}, Subdomains: ${result.subdomains.length} detected`,
        });
      } catch (error: any) {
        console.error('Tech stack detection failed:', error);
        toast({
          title: 'Detection Failed',
          description: error.message || 'Failed to detect tech stacks',
          variant: 'destructive',
        });
      }
    };

    detectTechStackIfNeeded();
  }, [currentView, selectedApplication?.id, selectedApplication?.techStack]);

  // Navigation handlers
  const handleSelectApplication = (id: string) => {
    setSelectedApplicationId(id);
    setCurrentView('detail');
    setActiveTab('overview');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedApplicationId(null);
    setActiveTab('overview');
    refetchList();
  };

  // Detail view handlers
  const handleDelete = async () => {
    if (!selectedApplicationId) return;

    try {
      await deleteMutation.mutateAsync(selectedApplicationId);
      toast({
        title: 'Application Deleted',
        description: 'The application has been removed successfully',
      });
      setDeleteDialogOpen(false);
      handleBackToList();
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete application',
        variant: 'destructive',
      });
    }
  };

  const handleDiagnose = async () => {
    if (!selectedApplicationId) return;
    
    try {
      await diagnoseMutation.mutateAsync({ applicationId: selectedApplicationId });
      toast({
        title: 'Diagnosis Started',
        description: 'Running diagnostics on the application',
      });
      setActiveTab('diagnostics');
      await refetchDetail();
    } catch (error: any) {
      toast({
        title: 'Diagnosis Failed',
        description: error.message || 'Failed to run diagnostics',
        variant: 'destructive',
      });
    }
  };

  const handleDiagnoseSubdomain = async (subdomain: string) => {
    if (!selectedApplicationId) return;
    
    try {
      await diagnoseMutation.mutateAsync({ applicationId: selectedApplicationId, subdomain });
      toast({
        title: 'Diagnosis Started',
        description: `Running diagnostics on ${subdomain}`,
      });
      await refetchDetail();
    } catch (error: any) {
      toast({
        title: 'Diagnosis Failed',
        description: error.message || 'Failed to run diagnostics',
        variant: 'destructive',
      });
    }
  };

  const handleToggleHealer = async () => {
    if (!selectedApplication || !selectedApplicationId) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedApplicationId,
        data: { isHealerEnabled: !selectedApplication.isHealerEnabled },
      });
      toast({
        title: selectedApplication.isHealerEnabled ? 'Healer Disabled' : 'Healer Enabled',
        description: `Auto-healing has been ${selectedApplication.isHealerEnabled ? 'disabled' : 'enabled'}`,
      });
      await refetchDetail();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to toggle healer',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSubdomainHealer = async (subdomain: string, enabled: boolean) => {
    if (!selectedApplicationId) return;
    
    try {
      await apiClient.post(`/healer/applications/${selectedApplicationId}/subdomains/${subdomain}/toggle-healer`, {
        enabled,
      });
      toast({
        title: enabled ? 'Healer Enabled' : 'Healer Disabled',
        description: `Auto-healing has been ${enabled ? 'enabled' : 'disabled'} for ${subdomain}`,
      });
      await refetchDetail();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to toggle subdomain healer',
        variant: 'destructive',
      });
    }
  };

  const handleConfigure = () => {
    setActiveTab('configure');
  };

  const handleConfigureSubdomain = (subdomain: string) => {
    if (!selectedApplication) return;
    
    const metadata = (selectedApplication.metadata as any) || {};
    const availableSubdomains = metadata.availableSubdomains || [];
    const subdomainInfo = availableSubdomains.find((s: any) => s.domain === subdomain);
    
    setSelectedSubdomain(subdomain);
    setSubdomainConfig(subdomainInfo || {});
    setConfigModalOpen(true);
  };

  const handleSaveSubdomainConfig = async (config: any) => {
    if (!selectedSubdomain || !selectedApplicationId) return;

    try {
      await apiClient.put(`/healer/applications/${selectedApplicationId}/subdomains/${selectedSubdomain}`, config);
      toast({
        title: 'Configuration Saved',
        description: `Settings updated for ${selectedSubdomain}`,
      });
      await refetchDetail();
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Render list view
  if (currentView === 'list') {
    const totalApps = applicationsData?.pagination?.total || 0;
    const healthyApps = applicationsData?.data?.filter(a => a.healthStatus === 'HEALTHY').length || 0;
    const issueApps = applicationsData?.data?.filter(a => a.healthStatus === 'DOWN' || a.healthStatus === 'DEGRADED').length || 0;
    const protectedApps = applicationsData?.data?.filter(a => a.isHealerEnabled).length || 0;
    const hasActiveFilters = searchQuery || techStackFilter !== 'all' || healthFilter !== 'all';

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Universal Healer</h1>
            <p className="text-muted-foreground">
              Monitor and automatically fix issues across all your applications
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘K</kbd> to search, <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘N</kbd> to discover
            </div>
          </div>
          <Button onClick={() => setIsDiscoverModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Discover Applications
          </Button>
        </div>

        {/* Quick Stats Dashboard */}
        {!isLoading && totalApps > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Apps</p>
                  <p className="text-2xl font-bold">{totalApps}</p>
                </div>
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                  <p className="text-2xl font-bold text-green-600">{healthyApps}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Issues</p>
                  <p className="text-2xl font-bold text-red-600">{issueApps}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Protected</p>
                  <p className="text-2xl font-bold text-blue-600">{protectedApps}</p>
                </div>
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        {isMounted && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search by domain... (⌘K)"
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
                      {config.label}
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
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Active Filters Chips */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {searchQuery}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                {techStackFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Tech: {TECH_STACKS[techStackFilter]?.label}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setTechStackFilter('all')} />
                  </Badge>
                )}
                {healthFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Health: {healthFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setHealthFilter('all')} />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearchQuery('');
                  setTechStackFilter('all');
                  setHealthFilter('all');
                }}>
                  Clear all
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Applications List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : applicationsData?.data?.length === 0 && !hasActiveFilters ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
              <Server className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No applications yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by discovering applications from your servers. 
              We'll automatically detect tech stacks and set up monitoring.
            </p>
            <Button onClick={() => setIsDiscoverModalOpen(true)} size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Discover Your First Application
            </Button>
          </div>
        ) : applicationsData?.data?.length === 0 && hasActiveFilters ? (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No applications match your filters</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria or clearing filters
            </p>
            <Button variant="outline" onClick={() => {
              setSearchQuery('');
              setTechStackFilter('all');
              setHealthFilter('all');
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <ApplicationList
            applications={applicationsData?.data || []}
            pagination={applicationsData?.pagination}
            onPageChange={setPage}
            onViewDetails={handleSelectApplication}
            onDiagnose={handleSelectApplication}
            onConfigure={handleSelectApplication}
            onDelete={async (id) => {
              if (confirm('Are you sure you want to delete this application?')) {
                await deleteMutation.mutateAsync(id);
                refetchList();
              }
            }}
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

  // Render detail view
  if (currentView === 'detail' && selectedApplication) {
    return (
      <div className="p-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={handleBackToList} className="hover:text-foreground transition-colors">
            Universal Healer
          </button>
          <span>/</span>
          <span className="text-foreground">{selectedApplication.domain}</span>
        </div>

        {/* Action Bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
              <h2 className="text-xl font-semibold">{selectedApplication.domain}</h2>
              <Badge className={cn(
                {
                  "bg-green-100 text-green-800": selectedApplication.healthStatus === 'HEALTHY',
                  "bg-yellow-100 text-yellow-800": selectedApplication.healthStatus === 'DEGRADED',
                  "bg-red-100 text-red-800": selectedApplication.healthStatus === 'DOWN',
                  "bg-blue-100 text-blue-800": selectedApplication.healthStatus === 'HEALING',
                  "bg-gray-100 text-gray-800": selectedApplication.healthStatus === 'UNKNOWN',
                }
              )}>
                {selectedApplication.healthStatus}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDiagnose} disabled={diagnoseMutation.isPending}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Run Diagnosis
              </Button>
              <Button variant="outline" size="sm" onClick={handleConfigure}>
                <Server className="h-4 w-4 mr-2" />
                Configure
              </Button>
              <Button 
                variant={selectedApplication.isHealerEnabled ? 'default' : 'outline'} 
                size="sm" 
                onClick={handleToggleHealer}
                disabled={updateMutation.isPending}
              >
                <Shield className="h-4 w-4 mr-2" />
                {selectedApplication.isHealerEnabled ? 'Healer On' : 'Healer Off'}
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <ApplicationDetailView
            application={selectedApplication}
            onDiagnose={handleDiagnose}
            onDiagnoseSubdomain={handleDiagnoseSubdomain}
            onToggleHealer={handleToggleHealer}
            onToggleSubdomainHealer={handleToggleSubdomainHealer}
            onConfigure={handleConfigure}
            onConfigureSubdomain={handleConfigureSubdomain}
            onDelete={() => setDeleteDialogOpen(true)}
            isLoading={deleteMutation.isPending || diagnoseMutation.isPending || updateMutation.isPending}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosePage
            application={selectedApplication}
            onBack={() => setActiveTab('overview')}
          />
        )}

        {activeTab === 'configure' && (
          <ConfigurePage
            application={selectedApplication}
            onBack={() => setActiveTab('overview')}
            onSaved={() => {
              toast({
                title: 'Settings Saved',
                description: 'Configuration updated successfully',
              });
              setActiveTab('overview');
              refetchDetail();
            }}
          />
        )}

        {/* Subdomain Configuration Modal */}
        {selectedSubdomain && (
          <SubdomainConfigModal
            open={configModalOpen}
            onClose={() => {
              setConfigModalOpen(false);
              setSelectedSubdomain(null);
            }}
            subdomain={selectedSubdomain}
            currentConfig={subdomainConfig}
            onSave={handleSaveSubdomainConfig}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Application?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{selectedApplication.domain}</strong> and all its data.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Loading state
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-muted-foreground">Loading application...</p>
      </div>
    </div>
  );
}
