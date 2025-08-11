import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { requireAuth, getAuthUserId } from "../auth";
import { checkJobSearchLimit } from "../rateLimiter";

export const createSearchSession = mutation({
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
    // Verify authentication using native Convex auth
    const userId = await requireAuth(ctx);
    
    // Check rate limit for this user
    const rateLimitCheck = await checkJobSearchLimit(ctx, userId);
    
    if (!rateLimitCheck.allowed) {
      // Throw an error with rate limit info
      throw new Error(JSON.stringify({
        type: "RATE_LIMIT",
        message: rateLimitCheck.message,
        retryAfter: rateLimitCheck.retryAfter,
        retryInSeconds: rateLimitCheck.retryInSeconds,
      }));
    }
    
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
    // No authToken needed - using native Convex auth
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
    // Verify authentication using native Convex auth
    const userId = await requireAuth(ctx);
    
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

// Like a job and cache its data
export const likeJob = mutation({
  args: {
    jobId: v.string(),
    jobData: v.object({
      job_title: v.string(),
      employer_name: v.string(),
      employer_logo: v.optional(v.string()),
      job_city: v.optional(v.string()),
      job_state: v.optional(v.string()),
      job_country: v.optional(v.string()),
      job_is_remote: v.boolean(),
      job_apply_link: v.string(),
      job_description: v.string(),
      job_posted_at_datetime_utc: v.optional(v.string()),
      match_score: v.optional(v.number()),
      missing_skills: v.optional(v.array(v.string())),
      matching_skills: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Check if already liked
    const existing = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_job", q => q.eq("userId", userId).eq("jobId", args.jobId))
      .filter(q => q.eq(q.field("action"), "liked"))
      .first();
    
    if (existing) {
      return { success: true, message: "Already liked" };
    }
    
    // Store the like with cached job data
    await ctx.db.insert("userJobInteractions", {
      userId,
      jobId: args.jobId,
      action: "liked",
      cachedJobData: args.jobData,
      timestamp: Date.now(),
    });
    
    return { success: true };
  },
});

// Unlike a job
export const unlikeJob = mutation({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    const interaction = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_job", q => q.eq("userId", userId).eq("jobId", args.jobId))
      .filter(q => q.eq(q.field("action"), "liked"))
      .first();
    
    if (interaction) {
      await ctx.db.delete(interaction._id);
    }
    
    return { success: true };
  },
});

// Mark job as applied
export const markApplied = mutation({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Check if already marked
    const existing = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_job", q => q.eq("userId", userId).eq("jobId", args.jobId))
      .filter(q => q.eq(q.field("action"), "applied"))
      .first();
    
    if (!existing) {
      await ctx.db.insert("userJobInteractions", {
        userId,
        jobId: args.jobId,
        action: "applied",
        timestamp: Date.now(),
      });
    }
    
    return { success: true };
  },
});

export const saveJobInteraction = mutation({
  args: {
    // No userId needed - get from auth context
    jobId: v.string(),
    interactionType: v.union(
      v.literal("liked"),
      v.literal("applied"),
      v.literal("hidden")
    ),
  },
  handler: async (ctx, args) => {
    // Get userId from native Convex auth
    const userId = await requireAuth(ctx);
    
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
        action: args.interactionType,
        timestamp: Date.now(),
      });
    } else {
      // Create new interaction
      await ctx.db.insert("userJobInteractions", {
        userId,
        jobId: args.jobId,
        action: args.interactionType,
        timestamp: Date.now(),
      });
    }
  },
});

export const removeJobInteraction = mutation({
  args: {
    // No authToken needed - using native Convex auth
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication using native Convex auth
    const userId = await requireAuth(ctx);
    
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
    if (!session) {
      throw new Error("Session not found");
    }
    // Allow webhook updates (userId = "webhook") or matching user
    if (args.userId !== "webhook" && session.userId !== args.userId) {
      throw new Error("Unauthorized");
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
    if (!session) {
      throw new Error("Session not found");
    }
    // Allow webhook updates (userId = "webhook") or matching user
    if (args.userId !== "webhook" && session.userId !== args.userId) {
      throw new Error("Unauthorized");
    }
    
    // Insert jobs with sessionId and proper field formatting
    for (const job of args.jobs) {
      // Define allowed fields based on the schema
      const schemaFields = new Set([
        'job_id', 'employer_name', 'employer_logo', 'employer_website', 'employer_company_type',
        'job_title', 'job_description', 'job_apply_link', 'job_apply_is_direct', 'job_apply_quality_score',
        'apply_options', 'job_is_remote', 'job_city', 'job_state', 'job_country',
        'job_latitude', 'job_longitude', 'job_posted_at_timestamp', 'job_posted_at_datetime_utc',
        'job_offer_expiration_timestamp', 'job_required_experience', 'job_required_skills',
        'job_required_education', 'job_min_salary', 'job_max_salary', 'job_salary_currency',
        'job_salary_period', 'job_highlights', 'job_benefits', 'job_onet_soc', 'job_onet_job_zone',
        'match_score', 'full_analysis', 'resume_improvements', 'gaps_analysis',
        'missing_skills', 'matching_skills', 'strengths_for_role', 'red_flags', 'application_strategy'
      ]);
      
      // Handle fields that need to be JSON stringified
      const formattedJob: any = {
        sessionId: args.sessionId,
        batchIndex: args.batchIndex,
        createdAt: Date.now(),
      };
      
      // Copy only allowed fields, handling special cases
      for (const [key, value] of Object.entries(job)) {
        // Skip fields not in schema
        if (!schemaFields.has(key)) {
          continue;
        }
        
        // Skip null values - Convex expects undefined instead of null for optional fields
        if (value === null) {
          continue;
        }
        
        if (key === 'apply_options' && typeof value !== 'string') {
          // JSON stringify apply_options if it's not already a string
          formattedJob[key] = JSON.stringify(value);
        } else if ((key === 'job_highlights' || key === 'job_required_experience' || 
                   key === 'job_required_education' || key === 'gaps_analysis' || 
                   key === 'full_analysis') && 
                   typeof value !== 'string' && value !== undefined) {
          // JSON stringify other object fields
          formattedJob[key] = JSON.stringify(value);
        } else {
          // Copy as-is for other fields
          formattedJob[key] = value;
        }
      }
      
      await ctx.db.insert("jobs", formattedJob);
    }
    
    // Update processed count
    await ctx.db.patch(args.sessionId, {
      processedCount: session.processedCount + args.jobs.length,
    });
  },
});