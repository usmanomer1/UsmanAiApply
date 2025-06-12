import React, { useState } from 'react';
import { FileText, Copy, Briefcase, Building, Link, Wand2 } from 'lucide-react';

export const CoverLetterTool: React.FC = () => {
  const [formData, setFormData] = useState({
    jobTitle: '',
    companyName: '',
    jobDescriptionUrl: '',
    tone: 'professional'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [researchData, setResearchData] = useState('');

  const tones = [
    { value: 'professional', label: 'Professional', desc: 'Formal and business-focused' },
    { value: 'bold', label: 'Bold', desc: 'Confident and assertive' },
    { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
  ];

  const handleGenerate = async () => {
    if (!formData.jobTitle || !formData.companyName) return;
    
    setIsGenerating(true);
    
    // Simulate API call
    setTimeout(() => {
      setGeneratedContent(getSimulatedCoverLetter());
      setResearchData(getSimulatedResearch());
      setIsGenerating(false);
    }, 3000);
  };

  const getSimulatedCoverLetter = () => {
    const tone = formData.tone;
    const opening = {
      professional: "I am writing to express my strong interest in the",
      bold: "I am excited to submit my application for the",
      friendly: "I hope this letter finds you well. I am reaching out about the"
    };

    return `Dear Hiring Manager,

${opening[tone as keyof typeof opening]} ${formData.jobTitle} position at ${formData.companyName}. With my extensive background in software engineering and proven track record of delivering scalable solutions, I am confident I would be a valuable addition to your team.

In my current role as Senior Software Engineer, I have successfully led the development of microservices architectures serving over 1 million users, directly aligning with ${formData.companyName}'s focus on scalable technology solutions. My experience includes:

• Architecting cloud-native applications using AWS and Kubernetes
• Leading cross-functional teams of 5+ engineers in agile environments  
• Implementing CI/CD pipelines that reduced deployment time by 60%
• Optimizing system performance, achieving 40% improvement in response times

What particularly excites me about ${formData.companyName} is your commitment to innovation and your recent expansion into AI-driven solutions. I have been following your company's growth and am impressed by your recent product launches that have disrupted the industry.

I am eager to contribute my technical expertise and leadership skills to help ${formData.companyName} continue its trajectory of success. I would welcome the opportunity to discuss how my experience aligns with your team's needs.

Thank you for considering my application. I look forward to hearing from you.

Best regards,
John Doe`;
  };

  const getSimulatedResearch = () => {
    return `COMPANY & JOB RESEARCH INSIGHTS

📊 COMPANY OVERVIEW - ${formData.companyName}
• Industry: Technology/Software
• Founded: 2018
• Size: 500-1000 employees
• Headquarters: San Francisco, CA
• Revenue: $50M+ (estimated)
• Recent funding: Series B ($25M raised 6 months ago)

🚀 RECENT DEVELOPMENTS
• Launched new AI-powered analytics platform (Q3 2024)
• Expanded engineering team by 40% in past year
• Partnership announced with major cloud provider
• Featured in "Top 50 Startups to Watch" by TechCrunch

💼 ROLE-SPECIFIC INSIGHTS
• Department: Engineering/Product
• Team size: 15-20 engineers
• Tech stack: React, Node.js, Python, AWS
• Growth stage: Scaling phase, rapid expansion
• Work style: Remote-first, collaborative culture

🎯 KEY HIRING PRIORITIES
• Experience with microservices architecture
• Leadership and mentoring capabilities
• Cloud-native development expertise
• Agile/Scrum methodology experience
• Startup experience preferred

📈 COMPETITIVE LANDSCAPE
• Main competitors: CompetitorA, CompetitorB
• Market position: Rising challenger
• Unique differentiator: AI-first approach
• Growth trajectory: 200% YoY revenue growth

💡 INTERVIEW PREPARATION TIPS
• Research their recent AI platform launch
• Prepare examples of scaling engineering teams
• Discuss experience with rapid growth environments
• Show knowledge of their tech stack
• Demonstrate alignment with their remote-first culture`;
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Job Details
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Briefcase size={16} className="inline mr-2" />
                Job Title *
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Building size={16} className="inline mr-2" />
                Company Name *
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g., TechCorp Inc."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Link size={16} className="inline mr-2" />
                Job Description URL (optional)
              </label>
              <input
                type="url"
                value={formData.jobDescriptionUrl}
                onChange={(e) => setFormData({ ...formData, jobDescriptionUrl: e.target.value })}
                placeholder="https://company.com/careers/job-id"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tone
              </label>
              <div className="grid grid-cols-1 gap-3">
                {tones.map((tone) => (
                  <label key={tone.value} className="flex items-center">
                    <input
                      type="radio"
                      name="tone"
                      value={tone.value}
                      checked={formData.tone === tone.value}
                      onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                      className="mr-3 text-blue-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{tone.label}</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{tone.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!formData.jobTitle || !formData.companyName || isGenerating}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 size={20} className="mr-2" />
                  Generate Cover Letter
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {/* Cover Letter */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generated Cover Letter
              </h3>
              {generatedContent && (
                <button
                  onClick={() => copyToClipboard(generatedContent)}
                  className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  <Copy size={16} className="mr-2" />
                  Copy
                </button>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-64">
              {generatedContent ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {generatedContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  {isGenerating ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p>Generating your cover letter...</p>
                    </div>
                  ) : (
                    <p>Fill in the job details to generate a cover letter</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Research Section */}
      {researchData && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Company & Job Research
            </h3>
            <button
              onClick={() => copyToClipboard(researchData)}
              className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              <Copy size={16} className="mr-2" />
              Copy Research
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {researchData}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};