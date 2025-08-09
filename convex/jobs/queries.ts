import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../auth";

export const getSession = query({
  args: {
    authToken: v.string(), // Required for authentication
    sessionId: v.id("jobSearchSessions"),
  },
  handler: async (ctx, args) => {
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
    const session = await ctx.db.get(args.sessionId);
    
    // Verify the session belongs to this user
    if (session && session.userId !== userId) {
      throw new Error("Unauthorized: Session does not belong to this user");
    }
    
    return session;
  },
});

export const getUserSessions = query({
  args: {
    authToken: v.string(), // Required for authentication
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
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
    authToken: v.string(), // Required for authentication
    sessionId: v.id("jobSearchSessions"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
    // Verify the session belongs to this user
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.userId !== userId) {
      throw new Error("Unauthorized: Session does not belong to this user");
    }
    
    const limit = args.limit ?? 20;
    
    let jobsQuery = ctx.db
      .query("jobs")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc");
    
    const jobs = await jobsQuery.take(limit);
    
    // Parse JSON fields
    return jobs.map(job => ({
      ...job,
      job_highlights: job.job_highlights ? JSON.parse(job.job_highlights) : null,
      job_required_experience: job.job_required_experience ? JSON.parse(job.job_required_experience) : null,
      gaps_analysis: job.gaps_analysis ? JSON.parse(job.gaps_analysis) : null,
    }));
  },
});

export const getUserInteractions = query({
  args: {
    authToken: v.string(), // Required for authentication
    jobIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
    // Get interactions for this user and the specified jobs
    const interactions = await ctx.db
      .query("userJobInteractions")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    
    // Filter to only requested job IDs and create a map
    return interactions.reduce((acc, interaction) => {
      if (args.jobIds.includes(interaction.jobId)) {
        acc[interaction.jobId] = interaction;
      }
      return acc;
    }, {} as Record<string, any>);
  },
});

export const getSessionStats = query({
  args: {
    authToken: v.string(), // Required for authentication
    sessionId: v.id("jobSearchSessions"),
  },
  handler: async (ctx, args) => {
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
    // Verify the session belongs to this user
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.userId !== userId) {
      throw new Error("Unauthorized: Session does not belong to this user");
    }
    
    // Get job count for this session
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .collect();
    
    // Get user interactions for these jobs
    const jobIds = jobs.map(j => j.job_id);
    const interactions = await ctx.db
      .query("userJobInteractions")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    
    const likedCount = interactions.filter(i => 
      jobIds.includes(i.jobId) && i.interactionType === "liked"
    ).length;
    
    const appliedCount = interactions.filter(i => 
      jobIds.includes(i.jobId) && i.interactionType === "applied"
    ).length;
    
    return {
      totalJobs: jobs.length,
      likedJobs: likedCount,
      appliedJobs: appliedCount,
      status: session.status,
      processedCount: session.processedCount,
      totalFound: session.totalFound,
    };
  },
});