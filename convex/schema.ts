import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Job search sessions
  jobSearchSessions: defineTable({
    userId: v.string(),
    
    // Search params
    query: v.string(),
    location: v.optional(v.string()),
    resumeText: v.string(),
    
    // Filters
    filters: v.object({
      datePosted: v.optional(v.string()),
      remote: v.optional(v.boolean()),
      employmentTypes: v.optional(v.array(v.string())),
      experienceLevel: v.optional(v.array(v.string())),
      radius: v.optional(v.number()),
    }),
    
    // Status
    status: v.union(
      v.literal("initializing"),
      v.literal("searching"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
    
    // Progress
    totalFound: v.number(),
    processedCount: v.number(),
    errorMessage: v.optional(v.string()),
    
    // Metadata
    searchCost: v.optional(v.number()), // 1x, 2x, or 3x based on pages
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_status", ["status"]),

  // Jobs from backend
  jobs: defineTable({
    sessionId: v.id("jobSearchSessions"),
    batchIndex: v.number(),
    
    // ==== JSearch Core Fields ====
    job_id: v.string(),
    employer_name: v.string(),
    employer_logo: v.optional(v.string()),
    employer_website: v.optional(v.string()),
    employer_company_type: v.optional(v.string()),
    
    job_title: v.string(),
    job_description: v.string(),
    job_apply_link: v.string(),
    job_apply_is_direct: v.optional(v.boolean()),
    job_apply_quality_score: v.optional(v.number()),
    apply_options: v.optional(v.string()), // JSON array
    
    // Location
    job_is_remote: v.boolean(),
    job_city: v.optional(v.string()),
    job_state: v.optional(v.string()),
    job_country: v.optional(v.string()),
    job_latitude: v.optional(v.number()),
    job_longitude: v.optional(v.number()),
    
    // Dates
    job_posted_at_timestamp: v.optional(v.number()),
    job_posted_at_datetime_utc: v.optional(v.string()),
    job_offer_expiration_timestamp: v.optional(v.number()),
    
    // Requirements
    job_required_experience: v.optional(v.string()), // JSON
    job_required_skills: v.optional(v.array(v.string())),
    job_required_education: v.optional(v.string()), // JSON
    
    // Salary
    job_min_salary: v.optional(v.number()),
    job_max_salary: v.optional(v.number()),
    job_salary_currency: v.optional(v.string()),
    job_salary_period: v.optional(v.string()),
    
    // Rich data
    job_highlights: v.optional(v.string()), // JSON with Qualifications, Responsibilities, Benefits
    job_benefits: v.optional(v.array(v.string())),
    
    // O*NET Classification
    job_onet_soc: v.optional(v.string()),
    job_onet_job_zone: v.optional(v.string()),
    
    // ==== AI Enhancement Fields ====
    match_score: v.optional(v.number()),
    full_analysis: v.optional(v.string()),
    resume_improvements: v.optional(v.array(v.string())),
    gaps_analysis: v.optional(v.string()), // JSON
    missing_skills: v.optional(v.array(v.string())),
    matching_skills: v.optional(v.array(v.string())),
    strengths_for_role: v.optional(v.array(v.string())),
    red_flags: v.optional(v.array(v.string())),
    application_strategy: v.optional(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_session_batch", ["sessionId", "batchIndex"])
    .index("by_job_id", ["job_id"])
    .index("by_session_score", ["sessionId", "match_score"]),

  // User interactions (liked, applied, etc)
  userJobInteractions: defineTable({
    userId: v.string(),
    jobId: v.string(),
    sessionId: v.optional(v.id("jobSearchSessions")),
    
    action: v.union(
      v.literal("viewed"),
      v.literal("liked"),
      v.literal("applied"),
      v.literal("hidden"),
      v.literal("optimized") // When resume was optimized for this job
    ),
    
    // For optimized action, store the result
    optimizationData: v.optional(v.object({
      optimizedResumeUrl: v.optional(v.string()),
      suggestions: v.optional(v.array(v.string())),
      timestamp: v.optional(v.number()),
    })),
    
    timestamp: v.number(),
  })
    .index("by_user_job", ["userId", "jobId"])
    .index("by_user_action", ["userId", "action"]),
});