export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
  price: number;
  currency: string;
  interval?: 'month' | 'year';
  category: 'subscription' | 'tokens';
  features?: string[];
  tokenCount?: number; // For token packs
  applicationCount?: number; // For subscriptions
  aiTokenCount?: number; // For AI tokens
}

// Get price IDs from environment variables with better error handling
const getStripeConfig = () => {
  const config = {
    PLUS_PRICE_ID: import.meta.env.VITE_STRIPE_PLUS_PRICE_ID,
    PRO_PRICE_ID: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
    MAX_PRICE_ID: import.meta.env.VITE_STRIPE_MAX_PRICE_ID,
    
    // Job Application Token Packs
    QUICK_APPLY_PRICE_ID: import.meta.env.VITE_STRIPE_QUICK_APPLY_PRICE_ID,
    HUSTLE_BOOST_PRICE_ID: import.meta.env.VITE_STRIPE_HUSTLE_BOOST_PRICE_ID,
    FULL_SEND_PRICE_ID: import.meta.env.VITE_STRIPE_FULL_SEND_PRICE_ID,
    CAREER_STORM_PRICE_ID: import.meta.env.VITE_STRIPE_CAREER_STORM_PRICE_ID,
    
    // AI Token Packs
    LIGHT_BOOST_PRICE_ID: import.meta.env.VITE_STRIPE_LIGHT_BOOST_PRICE_ID,
    SMART_STACK_PRICE_ID: import.meta.env.VITE_STRIPE_SMART_STACK_PRICE_ID,
    POWER_DRAFT_PRICE_ID: import.meta.env.VITE_STRIPE_POWER_DRAFT_PRICE_ID,
    CREATOR_SURGE_PRICE_ID: import.meta.env.VITE_STRIPE_CREATOR_SURGE_PRICE_ID,
    AI_VAULT_PRICE_ID: import.meta.env.VITE_STRIPE_AI_VAULT_PRICE_ID
  };

  // Check for invalid price IDs (product IDs starting with 'prod_')
  const invalidPriceIds = Object.entries(config)
    .filter(([key, value]) => value && value.startsWith('prod_'))
    .map(([key]) => key);

  if (invalidPriceIds.length > 0) {
    console.error('❌ STRIPE CONFIGURATION ERROR:');
    console.error(`Found product IDs instead of price IDs for: ${invalidPriceIds.join(', ')}`);
    console.error('❗ You must use PRICE IDs (price_xxxxx) not PRODUCT IDs (prod_xxxxx)');
    console.error('🔧 Go to your Stripe Dashboard > Product catalog > Select product > Copy the PRICE ID');
    
    // Don't throw error in development to allow testing
    if (import.meta.env.MODE === 'production') {
      throw new Error(`Invalid Stripe configuration: Product IDs found instead of Price IDs for: ${invalidPriceIds.join(', ')}`);
    }
  }

  // Validate that all required price IDs are present
  const missingPriceIds = Object.entries(config)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingPriceIds.length > 0) {
    console.warn('⚠️ Missing Stripe price IDs:', missingPriceIds);
    
    if (import.meta.env.MODE === 'production') {
      throw new Error(`Missing required environment variables: ${missingPriceIds.map(id => `VITE_STRIPE_${id}`).join(', ')}`);
    }
  }

  return config;
};

// Safe version that doesn't throw errors
const getStripeConfigSafe = () => {
  try {
    return getStripeConfig();
  } catch (error) {
    console.error('Stripe configuration error:', error);
    // Return empty config for development
    return {
      PLUS_PRICE_ID: '',
      PRO_PRICE_ID: '',
      MAX_PRICE_ID: '',
      QUICK_APPLY_PRICE_ID: '',
      HUSTLE_BOOST_PRICE_ID: '',
      FULL_SEND_PRICE_ID: '',
      CAREER_STORM_PRICE_ID: '',
      LIGHT_BOOST_PRICE_ID: '',
      SMART_STACK_PRICE_ID: '',
      POWER_DRAFT_PRICE_ID: '',
      CREATOR_SURGE_PRICE_ID: '',
      AI_VAULT_PRICE_ID: ''
    };
  }
};

const stripeConfig = getStripeConfigSafe();

