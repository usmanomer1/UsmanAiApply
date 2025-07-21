import { supabase } from './supabase';
import { joboticApi } from './joboticApi';

export interface JobSearchUsage {
  user_id: string;
  month: string; // YYYY-MM format
  searches_count: number;
  jobs_viewed: number;
  plan: string;
  monthly_limit: number;
  created_at?: string;
  updated_at?: string;
}

export interface JobSearchUsageStats {
  plan: string;
  monthly_limit: number;
  monthly_used: number;
  remaining: number | 'unlimited';
  percentage_used: number;
}

// Cache for API usage data
const usageCache = new Map<string, { data: JobSearchUsageStats; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Update cached usage data from API response
export function updateCachedUsage(userId: string, apiUsage: any) {
  if (!userId || !apiUsage) return;
  
  const stats: JobSearchUsageStats = {
    plan: apiUsage.plan || 'default',
    monthly_limit: -1, // All plans unlimited
    monthly_used: apiUsage.monthly_used || 0,
    remaining: 'unlimited',
    percentage_used: 0
  };
  
  usageCache.set(userId, {
    data: stats,
    timestamp: Date.now()
  });
}

// Get cached usage data
function getCachedUsage(userId: string): JobSearchUsageStats | null {
  const cached = usageCache.get(userId);
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    usageCache.delete(userId);
    return null;
  }
  
  return cached.data;
}

// Fetch job search usage for the current month
export async function getJobSearchUsage(userId: string): Promise<JobSearchUsageStats | null> {
  try {
    // Check cache first
    const cached = getCachedUsage(userId);
    if (cached) {
      return cached;
    }
    
    // Fetch from new API endpoint with retry logic for auth failures
    let response;
    try {
      response = await joboticApi.getJobUsage();
    } catch (error: any) {
      // If we get an auth error (401 or 500 from auth middleware), retry once after forcing token refresh
      if (error.status === 401 || (error.status === 500 && error.message?.includes('auth'))) {
        console.log('Auth error detected, forcing session refresh and retrying...');
        
        // Force a session refresh
        const { supabase } = await import('./supabase');
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !session) {
          console.error('Failed to refresh session:', refreshError);
          throw error; // Re-throw original error
        }
        
        // Retry the API call with refreshed token
        response = await joboticApi.getJobUsage();
      } else {
        // Not an auth error, re-throw
        throw error;
      }
    }
    
    if (response.success && response.data) {
      const { currentMonth, plan } = response.data;
      
      const stats: JobSearchUsageStats = {
        plan: plan.name || 'default',
        monthly_limit: plan.limit || -1,
        monthly_used: currentMonth.totalJobsViewed || 0,
        remaining: currentMonth.remaining || 'unlimited',
        percentage_used: currentMonth.percentUsed || 0
      };
      
      // Cache the result
      if (userId) {
        usageCache.set(userId, {
          data: stats,
          timestamp: Date.now()
        });
      }
      
      return stats;
    }
    
    // Return default values on error
    return {
      plan: 'default',
      monthly_limit: -1, // Unlimited
      monthly_used: 0,
      remaining: 'unlimited',
      percentage_used: 0
    };
  } catch (error: any) {
    console.error('Error in getJobSearchUsage:', {
      message: error.message,
      status: error.status,
      details: error.details
    });
    
    // Return default values on error
    return {
      plan: 'default',
      monthly_limit: -1, // Unlimited
      monthly_used: 0,
      remaining: 'unlimited',
      percentage_used: 0
    };
  }
}

// Get full job usage data including history and recent searches
export async function getFullJobUsageData(userId: string) {
  try {
    // Fetch from API with retry logic for auth failures
    let response;
    try {
      response = await joboticApi.getJobUsage();
    } catch (error: any) {
      // If we get an auth error (401 or 500 from auth middleware), retry once after forcing token refresh
      if (error.status === 401 || (error.status === 500 && error.message?.includes('auth'))) {
        console.log('Auth error detected in getFullJobUsageData, forcing session refresh and retrying...');
        
        // Force a session refresh
        const { supabase } = await import('./supabase');
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !session) {
          console.error('Failed to refresh session:', refreshError);
          throw error; // Re-throw original error
        }
        
        // Retry the API call with refreshed token
        response = await joboticApi.getJobUsage();
      } else {
        // Not an auth error, re-throw
        throw error;
      }
    }
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return null;
  } catch (error: any) {
    console.error('Error fetching full job usage data:', {
      message: error.message,
      status: error.status,
      details: error.details
    });
    return null;
  }
}

// Get job search limits by plan
export function getJobSearchLimitsByPlan(plan: string): number {
  // All plans have unlimited job searches
  return -1; // Unlimited for all plans
}

// Track job search usage
// NOTE: This function is deprecated. The backend now tracks usage automatically through the API.
// Keeping it for backward compatibility but it will fail silently since job_search_usage table doesn't exist.
export async function trackJobSearchUsage(
  userId: string,
  jobsViewed: number,
  metadata?: Record<string, any>
): Promise<boolean> {
  if (!userId || jobsViewed <= 0) {
    return true;
  }

  try {
    // Get current month in YYYY-MM format
    const currentDate = new Date();
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // First, get existing usage for the month
    const { data: existingUsage } = await supabase
      .from('job_search_usage')
      .select('searches_count, jobs_viewed')
      .eq('user_id', userId)
      .eq('month', monthKey)
      .maybeSingle();
    
    const currentSearchesCount = existingUsage?.searches_count || 0;
    const currentJobsViewed = existingUsage?.jobs_viewed || 0;
    
    const { error } = await supabase
      .from('job_search_usage')
      .upsert({
        user_id: userId,
        month: monthKey,
        searches_count: currentSearchesCount + 1,
        jobs_viewed: currentJobsViewed + jobsViewed,
        created_at: existingUsage ? undefined : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...metadata
      }, {
        onConflict: 'user_id,month',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error tracking job search usage:', error);
      return false;
    }

    // Emit event to refresh billing page
    window.dispatchEvent(new Event('billing-refresh-needed'));
    return true;
  } catch (error) {
    console.error('Failed to track job search usage:', error);
    return false;
  }
}

// Format job search usage for display
export function formatJobSearchUsage(stats: JobSearchUsageStats): {
  used: string;
  limit: string;
  percentage: number;
  color: string;
} {
  const used = stats.monthly_used.toLocaleString();
  const limit = stats.monthly_limit === -1 ? 'Unlimited' : stats.monthly_limit.toLocaleString();
  const percentage = stats.percentage_used;
  
  // Determine color based on usage percentage
  let color = 'text-green-600';
  if (percentage >= 90) {
    color = 'text-red-600';
  } else if (percentage >= 75) {
    color = 'text-orange-600';
  } else if (percentage >= 50) {
    color = 'text-yellow-600';
  }
  
  return {
    used,
    limit,
    percentage,
    color
  };
}