import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Loader2, CheckCircle, AlertCircle, FileText, 
  Zap, Clock, TrendingUp, Plus, Check, ChevronRight,
  Sparkles, Edit3, Wand2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getSignedResumeUrl } from '../lib/supabase';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { handleApiError } from '../lib/apiErrorHandler';
import toast from 'react-hot-toast';

interface ResumeAnalyzerProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  resumeText: string;
}

interface SuggestedSection {
  id: string;
  sectionName: string;
  currentContent: string;
  suggestedChanges: string;
  impact: 'high' | 'medium' | 'low';
  selected: boolean;
}

interface SuggestedSkill {
  id: string;
  skill: string;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

interface AnalysisState {
  loading: boolean;
  analyzing: boolean;
  generating: boolean;
  error: string | null;
  analysisId: string | null;
  currentScore: number;
  potentialScore: number;
  suggestedSections: SuggestedSection[];
  suggestedSkills: SuggestedSkill[];
  selectedSkills: string[];
  missingKeywords: string[];
  editType: 'quick' | 'full' | null;
  generationResult: any | null;
}

export const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({
  isOpen,
  onClose,
  job,
  resumeText
}) => {
  const { user } = useAuth();
  const [state, setState] = useState<AnalysisState>({
    loading: false,
    analyzing: false,
    generating: false,
    error: null,
    analysisId: null,
    currentScore: 0,
    potentialScore: 0,
    suggestedSections: [],
    suggestedSkills: [],
    selectedSkills: [],
    missingKeywords: [],
    editType: null,
    generationResult: null
  });

  const API_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend.vercel.app';
  const API_KEY = import.meta.env.VITE_JOBOTIC_API_KEY || '';

  // Analyze resume on mount
  useEffect(() => {
    if (isOpen && !state.analysisId && !state.analyzing) {
      analyzeResume();
    }
  }, [isOpen]);

  const analyzeResume = async () => {
    setState(prev => ({ ...prev, analyzing: true, error: null }));

    try {
      let resumeToAnalyze = resumeText;

      // If no resume text, fetch from Supabase
      if (!resumeText || resumeText.trim().length === 0) {
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
        resumeToAnalyze = await extractTextFromPDF(file);
      }

      // Call analysis API
      const response = await fetch(`${API_URL}/api/resume/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          resumeText: resumeToAnalyze,
          jobDescription: job?.job_description || '',
          jobTitle: job?.job_title || '',
          companyName: job?.employer_name || '',
          userId: user?.id
        })
      });

      // Extract request ID for debugging
      const requestId = response.headers.get('X-Request-ID');
      
      if (!response.ok) {
        let errorJson = null;
        try {
          errorJson = await response.json();
        } catch (e) {
          // Ignore JSON parse errors
        }
        
        const error = new Error(errorJson?.error || 'Analysis failed');
        (error as any).status = response.status;
        (error as any).details = errorJson;
        (error as any).requestId = requestId;
        throw error;
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        analyzing: false,
        analysisId: result.analysisId,
        currentScore: result.currentScore,
        potentialScore: result.potentialScore,
        suggestedSections: result.suggestedSections,
        suggestedSkills: result.suggestedSkills,
        missingKeywords: result.missingKeywords
      }));

    } catch (error: any) {
      console.error('Analysis error:', error);
      handleApiError(error);
      setState(prev => ({
        ...prev,
        analyzing: false,
        error: error.message || 'Failed to analyze resume'
      }));
    }
  };

  const toggleSection = (sectionId: string) => {
    setState(prev => ({
      ...prev,
      suggestedSections: prev.suggestedSections.map(section =>
        section.id === sectionId ? { ...section, selected: !section.selected } : section
      )
    }));
  };

  const toggleSkill = (skillId: string) => {
    setState(prev => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter(id => id !== skillId)
        : [...prev.selectedSkills, skillId]
    }));
  };

  const generateOptimizedResume = async () => {
    if (!state.analysisId || !state.editType) return;

    setState(prev => ({ ...prev, generating: true, error: null }));

    try {
      const selectedSections = state.suggestedSections
        .filter(s => s.selected)
        .map(s => s.id);

      const response = await fetch(`${API_URL}/api/resume/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          analysisId: state.analysisId,
          editType: state.editType,
          selectedSections,
          selectedSkills: state.selectedSkills
        })
      });

      // Extract request ID for debugging
      const requestId = response.headers.get('X-Request-ID');
      
