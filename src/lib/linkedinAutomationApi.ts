import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'http://localhost:3001';
const USE_NETLIFY_FUNCTION = !import.meta.env.VITE_JOBOTIC_API_KEY; // Use function if no VITE key
const API_KEY = import.meta.env.VITE_JOBOTIC_API_KEY || import.meta.env.JOBOTIC_API_KEY || '';

interface LinkedInConfig {
  userId: string;
  searchPrompt?: string;
  resumeUrl: string;
  resumeMetadata: {
    fileName: string;
    fileType: string;
    fileSize?: number;
  };
  config?: {
    maxApplications?: number;
    keywords?: string[];
    jobTitle?: string;
    location?: string;
    experienceLevel?: string[];
    jobType?: string[];
    filters?: {
      datePosted?: string;
      remote?: boolean;
      easyApplyOnly?: boolean;
    };
    externalApplicationConfig?: {
      pauseOnAccountCreation?: boolean;
      autoCreateAccount?: boolean;
      defaultEmail?: string;
      defaultPassword?: string;
    };
  };
}

interface AutomationSession {
  success: boolean;
  sessionId: string;
  liveViewUrl: string;
  debugUrl: string;
}

interface SessionStatus {
  success: boolean;
  session: {
    id: string;
    status: 'RUNNING' | 'PAUSED' | 'INTERVENTION_REQUIRED' | 'COMPLETED' | 'FAILED';
    progress: {
      totalJobs: number;
      processedJobs: number;
      appliedJobs: number;
      skippedJobs: number;
      failedJobs: number;
      currentPage: number;
    };
    currentJob?: {
      title: string;
      company: string;
      location: string;
    };
    interventionRequired: boolean;
    interventionDetails?: {
      type: string;
      message: string;
      liveViewUrl: string;
      timestamp: string;
    };
  };
  recentLogs: Array<{
    timestamp: string;
    message: string;
    level: string;
  }>;
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
      const response = await fetch(`${API_BASE_URL}/api/linkedin/start`, {
        method: 'POST',
        headers: await this.getHeaders(true),
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start automation');
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

      return await response.json();
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

  async stopSession(sessionId: string, reason = 'User requested stop'): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/linkedin/stop/${sessionId}`, {
      method: 'DELETE',
      headers: await this.getHeaders(true),
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      throw new Error('Failed to stop session');
    }

    return response.json();
  }

  async continueAfterIntervention(sessionId: string): Promise<{ success: boolean }> {
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
  pollStatus(sessionId: string, onUpdate: (status: SessionStatus['session']) => void, interval = 5000) {
    const intervalId = setInterval(async () => {
      try {
        const data = await this.getStatus(sessionId);
        onUpdate(data.session);

        // Stop polling if session is complete or failed
        if (['COMPLETED', 'FAILED'].includes(data.session.status)) {
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