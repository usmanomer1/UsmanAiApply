import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Action to create a search session using native Convex auth
 * No manual token verification needed
 */
export const createAuthenticatedSession = action({
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
    // Get user identity from native Convex auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    // Get user ID from the identity (Supabase uses 'sub' field)
    const userId = identity.subject || identity.sub;
    if (!userId) {
      throw new Error("User ID not found in authentication");
    }
    
    // Create the session using the mutation (which also uses native auth)
    const sessionId = await ctx.runMutation(api.jobs.mutations.createSearchSession, {
      query: args.query,
      location: args.location,
      resumeText: args.resumeText,
      filters: args.filters,
    });
    
    return sessionId;
  },
});

/**
 * Action to start job search using native Convex auth
 */
export const searchJobsAuthenticated = action({
  args: {
    // No authToken needed - using native Convex auth
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
    // Get user identity from native Convex auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    // Get user ID from the identity
    const userId = identity.subject || identity.sub;
    if (!userId) {
      throw new Error("User ID not found in authentication");
    }
    
    // Use the main searchJobs action (which doesn't need auth for backend)
    const result = await ctx.runAction(api.jobs.actions.searchJobs, {
      sessionId: args.sessionId,
      query: args.query,
      location: args.location,
      resumeText: args.resumeText,
      filters: args.filters,
      numJobs: args.numJobs,
    });
    
    return result;
  },
});