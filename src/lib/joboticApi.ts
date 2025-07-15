const API_BASE_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend.vercel.app';
const USE_NETLIFY_FUNCTION = !import.meta.env.VITE_JOBOTIC_API_KEY; // Use function if no VITE key

// Basic Search Request (No AI Matching)
interface JobSearchRequest {
  // Search params (choose one approach)
  query?: string;
  // OR structured search
  jobTitle?: string;
  location?: string;
  
  // Pagination
  page?: number;
  num_pages?: number;
  
  // Filters (all optional)
  date_posted?: 'all' | 'today' | '3days' | 'week' | 'month';
  remote_jobs_only?: boolean;
  employment_types?: ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[];
  job_requirements?: ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[];
}

// AI-Powered Match Request
interface JobMatchRequest {
  // Resume (required)
  resumeText: string;
  
  // Search query (choose one approach)
  query?: string;
  // OR structured search
  jobTitle?: string;
  location?: string;
  
  // Pagination for infinite scroll
  limit?: number;
  offset?: number;
  session_id?: string;
  
  // Pages to fetch from JSearch
  page?: number;
  num_pages?: number;
  
  // Filters
  date_posted?: 'all' | 'today' | '3days' | 'week' | 'month';
  remote_jobs_only?: boolean;
  employment_types?: ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[];
  job_requirements?: ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[];
  
  // AI Filtering
  min_score?: number;
  
  // Legacy preferences support
  preferences?: {
    jobTitle?: string;
    location?: string;
    keywords?: string[];
    datePosted?: string;
  };
}

// PDF Export Types
interface ExportPdfRequest {
  sessionId: string;
  htmlContent: string;
  format: 'pdf' | 'docx';
  suggestions?: {
    total: number;
    accepted: number;
    rejected: number;
    modified: number;
  };
}

