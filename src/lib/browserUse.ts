import { supabase } from './supabase';

export interface BrowserUseTask {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  logs: string[];
  step_count: number;
  cost_usd: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRequest {
  task: string;
  session_id?: string;
  max_steps?: number;
  include_screenshot?: boolean;
}

export interface LinkedInSession {
  session_id: string;
  cookies: any[];
  user_id: string;
  created_at: string;
  expires_at: string;
  is_valid: boolean;
}

class BrowserUseAPI {
  private apiKey: string;
  private baseUrl = 'https://api.browser-use.com';

  constructor() {
    this.apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Browser Use API key not configured');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.apiKey) {
      throw new Error('Browser Use API key not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  async runTask(taskRequest: TaskRequest): Promise<{ task_id: string }> {
    return this.makeRequest('/api/v1/run-task', {
      method: 'POST',
      body: JSON.stringify(taskRequest),
    });
  }

  async getTaskStatus(taskId: string): Promise<BrowserUseTask> {
    return this.makeRequest(`/api/v1/get-task-status?task_id=${taskId}`);
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.makeRequest(`/api/v1/cancel-task`, {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId }),
    });
  }
}

export const browserUseAPI = new BrowserUseAPI();

// LinkedIn session management
export class LinkedInSessionManager {
  private static readonly STORAGE_KEY = 'linkedin_session';

  static async saveSession(sessionData: Omit<LinkedInSession, 'user_id' | 'created_at'>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const session: LinkedInSession = {
        ...sessionData,
        user_id: user.id,
        created_at: new Date().toISOString(),
      };

      // Save to localStorage for quick access
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

      // Save to Supabase if configured
      if (this.isSupabaseConfigured()) {
        await supabase
          .from('linkedin_sessions')
          .upsert(session, { onConflict: 'user_id' });
      }
    } catch (error) {
      console.error('Error saving LinkedIn session:', error);
      throw error;
    }
  }

  static async getSession(): Promise<LinkedInSession | null> {
    try {
      // Try localStorage first
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as LinkedInSession;
        if (this.isSessionValid(session)) {
          return session;
        }
      }

      // Try Supabase if configured
      if (this.isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
          .from('linkedin_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_valid', true)
          .maybeSingle();

        if (error) throw error;
        
        if (data && this.isSessionValid(data)) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
          return data;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting LinkedIn session:', error);
      return null;
    }
  }

  static async invalidateSession(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);

      if (this.isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('linkedin_sessions')
            .update({ is_valid: false })
            .eq('user_id', user.id);
        }
      }
    } catch (error) {
      console.error('Error invalidating LinkedIn session:', error);
    }
  }

  private static isSessionValid(session: LinkedInSession): boolean {
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    return session.is_valid && expiresAt > now;
  }

  private static isSupabaseConfigured(): boolean {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  }
}

