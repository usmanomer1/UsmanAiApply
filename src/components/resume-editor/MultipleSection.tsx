import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Save, Loader2, Check, X } from 'lucide-react';

interface EntryField {
  name: string;
  value: string | string[];
}

interface Entry {
  id: string;
  fields: EntryField[];
}

interface MultipleSectionProps {
  section: {
    id: string;
    title: string;
    entries: Entry[];
  };
  onSave: (sectionId: string, data: { entries: Entry[] }) => Promise<void>;
  onFieldChange?: () => void;
}

export const MultipleSection: React.FC<MultipleSectionProps> = ({ section, onSave, onFieldChange }) => {
  const [entries, setEntries] = useState<Entry[]>(section.entries || []);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const handleFieldChange = (entryId: string, fieldName: string, value: string | string[]) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        return {
          ...entry,
          fields: entry.fields.map(field =>
            field.name === fieldName ? { ...field, value } : field
          )
        };
      }
      return entry;
    }));
    setIsDirty(true);
    setSaveSuccess(false);
    onFieldChange?.();
  };

  const handleAddBullet = (entryId: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        const bulletsField = entry.fields.find(f => f.name === 'bullets');
        if (bulletsField && Array.isArray(bulletsField.value)) {
          return {
            ...entry,
            fields: entry.fields.map(field =>
              field.name === 'bullets'
                ? { ...field, value: [...bulletsField.value, ''] }
                : field
            )
          };
        }
      }
      return entry;
    }));
    setIsDirty(true);
  };

  const handleRemoveBullet = (entryId: string, bulletIndex: number) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        const bulletsField = entry.fields.find(f => f.name === 'bullets');
        if (bulletsField && Array.isArray(bulletsField.value)) {
          return {
            ...entry,
            fields: entry.fields.map(field =>
              field.name === 'bullets'
                ? { ...field, value: bulletsField.value.filter((_, i) => i !== bulletIndex) }
                : field
            )
          };
        }
      }
      return entry;
    }));
    setIsDirty(true);
  };

  const handleAddEntry = () => {
    const newId = `${section.id}-${entries.length}`;
    const templateEntry = entries[0] || {
      fields: [
        { name: 'company', value: '' },
        { name: 'position', value: '' },
        { name: 'duration', value: '' },
        { name: 'location', value: '' },
        { name: 'bullets', value: [''] }
      ]
    };
    
    const newEntry: Entry = {
      id: newId,
      fields: templateEntry.fields.map(field => ({
        ...field,
        value: field.name === 'bullets' ? [''] : ''
      }))
    };
    
    setEntries([...entries, newEntry]);
    setExpandedEntries(prev => new Set(prev).add(newId));
    setIsDirty(true);
  };

  const handleDeleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(entry => entry.id !== entryId));
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      newSet.delete(entryId);
      return newSet;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Always send ALL entries, even unchanged ones
      // The backend expects the complete list to properly update the resume
      const dataToSend = {
        entries: entries.map(entry => ({
          id: entry.id,
          fields: entry.fields.map(field => ({
            name: field.name,
            value: field.value
          }))
        }))
      };

      console.log(`Saving ${section.id} with ${entries.length} entries`);
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

  const getFieldLabel = (fieldName: string): string => {
    const labels: Record<string, string> = {
      company: 'Company',
      position: 'Position',
      duration: 'Duration',
      location: 'Location',
      bullets: 'Achievements',
      school: 'School',
      degree: 'Degree',
      major: 'Major',
      gpa: 'GPA'
    };
    return labels[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  };

  const getEntryTitle = (entry: Entry): string => {
    const positionField = entry.fields.find(f => f.name === 'position');
    const companyField = entry.fields.find(f => f.name === 'company');
    const schoolField = entry.fields.find(f => f.name === 'school');
    const degreeField = entry.fields.find(f => f.name === 'degree');
    
    if (positionField?.value && companyField?.value) {
      return `${positionField.value} at ${companyField.value}`;
    } else if (schoolField?.value && degreeField?.value) {
      return `${degreeField.value} - ${schoolField.value}`;
    } else if (positionField?.value || companyField?.value || schoolField?.value || degreeField?.value) {
      return (positionField?.value || companyField?.value || degreeField?.value || schoolField?.value) as string;
    }
    return 'New Entry';
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

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => toggleExpanded(entry.id)}
            >
              <div className="flex items-center gap-3">
                {expandedEntries.has(entry.id) ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
                <span className="font-medium text-gray-900 dark:text-white">
                  {getEntryTitle(entry)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEntry(entry.id);
                }}
                className="text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {expandedEntries.has(entry.id) && (
              <div className="p-4 space-y-4">
                {entry.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {getFieldLabel(field.name)}
                    </label>
                    
                    {field.name === 'bullets' && Array.isArray(field.value) ? (
                      <div className="space-y-2">
                        {field.value.map((bullet, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => {
                                const newBullets = [...field.value];
                                newBullets[index] = e.target.value;
                                handleFieldChange(entry.id, 'bullets', newBullets);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              placeholder="Describe an achievement..."
                            />
                            <button
                              onClick={() => handleRemoveBullet(entry.id, index)}
                              className="text-red-500 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAddBullet(entry.id)}
                          className="flex items-center gap-2 text-[#1DE0DD] hover:text-[#1DE0DD]/80 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Achievement
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={field.value as string}
                        onChange={(e) => handleFieldChange(entry.id, field.name, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        placeholder={`Enter ${getFieldLabel(field.name).toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={handleAddEntry}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-[#1DE0DD] hover:text-[#1DE0DD] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New {section.title.slice(0, -1)}
        </button>
      </div>
    </div>
  );
};