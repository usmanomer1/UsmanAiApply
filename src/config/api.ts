// API Configuration
// This file centralizes all API endpoints and configurations

export const API_CONFIG = {
  // Jobotic Backend API - For Job Search
  JOBOTIC: {
    BASE_URL: import.meta.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend.vercel.app',
    API_KEY: import.meta.env.VITE_JOBOTIC_API_KEY || '',
    ENDPOINTS: {
      // Job Search & Matching
      JOB_MATCH: '/api/jobs/match',
    }
  },
  
  // Resume Optimizer API - For Resume Services
  RESUME_OPTIMIZER: {
    BASE_URL: import.meta.env.VITE_RESUME_API_URL || 'https://terrific-imagination-production-6ca9.up.railway.app',
    API_KEY: import.meta.env.VITE_RESUME_API_KEY || '',
    ENDPOINTS: {
      // Resume Analysis & Optimization
      RESUME_ANALYZE: '/api/resume/analyze',
      RESUME_GENERATE: '/api/resume/generate',
      RESUME_DOWNLOAD: '/api/resume/download',
      
      // Resume Editor
      RESUME_PARSE_FOR_EDIT: '/api/resume-editor/parse-for-edit',
      RESUME_UPDATE_SECTION: '/api/resume-editor/update-section',
      RESUME_ADD_SECTION: '/api/resume-editor/add-section',
      RESUME_REMOVE_SECTION: '/api/resume-editor/remove-section',
      RESUME_REORDER_SECTIONS: '/api/resume-editor/reorder-sections',
      RESUME_DOWNLOAD_WORD: '/api/resume-editor/download-word',
      RESUME_RE_ANALYZE: '/api/resume-editor/re-analyze',
      RESUME_GET: '/api/resume-editor/get-resume',
    }
  },
  
  // Supabase Configuration
  SUPABASE: {
    URL: import.meta.env.VITE_SUPABASE_URL,
    ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  
  // Adobe PDF Configuration
  ADOBE: {
    CLIENT_ID: import.meta.env.VITE_ADOBE_CLIENT_ID || 'a9b3f5416abe4b3794a690feb8873adc',
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (baseUrl: string, endpoint: string): string => {
  return `${baseUrl}${endpoint}`;
};

// Environment checks
export const isProduction = import.meta.env.PROD;
export const isDevelopment = import.meta.env.DEV;

// Feature flags from environment
export const FEATURES = {
  DISABLE_CAPTCHA: import.meta.env.VITE_DISABLE_CAPTCHA === 'true',
  ENABLE_EXTERNAL_APPLICATIONS: import.meta.env.VITE_ENABLE_EXTERNAL_APPLICATIONS === 'true',
};