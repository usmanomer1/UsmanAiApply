import { supabase } from './supabase';
import { isSupabaseConfigured } from './supabase';

export type AIOperationType = 'job_search_match' | 'resume_optimization';

export interface AITokenUsage {
  totalTokensUsed: number;
  totalOperations: number;
  jobSearches: number;
  resumeOptimizations: number;
  remainingTokens: number;
}

const TOKEN_LIMIT = 120000; // 120k tokens for all users
const TOKENS_PER_OPERATION = 6000; // 6k tokens per operation

/**
 * Track AI token usage for a specific operation
 */
export async function trackAITokens(
  userId: string,
  operationType: AIOperationType,
  metadata?: Record<string, any>
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) {
    console.warn('Supabase not configured or no user ID, skipping AI token tracking');
    return true;
  }

  try {
    console.log(`Tracking AI tokens - User: ${userId}, Operation: ${operationType}, Tokens: ${TOKENS_PER_OPERATION}`);
    
    const { data, error } = await supabase
      .from('ai_token_tracking')
      .insert({
        user_id: userId,
        operation_type: operationType,
        tokens_used: TOKENS_PER_OPERATION,
        metadata: metadata || {}
      })
      .select();

    if (error) {
      console.error('Error tracking AI tokens:', error);
      return false;
    }

    console.log('AI tokens tracked successfully:', data);
    
    // Also insert into ai_token_usage for billing page
    const { error: usageError } = await supabase
      .from('ai_token_usage')
      .insert({
        user_id: userId,
        operation_type: operationType,
        prompt_tokens: 0,  // We don't have exact breakdown, so set to 0
        completion_tokens: 0,  // We don't have exact breakdown, so set to 0
        total_tokens: TOKENS_PER_OPERATION,  // This is the actual total
        max_tokens_requested: 0,  // Not applicable for this operation
        model_used: 'gpt-4o-mini',  // Default model
        request_data: metadata || {},
        response_data: {},
        cost_usd: 0  // Can be calculated based on token usage
      });
    
    if (usageError) {
      console.error('Error updating ai_token_usage:', usageError);
    }

    return true;
  } catch (error) {
    console.error('Failed to track AI tokens:', error);
    return false;
  }
}

/**
 * Get current AI token usage for a user
 */
export async function getAITokenUsage(userId: string): Promise<AITokenUsage> {
  const defaultUsage: AITokenUsage = {
    totalTokensUsed: 0,
    totalOperations: 0,
    jobSearches: 0,
    resumeOptimizations: 0,
    remainingTokens: TOKEN_LIMIT
  };

  if (!isSupabaseConfigured() || !userId) {
    return defaultUsage;
  }

  try {
    // Query the summary view for current month
    const { data, error } = await supabase
      .from('ai_token_usage_summary')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching AI token usage:', error);
      return defaultUsage;
    }

    if (!data) {
      return defaultUsage;
    }

    const totalTokensUsed = data.total_tokens_used || 0;
    
    return {
      totalTokensUsed,
      totalOperations: data.total_operations || 0,
      jobSearches: data.job_searches || 0,
      resumeOptimizations: data.resume_optimizations || 0,
      remainingTokens: Math.max(0, TOKEN_LIMIT - totalTokensUsed)
    };
  } catch (error) {
    console.error('Failed to get AI token usage:', error);
    return defaultUsage;
  }
}

/**
 * Check if user has enough tokens for an operation
 */
export async function canPerformAIOperation(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!isSupabaseConfigured() || !userId) {
    return { allowed: true }; // Allow in development
  }

  try {
    const usage = await getAITokenUsage(userId);
    
    if (usage.remainingTokens < TOKENS_PER_OPERATION) {
      return {
        allowed: false,
        reason: `Insufficient AI tokens. You need ${TOKENS_PER_OPERATION.toLocaleString()} tokens but only have ${usage.remainingTokens.toLocaleString()} remaining.`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking AI token limits:', error);
    return { allowed: true }; // Fail open in case of errors
  }
}

/**
 * Get usage history for the current month
 */
export async function getAITokenHistory(userId: string, limit: number = 50): Promise<any[]> {
  if (!isSupabaseConfigured() || !userId) {
    return [];
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ai_token_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching AI token history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get AI token history:', error);
    return [];
  }
}