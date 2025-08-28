import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  ChevronRight,
  Brain,
  Target,
  Sparkles,
  RefreshCw,
  X,
  Eye,
  Edit3,
  FileCheck,
  BarChart3,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  ArrowLeft,
  Plus,
  Briefcase,
  Building,
  Info,
  LightbulbIcon,
  Wand2,
  Bot,
  Copy,
  FileType,
  ChevronDown,
  ChevronUp,
  Star,
  ArrowRight,
  Gauge,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { analyzeResume, generateOptimizedResume, downloadResume, validateResumeFile, AnalyzeResponse, GenerateResponse, getApiToken } from '../lib/resumeApiClient';
import toast from 'react-hot-toast';
import { Badge } from './ui/badge';
import { canPerformAction, trackAITokenUsage } from '../lib/usageTracking';

interface ResumeUpload {
  id: string;
  filename: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

interface ResumeAnalysis {
  id: string;
  resume_text: string;
  job_title?: string;
  company_name?: string;
  job_description?: string;
  analysis_result?: any;
  analysis_id?: string;
  created_at: string;
}

// Skeleton Loader Component
const SkeletonLoader = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

// Tooltip Component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
    </div>
  </div>
);

export const ResumePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  
  const [recentUploads, setRecentUploads] = useState<ResumeUpload[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<ResumeAnalysis[]>([]);
  
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [editType, setEditType] = useState<'full' | 'quick'>('full');
  
  const [expandedSections, setExpandedSections] = useState<string[]>(['keywords', 'skills', 'suggestions']);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'analysis' | 'generation'>('upload');

  useEffect(() => {
    if (user) {
      fetchRecentUploads();
      fetchRecentAnalyses();
    }
  }, [user]);

  // Animate score when analysis result changes
  useEffect(() => {
    if (analysisResult?.data?.summary?.overallScore) {
      const targetScore = analysisResult.data.summary.overallScore;
      const duration = 1500;
      const startTime = Date.now();
      
      const animateScore = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentScore = Math.round(targetScore * easeOutQuart);
        
        setScore(currentScore);
        
        if (progress < 1) {
          requestAnimationFrame(animateScore);
        }
      };
      
      animateScore();
    }
  }, [analysisResult]);

  const fetchRecentUploads = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('resume_uploads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentUploads(data);
    }
  };

  const fetchRecentAnalyses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('resume_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentAnalyses(data);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      handleFileSelect({ target: { files: [pdfFile] } } as any);
    } else {
      toast.error('Please drop a PDF file');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateResumeFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    
    // Extract text from PDF
    try {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      toast.success('Resume uploaded successfully!');
    } catch (error) {
      console.error('Error extracting text:', error);
      toast.error('Failed to extract text from PDF');
    } finally {
      setUploading(false);
    }
  };

  const uploadResumeToStorage = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('resume-uploads')
      .upload(fileName, file);

    if (error) throw error;
    return data.path;
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !user) {
      toast.error('Please select a resume file');
      return;
    }

    if (!jobTitle || !companyName || !jobDescription) {
      toast.error('Please fill in all job details');
      return;
    }

    // Check AI token limits before analyzing
    const canPerform = await canPerformAction(user.id, 'resume_optimization');
    if (!canPerform.allowed) {
      toast.error(canPerform.reason || 'Insufficient AI tokens for resume analysis');
      return;
    }

    setAnalyzing(true);
    // brief delay so the button shows its loading state before transitioning
    await new Promise(resolve => setTimeout(resolve, 200));
    setCurrentStep('analysis');
    
    try {
      // Upload file to storage
      const filePath = await uploadResumeToStorage(selectedFile);
      
      // Save upload record
      const { data: uploadData, error: uploadError } = await supabase
        .from('resume_uploads')
        .insert({
          user_id: user.id,
          filename: selectedFile.name,
          file_url: filePath,
          file_size: selectedFile.size,
          upload_type: 'analysis'
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      // Call analysis API
      const result = await analyzeResume(
        user.id,
        selectedFile,
        jobDescription,
        jobTitle,
        companyName
      );

      setAnalysisResult(result);
      
      // Transition to analysis view
      setTimeout(() => {
        setAnalyzing(false);
      }, 500);

      // Save analysis record
      const { data: analysisData, error: analysisError } = await supabase
        .from('resume_analyses')
        .insert({
          user_id: user.id,
          resume_upload_id: uploadData.id,
          resume_text: resumeText,
          job_title: jobTitle,
          company_name: companyName,
          job_description: jobDescription,
          analysis_result: result,
          analysis_id: result.data.analysisId
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      setCurrentAnalysisId(analysisData.id);
      
      // Initialize selected sections and skills
      if (result.data.sections) {
        setSelectedSections(result.data.sections.map(s => s.id));
      }
      if (result.data.skills?.suggested) {
        setSelectedSkills(result.data.skills.suggested.slice(0, 10));
      }

      toast.success('Resume analyzed successfully!');
      
      // Track AI token usage
      await trackAITokenUsage(user.id, 'resume_optimization', {
        action: 'analyze',
        analysisId: result.data.analysisId,
        jobTitle: jobTitle,
        companyName: companyName
      });
      
      // Refresh lists
      fetchRecentUploads();
      fetchRecentAnalyses();
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to analyze resume');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysisResult || !user || !currentAnalysisId) {
      toast.error('Please analyze a resume first');
      return;
    }

    // Check AI token limits before generating
    const canPerform = await canPerformAction(user.id, 'resume_optimization');
    if (!canPerform.allowed) {
      toast.error(canPerform.reason || 'Insufficient AI tokens for resume generation');
      return;
    }

    setGenerating(true);
    setCurrentStep('generation');

    try {
      const result = await generateOptimizedResume(
        user.id,
        analysisResult.data.analysisId,
        editType,
        selectedSections,
        selectedSkills,
        additionalInstructions
      );

      // Save generation record
      await supabase
        .from('resume_generations')
        .insert({
          user_id: user.id,
          analysis_id: currentAnalysisId,
          generation_id: result.data.generationId,
          generation_result: result,
          download_url: result.data.downloadUrl,
          filename: result.data.filename,
          edit_type: editType,
          selected_sections: selectedSections,
          selected_skills: selectedSkills,
          additional_instructions: additionalInstructions
        });

      // Download the file
      const downloadUrl = await downloadResume(user.id, result.data.generationId);
      
      // Instead of opening in new tab, trigger a download
      try {
        const token = await getApiToken(user.id);
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename || 'optimized_resume.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Download error:', error);
        // Fallback to opening in new tab
        window.open(downloadUrl, '_blank');
      }
      
      toast.success('Resume generated successfully!');
      
      // Show success state briefly then reset
      setTimeout(() => {
        setGenerating(false);
      }, 500);
      
      // Auto-reset after showing success
      setTimeout(() => {
        setCurrentStep('upload');
        setAnalysisResult(null);
        setSelectedFile(null);
        setJobTitle('');
        setCompanyName('');
        setJobDescription('');
      }, 3000);
      
      // Track AI token usage for generation
      await trackAITokenUsage(user.id, 'resume_optimization', {
        action: 'generate',
        generationId: result.data.generationId,
        editType: editType
      });
      
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate resume');
    } finally {
      setGenerating(false);
    }
  };

  const loadPreviousAnalysis = (analysis: ResumeAnalysis) => {
    if (analysis.analysis_result) {
      setAnalysisResult(analysis.analysis_result);
      setCurrentAnalysisId(analysis.id);
      setJobTitle(analysis.job_title || '');
      setCompanyName(analysis.company_name || '');
      setJobDescription(analysis.job_description || '');
      
      // Initialize selections
      if (analysis.analysis_result.data.sections) {
        setSelectedSections(analysis.analysis_result.data.sections.map((s: any) => s.id));
      }
      if (analysis.analysis_result.data.skills?.suggested) {
        setSelectedSkills(analysis.analysis_result.data.skills.suggested.slice(0, 10));
      }
      
      setActiveTab('upload');
      toast.success('Previous analysis loaded');
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 30) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return 'from-green-500 to-green-600';
    if (score >= 30) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  };

  // Calculate progress based on completed steps
  const calculateProgress = () => {
    let steps = 0;
    if (selectedFile) steps++;
    if (jobTitle && companyName && jobDescription) steps++;
    if (analysisResult) steps++;
    if (analysisResult && (selectedSections.length > 0 || selectedSkills.length > 0)) steps++;
    return (steps / 4) * 100;
  };

  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900">
      {/* Header */}
      <div className="glass-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-light text-gray-900 dark:text-white">
                Resume Optimizer
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Transform your resume for your dream job
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="relative">
            <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#23a972]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {['Upload', 'Job Details', 'Analysis', 'Generate'].map((step, index) => (
                <div key={step} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    (index + 1) * 25 <= progress ? 'bg-[#23a972]' : 'bg-gray-300 dark:bg-gray-700'
                  }`} />
                  <span className={`text-xs ${
                    (index + 1) * 25 <= progress ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'
                  }`}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-[#23a972] text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:shadow-md border border-gray-200 dark:border-gray-700'
            }`}
          >
            New Analysis
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-[#23a972] text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:shadow-md border border-gray-200 dark:border-gray-700'
            }`}
          >
            View History
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-12">
        <AnimatePresence mode="wait">
          {activeTab === 'upload' ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-5xl mx-auto"
            >
              {/* Progressive Flow Based on Current Step */}
              {currentStep === 'upload' ? (
                <div className="space-y-6">
                  {/* Step 1: File Upload */}
                  <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-6"
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-light text-gray-900 dark:text-white mb-1">
                      Upload Resume
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Supports PDF, DOC, DOCX files up to 10MB
                    </p>
                  </div>
                  
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`relative border-2 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      selectedFile
                        ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
                        : isDragging
                        ? 'border-[#23a972] bg-gray-50 dark:bg-gray-800/50 border-solid'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 border-dashed'
                    }`}
                  >
                    <motion.div
                      animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                      transition={{ type: "spring", bounce: 0.4 }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      
                      {uploading ? (
                        <div className="space-y-3">
                          <Loader2 className="w-8 h-8 text-[#23a972] mx-auto animate-spin" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">Processing...</p>
                        </div>
                      ) : selectedFile ? (
                        <div className="space-y-3">
                          <CheckCircle className="w-8 h-8 text-[#23a972] mx-auto" />
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setResumeText('');
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Change file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Drop your resume here or{' '}
                              <span className="text-[#23a972] hover:text-[#1e9463]">
                                browse
                              </span>
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              PDF, DOC, DOCX
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
              </motion.div>

              {/* Step 2: Job Details */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`glass-card p-6 relative overflow-hidden transition-opacity ${
                  !selectedFile ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Step Number */}
                <div className="absolute top-6 right-6 w-8 h-8 bg-[#23a972]/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-[#23a972]">2</span>
                </div>
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                        Target Position
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Describe the job you're applying for
                      </p>
                    </div>
                </div>
                
                <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          setJobDescription(text);
                          toast.success('Pasted from clipboard');
                        }
                      } catch (error) {
                        toast.error('Failed to paste from clipboard');
                      }
                    }}
                    className="absolute top-6 right-14 p-2 text-gray-400 hover:text-[#23a972] transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    title="Paste from clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#23a972] focus:border-[#23a972] dark:bg-gray-800 dark:text-white transition-all"
                        placeholder="e.g., Senior Software Engineer"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#23a972] focus:border-[#23a972] dark:bg-gray-800 dark:text-white transition-all"
                        placeholder="e.g., Google"
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-gray-600 dark:text-gray-400">
                          Job Description
                        </label>
                        <span className="text-xs text-gray-400">
                          {jobDescription.length} characters
                        </span>
                      </div>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#23a972] focus:border-[#23a972] dark:bg-gray-800 dark:text-white transition-all resize-none"
                        placeholder="Paste the job description here..."
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleAnalyze}
                    disabled={!selectedFile || !jobTitle || !companyName || !jobDescription || analyzing}
                    className="mt-6 w-full bg-[#23a972] hover:bg-[#1e9463] text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing Resume...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        Analyze with AI
                      </>
                    )}
                  </button>
                  </motion.div>
                </div>
              ) : currentStep === 'analysis' ? (
                /* Analysis View */
                analyzing ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-32"
                  >
                    <div className="w-20 h-20 bg-[#23a972]/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Brain className="w-10 h-10 text-[#23a972] animate-pulse" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                      Analyzing Your Resume
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Comparing with {jobTitle} at {companyName}
                    </p>
                    <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#23a972]"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 3, ease: "easeInOut" }}
                      />
                    </div>
                  </motion.div>
                ) : analysisResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                  >
                    {/* Analysis Card */}
                    <motion.div className="glass-card p-6 relative overflow-hidden">
                      {/* Back Button */}
                      <button
                        onClick={() => {
                          setCurrentStep('upload');
                          setAnalysisResult(null);
                        }}
                        className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        title="Back to upload"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      
                      {/* Step Number */}
                      <div className="absolute top-6 right-6 w-8 h-8 bg-[#23a972]/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-[#23a972]">3</span>
                      </div>
                      
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-[#23a972]/10 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-[#23a972]" />
                          </div>
                          <div>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                              Analysis Complete
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Your resume has been analyzed
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center mb-8">
                        <div className="relative">
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-gray-200 dark:text-gray-700"
                            />
                            <motion.circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              initial={{ strokeDasharray: "0 352" }}
                              animate={{ strokeDasharray: `${score * 3.52} 352` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className="text-[#1DE0DD]"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-3xl font-light text-gray-900 dark:text-white"
                              >
                                {score}%
                              </motion.p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Match</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Results Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                          <p className="text-2xl font-light text-gray-900 dark:text-white mb-1">
                            {analysisResult.data.summary.keywordMatches.length}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Matched Keywords</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 text-center">
                          <p className="text-2xl font-light text-amber-600 dark:text-amber-500 mb-1">
                            {analysisResult.data.summary.missingSkills.length}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Skills to Add</p>
                        </div>
                        <div className="bg-[#23a972]/10 dark:bg-[#23a972]/10 rounded-xl p-4 text-center">
                          <p className="text-2xl font-light text-[#23a972] mb-1">
                            {analysisResult.data.summary.suggestions.length}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Suggestions</p>
                        </div>
                      </div>
                      
                      {/* Expandable Sections */}
                      <div className="space-y-3">
                        {/* Matched Keywords */}
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                          <button
                            onClick={() => toggleSection('keywords')}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                Matched Keywords
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {analysisResult.data.summary.keywordMatches.length} found
                              </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              expandedSections.includes('keywords') ? 'rotate-180' : ''
                            }`} />
                          </button>
                          <AnimatePresence>
                            {expandedSections.includes('keywords') && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {analysisResult.data.summary.keywordMatches.slice(0, 10).map((keyword) => (
                                    <span
                                      key={keyword}
                                      className="px-3 py-1.5 bg-[#1DE0DD]/10 text-[#1DE0DD] rounded-lg text-xs font-medium"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Missing Skills */}
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                          <button
                            onClick={() => toggleSection('skills')}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                Missing Skills
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {analysisResult.data.summary.missingSkills.length} to add
                              </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              expandedSections.includes('skills') ? 'rotate-180' : ''
                            }`} />
                          </button>
                          <AnimatePresence>
                            {expandedSections.includes('skills') && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {analysisResult.data.summary.missingSkills.slice(0, 10).map((skill) => (
                                    <span
                                      key={skill}
                                      className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Suggestions */}
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                          <button
                            onClick={() => toggleSection('suggestions')}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                AI Suggestions
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {analysisResult.data.summary.suggestions.length} improvements
                              </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              expandedSections.includes('suggestions') ? 'rotate-180' : ''
                            }`} />
                          </button>
                          <AnimatePresence>
                            {expandedSections.includes('suggestions') && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-2">
                                  {analysisResult.data.summary.suggestions.slice(0, 3).map((suggestion, index) => (
                                    <div
                                      key={index}
                                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm text-gray-600 dark:text-gray-400"
                                    >
                                      <LightbulbIcon className="w-4 h-4 text-[#1DE0DD] flex-shrink-0 mt-0.5" />
                                      <span className="leading-relaxed">{suggestion}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>

                    {/* Step 4: Generation Options */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="glass-card p-6 relative overflow-hidden"
                    >
                      {/* Step Number */}
                      <div className="absolute top-6 right-6 w-8 h-8 bg-gradient-to-br from-[#1DE0DD]/10 to-[#00C4CC]/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-[#1DE0DD]">4</span>
                      </div>
                      
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#1DE0DD]/20 to-[#00C4CC]/20 rounded-lg flex items-center justify-center">
                            <Wand2 className="w-5 h-5 text-[#1DE0DD]" />
                          </div>
                          <div>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                              Generate Optimized Resume
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Create a tailored version for this position
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Optimization Type
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <motion.label
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                editType === 'full'
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="radio"
                                value="full"
                                checked={editType === 'full'}
                                onChange={(e) => setEditType(e.target.value as 'full')}
                                className="sr-only"
                              />
                              <div className="text-center">
                                <Zap className={`w-6 h-6 mx-auto mb-1 ${
                                  editType === 'full' ? 'text-green-600' : 'text-gray-400'
                                }`} />
                                <span className={`text-sm font-medium ${
                                  editType === 'full' ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Full Optimization
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Complete rewrite
                                </p>
                              </div>
                              {editType === 'full' && (
                                <motion.div
                                  layoutId="editTypeIndicator"
                                  className="absolute top-2 right-2 w-5 h-5 bg-[#1DE0DD] rounded-full flex items-center justify-center"
                                  transition={{ type: "spring", bounce: 0.3 }}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </motion.div>
                              )}
                            </motion.label>
                            
                            <motion.label
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                editType === 'quick'
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="radio"
                                value="quick"
                                checked={editType === 'quick'}
                                onChange={(e) => setEditType(e.target.value as 'quick')}
                                className="sr-only"
                              />
                              <div className="text-center">
                                <Edit3 className={`w-6 h-6 mx-auto mb-1 ${
                                  editType === 'quick' ? 'text-green-600' : 'text-gray-400'
                                }`} />
                                <span className={`text-sm font-medium ${
                                  editType === 'quick' ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Quick Edit
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Minor tweaks
                                </p>
                              </div>
                              {editType === 'quick' && (
                                <motion.div
                                  layoutId="editTypeIndicator"
                                  className="absolute top-2 right-2 w-5 h-5 bg-[#1DE0DD] rounded-full flex items-center justify-center"
                                  transition={{ type: "spring", bounce: 0.3 }}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </motion.div>
                              )}
                            </motion.label>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Additional Instructions (Optional)
                          </label>
                          <textarea
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#1DE0DD]/20 focus:border-[#1DE0DD] dark:bg-gray-800 dark:text-white transition-all resize-none"
                            placeholder="Any specific requirements or preferences..."
                          />
                        </div>
                        
                        <button
                          onClick={handleGenerate}
                          disabled={generating}
                          className="w-full bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] hover:from-[#00C4CC] hover:to-[#00B4BC] text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-[#1DE0DD] disabled:hover:to-[#00C4CC] flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {generating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating Optimized Resume...
                            </>
                          ) : (
                            <>
                              <Download className="w-5 h-5" />
                              Generate & Download
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )
              ) : currentStep === 'generation' ? (
                /* Generation View */
                generating ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-32"
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-[#1DE0DD]/20 to-[#00C4CC]/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Wand2 className="w-10 h-10 text-[#1DE0DD] animate-pulse" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                      Generating Optimized Resume
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Creating your tailored resume...
                    </p>
                    <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC]"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 5, ease: "easeInOut" }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md mx-auto text-center"
                  >
                    <div className="glass-card p-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.4 }}
                        className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
                      >
                        <CheckCircle className="w-10 h-10 text-green-500" />
                      </motion.div>
                      
                      <h3 className="text-2xl font-light text-gray-900 dark:text-white mb-2">
                        Resume Ready!
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                        Your optimized resume has been generated
                      </p>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            setCurrentStep('upload');
                            setAnalysisResult(null);
                            setSelectedFile(null);
                            setJobTitle('');
                            setCompanyName('');
                            setJobDescription('');
                          }}
                          className="w-full px-6 py-3 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] hover:from-[#00C4CC] hover:to-[#00B4BC] text-white font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
                        >
                          Create Another Resume
                        </button>
                        
                        <button
                          onClick={() => setActiveTab('history')}
                          className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                        >
                          View History
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Recent Analyses */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-8 hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                      Recent Analyses
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Your previous resume optimizations
                    </p>
                  </div>
                </div>
                
                {recentAnalyses.length > 0 ? (
                  <div className="space-y-3">
                    {recentAnalyses.map((analysis, index) => (
                      <motion.div
                        key={analysis.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl hover:shadow-lg transition-all cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-[#23a972]/30 dark:hover:border-[#23a972]/30"
                        onClick={() => loadPreviousAnalysis(analysis)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-[#23a972]/10 rounded-xl group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5 text-[#23a972]" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {analysis.job_title || 'Untitled'} at {analysis.company_name || 'Unknown'}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(analysis.created_at).toLocaleDateString()}
                              </p>
                              {analysis.analysis_result?.data?.summary?.overallScore && (
                                <Badge className={`text-xs ${
                                  analysis.analysis_result.data.summary.overallScore >= 70
                                    ? 'bg-[#23a972]/10 text-[#23a972]'
                                    : analysis.analysis_result.data.summary.overallScore >= 30
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                  {analysis.analysis_result.data.summary.overallScore}% Match
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#23a972] transition-colors" />
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <FileText className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-2">No Analyses Yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                      Upload your resume and analyze it for a job position to see it here
                    </p>
                  </div>
                )}
              </motion.div>
              
              {/* Recent Uploads */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-8 hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[#23a972]/10 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-[#23a972]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                      Recent Uploads
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Your uploaded resume files
                    </p>
                  </div>
                </div>
                
                {recentUploads.length > 0 ? (
                  <div className="space-y-3">
                    {recentUploads.map((upload, index) => (
                      <motion.div
                        key={upload.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-[#23a972]/10 rounded-xl">
                            <FileType className="w-5 h-5 text-[#23a972]" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {upload.filename}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <span>{(upload.file_size / 1024 / 1024).toFixed(2)} MB</span>
                              <span className="text-gray-300 dark:text-gray-600">•</span>
                              <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-2">No Uploads Yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                      Your uploaded resumes will appear here for quick access
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};