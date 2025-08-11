import { ReactNode, useCallback, useEffect, useRef } from 'react';
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
  const tokenRef = useRef<string | null>(null);

  // Function to set the auth token in Convex
  const setAuthToken = useCallback(async () => {
    try {
      if (!user) {
        // Clear auth if no user
        await convex.setAuth(null);
        tokenRef.current = null;
        return;
      }

      // Get the current session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        await convex.setAuth(null);
        tokenRef.current = null;
        return;
      }

      if (session?.access_token && session.access_token !== tokenRef.current) {
        // Set the token in Convex
        await convex.setAuth(session.access_token);
        tokenRef.current = session.access_token;
        console.log('Convex auth token set successfully');
      } else if (!session) {
        // No session, clear auth
        await convex.setAuth(null);
        tokenRef.current = null;
      }
    } catch (error) {
      console.error('Error setting Convex auth:', error);
      await convex.setAuth(null);
      tokenRef.current = null;
    }
  }, [user]);

  // Set auth token when user changes
  useEffect(() => {
    setAuthToken();
  }, [user, setAuthToken]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (session?.access_token && session.access_token !== tokenRef.current) {
        // Update Convex auth when session changes
        await convex.setAuth(session.access_token);
        tokenRef.current = session.access_token;
        console.log('Convex auth updated after state change');
      } else if (!session) {
        // Clear auth on sign out
        await convex.setAuth(null);
        tokenRef.current = null;
        console.log('Convex auth cleared');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Refresh token periodically (every 45 minutes to be safe)
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (user) {
        try {
          const { data: { session }, error } = await supabase.auth.refreshSession();
          
          if (!error && session?.access_token && session.access_token !== tokenRef.current) {
            await convex.setAuth(session.access_token);
            tokenRef.current = session.access_token;
            console.log('Convex auth token refreshed');
          }
        } catch (error) {
          console.error('Error refreshing token:', error);
        }
      }
    }, 45 * 60 * 1000); // 45 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}