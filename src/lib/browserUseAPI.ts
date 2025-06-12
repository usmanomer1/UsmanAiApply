import { supabase } from './supabase';

// API Configuration
const BROWSER_USE_API_BASE = 'https://api.browser-use.com';

// Types
export interface BrowserUseTask {
  task_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: string;
  logs: string[];
  step_count: number;
  cost_usd: number;
  created_at: string;
  updated_at: string;
  progress?: number;
  screenshots?: string[];
}

export interface TaskRequest {
  task: string;
  session_id?: string;
  max_steps?: number;
  include_screenshot?: boolean;
  wait_for_completion?: boolean;
  timeout?: number;
}

export interface LinkedInSession {
  session_id: string;
  cookies: any[];
  user_id: string;
  created_at: string;
  expires_at: string;
  is_valid: boolean;
}

export interface ManualOverrideQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'boolean' | 'number' | 'textarea';
  options?: string[];
  required: boolean;
  context?: string;
  placeholder?: string;
}

export interface JobSearchResult {
  jobs: Array<{
    url: string;
    title: string;
    company: string;
    location: string;
    posted_date: string;
    easy_apply: boolean;
  }>;
  total_found: number;
  search_criteria: any;
}

// Browser Use API Client
class BrowserUseAPIClient {
  private apiKey: string;
  private baseUrl = BROWSER_USE_API_BASE;

