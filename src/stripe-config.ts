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
  // Subscription Plans - Updated with new pricing from Stripe
  {
    id: 'prod_SZfmZazFIlmV2H',
    priceId: stripeConfig.PLUS_PRICE_ID || 'price_1Rf2oQGkowQ7SwlfhDDuOpFk',
    name: 'Plus',
    description: '40 automated job applications/month, 30,000 AI tokens for resume & cover letters. Voice AI features included. Additional applications and AI tokens billed separately.',
    mode: 'subscription',
    price: 10.00, // Updated from $25 to $10
    currency: 'usd',
    interval: 'month',
    category: 'subscription',
    applicationCount: 40, // Updated from 37 to 40
    aiTokenCount: 120000,
    features: [
      '40 automated job applications/month', // Updated count
      '120,000 AI tokens for job search & resume optimization',
      'Complex requests count as 2x tokens',
      'Additional applications: $0.80 each',
      'Extra AI tokens: $0.10 per 1,000',
      'Voice AI features included'
    ]
  },
  {
    id: 'prod_SZfo61zKWmnX6l',
    priceId: stripeConfig.PRO_PRICE_ID || 'price_1Rf2nJGkowQ7Swlfwvc3CBO8',
    name: 'Pro',
    description: '110 automated job applications per month, 30,000 AI tokens for resume and cover letters, voice AI features included, additional applications and AI tokens billed separately.',
    mode: 'subscription',
    price: 25.00, // Updated from $50 to $25
    currency: 'usd',
    interval: 'month',
    category: 'subscription',
    applicationCount: 110, // Updated from 77 to 110
    aiTokenCount: 120000,
    features: [
      '110 automated job applications/month', // Updated count
      '120,000 AI tokens for job search & resume optimization',
      'Complex requests count as 2x tokens',
      'Additional applications: $0.80 each',
      'Extra AI tokens: $0.10 per 1,000',
      'Voice AI features included',
      'Priority support'
    ]
  },
  {
    id: 'prod_SZfpQ9Y78JdsPl',
    priceId: stripeConfig.MAX_PRICE_ID || 'price_1Rf2owGkowQ7SwlfEG4UKU8c',
    name: 'Max',
    description: '230 job applications per month, 30,000 AI tokens for resume and cover letters, Voice AI features included, Priority support and early access, Additional applications and AI tokens billed separately',
    mode: 'subscription',
    price: 50.00, // Updated from $100 to $50
    currency: 'usd',
    interval: 'month',
    category: 'subscription',
    applicationCount: 230, // Updated from 158 to 230
    aiTokenCount: 120000,
    features: [
      '230 automated job applications/month', // Updated count
      '120,000 AI tokens for job search & resume optimization',
      'Complex requests count as 2x tokens',
      'Priority support & early access',
      'Additional applications: $0.80 each',
      'Extra AI tokens: $0.10 per 1,000',
      'Voice AI features included',
      'Dedicated account manager'
    ]
  },
  
  // Job Application Token Packs - Updated pricing
  {
    id: 'prod_SZfvC0SBiq8WCH',
    priceId: stripeConfig.QUICK_APPLY_PRICE_ID || 'price_1ReWZdGkowQ7SwlfVZescJWA',
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
    priceId: stripeConfig.HUSTLE_BOOST_PRICE_ID || 'price_1ReWdLGkowQ7SwlfDuLs92WQ',
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
    priceId: stripeConfig.FULL_SEND_PRICE_ID || 'price_1ReWefGkowQ7Swlf023H0L0W',
    name: 'Job Application Full Send',
    description: 'Bulk top-up of 100 AI applications. Efficient and powerful.',
    mode: 'subscription', // Note: This is actually a recurring product in Stripe
    price: 60.00,
    currency: 'usd',
    interval: 'month',
    category: 'tokens',
    tokenCount: 100,
    features: [
      '100 AI job applications/month',
      'Recurring monthly delivery',
      'Cancel anytime',
      'Bulk efficiency',
      'Compatible with all plans'
    ]
  },
  {
    id: 'prod_SZg1hA5JYa7jUD',
    priceId: stripeConfig.CAREER_STORM_PRICE_ID || 'price_1ReWfMGkowQ7SwlfTzR1Cf1Q',
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
  
  // AI Token Packs - Updated pricing
  {
    id: 'prod_SZg5NzHO7PdwNC',
    priceId: stripeConfig.LIGHT_BOOST_PRICE_ID || 'price_1ReWj2GkowQ7SwlfgLEXqpPu',
    name: 'AI Tokens- Light Boost',
    description: 'Extra 10K AI tokens to top up your resume and cover letter tools — fast, cheap, and effective.',
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
    priceId: stripeConfig.SMART_STACK_PRICE_ID || 'price_1ReWjhGkowQ7SwlfWMmqHJgT',
    name: 'AI Tokens- Smart Stack',
    description: '25K tokens for multiple cover letters, custom responses, or rewriting your resume like a pro.',
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
    priceId: stripeConfig.POWER_DRAFT_PRICE_ID || 'price_1ReWkPGkowQ7SwlfEaIHuHnm',
    name: 'AI Tokens- Power Draft',
    description: 'Build full application kits with 50K tokens. Great for interview prep, personalization, and bulk usage.',
    mode: 'subscription', // Note: This is a recurring product in Stripe
    price: 3.00,
    currency: 'usd',
    interval: 'month',
    category: 'tokens',
    tokenCount: 50000,
    features: [
      '50,000 AI tokens/month',
      'Professional resume optimization',
      'Industry-specific cover letters',
      'Recurring monthly delivery',
      'Cancel anytime'
    ]
  },
  {
    id: 'prod_SZg70s45I6BmQg',
    priceId: stripeConfig.CREATOR_SURGE_PRICE_ID || 'price_1ReWlhGkowQ7Swlfx31q1Sf0',
    name: 'AI Tokens- Creator Surge',
    description: '100K tokens for those running weekly AI content — perfect for heavy resume customization and job prep.',
    mode: 'subscription', // Note: This is a recurring product in Stripe
    price: 5.00,
    currency: 'usd',
    interval: 'month',
    category: 'tokens',
    tokenCount: 100000,
    features: [
      '100,000 AI tokens/month',
      'Unlimited resume variations',
      'Custom cover letter templates',
      'Priority processing',
      'Recurring monthly delivery'
    ]
  },
  {
    id: 'prod_SZg9YA9twVqwnF',
    priceId: stripeConfig.AI_VAULT_PRICE_ID || 'price_1ReWnQGkowQ7Swlfs8LiY8Bg',
    name: 'AI Tokens- AI Vault',
    description: '250K tokens for serious users scaling fast. Bulk pricing, maximum flexibility, and huge value.',
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
  if (product) {
    return {
      applications: product.applicationCount || 0,
      aiTokens: product.aiTokenCount || 0,
      isSubscription: product.mode === 'subscription'
    };
  }
  
  // Fallback for hardcoded price IDs
  const hardcodedLimits: Record<string, { applications: number; aiTokens: number }> = {
    'price_1Rf2oQGkowQ7SwlfhDDuOpFk': { applications: 40, aiTokens: 30000 }, // Plus
    'price_1Rf2nJGkowQ7Swlfwvc3CBO8': { applications: 110, aiTokens: 30000 }, // Pro
    'price_1Rf2owGkowQ7SwlfEG4UKU8c': { applications: 230, aiTokens: 30000 }, // Max
  };
  
  if (hardcodedLimits[priceId]) {
    return {
      ...hardcodedLimits[priceId],
      isSubscription: true
    };
  }
  
  console.warn('⚠️ No plan limits found for price ID:', priceId);
  return null;
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
  
  // Additional fallback: match against hardcoded price IDs
  if (priceId === 'price_1Rf2oQGkowQ7SwlfhDDuOpFk') return 'Plus';
  if (priceId === 'price_1Rf2nJGkowQ7Swlfwvc3CBO8') return 'Pro';
  if (priceId === 'price_1Rf2owGkowQ7SwlfEG4UKU8c') return 'Max';

  // If price ID looks like a product ID, return default
  if (priceId && priceId.startsWith('prod_')) {
    console.warn('⚠️ Product ID detected instead of Price ID:', priceId);
    return 'Pro'; // Default fallback
  }

  console.warn('⚠️ Unknown price ID:', priceId);
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