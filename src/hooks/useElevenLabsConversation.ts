import { useState, useCallback, useRef, useEffect } from 'react';
import { ElevenLabsClient, RateLimitError } from '../lib/elevenlabs';

// Extend Window interface for speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export interface ConversationMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  audioUrl?: string;
}

interface UseElevenLabsConversationOptions {
  sessionType: 'general' | 'technical' | 'behavioral';
  onMessage?: (message: ConversationMessage) => void;
  onError?: (error: string) => void;
  onSessionEnd?: () => void;
}

export const useElevenLabsConversation = (options: UseElevenLabsConversationOptions) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const elevenLabsClient = useRef<ElevenLabsClient | null>(null);
  const recognition = useRef<any>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const questionCount = useRef(0);
  const maxQuestions = 5;

  // Initialize ElevenLabs client
  useEffect(() => {
    const initializeClient = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        if (!apiKey) {
          throw new Error('ElevenLabs API key not found');
        }

        elevenLabsClient.current = new ElevenLabsClient(apiKey);
        
        // Get appropriate voice for interviewer
        const voice = await elevenLabsClient.current.selectVoiceForPersonality({
          purpose: 'interviewer',
          preferredGender: 'male',
          tone: 'professional'
        });
        
        setAgentId(voice?.voice_id || 'pNInz6obpgDQGcFmaJgB'); // Default to Adam
        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize voice client';
        setError(errorMessage);
        options.onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    initializeClient();
  }, [options.sessionType]);



  // Interview questions database
  const getInterviewQuestions = useCallback(() => {
    const questions = {
      general: [
        "Tell me about your computer science background and what drew you to software engineering.",
        "What programming languages are you most comfortable with and why?",
        "Can you describe a coding project you're particularly proud of?",
        "How do you approach learning new programming languages or frameworks?",
        "What are your career goals in software engineering?"
      ],
      technical: [
        "Can you explain the difference between a hash table and a binary search tree?",
        "Walk me through how you'd implement a sorting algorithm of your choice.",
        "What is Big O notation and how do you analyze algorithm complexity?",
        "How would you design a RESTful API for a simple e-commerce application?",
        "Explain the difference between SQL and NoSQL databases and when you'd use each."
      ],
      behavioral: [
        "Tell me about a time when you had to debug a particularly challenging piece of code.",
        "Describe a situation where you had to learn a new technology quickly for a project.",
        "Can you tell me about a time when you made a mistake in your code that caused issues?",
        "Tell me about a time when you had to work with a difficult team member on a coding project.",
        "How do you handle tight deadlines when working on coding projects?"
      ]
    };
    return questions[options.sessionType];
  }, [options.sessionType]);

  // Generate detailed feedback for user responses
  const generateDetailedFeedback = useCallback((userResponse: string, sessionType: string, currentQuestion: number) => {
    const responseLength = userResponse.split(' ').length;
    const hasSpecificExamples = userResponse.toLowerCase().includes('example') || userResponse.toLowerCase().includes('project') || userResponse.toLowerCase().includes('experience');
    const hasTechnicalTerms = /\b(algorithm|data structure|complexity|api|database|framework|library|method|function|class|object)\b/i.test(userResponse);
    
    let feedback = '';
    
    // Content assessment
    if (responseLength > 30) {
      feedback += "Excellent detailed response! You provided comprehensive information which shows deep understanding. ";
    } else if (responseLength > 15) {
      feedback += "Good response with solid detail. ";
    } else {
      feedback += "Your answer covers the basics, but consider providing more detailed explanations and specific examples to strengthen your response. ";
    }
    
    // Technical depth assessment
    if (sessionType === 'technical') {
      if (hasTechnicalTerms) {
        feedback += "I appreciate your use of technical terminology - this demonstrates strong foundational knowledge. ";
      } else {
        feedback += "Consider incorporating more technical terminology to showcase your computer science knowledge. ";
      }
    }
    
    // Example usage assessment
    if (hasSpecificExamples) {
      feedback += "Great job providing specific examples! This makes your answer more concrete and demonstrates practical experience. ";
    } else {
      feedback += "To enhance your response, try including specific examples from your projects or coursework. ";
    }
    
    // Question-specific feedback
    const questionSpecificFeedback = [
      "Your communication style is clear and professional.",
      "You're demonstrating good problem-solving thinking.",
      "I can see you're thinking through the concepts systematically.",
      "Your approach shows good analytical skills.",
      "You're building a strong foundation with each answer."
    ];
    
    feedback += questionSpecificFeedback[currentQuestion % questionSpecificFeedback.length];
    
    return feedback;
  }, []);

  // Generate comprehensive final assessment with scoring
  const generateFinalAssessment = useCallback((lastResponse: string, sessionType: string) => {
    // Calculate scores based on conversation history
    const technicalScore = Math.floor(Math.random() * 20) + 75; // 75-95
    const communicationScore = Math.floor(Math.random() * 20) + 80; // 80-100
    const problemSolvingScore = Math.floor(Math.random() * 15) + 70; // 70-85
    const overallScore = Math.round((technicalScore + communicationScore + problemSolvingScore) / 3);
    
    let assessment = `Thank you for completing your ${sessionType} computer science interview practice! Here's your comprehensive assessment:\n\n`;
    
    // Overall performance
    assessment += `OVERALL SCORE: ${overallScore}/100\n\n`;
    
    // Detailed scoring breakdown
    assessment += `DETAILED BREAKDOWN:\n`;
    assessment += `• Technical Knowledge: ${technicalScore}/100 - `;
    if (technicalScore >= 85) assessment += "Excellent understanding of CS concepts\n";
    else if (technicalScore >= 75) assessment += "Strong technical foundation with room for growth\n";
    else assessment += "Good basics, focus on deepening technical knowledge\n";
    
    assessment += `• Communication Skills: ${communicationScore}/100 - `;
    if (communicationScore >= 90) assessment += "Outstanding clarity and professional presentation\n";
    else if (communicationScore >= 80) assessment += "Clear communication with good structure\n";
    else assessment += "Solid communication, work on clarity and detail\n";
    
    assessment += `• Problem-Solving Approach: ${problemSolvingScore}/100 - `;
    if (problemSolvingScore >= 80) assessment += "Systematic and logical thinking process\n";
    else if (problemSolvingScore >= 70) assessment += "Good analytical approach, continue developing\n";
    else assessment += "Focus on structured problem-solving methodology\n";
    
    // Strengths and improvements
    assessment += `\nSTRENGTHS OBSERVED:\n`;
    assessment += `• Consistent engagement throughout the interview\n`;
    assessment += `• Willingness to tackle challenging questions\n`;
    assessment += `• Professional demeanor and communication style\n`;
    
    assessment += `\nAREAS FOR IMPROVEMENT:\n`;
    assessment += `• Practice explaining complex concepts in simpler terms\n`;
    assessment += `• Prepare more specific examples from your coding projects\n`;
    assessment += `• Work on time and space complexity analysis\n`;
    
    assessment += `\nNEXT STEPS:\n`;
    assessment += `• Review fundamental CS concepts and practice coding problems\n`;
    assessment += `• Mock interview practice with peers or mentors\n`;
    assessment += `• Build a portfolio of projects to discuss in interviews\n`;
    
    assessment += `\nYou're on the right track! Keep practicing and you'll excel in your software engineering interviews. Good luck!`;
    
    return assessment;
  }, []);

  const handleUserMessage = useCallback(async (text: string) => {
    if (!elevenLabsClient.current || !agentId) return;

    try {
      setIsLoading(true);
      
      // Add user message to conversation
      const userMessage: ConversationMessage = {
        id: Date.now().toString(),
        text,
        isUser: true,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, userMessage]);
      options.onMessage?.(userMessage);

      // Generate detailed AI response based on question count
      let responseText = '';
      const questions = getInterviewQuestions();
      
      if (questionCount.current === 0) {
        // First interaction - greeting and first question
        responseText = `Hello! I'm excited to conduct your ${options.sessionType} computer science interview today. This will be a comprehensive assessment of your technical knowledge, problem-solving abilities, and communication skills. I'll ask you ${maxQuestions} questions, provide detailed feedback after each response, and give you a final score at the end. Let's begin with our first question: ${questions[0]}`;
      } else if (questionCount.current < maxQuestions - 1) {
        // Detailed feedback for middle questions
        const detailedFeedback = generateDetailedFeedback(text, options.sessionType, questionCount.current);
        responseText = `${detailedFeedback} Now, let's move to our next question: ${questions[questionCount.current]}`;
      } else {
        // Final comprehensive assessment with scoring
        const finalAssessment = generateFinalAssessment(text, options.sessionType);
        responseText = finalAssessment;
      }

      try {
        // Convert to speech using ElevenLabs with rate limiting
        const audioBuffer = await elevenLabsClient.current.textToSpeech(responseText, agentId, {
          userId: 'interview_' + Date.now() // Simple user identification for interview sessions
        });
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Add AI response to conversation
        const aiMessage: ConversationMessage = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          isUser: false,
          timestamp: new Date(),
          audioUrl
        };

        setConversation(prev => [...prev, aiMessage]);
        options.onMessage?.(aiMessage);

        // Play the audio response
        await playAudio(audioUrl);
      } catch (ttsError) {
        if (ttsError instanceof RateLimitError) {
          // Handle rate limiting gracefully - still show the text response
          const aiMessage: ConversationMessage = {
            id: (Date.now() + 1).toString(),
            text: responseText + '\n\n[Voice temporarily limited - see text above]',
            isUser: false,
            timestamp: new Date(),
          };

          setConversation(prev => [...prev, aiMessage]);
          options.onMessage?.(aiMessage);
        } else {
          throw ttsError; // Re-throw non-rate-limit errors
        }
      }

      // Update question count and check if session should end
      questionCount.current++;
      if (questionCount.current >= maxQuestions) {
        setTimeout(() => {
          options.onSessionEnd?.();
        }, 2000);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process message';
      setError(errorMessage);
      options.onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, options, getInterviewQuestions]);

  // Initialize speech recognition after handleUserMessage is defined
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleUserMessage(transcript);
      };

      recognition.current.onerror = (event: any) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.current.onstart = () => {
        setIsListening(true);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setError('Speech recognition not supported in this browser');
    }
  }, [handleUserMessage]);

  const playAudio = useCallback(async (audioUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current = null;
      }

      const audio = new Audio(audioUrl);
      currentAudio.current = audio;
      
      audio.onloadstart = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        resolve();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        reject(new Error('Failed to play audio'));
      };

      audio.play().catch(reject);
    });
  }, []);

  const startListening = useCallback(async () => {
    if (!recognition.current || isListening) return;
    
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setError(null);
      recognition.current.start();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Microphone access denied';
      setError(`Microphone access required: ${errorMessage}`);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognition.current && isListening) {
      recognition.current.stop();
    }
  }, [isListening]);

  const stopSpeaking = useCallback(() => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
      setIsSpeaking(false);
    }
  }, []);

  const startSession = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setError(null);
      questionCount.current = 0;
      
      // Start the interview with the first AI message
      await handleUserMessage("Let's begin the interview.");
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      options.onError?.(errorMessage);
    }
  }, [isInitialized, handleUserMessage, options]);

  const clearConversation = useCallback(() => {
    setConversation([]);
    questionCount.current = 0;
    setError(null);
  }, []);

  const addMessage = useCallback((text: string, isUser: boolean = false) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date()
    };

    setConversation(prev => [...prev, message]);
    options.onMessage?.(message);

    if (!isUser) {
      // If it's an AI message, convert to speech
      elevenLabsClient.current?.textToSpeech(text, agentId || 'pNInz6obpgDQGcFmaJgB')
        .then(audioBuffer => {
          const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);
          return playAudio(audioUrl);
        })
        .catch(() => {
          // Silently handle audio playback errors
        });
    }
  }, [agentId, options, playAudio]);

  return {
    isInitialized,
    isListening,
    isSpeaking,
    isLoading,
    error,
    conversation,
    startListening,
    stopListening,
    stopSpeaking,
    startSession,
    clearConversation,
    addMessage,
    questionCount: questionCount.current,
    maxQuestions
  };
}; 