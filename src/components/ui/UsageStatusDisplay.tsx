import React, { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscriptionService } from '../../lib/subscriptionService';

interface UsageStatusDisplayProps {
  className?: string;
  feature: 'auto_apply' | 'voice' | 'advanced_ai';
}

interface UsageStats {
  current: number;
  limit: number;
  remaining: number;
  planName: string;
  resetDate?: string;
}

const UsageStatusDisplay: React.FC<UsageStatusDisplayProps> = ({ className = '', feature }) => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const featureNames = {
    auto_apply: 'Job Applications',
    voice: 'Voice Features',
    advanced_ai: 'AI Tools'
  };

  const featureIcons = {
    auto_apply: '🤖',
    voice: '🎤',
    advanced_ai: '🧠'
  };

  useEffect(() => {
    const fetchUsage = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const accessCheck = await subscriptionService.checkFeatureAccess(user.id, feature);
        const subscription = await subscriptionService.getUserSubscription(user.id);

        if (accessCheck && typeof accessCheck.currentUsage === 'number' && typeof accessCheck.monthlyLimit === 'number') {
          setUsage({
            current: accessCheck.currentUsage,
            limit: accessCheck.monthlyLimit,
            remaining: accessCheck.remaining || (accessCheck.monthlyLimit - accessCheck.currentUsage),
            planName: subscription ? getPlanName(subscription.price_id) : 'Free',
            resetDate: subscription?.current_period_end
          });
        } else {
          // Fallback for cases where usage data isn't available
          setUsage({
            current: 0,
            limit: 0,
            remaining: 0,
            planName: 'Free'
          });
        }
      } catch (error) {
        console.error('Error fetching usage stats:', error);
        setError('Unable to load usage information');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [user, feature]);

  const getPlanName = (priceId: string): string => {
    if (priceId === import.meta.env.VITE_STRIPE_MAX_PRICE_ID) return 'Max';
    if (priceId === import.meta.env.VITE_STRIPE_PRO_PRICE_ID) return 'Pro';
    if (priceId === import.meta.env.VITE_STRIPE_PLUS_PRICE_ID) return 'Plus';
    return 'Free';
  };

  const getUsagePercentage = (): number => {
    if (!usage || usage.limit === 0) return 0;
    return Math.min((usage.current / usage.limit) * 100, 100);
  };

  const getStatusColor = (): string => {
    const percentage = getUsagePercentage();
    if (percentage >= 100) return 'text-red-600 dark:text-red-400';
    if (percentage >= 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressBarColor = (): string => {
    const percentage = getUsagePercentage();
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatResetDate = (dateString?: string): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Resets today';
    if (diffDays === 1) return 'Resets tomorrow';
    return `Resets in ${diffDays} days`;
  };

  if (loading) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading usage...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const percentage = getUsagePercentage();
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{featureIcons[feature]}</span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {featureNames[feature]} Usage
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {usage.planName} Plan
            </p>
          </div>
        </div>
        <div className={`text-sm font-medium ${getStatusColor()}`}>
          {usage.current} / {usage.limit}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>Usage Progress</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1">
          {isAtLimit ? (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          ) : isNearLimit ? (
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
          ) : (
            <CheckCircle className="w-3 h-3 text-green-500" />
          )}
          <span className={getStatusColor()}>
            {isAtLimit ? 'Limit Reached' : `${usage.remaining} remaining`}
          </span>
        </div>
        
        {usage.resetDate && (
          <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatResetDate(usage.resetDate)}</span>
          </div>
        )}
      </div>

      {isAtLimit && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-xs text-red-700 dark:text-red-300">
            You've reached your monthly limit. Upgrade your plan or wait for the reset to continue using this feature.
          </p>
        </div>
      )}

      {isNearLimit && !isAtLimit && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            You're approaching your monthly limit. Consider upgrading your plan for unlimited access.
          </p>
        </div>
      )}
    </div>
  );
};

export default UsageStatusDisplay; 