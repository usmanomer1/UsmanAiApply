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
  Lightbulb
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { STRIPE_PRODUCTS, getProductByPriceId } from '../../stripe-config';
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
  applications_count: number;
  ai_requests_count: number;
}

// Demo data for when Supabase is not configured
const DEMO_SUBSCRIPTION: UserSubscription = {
  customer_id: 'cus_demo123',
  subscription_id: 'sub_demo123',
  subscription_status: 'active',
  price_id: 'price_1RYvf7QGabzJD80Bhd4V99CB',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
  cancel_at_period_end: false,
  payment_method_brand: 'visa',
  payment_method_last4: '4242'
};

const DEMO_USAGE: UsageStats = {
  total_steps: 1250,
  total_cost: 12.50,
  applications_count: 23,
  ai_requests_count: 15
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
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [showFAQ, setShowFAQ] = useState(false);

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
        setUsage({ total_steps: 0, total_cost: 0, applications_count: 0, ai_requests_count: 0 });
        return;
      }

      setSubscription(subData);

      // Fetch usage stats for current month
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      if (subData) {
        const { data: usageData, error: usageError } = await supabase
          .from('usage_logs')
          .select(`
            browser_use_steps,
            cost_usd,
            job_campaigns!inner(
              profiles!inner(
                user_id
              )
            )
          `)
          .eq('job_campaigns.profiles.user_id', user.id)
          .gte('recorded_at', `${currentMonth}-01`)
          .lt('recorded_at', `${currentMonth}-32`);

        if (usageError) {
          console.error('Error fetching usage:', usageError);
          setUsage({ total_steps: 0, total_cost: 0, applications_count: 0, ai_requests_count: 0 });
        } else {
          // Calculate totals
          const totalSteps = usageData?.reduce((sum, log) => sum + log.browser_use_steps, 0) || 0;
          const totalCost = usageData?.reduce((sum, log) => sum + parseFloat(log.cost_usd.toString()), 0) || 0;

          // Get applications count for current month
          const { count: applicationsCount } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${currentMonth}-01`)
            .lt('created_at', `${currentMonth}-32`);

          // Simulate AI requests count (in real app, this would come from a separate table)
          const aiRequestsCount = Math.floor(totalSteps / 50); // Rough estimate

          setUsage({
            total_steps: totalSteps,
            total_cost: totalCost,
            applications_count: applicationsCount || 0,
            ai_requests_count: aiRequestsCount
          });
        }
      } else {
        setUsage({ total_steps: 0, total_cost: 0, applications_count: 0, ai_requests_count: 0 });
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setSubscription(null);
      setUsage({ total_steps: 0, total_cost: 0, applications_count: 0, ai_requests_count: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    if (!isSupabaseConfigured() || !user || !session) {
      toast.error('Please connect Supabase to enable payments');
      return;
    }

    setUpgrading(priceId);
    
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
          success_url: `${window.location.origin}/billing?success=true`,
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
      setUpgrading(null);
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

  const getJobApplicationsLimit = () => {
    const currentProduct = getCurrentProduct();
    if (!currentProduct) return 0;
    
    if (currentProduct.name.includes('Extreme')) return 150;
    if (currentProduct.name.includes('Plus')) return 75;
    return 50;
  };

  const getAIRequestsLimit = () => {
    const currentProduct = getCurrentProduct();
    if (!currentProduct) return 0;
    return 50; // All plans include 50 AI requests
  };

  const getJobApplicationsUsed = () => {
    return usage?.applications_count || 0;
  };

  const getAIRequestsUsed = () => {
    return usage?.ai_requests_count || 0;
  };

  const getJobApplicationsProgress = () => {
    const limit = getJobApplicationsLimit();
    const used = getJobApplicationsUsed();
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  };

  const getAIRequestsProgress = () => {
    const limit = getAIRequestsLimit();
    const used = getAIRequestsUsed();
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Usage & Billing FAQ</h2>
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
                Job Tokens Usage
              </h3>
              <div className="space-y-3 text-blue-800 dark:text-blue-200">
                <p><strong>How it works:</strong> Our AI agent performs automated browser actions to apply to jobs on your behalf.</p>
                <p><strong>What counts:</strong> Every 10 automation steps (clicking, typing, navigating) equals exactly 1 job token.</p>
                <p><strong>Plan limits:</strong> Pro (50 tokens), Pro Plus (75 tokens), Extreme (150 tokens). Usage is strictly capped to prevent overuse.</p>
                <p><strong>Tracking:</strong> Usage resets monthly on your billing cycle date.</p>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center">
                <Brain className="w-5 h-5 mr-2" />
                AI Resume & Cover Letter Usage
              </h3>
              <div className="space-y-3 text-purple-800 dark:text-purple-200">
                <p><strong>How it works:</strong> AI generates personalized resumes and cover letters using advanced language models.</p>
                <p><strong>What counts:</strong> Each AI operation (resume scoring, rewriting, cover letter generation) uses tokens from your 150k monthly allocation.</p>
                <p><strong>Subscription required:</strong> Active subscription required to access AI features. All plans include 150,000 tokens monthly.</p>
                <p><strong>Quality:</strong> Uses premium OpenAI models (GPT-4o-mini) for high-quality, personalized content.</p>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Billing & Security
              </h3>
              <div className="space-y-3 text-emerald-800 dark:text-emerald-200">
                <p><strong>Transparent pricing:</strong> No hidden fees. You only pay for what you use beyond your plan limits.</p>
                <p><strong>Secure payments:</strong> All payments processed securely through Stripe with bank-level encryption.</p>
                <p><strong>Cancel anytime:</strong> No long-term contracts. Cancel or change plans anytime from your billing portal.</p>
                <p><strong>Usage alerts:</strong> Get notified when approaching your monthly limits to avoid unexpected charges.</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center">
                <Lightbulb className="w-5 h-5 mr-2" />
                Tips to Optimize Usage
              </h3>
              <div className="space-y-3 text-amber-800 dark:text-amber-200">
                <p><strong>Job tokens:</strong> Each token represents exactly 10 automation steps. Use smart filtering to maximize efficiency and target the most relevant positions.</p>
                <p><strong>AI requests:</strong> Batch similar requests together and reuse generated content when appropriate.</p>
                <p><strong>Plan selection:</strong> Choose a plan that matches your job search intensity to get the best value.</p>
                <p><strong>Monitor usage:</strong> Check your usage regularly to stay within limits and plan accordingly.</p>
              </div>
            </div>

            {/* AI Automation Accuracy Disclaimer */}
            <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                AI Automation Accuracy
              </h3>
              <div className="space-y-3 text-orange-800 dark:text-orange-200">
                <p><strong>Important Notice:</strong> While our AI strives for accuracy, dynamic and situational form fields may sometimes be filled with generic responses.</p>
                <p><strong>Recommendation:</strong> We recommend reviewing all submitted applications to confirm details and ensure accuracy.</p>
                <p><strong>Manual Override:</strong> The system will pause for unclear questions, allowing you to provide specific answers when needed.</p>
                <p><strong>Quality Assurance:</strong> Always verify application details in your LinkedIn account after submission.</p>
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-lg text-gray-900 dark:text-white mb-3">Billing & Usage</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">Manage your subscription and track usage across all features</p>
            {!isSupabaseConfigured() && (
              <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                Demo mode - Connect Supabase to see real billing data
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFAQ(true)}
            className="premium-button-secondary flex items-center"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Usage FAQ
          </button>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Plan Card */}
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
            {subscription && subscription.subscription_status !== 'not_started' ? (
              <>
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
                      {getCurrentProduct()?.name.replace(' Subscription', '') || 'Pro'}
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
              </>
            ) : (
              <div className="text-center py-8">
                <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Active Subscription</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Subscribe to a plan to start using AI-powered job automation tokens.
                </p>
                <button
                  onClick={() => handleUpgrade(STRIPE_PRODUCTS[0].priceId)}
                  disabled={upgrading === STRIPE_PRODUCTS[0].priceId}
                  className="premium-button-primary"
                >
                  {upgrading === STRIPE_PRODUCTS[0].priceId ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Choose a Plan
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Enhanced Usage Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Usage Overview</h2>
            <UsageTooltip content="Usage resets monthly on your billing cycle date">
              <Info className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </UsageTooltip>
          </div>
          
          {/* Job Applications Usage */}
          <div className="premium-card p-6 hover-lift">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Job Tokens</h3>
                <UsageTooltip content="Automation tokens used for job application processes. Each token represents exactly 10 automation steps (form filling, clicking, navigation).">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center cursor-help">
                      AI-powered automated applications
                      <HelpCircle className="w-3 h-3 ml-1" />
                    </p>
                  </UsageTooltip>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {getJobApplicationsUsed()}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  of {getJobApplicationsLimit()} included
                </span>
              </div>
              
              {subscription && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getJobApplicationsProgress()}%` }}
                  ></div>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {getJobApplicationsUsed() >= getJobApplicationsLimit() ? 
                    `Additional: $${getCurrentProduct()?.name.includes('Extreme') ? '0.75' : '0.80'} each` :
                    `${getJobApplicationsLimit() - getJobApplicationsUsed()} remaining`
                  }
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {Math.round(getJobApplicationsProgress())}% used
                </span>
              </div>
            </div>
          </div>

          {/* AI Requests Usage */}
          <div className="premium-card p-6 hover-lift">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resume & Cover Letters</h3>
                  <UsageTooltip content="AI-powered content generation for resumes, cover letters, and content analysis. Each generation request counts as 1 usage.">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center cursor-help">
                      AI content generation requests
                      <HelpCircle className="w-3 h-3 ml-1" />
                    </p>
                  </UsageTooltip>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {getAIRequestsUsed()}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  of {getAIRequestsLimit()} included
                </span>
              </div>
              
              {subscription && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getAIRequestsProgress()}%` }}
                  ></div>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {getAIRequestsUsed() >= getAIRequestsLimit() ? 
                    'Additional: $0.18 each' :
                    `${getAIRequestsLimit() - getAIRequestsUsed()} remaining`
                  }
                </span>
                <span className="text-purple-600 dark:text-purple-400">
                  {Math.round(getAIRequestsProgress())}% used
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upgrade Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-display-md text-gray-900 dark:text-white mb-4">Upgrade Your Plan</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">Choose the plan that fits your automation needs</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {STRIPE_PRODUCTS.map((product, index) => {
            const isCurrentPlan = subscription?.price_id === product.priceId;
            const isPopular = product.name.includes('Plus');
            
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className={`relative premium-card p-8 hover-lift transition-all duration-300 ${
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
                    {product.name.replace(' Subscription', '')}
                  </h3>
                  
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        ${product.price}
                      </span>
                      <span className="text-lg text-gray-500 dark:text-gray-400 ml-2">
                        /{product.interval}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {product.description}
                  </p>
                </div>

                <button
                  onClick={() => handleUpgrade(product.priceId)}
                  disabled={isCurrentPlan || upgrading === product.priceId}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                    isCurrentPlan
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : isPopular
                      ? 'premium-button-primary shadow-xl hover:shadow-2xl hover:-translate-y-1'
                      : 'premium-button-secondary hover:shadow-lg hover:-translate-y-1'
                  }`}
                >
                  {upgrading === product.priceId ? (
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
                      Upgrade to {product.name.replace(' Subscription', '')}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </div>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Usage Warning for High Usage */}
      {subscription && (getJobApplicationsUsed() >= getJobApplicationsLimit() * 0.8 || getAIRequestsUsed() >= getAIRequestsLimit() * 0.8) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="premium-card p-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800"
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
                You're approaching your monthly limits. Consider upgrading to get more applications and AI requests 
                to continue using the service without interruption.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => handleUpgrade(STRIPE_PRODUCTS[2].priceId)}
                  disabled={upgrading === STRIPE_PRODUCTS[2].priceId}
                  className="premium-button-primary"
                >
                  {upgrading === STRIPE_PRODUCTS[2].priceId ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Upgrade Plan
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowFAQ(true)}
                  className="premium-button-secondary"
                >
                  <HelpCircle className="w-5 h-5 mr-2" />
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* FAQ Modal */}
      {showFAQ && <FAQModal />}
    </div>
  );
};