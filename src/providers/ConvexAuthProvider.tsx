import { ReactNode, useCallback, useRef } from 'react';
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
  const tokenCacheRef = useRef<{ token: string | null; expiry: number }>({ token: null, expiry: 0 });
  const lastFetchRef = useRef<number>(0);
  const fetchPromiseRef = useRef<Promise<string | null> | null>(null);

  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    try {
      // No user = no token
      if (!user) {
        tokenCacheRef.current = { token: null, expiry: 0 };
        fetchPromiseRef.current = null;
        return null;
      }

      // Check if we have a cached token that's still valid
      const now = Date.now();
      if (!forceRefreshToken && tokenCacheRef.current.token && tokenCacheRef.current.expiry > now + 60000) {
        // Token is cached and valid for at least another minute
        return tokenCacheRef.current.token;
      }

      // Prevent rapid successive calls - return existing promise if one is in progress
      if (fetchPromiseRef.current && (now - lastFetchRef.current < 1000)) {
        return fetchPromiseRef.current;
      }

      // Create a new fetch promise
      fetchPromiseRef.current = (async () => {
        lastFetchRef.current = now;

        // Get the session (with optional refresh)
        const { data: { session }, error } = forceRefreshToken 
          ? await supabase.auth.refreshSession()
          : await supabase.auth.getSession();
        
        if (error) {
          // Don't log rate limit errors - they're expected when hitting limits
          if (!error.message?.includes('rate limit')) {
            console.error('Error getting session:', error);
          }
          // Return cached token if we have one, even if expired (better than nothing)
          return tokenCacheRef.current.token;
        }

        if (session?.access_token) {
          // Cache the token with its expiry time
          // Supabase tokens typically expire after 1 hour
          const expiresIn = session.expires_in || 3600; // Default to 1 hour
          const expiryTime = Date.now() + (expiresIn * 1000);
          
          tokenCacheRef.current = {
            token: session.access_token,
            expiry: expiryTime
          };
          
          return session.access_token;
        }

        // Return cached token as fallback
        return tokenCacheRef.current.token;
      })();

      return fetchPromiseRef.current;
    } catch (error) {
      console.error('Error fetching access token:', error);
      // Return cached token as fallback
      return tokenCacheRef.current.token;
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