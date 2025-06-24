import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  MessageCircle, 
  Settings, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Bot,
  Keyboard,
  ArrowLeft
} from 'lucide-react';
import { useLinkedInVoiceGuide } from '../../hooks/useLinkedInVoiceGuide';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface LinkedInVoiceSetupProps {
  onConfigurationComplete: (config: Record<string, string>) => void;
  onClose: () => void;
  initialConfig?: any;
}

const LinkedInVoiceSetup: React.FC<LinkedInVoiceSetupProps> = ({
  onConfigurationComplete,
  onClose,
  initialConfig = {}
}) => {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    conversation,
    isListening,
    isSpeaking,
    isLoading,
    configData,
    totalSteps,
    startVoiceGuide,
    stopVoiceGuide,
    startListening,
    stopListening,
    handleUserResponse,
    goToPreviousStep,
    replayLastMessage,
    audioRef
  } = useLinkedInVoiceGuide();

  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      handleUserResponse(textInput.trim());
      setTextInput('');
      setShowTextInput(false);
    }
  };

  const handleComplete = () => {
    onConfigurationComplete(configData);
    onClose();
  };

  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative bg-white/10 dark:bg-gray-900/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/30 dark:border-gray-700/30 w-full max-w-4xl max-h-[90vh] overflow-hidden animate-modal-popup">
        
        {/* Header */}
        <div className="p-6 border-b border-white/20 dark:border-gray-700/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center">
                  LinkedIn Voice Setup
                  <Badge className="ml-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Powered
                  </Badge>
                </h2>
                <p className="text-white/80 mt-1">
                  Let me guide you through setting up your LinkedIn automation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100/20 dark:hover:bg-gray-800/20 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          {isActive && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white/80">
                  Step {currentStepIndex + 1} of {totalSteps}: {currentStep?.title}
                </span>
                <span className="text-sm text-white/60">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {!isActive ? (
            /* Welcome Screen */
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <MessageCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Voice-Guided LinkedIn Setup
              </h3>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                I'll walk you through configuring your LinkedIn automation step by step. 
                Just speak naturally, and I'll help you set up everything you need for successful job applications.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                  <Settings className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white mb-1">Smart Configuration</h4>
                  <p className="text-sm text-white/70">AI-guided setup process</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                  <Mic className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white mb-1">Voice Control</h4>
                  <p className="text-sm text-white/70">Speak or type responses</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                  <CheckCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white mb-1">Validation</h4>
                  <p className="text-sm text-white/70">Real-time input validation</p>
                </div>
              </div>

              <Button
                onClick={startVoiceGuide}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Voice Setup
              </Button>
            </div>
          ) : (
            /* Conversation Interface */
            <div className="space-y-6">
              {/* Conversation History */}
              <div className="bg-white/5 rounded-xl p-4 max-h-80 overflow-y-auto space-y-4">
                                 {conversation.map((message: any) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.type === 'assistant' && (
                          <Bot className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm">{message.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs opacity-70">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                            {message.type === 'assistant' && message.audioUrl && (
                              <button
                                onClick={() => {
                                  if (audioRef.current) {
                                    audioRef.current.src = message.audioUrl!;
                                    audioRef.current.play();
                                  }
                                }}
                                className="text-xs opacity-70 hover:opacity-100 transition-opacity"
                              >
                                <Volume2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Loading indicator */}
                {(isLoading || isSpeaking) && (
                  <div className="flex justify-start">
                    <div className="bg-white/20 text-white border border-white/30 px-4 py-3 rounded-2xl">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 text-blue-400" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Voice Controls */}
              <div className="flex items-center justify-center space-x-4">
                {currentStepIndex > 0 && (
                  <button
                    onClick={goToPreviousStep}
                    disabled={isSpeaking || isLoading}
                    className="w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Go back to previous step"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}

                <motion.button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isSpeaking || isLoading}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white hover:shadow-xl transform hover:scale-105'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  whileTap={{ scale: 0.95 }}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </motion.button>

                <button
                  onClick={() => setShowTextInput(!showTextInput)}
                  className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all duration-200 hover:shadow-lg"
                >
                  <Keyboard className="w-5 h-5" />
                </button>

                <button
                  onClick={replayLastMessage}
                  disabled={conversation.length === 0 || isSpeaking}
                  className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              {/* Text Input */}
              <AnimatePresence>
                {showTextInput && (
                  <motion.form
                    onSubmit={handleTextSubmit}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <Input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your response here..."
                      className="bg-white/10 border-white/30 text-white placeholder-white/60"
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <Button
                        type="submit"
                        disabled={!textInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setShowTextInput(false)}
                        variant="outline"
                        className="border-white/30 text-white hover:bg-white/10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Status */}
              <div className="text-center">
                {isListening && (
                  <p className="text-white/80 animate-pulse">
                    🎤 Listening... Speak now or click the microphone to stop
                  </p>
                )}
                {isSpeaking && (
                  <p className="text-white/80 animate-pulse">
                    🔊 Speaking...
                  </p>
                )}
                {!isListening && !isSpeaking && !isLoading && (
                  <div className="space-y-2">
                    <p className="text-white/60">
                      Click the microphone to speak or use the keyboard to type
                    </p>
                    <p className="text-white/40 text-sm">
                      Say "go back" to return to previous step • "repeat" to hear the question again • "skip" to skip optional fields
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/20 dark:border-gray-700/20">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              {isActive && (
                <Button
                  onClick={stopVoiceGuide}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Setup
                </Button>
              )}
            </div>
            
            <div className="flex space-x-2">
              {currentStepIndex === totalSteps - 1 && Object.keys(configData).length > 0 && (
                <Button
                  onClick={handleComplete}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Setup
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
          </div>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} />
      </div>
    </div>
  );
};

export default LinkedInVoiceSetup; 