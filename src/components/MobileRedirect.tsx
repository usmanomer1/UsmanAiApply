import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Sparkles, ArrowRight, Laptop, MousePointer } from 'lucide-react';
import toast from 'react-hot-toast';

export const MobileRedirect: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 z-50 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIiAvPjwvc3ZnPg==')] opacity-50" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full"
        >
          {/* Icon animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.2 
            }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-3xl shadow-2xl"
              >
                <Smartphone className="w-16 h-16 text-white" />
              </motion.div>
              
              {/* Sparkles around icon */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 -m-2"
              >
                <Sparkles className="absolute top-0 right-0 w-4 h-4 text-yellow-400" />
                <Sparkles className="absolute bottom-0 left-0 w-3 h-3 text-blue-400" />
                <Sparkles className="absolute top-1/2 right-0 w-3 h-3 text-purple-400" />
              </motion.div>
            </div>
          </motion.div>

          {/* Main content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center space-y-6"
          >
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Desktop Experience Required
            </h1>
            
            <p className="text-gray-300 text-lg leading-relaxed">
              Our AI job automation agent works best on desktop browsers for optimal performance and functionality.
            </p>

            {/* Features grid */}
            <div className="grid grid-cols-1 gap-4 mt-8 mb-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="bg-blue-500/20 p-3 rounded-xl">
                  <Monitor className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Full Browser Control</h3>
                  <p className="text-sm text-gray-400">Navigate LinkedIn seamlessly</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="bg-purple-500/20 p-3 rounded-xl">
                  <MousePointer className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Advanced Automation</h3>
                  <p className="text-sm text-gray-400">Apply to jobs automatically</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="bg-pink-500/20 p-3 rounded-xl">
                  <Laptop className="w-6 h-6 text-pink-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Live Progress Tracking</h3>
                  <p className="text-sm text-gray-400">Monitor applications in real-time</p>
                </div>
              </motion.div>
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="pt-4"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1 rounded-2xl">
                <div className="bg-gray-900 rounded-2xl px-8 py-6">
                  <p className="text-sm text-gray-400 mb-3">Open this link on your desktop:</p>
                  <div className="bg-black/50 rounded-xl px-4 py-3 mb-4">
                    <code className="text-blue-400 text-sm break-all">{window.location.origin}</code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin);
                      toast.success('Link copied to clipboard!');
                    }}
                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Copy link to clipboard
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom decoration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-12 text-center"
          >
            <p className="text-xs text-gray-500">
              AI-powered job automation • Best experienced on desktop
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};