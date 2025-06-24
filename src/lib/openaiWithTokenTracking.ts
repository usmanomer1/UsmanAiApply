import { supabase } from './supabase';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Token limits per operation type
const OPERATION_TOKEN_LIMITS = {
  resume_score: 3000,
  resume_critique: 3000,
  resume_rewrite: 6000,
  cover_letter: 6000,
  cv_generation: 6000,
  company_research: 3000,
} as const;

// Monthly token limit for all subscription tiers
const MONTHLY_TOKEN_LIMIT = 150000; // 150k tokens

export type OperationType = keyof typeof OPERATION_TOKEN_LIMITS;

export interface TokenUsageStats {
  totalTokens: number;
  operationCounts: Record<string, number>;
  monthlyLimit: number;
  remainingTokens: number;
  usagePercentage: number;
}

export interface OpenAIResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ResumeAnalysisRequest {
  resumeText: string;
  industry: string;
  experienceLevel: string;
  targetRole: string;
  desiredSalary?: string;
  location?: string;
}

export interface ResumeScore {
  overall: number;
  categories: {
    content: number;
    formatting: number;
    skills: number;
    experience: number;
    keywords: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ResumeCritique {
  sections: {
    name: string;
    score: number;
    feedback: string;
    suggestions: string[];
  }[];
  overallFeedback: string;
  actionItems: string[];
  industryAlignment: string;
}

export interface ResumeRewrite {
  improvedResume: string;
  changes: string[];
  reasoning: string;
  industryOptimizations: string[];
}

class OpenAIServiceWithTokenTracking {
  private async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      throw new Error('Authentication required');
    }
    
    if (!user.id) {
      throw new Error('User ID is missing from authentication data');
    }
    
    return user;
  }

