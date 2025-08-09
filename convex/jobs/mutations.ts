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