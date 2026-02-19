/**
 * Authentication Store using Zustand
 * Manages authentication state and user session
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: {
    id: string;
    name: string;
    displayName: string;
  };
  mfaEnabled: boolean;
  mustChangePassword: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => Promise<void>;
}

let isCheckingAuth = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string, mfaCode?: string) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.login(email, password, mfaCode);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await apiClient.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
          }
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      checkAuth: async () => {
        // Prevent multiple simultaneous calls using module-level flag
        if (isCheckingAuth) {
          console.log('[Auth] Already checking auth, skipping...');
          return;
        }

        isCheckingAuth = true;

        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
          
          // If no access token, try to refresh using the refresh token cookie
          if (!token) {
            set({ isLoading: true });
            try {
              // Attempt to refresh token (refresh token is in HTTP-only cookie)
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies
              });

              if (response.ok) {
                const data = await response.json();
                // Store new access token
                if (typeof window !== 'undefined') {
                  localStorage.setItem('accessToken', data.accessToken);
                }
                
                // Get user info with new token
                const userResponse = await apiClient.getCurrentUser();
                set({ user: userResponse.user, isAuthenticated: true, isLoading: false });
                return;
              }
            } catch (error) {
              console.error('Token refresh failed:', error);
            }
            
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
          }

          set({ isLoading: true });
          try {
            const response = await apiClient.getCurrentUser();
            // User data now includes full role information
            set({ user: response.user, isAuthenticated: true, isLoading: false });
          } catch (error) {
            console.error('Auth check failed:', error);
            // Clear invalid token
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
            }
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } finally {
          isCheckingAuth = false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user data, NOT isAuthenticated
        // This forces auth verification on every page load
        user: state.user,
      }),
      // Don't rehydrate isAuthenticated - always start as false
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = false;
        }
      },
    },
  ),
);
