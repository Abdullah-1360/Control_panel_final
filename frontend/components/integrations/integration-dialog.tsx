'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const baseSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  provider: z.string().min(1, 'Provider is required'),
  linkedServerId: z.string().optional(),
});

interface IntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  integration?: any;
}

export function IntegrationDialog({
  open,
  onClose,
  integration,
}: IntegrationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  const { data: providersData } = useQuery({
    queryKey: ['integration-providers'],
    queryFn: async () => {
      // Return static list of providers
      return [
        { type: 'WHM', name: 'WHM/cPanel', description: 'WebHost Manager for cPanel server management' },
        { type: 'SMTP', name: 'SMTP Server', description: 'Email server for sending notifications' },
        { type: 'SLACK', name: 'Slack', description: 'Team communication and notifications' },
        { type: 'DISCORD', name: 'Discord', description: 'Community communication via webhooks' },
        { type: 'ANSIBLE', name: 'Ansible Tower/AWX', description: 'Automation platform for playbook execution' },
      ];
    },
  });

  const { data: serversData } = useQuery({
    queryKey: ['servers-list'],
    queryFn: async () => {
      const response = await api.getServers({ page: 1, limit: 100 });
      return response.data;
    },
  });

  const providers = providersData || [];
  const servers = serversData || [];

  const form = useForm({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      name: '',
      description: '',
      provider: '',
      linkedServerId: '',
    },
  });

  useEffect(() => {
    if (integration) {
      form.reset({
        name: integration.name,
        description: integration.description || '',
        provider: integration.provider,
        linkedServerId: integration.linkedServerId || '',
      });
      setSelectedProvider(integration.provider);
    } else {
      form.reset({
        name: '',
        description: '',
        provider: '',
        linkedServerId: '',
      });
      setSelectedProvider('');
    }
  }, [integration, form]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (integration) {
        return await api.updateIntegration(integration.id, data);
      } else {
        return await api.createIntegration(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: integration ? 'Integration updated' : 'Integration created',
        description: `The integration has been ${integration ? 'updated' : 'created'} successfully.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save integration',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: any) => {
    // Build config object based on provider
    const config: any = {};

    if (selectedProvider === 'WHM') {
      config.baseUrl = (document.getElementById('baseUrl') as HTMLInputElement)?.value;
      config.username = (document.getElementById('username') as HTMLInputElement)?.value;
      config.apiToken = (document.getElementById('apiToken') as HTMLInputElement)?.value;
    } else if (selectedProvider === 'SMTP') {
      config.host = (document.getElementById('host') as HTMLInputElement)?.value;
      config.port = parseInt((document.getElementById('port') as HTMLInputElement)?.value || '587');
      config.secure = (document.getElementById('secure') as HTMLInputElement)?.checked;
      config.username = (document.getElementById('username') as HTMLInputElement)?.value;
      config.password = (document.getElementById('password') as HTMLInputElement)?.value;
      config.from = (document.getElementById('from') as HTMLInputElement)?.value;
    } else if (selectedProvider === 'SLACK') {
      config.webhookUrl = (document.getElementById('webhookUrl') as HTMLInputElement)?.value;
      config.botToken = (document.getElementById('botToken') as HTMLInputElement)?.value;
    } else if (selectedProvider === 'DISCORD') {
      config.webhookUrl = (document.getElementById('webhookUrl') as HTMLInputElement)?.value;
    } else if (selectedProvider === 'ANSIBLE') {
      config.baseUrl = (document.getElementById('baseUrl') as HTMLInputElement)?.value;
      config.username = (document.getElementById('username') as HTMLInputElement)?.value;
      config.password = (document.getElementById('password') as HTMLInputElement)?.value;
    }

    // Prepare the payload
    const payload = {
      name: data.name,
      description: data.description || undefined,
      provider: data.provider,
      config,
      linkedServerId: data.linkedServerId && data.linkedServerId !== 'none' ? data.linkedServerId : undefined,
    };

    mutation.mutate(payload);
  };

  const renderProviderFields = () => {
    const provider = providers?.find((p: any) => p.type === selectedProvider);
    if (!provider) return null;

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {provider.description}
        </div>

        {selectedProvider === 'WHM' && (
          <>
            <div className="space-y-2">
              <label htmlFor="baseUrl" className="text-sm font-medium">
                Base URL *
              </label>
              <Input
                id="baseUrl"
                placeholder="https://server.example.com:2087"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username *
              </label>
              <Input id="username" placeholder="root" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="apiToken" className="text-sm font-medium">
                API Token *
              </label>
              <Input id="apiToken" type="password" required />
            </div>
          </>
        )}

        {selectedProvider === 'SMTP' && (
          <>
            <div className="space-y-2">
              <label htmlFor="host" className="text-sm font-medium">
                SMTP Host *
              </label>
              <Input id="host" placeholder="smtp.example.com" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="port" className="text-sm font-medium">
                Port *
              </label>
              <Input id="port" type="number" placeholder="587" required />
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="secure" />
              <label htmlFor="secure" className="text-sm font-medium">
                Use SSL/TLS (port 465)
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username *
              </label>
              <Input id="username" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password *
              </label>
              <Input id="password" type="password" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="from" className="text-sm font-medium">
                From Email
              </label>
              <Input id="from" type="email" placeholder="noreply@example.com" />
            </div>
          </>
        )}

        {selectedProvider === 'SLACK' && (
          <>
            <div className="space-y-2">
              <label htmlFor="webhookUrl" className="text-sm font-medium">
                Webhook URL *
              </label>
              <Input
                id="webhookUrl"
                placeholder="https://hooks.slack.com/services/..."
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="botToken" className="text-sm font-medium">
                Bot Token (Optional)
              </label>
              <Input
                id="botToken"
                type="password"
                placeholder="xoxb-..."
              />
              <p className="text-xs text-muted-foreground">
                Required for API access (listing channels, users)
              </p>
            </div>
          </>
        )}

        {selectedProvider === 'DISCORD' && (
          <div className="space-y-2">
            <label htmlFor="webhookUrl" className="text-sm font-medium">
              Webhook URL *
            </label>
            <Input
              id="webhookUrl"
              placeholder="https://discord.com/api/webhooks/..."
              required
            />
          </div>
        )}

        {selectedProvider === 'ANSIBLE' && (
          <>
            <div className="space-y-2">
              <label htmlFor="baseUrl" className="text-sm font-medium">
                Base URL *
              </label>
              <Input
                id="baseUrl"
                placeholder="https://ansible.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username *
              </label>
              <Input id="username" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password *
              </label>
              <Input id="password" type="password" required />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {integration ? 'Edit Integration' : 'Add Integration'}
          </DialogTitle>
          <DialogDescription>
            {integration
              ? 'Update integration settings and credentials'
              : 'Connect a new external service or API'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Production WHM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Main hosting panel for production servers"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedProvider(value);
                    }}
                    value={field.value}
                    disabled={!!integration}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {providers?.map((provider: any) => (
                        <SelectItem key={provider.type} value={provider.type}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedProvider && renderProviderFields()}

            <FormField
              control={form.control}
              name="linkedServerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Server (Optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a server" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {servers?.map((server: any) => (
                        <SelectItem key={server.id} value={server.id}>
                          {server.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this integration to a specific server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {integration ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
