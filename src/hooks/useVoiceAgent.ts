import { useState, useEffect, useCallback, useRef } from 'react';
import { createElevenLabsClient, ElevenLabsVoice, VoicePersonality, RateLimitError } from '../lib/elevenlabs';

interface ConversationMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  audioUrl?: string;
}

interface VoiceAgentState {
  isInitialized: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  selectedVoice: ElevenLabsVoice | null;
  conversation: ConversationMessage[];
  error: string | null;
  rateLimited: boolean;
  rateLimitInfo?: any;
}

interface UseVoiceAgentOptions {
  personality: VoicePersonality;
  autoSpeak?: boolean;
  userId?: string;
  onMessage?: (message: ConversationMessage) => void;
  onError?: (error: string) => void;
  onRateLimit?: (info: any) => void;
}

export const useVoiceAgent = (options: UseVoiceAgentOptions) => {
  const { personality, autoSpeak = true, userId, onMessage, onError, onRateLimit } = options;
  
  const [state, setState] = useState<VoiceAgentState>({
    isInitialized: false,
    isListening: false,
    isSpeaking: false,
    isLoading: false,
    selectedVoice: null,
    conversation: [],
    error: null,
    rateLimited: false,
  });

  const elevenLabsClient = useRef<any>(null);
  const recognition = useRef<any>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const initializationTimeout = useRef<number | null>(null);

  // Initialize voice recognition and select voice
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Initialize ElevenLabs client (singleton)
      if (!elevenLabsClient.current) {
        elevenLabsClient.current = createElevenLabsClient();
      }

      // Initialize Web Speech API
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition.current = new SpeechRecognition();
        recognition.current.continuous = false;
        recognition.current.interimResults = false;
        recognition.current.lang = 'en-US';

        recognition.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleUserMessage(transcript);
        };

        recognition.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setState(prev => ({ ...prev, isListening: false, error: `Speech recognition error: ${event.error}` }));
        };

        recognition.current.onend = () => {
          setState(prev => ({ ...prev, isListening: false }));
        };
      } else {
        throw new Error('Speech recognition not supported in this browser');
      }

      // Initialize Audio Context
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();

      // Select optimal voice for personality
      const voice = await elevenLabsClient.current.selectVoiceForPersonality(personality);
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        selectedVoice: voice,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize voice agent';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [personality, onError]);

  // Start listening for user input
  const startListening = useCallback(() => {
    if (!recognition.current || state.isListening) return;

    try {
      setState(prev => ({ ...prev, isListening: true, error: null }));
      recognition.current.start();
    } catch (error) {
      setState(prev => ({ ...prev, isListening: false, error: 'Failed to start listening' }));
    }
  }, [state.isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognition.current && state.isListening) {
      recognition.current.stop();
    }
  }, [state.isListening]);

  // Handle user message
  const handleUserMessage = useCallback((text: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      conversation: [...prev.conversation, message],
    }));

    onMessage?.(message);
  }, [onMessage]);

  // Speak text using ElevenLabs with rate limiting
  const speak = useCallback(async (text: string) => {
    if (!state.selectedVoice || state.isSpeaking) return;

    try {
      setState(prev => ({ ...prev, isSpeaking: true, error: null, rateLimited: false }));

      // Generate speech with user ID for rate limiting
      const audioBuffer = await elevenLabsClient.current.textToSpeech(text, state.selectedVoice.voice_id, {
        userId: userId
      });
      
      // Convert ArrayBuffer to blob and create audio URL
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      // Create message with audio
      const message: ConversationMessage = {
        id: Date.now().toString(),
        text,
        isUser: false,
        timestamp: new Date(),
        audioUrl,
      };

      setState(prev => ({
        ...prev,
        conversation: [...prev.conversation, message],
      }));

      onMessage?.(message);

      // Play audio
      if (currentAudio.current) {
        currentAudio.current.pause();
        URL.revokeObjectURL(currentAudio.current.src);
      }

      currentAudio.current = new Audio(audioUrl);
      currentAudio.current.onended = () => {
        setState(prev => ({ ...prev, isSpeaking: false }));
        URL.revokeObjectURL(audioUrl);
      };

      await currentAudio.current.play();

    } catch (error) {
      if (error instanceof RateLimitError) {
        // Handle rate limiting gracefully
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false, 
          rateLimited: true,
          rateLimitInfo: error.rateLimitInfo
        }));
        onRateLimit?.(error.rateLimitInfo);
        
        // Show a user-friendly message instead of the TTS
        const rateLimitMessage: ConversationMessage = {
          id: Date.now().toString(),
          text: `[Voice temporarily limited: ${error.message}]`,
          isUser: false,
          timestamp: new Date(),
        };
        
        setState(prev => ({
          ...prev,
          conversation: [...prev.conversation, rateLimitMessage],
        }));
        onMessage?.(rateLimitMessage);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
        setState(prev => ({ ...prev, isSpeaking: false, error: errorMessage }));
        onError?.(errorMessage);
      }
    }
  }, [state.selectedVoice, state.isSpeaking, userId, onMessage, onError, onRateLimit]);

  // Check if text would be rate limited (for UI feedback)
  const checkRateLimit = useCallback((text: string) => {
    if (!elevenLabsClient.current) return { isLimited: false };
    return elevenLabsClient.current.checkRateLimit(text.length, userId);
  }, [userId]);

  // Get usage statistics
  const getUsageStats = useCallback(() => {
    if (!elevenLabsClient.current) return null;
    return elevenLabsClient.current.getUsageStats();
  }, []);

  // Add message to conversation (programmatically)
  const addMessage = useCallback((text: string, isUser: boolean = false) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      conversation: [...prev.conversation, message],
    }));

    onMessage?.(message);

    // Auto-speak if it's an AI message
    if (!isUser && autoSpeak) {
      speak(text);
    }
  }, [autoSpeak, speak, onMessage]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      conversation: [],
    }));
  }, []);

  // Stop current speech
  const stopSpeaking = useCallback(() => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, []);

  // Initialize on mount with debouncing
  useEffect(() => {
    // Clear any existing timeout
    if (initializationTimeout.current) {
      clearTimeout(initializationTimeout.current);
    }

    // Debounce initialization to prevent rapid calls
    initializationTimeout.current = setTimeout(() => {
      initialize();
    }, 100);

    return () => {
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
      }
    };
  }, [initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognition.current) {
        recognition.current.stop();
      }
      if (currentAudio.current) {
        currentAudio.current.pause();
        URL.revokeObjectURL(currentAudio.current.src);
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    speak,
    addMessage,
    clearConversation,
    stopSpeaking,
    initialize,
    checkRateLimit,
    getUsageStats,
  };
};

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

export type { ConversationMessage, VoiceAgentState }; 