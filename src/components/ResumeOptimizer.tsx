import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Download, FileText, CheckCircle, AlertCircle, Eye, TrendingUp, Target, Zap, Award, Briefcase, BookOpen, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getSignedResumeUrl } from '../lib/supabase';
import { useResumeOptimizer as useResumeOptimizerHook } from '../hooks/useResumeOptimizer';
import toast from 'react-hot-toast';

interface ResumeOptimizerProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  resumeText: string;
}

interface LocalState {
  resumeFile: File | null;
  step: 'analyze' | 'results' | 'generation';
  optimizationScore: {
    before: number;
    after: number;
  };
}

export const ResumeOptimizer: React.FC<ResumeOptimizerProps> = ({
  isOpen,
  onClose,
  job,
  resumeText
}) => {
  const { user } = useAuth();
  const {
    loading,
    error,
    analysisResult,
    generationResult,
    analyzeResume: analyzeResumeApi,
    generateOptimizedResume,
    downloadResume,
    reset
  } = useResumeOptimizerHook();

  const [localState, setLocalState] = useState<LocalState>({
    resumeFile: null,
    step: 'analyze',
    optimizationScore: {
      before: 0,
      after: 0
    }
  });

  // Fetch resume file when component opens
  useEffect(() => {
    if (isOpen && !localState.resumeFile && !loading) {
      fetchResumeFile();
    }
  }, [isOpen]);

  // Reset when component closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setLocalState({
        resumeFile: null,
        step: 'analyze',
        optimizationScore: { before: 0, after: 0 }
      });
    }
  }, [isOpen]);

  // Update scores when analysis completes
  useEffect(() => {
    if (analysisResult?.data?.summary) {
      const currentScore = analysisResult.data.summary.overallScore || 0;
      const potentialScore = Math.min(currentScore + 2, 10); // Estimate potential improvement
      
      setLocalState(prev => ({
        ...prev,
        step: 'results',
        optimizationScore: {
          before: currentScore,
          after: potentialScore
        }
      }));
    }
  }, [analysisResult]);

  // Move to generation step when resume is generated
  useEffect(() => {
    if (generationResult) {
      setLocalState(prev => ({ ...prev, step: 'generation' }));
    }
  }, [generationResult]);

  const fetchResumeFile = async () => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('resume_url')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData?.resume_url) {
        throw new Error('No resume found. Please upload a resume in your profile.');
      }

      const signedUrl = await getSignedResumeUrl(profileData.resume_url);
      if (!signedUrl) {
        throw new Error('Failed to access resume file');
      }

      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error('Failed to download resume from storage');
      }

      const blob = await response.blob();
      const fileName = profileData.resume_url.split('/').pop() || 'resume.pdf';
      const resumeFile = new File([blob], fileName, { type: 'application/pdf' });
      
      setLocalState(prev => ({ ...prev, resumeFile }));
      
      // Auto-analyze once we have the file
      if (job && resumeFile) {
        await handleAnalyze(resumeFile);
      }
    } catch (error: any) {
      console.error('Error fetching resume file:', error);
      toast.error(error.message || 'Failed to load resume');
    }
  };

  const handleAnalyze = async (fileToUse?: File) => {
    const resumeFile = fileToUse || localState.resumeFile;
    
    if (!resumeFile || !job) {
      toast.error('Resume file or job information missing');
      return;
    }

    try {
      await analyzeResumeApi(
        resumeFile,
        job.job_description || 'General position in technology industry.',
        job.job_title || 'Software Engineer',
        job.employer_name || 'Technology Company'
      );
      toast.success('Resume analyzed successfully!');
    } catch (error: any) {
      console.error('Analysis error:', error);
      // Error is already handled by the hook
    }
  };

  const handleGenerate = async () => {
    if (!analysisResult?.data?.analysisId) {
      toast.error('Please analyze the resume first');
      return;
    }

    try {
      await generateOptimizedResume(
        'full', // Always use full optimization for ResumeOptimizer
        [], // Let AI decide which sections to optimize
        [], // Let AI decide which skills to add
        '' // No additional instructions
      );
      toast.success('Optimized resume generated successfully!');
    } catch (error: any) {
      console.error('Generation error:', error);
      // Error is already handled by the hook
    }
  };

  const handleDownload = async () => {
    if (!generationResult?.data?.generationId) {
      toast.error('No generated resume available');
      return;
    }

    try {
      const downloadUrl = await downloadResume(generationResult.data.generationId);
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download resume');
    }
  };

  // Extract data for display
  const keywordMatches = analysisResult?.data?.summary?.keywordMatches || [];
  const missingSkills = analysisResult?.data?.summary?.missingSkills || [];
  const suggestions = analysisResult?.data?.summary?.suggestions || [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Resume Optimizer</h2>
                    <p className="text-blue-100">
                      Optimize for: {job?.job_title} at {job?.employer_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Progress Indicator */}
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center space-x-2 ${localState.step === 'analyze' ? 'text-white' : 'text-blue-200'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      localState.step === 'analyze' ? 'bg-white text-blue-600' : 
                      analysisResult ? 'bg-green-500 text-white' : 'bg-white/20'
                    }`}>
                      {analysisResult ? <CheckCircle className="h-4 w-4" /> : '1'}
                    </div>
                    <span className="text-sm font-medium">Analyze</span>
                  </div>
                  <div className="w-8 h-0.5 bg-white/30" />
                  <div className={`flex items-center space-x-2 ${localState.step === 'results' ? 'text-white' : 'text-blue-200'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      localState.step === 'results' ? 'bg-white text-blue-600' : 
                      generationResult ? 'bg-green-500 text-white' : 'bg-white/20'
                    }`}>
                      {generationResult ? <CheckCircle className="h-4 w-4" /> : '2'}
                    </div>
                    <span className="text-sm font-medium">Optimize</span>
                  </div>
                  <div className="w-8 h-0.5 bg-white/30" />
                  <div className={`flex items-center space-x-2 ${localState.step === 'generation' ? 'text-white' : 'text-blue-200'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      localState.step === 'generation' ? 'bg-white text-blue-600' : 'bg-white/20'
                    }`}>
                      <Download className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Download</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Loading State */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-lg font-medium text-gray-800 mt-4">
                    {localState.step === 'analyze' ? 'Analyzing your resume...' : 'Generating optimized resume...'}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">This may take a few moments</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center">
                    <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
                    <div className="text-red-800">
                      <p className="font-semibold">Optimization Failed</p>
                      <p className="text-sm mt-1">{error}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAnalyze()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Analysis Results */}
              {!loading && !error && analysisResult && localState.step === 'results' && (
                <div className="space-y-6">
                  {/* Score Display */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-gray-800 mb-2">
                          {localState.optimizationScore.before.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">Current Score</div>
                        <div className="flex items-center justify-center mt-2">
                          <Target className="h-4 w-4 text-gray-500 mr-1" />
                          <span className="text-xs text-gray-500">ATS Compatibility</span>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-4xl font-bold text-green-600 mb-2">
                          {localState.optimizationScore.after.toFixed(1)}
                        </div>
                        <div className="text-sm text-green-700">Potential Score</div>
                        <div className="flex items-center justify-center mt-2">
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-xs text-green-600">
                            +{(localState.optimizationScore.after - localState.optimizationScore.before).toFixed(1)} improvement
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Keywords */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <Award className="h-5 w-5 text-green-600 mr-2" />
                        <h3 className="font-semibold text-gray-900">Matched Keywords</h3>
                        <span className="ml-auto bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          {keywordMatches.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {keywordMatches.length > 0 ? (
                          keywordMatches.map((keyword, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                            >
                              {keyword}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No specific keywords found</p>
                        )}
                      </div>
                    </div>

                    {/* Missing Skills */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <BookOpen className="h-5 w-5 text-orange-600 mr-2" />
                        <h3 className="font-semibold text-gray-900">Skills to Add</h3>
                        <span className="ml-auto bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                          {missingSkills.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {missingSkills.length > 0 ? (
                          missingSkills.map((skill, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">Your skills look comprehensive!</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center mb-4">
                      <Briefcase className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="font-semibold text-gray-900">Optimization Recommendations</h3>
                    </div>
                    <div className="space-y-3">
                      {suggestions.length > 0 ? (
                        suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start">
                            <CheckCircle className="h-4 w-4 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-700 text-sm">{suggestion}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No specific recommendations available</p>
                      )}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleGenerate}
                      disabled={loading}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
                    >
                      <Sparkles className="h-5 w-5" />
                      <span className="font-medium">Generate Optimized Resume</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Generation Results */}
              {generationResult && localState.step === 'generation' && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Resume Optimized Successfully!</h3>
                  <p className="text-gray-600 mb-8">Your resume has been optimized for the {job?.job_title} position</p>
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={handleDownload}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 flex items-center space-x-2"
                    >
                      <Download className="h-5 w-5" />
                      <span>Download Resume</span>
                    </button>
                    
                    <button
                      onClick={() => setLocalState(prev => ({ ...prev, step: 'results' }))}
                      className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                      <Eye className="h-5 w-5" />
                      <span>View Analysis</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};