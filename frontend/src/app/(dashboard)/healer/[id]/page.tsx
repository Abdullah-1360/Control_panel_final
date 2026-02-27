/**
 * Application Detail Page
 * 
 * Shows detailed information about a single application with tabs for:
 * - Overview
 * - Diagnostics
 * - Configuration
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApplication, useDeleteApplication } from '@/hooks/use-healer';
import { ApplicationDetailView } from '@/components/healer/ApplicationDetailView';
import { DiagnosePage } from '@/components/healer/DiagnosePage';
import { ConfigurePage } from '@/components/healer/ConfigurePage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TabValue = 'overview' | 'diagnostics' | 'configure';

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const applicationId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  
  const { data: application, isLoading, error } = useApplication(applicationId);
  const deleteMutation = useDeleteApplication();

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

  const handleToggleHealer = async () => {
    // This will be implemented with the update mutation
    toast({
      title: 'Coming Soon',
      description: 'Toggle healer functionality will be available soon',
    });
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
            onDiagnose={() => setActiveTab('diagnostics')}
            onToggleHealer={handleToggleHealer}
            onConfigure={() => setActiveTab('configure')}
            onDelete={handleDelete}
            isLoading={deleteMutation.isPending}
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
    </div>
  );
}
