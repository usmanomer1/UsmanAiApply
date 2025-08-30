import { supabase } from './supabase';

export interface BrowserUseConfig {
  jobTitle: string;
  location: string;
  targetCount: number;
  linkedinEmail: string;
  linkedinPassword?: string;
  customInstructions?: string;
  extractJobs?: boolean;
  resumeContent?: string;
  applyToExternalJobs?: boolean;
  uploadedFileName?: string;
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
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      'Content-Type': 'application/json',
    };
  }

  async createTask(config: BrowserUseConfig) {
    const headers = await this.getAuthHeaders();
    
    // Build the task prompt with password handling
    const task = this.buildTaskPrompt(config);
    
    // Include uploaded file if provided
    const taskConfig: any = {
      ...config,
      task,
      extractJobs: true,
    };
    
    if (config.uploadedFileName) {
      taskConfig.included_file_names = [config.uploadedFileName];
    }
    
    const response = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create',
        config: taskConfig,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create task');
    }

    return response.json();
  }

  private buildTaskPrompt(config: BrowserUseConfig): string {
    const { jobTitle, location, targetCount, linkedinEmail, customInstructions, resumeContent, applyToExternalJobs, uploadedFileName } = config;
    
    let prompt = `You are an AI assistant helping with LinkedIn job applications. Your goal is to apply to ${targetCount} jobs ${applyToExternalJobs ? '(including both Easy Apply and external job postings)' : 'using LinkedIn\'s "Easy Apply" feature'}.

IMPORTANT: You have been provided with credentials to login automatically:
- Email: ${linkedinEmail}
- Password is provided securely in the secrets

CRITICAL - LOGIN HANDLING:
1. Go to LinkedIn (linkedin.com)
2. Login using the provided credentials automatically
3. If you encounter 2FA/two-factor authentication:
   - DO NOT mark the task as failed or done
   - Wait on the 2FA page for the user to manually enter the code
   - The user will enter the code manually in the live browser view
   - After waiting 30 seconds, check if you're logged in and continue
   - If still on 2FA page after 30 seconds, wait another 30 seconds
4. If you see a login page, login modal, or "Sign in" overlay:
   - Take a screenshot of the page
   - Include the exact text: "INTERVENTION:LOGIN_REQUIRED - Manual login needed"
   - Then simply wait (use wait action for 30 seconds)
   - DO NOT search for this text on Google
   - DO NOT use done() - this would end the entire automation
   - The system will detect the intervention text and pause
   - After manual login, the automation will resume automatically

STEP-BY-STEP PROCESS:
1. Navigate directly to: https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}&sortBy=DD
2. Wait 3-5 seconds for the page to fully load before proceeding
3. Check if login is required - if you see any login modal or sign-in overlay, output "INTERVENTION:LOGIN_REQUIRED - Manual login needed"
4. After login is complete and you're on the jobs page, look for the left sidebar with job listings
5. Look for jobs with ${applyToExternalJobs ? '"Easy Apply" buttons OR external application links' : '"Easy Apply" buttons'} in the job listings
6. For each job (continue until you reach ${targetCount} applications):
   a. BEFORE clicking any apply button, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"
   b. Extract the actual company name from the job posting (not generic terms)
   c. Extract the exact job title from the posting
   d. Click the "Easy Apply" button
   e. Fill out the application form (ALWAYS scroll down to see all fields - some are hidden below)
   f. Answer any questions that appear (scroll down after each answer to see more questions)
   g. For multi-step forms: Complete current step, then scroll down to find "Next" or "Continue" button
   h. ${uploadedFileName ? `RESUME HANDLING: When prompted to upload a resume:
      * The file "${uploadedFileName}" is already available in the system
      * Click the "Upload Resume" or "Choose File" button
      * The file will be automatically uploaded
      * You don't need to browse for files - just click the upload button
      * The system has the file ready for automatic upload` : 'Skip resume upload if no file is provided'}
   i. CRITICAL: ALWAYS SCROLL DOWN to find the "Submit" or "Submit application" button
      - The submit button is ALWAYS at the bottom of the form
      - Keep scrolling down until you see the submit button
      - Look for buttons like "Submit", "Submit application", "Apply", or "Send application"
   j. Before clicking submit, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   k. Click the submit button to complete the application
   l. Close the modal and move to the next job

7. Continue applying to jobs until you've completed ${targetCount} applications
8. If you run out of Easy Apply jobs on the current page:
   - Scroll down to load more jobs or click "See more jobs" if available
   - Try adjusting filters or broadening search criteria
   - Only stop when you've reached the target or no more suitable jobs are available

🚨 CRITICAL SCROLLING INSTRUCTIONS - MUST FOLLOW:
- **MANDATORY**: ALWAYS scroll down when you can't find buttons like "Submit", "Next", "Continue", or "Apply"
- **SUBMIT BUTTON RULE**: The submit button is NEVER visible without scrolling down - this is LinkedIn's design
- **KEEP SCROLLING**: If you don't see a submit button, keep scrolling down until you find it
- **LinkedIn FORM BEHAVIOR**: LinkedIn forms often have content below the fold - scroll to reveal hidden elements
- **FORM COMPLETION**: If you encounter form questions but can't see all of them, scroll down to see more questions
- **TROUBLESHOOTING**: When stuck on any form, try scrolling both up and down to find missing elements
- **FINAL REVIEW PAGE**: On the final review page, the submit button is always at the bottom - scroll to find it
- **NEVER SKIP**: Never assume there's no submit button - always scroll down to look for it

📝 SUBMISSION PROCESS - CRITICAL:
1. **FIND THE SUBMIT BUTTON**: After filling all fields, scroll to the very bottom of the form
2. **BUTTON VARIATIONS**: Look for "Submit", "Submit application", "Apply", "Send application", or "Review and submit"
3. **SCROLL PERSISTENCE**: If you don't see any submit button, keep scrolling down - it exists
4. **PAGE COMPLETION**: Make sure all required fields are filled before the submit button becomes active
5. **FINAL ACTION**: Click the submit button only after scrolling down and finding it
6. **CONFIRMATION**: Wait for LinkedIn to show a success message or redirect before moving to next job

COMPANY NAME EXTRACTION REQUIREMENTS:
- Extract the ACTUAL company name from the LinkedIn job posting
- Company names appear in these locations on LinkedIn:
  * Directly below or next to the job title
  * In the format "Job Title at Company Name" 
  * As a clickable company link/button
  * In the job details section
- CRITICAL: Always announce the company name you see BEFORE clicking Easy Apply
- Format: "I can see this is a [JOB TITLE] position at [COMPANY NAME]"
- DO NOT use generic terms like "Company", "Employer", "Organization", "LinkedIn Company"
- Examples of REAL company names: "Google", "Microsoft", "Meta", "Apple", "Netflix", "Shopify", "Stripe"
- If you cannot find the actual company name, announce "Unable to identify company name" and skip this job

JOB TITLE EXTRACTION REQUIREMENTS:
- Extract the EXACT job title from the posting
- Use the full title as displayed on LinkedIn
- Examples: "Senior Software Engineer", "Product Manager", "Data Scientist"

🔧 FORM HANDLING GUIDELINES - LINKEDIN EASY APPLY:
- **ESSENTIAL**: Always scroll down in Easy Apply forms to ensure you see all content
- **SUBMIT BUTTON LOCATION**: Submit buttons are ALWAYS at the bottom - never visible without scrolling
- **MULTI-STEP PROCESS**: LinkedIn Easy Apply often has 2-4 steps with Next/Continue buttons between them
- **STEP NAVIGATION**: For multi-step forms, look for "Next" or "Continue" buttons (ALWAYS scroll down to find them)
- **COMPLETE ALL FIELDS**: If forms have multiple questions, scroll to see all questions before proceeding
- **FORM VALIDATION**: LinkedIn will not show the submit button until all required fields are filled
- **FINAL REVIEW**: The last step is usually a review page - scroll down to find the final submit button
${uploadedFileName ? `- 🔧 RESUME UPLOAD: When prompted to upload a resume/CV:
  * Look for the "Upload Resume" or "Choose File" button
  * Click it to trigger the upload dialog
  * The file "${uploadedFileName}" will be automatically uploaded
  * The system has pre-loaded this file for you
  * You don't need to browse or select - just click the upload button
  * If LinkedIn shows existing resumes, you can ignore them - use the upload option` : ''}
- Skip optional fields if they're complex, but fill required fields
- If a form seems stuck, try scrolling up and down to find missing elements

${resumeContent ? `
USER'S RESUME CONTENT FOR REFERENCE:
${resumeContent}

Use this resume information to:
- Answer questions about experience, skills, and qualifications
- Fill in work history and education sections
- Provide accurate information about the candidate's background
- Make informed decisions when answering screening questions
` : ''}

🤖 DYNAMIC FIELD HANDLING:
- For fields that are dynamic and you don't have specific information to input, make EDUCATED GUESSES
- Use context clues from the job posting, company, and role to provide reasonable answers
- Examples of educated guesses:
  * Years of experience: Base on the job level (entry=1-2, mid=3-5, senior=5+)
  * Salary expectations: Research typical ranges for the role/location
  * Availability: Default to "2 weeks notice" or "Available immediately"
  * Skills questions: Answer positively if it's related to the job title
  * Certifications: Only claim if commonly associated with the role
- NEVER leave required fields blank - always provide a reasonable guess
- For yes/no questions about skills/experience, err on the side of confidence if it's job-relevant
- For text fields asking "Why are you interested?", provide a brief, professional response based on the company/role

${customInstructions ? `
Additional Instructions: ${customInstructions}
` : ''}

PROGRESS TRACKING:
- Keep count of how many applications you've submitted
- Announce progress: "APPLICATION #X of ${targetCount} COMPLETED"
- Continue until you reach exactly ${targetCount} applications

IMPORTANT: 
- ${applyToExternalJobs ? 'Apply through Easy Apply when available, or external sites if needed' : 'Use the Easy Apply feature only, skip jobs that require external applications'}
- Extract job details for all applied positions
- If login fails with wrong credentials, output "INTERVENTION:LOGIN_REQUIRED"
- If 2FA is required, DO NOT fail the task - wait for user to enter the code manually in the browser
- NEVER mark the task as done(success=False) when encountering 2FA - always wait and continue`;

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

  async uploadFile(file: File): Promise<string> {
    const headers = await this.getAuthHeaders();
    
    // Get presigned URL from Browser-use API
    const presignedResponse = await fetch(`${this.baseUrl}/browser-use-controller`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'upload-file',
        file_name: file.name,
        content_type: file.type,
      }),
    });

    if (!presignedResponse.ok) {
      const error = await presignedResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }

    const { upload_url } = await presignedResponse.json();
    
    // Upload the file to the presigned URL
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return file.name;
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

      // Use fetch-based SSE since EventSource doesn't support custom headers
      this.streamWithFetch(taskId, session.access_token, onMessage, onError);
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
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
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