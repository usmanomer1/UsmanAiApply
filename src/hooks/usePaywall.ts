import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../lib/subscriptionService';

export interface PaywallCheckResult {
  hasAccess: boolean;
  showPaywall: boolean;
  reason?: string;
  requiredPlan?: string;
}

export const usePaywall = () => {
  const { user } = useAuth();
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  const checkFeatureAccess = useCallback(async (
    feature: 'voice' | 'auto_apply' | 'advanced_ai'
  ): Promise<PaywallCheckResult> => {
    if (!user) {
      return {
        hasAccess: false,
        showPaywall: true,
        reason: 'authentication_required',
        requiredPlan: 'any'
      };
    }

    setIsCheckingAccess(true);
    
    try {
      // Always check server-side feature access regardless of subscription status
      // This ensures usage limits are properly enforced
      const accessCheck = await subscriptionService.checkFeatureAccess(user.id, feature);
      
      // Check if user has any active subscription for paywall display logic
      const hasActiveSub = await subscriptionService.hasActiveSubscription(user.id);
      
      return {
        hasAccess: accessCheck.hasAccess,
        showPaywall: !hasActiveSub && !accessCheck.hasAccess, // NEVER show paywall for paid users
        reason: accessCheck.reason,
        requiredPlan: accessCheck.requiredPlan
      };
    } catch (error: any) {
      console.error('Error checking feature access:', error);
      
      // For database/RPC errors, be more lenient with paid users
      if (error?.message?.includes('function') || error?.code === 'PGRST301') {
        console.warn('Database function error detected, checking subscription status only');
        
        try {
          // If there's a database function error, at least check if they have a subscription
          const hasActiveSub = await subscriptionService.hasActiveSubscription(user.id);
          
          // If they have an active subscription, allow access (fail open for paid users)
          if (hasActiveSub) {
            return {
              hasAccess: true,
              showPaywall: false,
              reason: 'subscription_verified',
              requiredPlan: undefined
            };
          }
        } catch (subError) {
          console.error('Error checking subscription fallback:', subError);
        }
      }
      
      // Only show paywall for non-subscribers or when we can't verify
      return {
        hasAccess: false,
        showPaywall: true,
        reason: 'system_error',
        requiredPlan: 'any'
      };
    } finally {
      setIsCheckingAccess(false);
    }
  }, [user]);

  const checkVoiceAccess = useCallback(async (
    estimatedCharacters: number = 100
  ): Promise<PaywallCheckResult> => {
    if (!user) {
      return {
        hasAccess: false,
        showPaywall: true,
        reason: 'authentication_required',
        requiredPlan: 'any'
      };
    }

    setIsCheckingAccess(true);
    
    try {
      // Always check server-side voice access regardless of subscription status
      // This ensures usage limits are properly enforced
      const voiceCheck = await subscriptionService.canUseVoiceFeatures(user.id, estimatedCharacters);
      
      // Check if user has any active subscription for paywall display logic
      const hasActiveSub = await subscriptionService.hasActiveSubscription(user.id);
      
      return {
        hasAccess: voiceCheck.allowed,
        showPaywall: !hasActiveSub && !voiceCheck.allowed, // NEVER show paywall for paid users
        reason: voiceCheck.reason,
        requiredPlan: voiceCheck.reason === 'subscription_required' ? 'any' : undefined
      };
    } catch (error) {
      console.error('Error checking voice access:', error);
      return {
        hasAccess: false,
        showPaywall: true,
        reason: 'system_error',
        requiredPlan: 'any'
      };
    } finally {
      setIsCheckingAccess(false);
    }
  }, [user]);

  const hasActiveSubscription = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      return await subscriptionService.hasActiveSubscription(user.id);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }, [user]);

  const getPlanFeatures = useCallback(async () => {
    if (!user) {
      return {
        hasVoiceFeatures: false,
        hasAdvancedAI: false,
        hasAutoApply: false,
        planName: 'Free',
        isActive: false
      };
    }

    try {
      return await subscriptionService.getPlanFeatures(user.id);
    } catch (error) {
      console.error('Error getting plan features:', error);
      return {
        hasVoiceFeatures: false,
        hasAdvancedAI: false,
        hasAutoApply: false,
        planName: 'Free',
        isActive: false
      };
    }
  }, [user]);

  const getVoiceUsageStats = useCallback(async () => {
    if (!user) return null;
    
    try {
      return await subscriptionService.getVoiceUsageStats(user.id);
    } catch (error) {
      console.error('Error getting voice usage stats:', error);
      return null;
    }
  }, [user]);

  return {
    checkFeatureAccess,
    checkVoiceAccess,
    hasActiveSubscription,
    getPlanFeatures,
    getVoiceUsageStats,
    isCheckingAccess,
    isAuthenticated: !!user,
    userId: user?.id
  };
};

export default usePaywall; 