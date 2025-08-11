import { mutation, query, action } from "../_generated/server";
import { requireAuth, verifySupabaseToken } from "../auth";
import { v } from "convex/values";

/**
 * Wrapper for authenticated mutations
 * Automatically verifies the auth token and provides userId to the handler
 */
export function authenticatedMutation<Args extends Record<string, any>, Return>(
  argsValidator: Args,
  handler: (ctx: any, args: Omit<Args, "authToken"> & { authToken?: string }, userId: string) => Promise<Return>
) {
  return mutation({
    args: {
      ...argsValidator,
      authToken: v.optional(v.string()), // Make authToken optional in args
    },
    handler: async (ctx, args) => {
      try {
        // Verify authentication
        const userId = await requireAuth(args.authToken);
        
        // Call the original handler with userId
        const { authToken, ...restArgs } = args;
        return await handler(ctx, restArgs as any, userId);
      } catch (error) {
        console.error("Authentication error:", error);
        throw new Error(error instanceof Error ? error.message : "Authentication failed");
      }
    },
  });
}

/**
 * Wrapper for authenticated queries
 * Automatically verifies the auth token and provides userId to the handler
 */
export function authenticatedQuery<Args extends Record<string, any>, Return>(
  argsValidator: Args,
  handler: (ctx: any, args: Omit<Args, "authToken"> & { authToken?: string }, userId: string) => Promise<Return>
) {
  return query({
    args: {
      ...argsValidator,
      authToken: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      try {
        // Verify authentication
        const userId = await requireAuth(args.authToken);
        
        // Call the original handler with userId
        const { authToken, ...restArgs } = args;
        return await handler(ctx, restArgs as any, userId);
      } catch (error) {
        console.error("Authentication error:", error);
        throw new Error(error instanceof Error ? error.message : "Authentication failed");
      }
    },
  });
}

/**
 * Wrapper for authenticated actions
 * Automatically verifies the auth token and provides userId to the handler
 */
export function authenticatedAction<Args extends Record<string, any>, Return>(
  argsValidator: Args,
  handler: (ctx: any, args: Omit<Args, "authToken"> & { authToken?: string }, userId: string) => Promise<Return>
) {
  return action({
    args: {
      ...argsValidator,
      authToken: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      try {
        // For actions, we might need the full token for backend calls
        const authToken = args.authToken;
        if (!authToken) {
          throw new Error("Authentication required");
        }
        
        // Verify and get user ID
        const payload = await verifySupabaseToken(authToken);
        const userId = (payload as any).id;
        
        // Call the original handler with both userId and token (for backend calls)
        return await handler(ctx, args, userId);
      } catch (error) {
        console.error("Authentication error:", error);
        throw new Error(error instanceof Error ? error.message : "Authentication failed");
      }
    },
  });
}