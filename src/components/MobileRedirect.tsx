import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const MobileRedirect: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card w-full max-w-md p-8 md:p-10 text-center"
      >
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#23a972]/10 ring-1 ring-[#23a972]/30">
          <Smartphone className="h-6 w-6 text-[#23a972]" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Desktop required</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          This experience is optimized for desktop browsers. Please open this link on your computer.
        </p>

        <div className="mt-6 text-left">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Your dashboard URL</p>
          <div className="mt-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2">
            <code className="text-sm text-gray-800 dark:text-gray-100 break-all">{window.location.origin}</code>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
              toast.success('Link copied to clipboard');
            }}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[#23a972] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#23a972]/40"
          >
            Copy link
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">
          AI-powered job automation • Best experienced on desktop
        </p>
      </motion.div>
    </div>
  );
};