import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Zap, 
  Shield, 
  Lock,
  Star,
  Sparkles,
  Briefcase,
  Brain,
  HeadphonesIcon,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Users,
  Award,
  Globe,
  Cpu,
  FileText,
  MessageSquare,
  Gauge,
  Infinity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [showComparison, setShowComparison] = useState(false);

  const plans = [
    {
      name: 'Plus',
      price: billingPeriod === 'monthly' ? 25 : 20,
      originalPrice: billingPeriod === 'annual' ? 25 : null,
      description: 'Perfect for active job seekers',
      features: {
        core: [
          { icon: Briefcase, text: '40 AI Applications/month', highlight: true },
          { icon: Brain, text: '30,000 AI Tokens', highlight: true },
          { icon: FileText, text: 'Smart Resume Analysis' },
          { icon: MessageSquare, text: 'AI Cover Letters' }
        ],
        ai: [
          { icon: Sparkles, text: 'Basic AI Optimization' },
          { icon: Cpu, text: 'Standard Processing Speed' }
        ],
        support: [
          { icon: HeadphonesIcon, text: 'Email Support' }
        ]
      },
      applications: 40,
      tokens: 30000,
      buttonStyle: 'outline',
      gradient: 'from-gray-600 to-gray-700'
    },
    {
      name: 'Pro',
      price: billingPeriod === 'monthly' ? 49 : 39,
      originalPrice: billingPeriod === 'annual' ? 49 : null,
      description: 'Most popular for serious job hunters',
      popular: true,
      features: {
        core: [
          { icon: Briefcase, text: '110 AI Applications/month', highlight: true },
          { icon: Brain, text: '30,000 AI Tokens', highlight: true },
          { icon: FileText, text: 'Advanced Resume Analysis' },
          { icon: MessageSquare, text: 'Personalized Cover Letters' }
        ],
        ai: [
          { icon: Sparkles, text: 'Advanced AI Optimization' },
          { icon: Cpu, text: 'Priority Processing' },
          { icon: TrendingUp, text: 'Success Rate Analytics' }
        ],
        support: [
          { icon: HeadphonesIcon, text: 'Priority Email Support' },
          { icon: Users, text: 'Community Access' }
        ]
      },
      applications: 110,
      tokens: 30000,
      buttonStyle: 'gradient-purple',
      gradient: 'from-purple-600 to-pink-600'
    },
    {
      name: 'Max',
      price: billingPeriod === 'monthly' ? 99 : 79,
      originalPrice: billingPeriod === 'annual' ? 99 : null,
      description: 'For power users and professionals',
      features: {
        core: [
          { icon: Briefcase, text: '230 AI Applications/month', highlight: true },
          { icon: Brain, text: '30,000 AI Tokens', highlight: true },
          { icon: FileText, text: 'Premium Resume Tools' },
          { icon: MessageSquare, text: 'Unlimited Cover Letters' }
        ],
        ai: [
          { icon: Sparkles, text: 'Premium AI Features' },
          { icon: Cpu, text: 'Fastest Processing' },
          { icon: TrendingUp, text: 'Advanced Analytics' },
          { icon: Gauge, text: 'Custom AI Models' }
        ],
        support: [
          { icon: HeadphonesIcon, text: '24/7 Priority Support' },
          { icon: Users, text: 'VIP Community Access' },
          { icon: Award, text: 'Success Coaching' }
        ]
      },
      applications: 230,
      tokens: 30000,
      buttonStyle: 'gradient-teal',
      gradient: 'from-teal-600 to-cyan-600'
    }
  ];

  const comparisonFeatures = [
    { category: 'Applications', plus: '40/month', pro: '110/month', max: '230/month' },
    { category: 'AI Tokens', plus: '30,000', pro: '30,000', max: '30,000' },
    { category: 'Resume Analysis', plus: 'Basic', pro: 'Advanced', max: 'Premium' },
    { category: 'Cover Letters', plus: 'Standard', pro: 'Personalized', max: 'Unlimited' },
    { category: 'Processing Speed', plus: 'Standard', pro: 'Priority', max: 'Fastest' },
    { category: 'Success Analytics', plus: '❌', pro: '✓', max: '✓ Advanced' },
    { category: 'Support Response', plus: '48h', pro: '24h', max: 'Instant' },
    { category: 'API Access', plus: '❌', pro: '❌', max: '✓' },
    { category: 'Team Features', plus: '❌', pro: '❌', max: '✓' },
    { category: 'Custom Integrations', plus: '❌', pro: '❌', max: '✓' }
  ];

  const handleSelectPlan = (planName: string) => {
    if (user) {
      navigate('/billing', { state: { selectedPlan: planName.toLowerCase() } });
    } else {
      navigate('/auth', { state: { redirect: '/billing', selectedPlan: planName.toLowerCase() } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white">
      {/* Hero Section */}
      <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl sm:text-6xl font-bold mb-6"
          >
            <span className="bg-gradient-to-r from-gray-900 via-purple-800 to-teal-700 bg-clip-text text-transparent">
              Choose Your Plan
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 mb-8"
          >
            Start free, upgrade anytime. No credit card required.
          </motion.p>

          {/* Billing Toggle */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-4 mb-12"
          >
            <span className={`text-lg ${billingPeriod === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
              className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                  billingPeriod === 'annual' ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-lg ${billingPeriod === 'annual' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Annual
            </span>
            {billingPeriod === 'annual' && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              >
                Save 20%
              </motion.span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="relative group"
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center">
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                    >
                      <Star className="h-4 w-4" />
                      Most Popular
                    </motion.div>
                  </div>
                )}

                <div className={`h-full rounded-2xl bg-white p-8 shadow-lg transition-all duration-300 ${
                  plan.popular ? 'ring-2 ring-purple-600' : ''
                } hover:shadow-xl relative overflow-hidden`}>
                  {/* Gradient Border on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${plan.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  
                  {/* Plan Header */}
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-gray-600 mb-6">{plan.description}</p>
                    
                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                        <span className="ml-2 text-gray-600">/month</span>
                      </div>
                      {plan.originalPrice && (
                        <div className="mt-1 text-sm text-gray-500 line-through">
                          ${plan.originalPrice}/month
                        </div>
                      )}
                    </div>

                    {/* Usage Bars */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Applications</span>
                          <span className="font-medium text-gray-900">{plan.applications}/month</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(plan.applications / 230) * 100}%` }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className={`h-full bg-gradient-to-r ${plan.gradient}`}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">AI Tokens</span>
                          <span className="font-medium text-gray-900">{plan.tokens.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ delay: 0.6, duration: 0.8 }}
                            className={`h-full bg-gradient-to-r ${plan.gradient}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Features by Category */}
                    <div className="space-y-6 mb-8">
                      {/* Core Features */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Core Features</h4>
                        <ul className="space-y-3">
                          {plan.features.core.map((feature, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.4 + idx * 0.05 }}
                              className="flex items-center gap-3 group/item"
                            >
                              <feature.icon className={`h-5 w-5 ${feature.highlight ? 'text-purple-600' : 'text-gray-400'} group-hover/item:scale-110 transition-transform`} />
                              <span className={`text-sm ${feature.highlight ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {feature.text}
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>

                      {/* AI Features */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">AI Features</h4>
                        <ul className="space-y-3">
                          {plan.features.ai.map((feature, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + idx * 0.05 }}
                              className="flex items-center gap-3 group/item"
                            >
                              <feature.icon className="h-5 w-5 text-gray-400 group-hover/item:scale-110 transition-transform" />
                              <span className="text-sm text-gray-600">{feature.text}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>

                      {/* Support */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Support & Access</h4>
                        <ul className="space-y-3">
                          {plan.features.support.map((feature, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + idx * 0.05 }}
                              className="flex items-center gap-3 group/item"
                            >
                              <feature.icon className="h-5 w-5 text-gray-400 group-hover/item:scale-110 transition-transform" />
                              <span className="text-sm text-gray-600">{feature.text}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleSelectPlan(plan.name)}
                      className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
                        plan.buttonStyle === 'outline'
                          ? 'border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                          : plan.buttonStyle === 'gradient-purple'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl'
                          : 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      Get Started
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Users className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="text-2xl font-bold text-gray-900">10,000+</h3>
              <p className="text-gray-600">Job Seekers</p>
            </div>
            <div className="flex flex-col items-center">
              <Briefcase className="h-8 w-8 text-teal-600 mb-3" />
              <h3 className="text-2xl font-bold text-gray-900">50,000+</h3>
              <p className="text-gray-600">Jobs Applied</p>
            </div>
            <div className="flex flex-col items-center">
              <TrendingUp className="h-8 w-8 text-pink-600 mb-3" />
              <h3 className="text-2xl font-bold text-gray-900">85%</h3>
              <p className="text-gray-600">Success Rate</p>
            </div>
            <div className="flex flex-col items-center">
              <Award className="h-8 w-8 text-cyan-600 mb-3" />
              <h3 className="text-2xl font-bold text-gray-900">4.9/5</h3>
              <p className="text-gray-600">User Rating</p>
            </div>
          </div>

          {/* Security Badges */}
          <div className="mt-12 flex justify-center items-center gap-8">
            <div className="flex items-center gap-2 text-gray-600">
              <Shield className="h-5 w-5" />
              <span className="text-sm">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Lock className="h-5 w-5" />
              <span className="text-sm">SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Globe className="h-5 w-5" />
              <span className="text-sm">GDPR Compliant</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Comparison Table */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Detailed Feature Comparison</h3>
            {showComparison ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </motion.button>

          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Features</th>
                        <th className="px-6 py-4 text-center text-sm font-medium text-gray-900">Plus</th>
                        <th className="px-6 py-4 text-center text-sm font-medium text-gray-900">Pro</th>
                        <th className="px-6 py-4 text-center text-sm font-medium text-gray-900">Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {comparisonFeatures.map((feature, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{feature.category}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-600">{feature.plus}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-600">{feature.pro}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-600">{feature.max}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;