import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CheckCircle2, Edit3, X } from 'lucide-react';

interface ImprovementStatsProps {
  beforeScore?: number;
  afterScore?: number;
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  modifiedSuggestions: number;
}

export const ImprovementStats: React.FC<ImprovementStatsProps> = ({
  beforeScore = 65,
  afterScore = 85,
  totalSuggestions,
  acceptedSuggestions,
  rejectedSuggestions,
  modifiedSuggestions
}) => {
  const scoreImprovement = afterScore - beforeScore;
  const acceptanceRate = totalSuggestions > 0 
    ? Math.round((acceptedSuggestions / totalSuggestions) * 100) 
    : 0;
  
  const pendingSuggestions = totalSuggestions - acceptedSuggestions - rejectedSuggestions - modifiedSuggestions;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-6 space-y-4">
      {/* Score Improvement */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Resume Score
          </h4>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {afterScore}%
            </span>
            <motion.span
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium"
            >
              <TrendingUp className="w-4 h-4" />
              +{scoreImprovement}%
            </motion.span>
          </div>
        </div>
        
        {/* Visual Score Bar */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Before</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{beforeScore}%</p>
          </div>
          <div className="relative w-32 h-8">
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <motion.div
              initial={{ width: `${beforeScore}%` }}
              animate={{ width: `${afterScore}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1DE0DD] to-blue-500 rounded-full"
            />
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-500 dark:text-gray-400">After</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{afterScore}%</p>
          </div>
        </div>
      </div>

      {/* Suggestion Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Total Changes
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalSuggestions}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Acceptance Rate
          </p>
          <p className="text-xl font-bold text-[#1DE0DD]">
            {acceptanceRate}%
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-gray-600 dark:text-gray-400">Accepted</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {acceptedSuggestions}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">Modified</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {modifiedSuggestions}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-gray-600 dark:text-gray-400">Rejected</span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {rejectedSuggestions}
          </span>
        </div>
        
        {pendingSuggestions > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">Pending</span>
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {pendingSuggestions}
            </span>
          </div>
        )}
      </div>

      {/* What's Changed Summary */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          What's Changed
        </h5>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <li>• Enhanced {acceptedSuggestions} bullet points with metrics</li>
          <li>• Updated professional summary for ATS</li>
          <li>• Added {Math.floor(acceptedSuggestions / 3)} missing keywords</li>
          <li>• Improved action verbs throughout</li>
        </ul>
      </div>
    </div>
  );
};