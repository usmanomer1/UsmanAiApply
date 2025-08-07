import { ConvexReactClient } from "convex/react";

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

// Helper to check if Convex is properly configured
export const isConvexConfigured = () => {
  return !!convexUrl;
};