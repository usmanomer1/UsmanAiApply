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

  // Get API credentials from environment
  const API_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend.vercel.app';
  const API_KEY = import.meta.env.VITE_JOBOTIC_API_KEY || '';

  const optimizeResume = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Check AI token limits
      const { allowed, reason } = await canPerformAction(user.id, 'resume_optimizations');
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

      // Call optimization API
      const formData = new FormData();
      if (resumeFile!) {
        formData.append('resume', resumeFile);
      } else {
        // Send as JSON if we only have text
        const response = await fetch(`${API_URL}/api/resume/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
          },
          body: JSON.stringify({
            resumeText: resumeTextToSend,
            jobDescription: job?.job_description || '',
            jobTitle: job?.job_title || '',
            companyName: job?.employer_name || '',
            userId: user?.id
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Optimization failed: ${response.status}`);
        }

        const result = await response.json();
        
        setState(prev => ({
          ...prev,
          loading: false,
          previewUrl: result.previewUrl,
          downloadUrl: result.downloadUrl,
          fileName: result.fileName || `optimized_resume_${new Date().toISOString().split('T')[0]}.pdf`,
          optimizationScore: result.score
        }));

        toast.success('Resume optimized successfully!');
        return;
      }

      // If we have a file, use multipart
      formData.append('jobDescription', job?.job_description || '');
      formData.append('jobTitle', job?.job_title || '');
      formData.append('companyName', job?.employer_name || '');
      if (user?.id) {
        formData.append('userId', user.id);
      }

      const response = await fetch(`${API_URL}/api/resume/optimize`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Optimization failed: ${response.status}`);
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        loading: false,
        previewUrl: result.previewUrl,
        downloadUrl: result.downloadUrl,
        fileName: result.fileName || `optimized_resume_${new Date().toISOString().split('T')[0]}.pdf`,
        optimizationScore: result.score
      }));

      // Track successful optimization
      await trackAITokenUsage(user.id, 'resume_optimizations', {
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
