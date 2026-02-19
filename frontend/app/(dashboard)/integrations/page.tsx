'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntegrationsList } from '@/components/integrations/integrations-list';
import { IntegrationDialog } from '@/components/integrations/integration-dialog';

export default function IntegrationsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);

  const handleEdit = (integration: any) => {
    setSelectedIntegration(integration);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedIntegration(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Manage external service connections and webhooks
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      <IntegrationsList onEdit={handleEdit} />

      <IntegrationDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        integration={selectedIntegration}
      />
    </div>
  );
}
