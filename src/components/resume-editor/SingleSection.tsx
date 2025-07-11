import React, { useState } from 'react';
import { Save, Loader2, Check } from 'lucide-react';

interface Field {
  name: string;
  type: string;
  value: string;
  label: string;
  required?: boolean;
}

interface SingleSectionProps {
  section: {
    id: string;
    title: string;
    fields: Field[];
  };
  onSave: (sectionId: string, data: Record<string, string>) => Promise<void>;
  onFieldChange?: () => void;
}

export const SingleSection: React.FC<SingleSectionProps> = ({ section, onSave, onFieldChange }) => {
  const [formData, setFormData] = useState<Record<string, string>>(
    section.fields.reduce((acc, field) => ({
      ...acc,
      [field.name]: field.value || ''
    }), {})
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    setIsDirty(true);
    setSaveSuccess(false);
    onFieldChange?.();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // For personal section, ensure we're using the correct field names
      const dataToSend = section.id === 'personal' ? {
        fullName: formData.fullName || formData.name || '',
        title: formData.title || '',
        email: formData.email || '',
        phone: formData.phone || '',
        location: formData.location || '',
        linkedin: formData.linkedin || '',
        github: formData.github || '',
        website: formData.website || ''
      } : formData;

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

  const getInputType = (type: string) => {
    switch (type) {
      case 'email':
      case 'tel':
      case 'url':
        return type;
      default:
        return 'text';
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

      <div className="space-y-4">
        {section.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={getInputType(field.type)}
              value={formData[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};