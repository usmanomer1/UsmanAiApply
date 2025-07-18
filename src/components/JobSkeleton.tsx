import React from 'react';

export const JobSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 animate-pulse">
      {/* Header with company and job title */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          {/* Company logo skeleton */}
          <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
          <div>
            {/* Company name */}
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            {/* Job title */}
            <div className="h-5 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
        {/* Match score skeleton */}
        <div className="h-8 w-16 bg-gray-200 rounded-full"></div>
      </div>

      {/* Location and employment info */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>

      {/* Description skeleton */}
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>

      {/* Skills section */}
      <div className="mb-4">
        <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
          <div className="h-6 bg-gray-200 rounded-full w-20"></div>
          <div className="h-6 bg-gray-200 rounded-full w-24"></div>
          <div className="h-6 bg-gray-200 rounded-full w-18"></div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
        <div className="flex space-x-2">
          <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
          <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};