import { v } from "convex/values";
import { query } from "../_generated/server";

// Note: These queries assume the user is authenticated via the frontend
// Real authentication happens in the actions layer where fetch() is available

export const getSession = query({
  args: {
    sessionId: v.id("jobSearchSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    if (session.userId !== identity.subject) throw new Error("Not found");
    return session;
  },
});

export const getUserSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("jobSearchSessions")
      .filter(q => q.eq(q.field("userId"), identity.subject))
      .order("desc")
      .take(limit);
  },
});

export const getSessionJobs = query({
  args: {
    sessionId: v.id("jobSearchSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== identity.subject) throw new Error("Not found");
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("jobs")
      .withIndex("by_session")
      .filter(q => q.eq(q.field("sessionId"), args.sessionId))
      .order("asc")
      .take(limit);
  },
});

export const getUserInteractions = query({
  args: {
    jobIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const interactions = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_action")
      .filter(q => q.eq(q.field("userId"), identity.subject))
      .collect();
    const interactionMap: Record<string, any> = {};
    for (const interaction of interactions) {
      if (args.jobIds.includes(interaction.jobId)) {
        interactionMap[interaction.jobId] = {
          ...interaction,
          interactionType: interaction.action,
        };
      }
    }
    return interactionMap;
  },
});

export const getLikedJobs = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    // Get liked job interactions
    const likedInteractions = await ctx.db
      .query("userJobInteractions")
      .withIndex("by_user_action")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), args.userId),
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