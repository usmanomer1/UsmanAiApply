import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingTransitionProps {
  onComplete?: () => void;
  minDuration?: number;
}

const LoadingTransition: React.FC<LoadingTransitionProps> = ({ 
  onComplete, 
  minDuration = 3000 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        setTimeout(onComplete, 500); // Wait for fade out animation
      }
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Full screen video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/webm/11c0604e31da4bffb492e67955d4b4b6.webm" type="video/webm" />
      </video>

      {/* Dark overlay for better text visibility */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Glassmorphic text container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="relative"
        >
          {/* Glow effect behind text */}
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-white/20 blur-3xl rounded-full -z-10 scale-150"
          />

          {/* Glassmorphic background */}
          <div className="relative backdrop-blur-xl bg-white/10 rounded-3xl p-12 px-16 border border-white/20 shadow-2xl">
            {/* Main text with pulse animation */}
            <motion.h1
              animate={{
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-4xl md:text-5xl lg:text-6xl font-light text-white/90 text-center tracking-wide"
              style={{
                fontFamily: "'Playfair Display', 'Cormorant Garamond', serif",
                textShadow: '0 2px 20px rgba(255, 255, 255, 0.3)'
              }}
            >
              Finding opportunities in the clouds…
            </motion.h1>

            {/* Subtle loading dots */}
            <motion.div className="flex justify-center mt-8 space-x-2">
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: index * 0.2,
                    ease: "easeInOut"
                  }}
                  className="w-2 h-2 bg-white/70 rounded-full"
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Optional: Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 100,
            }}
            animate={{
              y: -100,
              x: Math.random() * window.innerWidth,
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              delay: Math.random() * 10,
              ease: "linear"
            }}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
};

export default LoadingTransition;