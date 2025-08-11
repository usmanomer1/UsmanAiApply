import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Action to create a search session using native Convex auth
 * No manual token verification needed
 */
export const createAuthenticatedSession = action({
  args: {
    // No authToken needed - using native Convex auth
    query: v.string(),
    location: v.optional(v.string()),
    resumeText: v.string(),
    filters: v.object({
      datePosted: v.optional(v.string()),
      remote: v.optional(v.boolean()),
      employmentTypes: v.optional(v.array(v.string())),
      experienceLevel: v.optional(v.array(v.string())),
      radius: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    // Get user identity from native Convex auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    // Get user ID from the identity (Supabase uses 'sub' field)
    const userId = identity.subject || identity.sub;
    if (!userId) {
      throw new Error("User ID not found in authentication");
    }
    
    // Create the session using the mutation (which also uses native auth)
    const sessionId = await ctx.runMutation(api.jobs.mutations.createSearchSession, {
      query: args.query,
      location: args.location,
      resumeText: args.resumeText,
      filters: args.filters,
    });
    
    return sessionId;
  },
});

/**
 * Action to start job search using native Convex auth
 */
export const searchJobsAuthenticated = action({
  args: {
    // No authToken needed - using native Convex auth
    sessionId: v.id("jobSearchSessions"),
    query: v.string(),
    location: v.optional(v.string()),
    resumeText: v.string(),
    filters: v.object({
      datePosted: v.optional(v.string()),
      remote: v.optional(v.boolean()),
      employmentTypes: v.optional(v.array(v.string())),
      experienceLevel: v.optional(v.array(v.string())),
      radius: v.optional(v.number()),
    }),
    numJobs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get user identity from native Convex auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    // Get user ID from the identity
    const userId = identity.subject || identity.sub;
    if (!userId) {
      throw new Error("User ID not found in authentication");
    }
    
    // Call backend API with callback URL
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
    
    // Get Convex site URL from environment variable
    // This should be set to your Convex deployment's site URL
    // e.g., https://veracious-meadowlark-646.convex.site for dev
    // or your production URL for prod
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    
    if (!convexSiteUrl) {
      throw new Error("CONVEX_SITE_URL environment variable is not configured");
    }
    
    try {
      // Update status to searching
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        sessionId: args.sessionId,
        status: "searching",
      });
      
      // Bundle location with query for better search results
      const searchQuery = args.location 
        ? `${args.query} in ${args.location}`
        : args.query;
      
      const backendResponse = await fetch(`${backendUrl}/api/jobs/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Backend is authless - no auth header needed
        },
        body: JSON.stringify({
          resumeText: args.resumeText,
          query: searchQuery, // Combined query with location
          location: args.location, // Still send separately for backend processing
          filters: args.filters,
          numJobs: args.numJobs || 100,
          callbackUrl: `${convexSiteUrl}/processBatch`, // Webhook URL for job batches
          sessionId: args.sessionId, // Pass the Convex sessionId to backend
        }),
      });
      
      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        throw new Error(`Backend error: ${backendResponse.status} - ${errorText}`);
      }
      
      const data = await backendResponse.json();
      
      // Update session with initial info
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        sessionId: args.sessionId,
        status: "processing",
        totalFound: data.totalFound,
        searchCost: data.searchMetadata?.costMultiplier || 1,
      });
      
      // Backend will send jobs via webhook to /processBatch endpoint
      return { 
        success: true, 
        sessionId: args.sessionId,
        totalFound: data.totalFound,
        message: "Jobs are being processed and will appear progressively"
      };
      
    } catch (error) {
      console.error("Search error:", error);
      
      // Update status to error
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        sessionId: args.sessionId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Search failed",
      });
      
      throw error;
    }
  },
});