  private async getUserSubscriptionStatus(): Promise<{ hasActiveSubscription: boolean; status?: string }> {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status')
        .single();
      
      if (error || !data) {
        return { hasActiveSubscription: false };
      }
      
      return {
        hasActiveSubscription: data.subscription_status === 'active',
        status: data.subscription_status
      };
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return { hasActiveSubscription: false };
    }
  }

  private async checkTokenLimit(operationType: OperationType): Promise<void> {
    const user = await this.getCurrentUser();
    
    try {
      const { data: canMakeRequest, error } = await supabase.rpc('can_user_make_ai_request', {
        user_uuid: user.id,
        estimated_tokens: OPERATION_TOKEN_LIMITS[operationType]
      });
      
      if (error) {
        console.error('Error checking token limit:', error);
        throw new Error('Unable to verify token usage limits');
      }
      
      if (!canMakeRequest) {
        const subscriptionInfo = await this.getUserSubscriptionStatus();
        
        if (!subscriptionInfo.hasActiveSubscription) {
          throw new Error('Active subscription required. Subscribe to Pro, Pro Plus, or Extreme plan to access AI-powered features.');
        } else {
          throw new Error(`Monthly token limit of ${MONTHLY_TOKEN_LIMIT.toLocaleString()} tokens exceeded. Usage resets monthly on your billing cycle.`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to check token limits');
    }
  }

  private async trackTokenUsage(
    operationType: OperationType,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    maxTokensRequested: number,
    requestData: any = {},
    responseData: any = {}
  ): Promise<void> {
    const user = await this.getCurrentUser();
    
    // Calculate cost (approximate for gpt-4o-mini)
    const costPer1KTokens = 0.00015; // $0.00015 per 1K tokens for gpt-4o-mini
    const cost = (usage.total_tokens / 1000) * costPer1KTokens;
    
    try {
      const { error } = await supabase.from('ai_token_usage').insert({
        user_id: user.id,
        operation_type: operationType,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        max_tokens_requested: maxTokensRequested,
        model_used: 'gpt-4o-mini',
        request_data: requestData,
        response_data: responseData,
        cost_usd: cost
      });
      
      if (error) {
        console.error('Error tracking token usage:', error);
      }
    } catch (error) {
      console.error('Error tracking token usage:', error);
      // Don't throw here - we don't want to fail the request just because tracking failed
    }
  }

  private cleanJsonResponse(content: string): string {
    // Remove markdown code block delimiters
    let cleaned = content.trim();
    
    // Remove ```json at the beginning
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    
    // Remove ``` at the end
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    
    return cleaned.trim();
  }

  private async makeRequest(
    messages: any[], 
    maxTokens: number,
    operationType: OperationType,
    requestMetadata: any = {}
  ): Promise<OpenAIResponse> {
    // Check token limit before making request
    await this.checkTokenLimit(operationType);

    // Validate API key
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found in environment variables! Make sure VITE_OPENAI_API_KEY is set in your .env file.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.statusText}${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`);
      }

      const data = await response.json();
      const rawContent = data.choices[0].message.content;
      const usage = data.usage;

      // Clean the content to remove markdown code blocks
      const cleanedContent = this.cleanJsonResponse(rawContent);

      // Track token usage
      await this.trackTokenUsage(
        operationType,
        usage,
        maxTokens,
        requestMetadata,
        { content_length: cleanedContent.length }
      );

      return {
        content: cleanedContent,
        usage
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to process AI request. Please try again.');
    }
  }

  async getTokenUsageStats(): Promise<TokenUsageStats> {
    try {
      const user = await this.getCurrentUser();
      
      const { data, error } = await supabase.rpc('get_user_monthly_ai_tokens', {
        user_uuid: user.id,
        target_date: new Date().toISOString().split('T')[0]
      });
      
      if (error) {
        console.error('Supabase RPC error:', error);
        // Return default stats instead of throwing
        return {
          totalTokens: 0,
          operationCounts: {},
          monthlyLimit: MONTHLY_TOKEN_LIMIT,
          remainingTokens: MONTHLY_TOKEN_LIMIT,
          usagePercentage: 0
        };
      }
      
      // Handle the case where data is an array or single object
      const result = Array.isArray(data) ? data[0] : data;
      const totalTokens = Number(result?.total_tokens) || 0;
      const operationCounts = result?.operation_counts || {};
      const remainingTokens = Math.max(0, MONTHLY_TOKEN_LIMIT - totalTokens);
      const usagePercentage = Math.min(100, (totalTokens / MONTHLY_TOKEN_LIMIT) * 100);
      
      return {
        totalTokens,
        operationCounts,
        monthlyLimit: MONTHLY_TOKEN_LIMIT,
        remainingTokens,
        usagePercentage
      };
    } catch (error) {
      console.error('Error fetching token usage stats:', error);
      
      // Return default stats if there's an error
      return {
        totalTokens: 0,
        operationCounts: {},
        monthlyLimit: MONTHLY_TOKEN_LIMIT,
        remainingTokens: MONTHLY_TOKEN_LIMIT,
        usagePercentage: 0
      };
    }
  }

  async scoreResume(request: ResumeAnalysisRequest): Promise<ResumeScore> {
    const messages = [
      {
        role: 'system',
        content: `You are an expert resume analyst and career coach. Analyze the provided resume and return a detailed scoring breakdown in JSON format. Consider industry standards for ${request.industry} and ${request.experienceLevel} level positions.`
      },
      {
        role: 'user',
        content: `
Please analyze this resume for a ${request.experienceLevel} ${request.targetRole} position in ${request.industry}:

Resume Content:
${request.resumeText}

Return a JSON object with this exact structure:
{
  "overall": <number 0-100>,
  "categories": {
    "content": <number 0-100>,
    "formatting": <number 0-100>,
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "keywords": <number 0-100>
  },
  "strengths": [<array of 3-5 key strengths>],
  "weaknesses": [<array of 3-5 main weaknesses>],
  "recommendations": [<array of 5-7 specific actionable recommendations>]
}

Focus on industry-specific requirements and ATS optimization.`
      }
    ];

    const response = await this.makeRequest(
      messages, 
      OPERATION_TOKEN_LIMITS.resume_score, 
      'resume_score',
      { industry: request.industry, experienceLevel: request.experienceLevel, targetRole: request.targetRole }
    );
    
    return JSON.parse(response.content);
  }

  async critiqueResume(request: ResumeAnalysisRequest): Promise<ResumeCritique> {
    const messages = [
      {
        role: 'system',
        content: `You are a senior hiring manager and resume expert specializing in ${request.industry}. Provide detailed, constructive criticism and actionable feedback.`
      },
      {
        role: 'user',
        content: `
Please provide a comprehensive critique of this resume for a ${request.experienceLevel} ${request.targetRole} position in ${request.industry}:

Resume Content:
${request.resumeText}

Return a JSON object with this exact structure:
{
  "sections": [
    {
      "name": "<section name>",
      "score": <number 0-100>,
      "feedback": "<detailed feedback>",
      "suggestions": [<array of specific improvements>]
    }
  ],
  "overallFeedback": "<comprehensive overall assessment>",
  "actionItems": [<array of prioritized action items>],
  "industryAlignment": "<assessment of how well the resume aligns with industry expectations>"
}

Be thorough, constructive, and provide specific examples where possible.`
      }
    ];

    const response = await this.makeRequest(
      messages, 
      OPERATION_TOKEN_LIMITS.resume_critique, 
      'resume_critique',
      { industry: request.industry, experienceLevel: request.experienceLevel, targetRole: request.targetRole }
    );
    
    return JSON.parse(response.content);
  }

  async rewriteResume(request: ResumeAnalysisRequest): Promise<ResumeRewrite> {
    const messages = [
      {
        role: 'system',
        content: `You are an expert resume writer specializing in ${request.industry}. Rewrite resumes to maximize impact, ATS compatibility, and industry alignment while maintaining authenticity.`
      },
      {
        role: 'user',
        content: `
Please rewrite this resume for a ${request.experienceLevel} ${request.targetRole} position in ${request.industry}:

Original Resume:
${request.resumeText}

Additional Context:
- Target Role: ${request.targetRole}
- Experience Level: ${request.experienceLevel}
- Industry: ${request.industry}
${request.desiredSalary ? `- Desired Salary: ${request.desiredSalary}` : ''}
${request.location ? `- Location: ${request.location}` : ''}

Return a JSON object with this exact structure:
{
  "improvedResume": "<complete rewritten resume with proper formatting>",
  "changes": [<array of key changes made>],
  "reasoning": "<explanation of the rewriting strategy>",
  "industryOptimizations": [<array of industry-specific optimizations applied>]
}

Focus on:
- Industry-specific keywords and terminology
- ATS optimization
- Quantified achievements
- Modern formatting and structure
- Compelling value propositions`
      }
    ];

    const response = await this.makeRequest(
      messages, 
      OPERATION_TOKEN_LIMITS.resume_rewrite, 
      'resume_rewrite',
      { industry: request.industry, experienceLevel: request.experienceLevel, targetRole: request.targetRole }
    );
    
    return JSON.parse(response.content);
  }

  async generateCoverLetter(resumeText: string, jobDescription: string, company: string): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert cover letter writer. Create compelling, personalized cover letters that highlight relevant experience and show genuine interest in the role.'
      },
      {
        role: 'user',
        content: `
Create a professional cover letter based on:

Resume:
${resumeText}

Job Description:
${jobDescription}

Company: ${company}

Write a compelling cover letter that:
- Highlights relevant experience
- Shows knowledge of the company
- Demonstrates value proposition
- Maintains professional tone
- Is concise yet impactful (3-4 paragraphs)

Return only the cover letter text, properly formatted.`
      }
    ];

    const response = await this.makeRequest(
      messages, 
      OPERATION_TOKEN_LIMITS.cover_letter, 
      'cover_letter',
      { company, hasJobDescription: !!jobDescription }
    );
    
    return response.content;
  }

  async generateCompanyResearch(companyName: string): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: 'You are a research assistant helping job applicants learn about companies. Provide insights about company culture, values, recent news, and what they might be looking for in candidates.'
      },
      {
        role: 'user',
        content: `Research ${companyName} and provide key insights for a job applicant including: company overview, recent developments, company culture, values, and what they likely look for in candidates. Format as a helpful summary.`
      }
    ];

    const response = await this.makeRequest(
      messages, 
      OPERATION_TOKEN_LIMITS.company_research, 
      'company_research',
      { companyName }
    );
    
    return response.content;
  }

  async generateInterviewResponse(systemPrompt: string, userMessage: string): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await this.makeRequest(
      messages, 
      800, // Smaller token limit for interview responses
      'company_research', // Reuse existing operation type
      { interviewResponse: true }
    );
    
    return response.content;
  }

  // Helper method to check if a user can perform an operation
  async canPerformOperation(operationType: OperationType): Promise<boolean> {
    try {
      await this.checkTokenLimit(operationType);
      return true;
    } catch {
      return false;
    }
  }

  // Get operation token limit
  getOperationTokenLimit(operationType: OperationType): number {
    return OPERATION_TOKEN_LIMITS[operationType];
  }

  // Get monthly token limit
  getMonthlyTokenLimit(): number {
    return MONTHLY_TOKEN_LIMIT;
  }

  // Test function for debugging
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!OPENAI_API_KEY) {
        return {
          success: false,
          message: 'OpenAI API key not found in environment variables',
          details: {
            envVarPresent: !!import.meta.env.VITE_OPENAI_API_KEY,
            envKeys: Object.keys(import.meta.env).filter(key => key.includes('OPENAI')),
            apiKeyLength: OPENAI_API_KEY?.length || 0
          }
        };
      }

      // Test with a simple request
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: 'OpenAI API connection successful!',
          details: { statusCode: response.status }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `OpenAI API error: ${response.status}`,
          details: { statusCode: response.status, error: errorData }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
    }
  }
}

export const openAIService = new OpenAIServiceWithTokenTracking();