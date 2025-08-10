import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Download, FileText, CheckCircle, AlertCircle, Eye, TrendingUp, Target, Zap, Award, Briefcase, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getSignedResumeUrl } from '../lib/supabase';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import toast, { Toaster } from 'react-hot-toast';
import { canPerformAction, trackAITokenUsage } from '../lib/usageTracking';

interface ResumeOptimizerProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  resumeText: string;
}

interface OptimizationState {
  loading: boolean;
  error: string | null;
  analysisComplete: boolean;
  analysisData: any | null;
  authToken?: string;
  generating: boolean;
  previewUrl: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  optimizationScore?: {
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
  const [state, setState] = useState<OptimizationState>({
    loading: false,
    error: null,
    analysisComplete: false,
    analysisData: null,
    generating: false,
    previewUrl: null,
    downloadUrl: null,
    fileName: null
  });

  // Get API URL for Railway-hosted resume service
  const RESUME_API_URL = import.meta.env.VITE_RESUME_API_URL || 'https://terrific-imagination-production-6ca9.up.railway.app';

  const analyzeResume = async () => {
    setState(prev => ({ ...prev, loading: true, error: null, analysisComplete: false }));

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Check AI token limits
      const { allowed, reason } = await canPerformAction(user.id, 'resume_optimization');
      if (!allowed) {
        throw new Error(reason || 'Insufficient AI tokens for resume optimization');
      }

      let resumeFile: File | undefined;

      // We always need a file for the API, so fetch from Supabase
      // (The backend doesn't accept text-only requests)
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch user's profile to get resume_url
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('resume_url')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData?.resume_url) {
        throw new Error('No resume found. Please upload a resume in your profile.');
      }

      // Get signed URL for the resume
      const signedUrl = await getSignedResumeUrl(profileData.resume_url);
      if (!signedUrl) {
        throw new Error('Failed to access resume file');
      }

      // Fetch the actual file
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error('Failed to download resume from storage');
      }

      const blob = await response.blob();
      const fileName = profileData.resume_url.split('/').pop() || 'resume.pdf';
      resumeFile = new File([blob], fileName, { type: 'application/pdf' });

      // Get Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }
      
      // Get JWT token from Resume API
      const tokenResponse = await fetch(`${RESUME_API_URL}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: session.user.id
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to authenticate with resume service');
      }
      
      const { access_token: authToken } = await tokenResponse.json();
      
      if (!authToken) {
        throw new Error('Failed to get authentication token');
      }

      // Store token for later use in generate
      setState(prev => ({ ...prev, authToken }));

      // Step 1: Analyze the resume - API only accepts form data with file upload
      if (!resumeFile) {
        throw new Error('Resume file is required for analysis');
      }

      // Use multipart form data (the only format the backend accepts)
      const formData = new FormData();
      formData.append('resume', resumeFile);
      
      // Ensure minimum length requirements are met
      const jobDesc = job?.job_description || 'No specific job description provided. Looking for a general position that matches the candidate skills and experience in the technology industry.';
      formData.append('job_description', jobDesc.length >= 50 ? jobDesc : jobDesc.padEnd(50, '.'));
      formData.append('job_title', job?.job_title || 'Software Engineer');
      formData.append('company_name', job?.employer_name || 'Technology Company');
      
      const analyzeResponse = await fetch(`${RESUME_API_URL}/api/resume/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Analysis failed: ${analyzeResponse.status}`);
      }

      const analyzeResult = await analyzeResponse.json();
      const analysisData = analyzeResult.data || analyzeResult;
      
      // Log the analysis data to debug
      console.log('Analysis Data:', analysisData);
      
      // Update state with analysis results
      setState(prev => ({
        ...prev,
        loading: false,
        analysisComplete: true,
        analysisData,
        optimizationScore: {
          before: analysisData.summary?.overallScore || analysisData.currentScore || 0,
          after: analysisData.summary?.potentialScore || analysisData.potentialScore || 0
        }
      }));

      toast.success('Resume analyzed successfully!');

    } catch (error: any) {
      console.error('Analysis error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to analyze resume'
      }));
      toast.error(error.message || 'Failed to analyze resume');
    }
  };

  const generateOptimizedResume = async () => {
    setState(prev => ({ ...prev, generating: true, error: null }));

    try {
      if (!state.analysisData || !state.authToken) {
        throw new Error('Please analyze the resume first');
      }

      // Step 2: Generate the optimized resume
      // Ensure we have valid data for the request
      const requestBody = {
        analysisId: state.analysisData.analysisId || state.analysisData.id,
        editType: 'full', // or 'quick' based on user preference
        selectedSections: Array.isArray(state.analysisData.suggestedSections) 
          ? state.analysisData.suggestedSections 
          : [],
        selectedSkills: Array.isArray(state.analysisData.suggestedSkills) 
          ? state.analysisData.suggestedSkills 
          : [],
        additionalInstructions: ''
      };
      
      console.log('Generate Request Body:', requestBody);
      
      const generateResponse = await fetch(`${RESUME_API_URL}/api/resume/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.authToken}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json().catch(() => ({}));
        
