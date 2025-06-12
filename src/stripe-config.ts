export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
  price: number;
  currency: string;
  interval?: 'month' | 'year';
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_STtSVTDQXrXzYM',
    priceId: 'price_1RYvf7QGabzJD80Bhd4V99CB',
    name: 'AIApply Pro Subscription',
    description: 'Perfect for focused job searches. Includes 50 job tokens (each token = 10 automation steps) and 50 AI-powered resume/cover letter generations per month. Strict usage caps prevent overuse.',
    mode: 'subscription',
    price: 40.00,
    currency: 'usd',
    interval: 'month'
  },
  {
    id: 'prod_STtWcPBpRuamgq',
    priceId: 'price_1RYvjSQGabzJD80BbbXxTq2S',
    name: 'AIApply Pro Plus Subscription',
    description: 'Ideal for active job seekers. Includes 75 job tokens (each token = 10 automation steps) and 50 AI-powered resume/cover letter generations per month. Strict usage caps prevent overuse.',
    mode: 'subscription',
    price: 60.00,
    currency: 'usd',
    interval: 'month'
  },
  {
    id: 'prod_STtb6RASMEP4t2',
    priceId: 'price_1RYvocQGabzJD80BEVgRcdSa',
    name: 'AIApply Extreme Subscription',
    description: 'For intensive job search campaigns. Includes 150 job tokens (each token = 10 automation steps) and 50 AI-powered resume/cover letter generations per month. Strict usage caps prevent overuse. Includes priority support and early feature access.',
    mode: 'subscription',
    price: 100.00,
    currency: 'usd',
    interval: 'month'
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
};

export const getProductById = (id: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.id === id);
};