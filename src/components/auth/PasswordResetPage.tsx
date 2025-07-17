import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Check for recovery token on mount
  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        // Get the hash from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (type === 'recovery' && accessToken) {
          setHasRecoveryToken(true);
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // Check if user has a valid session (from magic link)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setHasRecoveryToken(true);
          } else {
            setMessage({ 
              type: 'error', 
              text: 'Invalid or expired reset link. Please request a new password reset.' 
            });
          }
        }
      } catch (error) {
        console.error('Error checking recovery token:', error);
        setMessage({ 
          type: 'error', 
          text: 'An error occurred. Please try requesting a new password reset.' 
        });
      } finally {
        setCheckingToken(false);
      }
    };

    checkRecoveryToken();
  }, []);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setMessage({ type: 'error', text: passwordError });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      setMessage({ 
        type: 'success', 
        text: 'Password updated successfully! Redirecting to login...' 
      });
      
      // Sign out to ensure clean state
      await supabase.auth.signOut();
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (error: any) {
      console.error('Password update error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to update password. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

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
            Reset Your Password
          </h1>
          <p className="text-sm text-[#71717a]">
            Enter your new password below
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-3 rounded-md text-sm flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {hasRecoveryToken ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-[#18181b] mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-10 px-3.5 pr-10 text-sm border border-[#e4e4e7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:border-transparent"
                  placeholder="Enter new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#18181b]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-[#18181b] mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full h-10 px-3.5 pr-10 text-sm border border-[#e4e4e7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:border-transparent"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#18181b]"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-2">Password must contain:</p>
              <ul className="space-y-1">
                <li className={formData.password.length >= 8 ? 'text-green-600' : ''}>
                  • At least 8 characters
                </li>
                <li className={/(?=.*[a-z])/.test(formData.password) ? 'text-green-600' : ''}>
                  • One lowercase letter
                </li>
                <li className={/(?=.*[A-Z])/.test(formData.password) ? 'text-green-600' : ''}>
                  • One uppercase letter
                </li>
                <li className={/(?=.*\d)/.test(formData.password) ? 'text-green-600' : ''}>
                  • One number
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 px-4 bg-[#18181b] text-white text-sm font-medium rounded-md hover:bg-[#27272a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </div>
              ) : (
                'Update Password'
              )}
            </button>

            {/* Back to Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/auth')}
                disabled={loading}
                className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        )}
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

export default PasswordResetPage;