        console.error('Generate Error Response:', {
          status: generateResponse.status,
          error: errorData
        });
        
        // Handle LaTeX compilation errors specifically
        if (generateResponse.status === 500 && (errorData.error?.includes('LaTeX') || errorData.message?.includes('LaTeX'))) {
          throw new Error('Resume generation failed due to formatting issues. The backend is having issues with special characters in the resume. This is a known issue we are working to fix.');
        }
        
        // Handle validation errors
        if (generateResponse.status === 422) {
          const details = errorData.detail?.[0]?.msg || errorData.detail || 'Invalid request data';
          throw new Error(`Validation error: ${details}`);
        }
        
        throw new Error(errorData.error || errorData.message || errorData.detail || `Generation failed: ${generateResponse.status}`);
      }

      const generateResult = await generateResponse.json();
      const generationData = generateResult.data || generateResult;
      
      // Update state with generation results
      setState(prev => ({
        ...prev,
        generating: false,
        previewUrl: generationData.previewUrl || generationData.downloadUrl,
        downloadUrl: generationData.downloadUrl || generationData.previewUrl,
        fileName: generationData.fileName || `optimized_resume_${new Date().toISOString().split('T')[0]}.pdf`
      }));

      // Track successful optimization
      await trackAITokenUsage(user.id, 'resume_optimization', {
        jobTitle: job?.job_title || 'Not specified',
        companyName: job?.employer_name || 'Not specified',
        method: 'simple_optimizer'
      });

      toast.success('Resume generated successfully!');

    } catch (error: any) {
      console.error('Generation error:', error);
      setState(prev => ({
        ...prev,
        generating: false,
        error: error.message || 'Failed to generate resume'
      }));
      toast.error(error.message || 'Failed to generate resume');
    }
  };

  const handleDownload = () => {
    if (state.downloadUrl) {
      window.open(state.downloadUrl, '_blank');
      toast.success('Download started!');
    }
  };

  const handlePreview = () => {
    if (state.previewUrl) {
      window.open(state.previewUrl, '_blank');
    }
  };

  // Auto-start analysis when panel opens
  React.useEffect(() => {
    if (isOpen && !state.loading && !state.analysisComplete && !state.previewUrl) {
      analyzeResume();
    }
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            {/* Modal - Stop propagation to prevent closing when clicking inside */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              <div className="p-6">
                {state.loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-12 h-12 text-[#1DE0DD] animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Analyzing Your Resume
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Comparing your resume with {job?.job_title || 'this position'}...
                    </p>
                  </div>
                ) : state.generating ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-12 h-12 text-[#1DE0DD] animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Generating Optimized Resume
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Creating your tailored resume document...
                    </p>
                  </div>
                ) : state.error ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Optimization Failed
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {state.error}
                    </p>
                    <button
                      onClick={analyzeResume}
                      className="px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : state.analysisComplete && !state.previewUrl ? (
                  <div>
                    {/* Premium Header */}
                    <div className="text-center mb-6">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-gradient-to-br from-[#1DE0DD]/20 to-[#00C4CC]/20 rounded-full flex items-center justify-center mx-auto mb-4"
                      >
                        <div className="w-14 h-14 bg-gradient-to-br from-[#1DE0DD] to-[#00C4CC] rounded-full flex items-center justify-center">
                          <Target className="w-8 h-8 text-white" />
                        </div>
                      </motion.div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Analysis Complete!
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-white">{job?.job_title}</span>
                        {' at '}
                        <span className="font-semibold text-gray-900 dark:text-white">{job?.employer_name}</span>
                      </p>
                    </div>

                    {/* Match Score Card with Progress Bar */}
                    {state.optimizationScore && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#1DE0DD]" />
                            <span className="font-semibold text-gray-900 dark:text-white">Match Analysis</span>
                          </div>
                          <span className="text-xs px-2 py-1 bg-[#1DE0DD]/10 text-[#1DE0DD] rounded-full font-medium">
                            AI Powered
                          </span>
                        </div>
                        
                        {/* Current Score */}
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Current Match</span>
                              <span className="text-lg font-bold text-gray-900 dark:text-white">{state.optimizationScore.before}%</span>
                            </div>
                            <div className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${state.optimizationScore.before}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-gray-400 to-gray-500 rounded-full"
                              />
                            </div>
                          </div>
                          
                          {/* Potential Score */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Zap className="w-4 h-4 text-[#1DE0DD]" />
                                Potential Match
                              </span>
                              <span className="text-lg font-bold text-[#1DE0DD]">{state.optimizationScore.after}%</span>
                            </div>
                            <div className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${state.optimizationScore.after}%` }}
                                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                                className="h-full bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] rounded-full"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Improvement Badge */}
                        <div className="mt-4 flex items-center justify-center">
                          <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              +{state.optimizationScore.after - state.optimizationScore.before}% Improvement Possible
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Analysis Details */}
                    {state.analysisData && (
                      <div className="space-y-3 mb-6">
                        {/* Key Insights */}
                        {(state.analysisData.keyInsights || state.analysisData.summary?.keyInsights) && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Key Insights</span>
                            </div>
                            <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                              {(state.analysisData.keyInsights || state.analysisData.summary?.keyInsights || []).slice(0, 3).map((insight: string, idx: number) => (
                                <li key={idx} className="flex items-start">
                                  <span className="mr-2">•</span>
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Skills Match */}
                        {(state.analysisData.matchingSkills || state.analysisData.skills?.matching) && (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-sm font-medium text-green-900 dark:text-green-300">Matching Skills</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(state.analysisData.matchingSkills || state.analysisData.skills?.matching || []).slice(0, 5).map((skill: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300 rounded-md text-xs">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Missing Skills */}
                        {(state.analysisData.missingSkills || state.analysisData.skills?.missing || state.analysisData.gaps) && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-sm font-medium text-amber-900 dark:text-amber-300">Skills to Highlight</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(state.analysisData.missingSkills || state.analysisData.skills?.missing || state.analysisData.gaps || []).slice(0, 5).map((skill: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 rounded-md text-xs">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generate Button */}
                    <motion.button
                      onClick={generateOptimizedResume}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-6 py-4 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
                    >
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Zap className="w-5 h-5" />
                      </div>
                      <span>Generate Optimized Resume</span>
                    </motion.button>

                    {/* Info Text */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                      Your resume will be tailored specifically for this position using AI
                    </p>
                  </div>
                ) : state.previewUrl ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Resume Optimized!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Your resume has been tailored for
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white mb-6">
                      {job?.job_title} at {job?.employer_name}
                    </p>

                    {state.optimizationScore && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Match Score</span>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-400">{state.optimizationScore.before}%</div>
                              <div className="text-xs text-gray-500">Before</div>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">{state.optimizationScore.after}%</div>
                              <div className="text-xs text-gray-500">After</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handlePreview}
                        className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye className="w-5 h-5" />
                        Preview
                      </button>
                      <button
                        onClick={handleDownload}
                        className="flex-1 px-4 py-3 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download
                      </button>
                    </div>

                    {job?.job_apply_link && (
                      <button
                        onClick={() => {
                          window.open(job.job_apply_link, '_blank');
                          onClose();
                        }}
                        className="w-full mt-3 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Apply Now on {job.job_apply_is_direct ? 'Company Site' : 'LinkedIn'}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </>
  );
};