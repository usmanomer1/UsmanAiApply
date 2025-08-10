import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Download, FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';
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
    previewUrl: null,
    downloadUrl: null,
    fileName: null
  });

  // Get API URL for Railway-hosted resume service
  const RESUME_API_URL = import.meta.env.VITE_RESUME_API_URL || 'https://terrific-imagination-production-6ca9.up.railway.app';

  const optimizeResume = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Check AI token limits
      const { allowed, reason } = await canPerformAction(user.id, 'resume_optimization');
      if (!allowed) {
        throw new Error(reason || 'Insufficient AI tokens for resume optimization');
      }

      let resumeFile: File;
      let resumeTextToSend = resumeText;

      // If no resume text, fetch from Supabase
      if (!resumeText || resumeText.trim().length === 0) {
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
        
        // Extract text from PDF
        resumeTextToSend = await extractTextFromPDF(resumeFile);
      }

      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      // Step 1: Analyze the resume
      let analyzeResponse;
      
      if (resumeFile!) {
        // If we have a PDF file, use multipart form data
        const formData = new FormData();
        formData.append('resume', resumeFile);
        formData.append('job_description', job?.job_description || '');
        formData.append('job_title', job?.job_title || '');
        formData.append('company_name', job?.employer_name || '');
        
        analyzeResponse = await fetch(`${RESUME_API_URL}/api/resume/analyze`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: formData
        });
      } else {
        // Send as JSON if we only have text
        analyzeResponse = await fetch(`${RESUME_API_URL}/api/resume/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            resumeText: resumeTextToSend,
            jobDescription: job?.job_description || '',
            jobTitle: job?.job_title || '',
            companyName: job?.employer_name || ''
          })
        });
      }

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Analysis failed: ${analyzeResponse.status}`);
      }

      const analyzeResult = await analyzeResponse.json();
      const analysisData = analyzeResult.data || analyzeResult;
      
      // Step 2: Generate the optimized resume
      const generateResponse = await fetch(`${RESUME_API_URL}/api/resume/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          analysisId: analysisData.analysisId,
          editType: 'full', // or 'quick' based on user preference
          selectedSections: analysisData.suggestedSections || [],
          selectedSkills: analysisData.suggestedSkills || [],
          additionalInstructions: ''
        })
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Generation failed: ${generateResponse.status}`);
      }

      const generateResult = await generateResponse.json();
      const generationData = generateResult.data || generateResult;
      
      // Update state with analysis and generation results
      setState(prev => ({
        ...prev,
        loading: false,
        previewUrl: generationData.previewUrl || generationData.downloadUrl,
        downloadUrl: generationData.downloadUrl || generationData.previewUrl,
        fileName: generationData.fileName || `optimized_resume_${new Date().toISOString().split('T')[0]}.pdf`,
        optimizationScore: {
          before: analysisData.summary?.overallScore || analysisData.currentScore || 0,
          after: analysisData.summary?.potentialScore || analysisData.potentialScore || 0
        }
      }));

      // Track successful optimization
      await trackAITokenUsage(user.id, 'resume_optimization', {
        jobTitle: job?.job_title || 'Not specified',
        companyName: job?.employer_name || 'Not specified',
        method: 'simple_optimizer'
      });

      toast.success('Resume optimized successfully!');

    } catch (error: any) {
      console.error('Optimization error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to optimize resume'
      }));
      toast.error(error.message || 'Failed to optimize resume');
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

  // Auto-start optimization when panel opens
  React.useEffect(() => {
    if (isOpen && !state.loading && !state.previewUrl) {
      optimizeResume();
    }
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 z-50"
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
                      Optimizing Your Resume
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Using AI to tailor your resume for {job?.job_title || 'this position'}...
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
                      onClick={optimizeResume}
                      className="px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
                    >
                      Try Again
                    </button>
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
          </>
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