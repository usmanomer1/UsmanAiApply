import { supabase } from './supabase';

export interface BrowserUseConfig {
  jobTitle: string;
  location: string;
  targetCount: number;
  linkedinEmail: string;
  linkedinPassword: string;
  customInstructions?: string;
  extractJobs?: boolean;
}

export interface BrowserUseSession {
  id: string;
  task_id: string;
  status: 'active' | 'paused' | 'completed' | 'stopped' | 'failed';
  live_view_url?: string;
  config: BrowserUseConfig;
  metadata?: any;
}

export interface StreamEvent {
  type: 'status' | 'step' | 'intervention' | 'output' | 'jobs_extracted' | 'complete' | 'error';
  data: any;
}

class BrowserUseSDK {
  private baseUrl: string;
  private eventSource: EventSource | null = null;

  constructor() {
    // Use Supabase Edge Functions URL
    this.baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  }

  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  async createTask(config: BrowserUseConfig) {
    const headers = await this.getAuthHeaders();
    
    // Build the task prompt with password handling
    const task = this.buildTaskPrompt(config);
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create',
        config: {
          ...config,
          task,
          extractJobs: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create task');
    }

    return response.json();
  }

  private buildTaskPrompt(config: BrowserUseConfig): string {
    const { jobTitle, location, targetCount, linkedinEmail, linkedinPassword, customInstructions } = config;
    
    let prompt = `You are an intelligent LinkedIn job application assistant. Your task is to help apply for jobs on LinkedIn.

IMPORTANT: You have been provided with credentials to login automatically:
- Email: ${linkedinEmail}
- Password is provided securely in the secrets

Instructions:
1. Go to LinkedIn (linkedin.com)
2. Login using the provided credentials automatically
3. If you encounter 2FA, output "INTERVENTION:2FA_REQUIRED" and wait for 30 seconds for the user to enter the code
4. Once logged in, search for "${jobTitle}" jobs in "${location}"
5. Apply to ${targetCount} relevant positions using Easy Apply
6. For each job you apply to, extract the job details in structured format

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

IMPORTANT: 
- Use the Easy Apply feature only
- Skip jobs that require external applications
- Extract job details for all applied positions
- If login fails, output "INTERVENTION:LOGIN_REQUIRED"`;

    return prompt;
  }

  async getTaskStatus(taskId: string) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'status',
        task_id: taskId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get task status');
    }

    return response.json();
  }

  async pauseTask(taskId: string) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'pause',
        task_id: taskId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to pause task');
    }

    return response.json();
  }

  async resumeTask(taskId: string) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'resume',
        task_id: taskId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resume task');
    }

    return response.json();
  }

  async stopTask(taskId: string) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'stop',
        task_id: taskId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop task');
    }

    return response.json();
  }

  async getActiveSession(): Promise<{ active: boolean; session?: BrowserUseSession; task?: any }> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'get-active',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get active session');
    }

    return response.json();
  }

  streamTaskUpdates(
    taskId: string,
    onMessage: (event: StreamEvent) => void,
    onError?: (error: Error) => void
  ): () => void {
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Get auth token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        onError?.(new Error('Not authenticated'));
        return;
      }

      // Create EventSource with auth token
      const url = `${this.baseUrl}/browser-use-stream?task_id=${taskId}`;
      this.eventSource = new EventSource(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        } as any, // EventSource doesn't have official headers support but some implementations do
      });

      // If EventSource doesn't support headers, fall back to fetch-based SSE
      if (!this.eventSource) {
        this.streamWithFetch(taskId, session.access_token, onMessage, onError);
        return;
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        onError?.(new Error('Stream connection error'));
        this.eventSource?.close();
      };
    });

    // Return cleanup function
    return () => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };
  }

  private async streamWithFetch(
    taskId: string,
    token: string,
    onMessage: (event: StreamEvent) => void,
    onError?: (error: Error) => void
  ) {
    try {
      const response = await fetch(`${this.baseUrl}/browser-use-stream?task_id=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Stream error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onMessage(data);
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Fetch stream error:', error);
      onError?.(error as Error);
    }
  }

  // Helper method to check if iframe is allowed
  isIframeAllowed(url: string): boolean {
    // Browser-Use live URLs should be embeddable
    // Check if URL is from browser-use.com domain
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('browser-use.com') || 
             urlObj.hostname.includes('browserbase.com');
    } catch {
      return false;
    }
  }

  // Get iframe-safe URL
  getIframeSafeUrl(liveUrl: string): string {
    // If the URL is from Browser-Use, it should be directly embeddable
    // Add any necessary parameters for embedding
    if (this.isIframeAllowed(liveUrl)) {
      return liveUrl;
    }
    
    // If not allowed, return empty or proxy URL
    console.warn('URL not allowed in iframe:', liveUrl);
    return '';
  }
}

export default new BrowserUseSDK();