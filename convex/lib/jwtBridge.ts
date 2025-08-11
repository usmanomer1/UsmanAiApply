/**
 * JWT Bridge for Supabase authentication in Convex
 * This module handles the validation and processing of Supabase JWTs
 * since Convex doesn't have native Supabase support
 */

interface SupabaseJWTPayload {
  sub: string; // User ID
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

/**
 * Validates a Supabase token by calling the Supabase API
 * This is used in actions where we can make HTTP requests
 */
export async function validateSupabaseToken(token: string): Promise<SupabaseJWTPayload | null> {
  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase configuration missing");
    return null;
  }

  try {
    // Clean the token (remove Bearer prefix if present)
    const cleanToken = token.replace(/^Bearer\s+/i, "");
    
    // Validate token with Supabase
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cleanToken}`,
        "apikey": supabaseAnonKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error("Invalid or expired token");
      }
      return null;
    }

    const userData = await response.json();
    
    // Return a normalized payload
    return {
      sub: userData.id,
      email: userData.email,
      role: userData.role || "authenticated",
      aud: userData.aud || "authenticated",
    };
  } catch (error) {
    console.error("Error validating token:", error);
    return null;
  }
}

/**
 * Extract user ID from a validated token payload
 */
export function getUserIdFromPayload(payload: SupabaseJWTPayload): string {
  return payload.sub;
}

/**
 * Simple JWT decode without verification (for client-side use only)
 * DO NOT use this for security decisions
 */
export function decodeJWT(token: string): any {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, "");
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}