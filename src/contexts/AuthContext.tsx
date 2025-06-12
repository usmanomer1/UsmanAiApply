import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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

// Demo credentials for testing
const DEMO_CREDENTIALS = {
  email: 'demo@aiapply.com',
  password: 'demo123',
  fullName: 'Demo User'
};

const createDummyUser = (): User => ({
  id: 'dummy-user-id-123',
  email: DEMO_CREDENTIALS.email,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {
    full_name: DEMO_CREDENTIALS.fullName
  }
} as User);

const createDummySession = (user: User): Session => ({
  access_token: 'dummy-access-token',
  refresh_token: 'dummy-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check if user was previously logged in (localStorage)
        const savedUser = localStorage.getItem('aiapply-auth-user');
        if (savedUser && mounted) {
          const userData = JSON.parse(savedUser);
          const dummyUser = createDummyUser();
          const dummySession = createDummySession(dummyUser);
          setUser(dummyUser);
          setSession(dummySession);
          setLoading(false);
          return;
        }

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
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }

        // Listen for auth changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (mounted) {
            setSession(session);
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
        // Demo mode
        if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
          const dummyUser = createDummyUser();
          const dummySession = createDummySession(dummyUser);
          
          setUser(dummyUser);
          setSession(dummySession);
          localStorage.setItem('aiapply-auth-user', JSON.stringify(dummyUser));
          
          toast.success('Welcome back!');
        } else {
          toast.error('Invalid credentials. Use demo@aiapply.com / demo123');
          throw new Error('Invalid credentials');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast.error(error.message);
          throw error;
        }

        toast.success('Welcome back!');
      }
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
        // Demo mode - just sign them in
        const dummyUser = createDummyUser();
        const dummySession = createDummySession(dummyUser);
        
        setUser(dummyUser);
        setSession(dummySession);
        localStorage.setItem('aiapply-auth-user', JSON.stringify(dummyUser));
        
        toast.success('Account created successfully!');
      } else {
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
      }
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
      setSession(null);
      localStorage.removeItem('aiapply-auth-user');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      // Force sign out even if there's an error
      setUser(null);
      setSession(null);
      localStorage.removeItem('aiapply-auth-user');
      toast.success('Signed out successfully');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};