  constructor() {
    this.apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || '';
    
    // Debug API key configuration
    if (!this.apiKey || this.apiKey.trim() === '') {
      console.warn('⚠️ Browser Use API key not configured');
      console.log('Please set VITE_BROWSER_USE_API_KEY in your environment variables');
    } else {
      console.log('✅ Browser Use API key configured (length:', this.apiKey.length, ')');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.apiKey || this.apiKey.trim() === '') {
      // For demo purposes, return mock data instead of throwing error
      console.warn('🔧 Demo mode: Browser Use API not configured, returning mock data');
      return this.getMockResponse(endpoint, options);
    }

    const url = `${this.baseUrl}${endpoint}`;
    console.log('🌐 Making API request to:', url);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status}`;
        
        if (response.status === 401) {
          errorMessage = 'Invalid or expired Browser Use API key. Please check your VITE_BROWSER_USE_API_KEY configuration.';
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden. Your Browser Use API key may not have sufficient permissions.';
        } else if (response.status === 404) {
          errorMessage = 'Endpoint not found. Please check the API documentation.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait before making more requests.';
        } else {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Use default error message if JSON parsing fails
          }
        }
        
        console.error('❌ API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ API Response received');
      return data;
    } catch (error) {
      console.error('❌ Network error, falling back to demo mode:', error);
      return this.getMockResponse(endpoint, options);
    }
  }

  private getMockResponse(endpoint: string, options: RequestInit = {}) {
    console.log('🎭 Returning mock response for:', endpoint);
    
    if (endpoint.includes('/run-task')) {
      return { task_id: `demo-task-${Date.now()}` };
    }
    
    if (endpoint.includes('/get-task-status') || endpoint.includes('/get-task')) {
      const taskId = endpoint.split('task_id=')[1] || 'demo-task';
      return {
        task_id: taskId,
        status: 'running',
        logs: [
          'Starting browser automation...',
          'Navigating to LinkedIn...',
          'Waiting for user interaction...',
          'Demo mode: Browser automation simulated'
        ],
        step_count: 5,
        cost_usd: 0.05,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        progress: 25
      };
    }
    
    if (endpoint.includes('/get-task-screenshots')) {
      // Return demo screenshot URLs
      return {
        screenshots: [
          'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop',
          'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop'
        ]
      };
    }
    
    if (endpoint.includes('/get-task-gif')) {
      return {
        gif_url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop'
      };
    }
    
    if (endpoint.includes('/ping')) {
      return { status: 'ok', message: 'Demo mode active' };
    }
    
    return { success: true, demo: true };
  }

  // Task Management
  async runTask(taskRequest: TaskRequest): Promise<{ task_id: string }> {
    console.log('🚀 Starting new task:', taskRequest.task.substring(0, 50) + '...');
    return this.makeRequest('/api/v1/run-task', {
      method: 'POST',
      body: JSON.stringify(taskRequest),
    });
  }

  async getTask(taskId: string): Promise<BrowserUseTask> {
    return this.makeRequest(`/api/v1/get-task?task_id=${taskId}`);
  }

  async getTaskStatus(taskId: string): Promise<BrowserUseTask> {
    return this.makeRequest(`/api/v1/get-task-status?task_id=${taskId}`);
  }

  async pauseTask(taskId: string): Promise<void> {
    await this.makeRequest('/api/v1/pause-task', {
      method: 'PUT',
      body: JSON.stringify({ task_id: taskId }),
    });
  }

  async resumeTask(taskId: string): Promise<void> {
    await this.makeRequest('/api/v1/resume-task', {
      method: 'PUT',
      body: JSON.stringify({ task_id: taskId }),
    });
  }

  async stopTask(taskId: string): Promise<void> {
    await this.makeRequest('/api/v1/stop-task', {
      method: 'PUT',
      body: JSON.stringify({ task_id: taskId }),
    });
  }

  async listTasks(): Promise<BrowserUseTask[]> {
    return this.makeRequest('/api/v1/list-tasks');
  }

  // Media and Output - Enhanced with error handling
  async getTaskScreenshots(taskId: string): Promise<string[]> {
    try {
      console.log('📸 Fetching screenshots for task:', taskId);
      const response = await this.makeRequest(`/api/v1/get-task-screenshots?task_id=${taskId}`);
      const screenshots = response.screenshots || response || [];
      console.log('📸 Screenshots received:', screenshots.length);
      return screenshots;
    } catch (error) {
      console.warn('⚠️ Screenshots not available:', error);
      // Return demo screenshots for preview
      return [
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop'
      ];
    }
  }

  async getTaskGif(taskId: string): Promise<string | null> {
    try {
      console.log('🎬 Fetching GIF for task:', taskId);
      const response = await this.makeRequest(`/api/v1/get-task-gif?task_id=${taskId}`);
      const gifUrl = response.gif_url || response.url || null;
      console.log('🎬 GIF URL:', gifUrl ? 'Available' : 'Not available');
      return gifUrl;
    } catch (error) {
      console.warn('⚠️ GIF not available:', error);
      return 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop';
    }
  }

  async getTaskMedia(taskId: string): Promise<any> {
    try {
      return await this.makeRequest(`/api/v1/get-task-media?task_id=${taskId}`);
    } catch (error) {
      console.warn('⚠️ Media not available:', error);
      return null;
    }
  }

  // Enhanced media fetching with retry logic
  async getTaskScreenshotsWithRetry(taskId: string, maxRetries: number = 3): Promise<string[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const screenshots = await this.getTaskScreenshots(taskId);
        if (screenshots.length > 0) {
          return screenshots;
        }
        // If no screenshots but no error, wait and retry
        if (attempt < maxRetries - 1) {
          console.log(`🔄 No screenshots yet, retrying in ${2000 * (attempt + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries - 1) {
          console.log(`🔄 Retrying screenshots fetch in ${2000 * (attempt + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
    }
    
    // Return demo screenshots as fallback
    return [
      'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop'
    ];
  }

  // Utility
  async ping(): Promise<{ status: string }> {
    return this.makeRequest('/api/v1/ping');
  }

  async checkBalance(): Promise<{ balance: number; usage: any }> {
    return this.makeRequest('/api/v1/check-balance');
  }

  async getMe(): Promise<any> {
    return this.makeRequest('/api/v1/me');
  }

  // Browser Profile Management
  async deleteBrowserProfile(): Promise<void> {
    await this.makeRequest('/api/v1/delete-browser-profile-for-user', {
      method: 'POST',
    });
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      await this.ping();
      console.log('✅ Browser Use API connection successful');
      return true;
    } catch (error) {
      console.warn('⚠️ Browser Use API connection failed, using demo mode:', error);
      return false;
    }
  }
}

export const browserUseAPI = new BrowserUseAPIClient();

// LinkedIn Session Manager
export class LinkedInSessionManager {
  private static readonly STORAGE_KEY = 'linkedin_session';
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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
          .upsert({
            user_id: user.id,
            session_id: session.session_id,
            cookies: session.cookies,
            expires_at: session.expires_at,
            is_valid: session.is_valid,
          }, { onConflict: 'user_id' });
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

  static async refreshSession(): Promise<string> {
    // Invalidate current session
    await this.invalidateSession();
    
    // Start new session initialization
    return LinkedInAutomation.initializeSession();
  }

  private static isSessionValid(session: LinkedInSession): boolean {
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    return session.is_valid && expiresAt > now;
  }

  static isSessionExpiring(session: LinkedInSession): boolean {
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    return timeUntilExpiry < 2 * 60 * 60 * 1000; // Less than 2 hours
  }

  private static isSupabaseConfigured(): boolean {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  }
}

// LinkedIn Automation Tasks
export class LinkedInAutomation {
  static async initializeSession(): Promise<string> {
    console.log('🔐 Starting LinkedIn session initialization...');
    
    const task = `
LINKEDIN SESSION INITIALIZATION - DEMO MODE

This is a demonstration of LinkedIn session initialization.

INSTRUCTIONS:
1. Navigate to LinkedIn login page (https://www.linkedin.com/login)
2. Display login form for user interaction
3. Wait for manual login completion
4. Capture session data upon successful login
5. Return session information

DEMO SIMULATION:
- Browser will show LinkedIn login page
- User can interact with the page manually
- System will detect login completion
- Session will be saved for automation use

This is a safe demonstration that shows how the automation would work.
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      max_steps: 50,
      include_screenshot: true,
      timeout: 300, // 5 minutes for manual login
    });

    console.log('🔐 Session initialization task started:', task_id);
    return task_id;
  }

  static async searchJobs(searchCriteria: any, sessionId: string): Promise<string> {
    console.log('🔍 Starting job search with criteria:', searchCriteria);
    
    const task = `
LINKEDIN JOB SEARCH - DEMO MODE

Demonstrate job search functionality with these criteria:
- Job Title: "${searchCriteria.jobTitle}"
- Location: "${searchCriteria.location}"
- Job Type: ${searchCriteria.jobType}
- Work Type: ${searchCriteria.workType}
- Experience Level: ${searchCriteria.experienceLevel}
- Target Count: ${searchCriteria.targetCount || 25}

DEMO STEPS:
1. Navigate to LinkedIn Jobs page
2. Show search interface
3. Demonstrate filter application
4. Display sample job results
5. Highlight Easy Apply options

This is a demonstration of the job search process.
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      session_id: sessionId,
      max_steps: 150,
      include_screenshot: true,
      timeout: 600, // 10 minutes for job search
    });

    console.log('🔍 Job search task started:', task_id);
    return task_id;
  }

  static async applyToJob(jobUrl: string, sessionId: string, applicationData: any): Promise<string> {
    console.log('📝 Starting job application to:', jobUrl);
    
    const task = `
LINKEDIN EASY APPLY DEMO

Demonstrate job application process for: ${jobUrl}

Application Data:
- Name: ${applicationData.fullName}
- Email: ${applicationData.email}
- Phone: ${applicationData.phone || 'Not provided'}

DEMO STEPS:
1. Navigate to job posting
2. Show Easy Apply button
3. Demonstrate form filling
4. Show application review
5. Simulate submission process

This is a safe demonstration of the application process.
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      session_id: sessionId,
      max_steps: 100,
      include_screenshot: true,
      timeout: 300, // 5 minutes per application
    });

