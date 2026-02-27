/**
 * Application Detail Page
 * 
 * Shows detailed information about a single application with tabs for:
 * - Overview
 * - Diagnostics
 * - Configuration
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApplication, useDeleteApplication, useDiagnoseApplication, useUpdateApplication } from '@/hooks/use-healer';
import { ApplicationDetailView } from '@/components/healer/ApplicationDetailView-v2';
import { DiagnosePage } from '@/components/healer/DiagnosePage';
import { ConfigurePage } from '@/components/healer/ConfigurePage';
import { SubdomainConfigModal } from '@/components/healer/SubdomainConfigModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { healerApi } from '@/lib/api/healer';

type TabValue = 'overview' | 'diagnostics' | 'configure';

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const applicationId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedSubdomain, setSelectedSubdomain] = useState<string | null>(null);
  const [subdomainConfig, setSubdomainConfig] = useState<any>({});
  const detectionStartedRef = useRef(false);
  
  const { data: application, isLoading, error, refetch } = useApplication(applicationId);
  const deleteMutation = useDeleteApplication();
  const diagnoseMutation = useDiagnoseApplication();
  const updateMutation = useUpdateApplication();

  // Auto-detect tech stack when page loads if tech stack is UNKNOWN
  useEffect(() => {
    // Skip if no application data yet
    if (!application) return;
    
    // Skip if already started detection for this application
    if (detectionStartedRef.current) return;
    
    const detectTechStackIfNeeded = async () => {
      // Check if main application or any subdomain has UNKNOWN tech stack
      const needsDetection = application.techStack === 'UNKNOWN';
      const metadata = (application.metadata as any) || {};
      const subdomains = metadata.availableSubdomains || [];
      const hasUnknownSubdomains = subdomains.some((s: any) => s.techStack === 'UNKNOWN' || !s.techStack);
      
      if (!needsDetection && !hasUnknownSubdomains) {
        // No detection needed
        return;
      }
      
      // Mark as started BEFORE any async operations to prevent race conditions
      detectionStartedRef.current = true;
      
      try {
        // Step 1: Collect metadata first if subdomains array is empty
        if (subdomains.length === 0) {
          toast({
            title: 'Preparing Detection',
            description: 'Collecting application metadata...',
          });
          
          await apiClient.post(`/healer/applications/${applicationId}/collect-metadata`, {});
          // Wait for metadata to be saved
          await new Promise(resolve => setTimeout(resolve, 1000));
          await refetch();
        }
        
        // Step 2: Run tech stack detection
        toast({
          title: 'Detecting Tech Stacks',
          description: 'Analyzing application and all domains...',
        });
        
        const result = await healerApi.detectAllTechStacks(applicationId);
        
        // Refetch to get updated data
        await refetch();
        
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
        // Reset flag on error so user can retry
        detectionStartedRef.current = false;
      }
    };

    detectTechStackIfNeeded();
  }, [application?.id]); // Only run when application ID changes (once per page load)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(applicationId);
      toast({
        title: 'Application Deleted',
        description: 'The application has been removed successfully',
      });
      router.push('/healer');
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete application',
        variant: 'destructive',
      });
    }
  };

  const handleDiagnose = async () => {
    try {
      await diagnoseMutation.mutateAsync({ applicationId });
      toast({
        title: 'Diagnosis Started',
        description: 'Running diagnostics on the application',
      });
      setActiveTab('diagnostics');
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Diagnosis Failed',
        description: error.message || 'Failed to run diagnostics',
        variant: 'destructive',
      });
    }
  };

  const handleDiagnoseSubdomain = async (subdomain: string) => {
    try {
      await diagnoseMutation.mutateAsync({ applicationId, subdomain });
      toast({
        title: 'Diagnosis Started',
        description: `Running diagnostics on ${subdomain}`,
      });
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Diagnosis Failed',
        description: error.message || 'Failed to run diagnostics',
        variant: 'destructive',
      });
    }
  };

  const handleToggleHealer = async () => {
    if (!application) return;

    try {
      await updateMutation.mutateAsync({
        id: applicationId,
        data: { isHealerEnabled: !application.isHealerEnabled },
      });
      toast({
        title: application.isHealerEnabled ? 'Healer Disabled' : 'Healer Enabled',
        description: `Auto-healing has been ${application.isHealerEnabled ? 'disabled' : 'enabled'}`,
      });
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to toggle healer',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSubdomainHealer = async (subdomain: string, enabled: boolean) => {
    try {
      await apiClient.post(`/healer/applications/${applicationId}/subdomains/${subdomain}/toggle-healer`, {
        enabled,
      });
      toast({
        title: enabled ? 'Healer Enabled' : 'Healer Disabled',
        description: `Auto-healing has been ${enabled ? 'enabled' : 'disabled'} for ${subdomain}`,
      });
      await refetch();
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
    // Get subdomain config from application metadata
    const metadata = (application?.metadata as any) || {};
    const availableSubdomains = metadata.availableSubdomains || [];
    const subdomainInfo = availableSubdomains.find((s: any) => s.domain === subdomain);
    
    setSelectedSubdomain(subdomain);
    setSubdomainConfig(subdomainInfo || {});
    setConfigModalOpen(true);
  };

  const handleSaveSubdomainConfig = async (config: any) => {
    if (!selectedSubdomain) return;

    try {
      await apiClient.put(`/healer/applications/${applicationId}/subdomains/${selectedSubdomain}`, config);
      toast({
        title: 'Configuration Saved',
        description: `Settings updated for ${selectedSubdomain}`,
      });
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive',
      });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Application Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The application you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => router.push('/healer')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => router.push('/healer')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Applications
      </Button>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="configure">Configure</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ApplicationDetailView
            application={application}
            onDiagnose={handleDiagnose}
            onDiagnoseSubdomain={handleDiagnoseSubdomain}
            onToggleHealer={handleToggleHealer}
            onToggleSubdomainHealer={handleToggleSubdomainHealer}
            onConfigure={handleConfigure}
            onConfigureSubdomain={handleConfigureSubdomain}
            onDelete={handleDelete}
            isLoading={deleteMutation.isPending || diagnoseMutation.isPending || updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-6">
          <DiagnosePage
            application={application}
            onBack={() => setActiveTab('overview')}
          />
        </TabsContent>

        <TabsContent value="configure" className="mt-6">
          <ConfigurePage
            application={application}
            onBack={() => setActiveTab('overview')}
            onSaved={(updated) => {
              toast({
                title: 'Settings Saved',
                description: 'Configuration updated successfully',
              });
              setActiveTab('overview');
            }}
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
