import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, Volume2, Clock } from 'lucide-react';
import { ConversationMessage } from '../../hooks/useVoiceAgent';
import { Button } from '../ui/button';

interface ConversationHistoryProps {
  messages: ConversationMessage[];
  className?: string;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  messages,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.play().catch(console.error);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col space-y-4 overflow-y-auto h-96 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border ${className}`}
    >
      <AnimatePresence>
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex max-w-3xl ${
                message.isUser ? 'flex-row-reverse' : 'flex-row'
              } items-start space-x-3`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.isUser
                    ? 'bg-blue-500 text-white'
                    : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                }`}
              >
                {message.isUser ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>

              {/* Message Content */}
              <div
                className={`flex flex-col ${
                  message.isUser ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl max-w-md ${
                    message.isUser
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  
                  {/* Audio playback for AI messages */}
                  {!message.isUser && message.audioUrl && (
                    <div className="mt-2 flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => playAudio(message.audioUrl!)}
                        className="h-8 px-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Volume2 className="w-3 h-3 mr-1" />
                        Replay
                      </Button>
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <Bot className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Ready to Practice!</p>
          <p className="text-sm text-center">
            Click the microphone to start your interview practice session.
            I'll ask you questions and provide feedback to help you improve.
          </p>
        </div>
      )}
    </div>
  );
};

export default ConversationHistory; 