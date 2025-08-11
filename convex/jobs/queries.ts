import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthUserId } from "../auth";

// Queries use native Convex authentication
// The user is authenticated via JWT from Supabase

export const getSession = query({
  args: {
    sessionId: v.id("jobSearchSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session;
  },
});

export const getUserSessions = query({
  args: {
    // No userId needed - get from auth context
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return []; // Return empty array if not authenticated
    }
    
    const limit = args.limit ?? 10;
    
    // Get user's sessions, ordered by creation date
    const sessions = await ctx.db
      .query("jobSearchSessions")
      .filter(q => q.eq(q.field("userId"), userId))
      .order("desc")
      .take(limit);
    
    return sessions;
  },
});

export const getSessionJobs = query({
  args: {
    sessionId: v.id("jobSearchSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    
    // Get all jobs for this session
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_session")
      .filter(q => q.eq(q.field("sessionId"), args.sessionId))
      .order("asc")
      .take(limit);
    
    return jobs;
  },
});

export const getUserInteractions = query({
  args: {
    // No userId needed - get from auth context
    jobIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {}; // Return empty map if not authenticated
    }
    
    // Get all interactions for these jobs
    const interactions = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_action")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    
    // Filter for requested job IDs and convert to map
    const interactionMap: Record<string, any> = {};
    
    for (const interaction of interactions) {
      if (args.jobIds.includes(interaction.jobId)) {
        // Convert action field to interactionType for frontend compatibility
        interactionMap[interaction.jobId] = {
          ...interaction,
          interactionType: interaction.action
        };
      }
    }
    
    return interactionMap;
  },
});

export const getLikedJobs = query({
  args: {
    // No userId needed - get from auth context
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return []; // Return empty array if not authenticated
    }
    
    const limit = args.limit ?? 50;
    
    // Get liked job interactions
    const likedInteractions = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_action")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("action"), "liked")
        )
      )
      .order("desc")
      .take(limit);
    
    // Get the actual job details
    const jobs = [];
    for (const interaction of likedInteractions) {
      // Find the job by job_id
      const job = await ctx.db
        .query("jobs")
        .filter(q => q.eq(q.field("job_id"), interaction.jobId))
        .first();
      
      if (job) {
        jobs.push(job);
      }
    }
    
    return jobs;
  },
});