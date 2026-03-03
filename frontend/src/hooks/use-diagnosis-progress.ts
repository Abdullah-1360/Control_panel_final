'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DiagnosisProgress {
  diagnosisId: string;
  siteId: string;
  siteName: string;
  status: string;
  progress: number;
  currentCheck?: string;
  checkName?: string;
  checkCategory?: string;
  checkStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'ERROR';
  checkMessage?: string;
  checkDuration?: number;
  totalChecks: number;
  completedChecks: number;
  failedChecks: number;
  warningChecks: number;
  passedChecks: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface DiagnosisCheck {
  checkType: string;
  checkName: string;
  category: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'WARNING' | 'ERROR';
  message?: string;
  duration?: number;
  startedAt?: Date;
  completedAt?: Date;
}

interface UseDiagnosisProgressOptions {
  diagnosisId?: string;
  onComplete?: (progress: DiagnosisProgress) => void;
  onError?: (error: string) => void;
}

export function useDiagnosisProgress(options: UseDiagnosisProgressOptions = {}) {
  const { diagnosisId, onComplete, onError } = options;
  const [progress, setProgress] = useState<DiagnosisProgress | null>(null);
  const [checks, setChecks] = useState<Map<string, DiagnosisCheck>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnosisId) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      try {
        // Get access token from localStorage
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setConnectionError('No authentication token found');
          return;
        }

        // Create SSE connection
        eventSource = new EventSource(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/events/stream?token=${token}`,
        );

        eventSource.onopen = () => {
          setIsConnected(true);
          setConnectionError(null);
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          setIsConnected(false);
          setConnectionError('Connection lost. Reconnecting...');

          // Attempt to reconnect after 3 seconds
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(() => {
              connect();
            }, 3000);
          }
        };

        eventSource.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);

            // Filter for diagnosis progress events
            // Backend emits 'diagnosis.progress' (SystemEvent.DIAGNOSIS_PROGRESS)
            if (
              data.type === 'diagnosis.progress' &&
              data.data.diagnosisId === diagnosisId
            ) {
              const progressData = data.data as DiagnosisProgress;
              setProgress(progressData);

              // Update checks map
              if (progressData.currentCheck) {
                setChecks((prev) => {
                  const updated = new Map(prev);
                  updated.set(progressData.currentCheck!, {
                    checkType: progressData.currentCheck!,
                    checkName: progressData.checkName || progressData.currentCheck!,
                    category: progressData.checkCategory || 'SYSTEM',
                    status: progressData.checkStatus || 'RUNNING',
                    message: progressData.checkMessage,
                    duration: progressData.checkDuration,
                  });
                  return updated;
                });
              }

              // Check if diagnosis is complete
              if (
                progressData.status === 'COMPLETED' ||
                progressData.status === 'FAILED'
              ) {
                setIsComplete(true);

                if (progressData.status === 'COMPLETED' && onComplete) {
                  onComplete(progressData);
                } else if (progressData.status === 'FAILED' && onError) {
                  onError(progressData.error || 'Diagnosis failed');
                }
              }
            }
          } catch (error) {
            console.error('Error parsing SSE event:', error);
          }
        });
      } catch (error) {
        console.error('Error creating SSE connection:', error);
        setConnectionError('Failed to establish connection');
      }
    };

    connect();

    // Cleanup
    return () => {
      isUnmounted = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [diagnosisId, onComplete, onError]);

  const reset = useCallback(() => {
    setProgress(null);
    setChecks(new Map());
    setIsComplete(false);
    setConnectionError(null);
  }, []);

  return {
    progress,
    checks: Array.from(checks.values()),
    isComplete,
    isConnected,
    connectionError,
    reset,
  };
}
