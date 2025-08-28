import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, CheckCircle, AlertCircle, Loader2, ArrowRight, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useResumeOptimizer } from '../hooks/useResumeOptimizer';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { toast } from 'react-hot-toast';

interface ResumeAnalyzerV2Props {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  resumeText: string;
}

export const ResumeAnalyzerV2: React.FC<ResumeAnalyzerV2Props> = ({
  isOpen,
  onClose,
  job,
  resumeText: initialResumeText
}) => {
  const { user } = useAuth();
  const {
    loading,
    error,
    analysisResult,
    generationResult,
    analyzeResume,
    generateOptimizedResume,
    downloadResume,
    reset
  } = useResumeOptimizer();

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [step, setStep] = useState<'analyze' | 'preview'>('analyze');

  // Debug component mount
  useEffect(() => {
    console.log('ResumeAnalyzerV2 mounted/updated:', {
      isOpen,
      hasJob: !!job,
      jobTitle: job?.job_title || job?.title,
      jobCompany: job?.employer_name || job?.company,
      hasUser: !!user,
      userId: user?.id,
      hasInitialResumeText: !!initialResumeText,
      resumeTextLength: initialResumeText?.length || 0
    });
  }, [isOpen, job, user, initialResumeText]);

  // Debug logging for generation result
  useEffect(() => {
    if (generationResult) {
      console.log('Generation result state updated:', generationResult);
    }
  }, [generationResult]);

  // Fetch resume file from Supabase on mount or use provided resume text
  useEffect(() => {
    const fetchResumeFile = async () => {
      // If we already have resume text from parent, we still need to fetch the actual PDF file
      // The text is just for display purposes, but the API needs the actual PDF
      if (initialResumeText) {
        console.log('Initial resume text provided, but still need to fetch PDF file');
        // Continue to fetch the actual PDF file below
      }
      
      if (!user?.id) return;

      try {
        // Get user's resume from database - handle multiple profiles
        console.log('Fetching profile for user:', user.id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('resume_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          toast.error('Unable to fetch your resume. Please upload a resume in your profile.');
          return;
        }
        
        const profile = profiles?.[0] || null;
        const resumeUrl = profile?.resume_url || null;

        if (resumeUrl) {
          console.log('Resume URL found:', resumeUrl);
          // The resume_url is already just the path (e.g., "user-id/resume.pdf")
          const filePath = resumeUrl;
          console.log('File path:', filePath);

          // Download the file
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('resumes')
            .download(filePath);

          if (downloadError) {
            console.error('Error downloading resume:', downloadError);
            toast.error('Unable to download your resume file.');
            return;
          }

          if (fileData) {
            // Create a File object from the blob
            const fileName = filePath.split('/').pop() || 'resume.pdf';
            
            // Check if it's actually a PDF by looking at the file extension
            if (!fileName.toLowerCase().endsWith('.pdf')) {
              console.error('Resume file is not a PDF:', fileName);
              toast.error('Resume must be a PDF file. Please upload a PDF resume in your profile.');
              return;
            }
            
            // Ensure we're using the correct MIME type for PDF
            const file = new File([fileData], fileName, { type: fileData.type || 'application/pdf' });
            console.log('Resume file created:', file.name, file.size, file.type);
            setResumeFile(file);
          }
        } else {
          console.log('No resume URL found in profile');
          toast.error('No resume found. Please upload a resume in your profile first.');
        }
      } catch (error) {
        console.error('Error fetching resume:', error);
      }
    };

    if (isOpen) {
      fetchResumeFile();
    }
  }, [isOpen, user?.id, initialResumeText]);

  // Auto-analyze on mount if we have a resume file
  useEffect(() => {
    if (isOpen && resumeFile && !analysisResult && !loading && job) {
      handleAnalyze();
    }
  }, [isOpen, resumeFile, analysisResult, loading, job]);

  const handleAnalyze = async () => {
    console.log('handleAnalyze called');
    console.log('resumeFile:', resumeFile);
    console.log('job:', job);
    
    if (!resumeFile || !job) {
      toast.error('Resume file or job information missing');
      return;
    }
    
    // Validate file type - be more lenient for files from storage
    if (!resumeFile.name.toLowerCase().endsWith('.pdf')) {
      console.error('Invalid file type:', resumeFile.name, resumeFile.type);
      toast.error('Resume must be a PDF file. Please upload a PDF resume in your profile.');
      return;
    }

    try {
      console.log('Calling analyzeResume with:', {
        resumeFile: resumeFile.name,
        jobDescription: job.job_description || job.description || '',
        jobTitle: job.job_title || job.title || '',
        companyName: job.employer_name || job.company || ''
      });
      
      await analyzeResume(
        resumeFile,
        job.job_description || job.description || '',
        job.job_title || job.title || '',
        job.employer_name || job.company || ''
      );
      // Move to preview step after successful analysis
      setStep('preview');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze resume');
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateOptimizedResume(
        'full', // Always use full optimization
        [], // Let AI decide which sections to optimize
        [], // Let AI decide which skills to add
        '' // No additional instructions
      );
      console.log('Generation result:', result);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate optimized resume');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadResume();
      toast.success('Resume downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download resume');
    }
  };

  const handleClose = () => {
    reset();
    setStep('analyze');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-[#23a972] dark:text-[#23a972]" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Resume Optimizer
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Job Information */}
              {job && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    Optimizing for:
                  </h3>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Position:</span> {job.job_title || job.title}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Company:</span> {job.employer_name || job.company}
                    </p>
                    {(job.job_apply_link || job.link) && (
                      <a
                        href={job.job_apply_link || job.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-[#23a972] hover:underline mt-2"
                      >
                        View Job Posting
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Analysis Results */}
              {step === 'preview' && analysisResult?.data && (
                <div className="space-y-6">
                  {/* Score */}
                  <div className="bg-[#23a972]/10 dark:bg-[#23a972]/10 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Resume Analysis Score
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-[#23a972]">
                          {analysisResult.data.summary.overallScore.toFixed(1)}/10
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Match Score
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {analysisResult.data.summary.keywordMatches.length} Keywords Matched
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {analysisResult.data.summary.missingSkills.length} Skills Missing
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {analysisResult.data.summary.suggestions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Key Improvements Needed
                      </h3>
                      <ul className="space-y-2">
                        {analysisResult.data.summary.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {suggestion}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing Skills */}
                  {analysisResult.data.summary.missingSkills.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Missing Skills
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.data.summary.missingSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generation Result */}
                  {generationResult && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Optimized Resume Ready!
                        </h3>
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        {generationResult.data?.message || 'Your optimized resume has been generated successfully!'}
                      </p>
                      <div className="flex gap-3">
                        {generationResult.data?.downloadUrl && (
                          <>
                            <a
                              href={generationResult.data.downloadUrl}
                              download
                              className="flex items-center gap-2 px-4 py-2 bg-[#23a972] text-white rounded-lg hover:bg-[#1e9463] transition"
                            >
                              <Download className="h-4 w-4" />
                              Download Resume
                            </a>
                            <a
                              href={generationResult.data.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Preview PDF
                            </a>
                          </>
                        )}
                        {!generationResult.data?.downloadUrl && (
                          <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-[#23a972] text-white rounded-lg hover:bg-[#1e9463] transition"
                          >
                            <Download className="h-4 w-4" />
                            Download Resume
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Loading States */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#23a972] mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {step === 'analyze' ? 'Analyzing your resume...' : 'Generating optimized resume...'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    This may take 15-30 seconds
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                Close
              </button>
              
              {step === 'preview' && analysisResult && !generationResult && !loading && (
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-6 py-2 bg-[#23a972] text-white rounded-lg hover:bg-[#1e9463] transition"
                >
                  Generate Optimized Resume
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};