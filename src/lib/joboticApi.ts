const API_BASE_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend.vercel.app';
// Always call backend directly; Netlify proxy disabled
const USE_NETLIFY_FUNCTION = false;

// Streaming message types
export type StreamMessageType = 'initial' | 'jobs' | 'progress' | 'complete' | 'error' | 'keepalive';

export interface StreamCallbacks {
  initial?: (data: {
    totalFound: number;
    searchCriteria: any;
  }) => void;
  jobs?: (data: {
    jobs: any[];
    batchNumber: number;
    totalBatches: number;
  }) => void;
  progress?: (data: {
    processed: number;
    total: number;
    percentage: number;
  }) => void;
  complete?: (data: {
    totalProcessed: number;
    usage: any;
    timing: any;
  }) => void;
  error?: (data: {
    message: string;
    batchNumber?: number;
  }) => void;
  keepalive?: (data: {
    timestamp: number;
  }) => void;
}

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
  
  // Pagination
  page?: number;
  num_pages?: number;
  
  // Session tracking
  session_id?: string;
  offset?: number;
  
  // Filters
  date_posted?: 'all' | 'today' | '3days' | 'week' | 'month';
  remote_jobs_only?: boolean;
  employment_types?: ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[];
  job_requirements?: ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[];
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
      job_apply_is_direct?: boolean;
      // Salary estimate when available
      salary_estimate?: {
        min: number;
        max: number;
        median: number;
      };
      // Additional fields
      job_highlights?: {
        Qualifications?: string[];
        Responsibilities?: string[];
        Benefits?: string[];
      };
      job_apply_quality_score?: number;
      job_offer_expiration_timestamp?: number;
      application_deadline_days?: number;
    }>;
    // Updated pagination info per new API
    totalFound: number;
    jobsReturned: number;
    currentPage: number;
    pagesReturned: number;
    totalPages: number;
    hasMore: boolean;
    jobsPerPage: number;
    // Search criteria echo
    searchCriteria: {
      query?: string;
      jobTitle?: string;
      location?: string;
      datePosted?: string;
      remote?: boolean;
      employmentTypes?: string[];
    };
  };
  // Enhanced usage tracking
  usage?: {
    // API usage
    credits_used: number;
    pages_fetched: number;
    jobs_processed: number;
    ai_batches: number;
    // User limits
    plan: string;
    monthly_limit: number;
    monthly_used: number;
    remaining: number | 'unlimited';
  };
  session_id?: string;
  timing?: {
    total: number;
    search: number;
    matching: string;
    fromCache: boolean;
  };
}

