import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Check, Zap, Bot, Mic, ArrowRight, CreditCard } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Logo } from './Logo';
import { getSubscriptionProducts, formatPrice } from '../../stripe-config';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  description?: string;
  onUpgrade?: () => void;
  requiredPlan?: 'any' | 'pro' | 'pro_plus' | 'extreme';
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  feature,
  description,
  onUpgrade,
  requiredPlan = 'any'
}) => {
  const subscriptionProducts = getSubscriptionProducts();

  const getFeatureIcon = (featureName: string) => {
    const name = featureName.toLowerCase();
    if (name.includes('voice') || name.includes('interview')) return Mic;
    if (name.includes('auto') || name.includes('apply')) return Zap;
    if (name.includes('ai') || name.includes('generate')) return Bot;
    return Crown;
  };

  const FeatureIcon = getFeatureIcon(feature);

  const getFeatureColor = (featureName: string) => {
    const name = featureName.toLowerCase();
    if (name.includes('voice') || name.includes('interview')) return 'from-purple-500 to-indigo-600';
    if (name.includes('auto') || name.includes('apply')) return 'from-blue-500 to-cyan-600';
    if (name.includes('ai') || name.includes('generate')) return 'from-green-500 to-emerald-600';
    return 'from-yellow-500 to-orange-600';
  };

  const handleUpgrade = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default: navigate to billing page
      window.location.href = '/billing';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`bg-gradient-to-r ${getFeatureColor(feature)} p-6 text-white relative`}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-full">
                <FeatureIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Unlock {feature}</h2>
                <p className="text-white/90 mt-1">
                  {description || `${feature} is a premium feature available to subscribers.`}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {subscriptionProducts.map((product, index) => {
                const isPopular = product.name.includes('Pro Plus');
                const isRecommended = requiredPlan === 'any' ? isPopular : 
                  requiredPlan === 'pro' ? product.name.includes('Pro') && !product.name.includes('Plus') :
                  requiredPlan === 'pro_plus' ? product.name.includes('Pro Plus') :
                  requiredPlan === 'extreme' ? product.name.includes('Extreme') : false;

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1">
                          Recommended
                        </Badge>
                      </div>
                    )}
                    
                    <Card className={`h-full transition-all duration-300 hover:shadow-lg ${
                      isRecommended ? 'ring-2 ring-purple-500 shadow-lg' : ''
                    }`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">
                              {formatPrice(product.price, product.currency)}
                            </div>
                            <div className="text-sm text-gray-500">per month</div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          {product.features?.slice(0, 5).map((feature, idx) => (
                            <div key={idx} className="flex items-start space-x-2">
                              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                            </div>
                          ))}
                        </div>
                        
                        <Button
                          onClick={handleUpgrade}
                          className={`w-full ${
                            isRecommended 
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' 
                              : ''
                          }`}
                          variant={isRecommended ? 'default' : 'outline'}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Choose {product.name}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Feature Benefits */}
            <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <FeatureIcon className="w-5 h-5 mr-2" />
                Why upgrade for {feature}?
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getFeatureBenefits(feature).map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Call to Action */}
            <div className="mt-6 text-center">
              <div className="flex items-center justify-center mb-4">
                <Logo width={100} height={32} className="opacity-60" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Join thousands of professionals who have upgraded their job search with Jobotic
              </p>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <Check className="w-4 h-4 text-green-500 mr-1" />
                  30-day money back guarantee
                </div>
                <div className="flex items-center">
                  <Check className="w-4 h-4 text-green-500 mr-1" />
                  Cancel anytime
                </div>
                <div className="flex items-center">
                  <Check className="w-4 h-4 text-green-500 mr-1" />
                  Instant access
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Helper function to get feature-specific benefits
const getFeatureBenefits = (feature: string): string[] => {
  const name = feature.toLowerCase();
  
  if (name.includes('voice') || name.includes('interview')) {
    return [
      'Practice with AI-powered voice interviews',
      'Get real-time feedback on your responses',
      'Improve communication skills with voice coaching',
      'Access to premium voice models and personalities',
      'Unlimited practice sessions',
      'Personalized interview scenarios'
    ];
  }
  
  if (name.includes('auto') || name.includes('apply')) {
    return [
      'Automated job applications while you sleep',
      'AI-powered job matching and filtering',
      'Intelligent application customization',
      'Real-time application tracking',
      'Priority support and faster processing',
      'Advanced automation features'
    ];
  }
  
  if (name.includes('ai') || name.includes('generate')) {
    return [
      'Advanced AI-powered content generation',
      'Unlimited document creation and editing',
      'Professional templates and formatting',
      'Multi-language support',
      'Export to multiple formats',
      'Priority AI processing'
    ];
  }
  
  // Default benefits
  return [
    'Unlimited access to premium features',
    'Priority customer support',
    'Advanced AI capabilities',
    'Export and sharing options',
    'Regular feature updates',
    'No usage limits'
  ];
};

export default PaywallModal; 