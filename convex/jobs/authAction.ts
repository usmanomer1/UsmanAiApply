import { v } from "convex/values";
import { action } from "../_generated/server";

/**
 * Action to verify Supabase token and create a search session
 * Actions can use fetch() unlike mutations
 */
export const createAuthenticatedSession = action({
  args: {
    authToken: v.string(),
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
    // Verify the token using Supabase API
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }
    
    // Clean the token
    const cleanToken = args.authToken.replace('Bearer ', '');
    
    try {
      // Verify token with Supabase
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          "Authorization": `Bearer ${cleanToken}`,
          "apikey": supabaseAnonKey,
        },
      });
      
      if (!response.ok) {
        throw new Error("Invalid authentication token");
      }
      
      const userData = await response.json();
      const userId = userData.id;
      
      if (!userId) {
        throw new Error("User ID not found in token");
      }
      
      // Now create the session using the internal mutation
      const sessionId = await ctx.runMutation("jobs/mutations:createSearchSessionInternal", {
        userId,
        query: args.query,
        location: args.location,
        resumeText: args.resumeText,
        filters: args.filters,
      });
      
      return sessionId;
    } catch (error) {
      console.error("Auth verification failed:", error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Action to verify token and start job search
 */
export const searchJobsAuthenticated = action({
  args: {
    authToken: v.string(),
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
    // Verify the token
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }
    
    const cleanToken = args.authToken.replace('Bearer ', '');
    
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          "Authorization": `Bearer ${cleanToken}`,
          "apikey": supabaseAnonKey,
        },
      });
      
      if (!response.ok) {
        throw new Error("Invalid authentication token");
      }
      
      const userData = await response.json();
      const userId = userData.id;
      
      // Update status to searching
      await ctx.runMutation("jobs/mutations:updateSessionStatusInternal", {
        userId,
        sessionId: args.sessionId,
        status: "searching",
      });
      
      // Call backend API with callback URL
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
      // Convex HTTP endpoints use the site subdomain
      const convexSiteUrl = process.env.CONVEX_SITE_URL || "https://veracious-meadowlark-646.convex.site";
      
      // Bundle location with query for better search results
      const searchQuery = args.location 
        ? `${args.query} in ${args.location}`
        : args.query;
      
      const backendResponse = await fetch(`${backendUrl}/api/jobs/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${args.authToken}`,
        },
        body: JSON.stringify({
          resumeText: args.resumeText,
          query: searchQuery, // Combined query with location
          location: args.location, // Still send separately for backend processing
          filters: args.filters,
          numJobs: args.numJobs || 100,
          callbackUrl: `${convexSiteUrl}/processBatch`, // Use .site domain for HTTP endpoints
          sessionId: args.sessionId, // Pass the Convex sessionId to backend
        }),
      });
      
      if (!backendResponse.ok) {
        throw new Error(`Backend error: ${backendResponse.status}`);
      }
      
      const data = await backendResponse.json();
      
      // Update session with initial info
      await ctx.runMutation("jobs/mutations:updateSessionStatusInternal", {
        userId,
        sessionId: args.sessionId,
        status: "processing",
        totalFound: data.totalFound,
        searchCost: data.searchMetadata?.costMultiplier || 1,
      });
      
      // Backend will send jobs via webhook to /processBatch endpoint
      // No need to process jobs here anymore
      
      return { 
        success: true, 
        sessionId: data.sessionId,
        totalFound: data.totalFound,
        message: "Jobs are being processed and will appear progressively"
      };
      
    } catch (error) {
      console.error("Search error:", error);
      
      // Try to update status to error (may fail if auth issue)
      try {
        await ctx.runMutation("jobs/mutations:updateSessionStatusInternal", {
          userId: "unknown",
          sessionId: args.sessionId,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Search failed",
        });
      } catch {}
      
      throw error;
    }
  },
});