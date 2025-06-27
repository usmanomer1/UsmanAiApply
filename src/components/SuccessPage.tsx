import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Sparkles, Crown, Package, Bot, Brain, Coins } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProductByPriceId, formatPrice } from '../stripe-config';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const SuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const priceId = searchParams.get('price_id');
  const type = searchParams.get('type');
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);

  useEffect(() => {
    // For demo purposes, we'll simulate purchase details based on URL params
    // In a real app, you'd fetch this from your backend using the session_id
    const product = priceId ? getProductByPriceId(priceId) : null;
    
    if (product) {
      setPurchaseDetails({
        type: product.category,
        productName: product.name,
        amount: formatPrice(product.price, product.currency),
        features: product.features || [],
        mode: product.mode,
        currency: product.currency
      });
    } else {
      // Fallback for demo
      setPurchaseDetails({
        type: type || 'subscription',
        productName: 'Jobotic Pro',
        amount: '$25.00 USD',
        mode: 'subscription',
        currency: 'usd',
        features: [
          '37 automated job applications/month',
          '30,000 AI tokens for resume & cover letters',
          'Complex requests count as 2x tokens'
        ]
      });
    }
  }, [sessionId, priceId, type]);

  const getSuccessIcon = (type: string) => {
    switch (type) {
      case 'subscription':
        return <Crown className="w-12 h-12 text-white" />;
      case 'tokens':
        if (purchaseDetails?.productName?.includes('Job')) {
          return <Bot className="w-12 h-12 text-white" />;
        }
        return <Brain className="w-12 h-12 text-white" />;
      default:
        return <Package className="w-12 h-12 text-white" />;
    }
  };

  const getSuccessMessage = (type: string, mode: string) => {
    if (mode === 'subscription') {
      return {
        title: 'Subscription Activated!',
        subtitle: 'Welcome to Jobotic Premium',
        description: 'Your subscription is now active and you have access to all premium features including automated job applications and AI-powered tools.'
      };
    } else if (type === 'tokens') {
      if (purchaseDetails?.productName?.includes('Job')) {
        return {
          title: 'Job Tokens Purchased!',
          subtitle: 'Application Tokens Added',
          description: 'Your job application tokens have been added to your account and are ready to use for automated applications.'
        };
      } else {
        return {
          title: 'AI Tokens Purchased!',
          subtitle: 'ToolSuite Tokens Added',
          description: 'Your AI tokens have been added to your account for resume, CV, and cover letter generation.'
        };
      }
    }
    
    return {
      title: 'Purchase Complete!',
      subtitle: 'Thank you for your purchase',
      description: 'Your purchase has been processed successfully and is ready to use.'
    };
  };

  const successInfo = getSuccessMessage(
    purchaseDetails?.type || 'subscription', 
    purchaseDetails?.mode || 'subscription'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <Card className="glass-card overflow-hidden border-none shadow-3xl">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-12 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              {purchaseDetails ? getSuccessIcon(purchaseDetails.type) : <CheckCircle className="w-12 h-12 text-white" />}
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-bold text-white mb-4"
            >
              {successInfo.title}
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-emerald-100"
            >
              {successInfo.subtitle}
            </motion.p>
          </div>

          <CardContent className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center mb-8"
            >
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {successInfo.description}
              </p>
            </motion.div>

            {/* Purchase Details */}
            {purchaseDetails && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Details</h3>
                  <Badge variant="success" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Confirmed
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Product:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{purchaseDetails.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{purchaseDetails.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {purchaseDetails.mode === 'subscription' ? 'Monthly Subscription' : 'One-time Purchase'}
                    </span>
                  </div>
                  {sessionId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Session ID:</span>
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{sessionId}</span>
                    </div>
                  )}
                </div>

                {purchaseDetails.features && purchaseDetails.features.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">What's Included:</h4>
                    <ul className="space-y-2">
                      {purchaseDetails.features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}

            {/* Features Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                  <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Auto Applications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Let AI apply to jobs automatically while you focus on interviews
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                  <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">AI-Powered Tools</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Generate resumes and cover letters with advanced AI
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Smart Optimization</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    ATS-optimized applications with intelligent matching
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                  <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Premium Support</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get priority support and early access to new features
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button asChild size="lg" className="flex-1">
                <Link to="/auto-apply">
                  Start Auto Apply
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              
              <Button asChild variant="secondary" size="lg" className="flex-1">
                <Link to="/billing">
                  View Billing
                </Link>
              </Button>
            </motion.div>

            {/* Next Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800"
            >
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                🚀 Ready to Get Started?
              </h3>
              <p className="text-blue-800 dark:text-blue-200 text-sm mb-4">
                Your account is now fully activated. Here's what you can do next:
              </p>
              <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                  Set up your job search criteria in Auto Apply
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                  Upload your resume for AI optimization
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                  Generate personalized cover letters
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                  Track your application progress in the dashboard
                </li>
              </ul>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};