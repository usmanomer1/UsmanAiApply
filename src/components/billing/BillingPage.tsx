import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Check, 
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2,
  HelpCircle,
  Star,
  Shield,
  ArrowRight,
  Bot,
  Brain,
  Package,
  ShoppingCart,
  Coins,
  BarChart3,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  STRIPE_PRODUCTS, 
  getProductByPriceId, 
  getSubscriptionProducts, 
  getTokenProducts, 
  formatPrice, 
  getCurrencySymbol,
  getPlanLimits
} from '../../stripe-config';
import toast from 'react-hot-toast';

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
  total_cost: number;
  job_tokens: number;
  applications_count: number;
  ai_requests_count: number;
  ai_tokens_used: number;
}

// Demo data for when Supabase is not configured
const DEMO_SUBSCRIPTION: UserSubscription = {
  customer_id: 'cus_demo123',
  subscription_id: 'sub_demo123',
  subscription_status: 'active',
  price_id: 'price_1RaM5LQGabzJD80B3zGbTHcZ', // Pro plan
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
  cancel_at_period_end: false,
  payment_method_brand: 'visa',
  payment_method_last4: '4242'
};

const DEMO_USAGE: UsageStats = {
  total_steps: 1250,
  total_cost: 12.50,
  job_tokens: 15, // 15 job applications used
  applications_count: 15,
  ai_requests_count: 20,
  ai_tokens_used: 6000 // 6000 AI tokens used out of 30000
};

