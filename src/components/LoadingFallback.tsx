import React from 'react';
import { motion } from 'framer-motion';

interface LoadingFallbackProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingFallback({ 
  message = 'Loading...', 
  fullScreen = false 
}: LoadingFallbackProps) {
  const containerClass = fullScreen 
    ? "min-h-screen bg-gray-50 flex items-center justify-center" 
    : "flex items-center justify-center min-h-[400px]";

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-8 h-8 border-4 border-[#23a972] border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.p 
          className="text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}