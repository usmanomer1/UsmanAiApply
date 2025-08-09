import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Custom hook to get the current Supabase auth token for use with Convex
 * Handles token refresh and provides loading/error states
 */
export function useConvexAuth() {
  const { user } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const getToken = async () => {
      if (!user) {
        if (mounted) {
          setAuthToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (session?.access_token) {
          if (mounted) {
            setAuthToken(session.access_token);
            setError(null);
          }
        } else {
          // Try to refresh the session
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            throw refreshError;
          }

          if (refreshedSession?.access_token && mounted) {
            setAuthToken(refreshedSession.access_token);
            setError(null);
          } else if (mounted) {
            setError('No valid session found');
          }
        }
      } catch (err) {
        console.error('Error getting auth token:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to get authentication token');
          setAuthToken(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getToken();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        if (session?.access_token) {
          setAuthToken(session.access_token);
          setError(null);
        } else {
          setAuthToken(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [user]);

  /**
   * Manually refresh the token
   */
  const refreshToken = async () => {
    setLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (session?.access_token) {
        setAuthToken(session.access_token);
        setError(null);
        return session.access_token;
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    authToken,
    loading,
    error,
    refreshToken,
    isAuthenticated: !!authToken && !error,
  };
}

/**
 * Helper function to add auth token to Convex function arguments
 */
export function withAuthToken<T extends Record<string, any>>(
  authToken: string | null,
  args: T
): T & { authToken: string } | "skip" {
  if (!authToken) {
    return "skip"; // Convex convention to skip the query/mutation
  }
  
  return {
    ...args,
    authToken,
  };
}