import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mail, Lock, User, Eye, EyeOff, Sparkles, Shield, Zap, CheckCircle, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Logo } from '../ui/Logo';
import { getMaintenanceConfig, canAccessDuringMaintenance } from '../../lib/maintenance';
import Silk from '../ui/Silk';
import { supabase } from '../../lib/supabase';
import Turnstile from 'react-turnstile';
import { EmailVerificationError } from '../ui/EmailVerificationError';

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailVerificationError, setEmailVerificationError] = useState<{ email: string } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [captchaToken, setCaptchaToken] = useState("");

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Import maintenance utilities
  const { isMaintenanceMode, maintenanceMessage } = getMaintenanceConfig();

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

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setEmailVerificationError(null);
    if (!captchaToken) {
      setMessage({ type: 'error', text: 'Please complete the CAPTCHA.' });
      return;
    }
    
    // Check maintenance mode for non-admin users
    if (!canAccessDuringMaintenance(formData.email)) {
      setMessage({ type: 'error', text: maintenanceMessage });
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'login') {
        await signIn(formData.email, formData.password, captchaToken);
      } else if (authMode === 'signup') {
        // Disable signup during maintenance mode
        if (isMaintenanceMode) {
          setMessage({ type: 'error', text: 'New registrations are temporarily disabled during maintenance.' });
          return;
        }
        await signUp(formData.email, formData.password, formData.fullName, captchaToken);
      } else if (authMode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/auth?mode=reset-password`,
        });
        
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({ 
            type: 'success', 
            text: 'Password reset email sent! Check your inbox and follow the instructions.' 
          });
          // Reset form
          setFormData({ email: '', password: '', fullName: '' });
        }
      }
    } catch (error: any) {
      // Check if it's an email verification error
      if (error.message === 'email_not_verified') {
        setEmailVerificationError({ email: error.email });
      } else {
        setMessage({ type: 'error', text: error.message || 'An error occurred' });
      }
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

  const getFormTitle = () => {
    switch (authMode) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Get Started';
      case 'forgot-password': return 'Reset Password';
      case 'reset-password': return 'Set New Password';
      default: return 'Welcome';
    }
  };

  const getFormDescription = () => {
    switch (authMode) {
      case 'login': return 'Sign in to continue your job search journey';
      case 'signup': return 'Create your account and start applying with AI';
      case 'forgot-password': return 'Enter your email to receive reset instructions';
      case 'reset-password': return 'Enter your new password';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Silk Background with Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Silk Background */}
        <div className="absolute inset-0">
          <Silk
            speed={5}
            scale={1}
            noiseIntensity={1.5}
            rotation={0}
          />
        </div>
        
        {/* Enhanced Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/60"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center space-x-3 mb-8">
              <div className="p-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg">
                <Logo width={48} height={48} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Jobotic</h1>
                <p className="text-gray-100 text-sm font-medium">Premium Job Search Platform</p>
              </div>
            </div>

            <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
              Land Your Dream Job with AI-Powered Automation
            </h2>
            
            <p className="text-xl text-gray-100 mb-12 leading-relaxed">
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
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-2 text-lg">{feature.title}</h3>
                      <p className="text-gray-100 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl"
            >
              <div className="flex items-center space-x-3 mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-300" />
                <span className="text-white font-semibold text-lg">Success Story</span>
              </div>
              <p className="text-gray-100 text-sm italic leading-relaxed">
                "Jobotic helped me land my dream job at Google in just 2 weeks. The AI automation saved me hours of manual applications!"
              </p>
              <p className="text-gray-200 text-xs mt-3 font-medium">- Sarah Chen, Software Engineer</p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white/95 backdrop-blur-xl border-gray-200/50 shadow-2xl">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8 pt-8">
              <div className="inline-flex items-center justify-center mb-4">
                <div className="p-3 bg-indigo-100 rounded-2xl">
                  <Logo width={64} height={64} />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Jobotic</h1>
              <p className="text-gray-600 mt-1">Premium Job Search Platform</p>
            </div>

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                {getFormTitle()}
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">
                {getFormDescription()}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Maintenance Mode Banner */}
              {isMaintenanceMode && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-800 font-medium">Maintenance Mode</span>
                  </div>
                  <p className="text-amber-700 text-sm mt-1">
                    {maintenanceMessage}
                  </p>
                  <p className="text-amber-600 text-xs mt-2">
                    Admin access only during this period.
                  </p>
                </motion.div>
              )}

              {/* Message Display */}
              <AnimatePresence>
                {emailVerificationError && (
                  <EmailVerificationError
                    initialEmail={emailVerificationError.email}
                    onClose={() => setEmailVerificationError(null)}
                  />
                )}
                {message && !emailVerificationError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className={`mb-6 p-4 rounded-xl border ${
                      message.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm leading-relaxed">{message.text}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <AnimatePresence mode="wait">
                  {authMode === 'signup' && (
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
                          className="pl-12 h-12 text-base border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
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
                      className="pl-12 h-12 text-base border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {authMode !== 'forgot-password' && (
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
                        className="pl-12 pr-12 h-12 text-base border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
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
                )}

                {/* Forgot Password Link */}
                {authMode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot-password')}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}

                <Turnstile
                  sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  className="my-4"
                />

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="w-full text-lg font-bold shadow-xl h-12 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        {authMode === 'login' && 'Sign In'}
                        {authMode === 'signup' && 'Create Account'}
                        {authMode === 'forgot-password' && 'Send Reset Email'}
                        {authMode === 'reset-password' && 'Update Password'}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </div>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Navigation Links */}
              <div className="mt-8 space-y-4">
                {authMode === 'forgot-password' && (
                  <div className="text-center">
                    <button
                      onClick={() => setAuthMode('login')}
                      className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors flex items-center justify-center"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Sign In
                    </button>
                  </div>
                )}

                {(authMode === 'login' || authMode === 'signup') && (
                  <div className="text-center">
                    <button
                      onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                      className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                    >
                      {authMode === 'login'
                        ? "Don't have an account? Sign up"
                        : 'Already have an account? Sign in'
                      }
                    </button>
                  </div>
                )}
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