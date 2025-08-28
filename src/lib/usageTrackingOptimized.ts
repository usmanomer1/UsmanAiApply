import { supabase } from './supabase';
import { isSupabaseConfigured } from './supabase';
import { UserUsage, getUserBillingPeriodStart } from './usageTracking';

interface CachedUsageData {
  data: UserUsage | null;
  timestamp: number;
  userId: string;
}

// Cache for usage data with 30 second TTL
const usageCache: Map<string, CachedUsageData> = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Optimized function to get user usage with caching and batch fetching
 */
export async function getUserUsageOptimized(userId: string): Promise<UserUsage> {
  const defaultUsage: UserUsage = {
    automation_steps: { used: 0, limit: 0, remaining: 0, percentage: 0 },
    job_search_match: { used: 0, limit: 100, remaining: 100, percentage: 0 },
    resume_optimization: { used: 0, limit: 10, remaining: 10, percentage: 0 },
    ai_tokens: { used: 0, limit: 120000, remaining: 120000, percentage: 0 },
    cover_letter_generation: { used: 0, limit: 5, remaining: 5, percentage: 0 },
  };

  if (!isSupabaseConfigured() || !userId) {
    return defaultUsage;
  }

  // Check cache first
  const cached = usageCache.get(userId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data || defaultUsage;
  }

  try {
    const billingPeriodStart = await getUserBillingPeriodStart(userId);
    
    // Batch fetch all data in parallel
    const [
      subscriptionResult,
      usageSummaryResult,
      automationTasksResult,
      aiTokenTrackingResult
    ] = await Promise.all([
      // Get subscription data
      supabase
        .from('stripe_user_subscriptions')
        .select('price_id, subscription_status')
        .eq('user_id', userId)
        .eq('subscription_status', 'active')
        .single(),
      
      // Get usage summary
      supabase
        .from('user_usage_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('billing_period_start', billingPeriodStart.toISOString()),
      
      // Get automation tasks (limited to reduce data)
      supabase
        .from('automation_tasks')
        .select('step_count')
        .eq('user_id', userId)
        .gte('created_at', billingPeriodStart.toISOString())
        .limit(100), // Limit to reduce data transfer
      
      // Get AI token tracking (limited)
      supabase
        .from('ai_token_tracking')
        .select('tokens_used, operation_type')
        .eq('user_id', userId)
        .gte('created_at', billingPeriodStart.toISOString())
        .limit(100) // Limit to reduce data transfer
    ]);

    // Process the data into our format
    const usage: UserUsage = { ...defaultUsage };

    // Process subscription limits
    if (subscriptionResult.data?.price_id) {
      const priceIdToPlanMap: Record<string, number> = {
        'price_1Rf2oQGkowQ7SwlfhDDuOpFk': 620,  // Plus
        'price_1Rf2nJGkowQ7Swlfwvc3CBO8': 1250, // Pro
        'price_1Rf2owGkowQ7SwlfEG4UKU8c': 2300  // Max
      };
      
      const limit = priceIdToPlanMap[subscriptionResult.data.price_id] || 0;
      if (limit) {
        usage.automation_steps.limit = limit;
        usage.automation_steps.remaining = limit;
      }
    }

    // Update with usage summary if exists
    if (usageSummaryResult.data && usageSummaryResult.data.length > 0) {
      usageSummaryResult.data.forEach(row => {
        const usageType = row.usage_type as keyof UserUsage;
        if (usage[usageType]) {
          usage[usageType] = {
            used: row.used || 0,
            limit: row.limit || usage[usageType].limit,
            remaining: Math.max(0, row.remaining || (usage[usageType].limit - (row.used || 0))),
            percentage: row.limit > 0 ? Math.min(100, (row.used / row.limit) * 100) : 0
          };
        }
      });
    }

    // Process automation tasks
    if (automationTasksResult.data && automationTasksResult.data.length > 0) {
      const totalSteps = automationTasksResult.data.reduce((sum, task) => sum + (task.step_count || 0), 0);
      usage.automation_steps.used = totalSteps;
      usage.automation_steps.remaining = Math.max(0, usage.automation_steps.limit - totalSteps);
      usage.automation_steps.percentage = usage.automation_steps.limit > 0 
        ? Math.min(100, (totalSteps / usage.automation_steps.limit) * 100) 
        : 0;
    }

    // Process AI token tracking
    if (aiTokenTrackingResult.data && aiTokenTrackingResult.data.length > 0) {
      const totalAITokens = aiTokenTrackingResult.data.reduce((sum, record) => sum + (record.tokens_used || 0), 0);
      
      let jobSearchCount = 0;
      let resumeOptCount = 0;
      aiTokenTrackingResult.data.forEach(record => {
        if (record.operation_type === 'job_search_match') jobSearchCount++;
        if (record.operation_type === 'resume_optimization') resumeOptCount++;
      });
      
      usage.ai_tokens.used = totalAITokens;
      usage.ai_tokens.remaining = Math.max(0, usage.ai_tokens.limit - totalAITokens);
      usage.ai_tokens.percentage = usage.ai_tokens.limit > 0 
        ? Math.min(100, (totalAITokens / usage.ai_tokens.limit) * 100) 
        : 0;
      
      usage.job_search_match.used = jobSearchCount;
      usage.resume_optimization.used = resumeOptCount;
    }

    // Cache the result
    usageCache.set(userId, {
      data: usage,
      timestamp: now,
      userId
    });

    return usage;
  } catch (error) {
    console.error('Failed to get optimized user usage:', error);
    
    // Return cached data if available, even if expired
    const cached = usageCache.get(userId);
    if (cached?.data) {
      return cached.data;
    }
    
    return defaultUsage;
  }
}

/**
 * Clear cache for a specific user or all users
 */
export function clearUsageCache(userId?: string) {
  if (userId) {
    usageCache.delete(userId);
  } else {
    usageCache.clear();
  }
}

/**
 * Batch fetch billing data for optimal performance
 */
export async function getBillingDataOptimized(userId: string) {
  if (!isSupabaseConfigured() || !userId) {
    return null;
  }

  try {
    // Batch fetch subscription and usage in parallel
    const [subscriptionResult, usage] = await Promise.all([
      supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      getUserUsageOptimized(userId)
    ]);

    return {
      subscription: subscriptionResult.data,
      usage
    };
  } catch (error) {
    console.error('Error fetching optimized billing data:', error);
    return null;
  }
}