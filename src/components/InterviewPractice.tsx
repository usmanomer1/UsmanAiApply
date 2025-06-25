import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Target, Award, RefreshCw, Settings, BookOpen, Briefcase, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useElevenLabsConversation, ConversationMessage } from '../hooks/useElevenLabsConversation';
import { ElevenLabsClient } from '../lib/elevenlabs';
import VoiceControls from './voice/VoiceControls';
import ConversationHistory from './voice/ConversationHistory';
import VoiceUsageDisplay from './voice/VoiceUsageDisplay';
import PaywallModal from './ui/PaywallModal';
import { usePaywall } from '../hooks/usePaywall';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import Silk from './ui/Silk';

// Session type descriptions for CS interview practice
const SESSION_DESCRIPTIONS = {
  general: "Background, programming experience, career goals, and general CS knowledge",
  technical: "Algorithms, data structures, system design, coding concepts, and problem-solving",
  behavioral: "Past experiences, teamwork, technical challenges, and professional situations"
};

interface InterviewPracticeProps {
  className?: string;
}

export const InterviewPractice: React.FC<InterviewPracticeProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [sessionType, setSessionType] = useState<'general' | 'technical' | 'behavioral'>('general');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  
  const { checkVoiceAccess, isAuthenticated } = usePaywall();

  const conversation = useElevenLabsConversation({
    sessionType,
    onMessage: handleMessage,
    onError: (error: string) => console.error('Conversation error:', error),
    onSessionEnd: () => {
      setSessionActive(false);
      setCurrentQuestion('Session Complete - Review your feedback above');
    }
  });

  function handleMessage(message: ConversationMessage) {
    // Extract current question from AI responses
    if (!message.isUser && message.text) {
      const questionMatch = message.text.match(/(?:Question|Here's my next question|Let me ask you)[^:]*:\s*(.+?)(?:\n|$)/i);
      if (questionMatch) {
        setCurrentQuestion(questionMatch[1].trim());
      }
    }
  }

  // Check access on component mount
  useEffect(() => {
    const checkAccess = async () => {
      if (!isAuthenticated) {
        setShowPaywall(true);
        setAccessCheckComplete(true);
        return;
      }

      try {
        const accessResult = await checkVoiceAccess(200); // Check for typical conversation length
        if (!accessResult.hasAccess) {
          setShowPaywall(true);
        }
      } catch (error) {
        console.error('Error checking voice access:', error);
        setShowPaywall(true);
      } finally {
        setAccessCheckComplete(true);
      }
    };

    checkAccess();
  }, [isAuthenticated, checkVoiceAccess]);

  const startSession = useCallback(async () => {
    // Double-check access before starting
    if (!isAuthenticated) {
      setShowPaywall(true);
      return;
    }

    try {
      const accessResult = await checkVoiceAccess(500); // Estimate for full conversation
      if (!accessResult.hasAccess) {
        setShowPaywall(true);
        return;
      }

      setSessionActive(true);
      conversation.clearConversation();
      conversation.startSession();
    } catch (error) {
      console.error('Error checking access before session start:', error);
      setShowPaywall(true);
    }
  }, [conversation, isAuthenticated, checkVoiceAccess]);

  const resetSession = useCallback(() => {
    setSessionActive(false);
    setCurrentQuestion(null);
    conversation.clearConversation();
  }, [conversation]);

  const handleUpgrade = () => {
    navigate('/billing');
  };

  // Show loading state while checking access
  if (!accessCheckComplete) {
    return (
      <div className={`max-w-4xl mx-auto p-6 space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Checking access...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Silk className="fixed inset-0 z-0" animate={false} />
      <div className="fixed inset-0 bg-white/30 dark:bg-black/20 z-0"></div>
      <div className={`relative min-h-screen max-w-4xl mx-auto p-6 space-y-6 z-10 ${className}`}>
      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="Voice Interview Practice"
        description="Practice CS interviews with AI voice interaction, personalized feedback, and conversation follow-ups"
        onUpgrade={handleUpgrade}
        requiredPlan="any"
      />
      {/* Beta Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4"
      >
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            BETA
          </Badge>
          <div className="flex-1">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Currently optimized for Computer Science students and software engineering roles.</strong> 
              This feature is in beta and specifically tailored for CS interviews including coding, algorithms, and system design questions.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CS Interview Practice</h1>
            <p className="text-gray-600 dark:text-gray-300">Conversational AI interviewer with personalized feedback and follow-ups</p>
          </div>
        </div>

        {/* Session Stats */}
        <div className="flex items-center justify-center space-x-6">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Question {conversation.questionCount}/{conversation.maxQuestions}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-green-500" />
            <Badge variant="outline">{sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}</Badge>
          </div>
        </div>
      </motion.div>

      {/* Voice Usage Display */}
      <VoiceUsageDisplay compact className="mb-4" />

      {/* Session Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Session Configuration</span>
          </CardTitle>
          <CardDescription>
            Choose your interview type and have a natural conversation with our AI interviewer. Get personalized feedback and follow-up questions based on your responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Interview Type
            </label>
            <Select
              value={sessionType}
              onValueChange={(value: 'general' | 'technical' | 'behavioral') => setSessionType(value)}
              disabled={sessionActive}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4" />
                    <div>
                      <span>General CS Interview</span>
                      <p className="text-xs text-gray-500">{SESSION_DESCRIPTIONS.general}</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="technical">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4" />
                    <div>
                      <span>Technical/Coding Interview</span>
                      <p className="text-xs text-gray-500">{SESSION_DESCRIPTIONS.technical}</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="behavioral">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <div>
                      <span>Behavioral Interview</span>
                      <p className="text-xs text-gray-500">{SESSION_DESCRIPTIONS.behavioral}</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {!sessionActive ? (
              <Button
                onClick={startSession}
                disabled={!conversation.isInitialized}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
              >
                {conversation.isInitialized ? 'Start Practice Session' : 'Initializing...'}
              </Button>
            ) : (
              <Button
                onClick={resetSession}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset Session
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Question Display */}
      {currentQuestion && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
        >
          <div className="flex items-start space-x-3">
            <Award className="w-6 h-6 text-purple-500 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                Current Question ({conversation.questionCount}/{conversation.maxQuestions})
              </h3>
              <p className="text-purple-700 dark:text-purple-200">{currentQuestion}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Voice Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        <VoiceControls
          isListening={conversation.isListening}
          isSpeaking={conversation.isSpeaking}
          isLoading={conversation.isLoading}
          isInitialized={conversation.isInitialized}
          onStartListening={conversation.startListening}
          onStopListening={conversation.stopListening}
          onStopSpeaking={conversation.stopSpeaking}
          disabled={!sessionActive && conversation.conversation.length === 0}
        />
      </motion.div>



      {/* Status Messages */}
      {conversation.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center"
        >
          {conversation.error.includes('429') ? (
            <>
              ⏳ Voice system is initializing... Please wait a moment while we set up your AI interviewer.
            </>
          ) : conversation.error.includes('Microphone') ? (
            <>
              🎤 <strong>Microphone Access Required:</strong> Please allow microphone access in your browser to use voice features. 
              Click the microphone icon in your browser's address bar and select "Allow".
            </>
          ) : conversation.error.includes('Speech recognition not supported') ? (
            <>
              ⚠️ <strong>Browser Not Supported:</strong> Speech recognition requires Chrome, Edge, or Safari. 
              Please use a supported browser for voice features.
            </>
          ) : (
            conversation.error
          )}
        </motion.div>
      )}

      {conversation.isListening && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm text-center"
        >
          🎤 Listening... Speak clearly and I'll process your response.
        </motion.div>
      )}

      {conversation.isSpeaking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center"
        >
          🔊 Speaking... Listen carefully to the question or feedback.
        </motion.div>
      )}

      {conversation.isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm text-center"
        >
          🤖 AI Interviewer is thinking... Generating personalized response based on your answer.
        </motion.div>
      )}

      {/* Conversation History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ConversationHistory
          messages={conversation.conversation}
          className="min-h-[400px]"
        />
      </motion.div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
                        className="rounded-lg p-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
                  backdropFilter: 'blur(10px)'
                }}
      >
        <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
          <BookOpen className="w-4 h-4 mr-2" />
          Conversational Interview Tips
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>• <strong>Be Conversational:</strong> Treat this like a real interview - ask questions, show enthusiasm</li>
          <li>• <strong>Think Aloud:</strong> Explain your reasoning process as you work through problems</li>
          <li>• <strong>Engage with Feedback:</strong> The AI will provide follow-ups based on your answers</li>
          <li>• <strong>Technical Deep-Dives:</strong> Expect follow-up questions about complexity, edge cases, and alternatives</li>
          <li>• <strong>Behavioral Stories:</strong> Use specific examples from your coding projects and experiences</li>
          <li>• <strong>Ask for Clarification:</strong> Don't hesitate to ask the interviewer to clarify questions</li>
        </ul>
      </motion.div>
      </div>
    </>
  );
};

export default InterviewPractice; 