'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Terminal,
  Play,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Brain,
  Globe,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CommandExecution {
  command: string;
  output: string;
  timestamp: string;
  wasSuccessful: boolean;
  duration: number;
}

interface CommandSuggestion {
  command: string;
  description: string;
  confidence?: number;
  patternId?: string;
  isVerified?: boolean;
}

interface ManualDiagnosisPageProps {
  siteId: string;
  selectedSubdomain?: string;
}

export function ManualDiagnosisPage({ siteId, selectedSubdomain: parentSelectedSubdomain }: ManualDiagnosisPageProps) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<CommandExecution[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [localSelectedSubdomain, setLocalSelectedSubdomain] = useState<string>('');
  const [sessionStarted, setSessionStarted] = useState(false);

  // Use parent's selected subdomain if provided, otherwise use local state
  const selectedSubdomain = parentSelectedSubdomain !== undefined ? parentSelectedSubdomain : localSelectedSubdomain;

  // Fetch subdomains (only needed if parent doesn't provide selection)
  const { data: subdomainsData, isLoading: isLoadingSubdomains } = useQuery({
    queryKey: ['healer-subdomains', siteId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/subdomains`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subdomains');
      }

      return response.json();
    },
    enabled: !!siteId && parentSelectedSubdomain === undefined,
  });

  // Fetch site details
  const { data: siteData } = useQuery({
    queryKey: ['healer-site', siteId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch site');
      }

      return response.json();
    },
  });

  // Start manual diagnosis session
  const startSessionMutation = useMutation({
    mutationFn: async (subdomain?: string) => {
      const body = subdomain ? { subdomain } : {};
      
      const response = await fetch(`http://localhost:3001/api/v1/healer/sites/${siteId}/diagnose/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to start manual diagnosis');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.data.sessionId);
      setSuggestions(data.data.suggestions || []);
      setSessionStarted(true);
      toast({
        title: 'Manual Diagnosis Started',
        description: `Session started${selectedSubdomain ? ` for ${selectedSubdomain}` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Start',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleStartSession = () => {
    startSessionMutation.mutate(selectedSubdomain || undefined);
  };

  // Execute command
  const executeCommandMutation = useMutation({
    mutationFn: async (command: string) => {
      if (!sessionId) throw new Error('No active session');

      const response = await fetch(`http://localhost:3001/api/v1/healer/manual/${sessionId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute command');
      }

      return response.json();
    },
    onSuccess: (data, command) => {
      const execution: CommandExecution = {
        command,
        output: data.data.output,
        timestamp: new Date().toISOString(),
        wasSuccessful: data.data.success,
        duration: data.data.duration,
      };

      setCommandHistory((prev) => [...prev, execution]);
      setSuggestions(data.data.nextSuggestions || []);
      setCurrentCommand('');

      toast({
        title: data.data.success ? 'Command Executed' : 'Command Failed',
        description: data.data.success ? 'Check output below' : data.data.error,
        variant: data.data.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Execution Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Switch to auto mode
  const switchToAutoMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No active session');

      const response = await fetch(`http://localhost:3001/api/v1/healer/manual/${sessionId}/auto`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to switch to auto mode');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsAutoMode(true);
      
      // Add auto-executed commands to history
      if (data.data.results) {
        const autoExecutions: CommandExecution[] = data.data.results.map((result: any) => ({
          command: result.command || 'Auto-executed command',
          output: result.output,
          timestamp: new Date().toISOString(),
          wasSuccessful: result.success,
          duration: result.duration,
        }));
        setCommandHistory((prev) => [...prev, ...autoExecutions]);
      }

      toast({
        title: 'Switched to Auto Mode',
        description: 'System is completing diagnosis automatically',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Switch',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Complete diagnosis
  const completeDiagnosisMutation = useMutation({
    mutationFn: async (findings: any) => {
      if (!sessionId) throw new Error('No active session');

      const response = await fetch(`http://localhost:3001/api/v1/healer/manual/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ findings }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete diagnosis');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Diagnosis Complete',
        description: data.data.learnedPattern
          ? `Created verified pattern with ${Math.round(data.data.learnedPattern.confidence * 100)}% confidence`
          : 'Session completed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Complete',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Don't auto-start session - wait for user to select subdomain and click start
  // useEffect removed

  const handleExecuteCommand = (command: string) => {
    if (!command.trim()) return;
    executeCommandMutation.mutate(command);
  };

  const handleSuggestionClick = (suggestion: CommandSuggestion) => {
    setCurrentCommand(suggestion.command);
  };

  const handleSwitchToAuto = () => {
    switchToAutoMutation.mutate();
  };

  const handleComplete = () => {
    // Extract findings from command history
    const findings = {
      diagnosisType: 'UNKNOWN', // TODO: Determine from outputs
      description: 'Manual diagnosis completed',
    };
    completeDiagnosisMutation.mutate(findings);
  };

  const subdomains = subdomainsData?.data || [];
  const hasSubdomains = subdomains.length > 0;
  const site = siteData?.data;

  // Show start button before session starts
  if (!sessionStarted) {
    // If parent provides subdomain, just show a simple start button
    if (parentSelectedSubdomain !== undefined) {
      return (
        <div className="space-y-4">
          <Button 
            onClick={handleStartSession} 
            disabled={startSessionMutation.isPending}
            className="w-full"
            size="lg"
          >
            {startSessionMutation.isPending ? (
              <>
                <Terminal className="mr-2 h-4 w-4 animate-pulse" />
                Starting Session...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Manual Diagnosis
              </>
            )}
          </Button>
        </div>
      );
    }

    // Otherwise show full selection UI
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Start Manual Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Only show subdomain selection if parent doesn't provide it */}
            {hasSubdomains && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Domain/Subdomain</label>
                <Select value={localSelectedSubdomain || '__main__'} onValueChange={(value) => setLocalSelectedSubdomain(value === '__main__' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Main Domain (Root)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__main__">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Main Domain: {site?.domain}</span>
                      </div>
                    </SelectItem>
                    {subdomains.map((sub: any) => (
                      <SelectItem key={sub.subdomain} value={sub.subdomain}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span>{sub.subdomain}</span>
                          {sub.type && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              sub.type === 'subdomain' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {sub.type}
                            </span>
                          )}
                          {sub.hasWordPress && (
                            <span className="text-xs text-green-600">(WordPress)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {localSelectedSubdomain 
                    ? `Will diagnose: ${localSelectedSubdomain}` 
                    : `Will diagnose: ${site?.domain} (Main Domain)`}
                </p>
              </div>
            )}
            
            <Button 
              onClick={handleStartSession} 
              disabled={startSessionMutation.isPending}
              className="w-full"
            >
              {startSessionMutation.isPending ? (
                <>
                  <Terminal className="mr-2 h-4 w-4 animate-pulse" />
                  Starting Session...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Manual Diagnosis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (startSessionMutation.isPending) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Terminal className="h-12 w-12 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Starting manual diagnosis session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Command Suggestions */}
      {suggestions.length > 0 && !isAutoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Suggested Commands
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                      {suggestion.command}
                    </code>
                    {suggestion.isVerified && (
                      <Badge className="bg-green-600">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {suggestion.confidence && (
                      <Badge variant="outline">
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                </div>
                <Button size="sm" variant="ghost">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Command Input */}
      {!isAutoMode && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Execute Command</CardTitle>
              <div className="flex gap-2">
                {suggestions.length > 0 && (
                  <Button
                    onClick={handleSwitchToAuto}
                    disabled={switchToAutoMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Continue in Auto Mode
                  </Button>
                )}
                <Button
                  onClick={handleComplete}
                  disabled={completeDiagnosisMutation.isPending || commandHistory.length === 0}
                  size="sm"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleExecuteCommand(currentCommand);
                  }
                }}
                placeholder="Enter command or select from suggestions above..."
                className="font-mono"
                disabled={executeCommandMutation.isPending}
              />
              <Button
                onClick={() => handleExecuteCommand(currentCommand)}
                disabled={!currentCommand.trim() || executeCommandMutation.isPending}
              >
                {executeCommandMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Execute
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto Mode Indicator */}
      {isAutoMode && (
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <p className="font-medium">Auto Mode Active</p>
            <p className="text-sm text-blue-700">
              System is completing diagnosis automatically using learned patterns
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Command History */}
      <Card>
        <CardHeader>
          <CardTitle>Command History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {commandHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No commands executed yet</p>
              <p className="text-sm">Select a suggestion or type a command above</p>
            </div>
          ) : (
            commandHistory.map((execution, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {execution.wasSuccessful ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <code className="text-sm font-mono">{execution.command}</code>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {execution.duration}ms
                  </div>
                </div>
                <div className="bg-secondary rounded p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                    {execution.output}
                  </pre>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
