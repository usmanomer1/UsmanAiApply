import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Edit2, Save, Loader2 } from 'lucide-react';

export interface Suggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  category: 'bullet' | 'skill' | 'summary' | 'experience' | 'other';
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  modifiedText?: string;
  position: { x: number; y: number };
}

interface SuggestionOverlayProps {
  suggestion: Suggestion | null;
  onAccept: (suggestionId: string) => Promise<void>;
  onReject: (suggestionId: string) => Promise<void>;
  onEdit: (suggestionId: string, newText: string) => Promise<void>;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
}

export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  suggestion,
  onAccept,
  onReject,
  onEdit,
  onClose,
  anchorElement
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Calculate overlay position based on anchor element
  useEffect(() => {
    if (anchorElement && overlayRef.current) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = anchorRect.bottom + 8;
      let left = anchorRect.left;

      // Adjust if overlay would go off-screen
      if (top + overlayRect.height > viewportHeight) {
        top = anchorRect.top - overlayRect.height - 8;
      }

      if (left + overlayRect.width > viewportWidth) {
        left = viewportWidth - overlayRect.width - 16;
      }

      setOverlayPosition({ top, left });
    }
  }, [anchorElement, suggestion]);

  // Reset state when suggestion changes
  useEffect(() => {
    if (suggestion) {
      setEditedText(suggestion.modifiedText || suggestion.suggestedText);
      setIsEditing(false);
    }
  }, [suggestion]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleAccept = async () => {
    if (!suggestion) return;
    setIsLoading(true);
    try {
      await onAccept(suggestion.id);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!suggestion) return;
    setIsLoading(true);
    try {
      await onReject(suggestion.id);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!suggestion || !editedText.trim()) return;
    setIsLoading(true);
    try {
      await onEdit(suggestion.id, editedText.trim());
      setIsEditing(false);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      if (isEditing) {
        setIsEditing(false);
        setEditedText(suggestion?.modifiedText || suggestion?.suggestedText || '');
      } else {
        onClose();
      }
    }
  };

  if (!suggestion) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{
          top: overlayPosition.top,
          left: overlayPosition.left,
          maxWidth: '400px',
          minWidth: '320px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                suggestion.category === 'bullet' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                suggestion.category === 'skill' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                suggestion.category === 'summary' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                suggestion.category === 'experience' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
              }`}>
                {suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1)}
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                suggestion.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                suggestion.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                suggestion.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {suggestion.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Original Text */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Original
            </label>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-900 dark:text-red-100 line-through">
                {suggestion.originalText}
              </p>
            </div>
          </div>

          {/* Suggested/Edited Text */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {isEditing ? 'Edit Suggestion' : suggestion.modifiedText ? 'Modified' : 'Suggested'}
            </label>
            {isEditing ? (
              <textarea
                ref={editInputRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent resize-none"
                rows={3}
                placeholder="Enter your custom text..."
              />
            ) : (
              <div className={`p-3 rounded-md border ${
                suggestion.modifiedText 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}>
                <p className={`text-sm ${
                  suggestion.modifiedText
                    ? 'text-blue-900 dark:text-blue-100'
                    : 'text-green-900 dark:text-green-100'
                }`}>
                  {suggestion.modifiedText || suggestion.suggestedText}
                </p>
              </div>
            )}
          </div>

          {/* Reason */}
          {!isEditing && suggestion.reason && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Why this change?
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {suggestion.reason}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={isLoading || !editedText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#1DE0DD] text-white rounded-md hover:bg-[#1DE0DD]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Edit
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedText(suggestion.modifiedText || suggestion.suggestedText);
                  }}
                  disabled={isLoading}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleAccept}
                  disabled={isLoading || suggestion.status === 'accepted'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Accept
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading || suggestion.status !== 'pending'}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handleReject}
                  disabled={isLoading || suggestion.status === 'rejected'}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Reject
                </button>
              </>
            )}
          </div>
          {isEditing && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              Press Ctrl+Enter to save • Esc to cancel
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};