import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_JOBOTIC_API_KEY || '';
const USE_NETLIFY_FUNCTION = !API_KEY; // Use function if no API key

// Debug environment variables
console.log('LinkedIn API Environment Check:');
console.log('VITE_JOBOTIC_API_URL:', import.meta.env.VITE_JOBOTIC_API_URL);
console.log('VITE_JOBOTIC_API_KEY:', import.meta.env.VITE_JOBOTIC_API_KEY ? 'Present' : 'Missing');
console.log('API_KEY loaded:', API_KEY ? 'Yes' : 'No');
console.log('USE_NETLIFY_FUNCTION:', USE_NETLIFY_FUNCTION);

interface LinkedInConfig {
  userId: string;
  searchPrompt?: string;
  config?: {
    jobTitle?: string;
    location?: string;
    experience?: string[];
    filters?: {
      datePosted?: 'day' | 'week' | 'month';
      jobType?: string[];
      remote?: boolean;
      easyApplyOnly?: boolean;
      keywords?: string[];
    };
    maxApplications?: number;
  };
}

interface AutomationSession {
  sessionId: string;
  liveViewUrl: string;
  status: string;
  taskId: string;
}

interface SessionStatus {
  status: 'running' | 'completed' | 'failed' | 'intervention_required' | 'paused';
  progress: {
    totalApplications: number;
    applicationsToday: number;
    applicationsThisWeek: number;
    applicationsThisMonth: number;
    totalTimeSeconds: number;
    sessionDurationSeconds: number;
  };
  liveViewUrl?: string;
  intervention?: {
    required: boolean;
    type: 'login' | 'captcha' | 'two_fa' | 'blocked' | 'rate_limit';
    message: string;
    instructions: string;
    detectedAt: string;
    pageUrl?: string;
  };
}

interface AppliedJob {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  applicationStatus: 'SUCCESS' | 'FAILED' | 'ALREADY_APPLIED';
  appliedAt: string;
  jobUrl: string;
  isEasyApply: boolean;
  errorMessage?: string;
}

interface JobsResponse {
  success: boolean;
  jobs: AppliedJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class LinkedInAutomationAPI {
  private async getHeaders(requiresAuth = true) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Always add Bearer token for LinkedIn automation endpoints
    if (requiresAuth) {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No Supabase session found - authentication will fail');
        throw new Error('Authentication required - please log in');
      }

      headers['Authorization'] = `Bearer ${session.access_token}`;
      console.log('Using Bearer token authentication');
      
      // Also add API key if available (some endpoints might check both)
      if (!USE_NETLIFY_FUNCTION && API_KEY) {
        headers['X-API-Key'] = API_KEY;
        console.log('Also including API Key with Bearer token');
      }
    } else if (!USE_NETLIFY_FUNCTION && API_KEY) {
      // For non-auth requests, just use API key
      headers['X-API-Key'] = API_KEY;
      console.log('Using API Key authentication only');
    }

    console.log('Request headers prepared:', {
      hasContentType: !!headers['Content-Type'],
      hasApiKey: !!headers['X-API-Key'],
      hasBearer: !!headers['Authorization'],
      requiresAuth,
      useNetlifyFunction: USE_NETLIFY_FUNCTION
    });

