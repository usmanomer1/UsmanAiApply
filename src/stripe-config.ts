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
  PRO_PRICE_ID: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1RaM5LQGabzJD80B3zGbTHcZ',
  PRO_PLUS_PRICE_ID: import.meta.env.VITE_STRIPE_PRO_PLUS_PRICE_ID || 'price_1RYvjSQGabzJD80BbbXxTq2S',
  EXTREME_PRICE_ID: import.meta.env.VITE_STRIPE_EXTREME_PRICE_ID || 'price_1RYvocQGabzJD80BEVgRcdSa',
  JOB_TOKEN_PRICE_ID: import.meta.env.VITE_STRIPE_JOB_TOKEN_PRICE_ID || 'price_1RaMKDQGabzJD80BKxOyfLX3',
  AI_TOKEN_PRICE_ID: import.meta.env.VITE_STRIPE_AI_TOKEN_PRICE_ID || 'price_1RaMIgQGabzJD80B2aVeDPYZ'
});

const stripeConfig = getStripeConfig();

export const STRIPE_PRODUCTS: StripeProduct[] = [
  // Subscription Plans
  {
    id: 'prod_STtSVTDQXrXzYM',
    priceId: stripeConfig.PRO_PRICE_ID,
    name: 'Plus',
    description: 'Unlock up to 37 automated job applications per month with AI-powered job matching. Includes 30,000 AI tokens for resume and cover letter generation, where complex requests count as double token usage. Additional job applications cost $0.80 each; extra AI tokens are billed at $0.10 per 1,000 tokens. Enjoy seamless automation',
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
    id: 'prod_ALT_PRO_PLUS',
    priceId: stripeConfig.PRO_PLUS_PRICE_ID,
    name: 'Pro',
    description: 'Legacy price id for Pro Plus – same limits as standard Pro Plus plan.',
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
    id: 'prod_STtb6RASMEP4t2',
    priceId: stripeConfig.EXTREME_PRICE_ID,
    name: 'Max',
    description: 'Experience premium access with 158 automated job applications per month plus 30,000 AI tokens for resume and cover letter generation (complex requests charged at 2× tokens). Benefit from priority support and early feature access. Additional job applications are billed at $0.80 each, and extra AI tokens at $0.10 per 1,000 tokens. Ideal for power users demanding maximum productivity.',
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
  // Token Packs
  {
    id: 'prod_SVN42LIZP5sFxh',
    priceId: stripeConfig.JOB_TOKEN_PRICE_ID,
    name: 'Job Application Token Pack',
    description: 'Buy individual tokens to automate job applications using AI powered autonomous web agent. Each token covers 10 steps of our AI agent. Scale your applications easily with flexible token quantities.',
    mode: 'payment',
    price: 0.80,
    currency: 'usd',
    category: 'tokens',
    tokenCount: 1,
    features: [
      '1 token = 10 automation steps',
      'AI-powered job applications',
      'Flexible quantity scaling',
      'Pay-as-you-go pricing',
      'No monthly commitment'
    ]
  },
  {
    id: 'prod_SVN2ST7bWhXL6K',
    priceId: stripeConfig.AI_TOKEN_PRICE_ID,
    name: 'AI ToolSuite Token Pack',
    description: 'Purchase 1,000 AI tokens for resume, CV, and cover letter generation and analysis. Tokens are used based on request complexity. Perfect for powering all your AI-powered document tools with flexible pay-as-you-go usage.',
    mode: 'payment',
    price: 0.10,
    currency: 'usd',
    category: 'tokens',
    aiTokenCount: 1000,
    features: [
      '1,000 AI tokens per pack',
      'Resume, CV & cover letter generation',
      'Usage based on complexity',
      'Flexible pay-as-you-go',
      'No expiration date'
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
    'VITE_STRIPE_PRO_PRICE_ID',
    'VITE_STRIPE_PRO_PLUS_PRICE_ID', 
    'VITE_STRIPE_EXTREME_PRICE_ID',
    'VITE_STRIPE_JOB_TOKEN_PRICE_ID',
    'VITE_STRIPE_AI_TOKEN_PRICE_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
};