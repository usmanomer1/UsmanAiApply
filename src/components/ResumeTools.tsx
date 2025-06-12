import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Upload, 
  Star, 
  Award, 
  Brain, 
  Target, 
  Sparkles, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Eye,
  Edit3,
  Zap,
  ChevronRight,
  User,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  ArrowRight,
  BarChart3,
  MessageSquare,
  RefreshCw,
  Loader2,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openAIService, ResumeAnalysisRequest, ResumeScore, ResumeCritique, ResumeRewrite, TokenUsageStats } from '../lib/openaiWithTokenTracking';
import { extractTextFromPDF } from '../lib/pdfExtractor';

type Tool = 'score' | 'judge' | 'rewrite';

interface FormData {
  resumeFile: File | null;
  resumeText: string;
  industry: string;
  experienceLevel: string;
  targetRole: string;
  desiredSalary: string;
  location: string;
}

export const ResumeTools: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool>('score');
  const [formData, setFormData] = useState<FormData>({
    resumeFile: null,
    resumeText: '',
    industry: '',
    experienceLevel: '',
    targetRole: '',
    desiredSalary: '',
    location: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    score?: ResumeScore;
    critique?: ResumeCritique;
    rewrite?: ResumeRewrite;
  }>({});
  const [tokenUsageStats, setTokenUsageStats] = useState<TokenUsageStats | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    fetchTokenUsageStats();
  }, []);

  const fetchTokenUsageStats = async () => {
    try {
      const stats = await openAIService.getTokenUsageStats();
      setTokenUsageStats(stats);
    } catch (error) {
      console.error('Error fetching token usage stats:', error);
    }
  };

  const testOpenAIConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await openAIService.testConnection();
      if (result.success) {
        toast.success(result.message);
        console.log('OpenAI Test Success:', result.details);
      } else {
        toast.error(result.message);
        console.error('OpenAI Test Failed:', result.details);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast.error('Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Marketing', 'Sales', 'Education',
    'Manufacturing', 'Retail', 'Consulting', 'Real Estate', 'Legal', 'Other'
  ];

  const experienceLevels = [
    'Entry Level (0-2 years)',
    'Mid Level (3-5 years)', 
    'Senior Level (6-10 years)',
    'Executive Level (10+ years)'
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.type.includes('text') || file.type.includes('word')) {
      setFormData(prev => ({ ...prev, resumeFile: file }));
      
      try {
        if (file.type.includes('text')) {
          // Handle text files directly
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            setFormData(prev => ({ ...prev, resumeText: text }));
            toast.success('Text file loaded successfully!');
          };
          reader.readAsText(file);
          return;
        } else if (file.type === 'application/pdf') {
          // Extract text from PDF
          toast.loading('Extracting text from PDF...', { id: 'pdf-extraction' });
          try {
            const extractedText = await extractTextFromPDF(file);
            if (extractedText && extractedText.trim().length > 0) {
              setFormData(prev => ({ ...prev, resumeText: extractedText }));
              toast.success('PDF text extracted successfully!', { id: 'pdf-extraction' });
            } else {
              throw new Error('No text found in PDF');
            }
          } catch (error) {
            console.error('PDF extraction failed:', error);
            toast.error('PDF text extraction failed. Please try a different PDF or copy and paste your resume text manually.', { 
              id: 'pdf-extraction',
              duration: 4000 
            });
          }
          return;
        } else {
          // Word docs and other formats
          toast.error('For Word documents, please copy your resume text and paste it in the text area below.', {
            duration: 4000
          });
          return;
        }
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error('Could not process file. Please paste your resume text manually.');
      }
    } else {
      toast.error('Please upload a PDF, Word document, or text file');
    }
  };

  const validateForm = (): boolean => {
    if (!formData.resumeText.trim()) {
      toast.error('Please provide your resume text');
      return false;
    }
    if (!formData.industry) {
      toast.error('Please select your industry');
      return false;
    }
    if (!formData.experienceLevel) {
      toast.error('Please select your experience level');
      return false;
    }
    if (!formData.targetRole.trim()) {
      toast.error('Please enter your target role');
      return false;
    }
    return true;
  };

  const processResume = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);
    console.log('Starting resume processing with tool:', activeTool);
    
    try {
      const request: ResumeAnalysisRequest = {
        resumeText: formData.resumeText,
        industry: formData.industry,
        experienceLevel: formData.experienceLevel,
        targetRole: formData.targetRole,
        desiredSalary: formData.desiredSalary,
        location: formData.location
      };

      console.log('Request data:', { 
        ...request, 
        resumeText: `${request.resumeText.substring(0, 100)}...` 
      });

      if (activeTool === 'score') {
        console.log('Calling scoreResume...');
        const score = await openAIService.scoreResume(request);
        console.log('Score result:', score);
        setResults(prev => ({ ...prev, score }));
        toast.success('Resume analysis complete!');
      } else if (activeTool === 'judge') {
        console.log('Calling critiqueResume...');
        const critique = await openAIService.critiqueResume(request);
        console.log('Critique result:', critique);
        setResults(prev => ({ ...prev, critique }));
        toast.success('Resume critique complete!');
      } else if (activeTool === 'rewrite') {
        console.log('Calling rewriteResume...');
        const rewrite = await openAIService.rewriteResume(request);
        console.log('Rewrite result:', rewrite);
        setResults(prev => ({ ...prev, rewrite }));
        toast.success('Resume rewrite complete!');
      }

      // Refresh token usage stats after successful operation
      await fetchTokenUsageStats();
    } catch (error: any) {
      console.error('Error processing resume:', error);
      
      // Show more specific error messages
      if (error?.message?.includes('subscription')) {
        toast.error(error.message);
      } else if (error?.message?.includes('token')) {
        toast.error(error.message);
      } else {
        toast.error(`Failed to process resume: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-600';
    if (score >= 60) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  const toolConfig = {
    score: {
      icon: BarChart3,
      title: 'AI Resume Score',
      subtitle: 'Get an instant, detailed analysis of your resume',
      description: 'Our AI analyzes your resume across multiple dimensions including content quality, formatting, keywords, and industry alignment to provide actionable insights.',
      color: 'from-blue-600 to-indigo-600',
      bgColor: 'from-blue-50 to-indigo-50'
    },
    judge: {
      icon: MessageSquare,
      title: 'AI Resume Judge',
      subtitle: 'Receive expert feedback and constructive criticism',
      description: 'Get detailed section-by-section feedback from our AI judge, trained on hiring manager perspectives and industry best practices.',
      color: 'from-purple-600 to-violet-600',
      bgColor: 'from-purple-50 to-violet-50'
    },
    rewrite: {
      icon: Edit3,
      title: 'AI Resume Rewriter',
      subtitle: 'Transform your resume with AI optimization',
      description: 'Our AI rewrites your resume to maximize impact, improve ATS compatibility, and align with industry standards and target role requirements.',
      color: 'from-emerald-600 to-green-600',
      bgColor: 'from-emerald-50 to-green-50'
    }
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
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-6">
            <Sparkles className="w-5 h-5 text-white mr-2" />
            <span className="text-white font-semibold">AI-Powered Resume Tools</span>
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6">
            Supercharge Your Resume with AI
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Leverage cutting-edge AI to score, critique, and rewrite your resume for maximum impact. 
            Get insights from industry experts and optimize for ATS systems.
          </p>

          {/* Debug: Test OpenAI Connection */}
          <div className="mt-6">
            <button
              onClick={testOpenAIConnection}
              disabled={isTestingConnection}
              className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              {isTestingConnection ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                  Testing...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Test OpenAI Connection
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Token Usage Display */}
        {tokenUsageStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="premium-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Brain className="w-6 h-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Token Usage
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {tokenUsageStats.totalTokens.toLocaleString()}
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      /{tokenUsageStats.monthlyLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    tokens used this month
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${
                      tokenUsageStats.usagePercentage >= 90
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : tokenUsageStats.usagePercentage >= 75
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    }`}
                    style={{ width: `${Math.min(tokenUsageStats.usagePercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">0%</span>
                  <span className={`font-medium ${
                    tokenUsageStats.usagePercentage >= 90
                      ? 'text-red-600 dark:text-red-400'
                      : tokenUsageStats.usagePercentage >= 75
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {Math.round(tokenUsageStats.usagePercentage)}% used
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">100%</span>
                </div>
              </div>

              <div className="mt-4 text-center">
                <span className={`text-sm font-medium ${
                  tokenUsageStats.usagePercentage >= 90
                    ? 'text-red-700 dark:text-red-300'
                    : tokenUsageStats.usagePercentage >= 75
                    ? 'text-orange-700 dark:text-orange-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {tokenUsageStats.remainingTokens.toLocaleString()} tokens remaining
                </span>
                {tokenUsageStats.usagePercentage >= 90 && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                    ⚠️ Approaching monthly limit - consider upgrading if you need more AI processing
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tool Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
        >
          {Object.entries(toolConfig).map(([key, config]) => {
            const IconComponent = config.icon;
            const isActive = activeTool === key;
            
            return (
              <motion.div
                key={key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTool(key as Tool)}
                className={`relative cursor-pointer transition-all duration-300 ${
                  isActive 
                    ? 'transform scale-105' 
                    : 'hover:transform hover:scale-102'
                }`}
              >
                <div className={`premium-card p-8 h-full transition-all duration-300 ${
                  isActive 
                    ? 'border-2 border-blue-500 shadow-2xl ring-4 ring-blue-200 dark:ring-blue-800 transform translate-y-[-4px]' 
                    : 'border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-lg'
                }`}>
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.color} p-4 mb-6 mx-auto transform transition-transform duration-300 ${
                    isActive ? 'scale-110 shadow-lg' : ''
                  }`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">
                    {config.title}
                  </h3>
                  
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-4 text-center font-medium">
                    {config.subtitle}
                  </p>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
                    {config.description}
                  </p>

                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <CheckCircle className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Input Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-8"
          >
            <div className="premium-card p-8">
              <div className="flex items-center mb-6">
                <Upload className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Upload & Configure
                </h2>
              </div>

              {/* File Upload */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Resume File
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label
                    htmlFor="resume-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {formData.resumeFile ? formData.resumeFile.name : 'Choose file or drag & drop'}
                    </span>
                    <span className="text-xs text-gray-400">PDF, TXT, DOC up to 10MB</span>
                  </label>
                </div>
              </div>

              {/* Resume Text */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Resume Text *
                </label>
                <textarea
                  value={formData.resumeText}
                  onChange={(e) => setFormData(prev => ({ ...prev, resumeText: e.target.value }))}
                  placeholder="Paste your resume content here for AI analysis..."
                  className="premium-input h-48 resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Copy and paste your resume text for the most accurate AI analysis
                </p>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Industry *
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    className="premium-select"
                  >
                    <option value="">Select Industry</option>
                    {industries.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Experience Level *
                  </label>
                  <select
                    value={formData.experienceLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
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
                    Target Role *
                  </label>
                  <input
                    type="text"
                    value={formData.targetRole}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                    placeholder="e.g., Senior Software Engineer"
                    className="premium-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Desired Salary
                  </label>
                  <input
                    type="text"
                    value={formData.desiredSalary}
                    onChange={(e) => setFormData(prev => ({ ...prev, desiredSalary: e.target.value }))}
                    placeholder="e.g., $120,000"
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., San Francisco, CA"
                  className="premium-input"
                />
              </div>

              {/* Action Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={processResume}
                disabled={isProcessing}
                className={`w-full mt-8 premium-button-primary h-14 text-lg font-semibold ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Processing with AI...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Brain className="w-5 h-5 mr-3" />
                    {activeTool === 'score' && 'Analyze Resume'}
                    {activeTool === 'judge' && 'Get AI Critique'}
                    {activeTool === 'rewrite' && 'Rewrite Resume'}
                    <ArrowRight className="w-5 h-5 ml-3" />
                  </div>
                )}
              </motion.button>

              {/* Debug Test Button - Remove in production */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  try {
                    console.log('Testing API connection...');
                    console.log('API Key present:', !!import.meta.env.VITE_OPENAI_API_KEY);
                    
                    if (!import.meta.env.VITE_OPENAI_API_KEY) {
                      toast.error('OpenAI API key not found in environment variables!');
                      return;
                    }
                    
                    const stats = await openAIService.getTokenUsageStats();
                    console.log('Token stats:', stats);
                    toast.success('API connection working!');
                  } catch (error: any) {
                    console.error('API test failed:', error);
                    toast.error(`API Test Failed: ${error.message}`);
                  }
                }}
                className="w-full mt-4 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                🔧 Test API Connection
              </motion.button>
            </div>
          </motion.div>

          {/* Results Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-8"
          >
            <AnimatePresence mode="wait">
              {/* Score Results */}
              {activeTool === 'score' && results.score && (
                <motion.div
                  key="score-results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="premium-card p-8"
                >
                  <div className="flex items-center mb-6">
                    <BarChart3 className="w-6 h-6 text-blue-600 mr-3" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Resume Analysis Results
                    </h2>
                  </div>

                  {/* Overall Score */}
                  <div className="text-center mb-8">
                    <div className={`text-6xl font-bold ${getScoreColor(results.score.overall)} mb-2`}>
                      {results.score.overall}
                    </div>
                    <div className="text-lg text-gray-600 dark:text-gray-300 font-medium">
                      Overall Score
                    </div>
                    <div className={`w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full mt-4 overflow-hidden`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${results.score.overall}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full bg-gradient-to-r ${getScoreGradient(results.score.overall)}`}
                      />
                    </div>
                  </div>

                  {/* Category Scores */}
                  <div className="space-y-4 mb-8">
                    {Object.entries(results.score.categories).map(([category, score]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {category}
                        </span>
                        <div className="flex items-center space-x-3">
                          <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                              className={`h-full bg-gradient-to-r ${getScoreGradient(score)}`}
                            />
                          </div>
                          <span className={`font-bold ${getScoreColor(score)} min-w-[3rem] text-right`}>
                            {score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {results.score.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-red-600 mb-3 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {results.score.weaknesses.map((weakness, index) => (
                        <li key={index} className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center">
                      <Target className="w-5 h-5 mr-2" />
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {results.score.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start">
                          <ChevronRight className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}

              {/* Judge Results */}
              {activeTool === 'judge' && results.critique && (
                <motion.div
                  key="judge-results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="premium-card p-8"
                >
                  <div className="flex items-center mb-6">
                    <MessageSquare className="w-6 h-6 text-purple-600 mr-3" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      AI Judge Critique
                    </h2>
                  </div>

                  {/* Overall Feedback */}
                  <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <h3 className="text-lg font-bold text-purple-600 mb-3 flex items-center">
                      <Eye className="w-5 h-5 mr-2" />
                      Overall Assessment
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {results.critique.overallFeedback}
                    </p>
                  </div>

                  {/* Section Breakdown */}
                  <div className="space-y-6 mb-8">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Section Analysis
                    </h3>
                    {results.critique.sections.map((section, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {section.name}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <div className={`text-2xl font-bold ${getScoreColor(section.score)}`}>
                              {section.score}
                            </div>
                            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full bg-gradient-to-r ${getScoreGradient(section.score)}`}
                                style={{ width: `${section.score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                          {section.feedback}
                        </p>
                        <div className="space-y-2">
                          <h5 className="font-semibold text-gray-900 dark:text-white">Suggestions:</h5>
                          <ul className="space-y-1">
                            {section.suggestions.map((suggestion, idx) => (
                              <li key={idx} className="flex items-start">
                                <ChevronRight className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">{suggestion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Industry Alignment */}
                  <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center">
                      <Briefcase className="w-5 h-5 mr-2" />
                      Industry Alignment
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {results.critique.industryAlignment}
                    </p>
                  </div>

                  {/* Action Items */}
                  <div>
                    <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center">
                      <Target className="w-5 h-5 mr-2" />
                      Priority Action Items
                    </h3>
                    <div className="space-y-3">
                      {results.critique.actionItems.map((item, index) => (
                        <div key={index} className="flex items-start p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-gray-700 dark:text-gray-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Rewrite Results */}
              {activeTool === 'rewrite' && results.rewrite && (
                <motion.div
                  key="rewrite-results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="premium-card p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <Edit3 className="w-6 h-6 text-emerald-600 mr-3" />
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        AI-Optimized Resume
                      </h2>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(results.rewrite!.improvedResume);
                        toast.success('Resume copied to clipboard!');
                      }}
                      className="premium-button-secondary flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Copy
                    </button>
                  </div>

                  {/* Strategy */}
                  <div className="mb-6 p-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <h3 className="text-lg font-bold text-emerald-600 mb-3 flex items-center">
                      <Brain className="w-5 h-5 mr-2" />
                      Rewriting Strategy
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {results.rewrite.reasoning}
                    </p>
                  </div>

                  {/* Key Changes */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center">
                      <Zap className="w-5 h-5 mr-2" />
                      Key Improvements Made
                    </h3>
                    <ul className="space-y-2">
                      {results.rewrite.changes.map((change, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Industry Optimizations */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-purple-600 mb-3 flex items-center">
                      <Target className="w-5 h-5 mr-2" />
                      Industry Optimizations
                    </h3>
                    <ul className="space-y-2">
                      {results.rewrite.industryOptimizations.map((optimization, index) => (
                        <li key={index} className="flex items-start">
                          <Star className="w-5 h-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{optimization}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Improved Resume */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Your Optimized Resume
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                        {results.rewrite.improvedResume}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Empty State */}
              {!(activeTool === 'score' ? results.score : activeTool === 'judge' ? results.critique : results.rewrite) && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="premium-card p-12 text-center"
                >
                  <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${toolConfig[activeTool].color} p-6 mx-auto mb-6`}>
                    {React.createElement(toolConfig[activeTool].icon, { className: "w-12 h-12 text-white" })}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Ready to {activeTool === 'score' ? 'Analyze' : activeTool === 'judge' ? 'Critique' : 'Rewrite'} Your Resume
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                    Fill in your information and upload your resume to get started with AI-powered {activeTool === 'score' ? 'scoring' : activeTool === 'judge' ? 'feedback' : 'optimization'}.
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