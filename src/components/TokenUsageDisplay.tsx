import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  ArrowUp,
  ArrowDown,
  Zap,
  Lock
} from 'lucide-react';
import { openAIService, TokenUsageStats, OperationType } from '../lib/openaiWithTokenTracking';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface TokenUsageDisplayProps {
  className?: string;
}

export const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ className = '' }) => {
  const [tokenStats, setTokenStats] = useState<TokenUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    fetchTokenStats();
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const { data } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status')
        .single();
      
      setHasActiveSubscription(data?.subscription_status === 'active');
    } catch (error) {
      setHasActiveSubscription(false);
    }
  };

  const fetchTokenStats = async () => {
    try {
      setRefreshing(true);
      const stats = await openAIService.getTokenUsageStats();
      setTokenStats(stats);
    } catch (error) {
      console.error('Error fetching token stats:', error);
      toast.error('Failed to load token usage statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getUsageStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-orange-600 dark:text-orange-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'from-red-500 to-red-600';
    if (percentage >= 75) return 'from-orange-500 to-red-500';
    if (percentage >= 50) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-blue-500';
  };

  const getOperationDisplayName = (operation: string): string => {
    const names: Record<string, string> = {
      resume_score: 'Resume Scoring',
      resume_critique: 'Resume Critique',
      resume_rewrite: 'Resume Rewriting',
      cover_letter: 'Cover Letter Generation',
      cv_generation: 'CV Generation',
      company_research: 'Company Research'
    };
    return names[operation] || operation;
  };

  const getOperationTokenLimit = (operation: string): number => {
    return openAIService.getOperationTokenLimit(operation as OperationType);
  };

  if (loading) {
    return (
      <div className={`premium-card p-8 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-6"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenStats) {
    return (
      <div className={`premium-card p-8 ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Token Usage Unavailable
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Unable to load token usage statistics.
          </p>
          <button
            onClick={fetchTokenStats}
            className="premium-button-secondary text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {!hasActiveSubscription ? (
        /* Subscription Required Message */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card p-8 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-4">
              Subscription Required
            </h3>
            <p className="text-orange-700 dark:text-orange-300 mb-6 leading-relaxed max-w-md mx-auto">
              Subscribe to any plan to access AI-powered resume scoring, rewriting, and cover letter generation features.
            </p>
            <div className="bg-orange-100 dark:bg-orange-900/40 rounded-lg p-4 mb-6">
              <div className="text-sm text-orange-800 dark:text-orange-200">
                <p className="font-semibold mb-2">All plans include:</p>
                <ul className="space-y-1 text-left max-w-xs mx-auto">
                  <li>• 150,000 AI tokens monthly</li>
                  <li>• Resume scoring & critique</li>
                  <li>• Professional rewriting</li>
                  <li>• Cover letter generation</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = '/billing'} 
              className="premium-button-primary"
            >
              View Subscription Plans
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Main Usage Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Brain className="w-8 h-8 text-blue-600 mr-4" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    AI Token Usage
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Monthly allocation: {tokenStats?.monthlyLimit.toLocaleString()} tokens
                  </p>
                </div>
              </div>
              <button
                onClick={fetchTokenStats}
                disabled={refreshing}
                className="premium-button-secondary text-sm flex items-center"
              >
                <Clock className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Usage Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {tokenStats?.totalTokens.toLocaleString()}
                    <span className="text-lg font-medium text-gray-500 dark:text-gray-400 ml-2">
                      / {tokenStats?.monthlyLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    tokens consumed this month
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${getUsageStatusColor(tokenStats?.usagePercentage || 0)}`}>
                    {Math.round(tokenStats?.usagePercentage || 0)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    usage rate
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(tokenStats?.usagePercentage || 0, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-4 rounded-full bg-gradient-to-r ${getProgressBarColor(tokenStats?.usagePercentage || 0)} relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
                  </motion.div>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">0</span>
                  <span className={`font-medium ${getUsageStatusColor(tokenStats?.usagePercentage || 0)}`}>
                    {tokenStats?.remainingTokens.toLocaleString()} remaining
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {tokenStats?.monthlyLimit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="text-center">
              {(tokenStats?.usagePercentage || 0) >= 95 ? (
                <div className="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">
                    Critical: Monthly limit nearly exceeded
                  </span>
                </div>
              ) : (tokenStats?.usagePercentage || 0) >= 80 ? (
                <div className="inline-flex items-center px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">
                    Warning: Approaching monthly limit
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">
                    Token usage within normal limits
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Operation Breakdown */}
          {tokenStats && Object.keys(tokenStats.operationCounts).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="premium-card p-6"
            >
              <div className="flex items-center mb-6">
                <BarChart3 className="w-6 h-6 text-purple-600 mr-3" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Operation Breakdown
                </h3>
              </div>

              <div className="space-y-4">
                {Object.entries(tokenStats.operationCounts)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .map(([operation, count]) => {
                    const limit = getOperationTokenLimit(operation);
                    
                    return (
                      <div key={operation} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {getOperationDisplayName(operation)}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {count} requests
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Max {limit.toLocaleString()} tokens per request
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {/* Token Limits Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="premium-card p-6 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50"
          >
            <div className="flex items-center mb-6">
              <Zap className="w-6 h-6 text-yellow-600 mr-3" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Token Allocation Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-lg font-bold text-blue-600 mb-1">3,000</div>
                <div className="text-gray-600 dark:text-gray-400">Resume Score & Critique</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-lg font-bold text-green-600 mb-1">6,000</div>
                <div className="text-gray-600 dark:text-gray-400">Resume & CV Rewriting</div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-lg font-bold text-purple-600 mb-1">6,000</div>
                <div className="text-gray-600 dark:text-gray-400">Cover Letter Generation</div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Active subscribers receive 150,000 tokens monthly. Usage resets on the 1st of each month.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}; 