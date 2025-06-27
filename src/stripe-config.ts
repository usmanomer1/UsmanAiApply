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

// Get price IDs from environment variables with fallbacks for development
const getStripeConfig = () => ({
  PLUS_PRICE_ID: import.meta.env.VITE_STRIPE_PLUS_PRICE_ID || 'price_1ReWRFGkowQ7Swlf8PrgcgFW',
  PRO_PRICE_ID: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1ReWSQGkowQ7SwlftYAa0rsz',
  MAX_PRICE_ID: import.meta.env.VITE_STRIPE_MAX_PRICE_ID || 'price_1ReWUBGkowQ7SwlfhyAyjNOl',
  
  // Job Application Token Packs
  QUICK_APPLY_PRICE_ID: import.meta.env.VITE_STRIPE_QUICK_APPLY_PRICE_ID || 'price_1ReWZdGkowQ7SwlfVZescJWA',
  HUSTLE_BOOST_PRICE_ID: import.meta.env.VITE_STRIPE_HUSTLE_BOOST_PRICE_ID || 'price_1ReWdLGkowQ7SwlfDuLs92WQ',
  FULL_SEND_PRICE_ID: import.meta.env.VITE_STRIPE_FULL_SEND_PRICE_ID || 'price_1ReWefGkowQ7Swlf023H0L0W',
  CAREER_STORM_PRICE_ID: import.meta.env.VITE_STRIPE_CAREER_STORM_PRICE_ID || 'price_1ReWfMGkowQ7SwlfTzR1Cf1Q',
  
  // AI Token Packs
  LIGHT_BOOST_PRICE_ID: import.meta.env.VITE_STRIPE_LIGHT_BOOST_PRICE_ID || 'price_1ReWj2GkowQ7SwlfgLEXqpPu',
  SMART_STACK_PRICE_ID: import.meta.env.VITE_STRIPE_SMART_STACK_PRICE_ID || 'price_1ReWjhGkowQ7SwlfWMmqHJgT',
  POWER_DRAFT_PRICE_ID: import.meta.env.VITE_STRIPE_POWER_DRAFT_PRICE_ID || 'price_1ReWkPGkowQ7SwlfEaIHuHnm',
  CREATOR_SURGE_PRICE_ID: import.meta.env.VITE_STRIPE_CREATOR_SURGE_PRICE_ID || 'price_1ReWlhGkowQ7Swlfx31q1Sf0',
  AI_VAULT_PRICE_ID: import.meta.env.VITE_STRIPE_AI_VAULT_PRICE_ID || 'price_1ReWnQGkowQ7Swlfs8LiY8Bg'
});

const stripeConfig = getStripeConfig();

