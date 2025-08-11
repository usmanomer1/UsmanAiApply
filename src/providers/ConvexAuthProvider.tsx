import { ReactNode, useCallback, useEffect } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Initialize Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);

interface ConvexAuthProviderProps {
  children: ReactNode;
}

/**
 * ConvexAuthProvider integrates Supabase authentication with Convex
 * It automatically syncs the Supabase JWT token with Convex for authentication
 */
export function ConvexAuthProvider({ children }: ConvexAuthProviderProps) {
  const { user } = useAuth();

  // Create an async function that fetches the token
  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    try {
      if (!user) {
        // No user, no token
        return null;
      }

      // Get the current session from Supabase
      const { data: { session }, error } = forceRefreshToken 
        ? await supabase.auth.refreshSession()
        : await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      if (session?.access_token) {
        return session.access_token;
      }

      // Try to refresh if no token
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      return refreshedSession?.access_token || null;
    } catch (error) {
      console.error('Error fetching access token:', error);
      return null;
    }
  }, [user]);

  // Set the auth function when component mounts or user changes
  useEffect(() => {
    if (user) {
      // Set the async function that Convex will call to get tokens
      convex.setAuth(fetchAccessToken);
    } else {
      // Clear auth when no user
      convex.clearAuth();
    }
  }, [user, fetchAccessToken]);

  // Listen for auth state changes to trigger re-authentication
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      // When auth state changes, Convex will automatically call fetchAccessToken
      // due to the setAuth configuration above
      if (event === 'SIGNED_OUT') {
        convex.clearAuth();
        console.log('Convex auth cleared');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}