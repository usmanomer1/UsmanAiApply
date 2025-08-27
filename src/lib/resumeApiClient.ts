import { API_CONFIG } from '../config/api';
import { canPerformAction, trackAITokenUsage } from './usageTracking';
import { supabase } from './supabase';

/**
 * Get the current Supabase session token for API authentication
 * The backend now uses Supabase JWT tokens directly
 */
export async function getApiToken(): Promise<string> {
  console.log('Getting Supabase session token for API calls');
  
  try {
    // Get current session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting Supabase session:', error);
      throw new Error('Failed to get authentication session');
    }
    
    if (!session) {
      console.error('No active session found');
      throw new Error('User not authenticated. Please login first.');
    }
    
    console.log('Session token obtained successfully');
    return session.access_token;
  } catch (error) {
    console.error('Error getting session token:', error);
    throw error;
  }
}

/**
 * Refresh the Supabase session token if needed
 */
async function refreshToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error || !session) {
      console.error('Failed to refresh session:', error);
      return null;
    }
    
    console.log('Session refreshed successfully');
    return session.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// API response types matching backend specs
export interface AnalyzeResponse {
  success: boolean;
  data: {
    analysisId: string;
    summary: {
      overallScore: number;
      keywordMatches: string[];
      missingSkills: string[];
      suggestions: string[];
    };
    sections: Array<{
      id: string;
      type: string;
      original: string;
      suggested: string;
      improvements: string[];
    }>;
    skills: {
      current: string[];
      suggested: string[];
      relevanceScores: Record<string, number>;
    };
  };
}

export interface GenerateResponse {
  success: boolean;
  data: {
    generationId: string;
    status: 'completed' | 'failed';
    downloadUrl: string;
    filename: string;
    expiresIn: number;
    message: string;
  };
}

export async function analyzeResume(
  userId: string,
  resumeFile: File,
  jobDescription: string,
  jobTitle: string,
  companyName: string
): Promise<AnalyzeResponse> {
  console.log('analyzeResume API function called');
  console.log('User ID:', userId);
  console.log('File:', resumeFile.name, resumeFile.size, resumeFile.type);
  
  // Check AI token limits before making API call
  const { allowed, reason } = await canPerformAction(userId, 'resume_optimization');
  if (!allowed) {
    throw new Error(reason || 'Insufficient AI tokens for resume optimization');
  }
  
  let token: string;
  try {
    token = await getApiToken();
    console.log('Token obtained successfully');
  } catch (error) {
    console.error('Failed to get token:', error);
    throw error;
  }
  
  const baseUrl = API_CONFIG.RESUME_OPTIMIZER.BASE_URL;
  const analyzeUrl = `${baseUrl}${API_CONFIG.RESUME_OPTIMIZER.ENDPOINTS.RESUME_ANALYZE}`;
  
  console.log('Analyzing resume...');
  console.log('Analyze endpoint:', analyzeUrl);
  
  // Create FormData as specified in the backend docs
  const formData = new FormData();
  formData.append('resume', resumeFile);
  formData.append('job_description', jobDescription);
  formData.append('job_title', jobTitle);
  formData.append('company_name', companyName);
  
  console.log('FormData created, making fetch request...');
  
  try {
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        // Don't set Content-Type - let browser set it for FormData
      },
      body: formData,
    });

    console.log('Response received:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Analyze request failed:', response.status, errorText);
      
      // Handle specific error codes
      if (response.status === 401) {
        // Try to refresh token and retry
        console.log('Token expired, attempting to refresh...');
        const newToken = await refreshToken();
        if (newToken) {
          // Retry with new token
          const retryResponse = await fetch(analyzeUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Accept': 'application/json',
            },
            body: formData,
          });
          
          if (retryResponse.ok) {
            const result = await retryResponse.json();
            await trackAITokenUsage(userId, 'resume_optimization', { tokens_used: 1 });
            return result;
          }
        }
        throw new Error('Session expired. Please login again.');
      } else if (response.status === 429) {
        throw new Error('Too many requests. Please wait a minute and try again.');
      }
      
      throw new Error(`Failed to analyze resume: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Analysis complete:', result);
    
    // Track successful analysis (deduct tokens on analyze, not generate)
    await trackAITokenUsage(userId, 'resume_optimization', {
      jobTitle,
      companyName,
      analysisId: result.data?.analysisId,
      operation: 'analyze'
    });
    
    return result;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

export async function generateOptimizedResume(
  userId: string,
  analysisId: string,
  editType: 'full' | 'quick' = 'full',
  selectedSections: string[] = [],
  selectedSkills: string[] = [],
  additionalInstructions: string = ''
): Promise<GenerateResponse> {
  const token = await getApiToken();
  const baseUrl = API_CONFIG.RESUME_OPTIMIZER.BASE_URL;
  
  console.log('Generating optimized resume...');
  console.log('Generate endpoint:', `${baseUrl}${API_CONFIG.RESUME_OPTIMIZER.ENDPOINTS.RESUME_GENERATE}`);
  
  const response = await fetch(`${baseUrl}${API_CONFIG.RESUME_OPTIMIZER.ENDPOINTS.RESUME_GENERATE}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      analysisId,
      editType,
      selectedSections,
      selectedSkills,
      additionalInstructions
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Generate request failed:', response.status, errorText);
    
    if (response.status === 401) {
      // Try to refresh token and retry
      console.log('Token expired, attempting to refresh...');
      const newToken = await refreshToken();
      if (newToken) {
        // Retry with new token
        const retryResponse = await fetch(`${baseUrl}${API_CONFIG.RESUME_OPTIMIZER.ENDPOINTS.RESUME_GENERATE}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            analysisId,
            editType,
            selectedSections,
            selectedSkills,
            additionalInstructions
          }),
        });
        
        if (retryResponse.ok) {
          const result = await retryResponse.json();
          return result;
        }
      }
      throw new Error('Session expired. Please login again.');
    } else if (response.status === 404) {
      throw new Error('Analysis not found or expired. Please analyze again.');
    } else if (response.status === 429) {
      throw new Error('Too many requests. Please wait a minute and try again.');
    }
    
    throw new Error(`Failed to generate resume: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('Generation complete:', result);
  return result;
}

export async function downloadResume(
  userId: string,
  generationId: string
): Promise<string> {
  const token = await getApiToken();
  const baseUrl = API_CONFIG.RESUME_OPTIMIZER.BASE_URL;
  
  // Return the download URL with token
  return `${baseUrl}${API_CONFIG.RESUME_OPTIMIZER.ENDPOINTS.RESUME_DOWNLOAD}/${generationId}?token=${token}`;
}

// Utility function to validate file
export function validateResumeFile(file: File): string | null {
  if (!file) return "Please select a file";
  if (file.type !== 'application/pdf') return "Only PDF files are allowed";
  if (file.size > 10 * 1024 * 1024) return "File must be less than 10MB";
  return null;
}

/**
 * Optional: Verify authentication with the backend
 * Can be used to check if the Supabase token is valid for the API
 */
export async function verifyAuth(): Promise<boolean> {
  try {
    const token = await getApiToken();
    const baseUrl = API_CONFIG.RESUME_OPTIMIZER.BASE_URL;
    
    const response = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Auth verified:', data);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return false;
  }
}

// Error message helper
export function getErrorMessage(error: any): string {
  if (error?.message) {
    return error.message;
  }
  
  const errorMessages: Record<number, string> = {
    401: "Session expired. Please log in again.",
    429: "Too many requests. Please wait a minute.",
    500: "Something went wrong. Please try again."
  };
  
  return errorMessages[error?.status] || "An error occurred. Please try again.";
}