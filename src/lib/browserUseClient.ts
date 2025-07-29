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
  secrets?: { [key: string]: string } | null;
  included_file_names?: string[] | null;
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
   * Create and run a LinkedIn automation task
   * 
   * IMPORTANT SECURITY NOTE:
   * save_browser_data is set to FALSE to prevent session sharing between users.
   * Since all users share the same API key, enabling save_browser_data would allow
   * User B to access User A's LinkedIn session, creating a critical security vulnerability.
   * 
   * Until Browser Use supports user-specific profiles under one API key, each user
   * must login manually for every automation session.
   */
  async createLinkedInTask(config: BrowserUseTaskConfig): Promise<components['schemas']['TaskCreatedResponse']> {
    const taskRequest: components['schemas']['RunTaskRequest'] = {
      task: config.task,
      save_browser_data: false, // CRITICAL: Disabled to prevent session sharing between users - all users share one API key
      use_adblock: config.use_adblock ?? true,
      use_proxy: config.use_proxy ?? true,
      proxy_country_code: config.proxy_country_code ?? 'us',
      highlight_elements: config.highlight_elements ?? true,
      browser_viewport_width: config.browser_viewport_width ?? 1280,
      browser_viewport_height: config.browser_viewport_height ?? 960,
      max_agent_steps: config.max_agent_steps ?? 150,
      llm_model: config.llm_model ?? 'gpt-4o',
      allowed_domains: config.allowed_domains,  // Don't default to LinkedIn-only domains
      secrets: config.secrets ?? null,
      structured_output_json: null,
      included_file_names: config.included_file_names ?? null
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
   * Upload a file to browser-use storage
   * @param file The file to upload
   * @returns The filename that can be used in included_file_names
   */
  async uploadFile(file: File): Promise<string> {
    try {
      // Step 1: Get presigned URL
      const presignedResponse = await fetch(`${this.baseUrl}/uploads/presigned-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type || 'application/octet-stream',
        }),
      });

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        throw new Error(`Failed to get presigned URL: ${errorText}`);
      }

      const { upload_url }: components['schemas']['UploadFileResponse'] = await presignedResponse.json();

      // Step 2: Upload file to presigned URL
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // Return the filename to use in included_file_names
      return file.name;
    } catch (error) {
      console.error('Error uploading file:', error);
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
    
    console.log('Raw task response from API:', task);
    console.log('Task live_url from API:', task.live_url);
    
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
   * Delete all browser profiles for this API key
   * This clears the actual browser session data on browser-use servers
   */
  async clearBrowserProfile(): Promise<void> {
    try {
      // First, list all browser profiles
      const listResponse = await fetch(`${this.baseUrl}/browser-profiles`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey.trim()}`,
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text().catch(() => 'Unknown error');
        console.error(`Failed to list browser profiles (${listResponse.status}): ${errorText}`);
        throw new Error(`Failed to list browser profiles (${listResponse.status}): ${listResponse.statusText}`);
      }

      const profilesData = await listResponse.json();
      const profiles = profilesData.profiles || profilesData.data || [];
      
      console.log(`Found ${profiles.length} browser profiles to delete`);

      // Delete each profile
      for (const profile of profiles) {
        const profileId = profile.id || profile.profile_id;
        if (!profileId) continue;

        const deleteResponse = await fetch(`${this.baseUrl}/browser-profiles/${profileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiKey.trim()}`,
          },
        });

        if (!deleteResponse.ok) {
          console.error(`Failed to delete profile ${profileId}: ${deleteResponse.statusText}`);
          // Continue trying to delete other profiles
        } else {
          console.log(`Deleted browser profile: ${profileId}`);
        }
      }

      // Also clear our local tracking
      this.clearLoginRecord();
    } catch (error) {
      console.error('Error clearing browser profiles:', error);
      throw error;
    }
  }
} 