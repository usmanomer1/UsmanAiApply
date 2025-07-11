import React, { useState, useEffect } from 'react';
import { SingleSection } from './SingleSection';
import { GroupedSection } from './GroupedSection';
import { MultipleSection } from './MultipleSection';
import { ListSection } from './ListSection';
import { ParagraphSection } from './ParagraphSection';
import { GripVertical, X } from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FormGeneratorProps {
  editSchema: any;
  sessionId: string;
  onSectionUpdate: (sectionId: string, data: any) => Promise<void>;
  onFieldChange?: () => void;
  onRemoveSection?: (sectionId: string) => Promise<void>;
  onReorderSections?: (newOrder: string[]) => Promise<void>;
  missingSkills?: string[];
  isDragging?: boolean;
  setIsDragging?: (isDragging: boolean) => void;
}

// Sortable Section Wrapper
const SortableSection: React.FC<{
  section: any;
  onSectionUpdate: (sectionId: string, data: any) => Promise<void>;
  onFieldChange?: () => void;
  onRemoveSection?: (sectionId: string) => Promise<void>;
  missingSkills?: string[];
  renderSection: (section: any) => React.ReactNode;
}> = ({ section, onRemoveSection, renderSection }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Don't allow removing essential sections
  const isRemovable = !['personal', 'summary', 'experience', 'education', 'skills'].includes(section.id);

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag Handle and Remove Button */}
      <div className="absolute -left-2 md:-left-8 top-0 flex items-start gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          {...attributes}
          {...listeners}
          className="p-1 md:p-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3 md:w-4 md:h-4" />
        </button>
        
        {isRemovable && onRemoveSection && (
          <button
            onClick={() => onRemoveSection(section.id)}
            className="p-1 md:p-1.5 rounded bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40"
            title="Remove section"
          >
            <X className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        )}
      </div>
      
      {renderSection(section)}
    </div>
  );
};

export const FormGenerator: React.FC<FormGeneratorProps> = ({ 
  editSchema, 
  sessionId, 
  onSectionUpdate,
  onFieldChange,
  onRemoveSection,
  onReorderSections,
  missingSkills = [],
  isDragging,
  setIsDragging
}) => {
  const [sections, setSections] = useState(editSchema?.sections || []);
  
  useEffect(() => {
    setSections(editSchema?.sections || []);
  }, [editSchema]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex((s: any) => s.id === active.id);
      const newIndex = sections.findIndex((s: any) => s.id === over?.id);
      
      const newSections = arrayMove(sections, oldIndex, newIndex);
      setSections(newSections);
      
      // Call the reorder API
      if (onReorderSections) {
        const newOrder = newSections.map((s: any) => s.id);
        await onReorderSections(newOrder);
      }
    }
    
    setIsDragging?.(false);
  };
  if (!sections.length) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No sections available for editing
      </div>
    );
  }

  const renderSection = (section: any) => {
    switch (section.type) {
      case 'single':
        return (
          <SingleSection
            key={section.id}
            section={section}
            onSave={onSectionUpdate}
            onFieldChange={onFieldChange}
          />
        );

      case 'grouped':
        return (
          <GroupedSection
            key={section.id}
            section={section}
            onSave={onSectionUpdate}
            onFieldChange={onFieldChange}
            missingSkills={section.id === 'skills' ? missingSkills : undefined}
          />
        );

      case 'multiple':
        return (
          <MultipleSection
            key={section.id}
            section={section}
            onSave={onSectionUpdate}
            onFieldChange={onFieldChange}
          />
        );

      case 'list':
        return (
          <ListSection
            key={section.id}
            section={section}
            onSave={onSectionUpdate}
            onFieldChange={onFieldChange}
          />
        );

      case 'paragraph':
        return (
          <ParagraphSection
            key={section.id}
            section={section}
            onSave={onSectionUpdate}
            onFieldChange={onFieldChange}
          />
        );

      default:
        console.warn(`Unknown section type: ${section.type}`);
        return null;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setIsDragging?.(true)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((s: any) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6 pl-6 md:pl-10">
          {sections.map((section: any) => (
            <SortableSection
              key={section.id}
              section={section}
              onSectionUpdate={onSectionUpdate}
              onFieldChange={onFieldChange}
              onRemoveSection={onRemoveSection}
              missingSkills={section.id === 'skills' ? missingSkills : undefined}
              renderSection={renderSection}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};