import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Centralized Supabase configuration detection
export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('https://') &&
    supabaseUrl.includes('.supabase.co') &&
    supabaseAnonKey.length > 50 // Supabase keys are typically longer
  );
};

// Create Supabase client - only if configured
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Environment validation helper for debugging
export const getSupabaseConfig = () => {
  return {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlFormat: supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co'),
    keyLength: supabaseAnonKey.length,
    isConfigured: isSupabaseConfigured()
  };
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          phone: string | null;
          resume_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          phone?: string | null;
          resume_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
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
          target_count?: string | null;
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
      browser_use_logs: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          task_type: string;
          task_prompt: string | null;
          cost: number;
          status: string;
          started_at: string;
          completed_at: string | null;
          error_message: string | null;
          screenshot_url: string | null;
          metadata: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          task_type: string;
          task_prompt?: string | null;
          cost?: number;
          status?: string;
          started_at?: string;
          completed_at?: string | null;
          error_message?: string | null;
          screenshot_url?: string | null;
          metadata?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          task_type?: string;
          task_prompt?: string | null;
          cost?: number;
          status?: string;
          started_at?: string;
          completed_at?: string | null;
          error_message?: string | null;
          screenshot_url?: string | null;
          metadata?: any | null;
          created_at?: string;
        };
      };
      ai_token_usage: {
        Row: {
          id: string;
          user_id: string;
          operation_type: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          max_tokens_requested: number | null;
          model_used: string | null;
          request_data: any | null;
          response_data: any | null;
          cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          operation_type: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          max_tokens_requested?: number;
          model_used?: string;
          request_data?: any;
          response_data?: any;
          cost_usd?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          operation_type?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          max_tokens_requested?: number;
          model_used?: string;
          request_data?: any;
          response_data?: any;
          cost_usd?: number;
          created_at?: string;
        };
      };
      automation_configs: {
        Row: {
          id: string;
          user_id: string;
          config: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          config?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          config?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          icon_name: string;
          read: boolean;
          data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          icon_name?: string;
          read?: boolean;
          data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          icon_name?: string;
          read?: boolean;
          data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Helper functions for common operations
export const uploadResume = async (file: File, userId: string): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured for file uploads');
    }

    // Get current session to ensure we're authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('User not authenticated');
    }

    // Validate file type - MUST be PDF
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed. Please upload a PDF resume.');
    }

    // Additional validation: check file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (fileExt !== 'pdf') {
      throw new Error('File must have .pdf extension');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 10MB');
    }

    const fileName = `${userId}/resume.pdf`;

    // Delete existing file first (if any) to ensure clean upload
    // Using the authenticated client
    const { error: deleteError } = await supabase.storage
      .from('resumes')
      .remove([fileName]);
    
    // Ignore delete errors (file might not exist)
    if (deleteError) {
      console.log('Delete error (can be ignored if file doesn\'t exist):', deleteError);
    }

    console.log('Attempting to upload file:', fileName, 'size:', file.size);
    
    // Upload the new file with proper authentication
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        upsert: true,
        cacheControl: '3600',
      });

    console.log('Upload response:', { uploadData, uploadError });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      
      // If it's an RLS error, provide a more helpful message
      if (uploadError.message.includes('row-level security')) {
        throw new Error('Storage permissions not configured. Please contact support.');
      }
      
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    return fileName;
  } catch (error) {
    console.error('Error uploading resume:', error);
    // Return the actual error message for better debugging
    throw error;
  }
};

export const getSignedResumeUrl = async (path: string): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured for file access');
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