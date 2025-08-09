import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { requireAuth } from "../auth";

export const createSearchSession = mutation({
  args: {
    authToken: v.string(), // Required for authentication
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
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
    const sessionId = await ctx.db.insert("jobSearchSessions", {
      userId, // Use authenticated userId
      query: args.query,
      location: args.location,
      resumeText: args.resumeText,
      filters: args.filters,
      status: "initializing",
      totalFound: 0,
      processedCount: 0,
      createdAt: Date.now(),
    });
    
    return sessionId;
  },
});

export const updateSessionStatus = mutation({
  args: {
    authToken: v.string(), // Required for authentication
    sessionId: v.id("jobSearchSessions"),
    status: v.union(
      v.literal("initializing"),
      v.literal("searching"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    totalFound: v.optional(v.number()),
    searchCost: v.optional(v.number()),
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
    
    const updates: any = {
      status: args.status,
    };
    
    if (args.errorMessage) updates.errorMessage = args.errorMessage;
    if (args.totalFound !== undefined) updates.totalFound = args.totalFound;
    if (args.searchCost !== undefined) updates.searchCost = args.searchCost;
    
    await ctx.db.patch(args.sessionId, updates);
  },
});

export const insertJobBatch = mutation({
  args: {
    authToken: v.string(), // Required for authentication
    sessionId: v.id("jobSearchSessions"),
    jobs: v.array(v.any()),
    batchIndex: v.number(),
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
    
    // Insert each job with proper formatting
    for (const job of args.jobs) {
      await ctx.db.insert("jobs", {
        sessionId: args.sessionId,
        job_id: job.job_id || job.id,
        employer_name: job.employer_name || job.company || "Unknown",
        job_title: job.job_title || job.title || "Unknown Position",
        job_description: job.job_description || job.description || "",
        job_apply_link: job.job_apply_link || job.applyUrl || "",
        job_city: job.job_city || job.location?.city || "",
        job_state: job.job_state || job.location?.state || "",
        job_country: job.job_country || job.location?.country || "",
        job_is_remote: job.job_is_remote || false,
        job_posted_at_datetime_utc: job.job_posted_at_datetime_utc || new Date().toISOString(),
        
        // JSON stringified fields for complex data
        job_highlights: JSON.stringify(job.job_highlights || {}),
        job_required_experience: JSON.stringify(job.job_required_experience || {}),
        
        // Scoring and analysis
        match_score: job.match_score || 0,
        gaps_analysis: JSON.stringify(job.gaps_analysis || {}),
        
        batchIndex: args.batchIndex,
        createdAt: Date.now(),
      });
    }
    
    // Update session processed count
    const currentSession = await ctx.db.get(args.sessionId);
    if (currentSession) {
      await ctx.db.patch(args.sessionId, {
        processedCount: (currentSession.processedCount || 0) + args.jobs.length,
      });
    }
  },
});

export const saveJobInteraction = mutation({
  args: {
    userId: v.string(), // Trust frontend auth
    jobId: v.string(),
    interactionType: v.union(
      v.literal("liked"),
      v.literal("applied"),
      v.literal("hidden")
    ),
  },
  handler: async (ctx, args) => {
    // Use userId from args (frontend already authenticated)
    const userId = args.userId;
    
    // Check if interaction already exists
    const existing = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_job")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("jobId"), args.jobId)
        )
      )
      .first();
    
    if (existing) {
      // Update existing interaction
      await ctx.db.patch(existing._id, {
        interactionType: args.interactionType,
      });
    } else {
      // Create new interaction
      await ctx.db.insert("userJobInteractions", {
        userId,
        jobId: args.jobId,
        interactionType: args.interactionType,
        createdAt: Date.now(),
      });
    }
  },
});

export const removeJobInteraction = mutation({
  args: {
    authToken: v.string(), // Required for authentication
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication and get userId
    const userId = await requireAuth(args.authToken);
    
    // Find and delete the interaction
    const interaction = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_job")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("jobId"), args.jobId)
        )
      )
      .first();
    
    if (interaction) {
      await ctx.db.delete(interaction._id);
    }
  },
});

// Internal mutations that don't require auth (called from actions after auth verification)
export const createSearchSessionInternal = internalMutation({
  args: {
    userId: v.string(),
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
    const sessionId = await ctx.db.insert("jobSearchSessions", {
      userId: args.userId,
      query: args.query,
      location: args.location,
      resumeText: args.resumeText,
      filters: args.filters,
      status: "initializing",
      totalFound: 0,
      processedCount: 0,
      createdAt: Date.now(),
    });
    
    return sessionId;
  },
});

export const updateSessionStatusInternal = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id("jobSearchSessions"),
    status: v.union(
      v.literal("initializing"),
      v.literal("searching"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    totalFound: v.optional(v.number()),
    searchCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or unauthorized");
    }
    
    const updates: any = {
      status: args.status,
    };
    
    if (args.totalFound !== undefined) {
      updates.totalFound = args.totalFound;
    }
    
    if (args.searchCost !== undefined) {
      updates.searchCost = args.searchCost;
    }
    
    if (args.errorMessage) {
      updates.errorMessage = args.errorMessage;
    }
    
    await ctx.db.patch(args.sessionId, updates);
  },
});

export const insertJobBatchInternal = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id("jobSearchSessions"),
    jobs: v.array(v.any()),
    batchIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or unauthorized");
    }
    
    // Insert jobs with sessionId
    for (const job of args.jobs) {
      await ctx.db.insert("jobs", {
        ...job,
        sessionId: args.sessionId,
        batchIndex: args.batchIndex,
        createdAt: Date.now(),
      });
    }
    
    // Update processed count
    await ctx.db.patch(args.sessionId, {
      processedCount: session.processedCount + args.jobs.length,
    });
  },
});