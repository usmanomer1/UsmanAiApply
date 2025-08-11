import { mutation, query, action } from "../_generated/server";
import { requireAuth, getAuthUserId } from "../auth";
import { v } from "convex/values";

/**
 * Wrapper for authenticated mutations
 * Uses native Convex auth - no authToken needed in args
 */
export function authenticatedMutation<Args extends Record<string, any>, Return>(
  argsValidator: Args,
  handler: (ctx: any, args: Args, userId: string) => Promise<Return>
) {
  return mutation({
    args: argsValidator,
    handler: async (ctx, args) => {
      try {
        // Get userId from native Convex auth
        const userId = await requireAuth(ctx);
        
        // Call the original handler with userId
        return await handler(ctx, args, userId);
      } catch (error) {
        console.error("Authentication error:", error);
        throw new Error(error instanceof Error ? error.message : "Authentication failed");
      }
    },
  });
}

/**
 * Wrapper for authenticated queries
 * Uses native Convex auth - no authToken needed in args
 */
export function authenticatedQuery<Args extends Record<string, any>, Return>(
  argsValidator: Args,
  handler: (ctx: any, args: Args, userId: string) => Promise<Return>
) {
  return query({
    args: argsValidator,
    handler: async (ctx, args) => {
      try {
        // Get userId from native Convex auth
        const userId = await requireAuth(ctx);
        
        // Call the original handler with userId
        return await handler(ctx, args, userId);
      } catch (error) {
        console.error("Authentication error:", error);
        throw new Error(error instanceof Error ? error.message : "Authentication failed");
      }
    },
  });
}

/**
 * Wrapper for authenticated actions
 * Uses native Convex auth - no authToken needed in args
 */
export function authenticatedAction<Args extends Record<string, any>, Return>(
  argsValidator: Args,
  handler: (ctx: any, args: Args, userId: string) => Promise<Return>
) {
  return action({
    args: argsValidator,
    handler: async (ctx, args) => {
      try {
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
        
        // Call the original handler with userId
        return await handler(ctx, args, userId);
      } catch (error) {
        console.error("Authentication error:", error);
        throw new Error(error instanceof Error ? error.message : "Authentication failed");
      }
    },
  });
}