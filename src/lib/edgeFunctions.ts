// Helper for calling edge functions (local or production)
import { supabase } from './supabase';

const isLocal = import.meta.env.VITE_USE_LOCAL_FUNCTIONS === 'true';
const LOCAL_FUNCTIONS_URL = 'http://localhost:54321/functions/v1';

export async function invokeFunction<T = any>(
  functionName: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: any }> {
  try {
    // Get the session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('No session') };
    }

    // Use direct fetch for both local and production to ensure headers are sent correctly
    const baseUrl = isLocal 
      ? LOCAL_FUNCTIONS_URL 
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    
    const response = await fetch(`${baseUrl}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, // Required for Supabase edge functions
        ...options?.headers,
      },
      body: JSON.stringify(options?.body || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Function ${functionName} error:`, response.status, errorText);
      return { 
        data: null, 
        error: new Error(`Function error: ${response.status} - ${errorText}`) 
      };
    }

    const data = await response.json();
    return { data, error: null };
    
  } catch (error) {
    console.error(`Exception in invokeFunction for ${functionName}:`, error);
    return { data: null, error };
  }
}

// For SSE streaming (automation-stream)
export function getStreamUrl(functionName: string, params?: Record<string, string>): string {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  if (isLocal) {
    return `${LOCAL_FUNCTIONS_URL}/${functionName}${queryString}`;
  } else {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}${queryString}`;
  }
}

// Get auth headers for SSE streaming
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
  };
}

// Log current mode
if (import.meta.env.DEV) {
  console.log(`🔧 Edge Functions Mode: ${isLocal ? 'LOCAL (localhost:54321)' : 'PRODUCTION'}`);
}