export const STRIPE_PRODUCTS: StripeProduct[] = [
  // Subscription Plans
  {
    id: 'prod_SZfmZazFIlmV2H',
    priceId: stripeConfig.PLUS_PRICE_ID || 'price_missing_plus',
    name: 'Plus',
    description: '37 automated job applications/month, 30,000 AI tokens for resume & cover letters. Voice AI features included. Additional applications and AI tokens billed separately.',
    mode: 'subscription',
    price: 25.00,
    currency: 'usd',
    interval: 'month',
    category: 'subscription',
    applicationCount: 37,
    aiTokenCount: 30000,
    features: [
      '37 automated job applications/month',
      '30,000 AI tokens for resume & cover letters',
      'Complex requests count as 2x tokens',
      'Additional applications: $0.80 each',
      'Extra AI tokens: $0.10 per 1,000',
      'Voice AI features included'
    ]
  },
  {
    id: 'prod_SZfo61zKWmnX6l',
    priceId: stripeConfig.PRO_PRICE_ID || 'price_missing_pro',
    name: 'Pro',
    description: '77 automated job applications per month, 30,000 AI tokens for resume and cover letters, voice AI features included, additional applications and AI tokens billed separately.',
    mode: 'subscription',
    price: 50.00,
    currency: 'usd',
    interval: 'month',
    category: 'subscription',
    applicationCount: 77,
    aiTokenCount: 30000,
    features: [
      '77 automated job applications/month',
      '30,000 AI tokens for resume & cover letters',
      'Complex requests count as 2x tokens',
      'Additional applications: $0.80 each',
      'Extra AI tokens: $0.10 per 1,000',
      'Voice AI features included',
      'Priority support'
    ]
  },
  {
    id: 'prod_SZfpQ9Y78JdsPl',
    priceId: stripeConfig.MAX_PRICE_ID || 'price_missing_max',
    name: 'Max',
    description: '158 job applications per month, 30,000 AI tokens for resume and cover letters, Voice AI features included, Priority support and early access, Additional applications and AI tokens billed separately',
    mode: 'subscription',
    price: 100.00,
    currency: 'usd',
    interval: 'month',
    category: 'subscription',
    applicationCount: 158,
    aiTokenCount: 30000,
    features: [
      '158 automated job applications/month',
      '30,000 AI tokens for resume & cover letters',
      'Complex requests count as 2x tokens',
      'Priority support & early access',
      'Additional applications: $0.80 each',
      'Extra AI tokens: $0.10 per 1,000',
      'Voice AI features included',
      'Dedicated account manager'
    ]
  },
  
  // Job Application Token Packs
  {
    id: 'prod_SZfvC0SBiq8WCH',
    priceId: stripeConfig.QUICK_APPLY_PRICE_ID || 'price_missing_quick_apply',
    name: 'Job Application QuickApply',
    description: 'Just need a few extras? Top off with 10 more AI job submissions.',
    mode: 'payment',
    price: 7.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 10,
    features: [
      '10 AI job applications',
      'Instant access',
      'No expiration',
      'Use anytime',
      'Compatible with all plans'
    ]
  },
  {
    id: 'prod_SZfzFzOrGwV9rs',
    priceId: stripeConfig.HUSTLE_BOOST_PRICE_ID || 'price_missing_hustle_boost',
    name: 'Job Application Hustle Boost',
    description: 'A solid 25-job boost to keep your application momentum alive.',
    mode: 'payment',
    price: 17.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 25,
    features: [
      '25 AI job applications',
      'Instant access',
      'No expiration',
      'Use anytime',
      'Compatible with all plans'
    ]
  },
  {
    id: 'prod_SZg0BHePDKyfaJ',
    priceId: stripeConfig.FULL_SEND_PRICE_ID || 'price_missing_full_send',
    name: 'Job Application Full Send',
    description: 'Bulk top-up of 100 AI applications. Efficient and powerful.',
    mode: 'payment',
    price: 60.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 100,
    features: [
      '100 AI job applications',
      'Instant access',
      'No expiration',
      'Use anytime',
      'Compatible with all plans'
    ]
  },
  {
    id: 'prod_SZg1hA5JYa7jUD',
    priceId: stripeConfig.CAREER_STORM_PRICE_ID || 'price_missing_career_storm',
    name: 'Job Application Career Storm',
    description: '250 more jobs. For users executing full-scale job search blitzes.',
    mode: 'payment',
    price: 145.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 250,
    features: [
      '250 AI job applications',
      'Instant access',
      'No expiration',
      'Use anytime',
      'Compatible with all plans',
      'Best value for bulk applications'
    ]
  },
  
  // AI Token Packs
  {
    id: 'prod_SZg5NzHO7PdwNC',
    priceId: stripeConfig.LIGHT_BOOST_PRICE_ID || 'price_missing_light_boost',
    name: 'AI Token Light Boost',
    description: 'Quick boost of 10,000 AI tokens for resume and cover letter generation.',
    mode: 'payment',
    price: 1.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 10000,
    features: [
      '10,000 AI tokens',
      'Resume generation',
      'Cover letter creation',
      'Instant access',
      'No expiration'
    ]
  },
  {
    id: 'prod_SZg52qwFFosoC6',
    priceId: stripeConfig.SMART_STACK_PRICE_ID || 'price_missing_smart_stack',
    name: 'AI Token Smart Stack',
    description: '25,000 AI tokens for extended resume and cover letter work.',
    mode: 'payment',
    price: 2.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 25000,
    features: [
      '25,000 AI tokens',
      'Multiple resume versions',
      'Custom cover letters',
      'Instant access',
      'No expiration'
    ]
  },
  {
    id: 'prod_SZg6oBdB7j50Xb',
    priceId: stripeConfig.POWER_DRAFT_PRICE_ID || 'price_missing_power_draft',
    name: 'AI Token Power Draft',
    description: '50,000 AI tokens for comprehensive job application materials.',
    mode: 'payment',
    price: 3.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 50000,
    features: [
      '50,000 AI tokens',
      'Professional resume optimization',
      'Industry-specific cover letters',
      'Instant access',
      'No expiration'
    ]
  },
  {
    id: 'prod_SZg70s45I6BmQg',
    priceId: stripeConfig.CREATOR_SURGE_PRICE_ID || 'price_missing_creator_surge',
    name: 'AI Token Creator Surge',
    description: '100,000 AI tokens for power users and frequent job seekers.',
    mode: 'payment',
    price: 5.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 100000,
    features: [
      '100,000 AI tokens',
      'Unlimited resume variations',
      'Custom cover letter templates',
      'Priority processing',
      'No expiration'
    ]
  },
  {
    id: 'prod_SZg9YA9twVqwnF',
    priceId: stripeConfig.AI_VAULT_PRICE_ID || 'price_missing_ai_vault',
    name: 'AI Token Vault',
    description: '250,000 AI tokens - the ultimate package for serious job searchers.',
    mode: 'payment',
    price: 10.00,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 250000,
    features: [
      '250,000 AI tokens',
      'Enterprise-level resume optimization',
      'Unlimited cover letter variations',
      'Priority support',
      'No expiration',
      'Best value for heavy users'
    ]
  }
];