      if (!response.ok) {
        let errorJson = null;
        try {
          errorJson = await response.json();
        } catch (e) {
          // Ignore JSON parse errors
        }
        
        const error = new Error(errorJson?.error || 'Generation failed');
        (error as any).status = response.status;
        (error as any).details = errorJson;
        (error as any).requestId = requestId;
        throw error;
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        generating: false,
        generationResult: result
      }));

      toast.success('Resume optimized successfully!');

    } catch (error: any) {
      console.error('Generation error:', error);
      handleApiError(error);
      setState(prev => ({
        ...prev,
        generating: false,
        error: error.message || 'Failed to generate resume'
      }));
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
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
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Resume Optimization
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Tailoring for {job?.job_title} at {job?.employer_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              {state.analyzing ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-12 h-12 text-[#1DE0DD] animate-spin mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Analyzing Your Resume
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Comparing your resume with job requirements...
                  </p>
                </div>
              ) : state.error ? (
                <div className="p-12 text-center">
                  <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Analysis Failed
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {state.error}
                  </p>
                  <button
                    onClick={analyzeResume}
                    className="px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90"
                  >
                    Try Again
                  </button>
                </div>
              ) : state.generationResult ? (
                // Results View
                <ResultsView 
                  result={state.generationResult}
                  onClose={onClose}
                  job={job}
                />
              ) : (
                // Analysis View
                <div className="p-6">
                  {/* Score Preview */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          Match Score Analysis
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Your resume vs. job requirements
                        </p>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-gray-500">{state.currentScore}%</div>
                          <div className="text-xs text-gray-500 uppercase">Current</div>
                        </div>
                        <TrendingUp className="w-6 h-6 text-green-600" />
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">{state.potentialScore}%</div>
                          <div className="text-xs text-gray-500 uppercase">Potential</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit Options */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Choose Optimization Level
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setState(prev => ({ ...prev, editType: 'quick' }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          state.editType === 'quick'
                            ? 'border-[#1DE0DD] bg-[#1DE0DD]/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Zap className="w-5 h-5 text-[#1DE0DD] mt-1" />
                          <div className="text-left">
                            <h5 className="font-semibold text-gray-900 dark:text-white">Quick Edit</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              AI optimizes selected sections only
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                ~30 seconds
                              </span>
                              <span className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="w-3 h-3" />
                                +10-15 points
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => setState(prev => ({ ...prev, editType: 'full' }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          state.editType === 'full'
                            ? 'border-[#1DE0DD] bg-[#1DE0DD]/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Wand2 className="w-5 h-5 text-[#1DE0DD] mt-1" />
                          <div className="text-left">
                            <h5 className="font-semibold text-gray-900 dark:text-white">Full Edit</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Complete resume rewrite with AI
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                ~2 minutes
                              </span>
                              <span className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="w-3 h-3" />
                                +15-25 points
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Suggested Sections */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Suggested Section Improvements
                    </h4>
                    <div className="space-y-3">
                      {state.suggestedSections.map(section => (
                        <div
                          key={section.id}
                          onClick={() => toggleSection(section.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            section.selected
                              ? 'border-[#1DE0DD] bg-[#1DE0DD]/5'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 ${section.selected ? 'text-[#1DE0DD]' : 'text-gray-400'}`}>
                              {section.selected ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-current" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-semibold text-gray-900 dark:text-white">
                                  {section.sectionName}
                                </h5>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getImpactColor(section.impact)}`}>
                                  {section.impact} impact
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {section.suggestedChanges}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Skills */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Suggested Skills to Add
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {state.suggestedSkills.map(skill => (
                        <button
                          key={skill.id}
                          onClick={() => toggleSkill(skill.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            state.selectedSkills.includes(skill.id)
                              ? 'bg-[#1DE0DD] text-white'
                              : getRelevanceColor(skill.relevance)
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {state.selectedSkills.includes(skill.id) ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            {skill.skill}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Missing Keywords */}
                  {state.missingKeywords.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Missing Keywords
                      </h4>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          These important keywords from the job description are missing from your resume:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {state.missingKeywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded text-sm"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!state.analyzing && !state.error && !state.generationResult && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateOptimizedResume}
                    disabled={!state.editType || state.generating}
                    className="px-6 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {state.generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Optimized Resume
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Results View Component
const ResultsView: React.FC<{ result: any; onClose: () => void; job: any }> = ({ result, onClose, job }) => {
  return (
    <div className="p-6">
      {/* Success Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Resume Optimized Successfully!
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Your resume has been tailored for the position
        </p>
      </div>

      {/* Premium Score Panel */}
      <div className="bg-gradient-to-br from-[#1DE0DD]/10 to-blue-500/10 rounded-xl p-6 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Optimization Results
        </h4>
        
        {/* Score Comparison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-400 mb-2">{result.improvements.before.score}%</div>
            <div className="text-sm text-gray-500 uppercase">Before</div>
            <div className="mt-2 space-y-1">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Keywords: {result.improvements.before.keywordMatches}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                ATS Score: {result.improvements.before.atsCompatibility}%
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">{result.improvements.after.score}%</div>
            <div className="text-sm text-gray-500 uppercase">After</div>
            <div className="mt-2 space-y-1">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Keywords: {result.improvements.after.keywordMatches}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                ATS Score: {result.improvements.after.atsCompatibility}%
              </div>
            </div>
          </div>
        </div>

        {/* Improvement Bar */}
        <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: `${result.improvements.before.score}%` }}
            animate={{ width: `${result.improvements.after.score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1DE0DD] to-green-500 flex items-center justify-end pr-3"
          >
            <span className="text-xs font-semibold text-white">
              +{result.improvements.after.score - result.improvements.before.score} points
            </span>
          </motion.div>
        </div>
      </div>

      {/* Changes Made */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Changes Applied
        </h4>
        <div className="space-y-2">
          {result.changelog.map((change: string, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => window.open(result.previewUrl, '_blank')}
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Preview Resume
        </button>
        <button
          onClick={() => {
            window.open(result.downloadUrl, '_blank');
            toast.success('Download started!');
          }}
          className="flex-1 px-4 py-3 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Download Resume
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
  );
};