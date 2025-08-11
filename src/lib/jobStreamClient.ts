import { supabase } from './supabase';

export interface Job {
  job_id: string;
  employer_name: string;
  employer_logo?: string;
  job_title: string;
  job_description: string;
  job_apply_link: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote: boolean;
  job_posted_at_datetime_utc?: string;
  match_score?: number;
  missing_skills?: string[];
  matching_skills?: string[];
  // Add other fields as needed
}

export interface SearchParams {
  resumeText: string;
  query: string;
  location?: string;
  filters?: {
    datePosted?: string;
    remote?: boolean;
    employmentTypes?: string[];
    experienceLevel?: string[];
    radius?: number;
  };
  numJobs?: number;
}

export interface StreamCallbacks {
  onConnected?: (sessionId: string) => void;
  onSearchStarted?: (data: any) => void;
  onJobsFound?: (total: number, fetchTime: number) => void;
  onJob?: (job: Job) => void;
  onBatch?: (batch: { jobs: Job[]; batchIndex: number; isLastBatch: boolean; processedCount: number; totalCount: number }) => void;
  onProgress?: (processed: number, total: number) => void;
  onComplete?: (totalProcessed: number) => void;
  onError?: (error: string) => void;
}

export class JobStreamClient {
  private backendUrl: string;

  constructor(backendUrl: string = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') {
    this.backendUrl = backendUrl;
  }

  async streamJobs(params: SearchParams, callbacks: StreamCallbacks): Promise<void> {
    // Get Supabase session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    try {
      // Initiate SSE stream with POST request
      const response = await fetch(`${this.backendUrl}/api/jobs/match/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          sessionId: `frontend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start job stream: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split by double newline (SSE message separator)
        const messages = buffer.split('\n\n');
        
        // Keep the last incomplete message in the buffer
        buffer = messages.pop() || '';

        // Process complete messages
        for (const message of messages) {
          if (!message.trim()) continue;

          // Parse SSE format
          const lines = message.split('\n');
          let event = '';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              event = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              data = line.slice(5).trim();
            }
          }

          if (!event || !data) continue;

          try {
            const parsedData = JSON.parse(data);

            // Handle different event types
            switch (event) {
              case 'connected':
                callbacks.onConnected?.(parsedData.sessionId);
                break;

              case 'search_started':
                callbacks.onSearchStarted?.(parsedData);
                break;

              case 'jobs_found':
                callbacks.onJobsFound?.(parsedData.totalFound, parsedData.fetchTime);
                break;

              case 'batch':
                // Call both individual job callback and batch callback
                if (callbacks.onJob) {
                  for (const job of parsedData.jobs) {
                    callbacks.onJob(job);
                  }
                }
                callbacks.onBatch?.(parsedData);
                callbacks.onProgress?.(parsedData.processedCount, parsedData.totalCount);
                break;

              case 'complete':
                callbacks.onComplete?.(parsedData.totalProcessed);
                break;

              case 'error':
                callbacks.onError?.(parsedData.error);
                break;

              case 'batch_error':
                console.error(`Batch ${parsedData.batchIndex} error:`, parsedData.error);
                callbacks.onError?.(`Failed to process batch ${parsedData.batchIndex + 1}`);
                break;

              default:
                console.log(`Unknown event: ${event}`, parsedData);
            }
          } catch (err) {
            console.error('Failed to parse SSE data:', err, data);
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      callbacks.onError?.(error instanceof Error ? error.message : 'Stream failed');
      throw error;
    }
  }

  // Alternative method for environments that don't support streaming
  async searchJobs(params: SearchParams): Promise<Job[]> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.backendUrl}/api/jobs/match`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to search jobs: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.jobs || [];
  }
}

// Create singleton instance
export const jobStreamClient = new JobStreamClient();