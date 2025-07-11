import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Circle, 
  Filter, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Briefcase,
  Award,
  User,
  CheckSquare,
  Square,
  MoreHorizontal,
  Edit3
} from 'lucide-react';
import { Suggestion } from './SuggestionOverlay';

interface SuggestionsSidebarProps {
  suggestions: Suggestion[];
  onAccept: (suggestionId: string) => Promise<void>;
  onReject: (suggestionId: string) => Promise<void>;
  onEdit: (suggestionId: string, newText: string) => Promise<void>;
  onBulkAccept: (suggestionIds: string[]) => Promise<void>;
  onBulkReject: (suggestionIds: string[]) => Promise<void>;
  onSuggestionClick: (suggestion: Suggestion) => void;
}

type FilterCategory = 'all' | 'bullet' | 'skill' | 'summary' | 'experience' | 'other';
type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'modified';

const categoryIcons = {
  bullet: FileText,
  skill: Award,
  summary: User,
  experience: Briefcase,
  other: MoreHorizontal
};

const categoryColors = {
  bullet: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  skill: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  summary: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  experience: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
  other: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
};

export const SuggestionsSidebar: React.FC<SuggestionsSidebarProps> = ({
  suggestions,
  onAccept,
  onReject,
  onEdit,
  onBulkAccept,
  onBulkReject,
  onSuggestionClick
}) => {
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => {
      const categoryMatch = filterCategory === 'all' || suggestion.category === filterCategory;
      const statusMatch = filterStatus === 'all' || suggestion.status === filterStatus;
      return categoryMatch && statusMatch;
    });
  }, [suggestions, filterCategory, filterStatus]);

  // Group suggestions by category
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};
    filteredSuggestions.forEach(suggestion => {
      if (!groups[suggestion.category]) {
        groups[suggestion.category] = [];
      }
      groups[suggestion.category].push(suggestion);
    });
    return groups;
  }, [filteredSuggestions]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = suggestions.length;
    const reviewed = suggestions.filter(s => s.status !== 'pending').length;
    const accepted = suggestions.filter(s => s.status === 'accepted').length;
    const rejected = suggestions.filter(s => s.status === 'rejected').length;
    const modified = suggestions.filter(s => s.status === 'modified').length;
    const pending = suggestions.filter(s => s.status === 'pending').length;
    
    return { total, reviewed, accepted, rejected, modified, pending };
  }, [suggestions]);

  // Handle selection
  const handleSelectAll = () => {
    if (selectedIds.size === filteredSuggestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSuggestions.map(s => s.id)));
    }
  };

  const handleSelectSuggestion = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle bulk actions
  const handleBulkAccept = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      await onBulkAccept(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      await onBulkReject(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'modified':
        return <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Circle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          AI Suggestions
        </h3>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>{stats.reviewed} of {stats.total} reviewed</span>
            <span>{Math.round((stats.reviewed / stats.total) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(stats.reviewed / stats.total) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#1DE0DD] to-blue-500 rounded-full"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-gray-600 dark:text-gray-400">{stats.accepted} accepted</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-gray-600 dark:text-gray-400">{stats.rejected} rejected</span>
          </div>
          <div className="flex items-center gap-2">
            <Edit3 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">{stats.modified} modified</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-gray-600 dark:text-gray-400">{stats.pending} pending</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>
        
        {/* Category Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Category
          </label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="bullet">Bullets</option>
            <option value="skill">Skills</option>
            <option value="summary">Summary</option>
            <option value="experience">Experience</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#1DE0DD] focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="modified">Modified</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkAccept}
              disabled={isProcessing}
              className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={handleBulkReject}
              disabled={isProcessing}
              className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reject All
            </button>
          </div>
        </div>
      )}

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSuggestions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No suggestions match your filters</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Select All */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleSelectAll}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                {selectedIds.size === filteredSuggestions.length ? (
                  <CheckSquare className="w-4 h-4 text-[#1DE0DD]" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Select all {filteredSuggestions.length} suggestions
              </span>
            </div>

            {/* Grouped Suggestions */}
            {Object.entries(groupedSuggestions).map(([category, categorySuggestions]) => {
              const Icon = categoryIcons[category as keyof typeof categoryIcons] || MoreHorizontal;
              const isExpanded = expandedCategories.has(category);
              
              return (
                <div key={category} className="space-y-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <Icon className={`w-4 h-4 ${categoryColors[category as keyof typeof categoryColors]}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 text-left">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {categorySuggestions.length}
                    </span>
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 overflow-hidden"
                      >
                        {categorySuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                              suggestion.status === 'pending'
                                ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                                : suggestion.status === 'accepted'
                                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 opacity-60'
                                : suggestion.status === 'rejected'
                                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 opacity-60'
                                : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            }`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSuggestion(suggestion.id);
                              }}
                              className="p-1 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded transition-colors"
                            >
                              {selectedIds.has(suggestion.id) ? (
                                <CheckSquare className="w-4 h-4 text-[#1DE0DD]" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => onSuggestionClick(suggestion)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(suggestion.status)}
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                                  {suggestion.originalText}
                                </p>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                → {suggestion.modifiedText || suggestion.suggestedText}
                              </p>
                              {suggestion.reason && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-1">
                                  {suggestion.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};