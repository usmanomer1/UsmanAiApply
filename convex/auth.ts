/**
 * Authentication utilities for Convex functions
 * Since Convex runs in a sandboxed environment, we'll verify tokens
 * by calling Supabase's API to validate the session
 */

// Type for the decoded Supabase JWT
interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
  aud?: string;
}

/**
 * Verify a Supabase JWT token by calling Supabase's API
 * This approach works in Convex's sandboxed environment
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseUser> {
  if (!token) {
    throw new Error("No authentication token provided");
  }

  // Get Supabase URL from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase configuration missing");
  }

  try {
    // Remove "Bearer " prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, "");
    
    // Call Supabase's /auth/v1/user endpoint to validate the token
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cleanToken}`,
        "apikey": supabaseAnonKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid or expired authentication token");
      }
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const userData = await response.json();
    
    if (!userData || !userData.id) {
      throw new Error("Invalid user data received");
    }

    return {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      aud: userData.aud,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid or expired")) {
      throw error;
    }
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract user ID from Supabase token
 */
export async function getUserIdFromToken(token: string): Promise<string> {
  const user = await verifySupabaseToken(token);
  return user.id;
}

/**
 * Simple auth check for queries/mutations that just need user ID
 */
export async function requireAuth(token: string | undefined): Promise<string> {
  if (!token) {
    throw new Error("Authentication required");
  }
  
  const userId = await getUserIdFromToken(token);
  if (!userId) {
    throw new Error("Invalid authentication");
  }
  
  return userId;
}