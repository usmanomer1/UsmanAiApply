import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Check, 
  ExternalLink,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Star,
  Shield,
  Sparkles,
  ArrowRight,
  Gift,
  Bot,
  Send,
  Settings,
  RefreshCw,
  Loader2,
  HelpCircle,
  Info,
  FileText,
  Brain,
  Activity,
  Target,
  Lightbulb,
  Package,
  ShoppingCart,
  Coins
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
  getPlanLimits,
  calculateOverageCost
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
  price_id: 'price_1RaM5LQGabzJD80B3zGbTHcZ',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
  cancel_at_period_end: false,
  payment_method_brand: 'visa',
  payment_method_last4: '4242'
};

const DEMO_USAGE: UsageStats = {
  total_steps: 1250,
  total_cost: 12.50,
  job_tokens: 125, // 1250 steps / 10 = 125 tokens
  applications_count: 23,
  ai_requests_count: 15,
  ai_tokens_used: 15000 // 15k tokens used
};

// Tooltip component for usage explanations
const UsageTooltip: React.FC<{ children: React.ReactNode; content: string }> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg px-3 py-2 max-w-xs shadow-lg">
            <div className="text-center">{content}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BillingPage: React.FC = () => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showFAQ, setShowFAQ] = useState(false);
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
        console.log('Supabase not configured, using demo data');
        setSubscription(DEMO_SUBSCRIPTION);
        setUsage(DEMO_USAGE);
        return;
      }

      if (!user) {
        console.log('No user found, using demo data');
        setSubscription(DEMO_SUBSCRIPTION);
        setUsage(DEMO_USAGE);
        return;
      }

      console.log('Fetching real billing data for user:', user.email);

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
        const { data: usageData, error: usageError } = await supabase
          .from('browser_use_logs')
          .select('step_count, cost_usd')
          .eq('user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString());

        if (usageError) {
          console.error('Error fetching usage:', usageError);
          setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0 });
        } else {
          // Calculate totals
          const totalSteps = usageData?.reduce((sum, log) => sum + log.step_count, 0) || 0;
          const totalCost = usageData?.reduce((sum, log) => sum + parseFloat(log.cost_usd.toString()), 0) || 0;
          const jobTokens = Math.ceil(totalSteps / 10); // 10 steps = 1 token

          // Get applications count for current month
          const { count: applicationsCount } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', currentMonthStart.toISOString())
            .lt('created_at', nextMonthStart.toISOString());

          // Get AI token usage for current month
          const { data: aiUsageData, error: aiUsageError } = await supabase
            .from('ai_token_usage')
            .select('total_tokens, operation_type')
            .eq('user_id', user.id)
            .gte('created_at', currentMonthStart.toISOString())
            .lt('created_at', nextMonthStart.toISOString());

          // Calculate AI token usage
          let aiRequestsCount = 0;
          let aiTokensUsed = 0;
          if (aiUsageData && !aiUsageError) {
            aiTokensUsed = aiUsageData.reduce((sum, log) => sum + (log.total_tokens || 0), 0);
            aiRequestsCount = aiUsageData.length;
          }

          setUsage({
            total_steps: totalSteps,
            total_cost: totalCost,
            job_tokens: jobTokens,
            applications_count: applicationsCount || 0,
            ai_requests_count: aiRequestsCount,
            ai_tokens_used: aiTokensUsed
          });
        }
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
    // In a real app, this would redirect to Stripe Customer Portal
    toast.success('Opening billing portal...');
    // window.location.href = '/api/stripe/portal';
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

  const getCurrentPlanLimits = () => {
    if (!subscription?.price_id) return null;
    return getPlanLimits(subscription.price_id);
  };

  const getUsageProgress = (used: number, limit: number) => {
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  };

  const getOverageCosts = () => {
    const limits = getCurrentPlanLimits();
    if (!limits || !usage) return null;

    return calculateOverageCost(
      { applications: usage.job_tokens, aiTokens: usage.ai_tokens_used },
      { applications: limits.applications, aiTokens: limits.aiTokens }
    );
  };

  // FAQ Component
  const FAQModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pricing & Usage FAQ</h2>
            <button
              onClick={() => setShowFAQ(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                Subscription Plans
              </h3>
              <div className="space-y-3 text-blue-800 dark:text-blue-200">
                <p><strong>Pro Plan ($25/month):</strong> 37 job applications + 30,000 AI tokens</p>
                <p><strong>Pro Plus ($50/month):</strong> 77 job applications + 30,000 AI tokens</p>
                <p><strong>Extreme ($100/month):</strong> 158 job applications + 30,000 AI tokens + priority support</p>
                <p><strong>Overage:</strong> Additional applications $0.80 each, AI tokens $0.10 per 1,000</p>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Token Packs
              </h3>
              <div className="space-y-3 text-purple-800 dark:text-purple-200">
                <p><strong>Job Application Tokens:</strong> $0.80 per token (1 token = 10 automation steps)</p>
                <p><strong>AI ToolSuite Tokens:</strong> $0.10 per 1,000 tokens for resume/CV/cover letter tools</p>
                <p><strong>Flexibility:</strong> Buy only what you need, no monthly commitments</p>
                <p><strong>Perfect for:</strong> Users who prefer pay-as-you-go pricing</p>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Payment & Security
              </h3>
              <div className="space-y-3 text-emerald-800 dark:text-emerald-200">
                <p><strong>Secure payments:</strong> All transactions processed through Stripe</p>
                <p><strong>Multiple currencies:</strong> USD supported with more coming soon</p>
                <p><strong>Cancel anytime:</strong> No long-term contracts for subscriptions</p>
                <p><strong>Instant access:</strong> Tokens and features available immediately after purchase</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mb-4"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl shimmer"></div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl shimmer"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const subscriptionProducts = getSubscriptionProducts();
  const tokenProducts = getTokenProducts();
  const currentPlanLimits = getCurrentPlanLimits();
  const overageCosts = getOverageCosts();

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-lg text-gray-900 dark:text-white mb-3">Billing & Plans</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">Choose the perfect plan for your job search needs</p>
            {!isSupabaseConfigured() && (
              <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                Demo mode - Connect Supabase to enable payments
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFAQ(true)}
            className="premium-button-secondary flex items-center"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Pricing FAQ
          </button>
        </div>
      </motion.div>

      {/* Current Plan Card */}
      {subscription && subscription.subscription_status !== 'not_started' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="premium-card p-8 hover-lift"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Current Plan</h2>
            <button
              onClick={fetchBillingData}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                {getCurrentProduct()?.name.includes('Extreme') ? (
                  <Crown className="w-6 h-6 text-white" />
                ) : (
                  <Star className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {getCurrentProduct()?.name || 'Pro'}
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  {subscription.subscription_status === 'active' ? 'Active Plan' : subscription.subscription_status}
                </div>
              </div>
            </div>

            {subscription.current_period_end && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex items-center text-gray-600 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="font-medium">Next renewal: {formatDate(subscription.current_period_end)}</span>
                </div>
                {subscription.payment_method_brand && subscription.payment_method_last4 && (
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span>{subscription.payment_method_brand.toUpperCase()} •••• {subscription.payment_method_last4}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={openBillingPortal}
              className="premium-button-secondary w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Subscription
            </button>
          </div>
        </motion.div>
      )}

      {/* Usage Overview */}
      {subscription && subscription.subscription_status === 'active' && currentPlanLimits && usage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Job Applications Usage */}
          <div className="premium-card p-6 hover-lift">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Job Applications</h3>
                  <UsageTooltip content="Monthly job application allowance with your subscription plan">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center cursor-help">
                      Automated applications
                      <HelpCircle className="w-3 h-3 ml-1" />
                    </p>
                  </UsageTooltip>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {usage.job_tokens}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  of {currentPlanLimits.applications} included
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${getUsageProgress(usage.job_tokens, currentPlanLimits.applications)}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {usage.job_tokens >= currentPlanLimits.applications ? 
                    'Additional: $0.80 each' :
                    `${currentPlanLimits.applications - usage.job_tokens} remaining`
                  }
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {Math.round(getUsageProgress(usage.job_tokens, currentPlanLimits.applications))}% used
                </span>
              </div>
            </div>
          </div>

          {/* AI Tokens Usage */}
          <div className="premium-card p-6 hover-lift">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Tokens</h3>
                  <UsageTooltip content="AI tokens for resume, CV, and cover letter generation. Complex requests use 2x tokens.">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center cursor-help">
                      Resume & cover letter tools
                      <HelpCircle className="w-3 h-3 ml-1" />
                    </p>
                  </UsageTooltip>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {usage.ai_tokens_used.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  of {currentPlanLimits.aiTokens.toLocaleString()} included
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${getUsageProgress(usage.ai_tokens_used, currentPlanLimits.aiTokens)}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {usage.ai_tokens_used >= currentPlanLimits.aiTokens ? 
                    'Additional: $0.10 per 1,000' :
                    `${(currentPlanLimits.aiTokens - usage.ai_tokens_used).toLocaleString()} remaining`
                  }
                </span>
                <span className="text-purple-600 dark:text-purple-400">
                  {Math.round(getUsageProgress(usage.ai_tokens_used, currentPlanLimits.aiTokens))}% used
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Overage Warning */}
      {overageCosts && overageCosts.totalCost > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="premium-card p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-amber-800 dark:text-amber-200 mb-3">
                Overage Charges This Month
              </h3>
              <div className="space-y-2 text-amber-700 dark:text-amber-300">
                {overageCosts.applicationOverage > 0 && (
                  <p>• {overageCosts.applicationOverage} extra applications: ${overageCosts.applicationCost.toFixed(2)}</p>
                )}
                {overageCosts.aiTokenOverage > 0 && (
                  <p>• {overageCosts.aiTokenOverage.toLocaleString()} extra AI tokens: ${overageCosts.aiTokenCost.toFixed(2)}</p>
                )}
                <p className="font-semibold">Total overage: ${overageCosts.totalCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Plan Selection Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 flex">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'subscriptions'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4 mr-2 inline" />
              Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'tokens'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-lg'
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {subscriptionProducts.map((product, index) => {
              const isCurrentPlan = subscription?.price_id === product.priceId;
              const isPopular = product.name.includes('Plus');
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className={`relative premium-card p-8 hover-lift transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                    isCurrentPlan
                      ? 'ring-2 ring-blue-500 shadow-2xl scale-105'
                      : isPopular
                      ? 'ring-2 ring-purple-400 shadow-2xl'
                      : ''
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-400 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-8">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                      product.name.includes('Extreme') ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                      product.name.includes('Plus') ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                      'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      {product.name.includes('Extreme') ? (
                        <Crown className="w-8 h-8 text-white" />
                      ) : (
                        <Star className="w-8 h-8 text-white" />
                      )}
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {product.name.replace('AIApply ', '')}
                    </h3>
                    
                    <div className="mb-4">
                      <div className="flex items-baseline justify-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                          {getCurrencySymbol(product.currency)}
                        </span>
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">
                          {product.price}
                        </span>
                        <span className="text-lg text-gray-500 dark:text-gray-400 ml-2">
                          /{product.interval}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-8">
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6">
                      {product.description}
                    </p>

                    {product.features && (
                      <ul className="space-y-3">
                        {product.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    onClick={() => handlePurchase(product.priceId)}
                    disabled={isCurrentPlan || purchasing === product.priceId}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                      isCurrentPlan
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : isPopular
                        ? 'premium-button-primary shadow-xl hover:shadow-2xl hover:-translate-y-1'
                        : 'premium-button-secondary hover:shadow-lg hover:-translate-y-1'
                    }`}
                  >
                    {purchasing === product.priceId ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Loading...
                      </div>
                    ) : isCurrentPlan ? (
                      <div className="flex items-center justify-center">
                        <Shield className="w-5 h-5 mr-2" />
                        Current Plan
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        Subscribe Now
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </div>
                    )}
                  </button>
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
                transition={{ delay: 0.4 + index * 0.1 }}
                className="premium-card p-8 hover-lift transition-all duration-300 hover:shadow-2xl hover:scale-105"
              >
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
                  
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {product.name}
                  </h3>
                  
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                        {getCurrencySymbol(product.currency)}
                      </span>
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {product.price.toFixed(2)}
                      </span>
                      <span className="text-lg text-gray-500 dark:text-gray-400 ml-2">
                        per {product.name.includes('Job') ? 'token' : '1,000 tokens'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6">
                    {product.description}
                  </p>

                  {product.features && (
                    <ul className="space-y-3">
                      {product.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  onClick={() => handlePurchase(product.priceId)}
                  disabled={purchasing === product.priceId}
                  className="w-full premium-button-primary py-4 px-6 rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-1"
                >
                  {purchasing === product.priceId ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Buy Now
                    </div>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* FAQ Modal */}
      {showFAQ && <FAQModal />}
    </div>
  );
};