export const BillingPage: React.FC = () => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'tokens'>('subscriptions');

  useEffect(() => {
    fetchBillingData();
  }, [user]);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  const fetchBillingData = async () => {
    try {
      setLoading(true);

      if (!isSupabaseConfigured()) {
        setSubscription(DEMO_SUBSCRIPTION);
        setUsage(DEMO_USAGE);
        return;
      }

      if (!user) {
        setSubscription(DEMO_SUBSCRIPTION);
        setUsage(DEMO_USAGE);
        return;
      }

      // Fetch subscription using the view
      const { data: subData, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        setSubscription(null);
        setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0 });
        return;
      }

      setSubscription(subData);

      // Fetch usage stats for current month
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      if (subData) {
        // Get job applications count for current month (this is the actual applications, not tokens)
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('applications')
          .select(`
            id,
            job_campaigns!campaign_id(
              profiles!inner(user_id)
            )
          `)
          .eq('job_campaigns.profiles.user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString());

        const applicationsCount = applicationsData?.length || 0;

        // Get AI token usage for current month - use max_tokens_requested field
        const { data: aiUsageData, error: aiUsageError } = await supabase
          .from('ai_token_usage')
          .select('max_tokens_requested, operation_type')
          .eq('user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString());

        // Calculate AI token usage from max_tokens_requested
        let aiRequestsCount = 0;
        let aiTokensUsed = 0;
        if (aiUsageData && !aiUsageError) {
          aiTokensUsed = aiUsageData.reduce((sum, log) => sum + (log.max_tokens_requested || 0), 0);
          aiRequestsCount = aiUsageData.length;
        }

        // Get browser use logs for step count (for reference)
        const { data: usageData, error: usageError } = await supabase
          .from('browser_use_logs')
          .select('step_count, cost_usd')
          .eq('user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString());

        const totalSteps = usageData?.reduce((sum, log) => sum + log.step_count, 0) || 0;
        const totalCost = usageData?.reduce((sum, log) => sum + parseFloat(log.cost_usd.toString()), 0) || 0;
        const jobTokens = Math.ceil(totalSteps / 10); // This is for reference, but we use applicationsCount for the actual metric

        setUsage({
          total_steps: totalSteps,
          total_cost: totalCost,
          job_tokens: applicationsCount, // Use actual applications count, not calculated tokens
          applications_count: applicationsCount,
          ai_requests_count: aiRequestsCount,
          ai_tokens_used: aiTokensUsed // This now uses max_tokens_requested
        });
      } else {
        setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0 });
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setSubscription(null);
      setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (priceId: string) => {
    if (!isSupabaseConfigured() || !user || !session) {
      toast.error('Please connect Supabase to enable payments');
      return;
    }

    setPurchasing(priceId);
    
    try {
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
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
    } finally {
      setPurchasing(null);
    }
  };

  const openBillingPortal = () => {
    toast.success('Opening billing portal...');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getCurrentProduct = () => {
    if (!subscription?.price_id) return null;
    return getProductByPriceId(subscription.price_id);
  };

  // Get plan limits based on current subscription using the helper function
  const getPlanUsageLimits = () => {
    if (!subscription?.price_id) {
      return { applications: 0, aiTokens: 0, isSubscription: false };
    }
    
    const limits = getPlanLimits(subscription.price_id);
    return limits || { applications: 0, aiTokens: 0, isSubscription: false };
  };

  const getUsageProgress = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const subscriptionProducts = getSubscriptionProducts();
  const tokenProducts = getTokenProducts();
  const limits = getPlanUsageLimits();
  const applicationProgress = getUsageProgress(usage?.applications_count || 0, limits.applications);
  const aiTokenProgress = getUsageProgress(usage?.ai_tokens_used || 0, limits.aiTokens);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Select the perfect plan for your job search automation needs
          </p>
          {!isSupabaseConfigured() && (
            <div className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Demo mode - Connect Supabase to enable payments
            </div>
          )}
        </div>

        {/* Current Plan Status & Usage */}
        {subscription && subscription.subscription_status === 'active' && (
          <div className="max-w-4xl mx-auto mb-12 space-y-6">
            {/* Current Plan Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                <button
                  onClick={fetchBillingData}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {getCurrentProduct()?.name?.replace('AIApply ', '') || 'Pro'}
                  </div>
                  <div className="text-sm text-emerald-600 dark:text-emerald-400">
                    Active Plan
                  </div>
                </div>
              </div>

              {subscription.current_period_end && (
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Renews {formatDate(subscription.current_period_end)}
                </div>
              )}

              <button
                onClick={openBillingPortal}
                className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4 inline mr-2" />
                Manage Subscription
              </button>
            </div>

            {/* Usage Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Job Applications Usage */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Job Applications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Automated applications this month
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {usage?.applications_count || 0}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      of {limits.applications} included
                    </span>
                  </div>
                  
                  {limits.applications > 0 && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${applicationProgress}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-3 rounded-full bg-gradient-to-r ${getProgressBarColor(applicationProgress)}`}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {applicationProgress >= 100 ? 
                        'Additional: $0.80 each' :
                        `${limits.applications - (usage?.applications_count || 0)} remaining`
                      }
                    </span>
                    <span className={`font-bold ${getUsageStatusColor(applicationProgress)}`}>
                      {Math.round(applicationProgress)}% used
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Tokens Usage */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Tokens</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Resume & cover letter generation
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(usage?.ai_tokens_used || 0).toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      of {limits.aiTokens.toLocaleString()} included
                    </span>
                  </div>
                  
                  {limits.aiTokens > 0 && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${aiTokenProgress}%` }}
                        transition={{ duration: 1, delay: 0.7 }}
                        className={`h-3 rounded-full bg-gradient-to-r ${getProgressBarColor(aiTokenProgress)}`}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {aiTokenProgress >= 100 ? 
                        'Additional: $0.10 per 1,000' :
                        `${(limits.aiTokens - (usage?.ai_tokens_used || 0)).toLocaleString()} remaining`
                      }
                    </span>
                    <span className={`font-bold ${getUsageStatusColor(aiTokenProgress)}`}>
                      {Math.round(aiTokenProgress)}% used
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Warning */}
            {(applicationProgress >= 80 || aiTokenProgress >= 80) && (
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
                        className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-6 py-3 rounded-xl font-semibold transition-colors"
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
        <div className="flex justify-center mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'subscriptions'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4 mr-2 inline" />
              Subscriptions
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'tokens'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4 mr-2 inline" />
              Token Packs
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        {activeTab === 'subscriptions' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {subscriptionProducts.map((product, index) => {
              const isCurrentPlan = subscription?.price_id === product.priceId;
              const isPopular = product.name.includes('Plus');
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border transition-all duration-300 hover:shadow-xl ${
                    isCurrentPlan
                      ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
                      : isPopular
                      ? 'border-purple-500 ring-2 ring-purple-500 ring-opacity-20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="p-8">
                    {/* Plan Header */}
                    <div className="text-center mb-8">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {product.name.replace('AIApply ', '')}
                      </h3>
                      
                      <div className="mb-4">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">
                          ${product.price}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          /{product.interval}
                        </span>
                      </div>
                    </div>

                    {/* Includes Section */}
                    <div className="mb-8">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                        Includes
                      </h4>
                      <ul className="space-y-3">
                        <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                          {product.applicationCount} job applications/month
                        </li>
                        <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                          {product.aiTokenCount?.toLocaleString()} AI tokens/month
                        </li>
                        <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                          Resume & cover letter tools
                        </li>
                        {product.name.includes('Plus') && (
                          <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                            Priority support
                          </li>
                        )}
                        {product.name.includes('Extreme') && (
                          <>
                            <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                              <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                              Priority support
                            </li>
                            <li className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                              <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                              Early feature access
                            </li>
                          </>
                        )}
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handlePurchase(product.priceId)}
                      disabled={isCurrentPlan || purchasing === product.priceId}
                      className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                        isCurrentPlan
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : isPopular
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {purchasing === product.priceId ? (
                        <div className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </div>
                      ) : isCurrentPlan ? (
                        'Current Plan'
                      ) : (
                        'Get Started'
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Token Packs */}
        {activeTab === 'tokens' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {tokenProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 hover:shadow-xl"
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
                        per {product.name.includes('Job') ? 'token' : '1,000 tokens'}
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
                  <button
                    onClick={() => handlePurchase(product.priceId)}
                    disabled={purchasing === product.priceId}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                  >
                    {purchasing === product.priceId ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Now
                      </div>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* FAQ Link */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Have questions about our pricing?
          </p>
          <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium inline-flex items-center">
            <HelpCircle className="w-4 h-4 mr-2" />
            View Pricing FAQ
          </button>
        </div>
      </div>
    </div>
  );
};