export const STRIPE_PRODUCTS: StripeProduct[] = [
  // Subscription Plans
  {
    id: 'prod_SZfmZazFIlmV2H',
    priceId: stripeConfig.PLUS_PRICE_ID,
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
    priceId: stripeConfig.PRO_PRICE_ID,
    name: 'Pro',
    description: '37 automated job applications per month, 30,000 AI tokens for resume and cover letters, voice AI features included, additional applications and AI tokens billed separately.',
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
    priceId: stripeConfig.MAX_PRICE_ID,
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
    priceId: stripeConfig.QUICK_APPLY_PRICE_ID,
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
    priceId: stripeConfig.HUSTLE_BOOST_PRICE_ID,
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
    priceId: stripeConfig.FULL_SEND_PRICE_ID,
    name: 'Job Application Full Send',
    description: 'Bulk top-up of 100 AI applications. Efficient and powerful.',
    mode: 'subscription',
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
    priceId: stripeConfig.CAREER_STORM_PRICE_ID,
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
    priceId: stripeConfig.LIGHT_BOOST_PRICE_ID,
    name: 'AI Tokens - Light Boost',
    description: 'Extra 10K AI tokens to top up your resume and cover letter tools — fast, cheap, and effective.',
    mode: 'payment',
    price: 1.00,
    currency: 'usd',
    category: 'tokens',
    aiTokenCount: 10000,
    features: [
      '10,000 AI tokens',
      'Resume & cover letter generation',
      'Instant access',
      'No expiration',
      'Compatible with all plans'
    ]
  },
  {
    id: 'prod_SZg52qwFFosoC6',
    priceId: stripeConfig.SMART_STACK_PRICE_ID,
    name: 'AI Tokens - Smart Stack',
    description: '25K tokens for multiple cover letters, custom responses, or rewriting your resume like a pro.',
    mode: 'payment',
    price: 2.00,
    currency: 'usd',
    category: 'tokens',
    aiTokenCount: 25000,
    features: [
      '25,000 AI tokens',
      'Multiple cover letters',
      'Resume rewrites',
      'Custom responses',
      'No expiration'
    ]
  },
  {
    id: 'prod_SZg6oBdB7j50Xb',
    priceId: stripeConfig.POWER_DRAFT_PRICE_ID,
    name: 'AI Tokens - Power Draft',
    description: 'Build full application kits with 50K tokens. Great for interview prep, personalization, and bulk usage.',
    mode: 'subscription',
    price: 3.00,
    currency: 'usd',
    category: 'tokens',
    aiTokenCount: 50000,
    features: [
      '50,000 AI tokens',
      'Full application kits',
      'Interview preparation',
      'Personalized content',
      'Bulk usage capability'
    ]
  },
  {
    id: 'prod_SZg70s45I6BmQg',
    priceId: stripeConfig.CREATOR_SURGE_PRICE_ID,
    name: 'AI Tokens - Creator Surge',
    description: '100K tokens for those running weekly AI content — perfect for heavy resume customization and job prep.',
    mode: 'subscription',
    price: 5.00,
    currency: 'usd',
    category: 'tokens',
    aiTokenCount: 100000,
    features: [
      '100,000 AI tokens',
      'Weekly content generation',
      'Heavy resume customization',
      'Comprehensive job prep',
      'Bulk content creation'
    ]
  },
  {
    id: 'prod_SZg9YA9twVqwnF',
    priceId: stripeConfig.AI_VAULT_PRICE_ID,
    name: 'AI Tokens - AI Vault',
    description: '250K tokens for serious users scaling fast. Bulk pricing, maximum flexibility, and huge value.',
    mode: 'payment',
    price: 10.00,
    currency: 'usd',
    category: 'tokens',
    aiTokenCount: 250000,
    features: [
      '250,000 AI tokens',
      'Bulk pricing',
      'Maximum flexibility',
      'Huge value',
      'Ideal for power users'
    ]
  }
];

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
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  });
  return formatter.format(price);
};

export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    'usd': '$',
    'cad': 'C$',
    'eur': '€',
    'gbp': '£'
  };
  return symbols[currency.toLowerCase()] || '$';
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

// Helper function to get plan name from price ID
export const getPlanNameByPriceId = (priceId: string): string => {
  const product = getProductByPriceId(priceId);
  return product?.name || 'Unknown Plan';
};

// Helper function to check if plan includes voice features
export const planIncludesVoiceFeatures = (priceId: string): boolean => {
  const product = getProductByPriceId(priceId);
  return product?.category === 'subscription'; // All subscription plans include voice
};

// Helper function to calculate overage costs (now step-based instead of application-based)
export const calculateOverageCost = (usage: { steps: number; aiTokens: number }, limits: { steps: number; aiTokens: number }) => {
  const stepOverage = Math.max(0, usage.steps - limits.steps);
  const aiTokenOverage = Math.max(0, usage.aiTokens - limits.aiTokens);
  
  const stepCost = stepOverage * 0.001; // $0.001 per step
  const aiTokenCost = Math.ceil(aiTokenOverage / 1000) * 0.10; // $0.10 per 1,000 tokens
  
  return {
    stepOverage,
    aiTokenOverage,
    stepCost,
    aiTokenCost,
    totalCost: stepCost + aiTokenCost
  };
};

// Validate environment configuration
export const validateStripeConfig = (): { isValid: boolean; missingVars: string[] } => {
  const requiredVars = [
    'VITE_STRIPE_PLUS_PRICE_ID',
    'VITE_STRIPE_PRO_PRICE_ID', 
    'VITE_STRIPE_MAX_PRICE_ID',
    'VITE_STRIPE_QUICK_APPLY_PRICE_ID',
    'VITE_STRIPE_HUSTLE_BOOST_PRICE_ID',
    'VITE_STRIPE_FULL_SEND_PRICE_ID',
    'VITE_STRIPE_CAREER_STORM_PRICE_ID',
    'VITE_STRIPE_LIGHT_BOOST_PRICE_ID',
    'VITE_STRIPE_SMART_STACK_PRICE_ID',
    'VITE_STRIPE_POWER_DRAFT_PRICE_ID',
    'VITE_STRIPE_CREATOR_SURGE_PRICE_ID',
    'VITE_STRIPE_AI_VAULT_PRICE_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
};