// LinkedIn automation tasks
export class LinkedInAutomation {
  static async initializeSession(): Promise<string> {
    const task = `
Navigate to LinkedIn login page (https://www.linkedin.com/login).
Wait for the user to manually log in.
Once logged in successfully (detect by presence of LinkedIn feed or profile elements), 
save the session cookies and return the session ID.
Do not attempt to fill login credentials automatically.
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      max_steps: 50,
      include_screenshot: true,
    });

    return task_id;
  }

  static async applyToJob(jobUrl: string, sessionId: string, applicationData: any): Promise<string> {
    const task = `
Using the saved LinkedIn session, navigate to the job posting at: ${jobUrl}

Steps to complete:
1. Scroll down to load all form elements before filling any fields
2. Click the "Easy Apply" button if available
3. Fill out the application form with the following information:
   - Name: ${applicationData.fullName}
   - Email: ${applicationData.email}
   - Phone: ${applicationData.phone || 'Not provided'}
   - Resume: Upload if file upload is available
4. Handle any dynamic questions by:
   - Reading the question text carefully
   - Providing appropriate responses based on the job requirements
   - For unclear questions, mark them for manual review
5. For multi-step applications, continue through all steps
6. Submit the application when all required fields are completed
7. Confirm submission and capture any confirmation messages

Important guidelines:
- Always scroll down forms before filling fields to ensure all elements are loaded
- Handle dynamic content gracefully
- If login has expired, return an error indicating session needs refresh
- For unclear or complex questions, provide reasonable defaults or skip if optional
- Take screenshots at key steps for verification
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      session_id: sessionId,
      max_steps: 100,
      include_screenshot: true,
    });

    return task_id;
  }

  static async searchJobs(searchCriteria: any, sessionId: string): Promise<string> {
    const task = `
Using the saved LinkedIn session, search for jobs with the following criteria:
- Job Title: ${searchCriteria.jobTitle}
- Location: ${searchCriteria.location}
- Job Type: ${searchCriteria.jobType}
- Work Type: ${searchCriteria.workType}
- Experience Level: ${searchCriteria.experienceLevel}

Steps:
1. Navigate to LinkedIn Jobs search
2. Enter search criteria in the appropriate fields
3. Apply filters for job type, work type, and experience level
4. Scroll through results and collect job URLs that have "Easy Apply" buttons
5. Return a list of job URLs with their titles and companies
6. Limit to ${searchCriteria.targetCount || 25} jobs maximum

Focus on jobs that:
- Have the "Easy Apply" option
- Match the specified criteria closely
- Are recently posted (within last 2 weeks if possible)
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      session_id: sessionId,
      max_steps: 150,
      include_screenshot: true,
    });

    return task_id;
  }
}

// Task monitoring and logging
export class TaskMonitor {
  private static activeTasks = new Map<string, NodeJS.Timeout>();

  static async startMonitoring(
    taskId: string, 
    onUpdate: (task: BrowserUseTask) => void,
    onComplete: (task: BrowserUseTask) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const pollInterval = setInterval(async () => {
      try {
        const task = await browserUseAPI.getTaskStatus(taskId);
        onUpdate(task);

        if (task.status === 'completed') {
          clearInterval(pollInterval);
          this.activeTasks.delete(taskId);
          onComplete(task);
          await this.logTaskUsage(task);
        } else if (task.status === 'failed') {
          clearInterval(pollInterval);
          this.activeTasks.delete(taskId);
          onError(task.error || 'Task failed');
          await this.logTaskUsage(task);
        }
      } catch (error) {
        console.error('Error polling task status:', error);
        onError(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 2000);

    this.activeTasks.set(taskId, pollInterval);
  }

  static stopMonitoring(taskId: string): void {
    const interval = this.activeTasks.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.activeTasks.delete(taskId);
    }
  }

  static async cancelTask(taskId: string): Promise<void> {
    try {
      await browserUseAPI.cancelTask(taskId);
      this.stopMonitoring(taskId);
    } catch (error) {
      console.error('Error canceling task:', error);
      throw error;
    }
  }

  private static async logTaskUsage(task: BrowserUseTask): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Log usage for billing purposes
      const usageLog = {
        user_id: user.id,
        task_id: task.task_id,
        step_count: task.step_count,
        cost_usd: task.cost_usd,
        task_type: 'linkedin_automation',
        created_at: new Date().toISOString(),
      };

      if (this.isSupabaseConfigured()) {
        await supabase.from('browser_use_logs').insert(usageLog);
      }

      console.log('Task usage logged:', usageLog);
    } catch (error) {
      console.error('Error logging task usage:', error);
    }
  }

  private static isSupabaseConfigured(): boolean {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  }
}

// Error handling utilities
export class BrowserUseErrorHandler {
  static isLoginExpired(error: string): boolean {
    const loginExpiredKeywords = [
      'login required',
      'session expired',
      'authentication failed',
      'please log in',
      'unauthorized access'
    ];
    
    return loginExpiredKeywords.some(keyword => 
      error.toLowerCase().includes(keyword)
    );
  }

  static isRateLimited(error: string): boolean {
    const rateLimitKeywords = [
      'rate limit',
      'too many requests',
      'quota exceeded',
      'throttled'
    ];
    
    return rateLimitKeywords.some(keyword => 
      error.toLowerCase().includes(keyword)
    );
  }

  static getRetryDelay(error: string): number {
    if (this.isRateLimited(error)) {
      return 60000; // 1 minute for rate limits
    }
    if (this.isLoginExpired(error)) {
      return 0; // No retry for login issues
    }
    return 5000; // 5 seconds for other errors
  }

  static shouldRetry(error: string, attemptCount: number): boolean {
    if (attemptCount >= 3) return false;
    if (this.isLoginExpired(error)) return false;
    return true;
  }
}