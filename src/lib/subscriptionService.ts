import { supabase } from './supabase';
import { planIncludesVoiceFeatures } from '../stripe-config';

export interface UserSubscription {
  subscription_status: string;
  price_id: string;
  current_period_end: string;
  customer_id: string;
}

export interface VoiceUsageStats {
  total_characters_today: number;
  total_characters_month: number;
  total_cost_month: number;
  usage_count_today: number;
  usage_count_month: number;
  last_usage_time: string | null;
}

export interface VoicePermissionCheck {
  allowed: boolean;
  reason?: string;
  message?: string;
  subscription_status?: string;
  current_usage?: number;
  daily_limit?: number;
  remaining_today?: number;
  wait_time_minutes?: number;
}

class SubscriptionService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  private getCacheKey(userId: string, type: string): string {
    return `${userId}-${type}`;
  }
  
  private setCache(key: string, data: any, ttlMs: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  
  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const cacheKey = this.getCacheKey(userId, 'subscription');
      const cached = this.getCache(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return null;
      }

      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Failed to fetch user subscription:', error);
      return null;
    }
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    return subscription?.subscription_status === 'active';
  }

  async canAccessPremiumFeatures(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('verify_user_subscription', {
        user_uuid: userId
      });

      if (error) {
        console.error('Error verifying subscription:', error);
        return false;
      }

      return data?.valid === true;
    } catch (error) {
      console.error('Failed to verify premium access:', error);
      return false;
    }
  }

  async canUseVoiceFeatures(userId: string, estimatedCharacters: number = 100): Promise<VoicePermissionCheck> {
    try {
      const { data, error } = await supabase.rpc('can_user_use_voice', {
        user_uuid: userId,
        estimated_characters: estimatedCharacters
      });

      if (error) {
        console.error('Error checking voice permissions:', error);
        return {
          allowed: false,
          reason: 'system_error',
          message: 'Unable to verify voice permissions. Please try again later.'
        };
      }

      return data as VoicePermissionCheck;
    } catch (error) {
      console.error('Failed to check voice permissions:', error);
      return {
        allowed: false,
        reason: 'system_error',
        message: 'Unable to verify voice permissions. Please try again later.'
      };
    }
  }

  async getVoiceUsageStats(userId: string): Promise<VoiceUsageStats | null> {
    try {
      const cacheKey = this.getCacheKey(userId, 'voice-stats');
      const cached = this.getCache(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase.rpc('get_user_voice_usage_stats', {
        user_uuid: userId
      });

      if (error) {
        console.error('Error fetching voice usage stats:', error);
        return null;
      }

      if (data && data.length > 0) {
        const stats = data[0] as VoiceUsageStats;
        this.setCache(cacheKey, stats, 60000); // Cache for 1 minute
        return stats;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch voice usage stats:', error);
      return null;
    }
  }

  async recordVoiceUsage(
    userId: string,
    charactersUsed: number,
    voiceId: string,
    model: string = 'eleven_flash_v2_5',
    costUsd: number = 0,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('record_voice_usage', {
        user_uuid: userId,
        characters_used: charactersUsed,
        voice_id_used: voiceId,
        model_used: model,
        cost_usd: costUsd,
        request_metadata: metadata
      });

      if (error) {
        console.error('Error recording voice usage:', error);
        return false;
      }

      // Invalidate cache for this user's voice stats
      const cacheKey = this.getCacheKey(userId, 'voice-stats');
      this.cache.delete(cacheKey);

      return data?.success === true;
    } catch (error) {
      console.error('Failed to record voice usage:', error);
      return false;
    }
  }

  async getPlanFeatures(userId: string): Promise<{
    hasVoiceFeatures: boolean;
    hasAdvancedAI: boolean;
    hasAutoApply: boolean;
    planName: string;
    isActive: boolean;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription || subscription.subscription_status !== 'active') {
        return {
          hasVoiceFeatures: false,
          hasAdvancedAI: false,
          hasAutoApply: false,
          planName: 'Free',
          isActive: false
        };
      }

      const hasVoiceFeatures = planIncludesVoiceFeatures(subscription.price_id);
      
      return {
        hasVoiceFeatures,
        hasAdvancedAI: true, // All paid plans have advanced AI
        hasAutoApply: true, // All paid plans have auto apply
        planName: this.getPlanNameFromPriceId(subscription.price_id),
        isActive: true
      };
    } catch (error) {
      console.error('Failed to get plan features:', error);
      return {
        hasVoiceFeatures: false,
        hasAdvancedAI: false,
        hasAutoApply: false,
        planName: 'Free',
        isActive: false
      };
    }
  }

  private getPlanNameFromPriceId(priceId: string): string {
    // Map price IDs to plan names using environment variables only
    const envVars: Record<string, string> = {};
    
    if (import.meta.env.VITE_STRIPE_PLUS_PRICE_ID) {
      envVars[import.meta.env.VITE_STRIPE_PLUS_PRICE_ID] = 'Plus';
    }
    if (import.meta.env.VITE_STRIPE_PRO_PRICE_ID) {
      envVars[import.meta.env.VITE_STRIPE_PRO_PRICE_ID] = 'Pro';
    }
    if (import.meta.env.VITE_STRIPE_MAX_PRICE_ID) {
      envVars[import.meta.env.VITE_STRIPE_MAX_PRICE_ID] = 'Max';
    }
    
    return envVars[priceId] || 'Pro';
  }

  // Helper method to clear cache for a user (useful for testing or subscription changes)
  clearUserCache(userId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(userId));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Secure method to record feature usage with server-side validation
  async recordSecureFeatureUsage(
    userId: string,
    feature: 'voice' | 'auto_apply' | 'advanced_ai',
    usageAmount: number,
    costUsd: number = 0,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; error?: string; usageId?: string }> {
    try {
      const featureMap: Record<string, string> = {
        'voice': 'voice_features',
        'auto_apply': 'linkedin_automation',
        'advanced_ai': 'ai_tools'
      };

      const dbFeatureName = featureMap[feature];
      if (!dbFeatureName) {
        return {
          success: false,
          error: 'Unknown feature type'
        };
      }

      const { data, error } = await supabase.rpc('record_feature_usage', {
        user_uuid: userId,
        feature_name: dbFeatureName,
        usage_amount: usageAmount,
        cost_usd: costUsd,
        usage_metadata: metadata
      });

      if (error) {
        console.error('Error recording feature usage:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // Clear relevant caches
      this.clearUserCache(userId);

      return {
        success: data?.success === true,
        error: data?.error,
        usageId: data?.usage_id
      };
    } catch (error) {
      console.error('Failed to record feature usage:', error);
      return {
        success: false,
        error: 'Failed to record usage'
      };
    }
  }

  // Get comprehensive usage summary from server
  async getUserUsageSummary(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_user_usage_summary', {
        user_uuid: userId
      });

      if (error) {
        console.error('Error getting usage summary:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to get usage summary:', error);
      return null;
    }
  }

  // Method to check if user needs to upgrade for a specific feature - uses server-side validation
  async checkFeatureAccess(userId: string, feature: 'voice' | 'auto_apply' | 'advanced_ai', estimatedUsage: number = 1): Promise<{
    hasAccess: boolean;
    reason?: string;
    requiredPlan?: string;
    currentUsage?: number;
    monthlyLimit?: number;
    remaining?: number;
  }> {
    try {
      // Map frontend feature names to database feature names
      const featureMap: Record<string, string> = {
        'voice': 'voice_features',
        'auto_apply': 'linkedin_automation', 
        'advanced_ai': 'ai_tools'
      };

      const dbFeatureName = featureMap[feature];
      if (!dbFeatureName) {
        return {
          hasAccess: false,
          reason: 'unknown_feature'
        };
      }

      // Try the proper check_feature_access function first
      // Database expects parameters without 'p_' prefix
      try {
        const { data: accessData, error: accessError } = await supabase.rpc('check_feature_access', {
          user_uuid: userId,
          feature_name: dbFeatureName,
          estimated_usage: estimatedUsage
        });
        
        if (!accessError && accessData) {
          return {
            hasAccess: accessData.has_access || false,
            reason: accessData.reason || (accessData.has_access ? 'allowed' : 'limit_exceeded'),
            currentUsage: accessData.current_usage || 0,
            monthlyLimit: accessData.monthly_limit || 0,
            remaining: accessData.remaining || 0,
            requiredPlan: accessData.required_plan
          };
        }
        
        // If the RPC fails, log it but continue with fallback
        if (accessError) {
          console.warn('check_feature_access RPC failed, using fallback:', accessError);
        }
      } catch (rpcError) {
        console.warn('check_feature_access RPC error, using fallback:', rpcError);
      }
      
      // Fallback: Check if user has an active subscription
      const hasActiveSub = await this.hasActiveSubscription(userId);
      
      if (!hasActiveSub) {
        return {
          hasAccess: false,
          reason: 'no_subscription',
          requiredPlan: 'any'
        };
      }
      
      // For LinkedIn automation, check usage limits
      if (feature === 'auto_apply') {
        try {
          const { data: usageData, error: usageError } = await supabase.rpc('get_user_linkedin_usage', {
            user_id: userId
          });
          
          if (!usageError && usageData) {
            const monthlyLimit = 100; // Default limit for automation steps
            const currentUsage = usageData.monthly_steps || 0;
            const hasAccess = currentUsage + estimatedUsage <= monthlyLimit;
            
            return {
              hasAccess,
              reason: hasAccess ? 'within_limits' : 'limit_exceeded',
              currentUsage,
              monthlyLimit,
              remaining: Math.max(0, monthlyLimit - currentUsage)
            };
          }
        } catch (error) {
          console.error('Error checking LinkedIn usage:', error);
        }
      }
      
      // For AI tools, use the working can_user_make_ai_request function
      if (feature === 'advanced_ai') {
        const { data: canMakeRequest, error: aiError } = await supabase.rpc('can_user_make_ai_request', {
          user_uuid: userId,
          estimated_tokens: estimatedUsage
        });
        
        if (aiError) {
          console.error('Error checking AI request:', aiError);
          return {
            hasAccess: false,
            reason: 'system_error'
          };
        }
        
        return {
          hasAccess: canMakeRequest === true,
          reason: canMakeRequest ? 'subscription_active' : 'token_limit_exceeded',
          monthlyLimit: 150000,
          currentUsage: 0
        };
      }
      
      // For voice features, use the working can_user_use_voice function
      if (feature === 'voice') {
        const voiceCheck = await this.canUseVoiceFeatures(userId, estimatedUsage);
        return {
          hasAccess: voiceCheck.allowed,
          reason: voiceCheck.reason,
          requiredPlan: voiceCheck.reason === 'subscription_required' ? 'any' : undefined
        };
      }
      
      // For other features, allow access for active subscribers
      return {
        hasAccess: true,
        reason: 'subscription_active'
      };
    } catch (error) {
      console.error('Failed to check feature access:', error);
      
      // Last resort: check subscription status
      try {
        const hasActiveSub = await this.hasActiveSubscription(userId);
        return {
          hasAccess: hasActiveSub,
          reason: hasActiveSub ? 'subscription_active' : 'no_subscription',
          requiredPlan: hasActiveSub ? undefined : 'any'
        };
      } catch (subError) {
        return {
          hasAccess: false,
          reason: 'system_error'
        };
      }
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService(); 