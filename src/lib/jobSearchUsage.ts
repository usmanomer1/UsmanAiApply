import { supabase } from './supabase';

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

// Fetch job search usage for the current month
export async function getJobSearchUsage(userId: string): Promise<JobSearchUsageStats | null> {
  try {
    // Get current month's start date
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    // Query monthly usage view
    const { data, error } = await supabase
      .from('job_search_monthly_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('month', currentMonthStart.toISOString())
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching job search usage:', error);
      return null;
    }
    
    // If no data exists for current month, return default values based on user's plan
    if (!data) {
      // Get user's subscription to determine plan
      const { data: subscription } = await supabase
        .from('stripe_user_subscriptions')
        .select('plan_name, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      // Determine plan limits based on plan_name from backend guide
      let plan = 'default';
      let monthly_limit = 300; // Free tier default
      
      if (subscription?.plan_name) {
        plan = subscription.plan_name;
        // Map plan names to limits per backend guide
        switch (plan) {
          case 'Plus':
            monthly_limit = 600;
            break;
          case 'Pro':
            monthly_limit = 900;
            break;
          case 'Max':
            monthly_limit = -1; // Unlimited
            break;
          default:
            monthly_limit = 300; // Free tier
        }
      }
      
      return {
        plan,
        monthly_limit,
        monthly_used: 0,
        remaining: monthly_limit === -1 ? 'unlimited' : monthly_limit,
        percentage_used: 0
      };
    }
    
    // Calculate stats from fetched data
    // The view returns total_jobs and search_count
    const monthly_used = data.total_jobs || 0;
    
    // Get plan limits if not in the data
    let monthly_limit = 300; // Default
    let plan = 'default';
    
    if (!data || !data.plan_name) {
      // Fetch subscription to get plan info
      const { data: subscription } = await supabase
        .from('stripe_user_subscriptions')
        .select('plan_name')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      if (subscription?.plan_name) {
        plan = subscription.plan_name;
        switch (plan) {
          case 'Plus':
            monthly_limit = 600;
            break;
          case 'Pro':
            monthly_limit = 900;
            break;
          case 'Max':
            monthly_limit = -1; // Unlimited
            break;
        }
      }
    } else {
      plan = data.plan_name || 'default';
      monthly_limit = data.monthly_limit || 300;
    }
    
    const remaining = monthly_limit === -1 ? 'unlimited' : Math.max(0, monthly_limit - monthly_used);
    const percentage_used = monthly_limit === -1 ? 0 : Math.min(100, (monthly_used / monthly_limit) * 100);
    
    return {
      plan,
      monthly_limit,
      monthly_used,
      remaining,
      percentage_used
    };
  } catch (error) {
    console.error('Error in getJobSearchUsage:', error);
    return null;
  }
}

// Get job search limits by plan
export function getJobSearchLimitsByPlan(plan: string): number {
  switch (plan) {
    case 'default':
    case 'free':
      return 300;
    case 'Plus':
    case 'plus':
      return 600;
    case 'Pro':
    case 'pro':
      return 900;
    case 'Max':
    case 'max':
      return -1; // Unlimited
    default:
      return 300; // Default to free tier
  }
}

// Track job search usage
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
    
    const { error } = await supabase
      .from('job_search_usage')
      .upsert({
        user_id: userId,
        month: monthKey,
        searches_count: 1,
        jobs_viewed: jobsViewed,
        created_at: new Date().toISOString(),
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