// Job Usage Response Interface
interface JobUsageResponse {
  success: boolean;
  data: {
    currentMonth: {
      month: string;
      totalJobsViewed: number;
      searchSessions: number;
      totalRequests: number;
      remaining: number | 'unlimited';
      percentUsed: number;
      lastSearchAt: string | null;
    };
    plan: {
      name: string;
      priceId: string;
      limit: number;
      isUnlimited: boolean;
      isActive: boolean;
    };
    history: Array<{
      month: string;
      totalJobsViewed: number;
      searchSessions: number;
    }>;
    recentSearches: Array<{
      query: string;
      jobsViewed: number;
      searchedAt: string;
    }>;
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
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Only log in development
    if (import.meta.env.DEV) {
      console.log(`Making request to: ${url}`);
    }
    
    const requestBody = data;
    
    // Build headers based on endpoint requirements
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Supabase bearer only; no API key
    
    // Add Bearer token for endpoints that require authentication
    // This works for both Netlify function and direct API calls
    if (options.requiresAuth) {
      const { supabase } = await import('./supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session for API request:', sessionError);
        const error = new Error('Failed to get authentication session');
        (error as any).status = 401;
        throw error;
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        console.log(`Auth token present for ${endpoint}`);
      } else {
        console.warn('No session token available - user may not be logged in');
        const error = new Error('Authentication required for this request');
        (error as any).status = 401;
        throw error;
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

  // Progressive job matching (v2) - session-based, cursor pagination
  async searchJobsProgressive(request: {
    resumeText: string;
    query: string;
    location?: string;
    limit?: number;
    sessionId?: string;
    cursor?: string;
  }): Promise<{
    success: boolean;
    jobs: any[];
    total?: number;
    sessionId: string;
    hasMore?: boolean;
    isDone?: boolean;
    cursor?: string | null;
  }> {
    return this.makeRequest('/api/v2/jobs/match', request, { requiresAuth: true });
  }

  // Fetch additional jobs for an existing progressive session (cursor-based)
  async getSessionJobs(sessionId: string, params: { limit?: number; cursor?: string | null }): Promise<{
    success: boolean;
    jobs: any[];
    cursor?: string | null;
    isDone?: boolean;
    total?: number;
    sessionId?: string;
  }> {
    // Continuation uses the same POST /api/v2/jobs/match with sessionId + cursor
    const body: any = {
      sessionId,
      limit: params.limit ?? 10,
    };
    if (params.cursor) body.cursor = params.cursor;
    return this.makeRequest('/api/v2/jobs/match', body, { requiresAuth: true });
  }

  // Streaming version of searchJobs
  async searchJobsStreaming(
    request: JobMatchRequest, 
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const url = `${API_BASE_URL}/api/jobs/match`;
    
    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson', // Request streaming response
    };
    
    // Supabase bearer only; no API key
    
    // Add Bearer token
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      throw new Error('No session token available - user must be logged in');
    }
    
    const requestBody = request;
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
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

    // Check headers to determine response type
    const contentType = response.headers.get('content-type');
    const streamFormat = response.headers.get('x-stream-format');
    const responseType = response.headers.get('x-response-type');
    const isNDJSONResponse = contentType?.includes('application/x-ndjson') || streamFormat === 'ndjson';
    
    // Enhanced debugging
    console.log('Response headers:', {
      contentType,
      streamFormat,
      responseType,
      allHeaders: [...response.headers.entries()]
    });
    
    // Read response body once
    const responseText = await response.text();
    console.log('Response preview (first 200 chars):', responseText.substring(0, 200));
    
    // Try to detect NDJSON format from content if headers don't indicate it
    const looksLikeNDJSON = responseText.includes('\n') && responseText.trim().split('\n').length > 1 && 
                           responseText.trim().split('\n')[0].includes('"type"');
    
    if (isNDJSONResponse || looksLikeNDJSON) {
      // Process as NDJSON
      console.log('Processing NDJSON response');
      const lines = responseText.trim().split('\n');
      console.log(`Processing ${lines.length} NDJSON lines`);
      
      // Process lines with small delays for visual streaming effect
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            console.log('Received message:', message.type, 'with data keys:', Object.keys(message.data || {}));
            
            // Validate message structure
            if (message.type && message.data) {
              // Handle keepalive messages
              if (message.type === 'keepalive') {
                console.log('Keepalive received at:', new Date(message.data.timestamp * 1000));
                callbacks.keepalive?.(message.data);
                continue; // Skip delay for keepalive
              }
              
              // Process other message types
              const anyCallbacks = callbacks as unknown as Record<string, (d: any) => void>;
              const handler = anyCallbacks[message.type];
              if (typeof handler === 'function') {
                handler(message.data);
              } else {
                console.warn('No callback for message type:', message.type);
              }
              
              // Add small delay between job batches for visual feedback
              if (message.type === 'jobs' && i < lines.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            } else {
              console.warn('Invalid NDJSON message structure:', message);
            }
          } catch (e) {
            console.error('Failed to parse NDJSON line:', line, e);
          }
        }
      }
    } else {
      // Process as single JSON response
      console.log('Processing as single JSON response');
      try {
        const data = JSON.parse(responseText);
        
        // Validate response structure
        if (!data.data || !data.data.jobs) {
          throw new Error('Invalid response structure: missing data.jobs');
        }
        
        // Simulate streaming with single complete message
        callbacks.initial?.({
          totalFound: data.data.totalFound || data.data.jobs.length,
          searchCriteria: data.data.searchCriteria || {},
        });
        
        callbacks.jobs?.({
          jobs: data.data.jobs,
          batchNumber: 1,
          totalBatches: 1,
        });
        
        callbacks.complete?.({
          totalProcessed: data.data.jobsReturned || data.data.jobs.length,
          usage: data.usage || {},
          timing: data.timing || {},
        });
      } catch (e) {
        console.error('Failed to parse response:', e);
        console.error('Response text:', responseText.substring(0, 500));
        throw new Error('Invalid response format from server');
      }
    }
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
  
  // Get job search usage - requires authentication
  async getJobUsage(): Promise<JobUsageResponse> {
    const isNetlifyFunction = USE_NETLIFY_FUNCTION;
    if (isNetlifyFunction) {
      // For Netlify function with GET method, we need to pass endpoint as query param
      const url = `/.netlify/functions/jobotic-api?endpoint=/api/jobs/usage`;
      
      // Get auth token
      const { supabase } = await import('./supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session:', sessionError);
        const error = new Error('Failed to get authentication session');
        (error as any).status = 401;
        throw error;
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        console.log('Using auth token for job usage API call');
      } else {
        console.warn('No session token available for job usage API call');
        const error = new Error('Authentication required to fetch job usage');
        (error as any).status = 401;
        throw error;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch job usage: ${response.status}`;
        let errorDetails = null;
        
        try {
          const errorBody = await response.text();
          errorDetails = JSON.parse(errorBody);
          if (errorDetails.error) {
            errorMessage = errorDetails.error;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
        
        console.error('Job usage API error:', { status: response.status, message: errorMessage, details: errorDetails });
        
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).details = errorDetails;
        throw error;
      }
      
      return response.json();
    } else {
      return this.makeRequest<JobUsageResponse>('/api/jobs/usage', null, { 
        method: 'GET', 
        requiresAuth: true 
      });
    }
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
export type { 
  JobSearchRequest, 
  JobMatchRequest, 
  JobMatchResponse, 
  ExportPdfRequest, 
  ExportPdfResponse,
  JobUsageResponse 
};