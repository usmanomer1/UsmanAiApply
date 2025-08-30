import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMaintenanceConfig, canAccessDuringMaintenance } from '../../lib/maintenance';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getSubscriptionProducts } from '../../stripe-config';
import toast from 'react-hot-toast';
import Turnstile from 'react-turnstile';
import { EmailVerificationError } from '../ui/EmailVerificationError';
import { track } from '../../lib/analytics';

type AuthMode = 'login' | 'signup' | 'forgot-password';
type AuthStep = 'email' | 'password';

export const CustomAuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authStep, setAuthStep] = useState<AuthStep>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailVerificationError, setEmailVerificationError] = useState<{ email: string } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    avatar_url: '',
  });
  const [captchaToken, setCaptchaToken] = useState("");

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const planParam = searchParams.get('plan');
  const { isMaintenanceMode, maintenanceMessage } = getMaintenanceConfig();

  // Redirect logic after successful authentication
  const handleAuthSuccess = async () => {
    if (!planParam) {
      navigate('/dashboard');
      return;
    }

    // Find the product that matches the plan name
    const subscriptionProducts = getSubscriptionProducts();
    const targetProduct = subscriptionProducts.find(product => 
      product.name.toLowerCase() === planParam.toLowerCase()
    );

    if (!targetProduct) {
      toast.error(`Plan "${planParam}" not found. Redirecting to dashboard.`);
      navigate('/dashboard');
      return;
    }

    // Only proceed with Stripe checkout if Supabase is configured
    if (!isSupabaseConfigured()) {
      toast.error('Service configuration error. Please contact support.');
      navigate('/dashboard');
      return;
    }

    // Redirect to Stripe Checkout for the specified plan
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          price_id: targetProduct.priceId,
          mode: targetProduct.mode,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&price_id=${targetProduct.priceId}&type=${targetProduct.category}`,
          cancel_url: `${window.location.origin}/billing?canceled=true`,
        }
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        toast.error('Failed to create checkout session. Redirecting to billing page.');
        navigate('/billing');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('No checkout URL received. Redirecting to billing page.');
        navigate('/billing');
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
      toast.error('Failed to initiate checkout. Redirecting to billing page.');
      navigate('/billing');
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      handleAuthSuccess();
    }
  }, [user]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;
    
    // For login, try to fetch the user's profile to get their avatar
    if (authMode === 'login') {
      try {
        // Try to fetch profile by email
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('email', formData.email)
          .maybeSingle();
        
        if (profile?.avatar_url) {
          setFormData(prev => ({ ...prev, avatar_url: profile.avatar_url }));
        } else {
          // If no profile found by email, generate a deterministic avatar based on email
          // This ensures consistent avatars even before login
          const emailHash = formData.email.toLowerCase().trim();
          const generatedAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${emailHash}`;
          setFormData(prev => ({ ...prev, avatar_url: generatedAvatar }));
        }
      } catch (error) {
        // Generate avatar as fallback
        const emailHash = formData.email.toLowerCase().trim();
        const generatedAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${emailHash}`;
        setFormData(prev => ({ ...prev, avatar_url: generatedAvatar }));
      }
      setAuthStep('password');
    } else {
      // For signup, also proceed to password step
      setAuthStep('password');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setEmailVerificationError(null);
    
    const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === 'true';
    
    if (!isCaptchaDisabled && !captchaToken) {
      setMessage({ type: 'error', text: 'Please complete the CAPTCHA.' });
      return;
    }
    
    if (!isSupabaseConfigured()) {
      setMessage({ type: 'error', text: 'Authentication service is not configured. Please contact support.' });
      return;
    }
    
    if (!canAccessDuringMaintenance(formData.email)) {
      setMessage({ type: 'error', text: maintenanceMessage });
      return;
    }

    setLoading(true);

    try {
      const finalCaptchaToken = isCaptchaDisabled ? 'dev-bypass' : captchaToken;
      
      if (authMode === 'login') {
        track('AUTH_SUBMIT_CLICKED', { mode: 'login' });
        await signIn(formData.email, formData.password, finalCaptchaToken);
        navigate(planParam ? '/billing' : '/dashboard');
      } else if (authMode === 'signup') {
        if (isMaintenanceMode) {
          setMessage({ type: 'error', text: 'New registrations are temporarily disabled during maintenance.' });
          return;
        }
        track('AUTH_SUBMIT_CLICKED', { mode: 'signup' });
        await signUp(formData.email, formData.password, formData.fullName, finalCaptchaToken);
        setMessage({ 
          type: 'success', 
          text: 'Account created! Please check your email to verify your account, then sign in.' 
        });
        setAuthMode('login');
        setAuthStep('email');
      } else if (authMode === 'forgot-password') {
        // Handle forgot password with captcha validation
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken: finalCaptchaToken,
        });
        
        if (error) {
          console.error('Password reset error:', error);
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({ 
            type: 'success', 
            text: 'Password reset email sent! Check your inbox (and spam folder).' 
          });
          // Reset back to login mode
          setAuthMode('login');
          setAuthStep('email');
          setCaptchaToken('');
        }
      }
    } catch (error: any) {
      if (error.message === 'email_not_verified') {
        setEmailVerificationError({ email: error.email });
      } else {
        setMessage({ type: 'error', text: error.message || 'An error occurred' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Switch to forgot password mode - requires captcha in the main form flow
    setAuthMode('forgot-password');
    // Stay on password step to show captcha
    if (authStep === 'email') {
      setAuthStep('password');
    }
  };
  

  const getFormTitle = () => {
    if (authMode === 'signup') return 'Create your account';
    if (authMode === 'forgot-password') return 'Reset your password';
    return 'Sign in to Jobotic';
  };

  const getFormSubtitle = () => {
    if (authMode === 'signup') return 'Start your journey with AI-powered job search';
    if (authMode === 'forgot-password') return 'We\'ll send you a reset link to your email';
    return 'Welcome back! Please sign in to continue.';
  };

  const getInitial = (email: string) => {
    return email ? email[0].toUpperCase() : 'U';
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      track('AUTH_GOOGLE_SIGN_IN_CLICKED');
      // Determine redirect URL based on plan parameter
      const redirectUrl = planParam 
        ? `${window.location.origin}/auth?plan=${planParam}`
        : `${window.location.origin}/dashboard`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google sign-in error:', error);
        setMessage({ type: 'error', text: 'Failed to sign in with Google. Please try again.' });
      }
    } catch (error) {
      console.error('Unexpected error during Google sign-in:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif' }}>
      <div className="w-full max-w-[400px] animate-fadeIn">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img
              src="/images/logos/jobotic-logo.png"
              alt="Jobotic"
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-semibold text-[#18181b]">Jobotic</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#18181b] mb-2">
            {getFormTitle()}
          </h1>
          <p className="text-sm text-[#71717a]">
            {getFormSubtitle()}
          </p>
        </div>

        {/* Error Messages */}
        {emailVerificationError && (
          <EmailVerificationError
            initialEmail={emailVerificationError.email}
            onClose={() => setEmailVerificationError(null)}
          />
        )}
        {message && !emailVerificationError && (
          <div className={`mb-6 p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Auth Form */}
        {authStep === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-10 px-4 bg-white border border-[#e4e4e7] text-[#18181b] text-sm font-medium rounded-md hover:bg-[#f4f4f5] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Google Logo SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{authMode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e4e4e7]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-[#71717a]">or</span>
              </div>
            </div>

            {/* Name field for signup */}
            {authMode === 'signup' && (
              <div>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm border border-[#e4e4e7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:border-transparent"
                  placeholder="Full name"
                />
              </div>
            )}

            {/* Email Input */}
            <div>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-10 px-3.5 text-sm border border-[#e4e4e7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:border-transparent"
                placeholder="Email address"
                autoFocus
              />
            </div>

            {/* Continue Button */}
            <button
              type="submit"
              className="w-full h-10 px-4 bg-[#18181b] text-white text-sm font-medium rounded-md hover:bg-[#27272a] transition-colors"
            >
              Continue
            </button>

            {/* Toggle Mode */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setFormData({ ...formData, fullName: '', password: '', avatar_url: '' });
                }}
                className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
              >
                {authMode === 'login'
                  ? "No account? Sign up"
                  : 'Have an account? Sign in'
                }
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Back Link */}
            <button
              type="button"
              onClick={() => {
                setAuthStep('email');
                setFormData({ ...formData, password: '', avatar_url: '' });
                setCaptchaToken('');
                // Reset to login mode if we were in forgot-password mode
                if (authMode === 'forgot-password') {
                  setAuthMode('login');
                }
              }}
              className="flex items-center gap-1 text-sm text-[#71717a] hover:text-[#18181b] transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* User Card */}
            <div className="bg-[#f4f4f5] rounded-md p-4 flex items-center gap-3 mb-6">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt="User avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-[#e4e4e7] rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-[#18181b]">
                    {getInitial(formData.email)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-[#18181b]">{formData.email}</p>
              </div>
            </div>

            {/* Password Input - only show for login/signup */}
            {authMode !== 'forgot-password' && (
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-10 px-3.5 pr-10 text-sm border border-[#e4e4e7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:border-transparent"
                  placeholder="Password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#18181b]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Forgot Password - only show for login mode */}
            {authMode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Captcha */}
            {import.meta.env.VITE_DISABLE_CAPTCHA !== 'true' && (
              <div className="flex justify-center py-2">
                <Turnstile
                  key={`${authMode}-${authStep}`} // Force re-render when switching modes or steps
                  sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 px-4 bg-[#18181b] text-white text-sm font-medium rounded-md hover:bg-[#27272a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                authMode === 'login' ? 'Continue' : 
                authMode === 'signup' ? 'Create account' : 
                'Send reset email'
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[#71717a]">
            By continuing, you agree to Jobotic's{' '}
            <a
              href="https://www.jobotic.ai/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#18181b]"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://www.jobotic.ai/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#18181b]"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CustomAuthPage;