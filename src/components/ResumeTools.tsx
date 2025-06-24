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
  Crown,
  Shield,
  Lightbulb,
  PenTool,
  Bot
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { openAIService, ResumeAnalysisRequest, ResumeScore, ResumeCritique, ResumeRewrite } from '../lib/openaiWithTokenTracking';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { usePaywall } from '../hooks/usePaywall';
import PaywallModal from './ui/PaywallModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  const navigate = useNavigate();
  const { checkFeatureAccess, isAuthenticated } = usePaywall();
  
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
  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);

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
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            setFormData(prev => ({ ...prev, resumeText: text }));
            toast.success('Text file loaded successfully!');
          };
          reader.readAsText(file);
          return;
        } else if (file.type === 'application/pdf') {
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

  // Check access on component mount
  useEffect(() => {
    const checkAccess = async () => {
      if (!isAuthenticated) {
        setShowPaywall(true);
        setAccessCheckComplete(true);
        return;
      }

      try {
        const accessResult = await checkFeatureAccess('advanced_ai');
        if (!accessResult.hasAccess) {
          setShowPaywall(true);
        }
      } catch (error) {
        console.error('Error checking feature access:', error);
        setShowPaywall(true);
      } finally {
        setAccessCheckComplete(true);
      }
    };

    checkAccess();
  }, [isAuthenticated, checkFeatureAccess]);

  const processResume = async () => {
    // Check access before processing
    if (!isAuthenticated) {
      setShowPaywall(true);
      return;
    }

    try {
      const accessResult = await checkFeatureAccess('advanced_ai');
      if (!accessResult.hasAccess) {
        setShowPaywall(true);
        return;
      }
    } catch (error) {
      console.error('Error checking access before processing:', error);
      setShowPaywall(true);
      return;
    }

    if (!validateForm()) return;

    setIsProcessing(true);
    
    try {
      const request: ResumeAnalysisRequest = {
        resumeText: formData.resumeText,
        industry: formData.industry,
        experienceLevel: formData.experienceLevel,
        targetRole: formData.targetRole,
        desiredSalary: formData.desiredSalary,
        location: formData.location
      };

      if (activeTool === 'score') {
        const score = await openAIService.scoreResume(request);
        setResults(prev => ({ ...prev, score }));
        toast.success('Resume analysis complete!');
      } else if (activeTool === 'judge') {
        const critique = await openAIService.critiqueResume(request);
        setResults(prev => ({ ...prev, critique }));
        toast.success('Resume critique complete!');
      } else if (activeTool === 'rewrite') {
        const rewrite = await openAIService.rewriteResume(request);
        setResults(prev => ({ ...prev, rewrite }));
        toast.success('Resume rewrite complete!');
      }
    } catch (error: any) {
      console.error('Error processing resume:', error);
      
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

  const handleUpgrade = () => {
    navigate('/billing');
  };

  // Show loading state while checking access
  if (!accessCheckComplete) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Checking access...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="AI Resume Tools"
        description="Score, critique, and rewrite your resume with AI-powered analysis for maximum impact and ATS optimization"
        onUpgrade={handleUpgrade}
        requiredPlan="any"
      />
      
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-6 shadow-lg">
          <Sparkles className="w-5 h-5 text-white mr-2" />
          <span className="text-white font-semibold">AI-Powered Resume Tools</span>
        </div>
        
        <h1 className="text-display-lg text-gray-900 dark:text-white mb-6">
          Supercharge Your Resume with AI
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Leverage cutting-edge AI to score, critique, and rewrite your resume for maximum impact. 
          Get insights from industry experts and optimize for ATS systems.
        </p>
      </motion.div>

      {/* Tool Selection Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
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
              className={`cursor-pointer transition-all duration-300 ${
                isActive ? 'transform scale-105' : ''
              }`}
            >
              <Card className={`glass-card hover-lift h-full transition-all duration-300 ${
                isActive 
                  ? 'ring-2 ring-blue-500 shadow-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20' 
                  : ''
              }`}>
                <CardContent className="p-8 text-center">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.color} p-4 mb-6 mx-auto transform transition-transform duration-300 shadow-lg ${
                    isActive ? 'scale-110' : ''
                  }`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {config.title}
                  </h3>
                  
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-4 font-medium">
                    {config.subtitle}
                  </p>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
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
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Upload & Configure Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">Upload & Configure</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Upload your resume and provide job details for AI analysis
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
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
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50/50 dark:bg-gray-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 backdrop-blur-sm"
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
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Resume Text *
              </label>
              <textarea
                value={formData.resumeText}
                onChange={(e) => setFormData(prev => ({ ...prev, resumeText: e.target.value }))}
                placeholder="Paste your resume content here for AI analysis..."
                className="w-full h-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/50 dark:bg-gray-800/50 placeholder-gray-400 resize-none backdrop-blur-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Copy and paste your resume text for the most accurate AI analysis
              </p>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Industry *
                </label>
                <Select value={formData.industry} onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}>
                  <SelectTrigger className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                    <SelectValue placeholder="Select Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map(industry => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Experience Level *
                </label>
                <Select value={formData.experienceLevel} onValueChange={(value) => setFormData(prev => ({ ...prev, experienceLevel: value }))}>
                  <SelectTrigger className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceLevels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Target Role *
                </label>
                <Input
                  type="text"
                  value={formData.targetRole}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                  placeholder="e.g., Senior Software Engineer"
                  className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Desired Salary
                </label>
                <Input
                  type="text"
                  value={formData.desiredSalary}
                  onChange={(e) => setFormData(prev => ({ ...prev, desiredSalary: e.target.value }))}
                  placeholder="e.g., $120,000"
                  className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Location
              </label>
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., San Francisco, CA"
                className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Button Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass-card hover-lift">
          <CardContent className="p-8">
            <div className="text-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={processResume}
                disabled={isProcessing}
                className={`w-full premium-button-primary h-16 text-xl font-bold shadow-2xl ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                    Processing with AI...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Brain className="w-6 h-6 mr-3" />
                    {activeTool === 'score' && 'Analyze Resume'}
                    {activeTool === 'judge' && 'Get AI Critique'}
                    {activeTool === 'rewrite' && 'Rewrite Resume'}
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </div>
                )}
              </motion.button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {/* Score Results */}
        {activeTool === 'score' && results.score && (
          <motion.div
            key="score-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-900 dark:text-white">Resume Analysis Results</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Comprehensive AI-powered resume evaluation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Overall Score */}
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getScoreColor(results.score.overall)} mb-2`}>
                    {results.score.overall}
                  </div>
                  <div className="text-lg text-gray-600 dark:text-gray-300 font-medium mb-4">
                    Overall Score
                  </div>
                  <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${results.score.overall}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full bg-gradient-to-r ${getScoreGradient(results.score.overall)}`}
                    />
                  </div>
                </div>

                {/* Category Scores */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Category Breakdown</h3>
                  {Object.entries(results.score.categories).map(([category, score]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {category}
                      </span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-bold text-green-600 mb-4 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Strengths
                    </h3>
                    <ul className="space-y-3">
                      {results.score.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-3">
                      {results.score.weaknesses.map((weakness, index) => (
                        <li key={index} className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-bold text-blue-600 mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Recommendations
                  </h3>
                  <ul className="space-y-3">
                    {results.score.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <ChevronRight className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Judge Results */}
        {activeTool === 'judge' && results.critique && (
          <motion.div
            key="judge-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-900 dark:text-white">AI Judge Critique</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Expert feedback from our AI hiring manager
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Overall Feedback */}
                <div className="p-6 bg-gradient-to-r from-purple-50/50 to-violet-50/50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800 backdrop-blur-sm">
                  <h3 className="text-lg font-bold text-purple-600 mb-3 flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Overall Assessment
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {results.critique.overallFeedback}
                  </p>
                </div>

                {/* Section Analysis */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Section Analysis
                  </h3>
                  {results.critique.sections.map((section, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {section.name}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <div className={`text-2xl font-bold ${getScoreColor(section.score)}`}>
                            {section.score}
                          </div>
                          <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

                {/* Industry Alignment & Action Items */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center">
                      <Briefcase className="w-5 h-5 mr-2" />
                      Industry Alignment
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {results.critique.industryAlignment}
                    </p>
                  </div>

                  <div className="p-6 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center">
                      <Target className="w-5 h-5 mr-2" />
                      Priority Actions
                    </h3>
                    <div className="space-y-3">
                      {results.critique.actionItems.map((item, index) => (
                        <div key={index} className="flex items-start">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Rewrite Results */}
        {activeTool === 'rewrite' && results.rewrite && (
          <motion.div
            key="rewrite-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Edit3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-gray-900 dark:text-white">AI-Optimized Resume</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Your resume rewritten for maximum impact
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(results.rewrite!.improvedResume);
                      toast.success('Resume copied to clipboard!');
                    }}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Strategy & Changes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="p-6 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-emerald-600 mb-3 flex items-center">
                      <Brain className="w-5 h-5 mr-2" />
                      Rewriting Strategy
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {results.rewrite.reasoning}
                    </p>
                  </div>

                  <div className="p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center">
                      <Zap className="w-5 h-5 mr-2" />
                      Key Improvements
                    </h3>
                    <ul className="space-y-2">
                      {results.rewrite.changes.slice(0, 4).map((change, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Industry Optimizations */}
                <div className="p-6 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 backdrop-blur-sm">
                  <h3 className="text-lg font-bold text-purple-600 mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Industry Optimizations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.rewrite.industryOptimizations.map((optimization, index) => (
                      <div key={index} className="flex items-start">
                        <Star className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{optimization}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Improved Resume */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Your Optimized Resume
                  </h3>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto backdrop-blur-sm">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                      {results.rewrite.improvedResume}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty State */}
        {!(activeTool === 'score' ? results.score : activeTool === 'judge' ? results.critique : results.rewrite) && (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card hover-lift">
              <CardContent className="p-12 text-center">
                <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${toolConfig[activeTool].color} p-6 mx-auto mb-6 shadow-2xl`}>
                  {React.createElement(toolConfig[activeTool].icon, { className: "w-12 h-12 text-white" })}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Ready to {activeTool === 'score' ? 'Analyze' : activeTool === 'judge' ? 'Critique' : 'Rewrite'} Your Resume
                </h3>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  Fill in your information and upload your resume to get started with AI-powered {activeTool === 'score' ? 'scoring' : activeTool === 'judge' ? 'feedback' : 'optimization'}.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};