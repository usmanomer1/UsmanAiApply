// Convex authentication configuration for Supabase
// Requires Supabase to have asymmetric JWT signing keys (ES256) configured

const supabaseProjectRef = "wqyquvgduwjkyadkumkl";
const supabaseUrl = `https://${supabaseProjectRef}.supabase.co`;

export default {
  providers: [
    {
      type: "customJwt" as const,
      // The issuer must match the 'iss' field in Supabase JWTs (includes /auth/v1)
      issuer: `${supabaseUrl}/auth/v1`,
      // JWKS endpoint for public key verification
      jwks: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      // Algorithm used by Supabase (ES256 for elliptic curve keys)
      algorithm: "ES256" as const,
      // Verify the 'aud' claim matches
      applicationID: "authenticated",
    },
  ],
};