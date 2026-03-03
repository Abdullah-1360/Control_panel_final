/**
 * Diagnosis Progress Hook - React Query Polling Implementation
 * 
 * Replaces SSE with simple HTTP polling for better reliability
 */

import { useQuery } from '@tanstack/react-query';
import { healerApi } from '@/lib/api/healer';
import { useCallback, useRef } from 'react';

export interface DiagnosisProgressData {
  diagnosisId: string;
  siteId: string;
  siteName: string;
  status: 'STARTING' | 'RUNNING' | 'CHECK_STARTED' | 'CHECK_COMPLETED' | 'CORRELATING' | 'COMPLETED' | 'FAILED';
  progress: number;
  totalChecks: number;
  completedChecks: number;
  failedChecks: number;
  warningChecks: number;
  passedChecks: number;
  checks?: Array<{
    checkType: string;
    checkName: string;
    category: string;
    status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'WARNING' | 'ERROR';
    message?: string;
    duration?: number;
    startedAt?: string;
    completedAt?: string;
  }>;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  message: string;
  currentCheck?: string;
  checkName?: string;
  checkCategory?: string;
  checkStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'ERROR';
  checkMessage?: string;
  checkDuration?: number;
  error?: string;
  timestamp: string;
}

interface UseDiagnosisProgressPollingOptions {
  diagnosisId: string;
  enabled?: boolean;
  onComplete?: (data: DiagnosisProgressData) => void;
  onError?: (error: Error) => void;
  pollInterval?: number; // milliseconds, default 2000 (2 seconds)
}

export function useDiagnosisProgressPolling({
  diagnosisId,
  enabled = true,
  onComplete,
  onError,
  pollInterval = 2000,
}: UseDiagnosisProgressPollingOptions) {
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const completedRef = useRef(false);

  // Update refs when callbacks change
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const {
    data: progress,
    error,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['diagnosis-progress', diagnosisId],
    queryFn: async () => {
      if (!diagnosisId) {
        throw new Error('No diagnosis ID provided');
      }

      console.log('[useDiagnosisProgressPolling] Fetching progress for:', diagnosisId);
      
      try {
        const response = await healerApi.getDiagnosisProgress(diagnosisId);
        console.log('[useDiagnosisProgressPolling] Progress response:', response);
        
        // Handle both direct data and wrapped data
        const progressData = response?.data || response;
        const status = progressData?.status;
        
        console.log('[useDiagnosisProgressPolling] Progress status:', status);
        console.log('[useDiagnosisProgressPolling] Returning progressData:', progressData);
        
        if (status === 'COMPLETED' || status === 'FAILED') {
          if (!completedRef.current) {
            completedRef.current = true;
            console.log('[useDiagnosisProgressPolling] Diagnosis completed/failed, calling onComplete');
            onCompleteRef.current?.(progressData);
          }
        }
        
        // IMPORTANT: Return the progressData directly, not wrapped
        return progressData;
      } catch (error: any) {
        console.error('[useDiagnosisProgressPolling] Error fetching progress:', error);
        
        // If diagnosis not found, it might be completed or failed
        if (error.response?.status === 404) {
          console.log('[useDiagnosisProgressPolling] Diagnosis not found (404), may be completed');
          return null;
        }
        
        onErrorRef.current?.(error);
        throw error;
      }
    },
    enabled: enabled && !!diagnosisId,
    refetchInterval: (query) => {
      // The refetchInterval callback receives a Query object, not the data directly
      // We need to access query.state.data to get the actual progress data
      const data = query?.state?.data;
      
      // If no data yet, keep polling to get initial data
      if (!data) {
        console.log('[useDiagnosisProgressPolling] refetchInterval - No data yet, continuing polling');
        return pollInterval;
      }
      
      const status = data.status;
      console.log('[useDiagnosisProgressPolling] refetchInterval - status from query.state.data:', status);
      
      if (status === 'COMPLETED' || status === 'FAILED') {
        console.log('[useDiagnosisProgressPolling] refetchInterval - Stopping polling: status is', status);
        return false;
      }
      
      console.log('[useDiagnosisProgressPolling] refetchInterval - Continuing polling with interval:', pollInterval);
      return pollInterval;
    },
    refetchIntervalInBackground: false, // Don't poll when tab is not active
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const startPolling = useCallback(() => {
    console.log('[useDiagnosisProgressPolling] Starting polling for:', diagnosisId);
    completedRef.current = false;
    refetch();
  }, [diagnosisId, refetch]);

  const stopPolling = useCallback(() => {
    console.log('[useDiagnosisProgressPolling] Stopping polling');
    completedRef.current = true;
  }, []);

  return {
    progress,
    error,
    isLoading,
    isError,
    isPolling: enabled && !!diagnosisId && !completedRef.current,
    startPolling,
    stopPolling,
    refetch,
  };
}