import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Check, 
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
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
  CheckCircle,
  Settings,
  Download,
  FileText,
  Clock,
  Gauge,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
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
  getPlanNameByPriceId,
  isStripeConfigured,
  validateStripeConfig
} from '../../stripe-config';
import { PricingFAQ } from '../PricingFAQ';
import toast from 'react-hot-toast';
import { Badge } from '../ui/badge';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { getUserUsage, getAutomationSessions, UserUsage } from '../../lib/usageTracking';

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

// Additional state for new usage tracking
interface ExtendedUsageStats extends UsageStats {
  job_search_matches: number;
  resume_optimizations: number;
  cover_letters: number;
}

export const BillingPage: React.FC = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<ExtendedUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'tokens'>('subscriptions');
  const [refreshing, setRefreshing] = useState(false);
  const [stripeConfigError, setStripeConfigError] = useState<string | null>(null);
  
  // Usage tracking states
  const [usageChartData, setUsageChartData] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingUsageData, setLoadingUsageData] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'automation' | 'ai'>('all');
  const itemsPerPage = 10;

  useEffect(() => {
    // Check Stripe configuration on mount
    const configValidation = validateStripeConfig();
    if (!configValidation.isValid) {
      setStripeConfigError(`Missing Stripe configuration: ${configValidation.missingVars.join(', ')}`);
    }
    
    fetchBillingData();

    // Listen for billing refresh events from automation completion
    const handleBillingRefresh = () => {
      fetchBillingData(true);
    };

    // Refresh data when page gains focus (user switches tabs)
    const handleFocus = () => {
      // console.log('Billing page gained focus, refreshing data...');
      fetchBillingData(true);
    };

    window.addEventListener('billing-refresh-needed', handleBillingRefresh);
    window.addEventListener('focus', handleFocus);

    // Auto-refresh data every 5 seconds while page is visible
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        // console.log('Auto-refreshing billing data...');
        fetchBillingData(true);
      }
    }, 5000);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('billing-refresh-needed', handleBillingRefresh);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [user]);

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

  const fetchBillingData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!isSupabaseConfigured()) {
        throw new Error('Billing service not configured. Please check your environment variables.');
      }

      if (!user) {
        setSubscription(null);
        setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0, job_search_matches: 0, resume_optimizations: 0, cover_letters: 0 });
        return;
      }

      // Fetch subscription using the view - filtered by current user
      const { data: subData, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        setSubscription(null);
        setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0, job_search_matches: 0, resume_optimizations: 0, cover_letters: 0 });
        return;
      }

      setSubscription(subData);
      
      // Debug logging
      // console.log('Subscription data:', subData);
      // if (subData?.price_id) {
      //   console.log('Looking up product for price_id:', subData.price_id);
      //   const product = getProductByPriceId(subData.price_id);
      //   console.log('Found product:', product);
      // }

      // Fetch usage stats for current month
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      // Always get usage data, regardless of subscription status
      const usage = await getUserUsage(user.id);
      // console.log('Usage from getUserUsage:', usage);
      
      if (subData || true) { // Always process usage data
        // Get job applications count for current month - simplified query
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('applications')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', currentMonthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString());

        const applicationsCount = applicationsData?.length || 0;
        
        // Get automation sessions for detailed stats
        const sessions = await getAutomationSessions(user.id, 100);
        
        // Calculate total steps and cost from sessions in current month
        let totalSteps = 0;
        let totalCost = 0;
        
        sessions.forEach(session => {
          const sessionDate = new Date(session.started_at);
          if (sessionDate >= currentMonthStart && sessionDate < nextMonthStart) {
            totalSteps += session.step_count || 0;
            totalCost += (session.step_count || 0) * 0.001; // Cost calculation
          }
        });

        const currentUsage = {
          total_steps: usage.automation_steps.used,
          total_cost: totalCost,
          job_tokens: usage.automation_steps.used, // Track total steps
          applications_count: applicationsCount,
          ai_requests_count: usage.job_search_match.used + usage.resume_optimization.used + usage.cover_letter_generation.used,
          ai_tokens_used: usage.ai_tokens.used,
          // New tracking data
          job_search_matches: usage.job_search_match.used,
          resume_optimizations: usage.resume_optimization.used,
          cover_letters: usage.cover_letter_generation.used
        };
        
        // console.log('Setting usage state with ai_tokens_used:', currentUsage.ai_tokens_used);
        // console.log('Full currentUsage object:', currentUsage);
        setUsage(currentUsage);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setSubscription(null);
      setUsage({ total_steps: 0, total_cost: 0, job_tokens: 0, applications_count: 0, ai_requests_count: 0, ai_tokens_used: 0, job_search_matches: 0, resume_optimizations: 0, cover_letters: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchBillingData(true);
  };

  const handlePurchase = async (priceId: string) => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // Check if price ID is valid
      if (!priceId || priceId.startsWith('price_missing')) {
        toast.error('This product is not yet available. Please check back later or contact support.');
        return;
      }

      if (sessionError || !isSupabaseConfigured() || !user || !session) {
        toast.error('Billing service not available. Please check your configuration.');
        return;
      }

      // Check if it's a product ID instead of price ID
      if (priceId.startsWith('prod_')) {
        toast.error('Configuration error: Invalid price ID. Please contact support.');
        console.error('Product ID used instead of Price ID:', priceId);
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

  const openBillingPortal = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Billing service not configured. Please check your environment variables.');
      return;
    }

    if (!subscription?.customer_id) {
      toast.error('No customer information found');
      return;
    }

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error('Authentication required. Please sign in again.');
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create billing portal session');
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      
      // Check if this is the specific Stripe configuration error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('No configuration provided') && errorMessage.includes('customer portal settings')) {
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

1. Go to: https://dashboard.stripe.com/test/settings/billing/portal
2. Configure your customer portal settings
3. Save the configuration

This will create the default configuration needed for the billing portal to work.
        `);
      } else {
        toast.error(errorMessage || 'Unable to open billing portal');
      }
    }
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
    
    // First try exact match
    const product = getProductByPriceId(subscription.price_id);
    if (product) return product;
    
    // If no exact match, log for debugging
    console.warn('No product found for price_id:', subscription.price_id);
    // console.log('Available price IDs:', getSubscriptionProducts().map(p => ({ name: p.name, priceId: p.priceId })));
    
    return null;
  };

  // Get plan limits based on current subscription using the helper function
  const getPlanUsageLimits = () => {
    if (!subscription) return { applications: 0, aiTokens: 0, isSubscription: false };

    // 1) try strict priceId match
    if (subscription.price_id) {
      const direct = getPlanLimits(subscription.price_id.trim());
      if (direct) return direct;
    }

    // 2) try derive from product object resolved elsewhere
    const prod = getCurrentProduct();
    if (prod) {
      return {
        applications: prod.applicationCount || 0,
        aiTokens: prod.aiTokenCount || 0,
        isSubscription: prod.mode === 'subscription'
      };
    }

    // 3) final default
    return { applications: 0, aiTokens: 0, isSubscription: false };
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

  // Fetch detailed usage data for the usage tab
  const fetchUsageData = async () => {
    if (!user) return;
    
    setLoadingUsageData(true);
    try {
      // Calculate date range based on selected period
      const now = new Date();
      const startDate = new Date();
      
      if (selectedPeriod === '7d') {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedPeriod === '30d') {
        startDate.setDate(now.getDate() - 30);
      } else {
        startDate.setDate(now.getDate() - 90);
      }

      // Get automation sessions from new tracking system
      const automationLogs = await getAutomationSessions(user.id, 1000);
      
      // Filter by date range
      const filteredLogs = automationLogs.filter(log => {
        const logDate = new Date(log.started_at);
        return logDate >= startDate;
      });

      // Fetch AI token usage logs with specific fields
      const { data: aiLogs, error: aiError } = await supabase
        .from('ai_token_usage')
        .select('id, operation_type, prompt_tokens, completion_tokens, total_tokens, max_tokens_requested, model_used, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      // Process data for charts
      const dailyUsage: Record<string, { date: string; automation: number; ai: number }> = {};
      
      // Get all dates in the period
      const currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dailyUsage[dateKey] = { date: dateKey, automation: 0, ai: 0 };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Aggregate automation usage by day
      if (filteredLogs) {
        filteredLogs.forEach(log => {
          const date = log.completed_at || log.started_at;
          const dateKey = new Date(date).toISOString().split('T')[0];
          if (dailyUsage[dateKey]) {
            dailyUsage[dateKey].automation += log.step_count || 0;
          }
        });
      }

      // Aggregate AI usage by day
      if (aiLogs && !aiError) {
        aiLogs.forEach(log => {
          const dateKey = new Date(log.created_at).toISOString().split('T')[0];
          if (dailyUsage[dateKey]) {
            dailyUsage[dateKey].ai += log.max_tokens_requested || 0;
          }
        });
      }

      // Convert to array and sort by date
      const chartData = Object.values(dailyUsage).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      setUsageChartData(chartData);

      // Process activity logs
      const allLogs: any[] = [];
      
      if (filteredLogs && selectedFilter !== 'ai') {
        filteredLogs.forEach(log => {
          allLogs.push({
            id: log.id,
            type: 'automation',
            description: log.job_title ? `LinkedIn automation - ${log.job_title}` : 'LinkedIn automation task',
            amount: log.step_count || 0,
            unit: 'steps',
            timestamp: log.completed_at || log.started_at,
            status: log.status || 'running'
          });
        });
      }
      
      if (aiLogs && selectedFilter !== 'automation') {
        aiLogs.forEach(log => {
          // Format operation type to be more readable
          const operationType = log.operation_type ? 
            log.operation_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
            'AI Operation';
          
          allLogs.push({
            id: log.id,
            type: 'ai',
            description: `${operationType}${log.model_used ? ` (${log.model_used})` : ''}`,
            amount: log.max_tokens_requested || log.total_tokens || 0,
            unit: 'tokens',
            timestamp: log.created_at,
            status: 'completed'
          });
        });
      }

      // Sort by timestamp descending
      allLogs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Pagination
      const totalItems = allLogs.length;
      setTotalPages(Math.ceil(totalItems / itemsPerPage));
      
      // Get current page items
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      setActivityLogs(allLogs.slice(startIndex, endIndex));
      
    } catch (error) {
      console.error('Error fetching usage data:', error);
      toast.error('Failed to load usage data');
    } finally {
      setLoadingUsageData(false);
    }
  };

  // Load usage data when component mounts or filters change
  useEffect(() => {
    if (user) {
      fetchUsageData();
    }
  }, [selectedPeriod, selectedFilter, currentPage, user]);

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Skeleton */}
          <div className="text-center mb-16">
            <div className="h-12 w-96 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto mb-4 animate-pulse" />
            <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto animate-pulse" />
          </div>
          
          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                  <div>
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
          
          {/* Pricing Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-4 animate-pulse" />
                <div className="h-12 w-32 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-8 animate-pulse" />
                <div className="space-y-3 mb-8">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ))}
                </div>
                <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const subscriptionProducts = getSubscriptionProducts();
  const tokenProducts = getTokenProducts();
  const limits = getPlanUsageLimits();
  const applicationProgress = getUsageProgress(usage?.job_tokens || 0, limits.applications * 10); // Convert application limit to step limit
  const aiTokenProgress = getUsageProgress(usage?.ai_tokens_used || 0, 120000); // Always use 120k as limit

  return (
    <>
      <div className="min-h-screen py-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Select the perfect plan for your job search automation needs
          </p>
          {!isSupabaseConfigured() && (
            <div className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Billing service not configured
            </div>
          )}
          {stripeConfigError && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-2xl mx-auto">
              <h3 className="font-semibold mb-2">Stripe Configuration Error</h3>
              <p>{stripeConfigError}</p>
              <p className="mt-2 text-xs">
                Developers: Check your environment variables and ensure you're using Price IDs (price_xxxxx) not Product IDs (prod_xxxxx)
              </p>
            </div>
          )}
        </motion.div>

        {/* Current Plan Status & Usage */}
        {subscription && (subscription.subscription_status === 'active' || !isSupabaseConfigured()) && (
          <div className="max-w-4xl mx-auto mb-12 space-y-6">
            {/* Current Plan Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
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
                      {getCurrentProduct()?.name?.replace('Jobotic ', '') || 
                       (subscription?.price_id ? getPlanNameByPriceId(subscription.price_id) : 'Free')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        {!isSupabaseConfigured() ? 'Service Unavailable' : 'Active Plan'}
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


            {/* Usage Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Automation Steps Usage */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-xl shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Automation Steps</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Bot automation steps this month
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <motion.span 
                        key={usage?.job_tokens || 0}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent"
                      >
                        {(usage?.job_tokens || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {limits.applications > 0 ? `of ${(limits.applications * 10).toLocaleString()} included` : 
                         <span className="text-gray-400 italic">No plan limits available</span>}
                      </span>
                    </div>
                  
                    {limits.applications > 0 && (
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${applicationProgress}%` }}
                            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                            className="h-full relative overflow-hidden"
                          >
                            <div className={`absolute inset-0 bg-gradient-to-r ${getProgressBarColor(applicationProgress)}`} />
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
                        {limits.applications === 0 ? 
                          <span className="italic">Subscribe to get automation steps</span> :
                          applicationProgress >= 100 ? 
                            <span className="text-orange-600 dark:text-orange-400 font-medium">Additional: $0.03 per step</span> :
                            <span>{Math.max(0, (limits.applications * 10) - (usage?.job_tokens || 0)).toLocaleString()} remaining</span>
                        }
                      </span>
                      {limits.applications > 0 && (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-sm font-bold ${getUsageStatusColor(applicationProgress)}`}
                        >
                          {Math.round(applicationProgress)}% used
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* AI Tokens Usage */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-xl shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <motion.div 
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        className="relative p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg"
                      >
                        <Brain className="w-6 h-6 text-white" />
                        <motion.div 
                          className="absolute inset-0 bg-white/30 rounded-xl"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Tokens</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Job search & resume optimization
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <motion.span 
                        key={usage?.ai_tokens_used || 0}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
                      >
                        {/* console.log('Rendering AI tokens value:', usage?.ai_tokens_used) */}
                        {(usage?.ai_tokens_used || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        of 120,000 included
                      </span>
                    </div>
                  
                    {limits.aiTokens > 0 && (
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${aiTokenProgress}%` }}
                            transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                            className="h-full relative overflow-hidden"
                          >
                            <div className={`absolute inset-0 bg-gradient-to-r ${getProgressBarColor(aiTokenProgress)}`} />
                            <motion.div 
                              className="absolute inset-0 bg-white/30"
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.5 }}
                            />
                          </motion.div>
                        </div>
                      </div>
                    )}
                  
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {aiTokenProgress >= 100 ? 
                          <span className="text-orange-600 dark:text-orange-400 font-medium">Limit reached</span> :
                          <span>{Math.max(0, 120000 - (usage?.ai_tokens_used || 0)).toLocaleString()} remaining</span>
                        }
                      </span>
                      {limits.aiTokens > 0 && (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-sm font-bold ${getUsageStatusColor(aiTokenProgress)}`}
                        >
                          {Math.round(aiTokenProgress)}% used
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Job Search Usage */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="relative overflow-hidden bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-900/20 dark:to-green-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-700/50 backdrop-blur-xl shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-green-500/5" />
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
                        key={jobSearchUsage?.used || 0}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-bold bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent"
                      >
                        {(jobSearchUsage?.used || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {jobSearchUsage?.limit === -1 ? 'Unlimited' : 
                         jobSearchUsage?.limit ? `of ${jobSearchUsage.limit.toLocaleString()} included` : 
                         <span className="text-gray-400 italic">100 searches/month</span>}
                      </span>
                    </div>
                  
                    {jobSearchUsage && jobSearchUsage.limit > 0 && (
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, jobSearchUsage.percentage)}%` }}
                            transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
                            className="h-full relative overflow-hidden"
                          >
                            <div className={`absolute inset-0 bg-gradient-to-r ${getProgressBarColor(jobSearchUsage.percentage)}`} />
                            <motion.div 
                              className="absolute inset-0 bg-white/30"
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                            />
                          </motion.div>
                        </div>
                      </div>
                    )}
                  
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {!jobSearchUsage ? 
                          <span className="italic">Loading usage data...</span> :
                          jobSearchUsage.limit === -1 ? 
                            <span>Unlimited searches available</span> :
                            jobSearchUsage.percentage >= 100 ? 
                              <span className="text-orange-600 dark:text-orange-400 font-medium">Limit reached for this month</span> :
                              <span>{Math.max(0, jobSearchUsage.limit - jobSearchUsage.used).toLocaleString()} searches remaining</span>
                        }
                      </span>
                      {jobSearchUsage && jobSearchUsage.limit > 0 && (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-sm font-bold ${getUsageStatusColor(jobSearchUsage.percentage)}`}
                        >
                          {Math.round(jobSearchUsage.percentage)}% used
                        </motion.span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* New Usage Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Job Search Matches */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200/50 dark:border-green-700/50 backdrop-blur-xl shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg">
                        <HelpCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Job Search Matches</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">AI-powered job search</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {usage?.job_search_matches || 0}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        ({(usage?.job_search_matches || 0) * 6000} tokens)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((usage?.job_search_matches || 0) / 100) * 100)}%` }}
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Resume Optimizations */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/50 backdrop-blur-xl shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resume Optimizations</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">AI resume enhancement</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {usage?.resume_optimizations || 0}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        ({(usage?.resume_optimizations || 0) * 6000} tokens)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((usage?.resume_optimizations || 0) / 10) * 100)}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

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
          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5 shadow-inner">
            <motion.div
              className="absolute inset-0 bg-blue-600 rounded-xl"
              animate={{ 
                x: activeTab === 'subscriptions' ? 0 : '100%',
                width: activeTab === 'subscriptions' ? '50%' : '50%'
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
            <div className="relative flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('subscriptions')}
                className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 relative z-10 ${
                  activeTab === 'subscriptions'
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Crown className="w-5 h-5" />
                <span>Subscriptions</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tokens')}
                className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 relative z-10 ${
                  activeTab === 'tokens'
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {subscriptionProducts.map((product, index) => {
              const isCurrentPlan = subscription?.price_id === product.priceId;
              const isPopular = product.name.includes('Pro');
              const isPriceValid = !product.priceId.startsWith('price_missing');
              
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl transition-all duration-300 overflow-hidden ${
                    isCurrentPlan
                      ? 'shadow-2xl ring-2 ring-blue-500/50'
                      : isPopular
                      ? 'shadow-2xl ring-2 ring-purple-500/50 scale-[1.02]'
                      : 'shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700'
                  } ${!isPriceValid ? 'opacity-60' : ''}`}
                >


                  {isCurrentPlan && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-50"
                    >
                      <Badge className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2 text-sm font-bold shadow-xl border-0">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Current Plan
                      </Badge>
                    </motion.div>
                  )}

                  <div className="p-8">
                    {/* Plan Header */}
                    <div className="text-center mb-8">
                      <motion.h3 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 + index * 0.1 }}
                        className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
                      >
                        {product.name}
                      </motion.h3>
                      
                      <div className="mb-2">
                        <div className="flex items-baseline justify-center">
                          <span className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                            ${product.price}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 ml-2 text-lg">
                            /{product.interval}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Includes Section */}
                    <div className="mb-8">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                        What's Included
                      </h4>
                      <ul className="space-y-3">
                        {[
                          `${product.applicationCount} job applications/month`,
                          `${product.aiTokenCount?.toLocaleString()} AI tokens/month`,
                          'Resume & cover letter tools',
                          ...(product.name.includes('Pro') ? ['Priority support'] : []),
                          ...(product.name.includes('Max') ? ['Priority support', 'Early feature access'] : [])
                        ].map((feature, idx) => (
                          <motion.li 
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + index * 0.1 + idx * 0.05 }}
                            className="group flex items-start text-sm text-gray-700 dark:text-gray-300"
                          >
                            <motion.div
                              whileHover={{ scale: 1.2, rotate: 360 }}
                              transition={{ duration: 0.3 }}
                              className="mr-3 mt-0.5"
                            >
                              <Check className="w-5 h-5 text-green-500 group-hover:text-green-600 transition-colors" />
                            </motion.div>
                            <span className="group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                              {feature}
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <motion.button
                      whileHover={!isCurrentPlan && isPriceValid ? { scale: 1.02 } : {}}
                      whileTap={!isCurrentPlan && isPriceValid ? { scale: 0.98 } : {}}
                      onClick={() => handlePurchase(product.priceId)}
                      disabled={isCurrentPlan || purchasing === product.priceId || !isPriceValid}
                      className={`relative w-full py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 overflow-hidden ${
                        isCurrentPlan
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : !isPriceValid
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : isPopular
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl hover:shadow-2xl'
                          : product.name.includes('Plus')
                          ? 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-xl hover:shadow-2xl'
                      }`}
                    >
                      {!isCurrentPlan && isPriceValid && isPopular && (
                        <motion.span 
                          className="absolute inset-0 bg-white/20"
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      <span className="relative z-10">
                        {purchasing === product.priceId ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Loading...
                          </div>
                        ) : isCurrentPlan ? (
                          'Current Plan'
                        ) : !isPriceValid ? (
                          'Coming Soon'
                        ) : (
                          'Get Started'
                        )}
                      </span>
                    </motion.button>
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
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 ${
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
                          {product.mode === 'subscription' ? '/month' : 'one-time'}
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

        {/* Usage Dashboard - Always Visible Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-24 mb-12"
        >
          <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-12 text-center">Usage Analytics</h2>
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Period Selector and Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <select 
                  value={selectedPeriod} 
                  onChange={(e) => setSelectedPeriod(e.target.value as '7d' | '30d' | '90d')}
                  className="w-[140px] px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                
                <select 
                  value={selectedFilter} 
                  onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'automation' | 'ai')}
                  className="w-[140px] px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Usage</option>
                  <option value="automation">Automation</option>
                  <option value="ai">AI Tokens</option>
                </select>
              </div>
              
              <button
                onClick={() => {
                  const csvContent = [
                    ['Date', 'Type', 'Description', 'Amount', 'Unit'],
                    ...activityLogs.map(log => [
                      new Date(log.timestamp).toLocaleDateString(),
                      log.type,
                      log.description,
                      log.amount,
                      log.unit
                    ])
                  ].map(row => row.join(',')).join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `usage-report-${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                  toast.success('Usage report downloaded');
                }}
                className="px-4 py-2 bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-lg transition-colors text-sm font-medium backdrop-blur-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Current Period Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Usage Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedPeriod === '7d' ? 'This Week' : selectedPeriod === '30d' ? 'This Month' : 'Last 90 Days'}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {((usage?.job_tokens || 0) + (usage?.ai_tokens_used || 0)).toLocaleString()}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Total Usage</p>
              </motion.div>

              {/* Automation Steps Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${applicationProgress * 1.76} 176`}
                        className="text-emerald-500"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white">
                      {Math.round(applicationProgress)}%
                    </span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {(usage?.job_tokens || 0).toLocaleString()}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Automation Steps</p>
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  {limits.applications > 0 ? `${Math.max(0, (limits.applications * 10) - (usage?.job_tokens || 0))} remaining` : 'No plan limits'}
                </div>
              </motion.div>

              {/* AI Tokens Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${aiTokenProgress * 1.76} 176`}
                        className="text-purple-500"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white">
                      {Math.round(aiTokenProgress)}%
                    </span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {(usage?.ai_tokens_used || 0).toLocaleString()}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">AI Tokens</p>
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  {limits.aiTokens > 0 ? `${Math.max(0, limits.aiTokens - (usage?.ai_tokens_used || 0)).toLocaleString()} remaining` : 'No plan limits'}
                </div>
              </motion.div>
            </div>

            {/* Usage Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Usage Over Time</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-600 dark:text-gray-300">Automation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-600 dark:text-gray-300">AI Tokens</span>
                  </div>
                </div>
              </div>
              
              {loadingUsageData ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : usageChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={usageChartData}>
                    <defs>
                      <linearGradient id="colorAutomation" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      stroke="#9ca3af"
                    />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="automation" 
                      stackId="1"
                      stroke="#10b981" 
                      fill="url(#colorAutomation)"
                      name="Automation Steps"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ai" 
                      stackId="1"
                      stroke="#8b5cf6" 
                      fill="url(#colorAi)"
                      name="AI Tokens"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No usage data available for this period
                </div>
              )}
            </motion.div>

            {/* Activity Log */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  activityLogs.length > 0 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {activityLogs.length} {activityLogs.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {loadingUsageData ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : activityLogs.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Time</th>
                          <th className="pb-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Type</th>
                          <th className="pb-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Description</th>
                          <th className="pb-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-right">Usage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {activityLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 text-sm text-gray-600 dark:text-gray-300">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-gray-400" />
                                {new Date(log.timestamp).toLocaleString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                log.type === 'automation' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' 
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {log.type === 'automation' ? (
                                  <Bot className="w-3 h-3 mr-1" />
                                ) : (
                                  <Brain className="w-3 h-3 mr-1" />
                                )}
                                {log.type}
                              </span>
                            </td>
                            <td className="py-3 text-sm text-gray-900 dark:text-white">
                              {log.description}
                            </td>
                            <td className="py-3 text-sm text-gray-600 dark:text-gray-300 text-right">
                              {log.amount.toLocaleString()} {log.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No activity in this period</p>
                </div>
              )}
            </motion.div>

            {/* Usage Alerts */}
            {(applicationProgress >= 80 || aiTokenProgress >= 80) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      Usage Alert
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 mb-4">
                      You've used {applicationProgress >= 80 ? `${Math.round(applicationProgress)}% of your automation steps` : ''} 
                      {applicationProgress >= 80 && aiTokenProgress >= 80 ? ' and ' : ''}
                      {aiTokenProgress >= 80 ? `${Math.round(aiTokenProgress)}% of your AI tokens` : ''} this month.
                    </p>
                    <button
                      onClick={() => setActiveTab('subscriptions')}
                      className="text-amber-800 dark:text-amber-200 font-medium hover:underline text-sm"
                    >
                      Upgrade your plan →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Pricing FAQ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <PricingFAQ />
        </motion.div>
      </div>
      </div>
      </>
    );
  };