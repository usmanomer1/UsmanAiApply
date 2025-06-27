import { components, operations } from '../../browser-use-api';

export interface BrowserUseTaskConfig {
  task: string;
  save_browser_data?: boolean;
  use_adblock?: boolean;
  use_proxy?: boolean;
  proxy_country_code?: components['schemas']['ProxyCountryCode'];
  highlight_elements?: boolean;
  browser_viewport_width?: number;
  browser_viewport_height?: number;
  max_agent_steps?: number;
  llm_model?: components['schemas']['LLMModel'];
  allowed_domains?: string[];
}

export interface TaskWithSession {
  id: string;
  task: string;
  live_url?: string | null;
  output: string | null;
  status: components['schemas']['TaskStatusEnum'];
  created_at: string;
  finished_at?: string | null;
  steps: components['schemas']['TaskStepResponse'][];
  browser_data?: components['schemas']['TaskBrowserDataResponse'] | null;
  user_uploaded_files?: string[] | null;
  output_files?: string[] | null;
}

export class BrowserUseClient {
  private apiKey: string;
  private baseUrl: string;
  private lastSuccessfulLogin: string | null = null;

  constructor(apiKey: string, baseUrl: string = 'https://api.browser-use.com/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    
    // Load last successful login timestamp from localStorage
    this.lastSuccessfulLogin = localStorage.getItem('browser-use-last-login');
  }

  /**
   * Create and run a LinkedIn automation task with automatic session persistence
   * Browser-use API automatically handles session persistence when save_browser_data=true
   */
  async createLinkedInTask(config: BrowserUseTaskConfig): Promise<components['schemas']['TaskCreatedResponse']> {
    const taskRequest: components['schemas']['RunTaskRequest'] = {
      task: config.task,
      save_browser_data: true, // Browser-use API handles session persistence automatically
      use_adblock: config.use_adblock ?? true,
      use_proxy: config.use_proxy ?? true,
      proxy_country_code: config.proxy_country_code ?? 'us',
      highlight_elements: config.highlight_elements ?? true,
      browser_viewport_width: config.browser_viewport_width ?? 1280,
      browser_viewport_height: config.browser_viewport_height ?? 960,
      max_agent_steps: config.max_agent_steps ?? 150,
      llm_model: config.llm_model ?? 'gpt-4o',
      allowed_domains: config.allowed_domains ?? ['linkedin.com', '*.linkedin.com'],
      secrets: null,
      structured_output_json: null,
      included_file_names: null
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.baseUrl}/run-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey.trim()}`
        },
        body: JSON.stringify(taskRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your internet connection and try again.');
        } else if (error.message.includes('Failed to fetch')) {
          throw new Error(`Unable to connect to Browser Use API at ${this.baseUrl}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get full task details
   */
  async getTask(taskId: string): Promise<TaskWithSession> {
    const response = await fetch(`${this.baseUrl}/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get task: ${response.statusText}`);
    }

    const task: components['schemas']['TaskResponse'] = await response.json();
    
    return {
      id: task.id,
      task: task.task,
      live_url: task.live_url,
      output: task.output,
      status: task.status,
      created_at: task.created_at,
      finished_at: task.finished_at,
      steps: task.steps,
      browser_data: task.browser_data,
      user_uploaded_files: task.user_uploaded_files,
      output_files: task.output_files
    };
  }

  /**
   * Get task status only
   */
  async getTaskStatus(taskId: string): Promise<components['schemas']['TaskStatusEnum']> {
    const response = await fetch(`${this.baseUrl}/task/${taskId}/status`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get task status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Stop a running task
   */
  async stopTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stop-task?task_id=${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      },
    });

    if (!response.ok && response.status !== 400) {
      // 400 might mean task is already stopped, which is okay
      const errorText = await response.text().catch(() => 'Unknown error');
      if (!errorText.includes('already stopped')) {
        throw new Error(`Failed to stop task (${response.status}): ${errorText}`);
      }
    }
  }

  /**
   * Pause a running task
   */
  async pauseTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/pause-task?task_id=${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to pause task: ${response.statusText}`);
    }
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/resume-task?task_id=${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to resume task: ${response.statusText}`);
    }
  }

  /**
   * Check if we have a recent successful login (within 7 days)
   * This is a rough estimate - browser-use API manages the actual session
   */
  hasRecentLogin(): boolean {
    if (!this.lastSuccessfulLogin) return false;
    
    const lastLogin = parseInt(this.lastSuccessfulLogin);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    return lastLogin > sevenDaysAgo;
  }

  /**
   * Mark that a successful login occurred
   * Call this when automation successfully completes login
   */
  markSuccessfulLogin(): void {
    this.lastSuccessfulLogin = Date.now().toString();
    localStorage.setItem('browser-use-last-login', this.lastSuccessfulLogin);
  }

  /**
   * Clear the login timestamp
   * This doesn't clear browser-use's actual session, just our local tracking
   */
  clearLoginRecord(): void {
    this.lastSuccessfulLogin = null;
    localStorage.removeItem('browser-use-last-login');
  }

  /**
   * Get days since last successful login
   */
  getDaysSinceLastLogin(): number | null {
    if (!this.lastSuccessfulLogin) return null;
    
    const lastLogin = parseInt(this.lastSuccessfulLogin);
    const daysDiff = Math.floor((Date.now() - lastLogin) / (24 * 60 * 60 * 1000));
    
    return daysDiff;
  }

  /**
   * Delete the browser profile for this user account
   * This clears the actual browser session data on browser-use servers
   */
  async clearBrowserProfile(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/delete-browser-profile-for-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear browser profile: ${response.statusText}`);
    }

    // Also clear our local tracking
    this.clearLoginRecord();
  }
} 