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

// Browser compatibility detection for WebSocket/Realtime features
export const isRealtimeSupported = (): boolean => {
  try {
    // Check if WebSocket is available
    if (typeof WebSocket === 'undefined') {
      return false;
    }

    // Safari 15.6.1 specific detection and security check
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Safari/') && userAgent.includes('Version/15.6.1')) {
      console.warn('Safari 15.6.1 detected - Realtime features may be limited due to WebSocket security policies');
      return false;
    }

    // Additional WebSocket security check
    try {
      // Attempt to create a test WebSocket connection (but don't actually connect)
      const testWs = new WebSocket('wss://echo.websocket.org');
      testWs.close();
      return true;
    } catch (error) {
      console.warn('WebSocket creation failed:', error);
      return false;
    }
  } catch (error) {
    console.warn('WebSocket compatibility check failed:', error);
    return false;
  }
};

// Create Supabase client with fallback configuration for browser compatibility
const createSupabaseClient = () => {
  const options: any = {};
  
  // Disable realtime for incompatible browsers
  if (!isRealtimeSupported()) {
    console.warn('Realtime features disabled due to browser compatibility issues');
    options.realtime = {
      params: {
        // Disable all realtime features
        eventsPerSecond: 0,
      }
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, options);
};

// Create Supabase client - only if configured
export const supabase = createSupabaseClient();

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
          avatar_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          phone?: string | null;
          resume_url?: string | null;
          avatar_url?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          phone?: string | null;
          resume_url?: string | null;
          avatar_url?: string;
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

// Avatar generation helper
export const generateAvatarUrl = (userId: string): string => {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${userId}`;
};

// Helper to upload avatar to Supabase Storage
export const uploadAvatar = async (userId: string, file: File): Promise<string | null> => {
  try {
    console.log('Starting avatar upload for user:', userId);
    console.log('File details:', { name: file.name, size: file.size, type: file.type });
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    
    // Try simpler path first (more likely to work with policies)
    const simplePath = `${userId}-${Date.now()}.${fileExt}`;
    
    console.log('Attempting upload with path:', simplePath);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(simplePath, file, {
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Primary upload failed:', uploadError);
      console.error('Error details:', {
        message: uploadError.message,
        name: uploadError.name,
        cause: uploadError.cause
      });
      
      // Try with folder structure as fallback
      const folderPath = `${userId}/${fileName}`;
      console.log('Trying fallback with folder path:', folderPath);
      
      const { error: fallbackError } = await supabase.storage
        .from('avatars')
        .upload(folderPath, file, {
          upsert: true,
          cacheControl: '3600'
        });
      
      if (fallbackError) {
        console.error('Fallback upload also failed:', fallbackError);
        console.error('Fallback error details:', {
          message: fallbackError.message,
          name: fallbackError.name,
          cause: fallbackError.cause
        });
        return null;
      }

      console.log('Fallback upload successful');
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(folderPath);
      
      console.log('Generated public URL:', publicUrl);
      return publicUrl;
    }

    console.log('Primary upload successful');
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(simplePath);

    console.log('Generated public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Unexpected error in uploadAvatar:', error);
    return null;
  }
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
      // console.log('Delete error (can be ignored if file doesn\'t exist):', deleteError);
    }

    // console.log('Attempting to upload file:', fileName, 'size:', file.size);
    
    // Upload the new file with proper authentication
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        upsert: true,
        cacheControl: '3600',
      });

    // console.log('Upload response:', { uploadError });

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