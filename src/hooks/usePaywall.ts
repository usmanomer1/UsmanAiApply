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
      // First check if user has any active subscription
      const hasActiveSub = await subscriptionService.hasActiveSubscription(user.id);
      
      // If user has active subscription, never show paywall regardless of feature access
      if (hasActiveSub) {
        return {
          hasAccess: true,
          showPaywall: false,
          reason: 'subscribed_user'
        };
      }
      
      // If user is free, check feature access and show paywall if no access
      const accessCheck = await subscriptionService.checkFeatureAccess(user.id, feature);
      
      return {
        hasAccess: accessCheck.hasAccess,
        showPaywall: !accessCheck.hasAccess, // Only show paywall for free users without access
        reason: accessCheck.reason,
        requiredPlan: accessCheck.requiredPlan
      };
    } catch (error) {
      console.error('Error checking feature access:', error);
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
      // First check if user has any active subscription
      const hasActiveSub = await subscriptionService.hasActiveSubscription(user.id);
      
      // If user has active subscription, never show paywall regardless of voice access
      if (hasActiveSub) {
        return {
          hasAccess: true,
          showPaywall: false,
          reason: 'subscribed_user'
        };
      }
      
      // If user is free, check voice access and show paywall if no access
      const voiceCheck = await subscriptionService.canUseVoiceFeatures(user.id, estimatedCharacters);
      
      return {
        hasAccess: voiceCheck.allowed,
        showPaywall: !voiceCheck.allowed, // Only show paywall for free users without access
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