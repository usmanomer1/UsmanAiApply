import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getMaintenanceConfig, isAdminEmail } from '../lib/maintenance';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        if (!isSupabaseConfigured()) {
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (mounted) {
            setUser(session?.user ?? null);
            setLoading(false);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Add a timeout to ensure loading doesn't hang
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        toast.error('Authentication service not configured. Please check your environment variables.');
        throw new Error('Supabase not configured');
      }

      // Check maintenance mode
      const { isMaintenanceMode, maintenanceMessage } = getMaintenanceConfig();
      if (isMaintenanceMode && !isAdminEmail(email)) {
        toast.error(maintenanceMessage);
        throw new Error('Maintenance mode');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success('Welcome back!');
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        toast.error('Authentication service not configured. Please check your environment variables.');
        throw new Error('Supabase not configured');
      }

      // Check maintenance mode for new registrations
      const { isMaintenanceMode, maintenanceMessage } = getMaintenanceConfig();
      if (isMaintenanceMode) {
        toast.error(maintenanceMessage);
        throw new Error('Maintenance mode');
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success('Account created successfully! Please check your email to verify your account.');
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          toast.error(error.message);
          throw error;
        }
      }

      setUser(null);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      // Force sign out even if there's an error
      setUser(null);
      toast.success('Signed out successfully');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};