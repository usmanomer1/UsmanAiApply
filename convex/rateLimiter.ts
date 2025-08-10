import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Time constants
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Create rate limiter with different limits
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-user job search limit (creating a search session)
  jobSearch: {
    kind: "token bucket",
    rate: 10,           // 10 searches allowed
    period: HOUR,       // per hour
    capacity: 3,        // allow burst of 3 searches at once
  },
  
  // Global API protection (prevent DDoS)
  globalApi: {
    kind: "fixed window",
    rate: 1000,         // 1000 total requests
    period: MINUTE,     // per minute
  },
});

// Helper function to check rate limit with user-friendly errors
export async function checkJobSearchLimit(ctx: any, userId: string) {
  try {
    // Check per-user rate limit
    const status = await rateLimiter.limit(ctx, "jobSearch", { 
      key: userId,
      throws: false  // Don't throw, return status instead
    });

    if (!status.ok) {
      // Calculate retry time in seconds
      const retryInSeconds = Math.ceil((status.retryAfter - Date.now()) / 1000);
      const retryInMinutes = Math.ceil(retryInSeconds / 60);
      
      return {
        allowed: false,
        message: `You've reached your search limit. Try again in ${retryInMinutes} minute${retryInMinutes > 1 ? 's' : ''}.`,
        retryAfter: status.retryAfter,
        retryInSeconds,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // If rate limiting fails, allow the request (fail open)
    return { allowed: true };
  }
}

// Helper to get user's current rate limit status
export async function getUserRateLimitStatus(ctx: any, userId: string) {
  try {
    // This would need to be implemented based on the rate limiter's API
    // For now, we'll return a simple status
    return {
      limit: 10,
      period: "hour",
      remaining: null, // The rate limiter doesn't expose remaining count directly
    };
  } catch (error) {
    console.error("Failed to get rate limit status:", error);
    return null;
  }
}