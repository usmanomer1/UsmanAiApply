const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

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

class OpenAIService {
  private async makeRequest(messages: any[], maxTokens = 2000) {
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
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to process AI request. Please try again.');
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

    const response = await this.makeRequest(messages, 1500);
    return JSON.parse(response);
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

    const response = await this.makeRequest(messages, 2500);
    return JSON.parse(response);
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

    const response = await this.makeRequest(messages, 3000);
    return JSON.parse(response);
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

    return await this.makeRequest(messages, 1000);
  }
}

export const openAIService = new OpenAIService(); 