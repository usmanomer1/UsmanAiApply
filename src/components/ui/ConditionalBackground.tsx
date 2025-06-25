import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Silk from './Silk';

interface ConditionalBackgroundProps {
  className?: string;
  animate?: boolean;
}

const ConditionalBackground: React.FC<ConditionalBackgroundProps> = ({ 
  className = "fixed inset-0 z-0", 
  animate = false 
}) => {
  const { isDark } = useTheme();

  return (
    <>
      {isDark ? (
        // Dark mode: Use Silk background
        <Silk className={className} animate={animate} />
      ) : (
        // Light mode: Elegant minimal gradient background
        <div className={`${className} bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100`}>
          {/* Subtle geometric pattern overlay */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/30 to-transparent transform -skew-y-12"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-gray-100/40 to-transparent transform skew-y-12"></div>
          </div>
          
          {/* Elegant circular gradients for depth */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-transparent blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-violet-50/50 via-purple-50/30 to-transparent blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-br from-gray-100/40 via-slate-50/30 to-transparent blur-2xl"></div>
        </div>
      )}
      
      {/* Consistent overlay for content readability */}
      <div className="fixed inset-0 bg-white/30 dark:bg-black/20 z-0"></div>
    </>
  );
};

export default ConditionalBackground; 