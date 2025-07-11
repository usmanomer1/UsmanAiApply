import React, { useState } from 'react';
import { X, Plus, Save, Loader2, Check } from 'lucide-react';

interface GroupData {
  [category: string]: string[];
}

interface GroupedSectionProps {
  section: {
    id: string;
    title: string;
    fields: Array<{
      name: string;
      label: string;
      value: string[] | string;
    }>;
  };
  onSave: (sectionId: string, data: GroupData) => Promise<void>;
  onFieldChange?: () => void;
  missingSkills?: string[];
}

export const GroupedSection: React.FC<GroupedSectionProps> = ({ section, onSave, onFieldChange, missingSkills = [] }) => {
  const initialData = section.fields.reduce((acc, field) => {
    const value = Array.isArray(field.value) ? field.value : field.value ? [field.value] : [];
    return { ...acc, [field.name]: value };
  }, {} as GroupData);

  const [groupData, setGroupData] = useState<GroupData>(initialData);
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAddItem = (category: string) => {
    const newItem = newItems[category]?.trim();
    if (newItem && !groupData[category]?.includes(newItem)) {
      setGroupData(prev => ({
        ...prev,
        [category]: [...(prev[category] || []), newItem]
      }));
      setNewItems(prev => ({ ...prev, [category]: '' }));
      setIsDirty(true);
      setSaveSuccess(false);
      onFieldChange?.();
    }
  };

  const handleRemoveItem = (category: string, index: number) => {
    setGroupData(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
    setIsDirty(true);
    setSaveSuccess(false);
    onFieldChange?.();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // For skills section, ensure we send all categories
      const dataToSend = section.id === 'skills' ? {
        languages: groupData.languages || [],
        frameworks: groupData.frameworks || [],
        tools: groupData.tools || [],
        ...groupData  // Include any other categories
      } : groupData;

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {section.title}
        </h3>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={isSaving}
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

      <div className="space-y-6">
        {section.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {field.label}
            </label>
            
            {/* Tags Display */}
            <div className="flex flex-wrap gap-2 mb-3">
              {groupData[field.name]?.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  {item}
                  <button
                    onClick={() => handleRemoveItem(field.name, index)}
                    className="ml-1 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add New Item */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newItems[field.name] || ''}
                onChange={(e) => setNewItems(prev => ({ ...prev, [field.name]: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleAddItem(field.name)}
                placeholder={`Add ${field.label.toLowerCase()}`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={() => handleAddItem(field.name)}
                className="px-3 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        
        {/* Missing Skills Suggestion */}
        {section.id === 'skills' && missingSkills.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
              💡 Suggested skills from job description:
            </p>
            <div className="flex flex-wrap gap-2">
              {missingSkills.map((skill, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // Find the best category for this skill
                    const category = section.fields[0]?.name || 'languages';
                    if (!groupData[category]?.includes(skill)) {
                      setGroupData(prev => ({
                        ...prev,
                        [category]: [...(prev[category] || []), skill]
                      }));
                      setIsDirty(true);
                      setSaveSuccess(false);
                      onFieldChange?.();
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200 rounded text-xs hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {skill}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};