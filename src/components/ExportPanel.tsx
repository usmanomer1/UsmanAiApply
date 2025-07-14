import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Loader2, Check, X, Eye, AlertCircle } from 'lucide-react';
import { MappedSuggestion } from './ResumeViewer';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

interface ExportPanelProps {
  sessionId: string | null;
  htmlContent: string;
  suggestions: MappedSuggestion[];
  onExport: (format: 'pdf' | 'docx') => Promise<any>;
  isExporting?: boolean;
}

interface ExportProgress {
  status: 'idle' | 'preparing' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  sessionId,
  htmlContent,
  suggestions,
  onExport,
  isExporting: externalIsExporting = false
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'docx'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  // Calculate analytics
  const analytics = React.useMemo(() => {
    const total = suggestions.length;
    const accepted = suggestions.filter(s => s.status === 'accepted').length;
    const rejected = suggestions.filter(s => s.status === 'rejected').length;
    const modified = suggestions.filter(s => s.status === 'modified').length;
    const pending = suggestions.filter(s => s.status === 'pending').length;
    
    return {
      total,
      accepted,
      rejected,
      modified,
      pending,
      acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      completionRate: total > 0 ? Math.round(((accepted + rejected + modified) / total) * 100) : 0
    };
  }, [suggestions]);

  // Get final HTML without highlights
  const getFinalHtml = (): string => {
    if (!htmlContent) return '';
    
    // Create a temporary div to manipulate HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Remove all suggestion highlights and apply accepted changes
    suggestions.forEach(suggestion => {
      const elements = tempDiv.querySelectorAll(`[data-suggestion-id="${suggestion.id}"]`);
      elements.forEach(el => {
        if (suggestion.status === 'accepted') {
          el.textContent = suggestion.suggestedText;
        } else if (suggestion.status === 'modified' && suggestion.modifiedText) {
          el.textContent = suggestion.modifiedText;
        }
        // Remove highlight classes and data attributes
        el.removeAttribute('class');
        el.removeAttribute('data-suggestion-id');
        el.removeAttribute('data-original');
        el.removeAttribute('data-suggested');
        el.removeAttribute('data-reason');
      });
    });
    
    return tempDiv.innerHTML;
  };

  const handleExportClick = async () => {
    if (!sessionId || !htmlContent) {
      toast.error('Please wait for the resume to load');
      return;
    }

    if (analytics.pending > 0) {
      setShowPreview(true);
      return;
    }

    await executeExport();
  };

  const executeExport = async () => {
    setIsExporting(true);
    setExportProgress({
      status: 'preparing',
      progress: 20,
      message: 'Preparing your resume...'
    });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev.progress < 80) {
            return {
              ...prev,
              progress: prev.progress + 10,
              message: prev.progress < 40 ? 'Preparing your resume...' : 'Generating PDF...'
            };
          }
          return prev;
        });
      }, 500);

      // Get final HTML
      const finalHtml = getFinalHtml();
      
      // Update progress
      setExportProgress({
        status: 'generating',
        progress: 60,
        message: 'Generating PDF...'
      });

      // Call the export handler
      await onExport(selectedFormat);

      clearInterval(progressInterval);
      
      setExportProgress({
        status: 'complete',
        progress: 100,
        message: 'Export complete!'
      });

      // Track analytics
      console.log('Export Analytics:', {
        format: selectedFormat,
        ...analytics,
        timestamp: new Date().toISOString()
      });

      toast.success(`Resume exported as ${selectedFormat.toUpperCase()} successfully!`);
      
      // Reset after a delay
      setTimeout(() => {
        setExportProgress({
          status: 'idle',
          progress: 0,
          message: ''
        });
        setShowPreview(false);
      }, 2000);

    } catch (error: any) {
      console.error('Export error:', error);
      
      setExportProgress({
        status: 'error',
        progress: 0,
        message: error.message || 'Export failed'
      });

      // Handle specific errors
      if (error.message?.includes('timeout')) {
        toast.error('Export timed out. Please try again.');
      } else if (error.message?.includes('size')) {
        toast.error('Resume file is too large. Please reduce content.');
      } else {
        toast.error('Failed to export resume. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Export Button and Options */}
      <div className="space-y-4">
        {/* Format Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedFormat('pdf')}
            className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
              selectedFormat === 'pdf'
                ? 'border-[#1DE0DD] bg-[#1DE0DD]/10 text-[#1DE0DD]'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            PDF
          </button>
          <button
            onClick={() => setSelectedFormat('docx')}
            className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
              selectedFormat === 'docx'
                ? 'border-[#1DE0DD] bg-[#1DE0DD]/10 text-[#1DE0DD]'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            DOCX
          </button>
        </div>

        {/* Analytics Summary */}
        {suggestions.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Suggestion Summary
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  {analytics.accepted} accepted
                </span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-3 h-3 text-red-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  {analytics.rejected} rejected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {analytics.pending} pending
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  {analytics.modified} modified
                </span>
              </div>
            </div>
            {analytics.pending > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ You have {analytics.pending} pending suggestions
              </p>
            )}
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExportClick}
          disabled={isExporting || externalIsExporting || !htmlContent}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#1DE0DD] text-white font-medium rounded-lg hover:bg-[#1DE0DD]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isExporting || externalIsExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Export as {selectedFormat.toUpperCase()}</span>
            </>
          )}
        </button>

        {/* Progress Indicator */}
        <AnimatePresence>
          {exportProgress.status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {exportProgress.message}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {exportProgress.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${exportProgress.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    exportProgress.status === 'error'
                      ? 'bg-red-500'
                      : exportProgress.status === 'complete'
                      ? 'bg-green-500'
                      : 'bg-[#1DE0DD]'
                  }`}
                />
              </div>
              {exportProgress.status === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{exportProgress.message}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Export Preview
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    This is how your resume will look when exported
                  </p>
                  {analytics.pending > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ You have {analytics.pending} pending suggestions. They will not be included in the export.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-800">
                <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg">
                  <div 
                    className="p-8 resume-preview"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getFinalHtml()) }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowPreview(false);
                    await executeExport();
                  }}
                  className="flex-1 px-4 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Confirm & Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};