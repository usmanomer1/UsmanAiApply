import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to get the current authentication state for Convex
 * With native Convex auth, we no longer need to manage tokens manually
 */
export function useConvexAuth() {
  const { user } = useAuth();

  return {
    isAuthenticated: !!user,
    userId: user?.id || null,
    user,
  };
}