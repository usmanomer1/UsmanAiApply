import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * This action calls YOUR backend API and stores the results
 * NO Convex code in backend needed!
 */
export const searchJobs = action({
  args: {
    // No authToken needed - backend is authless
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
    try {
      // Update status to searching
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        // No authToken needed - mutation uses native auth
        sessionId: args.sessionId,
        status: "searching",
      });

      // Call YOUR backend API
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
      
      const response = await fetch(`${backendUrl}/api/jobs/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Backend is authless - no auth header needed
        },
        body: JSON.stringify({
          resumeText: args.resumeText,
          query: args.query,
          location: args.location,
          filters: args.filters,
          numJobs: args.numJobs || 100, // Default to 100 for best value
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      
      // Update session with results info
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        // No authToken needed - mutation uses native auth
        sessionId: args.sessionId,
        status: "processing",
        totalFound: data.totalFound,
        searchCost: data.searchMetadata?.costMultiplier || 1,
      });

      // Store jobs in batches for smooth UI updates
      const BATCH_SIZE = 10;
      const jobs = data.jobs || [];
      
      for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        
        await ctx.runMutation(api.jobs.mutations.insertJobBatch, {
          // No authToken needed - mutation uses native auth
          sessionId: args.sessionId,
          jobs: batch,
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        
        // Small delay for smooth streaming effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark complete
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        // No authToken needed - mutation uses native auth
        sessionId: args.sessionId,
        status: "completed",
      });

      return { success: true, jobsFound: jobs.length };
      
    } catch (error) {
      console.error("Search error:", error);
      
      await ctx.runMutation(api.jobs.mutations.updateSessionStatus, {
        // No authToken needed - mutation uses native auth
        sessionId: args.sessionId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Search failed",
      });
      
      throw error;
    }
  },
});