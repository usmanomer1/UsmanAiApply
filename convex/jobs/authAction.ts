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
      
      // Call backend API
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
      
      const backendResponse = await fetch(`${backendUrl}/api/jobs/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${args.authToken}`,
        },
        body: JSON.stringify({
          resumeText: args.resumeText,
          query: args.query,
          location: args.location,
          filters: args.filters,
          numJobs: args.numJobs || 100,
        }),
      });
      
      if (!backendResponse.ok) {
        throw new Error(`Backend error: ${backendResponse.status}`);
      }
      
      const data = await backendResponse.json();
      
      // Update session with results info
      await ctx.runMutation("jobs/mutations:updateSessionStatusInternal", {
        userId,
        sessionId: args.sessionId,
        status: "processing",
        totalFound: data.totalFound,
        searchCost: data.searchMetadata?.costMultiplier || 1,
      });
      
      // Store jobs in batches
      const BATCH_SIZE = 10;
      const jobs = data.jobs || [];
      
      for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        
        await ctx.runMutation("jobs/mutations:insertJobBatchInternal", {
          userId,
          sessionId: args.sessionId,
          jobs: batch,
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        
        // Small delay for smooth streaming effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Mark complete
      await ctx.runMutation("jobs/mutations:updateSessionStatusInternal", {
        userId,
        sessionId: args.sessionId,
        status: "completed",
      });
      
      return { success: true, jobsFound: jobs.length };
      
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