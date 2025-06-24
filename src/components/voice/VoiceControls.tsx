import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Play, Pause } from 'lucide-react';
import { Button } from '../ui/button';

interface VoiceControlsProps {
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  disabled?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isListening,
  isSpeaking,
  isLoading,
  isInitialized,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  disabled = false,
}) => {
  const isDisabled = disabled || !isInitialized || isLoading;

  return (
    <div className="flex items-center justify-center space-x-4">
      {/* Microphone Button */}
      <motion.div
        whileHover={{ scale: isDisabled ? 1 : 1.05 }}
        whileTap={{ scale: isDisabled ? 1 : 0.95 }}
      >
        <Button
          onClick={isListening ? onStopListening : onStartListening}
          disabled={isDisabled || isSpeaking}
          size="lg"
          className={`relative w-16 h-16 rounded-full ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } transition-all duration-200`}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isListening ? (
            <>
              <MicOff className="w-6 h-6" />
              {/* Pulse animation for listening */}
              <motion.div
                className="absolute inset-0 rounded-full bg-red-400"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </>
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>
      </motion.div>

      {/* Speaking Status Indicator */}
      <motion.div
        whileHover={{ scale: isDisabled ? 1 : 1.05 }}
        whileTap={{ scale: isDisabled ? 1 : 0.95 }}
      >
        <Button
          onClick={onStopSpeaking}
          disabled={isDisabled || !isSpeaking}
          size="lg"
          variant={isSpeaking ? "destructive" : "outline"}
          className={`w-16 h-16 rounded-full transition-all duration-200 ${
            isSpeaking ? 'animate-pulse' : ''
          }`}
        >
          {isSpeaking ? (
            <>
              <VolumeX className="w-6 h-6" />
              {/* Sound wave animation */}
              <motion.div
                className="absolute inset-0 rounded-full bg-green-400"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </>
          ) : (
            <Volume2 className="w-6 h-6" />
          )}
        </Button>
      </motion.div>
    </div>
  );
};

export default VoiceControls; 