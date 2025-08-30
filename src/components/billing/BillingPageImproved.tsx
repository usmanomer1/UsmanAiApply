import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  getProductByPriceId, 
  getSubscriptionProducts, 
  getTokenProducts, 
  getPlanNameByPriceId,
  validateStripeConfig
} from '../../stripe-config';
import toast from 'react-hot-toast';
import PricingSection3, { PricingPlan } from '../../components/ui/pricing-section-3';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../ui';
import { getBillingDataOptimized, clearUsageCache } from '../../lib/usageTrackingOptimized';
import { UserUsage } from '../../lib/usageTracking';
import { track } from '../../lib/analytics';

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
  const [supportOpen, setSupportOpen] = useState(false);
  
  // Debounce and caching refs
  const lastRefreshTime = useRef<number>(0);
  const refreshDebounceTime = 5000; // 5 seconds
  const isCurrentlyFetching = useRef(false); // Prevent concurrent fetches
  
  // Memoized values to reduce recalculations
  const subscriptionProducts = useMemo(() => getSubscriptionProducts(), []);
  const tokenProducts = useMemo(() => getTokenProducts(), []);
  const jobTokenProducts = useMemo(() =>
    tokenProducts.filter(p => !p.name.toLowerCase().startsWith('ai tokens'))
  , [tokenProducts]);

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

  // Track Stripe portal return and checkout cancel
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('canceled') === 'true') {
        track('CHECKOUT_CANCELED');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const openedAt = sessionStorage.getItem('portal_open_at');
      if (openedAt) {
        const durationMs = Date.now() - parseInt(openedAt, 10);
        track('BILLING_PORTAL_RETURNED', { durationMs });
        sessionStorage.removeItem('portal_open_at');
      }
    } catch {}
  }, []);

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

      track('CHECKOUT_INITIATED', {
        price_id: priceId,
        product_name: product.name,
        mode: product.mode,
        category: product.category,
      });

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
      track('BILLING_PORTAL_OPEN_CLICKED');
      // Get the user's session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to manage your billing');
        return;
      }

      // Call edge function WITH authentication for security
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_stripe_portal_link_v2`, {
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
        // Check if it's a portal configuration issue
        if (data.setup_url) {
          toast.error('Stripe portal not configured. Check console for setup link.', {
            duration: 8000,
          });
          console.error('Setup Stripe Portal at:', data.setup_url);
        } else {
          throw new Error(data.error || 'Failed to create billing portal session');
        }
        return;
      }

      if (data.url) {
        // Mark the time before redirecting to portal
        sessionStorage.setItem('portal_open_at', Date.now().toString());
        // Successfully got portal URL - redirect
        toast.success('Redirecting to billing portal...', { duration: 2000 });
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Failed to open billing portal. Please try again.');
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
        

        {/* Current Plan Status & Usage Cards */}
        {subscription && subscription.subscription_status === 'active' && (
          <div className="max-w-4xl mx-auto mb-12 space-y-6">
            {/* Current Plan Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 disabled:opacity-50"
                    title="Refresh billing data"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500 transition-transform duration-500 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {currentProduct?.name?.replace('Jobotic ', '') || 
                       (subscription?.price_id ? getPlanNameByPriceId(subscription.price_id) : 'Free')}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-black/80" />
                      <span className="text-sm text-gray-700 font-medium">Active</span>
                    </div>
                  </div>
                </div>

                {subscription.current_period_end && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 bg-gray-50 rounded-lg px-4 py-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Renews {formatDate(subscription.current_period_end)}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={openBillingPortal}
                  className="w-full group relative px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-t from-neutral-900 to-neutral-600 text-white border border-neutral-700 shadow-lg shadow-neutral-900 hover:from-neutral-800 hover:to-neutral-700 hover:-translate-y-0.5 hover:shadow-xl transition-all"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4 transition-transform duration-200" />
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
                transition={{ duration: 0.35, delay: 0.2 }}
                className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md"
              >
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Agent Steps</h3>
                      <p className="text-sm text-gray-600">
                        AI agent steps used this month
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <motion.span 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="text-5xl font-bold text-black/80"
                      >
                        {(usage?.automation_steps?.used || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 mb-2">
                        {usage?.automation_steps?.limit && usage.automation_steps.limit > 0 
                          ? `of ${usage.automation_steps.limit.toLocaleString()} included` 
                          : 'No plan limits'}
                      </span>
                    </div>
                  
                    {usage?.automation_steps?.limit && usage.automation_steps.limit > 0 && (
                      <div className="relative">
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${usage.automation_steps.percentage}%` }}
                            transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
                            className="h-full relative overflow-hidden bg-black/80"
                          />
                        </div>
                      </div>
                    )}
                  
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        {!usage?.automation_steps?.limit || usage.automation_steps.limit === 0 ? 
                          <span className="italic">Subscribe to get automation steps</span> :
                          usage.automation_steps.percentage >= 100 ? 
                            <span className="font-medium text-gray-800">Additional: $0.03 per step</span> :
                            <span>{usage.automation_steps.remaining.toLocaleString()} remaining</span>
                        }
                      </span>
                      {usage?.automation_steps?.limit && usage.automation_steps.limit > 0 && (
                        <span className="text-sm font-bold text-black/70">
                          {Math.round(usage.automation_steps.percentage)}% used
                        </span>
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
                className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md"
              >
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Job Searches</h3>
                      <p className="text-sm text-gray-600">
                        AI-powered job matches this month
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <motion.span 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="text-5xl font-bold text-black/80"
                      >
                        {(usage?.job_search_match?.used || 0).toLocaleString()}
                      </motion.span>
                      <span className="text-sm text-gray-600 mb-2">
                        Unlimited
                      </span>
                    </div>
                  
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
                          className="h-full relative overflow-hidden bg-black/80"
                        />
                      </div>
                    </div>
                  
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Unlimited searches available
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Usage Notice */}
            {usage?.automation_steps && usage.automation_steps.percentage >= 80 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      Approaching Usage Limits
                    </h3>
                    <p className="text-gray-700 mb-6 leading-relaxed">
                      You're approaching your monthly limits. Upgrade to get more applications and AI tokens.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={() => setActiveTab('subscriptions')}
                        className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-t from-neutral-900 to-neutral-600 text-white border border-neutral-700 shadow-lg shadow-neutral-900 hover:from-neutral-800 hover:to-neutral-700 hover:-translate-y-0.5 hover:shadow-xl transition-all"
                      >
                        Upgrade Plan
                      </button>
                      <button 
                        onClick={() => setActiveTab('tokens')}
                        className="px-6 py-3 rounded-xl font-semibold border border-gray-300 text-gray-900 hover:bg-gray-50 transition-colors"
                      >
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
                <span>Subscriptions</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tokens')}
                className={`px-8 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'tokens' ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <span>Token Packs</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Subscription Plans - shadcn section */}
        {activeTab === 'subscriptions' && (
          <div className="max-w-6xl mx-auto">
            <PricingSection3
              compact
              plans={subscriptionProducts.map((p, i) => ({
                name: i === 0 ? 'Starter' : i === 1 ? 'Pro' : 'Max',
                description: i === 0
                  ? 'Up to ~40 applications/mo, basic agent run time'
                  : i === 1
                  ? 'Extended limits (most users do 100–200 apps/mo), 10× runtime'
                  : 'Highest limits (built for power users & small teams)',
                price: p.price,
                yearlyPrice: p.price * 10,
                buttonText: (subscription?.price_id === p.priceId)
                  ? 'Current Plan'
                  : (i === 0 ? 'Choose Starter' : i === 1 ? 'Get Pro' : 'Upgrade to Max'),
                buttonVariant: (subscription?.price_id === p.priceId) ? 'default' : (i === 1 ? 'default' : 'outline'),
                popular: i === 1,
              })) as unknown as PricingPlan[]}
              onSelect={(planName: string) => {
                const idx = planName === 'Starter' ? 0 : planName === 'Pro' ? 1 : 2;
                const prod = subscriptionProducts[idx];
                if (!prod || prod.priceId.startsWith('price_missing')) return;
                if (subscription?.price_id === prod.priceId) return;
                handlePurchase(prod.priceId);
              }}
            />
            <div className="text-center mt-10">
              <button
                type="button"
                onClick={() => setSupportOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-t from-neutral-900 to-neutral-600 text-white border border-neutral-700 shadow-lg shadow-neutral-900 hover:from-neutral-800 hover:to-neutral-700 hover:-translate-y-0.5 hover:shadow-xl transition-all"
              >
                Contact support
              </button>
            </div>
            <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Contact Us</DialogTitle>
                  <DialogDescription>
                    For all support inquiries, including billing issues, receipts, and general assistance, please email us.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <a
                    href="mailto:usman@Jobotic.ai"
                    className="flex-1 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#23a972] text-white hover:bg-[#1e9463] transition-colors"
                  >
                    Email us
                  </a>
                  <DialogClose asChild>
                    <button className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Token Packs */}
        {activeTab === 'tokens' && (
          <div className="max-w-7xl mx-auto">
            <div className="hidden lg:grid grid-cols-4 gap-4">
              {jobTokenProducts.map((product, index) => {
                const isPriceValid = !product.priceId.startsWith('price_missing');
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.35 }}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className={`relative rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 ${
                      !isPriceValid ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
                      <div className="mb-3">
                        <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                        <span className="text-gray-500 ml-1">one-time</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-5 line-clamp-3">{product.description}</p>
                      {product.features && (
                        <ul className="space-y-2 mb-6">
                          {product.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="flex items-center text-sm text-gray-700">
                              <span className="text-black h-6 w-6 bg-white border border-black rounded-full grid place-content-center mt-0.5 mr-3">
                                <span className="block h-1.5 w-1.5 rounded-full bg-black" />
                              </span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                      <motion.button
                        whileHover={isPriceValid ? { scale: 1.01 } : {}}
                        whileTap={isPriceValid ? { scale: 0.99 } : {}}
                        onClick={() => handlePurchase(product.priceId)}
                        disabled={purchasing === product.priceId || !isPriceValid}
                        className={`relative w-full py-2.5 px-4 rounded-xl font-semibold transition-all duration-200 overflow-hidden ${
                          !isPriceValid
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-t from-neutral-900 to-neutral-600 text-white border border-neutral-700 shadow-lg shadow-neutral-900 hover:from-neutral-800 hover:to-neutral-700 hover:-translate-y-0.5 hover:shadow-xl'
                        }`}
                      >
                        <span className="relative z-10">
                          {purchasing === product.priceId ? 'Loading…' : (!isPriceValid ? 'Coming Soon' : 'Buy Now')}
                        </span>
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="lg:hidden">
              <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4">
                {jobTokenProducts.map((product, index) => {
                  const isPriceValid = !product.priceId.startsWith('price_missing');
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.35 }}
                      className={`min-w-[280px] snap-start rounded-2xl border border-gray-200 bg-white shadow-sm ${!isPriceValid ? 'opacity-60' : ''}`}
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
                        <div className="mb-3">
                          <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                          <span className="text-gray-500 ml-1">one-time</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-5 line-clamp-3">{product.description}</p>
                        <motion.button
                          whileHover={isPriceValid ? { scale: 1.01 } : {}}
                          whileTap={isPriceValid ? { scale: 0.99 } : {}}
                          onClick={() => handlePurchase(product.priceId)}
                          disabled={purchasing === product.priceId || !isPriceValid}
                          className={`relative w-full py-2.5 px-4 rounded-xl font-semibold transition-all duration-200 overflow-hidden ${
                            !isPriceValid
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-t from-neutral-900 to-neutral-600 text-white border border-neutral-700 shadow-lg shadow-neutral-900 hover:from-neutral-800 hover:to-neutral-700'
                          }`}
                        >
                          <span className="relative z-10">
                            {purchasing === product.priceId ? 'Loading…' : (!isPriceValid ? 'Coming Soon' : 'Buy Now')}
                          </span>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingPageImproved;