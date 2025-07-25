import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'http://localhost:3001';

// Debug environment variables
console.log('LinkedIn Job Search API Environment Check:');
console.log('VITE_JOBOTIC_API_URL:', import.meta.env.VITE_JOBOTIC_API_URL);

interface ContextStatus {
  hasContext: boolean;
  contextId?: string;
  lastActivity?: string;
  needsLogin: boolean;
}

interface JobSearchConfig {
  // Natural language search - PREFERRED method
  searchPrompt?: string;
  
  // Traditional fields (optional, used as fallback)
  jobTitle?: string;
  location?: string;
  
  // Filters
  easyApplyOnly?: boolean;
  datePosted?: 'day' | 'week' | 'month';
  remote?: boolean;
  under10Applicants?: boolean;
  maxApplications?: number;
  
  // Resume data
  resumeId?: string;
  resumeUrl?: string;
  resumeMetadata?: {
    fileName: string;
    fileType: string;
    extractedText?: string;
  };
  
  // Profile links
  profileLinks?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
  };
}

interface StartJobSearchResponse {
  success: boolean;
  sessionId: string;
  liveViewUrl: string;
  message: string;
}

interface InterventionData {
  sessionId: string;
  interventionType: string;
  message: string;
  liveViewUrl: string;
  actionRequired: string;
}

interface Job {
  jobId: string;
  company: string;
  jobTitle: string;
  location: string;
  isEasyApply: boolean;
  applicantCount?: number;
  postedDate?: string;
}

interface AutomationMetrics {
  successfulApplications?: number;
  failedApplications?: number;
  jobsFound?: number;
  successRate?: number;
  averageTimePerApplication?: number;
}

export class LinkedInJobSearchAPI {
  private ws: WebSocket | null = null;
  private wsHandlers: Map<string, Function> = new Map();
  
  private async getHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required - please log in');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  // Check if user has existing browser context
  async checkContextStatus(): Promise<ContextStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/context-status`, {
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to check context status');
      }

      return await response.json();
    } catch (error) {
      console.error('Check context status error:', error);
      throw error;
    }
  }

  // Start job search with natural language
  async startJobSearch(userId: string, config: JobSearchConfig): Promise<StartJobSearchResponse> {
    try {
      const headers = await this.getHeaders();
      console.log('Starting job search with config:', config);
      
      // Build request body according to new API spec
      const body: any = {
        userId,
        searchPrompt: config.searchPrompt,
      };
      
      // Add resume info if available
      if (config.resumeUrl) {
        body.resumeUrl = config.resumeUrl;
        body.resumeMetadata = config.resumeMetadata;
      }
      
      // Build config object with filters only if explicitly set
      const configObj: any = {
        maxApplications: config.maxApplications || 50
      };
      
      // Only add filters if user selected them
      const filters: any = {};
      if (config.easyApplyOnly) {
        filters.easyApplyOnly = true;
      }
      if (config.remote) {
        filters.remote = true;
      }
      if (config.datePosted) {
        filters.datePosted = config.datePosted;
      }
      if (config.under10Applicants) {
        filters.under10Applicants = true;
      }
      
      // Only add filters object if there are filters
      if (Object.keys(filters).length > 0) {
        configObj.filters = filters;
      }
      
      // Only add config if it has more than just maxApplications
      if (Object.keys(configObj).length > 1 || configObj.maxApplications !== 50) {
        body.config = configObj;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to start job search';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Map response to expected format
      return {
        success: true,
        sessionId: result.sessionId || result.browserbaseSessionId,
        liveViewUrl: result.liveViewUrl,
        message: result.message || 'Job search started successfully'
      };
    } catch (error) {
      console.error('Start job search error:', error);
      throw error;
    }
  }

  // Resume automation after intervention
  async resumeAutomation(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/continue/${sessionId}`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          interventionCompleted: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to resume automation');
      }

      return await response.json();
    } catch (error) {
      console.error('Resume automation error:', error);
      throw error;
    }
  }

  // Stop automation
  async stopAutomation(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/stop/${sessionId}`, {
        method: 'DELETE',
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to stop automation');
      }

      // DELETE might return empty response, handle gracefully
      const text = await response.text();
      if (text) {
        return JSON.parse(text);
      }
      return { success: true, message: 'Automation stopped' };
    } catch (error) {
      console.error('Stop automation error:', error);
      throw error;
    }
  }

  // Connect to WebSocket for real-time updates
  connectWebSocket(sessionId?: string): void {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
    console.log('Connecting to WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = async () => {
      console.log('WebSocket connected');
      
      // Subscribe to user's events
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          userId: session.user.id
        }));
      }
      
      // Subscribe to specific session if provided
      if (sessionId) {
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          sessionId
        }));
      }
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        // Call registered handlers
        const handler = this.wsHandlers.get(data.type);
        if (handler) {
          handler(data.data);
        }
        
        // Also call generic handler if exists
        const genericHandler = this.wsHandlers.get('*');
        if (genericHandler) {
          genericHandler(data);
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Implement reconnection logic if needed
    };
  }

  // Register WebSocket event handler
  onWebSocketEvent(eventType: string, handler: Function): void {
    this.wsHandlers.set(eventType, handler);
  }

  // Disconnect WebSocket
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsHandlers.clear();
  }

  // Legacy API compatibility methods
  async getStatus(sessionId: string): Promise<SessionStatus> {
    try {
      // For now, return a mock status - this should be implemented based on WebSocket data
      // or a new backend endpoint if available
      return {
        status: 'running',
        progress: {
          totalApplications: 0,
          applicationsToday: 0,
          applicationsThisWeek: 0,
          applicationsThisMonth: 0,
          totalTimeSeconds: 0,
          sessionDurationSeconds: 0
        }
      };
    } catch (error) {
      console.error('Get status error:', error);
      throw error;
    }
  }

  // Poll status with callback
  pollStatus(sessionId: string, onUpdate: (status: SessionStatus) => void, interval = 3000) {
    let intervalId: NodeJS.Timeout;
    
    const poll = async () => {
      try {
        const status = await this.getStatus(sessionId);
        onUpdate(status);
        
        if (['completed', 'failed'].includes(status.status)) {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    };
    
    poll(); // Initial check
    intervalId = setInterval(poll, interval);
    
    return () => clearInterval(intervalId);
  }

  // Get applied jobs
  async getAppliedJobs(sessionId: string, page = 1, limit = 50): Promise<{ success: boolean; jobs: AppliedJob[]; pagination: any }> {
    try {
      // This needs to be implemented based on the new backend API
      // For now, return empty response
      return {
        success: true,
        jobs: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0
        }
      };
    } catch (error) {
      console.error('Get applied jobs error:', error);
      throw error;
    }
  }
}

// Legacy types for compatibility
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

// Export singleton instance
export const linkedInJobSearchApi = new LinkedInJobSearchAPI();

// Export types
export type { 
  ContextStatus, 
  JobSearchConfig, 
  StartJobSearchResponse, 
  InterventionData,
  Job,
  AutomationMetrics,
  SessionStatus,
  AppliedJob
};