interface ExportPdfResponse {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

interface JobMatchResponse {
  success: boolean;
  data: {
    jobs: Array<{
      job_id: string;
      employer_name: string;
      employer_logo?: string;
      job_title: string;
      job_description: string;
      job_apply_link: string;
      job_is_remote: boolean;
      job_city: string;
      job_state: string;
      job_country?: string;
      job_posted_at_datetime_utc: string;
      job_employment_type: string;
      job_required_skills: string[];
      job_min_salary?: number;
      job_max_salary?: number;
      match_score: number;
      match_label: string;
      match_reasons: string[];
      missing_skills: string[];
      key_strengths: string[];
      // New fields from backend update
      job_highlights?: {
        Qualifications?: string[];
        Responsibilities?: string[];
        Benefits?: string[];
      };
      job_apply_quality_score?: number;
      job_offer_expiration_timestamp?: number;
      application_deadline_days?: number;
    }>;
    totalFound: number;
    totalMatched: number;
    currentPage: number;
    totalPages: number;
    searchCriteria: {
      query: string;
      jobTitle?: string;
      location?: string;
      datePosted?: string;
      remote?: boolean;
    };
    timestamp: string;
  };
  timing?: {
    total: number;
    search: number;
    matching: string;
    fromCache: boolean;
  };
}

// OLD RESUME INTERFACES - REMOVED
// All old resume analysis, optimization, and download interfaces have been removed

class JoboticApiService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_JOBOTIC_API_KEY || '';
    if (!this.apiKey && !USE_NETLIFY_FUNCTION) {
      console.warn('VITE_JOBOTIC_API_KEY not found and Netlify function not available');
    }
  }

  private async makeRequest<T>(endpoint: string, data: any, options: { method?: string; requiresAuth?: boolean } = {}): Promise<T> {
    const isNetlifyFunction = USE_NETLIFY_FUNCTION;
    const url = isNetlifyFunction ? '/.netlify/functions/jobotic-api' : `${API_BASE_URL}${endpoint}`;
    
    // Only log in development
    if (import.meta.env.DEV) {
      console.log(`Making request to: ${url}`);
    }
    
    const requestBody = isNetlifyFunction 
      ? { endpoint, ...data }
      : data;
    
    // Build headers based on endpoint requirements
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (!isNetlifyFunction) {
      // Always add X-API-Key for direct API calls
      headers['X-API-Key'] = this.apiKey;
    }
    
    // Add Bearer token for endpoints that require authentication
    // This works for both Netlify function and direct API calls
    if (options.requiresAuth) {
      const { supabase } = await import('./supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        console.warn('No session token available - user may not be logged in');
      }
    }
    
    
    const response = await fetch(url, {
      method: options.method || 'POST',
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    // Extract request ID for debugging
    const requestId = response.headers.get('X-Request-ID');
    
    if (!response.ok) {
      let errorDetail = '';
      let errorJson = null;
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const error = new Error(`Rate limit exceeded. Please try again in ${retryAfter || '60'} seconds.`);
        (error as any).status = 429;
        (error as any).retryAfter = retryAfter;
        (error as any).requestId = requestId;
        throw error;
      }
      
      try {
        const errorBody = await response.text();
        errorDetail = ` - ${errorBody}`;
        // Try to parse as JSON for better error messages
        try {
          errorJson = JSON.parse(errorBody);
          if (errorJson.error) {
            errorDetail = ` - ${errorJson.error}`;
          }
        } catch (jsonError) {
          // Not JSON, use raw text
        }
      } catch (e) {
        // Ignore if we can't read the error body
      }
      
      console.error(`API Error: ${response.status} on ${endpoint}${errorDetail}`);
      
      const error = new Error(`API request failed: ${response.status}${errorDetail}`);
      (error as any).status = response.status;
      (error as any).details = errorJson;
      (error as any).requestId = requestId;
      throw error;
    }

    const responseData = await response.json();
    // Attach request ID to successful responses too
    if (requestId && typeof responseData === 'object') {
      (responseData as any).__requestId = requestId;
    }
    return responseData;
  }

  // AI-powered job matching - requires both Bearer token and X-API-Key
  async searchJobs(request: JobMatchRequest): Promise<JobMatchResponse> {
    return this.makeRequest<JobMatchResponse>('/api/jobs/match', request, { requiresAuth: true });
  }
  
  // Basic job search - only requires X-API-Key
  async searchJobsBasic(request: JobSearchRequest): Promise<JobMatchResponse> {
    return this.makeRequest<JobMatchResponse>('/api/jobs/search', request, { requiresAuth: false });
  }
  
  // Get job details - only requires X-API-Key
  async getJobDetails(jobId: string): Promise<any> {
    const isNetlifyFunction = USE_NETLIFY_FUNCTION;
    if (isNetlifyFunction) {
      // For Netlify function with GET method, we need to pass endpoint as query param
      const url = `/.netlify/functions/jobotic-api?endpoint=/api/jobs/${jobId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = new Error(`API request failed: ${response.status}`);
        (error as any).status = response.status;
        throw error;
      }
      
      return response.json();
    } else {
      return this.makeRequest<any>(`/api/jobs/${jobId}`, null, { method: 'GET', requiresAuth: false });
    }
  }
  
  // Get salary estimate - only requires X-API-Key
  async getSalaryEstimate(request: { jobTitle: string; location: string }): Promise<any> {
    return this.makeRequest<any>('/api/jobs/salary-estimate', request, { requiresAuth: false });
  }

  // New PDF Export method
  async exportPdf(request: ExportPdfRequest): Promise<ExportPdfResponse> {
    // Add timeout handling for large exports
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = '';
        let errorJson = null;
        try {
          const errorBody = await response.text();
          errorDetail = ` - ${errorBody}`;
          try {
            errorJson = JSON.parse(errorBody);
            if (errorJson.error) {
              errorDetail = ` - ${errorJson.error}`;
            }
          } catch (jsonError) {
            // Not JSON, use raw text
          }
        } catch (e) {
          // Ignore if we can't read the error body
        }
        
        // Handle specific error cases
        if (response.status === 413) {
          throw new Error('File too large. Please reduce the content size.');
        } else if (response.status === 408) {
          throw new Error('Export timeout. Please try again.');
        }
        
        const error = new Error(`Export failed: ${response.status}${errorDetail}`);
        (error as any).status = response.status;
        (error as any).details = errorJson;
        throw error;
      }

      const result = await response.json();
      
      // Validate response
      if (!result.success || !result.downloadUrl) {
        throw new Error('Invalid export response from server');
      }

      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Export timeout. The file may be too large.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // OLD RESUME ENDPOINTS - TO BE REMOVED
  /*
  async analyzeResume(request: ResumeAnalyzeRequest): Promise<ResumeAnalyzeResponse> {
    return this.makeRequest<ResumeAnalyzeResponse>('/api/resume/analyze', request);
  }

  async optimizeResume(request: ResumeOptimizeRequest): Promise<ResumeOptimizeResponse> {
    return this.makeRequest<ResumeOptimizeResponse>('/api/resume/optimize', request);
  }
  */

  // OLD DOWNLOAD METHODS - TO BE REMOVED
  /*
  async downloadResume(request: ResumeDownloadRequest): Promise<{ 
    fileId: string; 
    filename: string; 
    downloadUrl: string; 
    previewUrl: string;
  }> {
    // console.log('Download request:', request);
    
    const response = await fetch(`${API_BASE_URL}/api/download/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorBody = await response.text();
        errorDetail = ` - ${errorBody}`;
      } catch (e) {
        // Ignore if we can't read the error body
      }
      throw new Error(`API request failed: ${response.status}${errorDetail}`);
    }

    const result = await response.json();
    // console.log('Download API result:', result);
    
    return {
      fileId: result.data.fileId,
      filename: result.data.filename,
      downloadUrl: `${API_BASE_URL}${result.data.downloadUrl}`,
      previewUrl: `${API_BASE_URL}/api/download/preview/${result.data.fileId}`
    };
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/download/${fileId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  }
  */

  // OLD FORMAT-PRESERVING ENDPOINTS - TO BE REMOVED
  /*
  async processResumeFormatPreserving(request: { 
    resumeText: string; 
    jobDescription?: string; 
    userId: string 
  }): Promise<{
    success: boolean;
    data: {
      sessionId: string;
      pdfUrl: string;
      editableContent: {
        editableElements: Array<{
          id: string;
          type: 'bullet' | 'description' | 'text';
          content: string;
          startPos: number;
          endPos: number;
          metadata?: any;
        }>;
      };
    };
  }> {
    return this.makeRequest('/api/format-preserving/process', request);
  }

  async updateResumeFormatPreserving(request: {
    sessionId: string;
    updates: Array<{
      startPos: number;
      endPos: number;
      newContent: string;
    }>;
  }): Promise<{
    success: boolean;
    data: {
      pdfUrl: string;
      message: string;
    };
  }> {
    return this.makeRequest('/api/format-preserving/update', request);
  }
  */
}

export const joboticApi = new JoboticApiService();
export type { JobSearchRequest, JobMatchRequest, JobMatchResponse, ExportPdfRequest, ExportPdfResponse };