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

// Get liked jobs with cached data
export const getLikedJobsWithData = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    const limit = args.limit ?? 50;
    
    // Get all liked jobs with cached data
    const likedJobs = await ctx.db
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
    
    // Return jobs with their cached data
    return likedJobs.map(interaction => ({
      jobId: interaction.jobId,
      ...interaction.cachedJobData,
      likedAt: interaction.timestamp,
    }));
  },
});

// Get user interactions for specific job IDs (for current search results)
export const getUserInteractions = query({
  args: {
    jobIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {};
    }
    
    // Get interactions for requested job IDs only
    const interactionMap: Record<string, string> = {};
    
    for (const jobId of args.jobIds) {
      const interaction = await ctx.db
        .query("userJobInteractions")
        .withIndex("by_user_job")
        .filter(q => 
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("jobId"), jobId)
          )
        )
        .first();
      
      if (interaction) {
        interactionMap[jobId] = interaction.action;
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