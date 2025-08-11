import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Job search sessions (simplified - just metadata)
  jobSearchSessions: defineTable({
    userId: v.string(),
    query: v.string(),
    location: v.optional(v.string()),
    totalFound: v.number(),
    status: v.string(), // "searching", "completed", "error"
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId", "createdAt"]),

  // User interactions with cached job data for liked jobs
  userJobInteractions: defineTable({
    userId: v.string(),
    jobId: v.string(),
    
    action: v.union(
      v.literal("liked"),
      v.literal("applied"),
      v.literal("hidden")
    ),
    
    // Cache essential job data when liked (for displaying liked jobs)
    cachedJobData: v.optional(v.object({
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
    })),
    
    timestamp: v.number(),
  })
    .index("by_user_job", ["userId", "jobId"])
    .index("by_user_action", ["userId", "action"]),
});