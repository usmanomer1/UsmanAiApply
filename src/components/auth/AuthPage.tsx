import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mail, Lock, User, Eye, EyeOff, Sparkles, Shield, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Check if Supabase is configured
  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        await signUp(formData.email, formData.password, formData.fullName);
      }
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Applications',
      description: 'Automatically apply to 100+ jobs daily with intelligent matching'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level encryption and privacy protection for your data'
    },
    {
      icon: Sparkles,
      title: 'Smart Optimization',
      description: 'AI-generated cover letters and resume optimization'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AIApply</h1>
                <p className="text-blue-100 text-sm">Premium Job Search Platform</p>
              </div>
            </div>

            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
              Land Your Dream Job with AI-Powered Automation
            </h2>
            
            <p className="text-xl text-blue-100 mb-12 leading-relaxed">
              Join thousands of professionals who've accelerated their job search with our intelligent automation platform.
            </p>

            <div className="space-y-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                    className="flex items-start space-x-4"
                  >
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                      <p className="text-blue-100 text-sm">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
            >
              <div className="flex items-center space-x-3 mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-300" />
                <span className="text-white font-semibold">Success Story</span>
              </div>
              <p className="text-blue-100 text-sm italic">
                "AIApply helped me land my dream job at Google in just 2 weeks. The AI automation saved me hours of manual applications!"
              </p>
              <p className="text-blue-200 text-xs mt-2">- Sarah Chen, Software Engineer</p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white/90 backdrop-blur-xl border-white/50 shadow-3xl">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8 pt-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">AIApply</h1>
              <p className="text-gray-600 mt-1">Premium Job Search Platform</p>
            </div>

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                {isLogin ? 'Welcome Back' : 'Get Started'}
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">
                {isLogin 
                  ? 'Sign in to continue your job search journey' 
                  : 'Create your account and start applying with AI'
                }
              </CardDescription>
            </CardHeader>

            <CardContent>

            {/* Demo Credentials - Only show if Supabase is not configured */}
            {!isSupabaseConfigured() && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-800">Demo Access</h3>
                </div>
                <div className="space-y-1 text-xs text-blue-700">
                  <p><span className="font-medium">Email:</span> demo@aiapply.com</p>
                  <p><span className="font-medium">Password:</span> demo123</p>
                </div>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                      <Input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="pl-12"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-12"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-12 pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full text-lg font-bold shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      {isLogin ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Toggle */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : 'Already have an account? Sign in'
                }
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
                <div className="flex items-center">
                  <Shield className="w-4 h-4 mr-1" />
                  <span>256-bit SSL</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />
                  <span>SOC 2 Certified</span>
                </div>
              </div>
            </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};