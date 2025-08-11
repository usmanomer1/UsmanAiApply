// Convex authentication configuration for Supabase
// Requires Supabase to have asymmetric JWT signing keys (RS256) configured

const supabaseProjectRef = "wqyquvgduwjkyadkumkl";
const supabaseUrl = `https://${supabaseProjectRef}.supabase.co`;

export default {
  providers: [
    {
      type: "customJwt" as const,
      // The issuer must match the 'iss' field in Supabase JWTs
      issuer: supabaseUrl,
      // JWKS endpoint for public key verification
      jwks: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      // Algorithm used by Supabase (ES256 for elliptic curve keys)
      algorithm: "ES256" as const,
      // Optional: verify the 'aud' claim matches
      applicationID: "authenticated",
    },
  ],
};