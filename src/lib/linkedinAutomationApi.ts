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

    // Add API key for direct API calls (not Netlify functions)
    if (!USE_NETLIFY_FUNCTION && API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }

    // Add Bearer token for authenticated requests
    if (requiresAuth) {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

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
    const response = await fetch(`${API_BASE_URL}/api/linkedin/continue/${sessionId}`, {
      method: 'POST',
      headers: await this.getHeaders(true),
      body: JSON.stringify({ interventionCompleted: true })
    });

    if (!response.ok) {
      throw new Error('Failed to continue automation');
    }

    return response.json();
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

  // Helper to poll status with callback
  pollStatus(sessionId: string, onUpdate: (status: SessionStatus) => void, interval = 3000) {
    const intervalId = setInterval(async () => {
      try {
        const data = await this.getStatus(sessionId);
        onUpdate(data);

        // Stop polling if session is complete or failed
        if (['completed', 'failed'].includes(data.status)) {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    }, interval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

export const linkedinAutomationApi = new LinkedInAutomationAPI();
export type { LinkedInConfig, AutomationSession, SessionStatus, AppliedJob, JobsResponse };