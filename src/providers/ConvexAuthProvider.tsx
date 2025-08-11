import { ReactNode, useCallback } from 'react';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Initialize Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);

interface ConvexAuthProviderProps {
  children: ReactNode;
}

/**
 * Custom hook that provides auth for Convex
 * This bridges Supabase auth to Convex's auth system
 */
function useAuthFromSupabase() {
  const { user } = useAuth();

  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    try {
      // No user = no token
      if (!user) {
        return null;
      }

      // Get the session (with optional refresh)
      const { data: { session }, error } = forceRefreshToken 
        ? await supabase.auth.refreshSession()
        : await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      // Return the access token if we have one
      return session?.access_token || null;
    } catch (error) {
      console.error('Error fetching access token:', error);
      return null;
    }
  }, [user]);

  return {
    isLoading: false,
    isAuthenticated: !!user,
    fetchAccessToken,
  };
}

/**
 * ConvexAuthProvider bridges Supabase authentication with Convex
 * It provides the JWT token to Convex which creates native auth context
 */
export function ConvexAuthProvider({ children }: ConvexAuthProviderProps) {
  return (
    <ConvexProviderWithAuth 
      client={convex} 
      useAuth={useAuthFromSupabase}
    >
      {children}
    </ConvexProviderWithAuth>
  );
}