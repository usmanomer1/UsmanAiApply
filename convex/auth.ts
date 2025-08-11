/**
 * Authentication utilities for Convex functions
 * Using native Convex authentication with Supabase as the JWT provider
 */

/**
 * Get the authenticated user ID from the context
 * This uses native Convex authentication instead of manual token verification
 */
export async function getAuthUserId(ctx: any): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  
  // Supabase uses 'sub' as the user ID field in the JWT
  // The sub field contains the user's UUID from Supabase
  return identity.subject || identity.sub || null;
}

/**
 * Require authentication for a function
 * Throws an error if the user is not authenticated
 */
export async function requireAuth(ctx: any): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

/**
 * Check if a user is in demo mode (optional implementation)
 * Can be used to restrict certain operations for demo users
 */
export async function isDemoUser(ctx: any): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return true; // Treat unauthenticated users as demo users
  }
  
  // You can check for specific demo user emails or other criteria
  const email = identity.email;
  if (email && email.includes("demo")) {
    return true;
  }
  
  return false;
}

/**
 * Guard for write operations - can restrict demo users
 */
export async function requireWriteAccess(ctx: any): Promise<string> {
  const userId = await requireAuth(ctx);
  
  // Optional: Check if user is in demo mode and restrict writes
  const isDemo = await isDemoUser(ctx);
  if (isDemo) {
    // You can choose to allow or deny demo users
    // For now, we'll allow all authenticated users
    // throw new Error("Demo users cannot perform write operations");
  }
  
  return userId;
}