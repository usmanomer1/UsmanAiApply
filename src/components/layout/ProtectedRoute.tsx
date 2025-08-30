import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Onboarding from '../onboarding/Onboarding';
import { useMobileDetection } from '../../hooks/useMobileDetection';
import { MobileRedirect } from '../MobileRedirect';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const isMobile = useMobileDetection();

  // Check if Supabase is configured
  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  // Check onboarding status
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.id || !isSupabaseConfigured()) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        const data = profiles?.[0] || null;

        if (error) {
          console.error('Error checking onboarding status:', error);
          // If profile doesn't exist or error, assume onboarding not completed
          setOnboardingCompleted(false);
        } else {
          setOnboardingCompleted(data?.onboarding_completed || false);
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setOnboardingCompleted(false);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (user) {
      checkOnboardingStatus();
    } else {
      setCheckingOnboarding(false);
    }
  }, [user]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 md:p-10 text-center w-[90%] max-w-sm"
        >
          <motion.div
            className="w-12 h-12 border-4 border-gray-200 border-t-[#23a972] rounded-full mx-auto mb-5"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Loading</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Getting your dashboard ready…</p>
          {!isSupabaseConfigured() && (
            <div className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Database not configured
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // If Supabase is not configured, allow access (demo mode)
  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

  // If Supabase is configured but no user, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user hasn't completed onboarding, show onboarding flow
  if (onboardingCompleted === false) {
    return <Onboarding onComplete={() => setOnboardingCompleted(true)} />;
  }

  // Check if user is on mobile after authentication and onboarding
  if (isMobile) {
    return <MobileRedirect />;
  }

  return <>{children}</>;
};