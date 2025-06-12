import React, { useState } from 'react';
import { Upload, Copy, Star, FileText, CheckCircle } from 'lucide-react';

export const ResumeTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rewriter');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processedContent, setProcessedContent] = useState('');

  const tabs = [
    { id: 'rewriter', label: 'Resume Rewriter', icon: FileText },
    { id: 'scorer', label: 'Resume Scorer', icon: Star },
    { id: 'judge', label: 'Resume Judge', icon: CheckCircle },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/pdf' || file.type.includes('document'))) {
      setUploadedFile(file);
      // Simulate processing
      setTimeout(() => {
        setProcessedContent(getSimulatedContent(activeTab));
      }, 2000);
    }
  };

  const getSimulatedContent = (tab: string) => {
    switch (tab) {
      case 'rewriter':
        return `REWRITTEN RESUME CONTENT

John Doe
Senior Software Engineer
Email: john.doe@email.com | Phone: (555) 123-4567

PROFESSIONAL SUMMARY
Results-driven Senior Software Engineer with 8+ years of experience developing scalable web applications and leading cross-functional teams. Proven track record of implementing innovative solutions that increased system performance by 40% and reduced operational costs by $200K annually.

TECHNICAL SKILLS
• Programming Languages: JavaScript, TypeScript, Python, Java
• Frontend: React, Vue.js, Angular, HTML5, CSS3
• Backend: Node.js, Express, Django, Spring Boot
• Databases: PostgreSQL, MongoDB, Redis
• Cloud: AWS, Azure, Docker, Kubernetes

PROFESSIONAL EXPERIENCE
Senior Software Engineer | TechCorp Inc. | 2020 - Present
• Architected and developed microservices-based platform serving 1M+ users
• Led team of 5 engineers in agile development process
• Implemented CI/CD pipeline reducing deployment time by 60%

Software Engineer | StartupXYZ | 2018 - 2020
• Built responsive web applications using React and Node.js
• Optimized database queries improving response time by 35%
• Collaborated with UX team to implement user-centric features`;

      case 'scorer':
        return `RESUME SCORE ANALYSIS

Overall Score: 8.2/10

STRENGTHS:
✅ Strong technical skills section (9/10)
✅ Quantified achievements (8/10)
✅ Relevant work experience (9/10)
✅ Professional formatting (8/10)

AREAS FOR IMPROVEMENT:
⚠️ Add more industry keywords (6/10)
⚠️ Include certifications if available (5/10)
⚠️ Expand on leadership experience (7/10)

RECOMMENDATIONS:
1. Include keywords like "agile methodology", "DevOps", "system architecture"
2. Add any relevant certifications (AWS, Azure, etc.)
3. Quantify team leadership and mentoring activities
4. Consider adding a projects section
5. Include links to portfolio or GitHub profile

KEYWORD OPTIMIZATION:
Missing: cloud architecture, DevOps, machine learning, API design
Present: JavaScript, React, Node.js, Python, microservices`;

      case 'judge':
        return `RESUME REVIEW - MOCK INTERVIEWER PERSPECTIVE

FIRST IMPRESSION: Positive ⭐⭐⭐⭐
This resume immediately catches attention with clear structure and quantified achievements.

TECHNICAL COMPETENCY: Strong ⭐⭐⭐⭐⭐
The candidate demonstrates solid full-stack capabilities with relevant modern technologies.

EXPERIENCE RELEVANCE: High ⭐⭐⭐⭐
Work experience aligns well with senior-level expectations and shows career progression.

LIKELY INTERVIEW QUESTIONS:
1. "Tell me about the microservices platform you architected for 1M+ users"
2. "How did you achieve 40% performance improvement?"
3. "Describe your experience leading a team of 5 engineers"
4. "What was your approach to implementing the CI/CD pipeline?"

RED FLAGS: None significant
✅ No employment gaps
✅ Consistent career progression
✅ Relevant experience duration

HIRING RECOMMENDATION: STRONG CANDIDATE
This candidate would likely proceed to technical interview round.

COMPETITIVE RATING: 8.5/10
Stands out in a typical applicant pool due to quantified achievements and leadership experience.`;

      default:
        return '';
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(processedContent);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon size={20} className="mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Resume
          </h3>
          
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Drop your resume here, or{' '}
              <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
              </label>
            </p>
            <p className="text-sm text-gray-500">PDF, DOC, DOCX up to 10MB</p>
          </div>

          {uploadedFile && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <FileText size={20} className="text-green-600 mr-2" />
                <span className="text-green-700 dark:text-green-300 font-medium">
                  {uploadedFile.name}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tabs.find(tab => tab.id === activeTab)?.label} Results
            </h3>
            {processedContent && (
              <button
                onClick={copyToClipboard}
                className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                <Copy size={16} className="mr-2" />
                Copy
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-96">
            {processedContent ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {processedContent}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {uploadedFile ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Processing your resume...</p>
                  </div>
                ) : (
                  <p>Upload a resume to see {activeTab} results</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};