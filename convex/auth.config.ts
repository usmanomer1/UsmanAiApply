// Supabase project configuration
const supabaseUrl = process.env.SUPABASE_URL || "https://wqyquvgduwjkyadkumkl.supabase.co";
const supabaseProjectId = supabaseUrl.replace("https://", "").split(".")[0];

export default {
  providers: [
    {
      type: "customJwt" as const,
      // Supabase JWT issuer
      issuer: `https://${supabaseProjectId}.supabase.co/auth/v1`,
      // RS256 algorithm used by Supabase
      algorithm: "RS256" as const,
      // Supabase JWKS endpoint for JWT verification
      jwks: `https://${supabaseProjectId}.supabase.co/auth/v1/.well-known/jwks.json`,
      // Application ID (audience) - using Supabase project URL
      applicationID: supabaseUrl,
    },
  ],
};