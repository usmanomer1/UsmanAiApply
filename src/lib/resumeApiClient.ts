import { API_CONFIG } from '../config/api';
import { canPerformAIOperation, trackAITokens } from './aiTokenTracking';

const CACHE_DURATION = 23 * 60 * 60 * 1000; // 23 hours in milliseconds

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Simple in-memory token cache
const tokenCache: Map<string, TokenCache> = new Map();

export async function getApiToken(userId: string): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    console.log('Using cached API token');
    return cached.token;
  }

  const baseUrl = API_CONFIG.RESUME_OPTIMIZER.BASE_URL;
  
  console.log('Getting API token for user:', userId);
  console.log('Token endpoint:', `${baseUrl}/api/auth/token`);
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    console.log('Token response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token request failed:', response.status, errorText);
      throw new Error(`Failed to get API token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Token received successfully:', data);
    
    // Cache the token
    tokenCache.set(userId, {
      token: data.access_token,
      expiresAt: Date.now() + CACHE_DURATION
    });
    
    return data.access_token;
  } catch (error) {
    console.error('Error fetching token:', error);
    throw error;
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
  const { allowed, reason } = await canPerformAIOperation(userId);
  if (!allowed) {
    throw new Error(reason || 'Insufficient AI tokens for resume optimization');
  }
  
  let token: string;
  try {
    token = await getApiToken(userId);
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
        // Clear cached token on auth error
        tokenCache.delete(userId);
        throw new Error('Session expired. Please try again.');
      } else if (response.status === 429) {
        throw new Error('Too many requests. Please wait a minute and try again.');
      }
      
      throw new Error(`Failed to analyze resume: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Analysis complete:', result);
    
    // Track successful analysis (deduct tokens on analyze, not generate)
    await trackAITokens(userId, 'resume_optimization', {
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
  const token = await getApiToken(userId);
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
    
    if (response.status === 404) {
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
  const token = await getApiToken(userId);
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