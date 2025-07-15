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
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    // Fetch from job_search_monthly_usage table
    const { data, error } = await supabase
      .from('job_search_monthly_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching job search usage:', error);
      return null;
    }
    
    // If no data exists for current month, return default values based on user's plan
    if (!data) {
      // Get user's subscription to determine plan
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('price_id')
        .eq('user_id', userId)
        .eq('subscription_status', 'active')
        .single();
      
      // Determine plan limits based on price_id
      let plan = 'free';
      let monthly_limit = 100;
      
      if (subscription?.price_id) {
        // Map price_id to plan name and limits
        if (subscription.price_id.includes('plus') || subscription.price_id === 'price_1Rf2oQGkowQ7SwlfhDDuOpFk') {
          plan = 'plus';
          monthly_limit = 300;
        } else if (subscription.price_id.includes('pro') || subscription.price_id === 'price_1Rf2nJGkowQ7Swlfwvc3CBO8') {
          plan = 'pro';
          monthly_limit = 700;
        } else if (subscription.price_id.includes('max') || subscription.price_id === 'price_1Rf2owGkowQ7SwlfEG4UKU8c') {
          plan = 'max';
          monthly_limit = -1; // Unlimited
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
    const monthly_used = data.jobs_viewed || 0;
    const monthly_limit = data.monthly_limit || 100;
    const remaining = monthly_limit === -1 ? 'unlimited' : Math.max(0, monthly_limit - monthly_used);
    const percentage_used = monthly_limit === -1 ? 0 : Math.min(100, (monthly_used / monthly_limit) * 100);
    
    return {
      plan: data.plan || 'free',
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
  switch (plan.toLowerCase()) {
    case 'free':
      return 100;
    case 'plus':
      return 300;
    case 'pro':
      return 700;
    case 'max':
      return -1; // Unlimited
    default:
      return 100; // Default to free tier
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