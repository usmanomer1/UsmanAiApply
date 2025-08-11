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
  const fetchPromiseRef = useRef<Promise<string | null> | null>(null);

  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    try {
      // No user = no token
      if (!user) {
        tokenCacheRef.current = { token: null, expiry: 0 };
        fetchPromiseRef.current = null;
        return null;
      }

      const now = Date.now();
      
      // Check if we have a cached token that's still valid
      if (!forceRefreshToken && tokenCacheRef.current.token && tokenCacheRef.current.expiry > now + 60000) {
        // Token is cached and valid for at least another minute
        return tokenCacheRef.current.token;
      }

      // If a fetch is already in progress, return the existing promise
      // This prevents stampedes regardless of timing
      if (fetchPromiseRef.current) {
        return fetchPromiseRef.current;
      }

      // Create a new fetch promise
      fetchPromiseRef.current = (async () => {
        // Get the session (with optional refresh)
        const { data: { session }, error } = forceRefreshToken 
          ? await supabase.auth.refreshSession()
          : await supabase.auth.getSession();
        
        if (error) {
          // Check for rate limit errors more reliably
          const isRateLimit = error.status === 429 || 
                            error.code === 'rate_limit' ||
                            error.message?.toLowerCase().includes('rate limit');
          
          if (!isRateLimit) {
            console.error('Error getting session:', error);
          }
          
          // Clear promise reference after delay even on error
          setTimeout(() => {
            fetchPromiseRef.current = null;
          }, 500);
          
          // Only return cached token if it's still valid
          const currentTime = Date.now();
          if (tokenCacheRef.current.token && tokenCacheRef.current.expiry > currentTime) {
            return tokenCacheRef.current.token;
          }
          
          // No valid cached token available
          return null;
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
          
          // Clear promise reference after a delay to prevent rapid successive calls
          setTimeout(() => {
            fetchPromiseRef.current = null;
          }, 500);
          
          return session.access_token;
        }

        // No session available - also clear promise after delay
        setTimeout(() => {
          fetchPromiseRef.current = null;
        }, 500);
        
        return null;
      })();

      return fetchPromiseRef.current;
    } catch (error) {
      console.error('Error fetching access token:', error);
      
      // Only return cached token if it's still valid
      const now = Date.now();
      if (tokenCacheRef.current.token && tokenCacheRef.current.expiry > now) {
        return tokenCacheRef.current.token;
      }
      
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