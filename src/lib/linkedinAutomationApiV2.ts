import { supabase } from './supabase';
import { io, Socket } from 'socket.io-client';

// Get API URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'http://localhost:3001';
const WS_URL = API_BASE_URL.replace(/^http/, 'ws');

// Types based on the API documentation
export interface LinkedInJobConfig {
  jobTitle?: string;
  location?: string;
  remote?: boolean;
  easyApplyOnly?: boolean;
  datePosted?: string;
  maxApplications?: number;
  resumeUrl?: string;
  resumeMetadata?: {
    extractedText?: string;
    fileName?: string;
  };
  externalApplicationConfig?: {
    defaultEmail?: string;
  };
  searchPrompt?: string;
}

export interface StartSessionResponse {
  success: boolean;
  sessionId: string;
  debugUrl: string;
  error?: string;
}

export interface SessionProgress {
  totalJobs: number;
  processedJobs: number;
  appliedJobs: number;
  skippedJobs: number;
  failedJobs: number;
  currentPage: number;
}

export interface LinkedInSession {
  id: string;
  browserbase_session_id: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  config: LinkedInJobConfig;
  created_at: string;
  started_at: string;
  completed_at: string | null;
  live_view_url: string;
}

export interface JobFound {
  jobId: string;
  company: string;
  jobTitle: string;
  location: string;
  jobUrl: string;
  isEasyApply: boolean;
}

export interface InterventionRequired {
  type: 'login' | 'captcha' | 'two_fa' | 'blocked' | 'rate_limit';
  confidence: number;
  message: string;
  instructions: string;
  url: string;
  liveViewUrl: string;
}

export class LinkedInAutomationAPIV2 {
  private socket: Socket | null = null;
  private currentSessionId: string | null = null;

  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  }

  async startSession(config: LinkedInJobConfig): Promise<StartSessionResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config)
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start session');
      }

      this.currentSessionId = data.sessionId;
      return data;
    } catch (error) {
      console.error('Error starting LinkedIn session:', error);
      throw error;
    }
  }

  async continueSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/continue/${sessionId}`, {
        method: 'POST',
        headers
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to continue session');
      }

      return data;
    } catch (error) {
      console.error('Error continuing session:', error);
      throw error;
    }
  }

  async getProgress(sessionId: string): Promise<{ success: boolean; progress: SessionProgress }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/progress/${sessionId}`, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get progress');
      }

      return data;
    } catch (error) {
      console.error('Error getting progress:', error);
      throw error;
    }
  }

  async pauseSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/pause/${sessionId}`, {
        method: 'POST',
        headers
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to pause session');
      }

      return data;
    } catch (error) {
      console.error('Error pausing session:', error);
      throw error;
    }
  }

  async resumeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/resume/${sessionId}`, {
        method: 'POST',
        headers
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to resume session');
      }

      return data;
    } catch (error) {
      console.error('Error resuming session:', error);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/stop/${sessionId}`, {
        method: 'POST',
        headers
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to stop session');
      }

      return data;
    } catch (error) {
      console.error('Error stopping session:', error);
      throw error;
    }
  }

  async getUserSessions(): Promise<{ success: boolean; sessions: LinkedInSession[] }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/linkedin/sessions`, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get sessions');
      }

      return data;
    } catch (error) {
      console.error('Error getting sessions:', error);
      throw error;
    }
  }

  // WebSocket connection management
  async connectWebSocket(sessionId: string): Promise<Socket> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(WS_URL, {
      auth: {
        token: session.access_token
      }
    });

    // Join the session room
    this.socket.emit('join-session', { sessionId });

    return this.socket;
  }

  disconnectWebSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export a singleton instance
export const linkedInAutomationAPI = new LinkedInAutomationAPIV2();