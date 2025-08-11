/**
 * JWT Bridge Authentication for Convex + Supabase
 * This module creates native Convex auth context from Supabase JWTs
 */

import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

// Type for our auth context
export interface AuthContext {
  userId: string;
  email?: string;
  role?: string;
}

/**
 * Custom auth implementation that bridges Supabase JWTs to Convex auth context
 * This allows us to use ctx.auth.getUserIdentity() with Supabase tokens
 */
export async function getAuthContext(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<AuthContext | null> {
  try {
    // Get the user identity from Convex's built-in auth
    // This will be populated by our custom JWT handler
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      return null;
    }
    
    // Extract user info from the identity
    // Supabase puts the user ID in the 'sub' claim
    const userId = identity.subject || identity.sub || identity.tokenIdentifier;
    
    if (!userId) {
      console.error("No user ID found in identity:", identity);
      return null;
    }
    
    return {
      userId,
      email: identity.email,
      role: identity.role || "authenticated",
    };
  } catch (error) {
    console.error("Error getting auth context:", error);
    return null;
  }
}

/**
 * Get just the user ID (convenience function)
 */
export async function getAuthUserId(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<string | null> {
  const authContext = await getAuthContext(ctx);
  return authContext?.userId || null;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

/**
 * Check if user is authenticated (doesn't throw)
 */
export async function isAuthenticated(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  return !!userId;
}

/**
 * Check if a user is in demo mode (optional implementation)
 */
export async function isDemoUser(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<boolean> {
  const authContext = await getAuthContext(ctx);
  if (!authContext) {
    return true; // Treat unauthenticated as demo
  }
  
  // Check for demo indicators
  if (authContext.email?.includes("demo") || authContext.email?.includes("test")) {
    return true;
  }
  
  return false;
}

/**
 * Guard for write operations - can restrict demo users
 */
export async function requireWriteAccess(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<string> {
  const userId = await requireAuth(ctx);
  
  // Optional: Check if user is in demo mode and restrict
  const isDemo = await isDemoUser(ctx);
  if (isDemo) {
    // For now, allow all authenticated users
    // Uncomment to restrict: throw new Error("Demo users cannot perform write operations");
  }
  
  return userId;
}