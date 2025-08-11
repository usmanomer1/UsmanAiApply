import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Action to verify Supabase token and create a search session
 * Actions can use fetch() unlike mutations
 */
export const createAuthenticatedSession = action({
  args: {
    authToken: v.optional(v.string()),
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
  handler: async (ctx, args): Promise<string> => {
    // Demo mode guard
    if (process.env.DEMO_MODE === "true") {
      throw new Error("Writes disabled in demo mode");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Now create the session using the internal mutation
    const sessionId: string = await ctx.runMutation(internal.jobs.mutations.createSearchSessionInternal, {
      userId: identity.subject,
      query: args.query,
      location: args.location,
      resumeText: args.resumeText,
      filters: args.filters,
    });
    
    return sessionId;
  },
});

/**
 * Action to verify token and start job search
 */
export const searchJobsAuthenticated = action({
  args: {
    authToken: v.optional(v.string()),
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
  handler: async (ctx, args): Promise<{ success: true; sessionId: any; totalFound: number; message: string; }> => {
    // Demo mode guard
    if (process.env.DEMO_MODE === "true") {
      throw new Error("Writes disabled in demo mode");
    }

    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthorized");

      // Update status to searching
      await ctx.runMutation(internal.jobs.mutations.updateSessionStatusInternal, {
        userId: identity.subject,
        sessionId: args.sessionId,
        status: "searching",
      });

      // Call backend API with callback URL
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
      // Convex HTTP endpoints use the site subdomain
      const convexSiteUrl = process.env.CONVEX_SITE_URL || "https://veracious-meadowlark-646.convex.site";

      const searchQuery = args.location 
        ? `${args.query} in ${args.location}`
        : args.query;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // If your backend wants the Supabase token, keep forwarding it if provided
      if (args.authToken) headers["Authorization"] = `Bearer ${args.authToken}`;
      // If you add a webhook secret, also forward it back for callbacks
      if (process.env.BACKEND_WEBHOOK_SECRET) {
        headers["X-Backend-Secret"] = process.env.BACKEND_WEBHOOK_SECRET;
      }

      const backendResponse = await fetch(`${backendUrl}/api/jobs/match`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          resumeText: args.resumeText,
          query: searchQuery,
          location: args.location,
          filters: args.filters,
          numJobs: args.numJobs || 100,
          callbackUrl: `${convexSiteUrl}/processBatch`,
          sessionId: args.sessionId,
        }),
      });

      if (!backendResponse.ok) {
        throw new Error(`Backend error: ${backendResponse.status}`);
      }

      const data = await backendResponse.json();

      await ctx.runMutation(internal.jobs.mutations.updateSessionStatusInternal, {
        userId: identity.subject,
        sessionId: args.sessionId,
        status: "processing",
        totalFound: data.totalFound,
        searchCost: data.searchMetadata?.costMultiplier || 1,
      });

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
        await ctx.runMutation(internal.jobs.mutations.updateSessionStatusInternal, {
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