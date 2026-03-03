'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  onConnectionReady?: () => void;
  autoConnect?: boolean; // Connect immediately even without diagnosisId
}

export function useDiagnosisProgress(options: UseDiagnosisProgressOptions = {}) {
  const { diagnosisId, onComplete, onError, onConnectionReady, autoConnect = false } = options;
  const [progress, setProgress] = useState<DiagnosisProgress | null>(null);
  const [checks, setChecks] = useState<Map<string, DiagnosisCheck>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const connectionReadyCalledRef = useRef(false);
  
  // Use refs for callbacks to avoid reconnecting SSE when callbacks change
  const onConnectionReadyRef = useRef(onConnectionReady);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  
  // Use ref for diagnosisId so event listener always has latest value
  const diagnosisIdRef = useRef(diagnosisId);
  
  // Update refs when values change
  useEffect(() => {
    onConnectionReadyRef.current = onConnectionReady;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    diagnosisIdRef.current = diagnosisId;
  }, [onConnectionReady, onComplete, onError, diagnosisId]);

  useEffect(() => {
    console.log('[useDiagnosisProgress] useEffect triggered with autoConnect:', autoConnect);
    
    // Only connect if autoConnect is true
    // diagnosisId is NOT in dependencies to prevent reconnection when it's set
    if (!autoConnect) {
      console.log('[useDiagnosisProgress] autoConnect is false, not connecting');
      return;
    }

    console.log('[useDiagnosisProgress] Starting SSE connection setup');
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;
    
    // Reset the connection ready flag when effect runs
    connectionReadyCalledRef.current = false;
    console.log('[useDiagnosisProgress] Reset connectionReadyCalledRef to false');

    const connect = () => {
      if (isUnmounted) {
        console.log('[useDiagnosisProgress] Component unmounted, skipping connect');
        return;
      }

      console.log('[useDiagnosisProgress] CONNECT FUNCTION CALLED - Starting SSE connection');

      try {
        // Get access token from localStorage
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.error('[useDiagnosisProgress] No authentication token found');
          setConnectionError('No authentication token found');
          return;
        }

        // Create SSE connection
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const sseUrl = `${apiBaseUrl}/events/stream?token=${token}`;
        console.log('[useDiagnosisProgress] Connecting to SSE:', sseUrl);
        console.log('[useDiagnosisProgress] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
        console.log('[useDiagnosisProgress] Token length:', token.length);
        console.log('[useDiagnosisProgress] Token starts with:', token.substring(0, 20) + '...');
        
        eventSource = new EventSource(sseUrl);

        // Fallback timeout: If we don't receive "connected" message within 3 seconds after onopen,
        // trigger onConnectionReady anyway (SSE might be working but not sending connected event)
        let connectionReadyTimeout: NodeJS.Timeout | null = null;

        eventSource.onopen = () => {
          console.log('[useDiagnosisProgress] EventSource.onopen fired');
          console.log('[useDiagnosisProgress] EventSource readyState:', eventSource?.readyState);
          console.log('[useDiagnosisProgress] EventSource url:', eventSource?.url);
          setIsConnected(true);
          setConnectionError(null);
          
          // Set fallback timeout
          console.log('[useDiagnosisProgress] Setting 3-second fallback timeout');
          connectionReadyTimeout = setTimeout(() => {
            console.log('[useDiagnosisProgress] Fallback timeout triggered');
            console.log('[useDiagnosisProgress] connectionReadyCalledRef.current:', connectionReadyCalledRef.current);
            console.log('[useDiagnosisProgress] onConnectionReadyRef.current exists:', !!onConnectionReadyRef.current);
            
            if (onConnectionReadyRef.current && !connectionReadyCalledRef.current) {
              console.log('[useDiagnosisProgress] Fallback: Triggering onConnectionReady after timeout');
              connectionReadyCalledRef.current = true;
              onConnectionReadyRef.current();
            } else {
              console.log('[useDiagnosisProgress] Fallback: Skipping onConnectionReady (already called or no callback)');
            }
          }, 3000);
        };

        eventSource.onerror = (error) => {
          console.error('[useDiagnosisProgress] SSE connection error:', error);
          console.error('[useDiagnosisProgress] EventSource readyState:', eventSource?.readyState);
          console.error('[useDiagnosisProgress] EventSource url:', eventSource?.url);
          setIsConnected(false);
          
          // Clear fallback timeout
          if (connectionReadyTimeout) {
            clearTimeout(connectionReadyTimeout);
            connectionReadyTimeout = null;
          }
          
          // Close the connection to prevent repeated errors
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        };

        eventSource.addEventListener('message', (event) => {
          console.log('[useDiagnosisProgress] Raw SSE event received:', event);
          console.log('[useDiagnosisProgress] Event data:', event.data);
          console.log('[useDiagnosisProgress] Event type:', event.type);
          console.log('[useDiagnosisProgress] Event lastEventId:', event.lastEventId);
          
          try {
            const data = JSON.parse(event.data);
            console.log('[useDiagnosisProgress] Parsed SSE message:', data.type, data);
            console.log('[useDiagnosisProgress] Current diagnosisIdRef.current:', diagnosisIdRef.current);

            // Trigger onConnectionReady when we receive the "connected" message
            if (data.type === 'connected' && onConnectionReadyRef.current && !connectionReadyCalledRef.current) {
              console.log('[useDiagnosisProgress] SSE connected, triggering onConnectionReady');
              connectionReadyCalledRef.current = true;
              setIsConnected(true);
              setConnectionError(null);
              
              // Clear fallback timeout since we got the connected message
              if (connectionReadyTimeout) {
                clearTimeout(connectionReadyTimeout);
                connectionReadyTimeout = null;
              }
              
              onConnectionReadyRef.current();
              return;
            }

            // Filter for diagnosis progress events
            // Backend emits 'diagnosis.progress' (SystemEvent.DIAGNOSIS_PROGRESS)
            if (data.type === 'diagnosis.progress') {
              console.log('[useDiagnosisProgress] Received diagnosis.progress event');
              console.log('[useDiagnosisProgress] Event diagnosisId:', data.data?.diagnosisId);
              console.log('[useDiagnosisProgress] Current diagnosisIdRef.current:', diagnosisIdRef.current);
              console.log('[useDiagnosisProgress] IDs match:', data.data?.diagnosisId === diagnosisIdRef.current);
              
              // Accept events if we have a real diagnosisId and it matches, OR if we don't have a diagnosisId yet (empty string)
              const shouldAcceptEvent = diagnosisIdRef.current && diagnosisIdRef.current !== '' 
                ? data.data.diagnosisId === diagnosisIdRef.current 
                : true; // Accept any event if we don't have a diagnosisId yet
              
              if (shouldAcceptEvent) {
                console.log('[useDiagnosisProgress] Processing diagnosis progress for:', data.data?.diagnosisId);
                const progressData = data.data as DiagnosisProgress;
                setProgress(progressData);

                // Update diagnosisIdRef if we didn't have one
                if (!diagnosisIdRef.current || diagnosisIdRef.current === '') {
                  console.log('[useDiagnosisProgress] Updating diagnosisIdRef from empty to:', progressData.diagnosisId);
                  diagnosisIdRef.current = progressData.diagnosisId;
                }

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

                  if (progressData.status === 'COMPLETED' && onCompleteRef.current) {
                    onCompleteRef.current(progressData);
                  } else if (progressData.status === 'FAILED' && onErrorRef.current) {
                    onErrorRef.current(progressData.error || 'Diagnosis failed');
                  }
                }
              } else {
                console.log('[useDiagnosisProgress] Ignoring diagnosis progress - ID mismatch');
              }
            } else {
              console.log('[useDiagnosisProgress] Ignoring non-diagnosis event:', data.type);
            }
          } catch (error) {
            console.error('[useDiagnosisProgress] Error parsing SSE event:', error);
            console.error('[useDiagnosisProgress] Raw event data:', event.data);
          }
        });
      } catch (error) {
        // Silently fail - SSE endpoint may not be implemented yet
        console.error('[useDiagnosisProgress] Connection setup error:', error);
        setConnectionError(null);
      }
    };

    connect();

    // Cleanup
    return () => {
      console.log('[useDiagnosisProgress] Cleaning up SSE connection');
      isUnmounted = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [autoConnect]); // Only autoConnect in dependencies - diagnosisId removed to prevent reconnection

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
