import { supabase } from './supabase';
import { isSupabaseConfigured } from './supabase';

export type UsageType = 
  | 'automation_steps'
  | 'job_search_match'
  | 'resume_optimization'
  | 'ai_tokens'
  | 'cover_letter_generation';

export interface UsageLimit {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface UserUsage {
  automation_steps: UsageLimit;
  job_search_match: UsageLimit;
  resume_optimization: UsageLimit;
  ai_tokens: UsageLimit;
  cover_letter_generation: UsageLimit;
}

/**
 * Token costs per operation type
 */
export const TOKEN_COSTS = {
  job_search_match: 6000,
  resume_optimization: 6000,
  cover_letter_generation: 2000,
} as const;

/**
 * Get the billing period start date for a user
 */
export async function getUserBillingPeriodStart(userId: string): Promise<Date> {
  if (!isSupabaseConfigured()) {
    return new Date(new Date().setDate(1)); // First day of current month
  }

  try {
    const { data: subscription } = await supabase
      .from('stripe_user_subscriptions')
      .select('current_period_start')
      .eq('user_id', userId)
      .eq('subscription_status', 'active')
      .single();

    if (subscription?.current_period_start) {
      return new Date(subscription.current_period_start * 1000);
    }
  } catch (error) {
    console.warn('Error fetching billing period:', error);
  }

  // Default to first day of current month if no active subscription
  return new Date(new Date().setDate(1));
}

/**
 * Increment usage for a specific type
 */
export async function incrementUsage(
  userId: string,
  usageType: UsageType,
  amount: number,
  metadata?: Record<string, any>
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) {
    return true; // Allow in development
  }

  try {
    const billingPeriodStart = await getUserBillingPeriodStart(userId);

    const { error } = await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_usage_type: usageType,
      p_amount: amount,
      p_billing_period_start: billingPeriodStart.toISOString(),
      p_metadata: metadata || {}
    });

    if (error) {
      console.error('Error incrementing usage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to increment usage:', error);
    return false;
  }
}

/**
 * Track automation steps with proper task-level maximum tracking
 * This ensures we track the MAX steps for each task, not cumulative
 */
export async function trackAutomationSteps(
  userId: string,
  taskId: string,
  stepCount: number
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) {
    return true;
  }

  try {
    console.log(`Tracking automation steps - User: ${userId}, Task: ${taskId}, Steps: ${stepCount}`);
    
    // Use automation_tasks table which properly tracks max steps per task
    const { data, error } = await supabase
      .from('automation_tasks')
      .upsert({
        user_id: userId,
        task_id: taskId,
        step_count: stepCount,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,task_id',
        // This will only update if the new step count is higher
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Error tracking automation steps:', error);
      return false;
    }

    console.log('Successfully tracked automation steps:', data);
    return true;
  } catch (error) {
    console.error('Failed to track automation steps:', error);
    return false;
  }
}

/**
 * Get current usage for a user
 */
