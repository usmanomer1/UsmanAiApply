import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Download, FileText, ChevronLeft, Sparkles, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { joboticApi } from '../lib/joboticApi';
import { ResumeViewer, MappedSuggestion } from './ResumeViewer';
import { ExportPanel } from './ExportPanel';
import { ImprovementStats } from './ImprovementStats';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { supabase, getSignedResumeUrl } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

// OLD ADOBE DC TYPES - REMOVED

interface ResumeEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any; // We'll type this properly later
  resumeText: string;
}


// New minimal state for HTML-based resume editor
interface ResumeEditorState {
  loading: boolean;
  loadingStage: 'idle' | 'uploading' | 'converting' | 'analyzing' | 'complete';
  loadingProgress: number;
  error: string | null;
  errorType?: 'conversion' | 'ai' | 'export';
  htmlContent: string;
  suggestions: MappedSuggestion[];
  sessionId: string | null;
  isGenerating: boolean;
  // Improvement stats
  beforeScore?: number;
  afterScore?: number;
  changesApplied?: number;
}

export const ResumeEditorPanel: React.FC<ResumeEditorPanelProps> = ({
  isOpen,
  onClose,
  job,
  resumeText
}) => {
  const { user } = useAuth();
  
  // New minimal state for HTML resume editor
  const [state, setState] = useState<ResumeEditorState>({
    loading: false,
    loadingStage: 'idle',
    loadingProgress: 0,
    error: null,
    htmlContent: '',
    suggestions: [],
    sessionId: null,
    isGenerating: false
  });
  
  // UI state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showMobilePDF, setShowMobilePDF] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Get API credentials from environment
  const API_URL = import.meta.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend.vercel.app';
  const API_KEY = import.meta.env.VITE_JOBOTIC_API_KEY || '';

  // Upload resume for parsing
  const uploadResumeForParsing = async (file?: File) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      loadingStage: 'uploading',
      loadingProgress: 0,
      error: null, 
      isGenerating: true 
    }));
    setIsUploading(true);

    try {
      let resumeFile = file;
      let resumeTextToUpload = resumeText;

      // Stage 1: Uploading (0-20%)
      setState(prev => ({ ...prev, loadingStage: 'uploading', loadingProgress: 10 }));

      // If file provided, extract text first
      if (file) {
        const extractedText = await extractTextFromPDF(file);
        resumeTextToUpload = extractedText;
        resumeFile = file;
      } else {
        // No file uploaded - fetch from Supabase storage
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

        // Fetch the actual file from the signed URL
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error('Failed to download resume from storage');
        }

        const blob = await response.blob();
        const fileName = profileData.resume_url.split('/').pop() || 'resume.pdf';
        resumeFile = new File([blob], fileName, { type: 'application/pdf' });
        
        // Extract text from the fetched PDF
        const extractedText = await extractTextFromPDF(resumeFile);
        resumeTextToUpload = extractedText;
      }

      setState(prev => ({ ...prev, loadingProgress: 20 }));

      // Ensure we have a file to upload
      if (!resumeFile) {
        throw new Error('No resume file available for upload');
      }

      console.log('Resume file to upload:', {
        name: resumeFile.name,
        type: resumeFile.type,
        size: resumeFile.size
      });

      // Create FormData for upload
      const formData = new FormData();
      // Always append the resume file (either uploaded or fetched from Supabase)
      formData.append('resume', resumeFile);
      
      // Add job context if available
      if (job) {
        formData.append('jobDescription', job.job_description);
      }
      
      // Add userId if available
      if (user?.id) {
        formData.append('userId', user.id);
      }

      // Debug logging
      console.log('Uploading to:', `${API_URL}/api/resume-editor-html/parse-for-edit-flexible`);
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`- ${key}: File(${value.name}, ${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`- ${key}:`, value);
        }
      }

      // Verify the file is actually in FormData
      if (!formData.has('resume')) {
        console.error('WARNING: FormData does not contain resume field!');
      }

      // First, call debug endpoint to see what's being sent
      try {
        const debugResponse = await fetch(`${API_URL}/api/resume-editor-html/parse-for-edit-debug`, {
          method: 'POST',
          headers: {
            'X-API-Key': API_KEY,
          },
          body: formData
        });
        const debugData = await debugResponse.json();
        console.log('DEBUG ENDPOINT RESPONSE:', debugData);
      } catch (e) {
        console.log('Debug endpoint error:', e);
      }

      // Stage 2: Converting (20-60%)
      setState(prev => ({ ...prev, loadingStage: 'converting', loadingProgress: 30 }));

      // Call backend API - using the FLEXIBLE endpoint that accepts multiple field names
      const response = await fetch(`${API_URL}/api/resume-editor-html/parse-for-edit-flexible`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
        },
        body: formData
      });

      setState(prev => ({ ...prev, loadingProgress: 50 }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorType = response.status === 415 || errorData.error?.includes('convert') ? 'conversion' : 'ai';
        throw { 
          message: errorData.error || `Upload failed: ${response.status}`,
          type: errorType
        };
      }

      // Stage 3: Analyzing (60-90%)
      setState(prev => ({ ...prev, loadingStage: 'analyzing', loadingProgress: 70 }));

      const result = await response.json();
      
      console.log('Backend response:', result);
      
      // Handle nested response structure
      const responseData = result.data || result;
      
      setState(prev => ({ ...prev, loadingProgress: 90 }));

      // Validate response structure
      if (!responseData.htmlContent) {
        console.error('Invalid response structure:', result);
        throw new Error('Invalid response: missing HTML content');
      }

      // Calculate improvement stats
      const beforeScore = responseData.beforeScore || 65; // Mock data if not provided
      const suggestions = Array.isArray(responseData.suggestions) 
        ? responseData.suggestions.map((sug: any) => ({
            ...sug,
            status: 'pending' as const
          }))
        : [];

      // Stage 4: Complete (100%)
      setState(prev => ({
        ...prev,
        loading: false,
        loadingStage: 'complete',
        loadingProgress: 100,
        isGenerating: false,
        htmlContent: responseData.htmlContent,
        suggestions,
        sessionId: responseData.sessionId,
        beforeScore,
        afterScore: beforeScore + (suggestions.length * 2), // Estimate 2 points per suggestion
        changesApplied: 0
      }));

      setShowUploadModal(false);
      toast.success('Resume parsed successfully!');

    } catch (error: any) {
      console.error('Upload error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        loadingStage: 'idle',
        loadingProgress: 0,
        isGenerating: false,
        error: error.message || 'Failed to parse resume',
        errorType: error.type || 'conversion'
      }));
      toast.error(error.message || 'Failed to parse resume');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setUploadedFile(file);
    }
  };

  // Handle upload button click
  const handleUpload = () => {
    if (uploadedFile) {
      uploadResumeForParsing(uploadedFile);
    }
  };

  // Initialize panel when opened
  useEffect(() => {
    if (isOpen) {
      // Reset state when panel opens
      setState({
        loading: false,
        loadingStage: 'idle',
        loadingProgress: 0,
        error: null,
        htmlContent: '',
        suggestions: [],
        sessionId: null,
        isGenerating: false
      });
      
      // Show upload modal if no resume text
      if (!resumeText || resumeText.trim().length === 0) {
        setShowUploadModal(true);
      } else {
        // If we have resume text, upload it for parsing
        uploadResumeForParsing();
      }
    }
  }, [isOpen]);



  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Escape to close
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      // Only handle shortcuts when not typing in an input
      const isTyping = document.activeElement?.tagName === 'INPUT' || 
                      document.activeElement?.tagName === 'TEXTAREA';
      if (isTyping) return;
      
      // A: Accept selected suggestion
      if (e.key === 'a' || e.key === 'A') {
        const pendingSuggestion = state.suggestions.find(s => s.status === 'pending');
        if (pendingSuggestion) {
          handleAcceptSuggestion(pendingSuggestion.id);
          toast.success('Suggestion accepted', { duration: 1000 });
        }
      }
      
      // R: Reject selected suggestion
      if (e.key === 'r' || e.key === 'R') {
        const pendingSuggestion = state.suggestions.find(s => s.status === 'pending');
        if (pendingSuggestion) {
          handleRejectSuggestion(pendingSuggestion.id);
          toast('Suggestion rejected', { duration: 1000 });
        }
      }
      
      // Ctrl+Z: Undo last action
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        // TODO: Implement undo functionality
        toast('Undo not yet implemented', { duration: 1000 });
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [isOpen, onClose, state.suggestions]);


  // Suggestion handlers
  const handleAcceptSuggestion = async (suggestionId: string) => {
    const suggestion = state.suggestions.find(s => s.id === suggestionId);
    if (!suggestion || !state.sessionId) return;

    try {
      // Update local state immediately for better UX
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, status: 'accepted' } : s
        ),
        changesApplied: (prev.changesApplied || 0) + 1,
        afterScore: Math.min((prev.afterScore || prev.beforeScore || 65) + 2, 100)
      }));

      // Call backend API
      const response = await fetch(`${API_URL}/api/resume-editor-html/apply-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          suggestionId,
          action: 'accept',
          newText: suggestion.suggestedText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to apply suggestion');
      }

      const result = await response.json();
      
      // Update HTML content if returned
      if (result.updatedHtml) {
        setState(prev => ({ ...prev, htmlContent: result.updatedHtml }));
      }

    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      // Revert on error
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, status: 'pending' } : s
        )
      }));
      toast.error('Failed to apply suggestion');
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    if (!state.sessionId) return;

    try {
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, status: 'rejected' } : s
        )
      }));

      // Call backend API
      const response = await fetch(`${API_URL}/api/resume-editor-html/apply-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          suggestionId,
          action: 'reject'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reject suggestion');
      }

    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      // Revert on error
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, status: 'pending' } : s
        )
      }));
      toast.error('Failed to reject suggestion');
    }
  };

  const handleEditSuggestion = async (suggestionId: string, newText: string) => {
    if (!state.sessionId) return;

    try {
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, status: 'modified', modifiedText: newText } : s
        )
      }));

      // Call backend API
      const response = await fetch(`${API_URL}/api/resume-editor-html/apply-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          suggestionId,
          action: 'modify',
          newText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to modify suggestion');
      }

      const result = await response.json();
      
      // Update HTML content if returned
      if (result.updatedHtml) {
        setState(prev => ({ ...prev, htmlContent: result.updatedHtml }));
      }

    } catch (error) {
      console.error('Failed to modify suggestion:', error);
      // Revert on error
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.map(s => 
          s.id === suggestionId ? { ...s, status: 'pending' } : s
        )
      }));
      toast.error('Failed to modify suggestion');
    }
  };

  // Export handler
  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!state.sessionId || !state.htmlContent) {
      throw new Error('No resume content to export');
    }

    // Calculate suggestion analytics
    const analytics = {
      total: state.suggestions.length,
      accepted: state.suggestions.filter(s => s.status === 'accepted').length,
      rejected: state.suggestions.filter(s => s.status === 'rejected').length,
      modified: state.suggestions.filter(s => s.status === 'modified').length,
    };

    // Get final HTML with accepted changes
    const finalHtml = getFinalHtmlWithSuggestions();

    try {
      // Call backend API
      const response = await fetch(`${API_URL}/api/resume-editor-html/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          format,
          includeAnalytics: true,
          analytics
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Download the file
      if (result.downloadUrl) {
        // If it's a direct download URL, use it
        window.open(result.downloadUrl, '_blank');
      } else if (result.fileData) {
        // If we get base64 data, convert and download
        const base64Data = result.fileData.replace(/^data:.*,/, '');
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { 
          type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName || `resume_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      return result;
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  };

  // Helper to get final HTML with accepted suggestions
  const getFinalHtmlWithSuggestions = (): string => {
    if (!state.htmlContent) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = state.htmlContent;
    
    // Apply accepted suggestions
    state.suggestions.forEach(suggestion => {
      if (suggestion.status === 'accepted' || suggestion.status === 'modified') {
        const elements = tempDiv.querySelectorAll(`[data-suggestion-id="${suggestion.id}"]`);
        elements.forEach(el => {
          el.textContent = suggestion.status === 'modified' && suggestion.modifiedText 
            ? suggestion.modifiedText 
            : suggestion.suggestedText;
        });
      }
    });
    
    return tempDiv.innerHTML;
  };



  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  
  
  
  
  
  const handleApplyNow = () => {
    if (job?.job_apply_link) {
      window.open(job.job_apply_link, '_blank');
      onClose();
      toast.success('Good luck with your application! 🎉', {
        duration: 5000,
        position: 'top-center',
      });
    }
  };
  
  
  

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />

          {/* Sliding Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300,
              duration: 0.3 
            }}
            className="fixed right-0 top-0 h-full w-full md:w-[90%] lg:w-[85%] bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10"
              aria-label="Close panel"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            {/* Loading State */}
            {state.loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                  <Loader2 className="w-12 h-12 text-[#1DE0DD] animate-spin mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {state.loadingStage === 'uploading' && 'Uploading your resume...'}
                    {state.loadingStage === 'converting' && 'Converting your resume...'}
                    {state.loadingStage === 'analyzing' && 'Analyzing with AI...'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {state.loadingStage === 'uploading' && 'Securely uploading your PDF file'}
                    {state.loadingStage === 'converting' && 'Using pdf2htmlEX to preserve formatting'}
                    {state.loadingStage === 'analyzing' && 'Generating personalized suggestions'}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${state.loadingProgress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-[#1DE0DD] to-blue-500"
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {state.loadingProgress}% complete
                  </p>
                </div>
              </div>
            ) : state.error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {state.errorType === 'conversion' ? 'Failed to Convert PDF' : 
                     state.errorType === 'ai' ? 'AI Analysis Failed' : 
                     'Error Loading Resume'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {state.error}
                  </p>
                  
                  <div className="space-y-3">
                    {state.errorType === 'conversion' && (
                      <>
                        <button
                          onClick={() => {
                            setState(prev => ({ ...prev, error: null }));
                            setShowUploadModal(true);
                          }}
                          className="w-full px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
                        >
                          Try Another PDF
                        </button>
                        <button
                          onClick={() => {
                            // Fallback to text-based flow
                            setState(prev => ({ ...prev, error: null, loading: false }));
                            toast('Using text-based resume editor');
                            // TODO: Implement text-based fallback
                          }}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Use Text-Based Editor
                        </button>
                      </>
                    )}
                    
                    {state.errorType === 'ai' && (
                      <>
                        <button
                          onClick={() => uploadResumeForParsing()}
                          className="w-full px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
                        >
                          Retry AI Analysis
                        </button>
                        <button
                          onClick={() => {
                            // Continue without suggestions
                            setState(prev => ({ 
                              ...prev, 
                              error: null, 
                              suggestions: [],
                              loading: false
                            }));
                            toast('Continuing without AI suggestions');
                          }}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Continue Without Suggestions
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={onClose}
                      className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row">
                {/* Left side - HTML Resume Preview (60% desktop, full mobile with toggle) */}
                <div className={`${showMobilePDF ? 'flex' : 'hidden'} md:flex flex-1 bg-gray-50 dark:bg-gray-800 relative md:w-[60%]`}>
                  {state.htmlContent ? (
                    <ResumeViewer
                      htmlContent={state.htmlContent}
                      suggestions={state.suggestions}
                      onAcceptSuggestion={handleAcceptSuggestion}
                      onRejectSuggestion={handleRejectSuggestion}
                      onEditSuggestion={handleEditSuggestion}
                      showInlineEditor={true}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Resume preview will appear here</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Mobile close button for preview */}
                  <button
                    onClick={() => setShowMobilePDF(false)}
                    className="md:hidden absolute top-4 right-4 p-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Right side - Form Editor (40% desktop, full mobile) */}
                <div className={`${showMobilePDF ? 'hidden' : 'flex'} md:flex flex-1 md:flex-none bg-white dark:bg-gray-900 md:border-l border-gray-200 dark:border-gray-700 md:w-[40%] flex-col`}>
                  <div className="flex-1 overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 z-10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                                Customize Resume
                              </h2>
                              {job && (
                                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                                  {job.job_title} at {job.employer_name}
                                </p>
                              )}
                            </div>
                            
                            {/* Mobile PDF Toggle */}
                            <button
                              onClick={() => setShowMobilePDF(!showMobilePDF)}
                              className="md:hidden flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              Preview
                            </button>
                          </div>
                        </div>
                        
                        {/* Status Indicator */}
                        {state.isGenerating && (
                          <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-500 animate-spin" />
                            <span className="text-xs md:text-sm font-medium text-blue-700 dark:text-blue-400">
                              Generating...
                            </span>
                          </div>
                        )}
                      </div>
                      
                    </div>

                    {/* Form Content */}
                    <div className="p-4 md:p-6">
                      <div className="space-y-4 md:space-y-6">
                        {/* Improvement Statistics */}
                        {state.suggestions.length > 0 && (
                          <ImprovementStats
                            beforeScore={state.beforeScore}
                            afterScore={state.afterScore}
                            totalSuggestions={state.suggestions.length}
                            acceptedSuggestions={state.suggestions.filter(s => s.status === 'accepted').length}
                            rejectedSuggestions={state.suggestions.filter(s => s.status === 'rejected').length}
                            modifiedSuggestions={state.suggestions.filter(s => s.status === 'modified').length}
                          />
                        )}
                        
                        {/* Keyboard Shortcuts Help */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-xs">
                          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Keyboard Shortcuts
                          </h4>
                          <div className="space-y-1 text-gray-600 dark:text-gray-400">
                            <div className="flex justify-between">
                              <span>Accept suggestion</span>
                              <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">A</kbd>
                            </div>
                            <div className="flex justify-between">
                              <span>Reject suggestion</span>
                              <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">R</kbd>
                            </div>
                            <div className="flex justify-between">
                              <span>Undo last action</span>
                              <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Z</kbd>
                            </div>
                          </div>
                        </div>

                        {/* Export Panel */}
                        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                          <ExportPanel
                            sessionId={state.sessionId}
                            htmlContent={state.htmlContent}
                            suggestions={state.suggestions}
                            onExport={handleExport}
                            isExporting={state.isGenerating}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
          
          {/* Mobile PDF Viewer */}
          <AnimatePresence>
            {showMobilePDF && state.htmlContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="md:hidden fixed inset-0 bg-black z-[55] flex flex-col"
              >
                <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
                  <h3 className="text-white font-medium">Resume Preview</h3>
                  <button
                    onClick={() => setShowMobilePDF(false)}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto bg-white">
                  <ResumeViewer
                    htmlContent={state.htmlContent}
                    suggestions={state.suggestions}
                    onAcceptSuggestion={handleAcceptSuggestion}
                    onRejectSuggestion={handleRejectSuggestion}
                    onEditSuggestion={handleEditSuggestion}
                    showInlineEditor={true}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          
          {/* Apply Now Modal */}
          <AnimatePresence>
            {showApplyModal && job && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
                onClick={() => setShowApplyModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Resume Downloaded!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Your customized resume is ready. Ready to apply to {job.employer_name}?
                    </p>
                    
                    <div className="space-y-3">
                      <button
                        onClick={handleApplyNow}
                        className="w-full px-6 py-3 bg-[#1DE0DD] text-white font-medium rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
                      >
                        Apply Now on {job.job_apply_is_direct ? 'Company Site' : 'LinkedIn'}
                      </button>
                      
                      <button
                        onClick={() => setShowApplyModal(false)}
                        className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Continue Editing
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Upload Modal */}
          <AnimatePresence>
            {showUploadModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
                onClick={() => setShowUploadModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#1DE0DD]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-[#1DE0DD]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Upload Your Resume
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Upload your PDF resume to customize it for the {job?.job_title} position at {job?.employer_name}
                    </p>
                    
                    <div className="space-y-4">
                      {!uploadedFile ? (
                        <label className="block">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 hover:border-[#1DE0DD] transition-colors cursor-pointer">
                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              PDF files only
                            </p>
                          </div>
                        </label>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-8 h-8 text-[#1DE0DD]" />
                              <div className="text-left">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {uploadedFile.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setUploadedFile(null)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            >
                              <X className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowUploadModal(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUpload}
                          disabled={!uploadedFile || isUploading}
                          className="flex-1 px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Upload & Generate
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
    
    {/* Toast Container */}
    <Toaster
      position="top-right"
      toastOptions={{
        className: '',
        style: {
          background: '#363636',
          color: '#fff',
        },
      }}
    />
    </>
  );
};