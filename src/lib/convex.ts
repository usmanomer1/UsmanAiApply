import { ConvexReactClient } from "convex/react";
import { supabase } from "./supabase";

// Get the Convex URL from environment variable
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL environment variable. " +
    "Check that your .env.local file contains VITE_CONVEX_URL"
  );
}

// Create and export the Convex client
export const convex = new ConvexReactClient(convexUrl);

// Attach Supabase auth token to Convex client for per-user identity
// Initial token setup
convex.setAuth(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});

// Keep Convex auth in sync with Supabase auth state
supabase.auth.onAuthStateChange((_event, session) => {
  convex.setAuth(async () => session?.access_token ?? null);
});

// Helper to check if Convex is properly configured
export const isConvexConfigured = () => {
  return !!convexUrl;
};