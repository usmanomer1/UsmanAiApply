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
  status?: string;
  taskId?: string;
  browserbaseSessionId?: string;
  message?: string;
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

let requestCounter = 0;

// Debug mode flag
let DEBUG_MODE = false;

// Track ongoing requests to prevent duplicates
const activeRequests = new Map<string, Promise<any>>();

// Enable/disable debug mode
export function setDebugMode(enabled: boolean) {
  DEBUG_MODE = enabled;
  console.log(`[DEBUG] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// Get current debug mode status
export function isDebugMode() {
  return DEBUG_MODE;
}

export class LinkedInJobSearchAPI {
  
  private async handleApiError(response: Response, defaultMessage: string): Promise<never> {
    let errorMessage = defaultMessage;
    let errorDetails: any = {};
    
    try {
      errorDetails = await response.json();
      errorMessage = errorDetails.message || errorDetails.error || errorMessage;
    } catch (e) {
      console.error('Failed to parse error response:', e);
    }
    
    // Handle specific error codes
    switch (response.status) {
      case 401:
        throw new Error('Authentication required - please log in');
      case 403:
        throw new Error('Access denied - userId doesn\'t match authenticated user');
      case 400:
        throw new Error(errorMessage || 'Invalid request - check required fields');
      case 429:
        throw new Error('Rate limit exceeded - maximum 10 sessions per hour');
      case 500:
        throw new Error(errorMessage || 'Server error - please try again later');
      default:
        throw new Error(errorMessage);
    }
  }
  
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
        await this.handleApiError(response, 'Failed to check context status');
      }

      return await response.json();
    } catch (error) {
      console.error('Check context status error:', error);
      throw error;
    }
  }

  // Start job search with natural language
  async startJobSearch(userId: string, config: JobSearchConfig): Promise<StartJobSearchResponse> {
    const currentRequestId = ++requestCounter;
    console.log(`[REQUEST ${currentRequestId}] Starting job search at ${new Date().toISOString()}`);
    console.log(`[REQUEST ${currentRequestId}] Config:`, config);
    
    // Create a stable key for this request based on essential fields only
    // This prevents issues with property ordering in JSON.stringify
    const requestKey = [
      'start',
      userId,
      config.searchPrompt || '',
      config.jobTitle || '',
      config.location || '',
      config.resumeUrl || '',
      config.easyApplyOnly ? '1' : '0',
      config.remote ? '1' : '0',
      config.datePosted || 'any',
      config.under10Applicants ? '1' : '0'
    ].join('-');
    
    console.log(`[REQUEST ${currentRequestId}] Request key: ${requestKey}`);
    console.log(`[REQUEST ${currentRequestId}] Active requests count: ${activeRequests.size}`);
    console.log(`[REQUEST ${currentRequestId}] Active request keys:`, Array.from(activeRequests.keys()));
    
    // Check if an identical request is already in progress
    if (activeRequests.has(requestKey)) {
      console.warn(`[REQUEST ${currentRequestId}] 🚫 DUPLICATE REQUEST PREVENTED! An identical request is already in progress.`);
      console.warn(`[REQUEST ${currentRequestId}] Request key: ${requestKey}`);
      console.warn(`[REQUEST ${currentRequestId}] Returning existing promise instead of creating new request.`);
      
      // Return the existing promise
      return activeRequests.get(requestKey)!;
    }
    
    // Create the promise for this request
    const requestPromise = (async () => {
      try {
      const headers = await this.getHeaders();
      
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
      
      console.log(`[REQUEST ${currentRequestId}] Sending POST to: ${API_BASE_URL}/api/linkedin/start`);
      console.log(`[REQUEST ${currentRequestId}] Body:`, body);
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      console.log(`[REQUEST ${currentRequestId}] Response status: ${response.status}`);

      if (!response.ok) {
        console.error(`[REQUEST ${currentRequestId}] Failed with status ${response.status}`);
        await this.handleApiError(response, 'Failed to start job search');
      }

      const result = await response.json();
      console.log(`[REQUEST ${currentRequestId}] Response data:`, result);
      
      // Return response in expected format
        return {
          success: true,
          sessionId: result.sessionId,
          liveViewUrl: result.liveViewUrl,
          status: result.status || 'running',
          taskId: result.taskId,
          browserbaseSessionId: result.browserbaseSessionId || result.sessionId, // For backward compatibility
          message: result.message || 'Job search started successfully'
        };
      } catch (error) {
        console.error(`[REQUEST ${currentRequestId}] Start job search error:`, error);
        throw error;
      } finally {
        // Clean up the active request
        activeRequests.delete(requestKey);
        console.log(`[REQUEST ${currentRequestId}] Request completed and removed from active requests`);
      }
    })();
    
    // Store the promise
    activeRequests.set(requestKey, requestPromise);
    console.log(`[REQUEST ${currentRequestId}] Request added to active requests map`);
    
    return requestPromise;
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
        await this.handleApiError(response, 'Failed to continue/resume automation');
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
        await this.handleApiError(response, 'Failed to stop automation');
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

  // Pause automation
  async pauseAutomation(sessionId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/pause/${sessionId}`, {
        method: 'PUT',
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        await this.handleApiError(response, 'Failed to pause automation');
      }

      return { success: true };
    } catch (error) {
      console.error('Pause automation error:', error);
      throw error;
    }
  }

  // Resume a paused automation
  async resumePausedAutomation(sessionId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/resume/${sessionId}`, {
        method: 'PUT',
        headers: await this.getHeaders()
      });

      if (!response.ok) {
        await this.handleApiError(response, 'Failed to continue/resume automation');
      }

      return { success: true };
    } catch (error) {
      console.error('Resume automation error:', error);
      throw error;
    }
  }


  // Get session status
  async getStatus(sessionId: string): Promise<SessionStatus> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/linkedin/status/${sessionId}`, {
        headers
      });

      if (!response.ok) {
        await this.handleApiError(response, 'Failed to get status');
      }

      return await response.json();
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
    type: 'LOGIN' | 'CAPTCHA' | 'TWO_FA' | 'BLOCKED' | 'RATE_LIMIT';
    message: string;
    instructions: string;
    url?: string;
    liveViewUrl?: string;
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