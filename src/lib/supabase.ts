import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Enhanced Supabase configuration detection for Bolt.new integration
const isSupabaseConfigured = () => {
  // Debug logging to see what we're getting
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key length:', supabaseAnonKey.length);
  console.log('URL starts with https:', supabaseUrl.startsWith('https://'));
  console.log('URL includes supabase.co:', supabaseUrl.includes('.supabase.co'));
  
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('https://') &&
    supabaseUrl.includes('.supabase.co') &&
    supabaseAnonKey.length > 50 && // Supabase keys are typically longer
    supabaseUrl !== 'your_supabase_url_here' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here'
  );
};

// Log configuration status
console.log('Supabase configured:', isSupabaseConfigured());

// Create Supabase client - it should work with Bolt's connection
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone: string | null;
          resume_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          phone?: string | null;
          resume_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          phone?: string | null;
          resume_url?: string | null;
          created_at?: string;
        };
      };
      job_campaigns: {
        Row: {
          id: string;
          profile_id: string;
          job_title: string;
          location: string | null;
          job_type: string | null;
          work_type: string | null;
          experience_level: string | null;
          target_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          job_title: string;
          location?: string | null;
          job_type?: string | null;
          work_type?: string | null;
          experience_level?: string | null;
          target_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          job_title?: string;
          location?: string | null;
          job_type?: string | null;
          work_type?: string | null;
          experience_level?: string | null;
          target_count?: number | null;
          created_at?: string;
        };
      };
      applications: {
        Row: {
          id: string;
          campaign_id: string;
          company: string | null;
          role: string | null;
          applied_at: string | null;
          status: string | null;
          details: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          company?: string | null;
          role?: string | null;
          applied_at?: string | null;
          status?: string | null;
          details?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          company?: string | null;
          role?: string | null;
          applied_at?: string | null;
          status?: string | null;
          details?: any | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          stripe_subscription_id: string;
          status: string;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan: string;
          stripe_subscription_id: string;
          status: string;
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: string;
          stripe_subscription_id?: string;
          status?: string;
          current_period_end?: string | null;
          created_at?: string;
        };
      };
      usage_logs: {
        Row: {
          id: string;
          subscription_id: string;
          campaign_id: string;
          browser_use_steps: number;
          cost_usd: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          campaign_id: string;
          browser_use_steps: number;
          cost_usd: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          campaign_id?: string;
          browser_use_steps?: number;
          cost_usd?: number;
          recorded_at?: string;
        };
      };
    };
  };
};

// Helper functions for common operations
export const uploadResume = async (file: File, userId: string): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      console.log('Demo mode: Resume upload simulated');
      return 'demo-resume.pdf';
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/resume.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    return fileName;
  } catch (error) {
    console.error('Error uploading resume:', error);
    return null;
  }
};

export const getSignedResumeUrl = async (path: string): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      return 'https://demo.example.com/resume.pdf';
    }

    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
};

// Export configuration check
export { isSupabaseConfigured };