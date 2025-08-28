import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  Crown, 
  Check, 
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Bot,
  Brain,
  ShoppingCart,
  Coins,
  TrendingUp,
  Package,
  Star,
  Search,
  FileText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  getProductByPriceId, 
  getSubscriptionProducts, 
  getTokenProducts, 
  getPlanLimits,
  getPlanNameByPriceId,
  validateStripeConfig
} from '../../stripe-config';
import toast from 'react-hot-toast';
import { getUserUsageOptimized, getBillingDataOptimized, clearUsageCache } from '../../lib/usageTrackingOptimized';
import { UserUsage } from '../../lib/usageTracking';

interface UserSubscription {
  customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export const BillingPageImproved: React.FC = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'tokens'>('subscriptions');
  const [refreshing, setRefreshing] = useState(false);
  const [stripeConfigError, setStripeConfigError] = useState<string | null>(null);
  
  // Debounce and caching refs
  const lastRefreshTime = useRef<number>(0);
  const refreshDebounceTime = 5000; // 5 seconds
  const isCurrentlyFetching = useRef(false); // Prevent concurrent fetches
  
  // Memoized values to reduce recalculations
  const subscriptionProducts = useMemo(() => getSubscriptionProducts(), []);
  const tokenProducts = useMemo(() => getTokenProducts(), []);

