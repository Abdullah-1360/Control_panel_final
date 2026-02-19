'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Brain, Trash2, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Pattern {
  id: string;
  diagnosisType: string;
  errorType: string;
  culprit: string;
  commands: string[];
  description: string;
  successCount: number;
  failureCount: number;
  confidence: number;
  autoApproved: boolean;
  lastUsedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
}

export function PatternsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletePatternId, setDeletePatternId] = useState<string | null>(null);

  // Fetch patterns
  const { data, isLoading } = useQuery({
    queryKey: ['healer-patterns'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/api/v1/healer/patterns', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patterns');
      }

      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Delete pattern mutation
  const deleteMutation = useMutation({
    mutationFn: async (patternId: string) => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/patterns/${patternId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete pattern');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Pattern Deleted',
        description: 'The pattern has been removed',
      });
      queryClient.invalidateQueries({ queryKey: ['healer-patterns'] });
      setDeletePatternId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle approval mutation
  const toggleApprovalMutation = useMutation({
    mutationFn: async ({ patternId, approved }: { patternId: string; approved: boolean }) => {
      const response = await fetch(`http://localhost:3001/api/v1/healer/patterns/${patternId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ approved }),
      });

      if (!response.ok) {
        throw new Error('Failed to update pattern approval');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.approved ? 'Pattern Approved' : 'Pattern Disapproved',
        description: variables.approved
          ? 'This pattern will now auto-execute'
          : 'This pattern requires manual approval',
      });
      queryClient.invalidateQueries({ queryKey: ['healer-patterns'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const patterns = data?.data || [];
  const totalAttempts = (pattern: Pattern) => pattern.successCount + pattern.failureCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Learned Patterns</h1>
          <p className="text-muted-foreground">
            Self-learning automation patterns from healing executions
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Brain className="mr-2 h-5 w-5" />
          {patterns.length} Patterns
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pattern Library</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading patterns...</div>
          ) : patterns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No patterns learned yet</p>
              <p className="text-sm">Patterns will appear as the system learns from healing executions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Diagnosis Type</TableHead>
                  <TableHead>Error Type</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((pattern: Pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell>
                      <Badge variant="outline">{pattern.diagnosisType}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{pattern.errorType || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp
                          className={`h-4 w-4 ${
                            pattern.confidence > 0.9
                              ? 'text-green-600'
                              : pattern.confidence > 0.7
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          }`}
                        />
                        <span className="text-sm">
                          {pattern.successCount}/{totalAttempts(pattern)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              pattern.confidence > 0.9
                                ? 'bg-green-600'
                                : pattern.confidence > 0.7
                                ? 'bg-blue-600'
                                : 'bg-amber-600'
                            }`}
                            style={{ width: `${pattern.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {Math.round(pattern.confidence * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pattern.autoApproved ? (
                        <Badge className="bg-green-600">Auto-Approved</Badge>
                      ) : pattern.successCount >= 3 ? (
                        <Badge variant="secondary">Learning</Badge>
                      ) : (
                        <Badge variant="outline">New</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {pattern.lastUsedAt
                          ? new Date(pattern.lastUsedAt).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleApprovalMutation.mutate({
                              patternId: pattern.id,
                              approved: !pattern.autoApproved,
                            })
                          }
                          disabled={toggleApprovalMutation.isPending}
                        >
                          {pattern.autoApproved ? (
                            <XCircle className="h-4 w-4 text-amber-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletePatternId(pattern.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePatternId} onOpenChange={() => setDeletePatternId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pattern?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this learned pattern. The system will need to relearn it
              from future executions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePatternId && deleteMutation.mutate(deletePatternId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