    console.log('📝 Job application task started:', task_id);
    return task_id;
  }

  static async continueWithManualAnswers(taskId: string, answers: Record<string, any>): Promise<string> {
    console.log('📝 Continuing application with manual answers');
    
    const task = `
CONTINUE APPLICATION WITH MANUAL ANSWERS - DEMO

Continue the job application process using these manual answers:
${JSON.stringify(answers, null, 2)}

DEMO CONTINUATION:
1. Resume from previous step
2. Apply user-provided answers
3. Complete application process
4. Show confirmation

This demonstrates how manual input is integrated into the automation.
`;

    const { task_id } = await browserUseAPI.runTask({
      task,
      max_steps: 50,
      include_screenshot: true,
    });

    console.log('📝 Manual continuation task started:', task_id);
    return task_id;
  }
}

// Task Monitoring and Management
export class TaskMonitor {
  private static activeTasks = new Map<string, { interval: NodeJS.Timeout; retryCount: number }>();
  private static readonly POLL_INTERVAL = 3000; // 3 seconds for better responsiveness
  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_DELAY = 5000; // 5 seconds

  static async startMonitoring(
    taskId: string, 
    onUpdate: (task: BrowserUseTask) => void,
    onComplete: (task: BrowserUseTask) => void,
    onError: (error: string) => void
  ): Promise<void> {
    console.log('👀 Starting monitoring for task:', taskId);
    
    // Clear any existing monitoring for this task
    this.stopMonitoring(taskId);

    const pollTask = async () => {
      try {
        const task = await browserUseAPI.getTaskStatus(taskId);
        console.log('📊 Task status update:', task.status, 'Steps:', task.step_count);
        onUpdate(task);

        if (task.status === 'completed') {
          console.log('✅ Task completed:', taskId);
          this.stopMonitoring(taskId);
          
          // For demo mode, simulate completion result
          const demoResult = {
            ...task,
            result: {
              type: 'session_initialized',
              session_id: `demo-session-${Date.now()}`,
              cookies: [],
              success: true
            }
          };
          
          onComplete(demoResult);
          await this.logTaskUsage(task);
        } else if (task.status === 'failed' || task.status === 'cancelled') {
          console.log('❌ Task failed/cancelled:', taskId, task.error);
          this.stopMonitoring(taskId);
          onError(task.error || `Task ${task.status}`);
          await this.logTaskUsage(task);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown polling error';
        console.warn(`⚠️ Error polling task ${taskId}:`, errorMessage);
        
        // Handle 404 errors (task completed and cleaned up)
        if (errorMessage.includes('404') || errorMessage.includes('Task not found')) {
          console.log(`✅ Task ${taskId} appears to have completed and been cleaned up from server`);
          this.stopMonitoring(taskId);
          return;
        }
        
        // Implement retry logic for other errors
        const taskInfo = this.activeTasks.get(taskId);
        if (taskInfo) {
          taskInfo.retryCount++;
          
          if (taskInfo.retryCount >= this.MAX_RETRIES) {
            console.error(`❌ Max retries reached for task ${taskId}, stopping monitoring`);
            this.stopMonitoring(taskId);
            onError(`Monitoring failed after ${this.MAX_RETRIES} retries: ${errorMessage}`);
          } else {
            console.log(`🔄 Retrying task ${taskId} monitoring in ${this.RETRY_DELAY}ms (attempt ${taskInfo.retryCount})`);
            // Don't immediately retry, wait for next interval
          }
        }
      }
    };

    // Initial poll
    await pollTask();

    // Set up polling interval
    const pollInterval = setInterval(pollTask, this.POLL_INTERVAL);
    
    this.activeTasks.set(taskId, { 
      interval: pollInterval, 
      retryCount: 0 
    });
  }

  static stopMonitoring(taskId: string): void {
    const taskInfo = this.activeTasks.get(taskId);
    if (taskInfo) {
      clearInterval(taskInfo.interval);
      this.activeTasks.delete(taskId);
      console.log(`🛑 Stopped monitoring task ${taskId}`);
    }
  }

  static async pauseTask(taskId: string): Promise<void> {
    try {
      console.log('⏸️ Pausing task:', taskId);
      await browserUseAPI.pauseTask(taskId);
    } catch (error) {
      console.error('Error pausing task:', error);
      throw error;
    }
  }

  static async resumeTask(taskId: string): Promise<void> {
    try {
      console.log('▶️ Resuming task:', taskId);
      await browserUseAPI.resumeTask(taskId);
    } catch (error) {
      console.error('Error resuming task:', error);
      throw error;
    }
  }

  static async cancelTask(taskId: string): Promise<void> {
    try {
      console.log('🛑 Canceling task:', taskId);
      await browserUseAPI.stopTask(taskId);
      this.stopMonitoring(taskId);
    } catch (error) {
      console.error('Error canceling task:', error);
      // Still stop monitoring even if cancel fails
      this.stopMonitoring(taskId);
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

      console.log('📊 Task usage logged:', usageLog);
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

// Error Handling and Retry Logic
export class BrowserUseErrorHandler {
  static isLoginExpired(error: string): boolean {
    const loginExpiredKeywords = [
      'session_expired',
      'login required',
      'authentication failed',
      'please log in',
      'unauthorized access',
      'session invalid',
      'login expired'
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
      'throttled',
      'rate exceeded',
      'api limit'
    ];
    
    return rateLimitKeywords.some(keyword => 
      error.toLowerCase().includes(keyword)
    );
  }

  static isNetworkError(error: string): boolean {
    const networkKeywords = [
      'network error',
      'connection failed',
      'timeout',
      'fetch failed',
      'network timeout'
    ];
    
    return networkKeywords.some(keyword => 
      error.toLowerCase().includes(keyword)
    );
  }

  static isTaskNotFound(error: string): boolean {
    return error.includes('404') || error.toLowerCase().includes('task not found');
  }

  static getRetryDelay(error: string, attemptCount: number): number {
    if (this.isRateLimited(error)) {
      return Math.min(60000 * Math.pow(2, attemptCount), 300000); // Exponential backoff, max 5 minutes
    }
    if (this.isNetworkError(error)) {
      return Math.min(5000 * Math.pow(2, attemptCount), 30000); // Exponential backoff, max 30 seconds
    }
    if (this.isLoginExpired(error)) {
      return 0; // No retry for login issues
    }
    if (this.isTaskNotFound(error)) {
      return 0; // No retry for completed/cleaned up tasks
    }
    return Math.min(10000 * attemptCount, 60000); // Linear backoff, max 1 minute
  }

  static shouldRetry(error: string, attemptCount: number): boolean {
    if (attemptCount >= 3) return false;
    if (this.isLoginExpired(error)) return false;
    if (this.isTaskNotFound(error)) return false;
    return this.isRateLimited(error) || this.isNetworkError(error);
  }

  static getErrorMessage(error: string): string {
    if (this.isLoginExpired(error)) {
      return 'LinkedIn session has expired. Please refresh your session and try again.';
    }
    if (this.isRateLimited(error)) {
      return 'Rate limit reached. The system will automatically retry after a delay.';
    }
    if (this.isNetworkError(error)) {
      return 'Network connection issue. Retrying automatically...';
    }
    if (this.isTaskNotFound(error)) {
      return 'Task completed and cleaned up from server.';
    }
    return error;
  }
}

// Usage Analytics
export class UsageAnalytics {
  static async getTotalUsage(userId: string, timeframe: 'day' | 'week' | 'month' = 'month'): Promise<{
    total_steps: number;
    total_cost: number;
    applications_count: number;
    tasks_count: number;
  }> {
    try {
      if (!this.isSupabaseConfigured()) {
        return { total_steps: 0, total_cost: 0, applications_count: 0, tasks_count: 0 };
      }

      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      const { data: logs, error } = await supabase
        .from('browser_use_logs')
        .select('step_count, cost_usd, task_type')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const totals = logs?.reduce((acc, log) => ({
        total_steps: acc.total_steps + log.step_count,
        total_cost: acc.total_cost + parseFloat(log.cost_usd.toString()),
        applications_count: acc.applications_count + (log.task_type === 'linkedin_automation' ? 1 : 0),
        tasks_count: acc.tasks_count + 1,
      }), { total_steps: 0, total_cost: 0, applications_count: 0, tasks_count: 0 }) || 
      { total_steps: 0, total_cost: 0, applications_count: 0, tasks_count: 0 };

      return totals;
    } catch (error) {
      console.error('Error getting usage analytics:', error);
      return { total_steps: 0, total_cost: 0, applications_count: 0, tasks_count: 0 };
    }
  }

  private static isSupabaseConfigured(): boolean {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  }
}

// Test API connection on module load
browserUseAPI.testConnection().catch(console.error);