export async function getUserUsage(userId: string): Promise<UserUsage> {
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

  try {
    const billingPeriodStart = await getUserBillingPeriodStart(userId);

    // Get user's subscription to determine plan limits
    const { data: subscription } = await supabase
      .from('stripe_user_subscriptions')
      .select('price_id, subscription_status')
      .eq('user_id', userId)
      .eq('subscription_status', 'active')
      .single();

    // Get usage from the view
    const { data: usageData, error } = await supabase
      .from('user_usage_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('billing_period_start', billingPeriodStart.toISOString());

    if (error) {
      console.error('Error fetching usage:', error);
      return defaultUsage;
    }

    // Process the data into our format
    const usage: UserUsage = { ...defaultUsage };

    // If user has an active subscription, get plan limits
    if (subscription && subscription.price_id) {
      // Map price IDs to plan names directly
      const priceIdToPlanMap: Record<string, string> = {
        'price_1Rf2oQGkowQ7SwlfhDDuOpFk': 'Plus',
        'price_1Rf2nJGkowQ7Swlfwvc3CBO8': 'Pro', 
        'price_1Rf2owGkowQ7SwlfEG4UKU8c': 'Max'
      };
      
      const planName = priceIdToPlanMap[subscription.price_id];
      
      if (planName) {
        // Get limits for the user's plan
        const { data: planLimits } = await supabase
          .from('usage_limits')
          .select('usage_type, monthly_limit')
          .eq('plan_name', planName)
          .eq('is_active', true);

        if (planLimits) {
          planLimits.forEach(limit => {
            const usageType = limit.usage_type as UsageType;
            usage[usageType].limit = limit.monthly_limit;
            usage[usageType].remaining = limit.monthly_limit;
          });
        } else {
          // Fallback: Set default limits based on plan
          const defaultLimits: Record<string, number> = {
            'Plus': 620,
            'Pro': 1250,
            'Max': 2300
          };
          
          if (defaultLimits[planName]) {
            usage.automation_steps.limit = defaultLimits[planName];
            usage.automation_steps.remaining = defaultLimits[planName];
          }
        }
      }
    }

    // Update with actual usage if any exists
    if (usageData && usageData.length > 0) {
      usageData.forEach(row => {
        const usageType = row.usage_type as UsageType;
        usage[usageType] = {
          used: row.used || 0,
          limit: row.limit || usage[usageType].limit,
          remaining: Math.max(0, row.remaining || (usage[usageType].limit - (row.used || 0))),
          percentage: row.limit > 0 ? Math.min(100, (row.used / row.limit) * 100) : 0
        };
      });
    } else {
      // No usage data exists, but we already set the limits above
      // Just calculate remaining based on limit - used (which is 0)
      Object.keys(usage).forEach(key => {
        const usageType = key as UsageType;
        usage[usageType].remaining = usage[usageType].limit;
      });
    }

    // Get automation steps from automation_tasks table (properly tracks MAX per task)
    // Use the same billing period as the rest of the usage tracking
    const { data: automationTasks, error: automationError } = await supabase
      .from('automation_tasks')
      .select('step_count')
      .eq('user_id', userId)
      .gte('created_at', billingPeriodStart.toISOString());
    
    if (automationError) {
      console.error('Error fetching automation tasks:', automationError);
    }
    
    if (automationTasks && automationTasks.length > 0) {
      // Sum up the step counts from all tasks this billing period
      const totalSteps = automationTasks.reduce((sum, task) => sum + (task.step_count || 0), 0);
      console.log(`Automation usage for user ${userId}: ${totalSteps} steps from ${automationTasks.length} tasks`);
      usage.automation_steps.used = totalSteps;
      usage.automation_steps.remaining = Math.max(0, usage.automation_steps.limit - totalSteps);
      usage.automation_steps.percentage = usage.automation_steps.limit > 0 
        ? Math.min(100, (totalSteps / usage.automation_steps.limit) * 100) 
        : 0;
    } else {
      console.log(`No automation tasks found for user ${userId} since ${billingPeriodStart.toISOString()}`);
    }

    // Get AI token usage from ai_token_usage table
    const { data: aiTokenUsage, error: aiTokenError } = await supabase
      .from('ai_token_usage')
      .select('total_tokens')  // Use the correct column name
      .eq('user_id', userId)
      .gte('created_at', billingPeriodStart.toISOString());
    
    if (aiTokenError) {
      console.error('Error fetching AI token usage:', aiTokenError);
    }
    
    if (aiTokenUsage && aiTokenUsage.length > 0) {
      // Sum up all AI token usage for this billing period
      const totalAITokens = aiTokenUsage.reduce((sum, record) => sum + (record.total_tokens || 0), 0);
      console.log(`AI token usage for user ${userId}: ${totalAITokens} tokens from ${aiTokenUsage.length} operations`);
      usage.ai_tokens.used = totalAITokens;
      usage.ai_tokens.remaining = Math.max(0, usage.ai_tokens.limit - totalAITokens);
      usage.ai_tokens.percentage = usage.ai_tokens.limit > 0 
        ? Math.min(100, (totalAITokens / usage.ai_tokens.limit) * 100) 
        : 0;
    } else {
      console.log(`No AI token usage found for user ${userId} since ${billingPeriodStart.toISOString()}`);
    }

    // Ensure free tier limits are set if no subscription
    if (!subscription) {
      const { data: freeLimits } = await supabase
        .from('free_tier_limits')
        .select('usage_type, free_limit');

      if (freeLimits) {
        freeLimits.forEach(limit => {
          const usageType = limit.usage_type as UsageType;
          usage[usageType].limit = limit.free_limit;
          usage[usageType].remaining = limit.free_limit;
        });
      }
    }

    return usage;
  } catch (error) {
    console.error('Failed to get user usage:', error);
    return defaultUsage;
  }
}

/**
 * Check if user can perform an action based on usage limits
 */
export async function canPerformAction(
  userId: string,
  usageType: UsageType,
  amount: number = 1
): Promise<{ allowed: boolean; reason?: string }> {
  if (!isSupabaseConfigured() || !userId) {
    return { allowed: true }; // Allow in development
  }

  try {
    const usage = await getUserUsage(userId);
    const typeUsage = usage[usageType];

    if (typeUsage.remaining < amount) {
      return {
        allowed: false,
        reason: `You've reached your ${usageType.replace(/_/g, ' ')} limit (${typeUsage.used}/${typeUsage.limit})`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking usage limits:', error);
    return { allowed: true }; // Fail open in case of errors
  }
}

/**
 * Track AI token usage (converts to token count)
 */
export async function trackAITokenUsage(
  userId: string,
  operation: 'job_search_match' | 'resume_optimization' | 'cover_letter_generation',
  metadata?: Record<string, any>
): Promise<boolean> {
  const tokenCost = TOKEN_COSTS[operation];
  
  // Track both the operation and the token usage
  const operationTracked = await incrementUsage(userId, operation, 1, metadata);
  const tokensTracked = await incrementUsage(userId, 'ai_tokens', tokenCost, {
    ...metadata,
    operation,
    token_cost: tokenCost
  });

  return operationTracked && tokensTracked;
}

/**
 * Create or update an automation session
 */
export async function createAutomationSession(
  userId: string,
  taskId: string,
  jobTitle: string,
  location: string,
  targetCount: number
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('automation_sessions')
      .upsert({
        user_id: userId,
        task_id: taskId,
        status: 'running',
        step_count: 0,
        job_title: jobTitle,
        location: location,
        target_count: targetCount,
        applications_submitted: 0,
        started_at: new Date().toISOString()
      }, {
        onConflict: 'task_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error creating automation session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to create automation session:', error);
    return false;
  }
}

/**
 * Update automation session progress
 */
export async function updateAutomationSession(
  taskId: string,
  updates: {
    step_count?: number;
    applications_submitted?: number;
    status?: string;
    error_message?: string;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return true;
  }

  try {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (updates.status && ['finished', 'failed', 'stopped'].includes(updates.status)) {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('automation_sessions')
      .update(updateData)
      .eq('task_id', taskId);

    if (error) {
      console.error('Error updating automation session:', error);
      return false;
    }

    // Track usage in real-time, not just at completion
    if (updates.step_count) {
      const { data: session } = await supabase
        .from('automation_sessions')
        .select('user_id')
        .eq('task_id', taskId)
        .single();

      if (session) {
        // Track automation steps using the proper MAX tracking function
        await trackAutomationSteps(session.user_id, taskId, updates.step_count);
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to update automation session:', error);
    return false;
  }
}

/**
 * Get automation sessions for a user
 */
export async function getAutomationSessions(
  userId: string,
  limit: number = 10
): Promise<any[]> {
  if (!isSupabaseConfigured() || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('automation_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching automation sessions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get automation sessions:', error);
    return [];
  }
}

/**
 * Get usage history for charts
 */
export async function getUsageHistory(
  userId: string,
  days: number = 30
): Promise<any[]> {
  if (!isSupabaseConfigured() || !userId) {
    return [];
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: sessions, error } = await supabase
      .from('automation_sessions')
      .select('started_at, completed_at, step_count, applications_submitted')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true });

    if (error) {
      console.error('Error fetching usage history:', error);
      return [];
    }

    // Group by day
    const dailyUsage: Record<string, { date: string; steps: number; applications: number }> = {};
    const today = new Date();

    // Initialize all days with zero
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyUsage[dateKey] = { date: dateKey, steps: 0, applications: 0 };
    }

    // Aggregate session data
    sessions?.forEach(session => {
      const dateKey = new Date(session.started_at).toISOString().split('T')[0];
      if (dailyUsage[dateKey]) {
        dailyUsage[dateKey].steps += session.step_count || 0;
        dailyUsage[dateKey].applications += session.applications_submitted || 0;
      }
    });

    // Convert to array and sort
    return Object.values(dailyUsage)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Failed to get usage history:', error);
    return [];
  }
}