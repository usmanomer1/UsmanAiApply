// Configuration for Supabase Edge Functions
// Handles local vs production URLs

const isLocal = import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_FUNCTIONS === 'true'

// For local testing with `supabase functions serve`
const LOCAL_FUNCTIONS_URL = 'http://localhost:54321/functions/v1'

// Production functions URL (uses your Supabase project URL)
const PROD_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export const FUNCTIONS_URL = isLocal ? LOCAL_FUNCTIONS_URL : PROD_FUNCTIONS_URL

export const getFunctionUrl = (functionName: string) => {
  return `${FUNCTIONS_URL}/${functionName}`
}

// Helper to check if we're using local functions
export const isUsingLocalFunctions = () => isLocal

// Log the current mode for debugging
if (import.meta.env.DEV) {
  console.log(`🔧 Edge Functions Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`)
  console.log(`📍 Functions URL: ${FUNCTIONS_URL}`)
}