    return headers;
  }

  async startAutomation(config: LinkedInConfig): Promise<AutomationSession> {
    try {
      const url = `${API_BASE_URL}/api/linkedin/start`;
      const headers = await this.getHeaders(true);
      
      // Debug logging
      console.log('LinkedIn API Request Debug:');
      console.log('URL:', url);
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('USE_NETLIFY_FUNCTION:', USE_NETLIFY_FUNCTION);
      console.log('API_KEY present:', !!API_KEY);
      console.log('API_KEY length:', API_KEY ? API_KEY.length : 0);
      console.log('Headers:', JSON.stringify(headers, null, 2));
      console.log('Config:', config);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(config)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        let errorMessage = 'Failed to start automation';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
          console.error('API Error Response:', error);
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(`${errorMessage} (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error('Start automation error:', error);
      throw error;
    }
  }

  async getStatus(sessionId: string): Promise<SessionStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/status/${sessionId}`, {
        headers: await this.getHeaders(true)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get status');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get status error:', error);
      throw error;
    }
  }

  async pauseSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/linkedin/pause/${sessionId}`, {
      method: 'PUT',
      headers: await this.getHeaders(true)
    });

    if (!response.ok) {
      throw new Error('Failed to pause session');
    }

    return response.json();
  }

  async resumeSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/linkedin/resume/${sessionId}`, {
      method: 'PUT',
      headers: await this.getHeaders(true)
    });

    if (!response.ok) {
      throw new Error('Failed to resume session');
    }

    return response.json();
  }

  async stopSession(sessionId: string): Promise<{ success: boolean; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/linkedin/stop/${sessionId}`, {
      method: 'DELETE',
      headers: await this.getHeaders(true)
    });

    if (!response.ok) {
      throw new Error('Failed to stop session');
    }

    return response.json();
  }

  async continueAfterIntervention(sessionId: string): Promise<{ success: boolean; status: string; message: string }> {
    try {
      const headers = await this.getHeaders(true);
      console.log('Continue endpoint - Headers being sent:', headers);
      console.log('Continue endpoint - URL:', `${API_BASE_URL}/api/linkedin/continue/${sessionId}`);
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/continue/${sessionId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}), // Empty body as per the new API spec
        credentials: 'include', // Include cookies for CORS
        mode: 'cors' // Explicitly set CORS mode
      });

      console.log('Continue response status:', response.status);
      console.log('Continue response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = 'Failed to continue automation';
        let errorData: any = { status: response.status, statusText: response.statusText };
        
        try {
          const errorText = await response.text();
          console.error('Continue failed - Response body:', errorText);
          
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
            errorData = { ...errorData, ...errorJson };
          } catch (parseError) {
            errorData.bodyText = errorText;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        
        const err = new Error(errorMessage) as any;
        err.status = response.status;
        err.data = errorData;
        throw err;
      }

      const result = await response.json();
      console.log('Continue successful:', result);
      return result;
    } catch (error) {
      console.error('Continue after intervention error:', error);
      throw error;
    }
  }

  async getAppliedJobs(sessionId: string, page = 1, limit = 50): Promise<JobsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/linkedin/jobs/${sessionId}?page=${page}&limit=${limit}`,
      { headers: await this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch applied jobs');
    }

    return response.json();
  }

  // Helper to poll status with callback and adaptive intervals
  pollStatus(sessionId: string, onUpdate: (status: SessionStatus) => void, initialInterval = 3000) {
    let currentInterval = initialInterval;
    let intervalId: NodeJS.Timeout;
    
    const poll = async () => {
      try {
        const data = await this.getStatus(sessionId);
        onUpdate(data);

        // Stop polling if session is complete or failed
        if (['completed', 'failed'].includes(data.status)) {
          clearInterval(intervalId);
          return;
        }

        // Adjust polling interval based on status
        let newInterval = currentInterval;
        switch (data.status) {
          case 'intervention_required':
            newInterval = 2000; // Check more frequently for user action
            break;
          case 'running':
            newInterval = 5000; // Normal operation
            break;
          case 'paused':
            newInterval = 10000; // Check less frequently when paused
            break;
          default:
            newInterval = 3000;
        }

        // Update interval if changed
        if (newInterval !== currentInterval) {
          currentInterval = newInterval;
          clearInterval(intervalId);
          intervalId = setInterval(poll, currentInterval);
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    };

    // Start polling
    poll(); // Initial check immediately
    intervalId = setInterval(poll, currentInterval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

export const linkedinAutomationApi = new LinkedInAutomationAPI();
export type { LinkedInConfig, AutomationSession, SessionStatus, AppliedJob, JobsResponse };