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
import { canPerformAIOperation, trackAITokens } from '../lib/aiTokenTracking';

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
    const { allowed, reason } = await canPerformAIOperation(user.id);
    if (!allowed) {
      toast.error(reason || 'Insufficient AI tokens for resume analysis');
      return;
    }

    setAnalyzing(true);
    
    // Smooth scroll to results
    setTimeout(() => {
      document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
    
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
      await trackAITokens(user.id, 'resume_optimization', {
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
    const { allowed, reason } = await canPerformAIOperation(user.id);
    if (!allowed) {
      toast.error(reason || 'Insufficient AI tokens for resume generation');
      return;
    }

    setGenerating(true);

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
      
      // Track AI token usage for generation
      await trackAITokens(user.id, 'resume_optimization', {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <span className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => navigate('/dashboard')}>
                  Dashboard
                </span>
                <ChevronRight className="w-4 h-4" />
                <span className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">Resume</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white">Optimizer</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
                  <FileText className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Resume Optimizer
                </h1>
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                AI-powered resume optimization for your dream job
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </motion.button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="relative">
          <div className="flex gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl w-fit">
            <motion.button
              onClick={() => setActiveTab('upload')}
              className={`relative px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === 'upload'
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {activeTab === 'upload' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white dark:bg-gray-700 shadow-lg rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Plus className="w-4 h-4 relative z-10" />
              <span className="relative z-10">New Analysis</span>
            </motion.button>
            <motion.button
              onClick={() => setActiveTab('history')}
              className={`relative px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {activeTab === 'history' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white dark:bg-gray-700 shadow-lg rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Clock className="w-4 h-4 relative z-10" />
              <span className="relative z-10">History</span>
            </motion.button>
          </div>
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
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Left Column - Upload & Job Details */}
              <div className="space-y-6">
                {/* File Upload */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-600/10 rounded-full blur-3xl" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-blue-600" />
                      Upload Resume
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileType className="w-3 h-3" />
                        PDF
                      </span>
                      <span className="flex items-center gap-1">
                        <FileType className="w-3 h-3" />
                        DOC
                      </span>
                      <span className="flex items-center gap-1">
                        <FileType className="w-3 h-3" />
                        DOCX
                      </span>
                    </div>
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
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-solid'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 border-dashed bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700'
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
                        <div className="space-y-4">
                          <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 2 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                            />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Processing your resume...</p>
                        </div>
                      ) : selectedFile ? (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="space-y-3"
                        >
                          <div className="relative">
                            <FileCheck className="w-12 h-12 text-green-500 mx-auto" />
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.2, type: "spring", bounce: 0.4 }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                            >
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </motion.div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
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
                            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 mx-auto"
                          >
                            <X className="w-3 h-3" />
                            Remove
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          animate={{ y: isDragging ? -5 : 0 }}
                          className="space-y-3"
                        >
                          <motion.div
                            animate={{ 
                              y: [0, -10, 0],
                              rotate: isDragging ? [0, 5, -5, 0] : 0
                            }}
                            transition={{ 
                              y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                              rotate: { duration: 0.5 }
                            }}
                          >
                            <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                          </motion.div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Drop your resume here or{' '}
                              <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                browse files
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Supports PDF, DOC, DOCX (max 10MB)
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>

                {/* Job Details */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-pink-600/10 rounded-full blur-3xl" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                      Job Details
                    </h2>
                    <Tooltip content="Paste from clipboard">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
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
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </motion.button>
                    </Tooltip>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Job Title
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                          placeholder="e.g., Senior Software Engineer"
                        />
                      </div>
                    </div>
                    
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Company Name
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                          placeholder="e.g., Google"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Job Description
                        </label>
                        <span className="text-xs text-gray-500">
                          {jobDescription.length} characters
                        </span>
                      </div>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all resize-none"
                        placeholder="Paste the job description here..."
                      />
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalyze}
                    disabled={!selectedFile || !jobTitle || !companyName || !jobDescription || analyzing}
                    className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-pink-600 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="animate-pulse">Analyzing with AI...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        Analyze Resume
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </div>

              {/* Right Column - Analysis Results */}
              <div className="space-y-6" id="analysis-results">
                {analyzing ? (
                  // Skeleton Loader for Analysis
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                      <SkeletonLoader className="h-6 w-32 mb-6" />
                      <div className="flex justify-center mb-6">
                        <SkeletonLoader className="w-32 h-32 rounded-full" />
                      </div>
                      <div className="space-y-3">
                        <SkeletonLoader className="h-4 w-full" />
                        <SkeletonLoader className="h-4 w-3/4" />
                        <SkeletonLoader className="h-4 w-5/6" />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                      <SkeletonLoader className="h-6 w-48 mb-4" />
                      <div className="space-y-3">
                        <SkeletonLoader className="h-10 w-full" />
                        <SkeletonLoader className="h-10 w-full" />
                      </div>
                    </div>
                  </div>
                ) : analysisResult ? (
                  <>
                    {/* Score Overview */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-green-600/10 rounded-full blur-3xl" />
                      
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                          Analysis Results
                        </h2>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          <Bot className="w-3 h-3 mr-1" />
                          AI Powered
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-center mb-6">
                        <div className="relative">
                          <svg className="w-40 h-40 transform -rotate-90">
                            <circle
                              cx="80"
                              cy="80"
                              r="70"
                              stroke="currentColor"
                              strokeWidth="10"
                              fill="none"
                              className="text-gray-200 dark:text-gray-700"
                            />
                            <motion.circle
                              cx="80"
                              cy="80"
                              r="70"
                              stroke="currentColor"
                              strokeWidth="10"
                              fill="none"
                              initial={{ strokeDasharray: "0 440" }}
                              animate={{ strokeDasharray: `${score * 4.4} 440` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className={`${getScoreColor(score)}`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <motion.p
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, type: "spring", bounce: 0.4 }}
                                className={`text-4xl font-bold ${getScoreColor(score)}`}
                              >
                                {score}%
                              </motion.p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Match Score</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Results Sections */}
                      <div className="space-y-3">
                        {/* Matched Keywords */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4"
                        >
                          <button
                            onClick={() => toggleSection('keywords')}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  Matched Keywords
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {analysisResult.data.summary.keywordMatches.length} keywords found
                                </p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: expandedSections.includes('keywords') ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            </motion.div>
                          </button>
                          <AnimatePresence>
                            {expandedSections.includes('keywords') && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {analysisResult.data.summary.keywordMatches.slice(0, 10).map((keyword, index) => (
                                    <motion.span
                                      key={keyword}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: index * 0.05 }}
                                      className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium"
                                    >
                                      {keyword}
                                    </motion.span>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                        
                        {/* Missing Skills */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4"
                        >
                          <button
                            onClick={() => toggleSection('skills')}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              <motion.div
                                animate={{ x: [0, -3, 3, -3, 0] }}
                                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"
                              >
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                              </motion.div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  Missing Skills
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {analysisResult.data.summary.missingSkills.length} skills to add
                                </p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: expandedSections.includes('skills') ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            </motion.div>
                          </button>
                          <AnimatePresence>
                            {expandedSections.includes('skills') && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {analysisResult.data.summary.missingSkills.slice(0, 10).map((skill, index) => (
                                    <motion.span
                                      key={skill}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: index * 0.05 }}
                                      className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium"
                                    >
                                      {skill}
                                    </motion.span>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                        
                        {/* Suggestions */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 }}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4"
                        >
                          <button
                            onClick={() => toggleSection('suggestions')}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              <motion.div
                                animate={{ 
                                  boxShadow: [
                                    "0 0 0 0 rgba(59, 130, 246, 0.5)",
                                    "0 0 0 10px rgba(59, 130, 246, 0)",
                                    "0 0 0 0 rgba(59, 130, 246, 0)",
                                  ]
                                }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"
                              >
                                <LightbulbIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </motion.div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  AI Suggestions
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {analysisResult.data.summary.suggestions.length} improvements available
                                </p>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: expandedSections.includes('suggestions') ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            </motion.div>
                          </button>
                          <AnimatePresence>
                            {expandedSections.includes('suggestions') && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-2">
                                  {analysisResult.data.summary.suggestions.slice(0, 3).map((suggestion, index) => (
                                    <motion.div
                                      key={index}
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: index * 0.1 }}
                                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                                    >
                                      <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                      <span>{suggestion}</span>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    </motion.div>

                    {/* Generation Options */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-emerald-600/10 rounded-full blur-3xl" />
                      
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Wand2 className="w-5 h-5 text-green-600" />
                          Generate Optimized Resume
                        </h2>
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Enhanced
                        </Badge>
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
                                  className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
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
                                  className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
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
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all resize-none"
                            placeholder="Any specific requirements or preferences..."
                          />
                        </div>
                        
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleGenerate}
                          disabled={generating}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-600 disabled:hover:to-emerald-600 flex items-center justify-center gap-2 shadow-lg relative overflow-hidden"
                        >
                          {generating && (
                            <motion.div
                              initial={{ x: '-100%' }}
                              animate={{ x: '100%' }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            />
                          )}
                          {generating ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="animate-pulse">Generating with AI...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-5 h-5" />
                              Generate & Download
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-12 text-center"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-2xl" />
                      </div>
                      <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4 relative z-10" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                      Upload a resume and provide job details to see AI-powered analysis
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                      <Activity className="w-4 h-4" />
                      <span>Real-time analysis</span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <Gauge className="w-4 h-4" />
                      <span>Instant feedback</span>
                    </div>
                  </motion.div>
                )}
              </div>
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  Recent Analyses
                </h2>
                
                {recentAnalyses.length > 0 ? (
                  <div className="space-y-3">
                    {recentAnalyses.map((analysis, index) => (
                      <motion.div
                        key={analysis.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer"
                        onClick={() => loadPreviousAnalysis(analysis)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl text-white group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5" />
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
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
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
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      No analyses yet. Start by uploading a resume!
                    </p>
                  </div>
                )}
              </motion.div>
              
              {/* Recent Uploads */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Recent Uploads
                </h2>
                
                {recentUploads.length > 0 ? (
                  <div className="space-y-3">
                    {recentUploads.map((upload, index) => (
                      <motion.div
                        key={upload.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
                            <FileType className="w-5 h-5" />
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
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      No uploads yet. Upload your first resume to get started!
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