import React, { useState } from 'react';
import { Save, Loader2, Check } from 'lucide-react';

interface ParagraphSectionProps {
  section: {
    id: string;
    title: string;
    content: string;
    maxLength?: number;
  };
  onSave: (sectionId: string, data: { content: string }) => Promise<void>;
  onFieldChange?: () => void;
}

export const ParagraphSection: React.FC<ParagraphSectionProps> = ({ section, onSave, onFieldChange }) => {
  const [content, setContent] = useState(section.content || '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const maxLength = section.maxLength || 500;

  const handleChange = (value: string) => {
    setContent(value);
    setIsDirty(true);
    setSaveSuccess(false);
    onFieldChange?.();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Send content as an object
      const dataToSend = { 
        content: content.trim() 
      };
      
      await onSave(section.id, dataToSend);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving section:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {section.title}
        </h3>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={isSaving || isOverLimit}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1DE0DD] text-white text-sm rounded-lg hover:bg-[#1DE0DD]/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          placeholder={`Write your ${section.title.toLowerCase()}...`}
        />
        
        <div className="flex justify-between items-center text-sm">
          <span className={`${isOverLimit ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
            {characterCount} / {maxLength} characters
          </span>
          {isOverLimit && (
            <span className="text-red-500 text-xs">
              Exceeds limit by {characterCount - maxLength} characters
            </span>
          )}
        </div>
      </div>
    </div>
  );
};