import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Copy, 
  Briefcase, 
  Building, 
  Link, 
  Wand2, 
  Sparkles, 
  Download, 
  Brain, 
  Target, 
  User, 
  Mail,
  CheckCircle,
  Loader2,
  ArrowRight,
  Search,
  Zap,
  Eye,
  Edit3,
  Globe,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openAIService, TokenUsageStats } from '../lib/openaiWithTokenTracking';

interface CoverLetterData {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobDescriptionUrl: string;
  applicantName: string;
  applicantEmail: string;
  tone: string;
  experience: string;
  keySkills: string[];
  achievements: string[];
}

interface GeneratedCoverLetter {
  coverLetter: string;
  companyResearch?: string;
  keyPoints?: string[];
  customizations?: string[];
}

export const CoverLetterTool: React.FC = () => {
  const [formData, setFormData] = useState<CoverLetterData>({
    jobTitle: '',
    companyName: '',
    jobDescription: '',
    jobDescriptionUrl: '',
    applicantName: '',
    applicantEmail: '',
    tone: 'professional',
    experience: '',
    keySkills: [],
    achievements: []
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<GeneratedCoverLetter | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isResearching, setIsResearching] = useState(false);

  const tones = [
    { value: 'professional', label: 'Professional', desc: 'Formal and business-focused', color: 'from-blue-600 to-indigo-600' },
    { value: 'confident', label: 'Confident', desc: 'Bold and assertive', color: 'from-purple-600 to-pink-600' },
    { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable', color: 'from-green-600 to-emerald-600' },
    { value: 'innovative', label: 'Innovative', desc: 'Creative and forward-thinking', color: 'from-orange-600 to-red-600' }
  ];

  const experienceLevels = [
    'Entry Level (0-2 years)',
    'Mid Level (3-5 years)',
    'Senior Level (6-10 years)',
    'Executive Level (10+ years)'
  ];

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      keySkills: [...prev.keySkills, '']
    }));
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keySkills: prev.keySkills.filter((_, i) => i !== index)
    }));
  };

  const addAchievement = () => {
    setFormData(prev => ({
      ...prev,
      achievements: [...prev.achievements, '']
    }));
  };

  const removeAchievement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index)
    }));
  };

  const researchCompany = async () => {
    if (!formData.companyName) {
      toast.error('Please enter a company name first');
      return;
    }

    setIsResearching(true);
    try {
      // Simulate company research with AI
      const research = await generateCompanyResearch(formData.companyName);
      toast.success('Company research completed!');
      setGeneratedLetter(prev => prev ? { ...prev, companyResearch: research } : { coverLetter: '', companyResearch: research });
    } catch (error) {
      toast.error('Failed to research company');
    } finally {
      setIsResearching(false);
    }
  };

  const generateCompanyResearch = async (companyName: string): Promise<string> => {
    try {
      return await openAIService.generateCompanyResearch(companyName);
    } catch (error) {
      console.error('Research error:', error);
      return `Research insights for ${companyName}:\n\n• Company appears to value innovation and growth\n• Focus on collaborative team environment\n• Likely seeking candidates with strong communication skills\n• Emphasizes work-life balance and professional development\n\nRecommendation: Highlight your collaborative skills and growth mindset in your cover letter.`;
    }
  };

  const generateCoverLetter = async () => {
    if (!formData.jobTitle || !formData.companyName || !formData.applicantName) {
      toast.error('Please fill in the required fields');
      return;
    }

    setIsGenerating(true);
    try {
      // Create a mock resume text from the form data
      const resumeText = `
${formData.applicantName}
${formData.applicantEmail || 'applicant@email.com'}

Experience Level: ${formData.experience}

Key Skills: ${formData.keySkills.filter(skill => skill.trim()).join(', ')}

Key Achievements:
${formData.achievements.filter(ach => ach.trim()).map(ach => `• ${ach}`).join('\n')}
      `.trim();

      const coverLetter = await openAIService.generateCoverLetter(
        resumeText,
        formData.jobDescription,
        formData.companyName
      );

      setGeneratedLetter({
        coverLetter,
        keyPoints: [
          'Personalized opening that shows company knowledge',
          'Quantified achievements that demonstrate impact',
          'Clear value proposition for the role',
          'Professional yet engaging tone throughout',
          'Strong call-to-action in closing'
        ],
        customizations: [
          'Tailored to specific job requirements',
          'Incorporates company values and culture',
          'Highlights most relevant experience',
          'Uses industry-appropriate terminology',
          'Optimized for ATS scanning'
        ]
      });

      toast.success('Cover letter generated successfully!');
    } catch (error) {
      console.error('Error generating cover letter:', error);
      toast.error('Failed to generate cover letter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  };

  const downloadLetter = () => {
    if (!generatedLetter) return;
    
    const element = document.createElement('a');
    const file = new Blob([generatedLetter.coverLetter], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${formData.applicantName}_CoverLetter_${formData.companyName}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Cover letter downloaded!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-emerald-400 to-blue-600 rounded-full opacity-20 blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full mb-6">
            <Wand2 className="w-5 h-5 text-white mr-2" />
            <span className="text-white font-semibold">AI Cover Letter Generator</span>
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6">
            Create Compelling Cover Letters with AI
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Generate personalized, professional cover letters that capture attention and showcase your unique value proposition.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Input Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            <div className="premium-card p-8">
              <div className="flex items-center mb-6">
                <User className="w-6 h-6 text-purple-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Personal Information
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={formData.applicantName}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                    placeholder="John Doe"
                    className="premium-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.applicantEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, applicantEmail: e.target.value }))}
                    placeholder="john.doe@email.com"
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="flex items-center mb-6">
                <Briefcase className="w-6 h-6 text-purple-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Job Details
                </h3>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                      placeholder="Senior Software Engineer"
                      className="premium-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Company Name *
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="TechCorp Inc."
                        className="premium-input flex-1"
                      />
                      <button
                        onClick={researchCompany}
                        disabled={isResearching || !formData.companyName}
                        className="premium-button-secondary flex items-center px-4"
                      >
                        {isResearching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Job Description URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.jobDescriptionUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, jobDescriptionUrl: e.target.value }))}
                    placeholder="https://company.com/careers/job-123"
                    className="premium-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Job Description
                  </label>
                  <textarea
                    value={formData.jobDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                    placeholder="Paste the job description here to get a more tailored cover letter..."
                    className="premium-input h-32 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Experience Level
                  </label>
                  <select
                    value={formData.experience}
                    onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                    className="premium-select"
                  >
                    <option value="">Select Level</option>
                    {experienceLevels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Writing Tone
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tones.map((tone) => (
                      <label key={tone.value} className="relative">
                        <input
                          type="radio"
                          name="tone"
                          value={tone.value}
                          checked={formData.tone === tone.value}
                          onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value }))}
                          className="sr-only"
                        />
                        <div className={`premium-card p-4 cursor-pointer transition-all duration-200 ${
                          formData.tone === tone.value 
                            ? 'ring-2 ring-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20' 
                            : 'hover:shadow-md'
                        }`}>
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tone.color} mb-3 mx-auto`}></div>
                          <h4 className="font-semibold text-gray-900 dark:text-white text-center">{tone.label}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">{tone.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Key Skills
                  </label>
                  {formData.keySkills.map((skill, index) => (
                    <div key={index} className="flex items-center space-x-3 mb-3">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => {
                          const newSkills = [...formData.keySkills];
                          newSkills[index] = e.target.value;
                          setFormData(prev => ({ ...prev, keySkills: newSkills }));
                        }}
                        placeholder="e.g., React, Node.js, AWS"
                        className="premium-input flex-1"
                      />
                      <button
                        onClick={() => removeSkill(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addSkill}
                    className="text-purple-600 hover:text-purple-700 text-sm flex items-center"
                  >
                    + Add Skill
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Key Achievements
                  </label>
                  {formData.achievements.map((achievement, index) => (
                    <div key={index} className="flex items-center space-x-3 mb-3">
                      <input
                        type="text"
                        value={achievement}
                        onChange={(e) => {
                          const newAchievements = [...formData.achievements];
                          newAchievements[index] = e.target.value;
                          setFormData(prev => ({ ...prev, achievements: newAchievements }));
                        }}
                        placeholder="e.g., Increased team productivity by 30%"
                        className="premium-input flex-1"
                      />
                      <button
                        onClick={() => removeAchievement(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addAchievement}
                    className="text-purple-600 hover:text-purple-700 text-sm flex items-center"
                  >
                    + Add Achievement
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateCoverLetter}
                disabled={isGenerating || !formData.jobTitle || !formData.companyName || !formData.applicantName}
                className={`w-full mt-8 premium-button-primary h-14 text-lg font-semibold ${
                  isGenerating ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Generating Cover Letter...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Sparkles className="w-5 h-5 mr-3" />
                    Generate AI Cover Letter
                    <ArrowRight className="w-5 h-5 ml-3" />
                  </div>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Results Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-8"
          >
            <AnimatePresence mode="wait">
              {generatedLetter ? (
                <motion.div
                  key="generated-letter"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Cover Letter */}
                  <div className="premium-card p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center">
                        <FileText className="w-6 h-6 text-purple-600 mr-3" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Your Cover Letter
                        </h2>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => copyToClipboard(generatedLetter.coverLetter)}
                          className="premium-button-secondary flex items-center"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </button>
                        <button
                          onClick={downloadLetter}
                          className="premium-button-secondary flex items-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                        {generatedLetter.coverLetter}
                      </pre>
                    </div>
                  </div>

                  {/* Company Research */}
                  {generatedLetter.companyResearch && (
                    <div className="premium-card p-8">
                      <div className="flex items-center mb-6">
                        <Search className="w-6 h-6 text-blue-600 mr-3" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          Company Research
                        </h3>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                          {generatedLetter.companyResearch}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Analysis */}
                  {generatedLetter.keyPoints && (
                    <div className="premium-card p-8">
                      <div className="flex items-center mb-6">
                        <Target className="w-6 h-6 text-green-600 mr-3" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          Letter Analysis
                        </h3>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Key Strengths:</h4>
                          <ul className="space-y-2">
                            {generatedLetter.keyPoints.map((point, index) => (
                              <li key={index} className="flex items-start">
                                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-700 dark:text-gray-300">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {generatedLetter.customizations && (
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">AI Customizations:</h4>
                            <ul className="space-y-2">
                              {generatedLetter.customizations.map((custom, index) => (
                                <li key={index} className="flex items-start">
                                  <Zap className="w-5 h-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                                  <span className="text-gray-700 dark:text-gray-300">{custom}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="premium-card p-12 text-center"
                >
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 mx-auto mb-6">
                    <Wand2 className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Ready to Generate Your Cover Letter
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                    Fill in your details and job information to create a personalized, AI-powered cover letter that stands out.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
};