// Helper function to check if Stripe is properly configured
export const isStripeConfigured = (): boolean => {
  try {
    const config = getStripeConfig();
    return Object.values(config).every(value => value && !value.startsWith('price_missing'));
  } catch {
    return false;
  }
};

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
};

export const getProductById = (id: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.id === id);
};

export const getSubscriptionProducts = (): StripeProduct[] => {
  return STRIPE_PRODUCTS.filter(product => product.category === 'subscription');
};

export const getTokenProducts = (): StripeProduct[] => {
  return STRIPE_PRODUCTS.filter(product => product.category === 'tokens');
};

export const formatPrice = (price: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
};

export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
  };
  return symbols[currency.toLowerCase()] || currency.toUpperCase();
};

// Helper function to get plan limits
export const getPlanLimits = (priceId: string) => {
  const product = getProductByPriceId(priceId);
  if (!product) return null;

  return {
    applications: product.applicationCount || 0,
    aiTokens: product.aiTokenCount || 0,
    isSubscription: product.mode === 'subscription'
  };
};

// Helper function to get plan name by price ID with better fallbacks
export const getPlanNameByPriceId = (priceId: string): string => {
  // Try to get product by price ID first
  const product = getProductByPriceId(priceId);
  if (product && product.category === 'subscription') {
    return product.name;
  }

  // Fallback: try to match against environment variables
  if (priceId === stripeConfig.PLUS_PRICE_ID) return 'Plus';
  if (priceId === stripeConfig.PRO_PRICE_ID) return 'Pro';
  if (priceId === stripeConfig.MAX_PRICE_ID) return 'Max';

  // If price ID looks like a product ID, return default
  if (priceId && priceId.startsWith('prod_')) {
    console.warn('⚠️ Product ID detected instead of Price ID:', priceId);
    return 'Pro'; // Default fallback
  }

  return 'Unknown Plan';
};

export const planIncludesVoiceFeatures = (priceId: string): boolean => {
  // All paid plans include voice features
  const product = getProductByPriceId(priceId);
  return product?.category === 'subscription' || false;
};

export const calculateOverageCost = (usage: { steps: number; aiTokens: number }, limits: { steps: number; aiTokens: number }) => {
  const stepOverage = Math.max(0, usage.steps - limits.steps);
  const aiTokenOverage = Math.max(0, usage.aiTokens - limits.aiTokens);
  
  // Updated browser use cost: $0.03 per step + $0.01 initialization
  const stepCost = stepOverage * 0.03;
  const aiTokenCost = (aiTokenOverage / 1000) * 0.10; // $0.10 per 1,000 tokens
  
  return {
    stepOverage,
    aiTokenOverage,
    stepCost,
    aiTokenCost,
    totalCost: stepCost + aiTokenCost
  };
};

export const validateStripeConfig = (): { isValid: boolean; missingVars: string[] } => {
  try {
    const config = getStripeConfig();
    const missingVars = Object.entries(config)
      .filter(([key, value]) => !value || value.startsWith('price_missing'))
      .map(([key]) => `VITE_STRIPE_${key}`);
    
    return {
      isValid: missingVars.length === 0,
      missingVars
    };
  } catch (error) {
    return {
      isValid: false,
      missingVars: ['Configuration Error']
    };
  }
};

// Export the safe config for use elsewhere
export { stripeConfig };