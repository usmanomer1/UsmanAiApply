import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CreditCard, 
  Crown, 
  Check, 
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2,
  Star,
  ArrowRight,
  Bot,
  Brain,
  ShoppingCart,
  Coins,
  AlertCircle,
  CheckCircle,
  Search
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
import { getUserUsage } from '../../lib/usageTracking';

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

interface UsageStats {
  total_steps: number;
  job_tokens: number;
  job_search_matches: number;
  resume_optimizations: number;
  cover_letters: number;
}

export const BillingPageOptimized: React.FC = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'tokens'>('subscriptions');
  const [refreshing, setRefreshing] = useState(false);
  
  // Debounce ref to prevent multiple refreshes
  const lastRefreshTime = useRef<number>(0);
  const refreshDebounceTime = 5000; // 5 seconds

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && 
      supabaseUrl !== 'your_supabase_url_here' && 
      supabaseKey !== 'your_supabase_anon_key_here' &&
      supabaseUrl.startsWith('https://') &&
      supabaseUrl.includes('.supabase.co') &&
      supabaseKey.length > 50
    );
  };

  const fetchBillingData = useCallback(async (isRefresh = false) => {
    // Debounce check
    const now = Date.now();
    if (isRefresh && (now - lastRefreshTime.current) < refreshDebounceTime) {
      console.log('Refresh debounced');
      return;
    }
    lastRefreshTime.current = now;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!isSupabaseConfigured() || !user) {
        setSubscription(null);
        setUsage({ total_steps: 0, job_tokens: 0, job_search_matches: 0, resume_optimizations: 0, cover_letters: 0 });
        return;
      }

      // Single optimized query for subscription
      const { data: subData } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setSubscription(subData);
      
      // Get usage data
      const usageData = await getUserUsage(user.id);
      
      setUsage({
        total_steps: usageData.automation_steps.used,
        job_tokens: usageData.automation_steps.used,
        job_search_matches: usageData.job_search_match.used,
        resume_optimizations: usageData.resume_optimization.used,
        cover_letters: usageData.cover_letter_generation.used
      });
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setSubscription(null);
      setUsage({ total_steps: 0, job_tokens: 0, job_search_matches: 0, resume_optimizations: 0, cover_letters: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBillingData();

    // Smart event-based refresh (not polling)
    const handleBillingRefresh = () => {
      fetchBillingData(true);
    };

    window.addEventListener('billing-refresh-needed', handleBillingRefresh);

    return () => {
      window.removeEventListener('billing-refresh-needed', handleBillingRefresh);
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

      if (!response.ok) {
        throw new Error('Failed to create billing portal session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Unable to open billing portal');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getUsageProgress = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Calculate values directly
  const subscriptionProducts = getSubscriptionProducts();
  const tokenProducts = getTokenProducts();
  
  let currentProduct = null;
  if (subscription?.price_id) {
    currentProduct = getProductByPriceId(subscription.price_id);
  }

  let limits = { applications: 0, aiTokens: 0, isSubscription: false };
  if (subscription?.price_id) {
    const direct = getPlanLimits(subscription.price_id.trim());
    if (direct) {
      limits = direct;
    } else {
      const prod = getProductByPriceId(subscription.price_id);
      if (prod) {
        limits = {
          applications: prod.applicationCount || 0,
          aiTokens: prod.aiTokenCount || 0,
          isSubscription: prod.mode === 'subscription'
        };
      }
    }
  }

  const applicationProgress = getUsageProgress(usage?.job_tokens || 0, limits.applications * 10);

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
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Choose Your Plan
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select the perfect plan for your job search automation needs
          </p>
        </div>

        {/* Current Plan & Usage */}
        {subscription && subscription.subscription_status === 'active' && (
          <div className="max-w-4xl mx-auto mb-12 space-y-6">
            {/* Current Plan Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh billing data"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <Crown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {currentProduct?.name?.replace('Jobotic ', '') || 
                     (subscription?.price_id ? getPlanNameByPriceId(subscription.price_id) : 'Free')}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      Active Plan
                    </span>
                  </div>
                </div>
              </div>

              {subscription.current_period_end && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                  <Calendar className="w-4 h-4" />
                  <span>Renews {formatDate(subscription.current_period_end)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={openBillingPortal}
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4 inline mr-2" />
                Manage Subscription
              </button>
            </div>

            {/* Usage Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agent Steps Usage */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Steps</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      AI agent steps used this month
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(usage?.job_tokens || 0).toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {limits.applications > 0 ? `of ${(limits.applications * 10).toLocaleString()}` : 'No limit'}
                    </span>
                  </div>
                
                  {limits.applications > 0 && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getProgressBarColor(applicationProgress)} transition-all duration-300`}
                        style={{ width: `${applicationProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Job Search Usage */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
                    <Search className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Job Searches</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      AI-powered job matches this month
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      Unlimited
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      All plans included
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-teal-500 w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('subscriptions')}
              className={`px-8 py-2 rounded-full font-medium transition-colors ${
                activeTab === 'subscriptions' 
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <Crown className="w-5 h-5 inline mr-2" />
              Subscriptions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tokens')}
              className={`px-8 py-2 rounded-full font-medium transition-colors ${
                activeTab === 'tokens' 
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <Coins className="w-5 h-5 inline mr-2" />
              Token Packs
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        {activeTab === 'subscriptions' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {subscriptionProducts.map((product, index) => {
              const isCurrentPlan = subscription?.price_id === product.priceId;
              const isPopular = product.name.includes('Pro');
              const isPriceValid = !product.priceId.startsWith('price_missing');
              const isFeatured = index === 1;
              const displayName = index === 0 ? 'Starter' : index === 1 ? 'Pro' : 'Max';
              
              return (
                <div
                  key={product.id}
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border ${
                    isFeatured ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-6">
                      <div className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                        Current Plan
                      </div>
                    </div>
                  )}

                  {isPopular && !isCurrentPlan && (
                    <div className="absolute -top-3 right-6">
                      <div className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-full">
                        <Star className="w-3 h-3 inline mr-1" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{displayName}</h3>
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${product.price}
                      <span className="text-sm font-normal text-gray-500">/month</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mr-3" />
                      {product.applicationCount || 0} applications/month
                    </li>
                    <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mr-3" />
                      {((product.applicationCount || 0) * 10).toLocaleString()} agent steps
                    </li>
                    <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mr-3" />
                      Unlimited AI tokens
                    </li>
                    <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mr-3" />
                      Resume optimization tools
                    </li>
                    <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Check className="w-4 h-4 text-green-500 mr-3" />
                      AI-powered job matching
                    </li>
                  </ul>

                  <button
                    onClick={() => handlePurchase(product.priceId)}
                    disabled={isCurrentPlan || purchasing === product.priceId || !isPriceValid}
                    className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : !isPriceValid
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isFeatured
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                    }`}
                  >
                    {purchasing === product.priceId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      <>
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Current Plan
                      </>
                    ) : !isPriceValid ? (
                      'Coming Soon'
                    ) : (
                      <>
                        {isPopular ? 'Get Started' : 'Select Plan'}
                        <ArrowRight className="w-4 h-4 inline ml-2" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Token Packs */}
        {activeTab === 'tokens' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {tokenProducts.map((product) => {
              const isPriceValid = !product.priceId.startsWith('price_missing');
              
              return (
                <div
                  key={product.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="text-center mb-8">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                      product.name.includes('Job') ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      {product.name.includes('Job') ? (
                        <Bot className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Brain className="w-8 h-8 text-amber-600 dark:text-amber-400" />
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

                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    {product.description}
                  </p>

                  {product.features && (
                    <ul className="space-y-3 mb-8">
                      {product.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => handlePurchase(product.priceId)}
                    disabled={purchasing === product.priceId || !isPriceValid}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                      !isPriceValid
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {purchasing === product.priceId ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                        Loading...
                      </>
                    ) : !isPriceValid ? (
                      'Coming Soon'
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5 mr-2 inline" />
                        Buy Now
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};