import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Loader2, CheckCircle, AlertCircle, FileText, 
  Zap, Clock, TrendingUp, Plus, Check, ChevronRight,
  Sparkles, Edit3, Wand2, Target, Lightbulb, Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getSignedResumeUrl } from '../lib/supabase';
import { useResumeOptimizer } from '../hooks/useResumeOptimizer';
import toast from 'react-hot-toast';

interface ResumeAnalyzerProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  resumeText: string;
}

interface LocalState {
  resumeFile: File | null;
  selectedSkills: string[];
  editType: 'quick' | 'full' | null;
  step: 'analyze' | 'results' | 'generation';
}

export const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({
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
  } = useResumeOptimizer();

  const [localState, setLocalState] = useState<LocalState>({
    resumeFile: null,
    selectedSkills: [],
    editType: null,
    step: 'analyze'
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
        selectedSkills: [],
        editType: null,
        step: 'analyze'
      });
    }
  }, [isOpen]);

  const fetchResumeFile = async () => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('resume_url')
        .eq('user_id', user.id)
        .single();

      if (!profileData?.resume_url) {
        throw new Error('No resume found. Please upload a resume in your profile.');
      }

      const signedUrl = await getSignedResumeUrl(profileData.resume_url);
      if (!signedUrl) {
        throw new Error('Failed to access resume file');
      }

      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const file = new File([blob], 'resume.pdf', { type: 'application/pdf' });
      
      setLocalState(prev => ({ ...prev, resumeFile: file }));
      
      // Auto-analyze once we have the file
      if (job && file) {
        await handleAnalyze(file);
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
        job.job_description || '',
        job.job_title || '',
        job.employer_name || ''
      );
      setLocalState(prev => ({ ...prev, step: 'results' }));
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
        localState.editType || 'full',
        [], // Let AI decide which sections to optimize
        localState.selectedSkills,
        '' // No additional instructions
      );
      setLocalState(prev => ({ ...prev, step: 'generation' }));
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

  const toggleSkill = (skill: string) => {
    setLocalState(prev => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skill)
        ? prev.selectedSkills.filter(s => s !== skill)
        : [...prev.selectedSkills, skill]
    }));
  };

  // Extract data from analysisResult for display
  const currentScore = analysisResult?.data?.summary?.overallScore || 0;
  const potentialScore = Math.min((currentScore + 2), 10); // Estimate potential score
  const suggestedSkills = analysisResult?.data?.summary?.missingSkills || [];
  const keywordMatches = analysisResult?.data?.summary?.keywordMatches || [];
  const suggestions = analysisResult?.data?.summary?.suggestions || [];
  const sections = analysisResult?.data?.sections || [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Resume Optimizer</h2>
                  <p className="text-sm text-gray-600">
                    Optimize for: {job?.job_title} at {job?.employer_name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">
                      {localState.step === 'analyze' ? 'Analyzing your resume...' : 'Generating optimized resume...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <div className="text-red-800">
                      <p className="font-medium">Analysis Failed</p>
                      <p className="text-sm mt-1">{error}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAnalyze()}
                    className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Analysis Results */}
              {!loading && !error && analysisResult && localState.step === 'results' && (
                <div className="space-y-6">
                  {/* Score Overview */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{currentScore.toFixed(1)}</div>
                      <div className="text-sm text-blue-700">Current Score</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">{potentialScore.toFixed(1)}</div>
                      <div className="text-sm text-green-700">Potential Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Keyword Matches */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <h3 className="font-medium text-green-900">Matched Keywords</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {keywordMatches.length > 0 ? (
                          keywordMatches.map((keyword, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs"
                            >
                              {keyword}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-green-700">No specific keywords found</p>
                        )}
                      </div>
                    </div>

                    {/* Suggested Skills */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <Target className="h-4 w-4 text-blue-600 mr-2" />
                        <h3 className="font-medium text-blue-900">Suggested Skills to Add</h3>
                      </div>
                      <div className="space-y-2">
                        {suggestedSkills.length > 0 ? (
                          suggestedSkills.map((skill, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{skill}</span>
                              <button
                                onClick={() => toggleSkill(skill)}
                                className={`w-5 h-5 rounded ${
                                  localState.selectedSkills.includes(skill)
                                    ? 'bg-blue-600 text-white flex items-center justify-center'
                                    : 'border-2 border-gray-300'
                                }`}
                              >
                                {localState.selectedSkills.includes(skill) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-blue-700">Your skills look good!</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Improvement Suggestions */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <Lightbulb className="h-4 w-4 text-yellow-600 mr-2" />
                      <h3 className="font-medium text-yellow-900">Improvement Suggestions</h3>
                    </div>
                    <div className="space-y-2">
                      {suggestions.length > 0 ? (
                        suggestions.map((suggestion, index) => (
                          <div key={index} className="text-sm text-gray-700">
                            • {suggestion}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-yellow-700">No specific suggestions available</p>
                      )}
                    </div>
                    
                    {sections.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="font-medium text-yellow-900">Section-Specific Improvements:</h4>
                        {sections.map((section, index) => (
                          <div key={section.id} className="text-sm border-l-2 border-yellow-300 pl-3">
                            <p className="font-medium capitalize">{section.type}</p>
                            <ul className="list-disc list-inside text-gray-600 ml-2">
                              {section.improvements.map((improvement, i) => (
                                <li key={i}>{improvement}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Type Selection */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3">Choose Optimization Level</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLocalState(prev => ({ ...prev, editType: prev.editType === 'quick' ? null : 'quick' }))}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          localState.editType === 'quick'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Quick Edit
                      </button>
                      <button
                        onClick={() => setLocalState(prev => ({ ...prev, editType: prev.editType === 'full' ? null : 'full' }))}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          localState.editType === 'full'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Full Optimization
                      </button>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleGenerate}
                      disabled={loading || !localState.editType}
                      className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Optimized Resume
                    </button>
                  </div>
                </div>
              )}

              {/* Generation Results */}
              {generationResult && localState.step === 'generation' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <h3 className="font-medium text-green-900">Resume Generated Successfully!</h3>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Resume
                    </button>
                    <button
                      onClick={() => setLocalState(prev => ({ ...prev, step: 'results' }))}
                      className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Back to Analysis
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