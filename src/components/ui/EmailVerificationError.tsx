import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { useAuth } from '../../contexts/AuthContext';
import Turnstile from 'react-turnstile';
import toast from 'react-hot-toast';

interface EmailVerificationErrorProps {
  initialEmail?: string;
  onClose?: () => void;
}

export const EmailVerificationError: React.FC<EmailVerificationErrorProps> = ({ 
  initialEmail = '', 
  onClose 
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const { resendEmailVerification } = useAuth();

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    // Check captcha unless disabled in development
    const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === 'true';
    if (!isCaptchaDisabled && !captchaToken) {
      toast.error('Please complete the CAPTCHA verification.');
      return;
    }
    
    setLoading(true);
    try {
      await resendEmailVerification(email, captchaToken);
      setSuccess(true);
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700"
      >
        <div className="flex items-start space-x-2">
          <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
              Verification email sent to <strong>{email}</strong>! Please check your inbox and click the verification link.
            </p>
            {onClose && (
              <button
                onClick={onClose}
                className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 rounded-xl border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
    >
      <div className="flex items-start space-x-2">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed mb-3">
            Your email isn't verified. Click below to resend the verification email.
          </p>
          
          <form onSubmit={handleResend} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 z-10" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-10 text-sm border-amber-300 dark:border-amber-600 focus:border-amber-500 focus:ring-amber-500 bg-white dark:bg-gray-700"
                placeholder="Enter your email address"
              />
            </div>
            
            {/* Captcha verification */}
            {import.meta.env.VITE_DISABLE_CAPTCHA !== 'true' && (
              <div className="flex justify-center py-2">
                <Turnstile
                  sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading || !email.trim() || (import.meta.env.VITE_DISABLE_CAPTCHA !== 'true' && !captchaToken)}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Resend Verification
                  </div>
                )}
              </Button>
              
              {onClose && (
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  size="sm"
                  className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}; 