  const isSupabaseConfigured = useCallback(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && 
      supabaseUrl !== 'your_supabase_url_here' && 
      supabaseKey !== 'your_supabase_anon_key_here' &&
      supabaseUrl.startsWith('https://') &&
      supabaseUrl.includes('.supabase.co') &&
      supabaseKey.length > 50
    );
  }, []);

  const fetchBillingData = useCallback(async (isRefresh = false) => {
    // Prevent concurrent fetches
    if (isCurrentlyFetching.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }

    // Debounce check
    const now = Date.now();
    if (isRefresh && (now - lastRefreshTime.current) < refreshDebounceTime) {
      console.log('Refresh debounced');
      return;
    }
    lastRefreshTime.current = now;
    isCurrentlyFetching.current = true;

    try {
      if (isRefresh) {
        setRefreshing(true);
        // Clear cache on manual refresh
        if (user) clearUsageCache(user.id);
      } else {
        setLoading(true);
      }

      if (!isSupabaseConfigured() || !user) {
        setSubscription(null);
        setUsage(null);
        return;
      }

      // Use optimized batch fetch
      const data = await getBillingDataOptimized(user.id);
      
      if (data) {
        setSubscription(data.subscription);
        setUsage(data.usage);
      } else {
        setSubscription(null);
        setUsage(null);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setSubscription(null);
      setUsage(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isCurrentlyFetching.current = false;
    }
  }, [user, isSupabaseConfigured]);

  // Use a ref to track if initial load has completed
  const hasInitialLoadCompleted = useRef(false);

  useEffect(() => {
    // Check Stripe configuration on mount
    const configValidation = validateStripeConfig();
    if (!configValidation.isValid) {
      setStripeConfigError(`Missing Stripe configuration: ${configValidation.missingVars.join(', ')}`);
    }
    
    // Only fetch data once on initial mount
    if (!hasInitialLoadCompleted.current) {
      hasInitialLoadCompleted.current = true;
      fetchBillingData();
    }

    // Listen for billing refresh events from automation completion
    const handleBillingRefresh = () => {
      fetchBillingData(true);
    };

    // Refresh data when page gains focus (user switches tabs)
    // Use a timeout to prevent immediate trigger on mount
    let focusTimeout: NodeJS.Timeout;
    const handleFocus = () => {
      // Clear any existing timeout
      clearTimeout(focusTimeout);
      // Only refresh if we've been on the page for at least 500ms
      focusTimeout = setTimeout(() => {
        if (hasInitialLoadCompleted.current) {
          fetchBillingData(true);
        }
      }, 500);
    };

    window.addEventListener('billing-refresh-needed', handleBillingRefresh);
    window.addEventListener('focus', handleFocus);

    // Auto-refresh data every 30 seconds while page is visible
    const intervalId = setInterval(() => {
      if (!document.hidden && hasInitialLoadCompleted.current) {
        fetchBillingData(true);
      }
    }, 30000);

    // Cleanup
    return () => {
      window.removeEventListener('billing-refresh-needed', handleBillingRefresh);
      window.removeEventListener('focus', handleFocus);
      clearTimeout(focusTimeout);
      clearInterval(intervalId);
    };
  }, [fetchBillingData]);

  const handleRefresh = async () => {
    await fetchBillingData(true);
  };

  const handlePurchase = async (priceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!priceId || priceId.startsWith('price_missing') || !session) {
        toast.error('This product is not yet available.');
        return;
      }

      setPurchasing(priceId);
      
      const product = getProductByPriceId(priceId);
      if (!product) {
        throw new Error('Product not found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: priceId,
          mode: product.mode,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&price_id=${priceId}&type=${product.category}`,
          cancel_url: `${window.location.origin}/billing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
    } finally {
      setPurchasing(null);
    }
  };

  const openBillingPortal = async () => {
    if (!subscription?.customer_id) {
      toast.error('No customer information found');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Authentication required.');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_stripe_portal_link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: subscription.customer_id,
          return_url: `${window.location.origin}/billing`
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create billing portal session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      
      // Check if this is the specific Stripe configuration error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Customer Portal not configured') || 
          errorMessage.includes('No configuration provided') || 
          errorMessage.includes('customer portal settings')) {
        // Show specific guidance for Stripe configuration issue
        toast.error(
          'Stripe Customer Portal not configured. Please set up your customer portal settings in the Stripe dashboard.',
          { 
            duration: 8000,
            style: {
              maxWidth: '500px',
            }
          }
        );
        
        // Show additional help in console for developers
        console.warn(`
🔧 Stripe Configuration Required:

To fix this error, you need to configure your Stripe Customer Portal:

1. Go to: https://dashboard.stripe.com/settings/billing/portal
   (For test mode: https://dashboard.stripe.com/test/settings/billing/portal)
2. Click "Configure portal" or "Activate test link"
3. Configure your customer portal settings
4. Save the configuration

This will create the default configuration needed for the billing portal to work.
        `);
      } else {
        toast.error(errorMessage || 'Unable to open billing portal');
      }
    }
  };

  // Helper functions
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'from-red-500 to-red-600';
    if (percentage >= 75) return 'from-orange-500 to-red-500';
    if (percentage >= 50) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-blue-500';
  };

  const getUsageStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-orange-600 dark:text-orange-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  // Calculate current plan details
  const currentProduct = useMemo(() => {
    if (subscription?.price_id) {
      return getProductByPriceId(subscription.price_id);
    }
    return null;
  }, [subscription]);

  const planLimits = useMemo(() => {
    if (subscription?.price_id) {
      return getPlanLimits(subscription.price_id) || { applications: 0, aiTokens: 0, isSubscription: false };
    }
    return { applications: 0, aiTokens: 0, isSubscription: false };
  }, [subscription]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card p-8 text-center mb-16"
        >
          <h1 className="text-[32px] font-semibold text-gray-900 dark:text-white mb-2">
            Choose Your Plan
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Select the perfect plan for your job search automation needs
          </p>
          {stripeConfigError && (
            <div className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Billing service configuration issue
            </div>
          )}
        </motion.div>

        {/* Current Plan Status & Usage Cards */}
        {subscription && subscription.subscription_status === 'active' && (
          <div className="max-w-4xl mx-auto mb-12 space-y-6">
            {/* Current Plan Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="glass-card relative overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 disabled:opacity-50"
                    title="Refresh billing data"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500 transition-transform duration-500 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                <div className="flex items-center space-x-4 mb-6">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="relative p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-lg"
                  >
                    <Crown className="w-6 h-6 text-white" />
                    <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse" />
                  </motion.div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {currentProduct?.name?.replace('Jobotic ', '') || 
                       (subscription?.price_id ? getPlanNameByPriceId(subscription.price_id) : 'Free')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        Active Plan
                      </span>
                    </div>
                  </div>
                </div>

                {subscription.current_period_end && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Renews {formatDate(subscription.current_period_end)}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={openBillingPortal}
                  className="w-full group relative px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl transition-all duration-200 text-sm font-medium overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                    Manage Subscription
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Usage Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agent Steps Usage Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="glass-card relative overflow-hidden shadow-xl"
              >
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <motion.div 
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="relative p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg"
                      >
                        <Bot className="w-6 h-6 text-white" />
                        <motion.div 
                          className="absolute inset-0 bg-white/30 rounded-xl"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Steps</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          AI agent steps used this month
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <motion.span 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent"
                      >
                        {(usage?.automation_steps?.used || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {usage?.automation_steps?.limit && usage.automation_steps.limit > 0 
                          ? `of ${usage.automation_steps.limit.toLocaleString()} included` 
                          : 'No plan limits'}
                      </span>
                    </div>
                  
                    {usage?.automation_steps?.limit && usage.automation_steps.limit > 0 && (
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${usage.automation_steps.percentage}%` }}
                            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                            className="h-full relative overflow-hidden"
                          >
                            <div className={`absolute inset-0 bg-gradient-to-r ${getProgressBarColor(usage.automation_steps.percentage)}`} />
                            <motion.div 
                              className="absolute inset-0 bg-white/30"
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                          </motion.div>
                        </div>
                      </div>
                    )}
                  
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {!usage?.automation_steps?.limit || usage.automation_steps.limit === 0 ? 
                          <span className="italic">Subscribe to get automation steps</span> :
                          usage.automation_steps.percentage >= 100 ? 
                            <span className="text-orange-600 dark:text-orange-400 font-medium">Additional: $0.03 per step</span> :
                            <span>{usage.automation_steps.remaining.toLocaleString()} remaining</span>
                        }
                      </span>
                      {usage?.automation_steps?.limit && usage.automation_steps.limit > 0 && (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-sm font-bold ${getUsageStatusColor(usage.automation_steps.percentage)}`}
                        >
                          {Math.round(usage.automation_steps.percentage)}% used
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Job Search Usage Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="glass-card relative overflow-hidden shadow-xl"
              >
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <motion.div 
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        className="relative p-3 bg-gradient-to-br from-teal-500 to-green-600 rounded-xl shadow-lg"
                      >
                        <Search className="w-6 h-6 text-white" />
                        <motion.div 
                          className="absolute inset-0 bg-white/30 rounded-xl"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Job Searches</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          AI-powered job matches this month
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <motion.span 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-bold bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent"
                      >
                        {(usage?.job_search_match?.used || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Unlimited
                      </span>
                    </div>
                  
                    <div className="relative">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
                          className="h-full relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-green-600" />
                          <motion.div 
                            className="absolute inset-0 bg-white/30"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                          />
                        </motion.div>
                      </div>
                    </div>
                  
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Unlimited searches available
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Usage Warning */}
            {usage?.automation_steps && usage.automation_steps.percentage >= 80 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-amber-800 dark:text-amber-200 mb-3">
                      Approaching Usage Limits
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 mb-6 leading-relaxed">
                      You're approaching your monthly limits. Consider upgrading to get more applications and AI tokens 
                      to continue using the service without interruption.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={() => setActiveTab('subscriptions')}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                      >
                        <TrendingUp className="w-5 h-5 mr-2 inline" />
                        Upgrade Plan
                      </button>
                      <button 
                        onClick={() => setActiveTab('tokens')}
                        className="bg-white/10 dark:bg-white/10 border border-amber-200/50 dark:border-amber-400/50 text-amber-800 dark:text-amber-200 hover:bg-white/20 dark:hover:bg-white/20 px-6 py-3 rounded-xl font-semibold transition-colors backdrop-blur-sm"
                      >
                        <Package className="w-5 h-5 mr-2 inline" />
                        Buy Token Packs
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Plan Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex justify-center mb-12 relative z-10"
        >
          <div className="relative bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm border border-gray-200 dark:border-gray-700">
            <motion.div
              className="absolute top-1 bottom-1 bg-gray-900 dark:bg-white rounded-full"
              animate={{ 
                left: activeTab === 'subscriptions' ? '4px' : 'calc(50% + 4px)',
                width: 'calc(50% - 8px)'
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            />
            <div className="relative flex gap-1 z-10">
              <button
                type="button"
                onClick={() => setActiveTab('subscriptions')}
                className={`px-8 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'subscriptions' ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Crown className="w-5 h-5" />
                <span>Subscriptions</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tokens')}
                className={`px-8 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'tokens' ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Coins className="w-5 h-5" />
                <span>Token Packs</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Subscription Plans */}
        {activeTab === 'subscriptions' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {subscriptionProducts.map((product, index) => {
              const isCurrentPlan = subscription?.price_id === product.priceId;
              const isPopular = product.name.includes('Pro');
              const isPriceValid = !product.priceId.startsWith('price_missing');
              const isFeatured = index === 1;
              const displayName = index === 0 ? 'Starter' : index === 1 ? 'Pro' : 'Max';
              const badgeLabel = index === 0 ? 'FREE' : index === 1 ? 'PRO' : 'ADVANCE';
              const badgeColor = index === 0 ? 'bg-gray-100 text-gray-700' : index === 1 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700';
              const badgeDot = index === 0 ? 'bg-emerald-400' : index === 1 ? 'bg-orange-500' : 'bg-emerald-500';
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay: index * 0.05 }}
                  className="relative"
                >
                  {/* Current Plan Indicator */}
                  {isCurrentPlan && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -top-3 left-6 z-10"
                    >
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-full shadow-lg">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        Current Plan
                      </div>
                    </motion.div>
                  )}

                  {/* Popular Badge */}
                  {isPopular && !isCurrentPlan && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -top-3 right-6 z-10"
                    >
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-medium rounded-full shadow-lg">
                        <Star className="w-3 h-3" />
                        Most Popular
                      </div>
                    </motion.div>
                  )}

                  <div 
                    className={`
                      relative overflow-hidden rounded-2xl border 
                      ${isFeatured ? 'bg-gradient-to-b from-gray-900 to-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'}
                      transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
                      ${!isPriceValid ? 'opacity-60' : ''}
                      h-full min-h-[480px]
                    `}
                  >
                    {/* Corner dots */}
                    <span className={`absolute top-3 left-3 h-2 w-2 rounded-full ${isFeatured ? 'bg-white/20' : 'bg-gray-200'}`}></span>
                    <span className={`absolute top-3 right-3 h-2 w-2 rounded-full ${isFeatured ? 'bg-white/20' : 'bg-gray-200'}`}></span>
                    <span className={`absolute bottom-3 left-3 h-2 w-2 rounded-full ${isFeatured ? 'bg-white/20' : 'bg-gray-200'}`}></span>
                    <span className={`absolute bottom-3 right-3 h-2 w-2 rounded-full ${isFeatured ? 'bg-white/20' : 'bg-gray-200'}`}></span>
                    
                    {/* Plan badge */}
                    <div className={`absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>
                      <span className={`h-2 w-2 rounded-full ${badgeDot}`}></span>
                      {badgeLabel}
                    </div>

                    <div className="relative p-8 flex flex-col h-full">
                      {/* Plan Header */}
                      <div className="text-center mb-6">
                        <h3 className={`text-sm font-semibold mb-1 ${isFeatured ? 'text-white' : 'text-gray-900'}`}>{displayName} Plan</h3>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className={`text-4xl font-bold ${isFeatured ? 'text-white' : 'text-gray-900'}`}>${product.price}</span>
                          <span className={`text-xs font-medium ${isFeatured ? 'text-gray-300' : 'text-gray-500'}`}>/month</span>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="mb-8 flex-grow">
                        <ul className={`space-y-2 ${isFeatured ? 'text-gray-200' : 'text-gray-700'}`}>
                          <li className="flex items-center justify-between text-sm">
                            <span>Applications</span>
                            <span className={`${isFeatured ? 'text-white' : 'text-gray-900'} font-medium`}>
                              {(product.applicationCount ?? 0)}/mo
                            </span>
                          </li>
                          <li className="flex items-center justify-between text-sm">
                            <span>Agent steps</span>
                            <span className={`${isFeatured ? 'text-white' : 'text-gray-900'} font-medium`}>
                              {(((product.applicationCount ?? 0) * 10)).toLocaleString()}
                            </span>
                          </li>
                          <li className="flex items-center justify-between text-sm">
                            <span>AI tokens</span>
                            <span className={`${isFeatured ? 'text-white' : 'text-gray-900'} font-medium`}>Unlimited</span>
                          </li>
                          <li className="text-sm">Resume optimization tools</li>
                          <li className="text-sm">AI‑powered job matching</li>
                          <li className="text-sm">{product.name.includes('Plus') ? 'Email support' : product.name.includes('Pro') ? 'Priority support' : 'Priority support + Early access'}</li>
                        </ul>
                      </div>

                      {/* CTA Button */}
                      <button
                        onClick={() => handlePurchase(product.priceId)}
                        disabled={isCurrentPlan || purchasing === product.priceId || !isPriceValid}
                        className={`
                          w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500
                          flex items-center justify-center gap-2
                          ${
                            isCurrentPlan
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : !isPriceValid
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isFeatured
                              ? 'bg-white text-gray-900 hover:bg-gray-100'
                              : 'bg-gray-900 text-white hover:bg-black'
                          }
                        `}
                      >
                        {purchasing === product.priceId ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : isCurrentPlan ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Current Plan</span>
                          </>
                        ) : !isPriceValid ? (
                          <span>Coming Soon</span>
                        ) : (
                          <>
                            <span>{isPopular ? 'Get Started' : 'Select Plan'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Token Packs */}
        {activeTab === 'tokens' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {tokenProducts.map((product, index) => {
              const isPriceValid = !product.priceId.startsWith('price_missing');
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className={`relative glass-card rounded-2xl transition-all duration-300 hover:shadow-2xl ${
                    !isPriceValid ? 'opacity-60' : ''
                  }`}
                >
                  <div className="p-8">
                    {/* Token Pack Header */}
                    <div className="text-center mb-8">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                        product.name.includes('Job') ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                        'bg-gradient-to-br from-amber-500 to-amber-600'
                      }`}>
                        {product.name.includes('Job') ? (
                          <Bot className="w-8 h-8 text-white" />
                        ) : (
                          <Brain className="w-8 h-8 text-white" />
                        )}
                      </div>
                      
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {product.name}
                      </h3>
                      
                      <div className="mb-4">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          one-time
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-8">
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Features */}
                    <div className="mb-8">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                        Includes
                      </h4>
                      {product.features && (
                        <ul className="space-y-3">
                          {product.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                              <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* CTA Button */}
                    <motion.button
                      whileHover={isPriceValid ? { scale: 1.02 } : {}}
                      whileTap={isPriceValid ? { scale: 0.98 } : {}}
                      onClick={() => handlePurchase(product.priceId)}
                      disabled={purchasing === product.priceId || !isPriceValid}
                      className={`relative w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 overflow-hidden ${
                        !isPriceValid
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl'
                      }`}
                    >
                      <span className="relative z-10">
                        {purchasing === product.priceId ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Loading...
                          </div>
                        ) : !isPriceValid ? (
                          'Coming Soon'
                        ) : (
                          <div className="flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            Buy Now
                          </div>
                        )}
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingPageImproved;