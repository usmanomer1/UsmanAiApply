import React, { useState } from 'react';
import { Plus, X, Save, Loader2, Check } from 'lucide-react';

interface ListSectionProps {
  section: {
    id: string;
    title: string;
    items: string[];
  };
  onSave: (sectionId: string, data: { items: string[] }) => Promise<void>;
  onFieldChange?: () => void;
}

export const ListSection: React.FC<ListSectionProps> = ({ section, onSave, onFieldChange }) => {
  const [items, setItems] = useState<string[]>(section.items || []);
  const [newItem, setNewItem] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAddItem = () => {
    if (newItem.trim()) {
      setItems([...items, newItem.trim()]);
      setNewItem('');
      setIsDirty(true);
      setSaveSuccess(false);
      onFieldChange?.();
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setIsDirty(true);
    setSaveSuccess(false);
    onFieldChange?.();
  };

  const handleUpdateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
    setIsDirty(true);
    setSaveSuccess(false);
    onFieldChange?.();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Filter out empty items and send as an object with items array
      const dataToSend = { 
        items: items.filter(item => item.trim()) 
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
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleUpdateItem(index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder={`${section.title.slice(0, -1)}...`}
            />
            <button
              onClick={() => handleRemoveItem(index)}
              className="text-red-500 hover:text-red-600 transition-colors p-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder={`Add new ${section.title.toLowerCase().slice(0, -1)}`}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <button
            onClick={handleAddItem}
            className="px-3 py-2 bg-[#1DE0DD] text-white rounded-lg hover:bg-[#1DE0DD]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};