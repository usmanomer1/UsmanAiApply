import { useState, useCallback, useRef, useEffect } from 'react';
import { createElevenLabsClient, ElevenLabsClient } from '../lib/elevenlabs';

interface VoiceGuideStep {
  id: string;
  title: string;
  prompt: string;
  field: string;
  type: 'text' | 'email' | 'password' | 'phone' | 'select' | 'textarea';
  options?: string[];
  validation?: (value: string) => boolean;
  required?: boolean;
}

interface ConversationMessage {
  id: string;
  type: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

const CONFIGURATION_STEPS: VoiceGuideStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    prompt: "Welcome to your LinkedIn automation setup! I'm your AI assistant, and I'll help you configure your LinkedIn bot step by step. Let's start by setting up your LinkedIn credentials. What's your LinkedIn email address?",
    field: 'linkedinEmail',
    type: 'email',
    required: true,
    validation: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },
  {
    id: 'password',
    title: 'LinkedIn Password',
    prompt: "Great! Now I need your LinkedIn password. Don't worry - this information is stored securely and only used for automation. Please provide your LinkedIn password.",
    field: 'linkedinPassword',
    type: 'password',
    required: true
  },
  {
    id: 'phone',
    title: 'Phone Number',
    prompt: "Perfect! Now let's add your phone number for job applications. This helps employers contact you directly. Please tell me your phone number, including the country code.",
    field: 'contactNumber',
    type: 'phone',
    validation: (value) => {
      // Accept various phone number formats - be very flexible
      const cleaned = value.trim();
      // Must contain at least 7 digits and only valid phone characters
      const hasEnoughDigits = (cleaned.match(/\d/g) || []).length >= 7;
      const onlyValidChars = /^[\+\d\s\-\(\)]+$/.test(cleaned);
      return hasEnoughDigits && onlyValidChars && cleaned.length >= 7;
    }
  },
  {
    id: 'resume',
    title: 'Resume Name',
    prompt: "Excellent! What's the name of the resume you'd like to use for applications? This should match the name of your resume file uploaded to LinkedIn.",
    field: 'linkedinResume',
    type: 'text'
  },
  {
    id: 'jobTitle',
    title: 'Job Title',
    prompt: "Now let's define your job search criteria. What job title or position are you looking for? For example, 'Software Engineer', 'Product Manager', or 'Data Scientist'.",
    field: 'jobTitle',
    type: 'text',
    required: true
  },
  {
    id: 'location',
    title: 'Location Preference',
    prompt: "Where would you like to work? You can specify a city like 'San Francisco', 'New York', 'Remote', or 'London'. What's your preferred work location?",
    field: 'location',
    type: 'text',
    required: true
  },
  {
    id: 'experience',
    title: 'Experience Level',
    prompt: "What's your experience level? Please choose from: Entry Level, Mid Level, Senior Level, or Executive Level.",
    field: 'experience',
    type: 'select',
    options: ['Entry Level', 'Mid Level', 'Senior Level', 'Executive Level'],
    required: true
  },
  {
    id: 'workType',
    title: 'Work Type Preference',
    prompt: "Do you prefer Remote work, On-site work, or are you open to Hybrid arrangements? Please specify your work type preference.",
    field: 'remotePreference',
    type: 'select',
    options: ['Remote', 'On-site', 'Hybrid'],
    required: true
  },
  {
    id: 'targetCount',
    title: 'Application Target',
    prompt: "How many job applications would you like to submit? I recommend starting with 10-20 applications to test the system. What's your target number?",
    field: 'targetCount',
    type: 'text',
    required: true,
    validation: (value) => !isNaN(Number(value)) && Number(value) > 0
  },
  {
    id: 'customInstructions',
    title: 'Custom Instructions',
    prompt: "Finally, do you have any specific preferences or instructions for your job search? For example, 'Focus on startups', 'Avoid companies requiring travel', or 'Prioritize work-life balance'. This is optional but helps personalize your search.",
    field: 'customInstructions',
    type: 'textarea'
  },
  {
    id: 'completion',
    title: 'Setup Complete',
    prompt: "Fantastic! Your LinkedIn automation is now configured and ready to go. I've saved all your preferences. You can start your job search automation whenever you're ready. Would you like me to explain how to start the automation, or do you have any questions about the setup?",
    field: '',
    type: 'text'
  }
];

// Helper function to clean up speech recognition artifacts
const cleanupSpeechInput = (input: string, stepType: string): string => {
  let cleaned = input.trim();
  
  if (stepType === 'phone') {
    // Convert spoken words to symbols and numbers for phone numbers
    cleaned = cleaned
      .replace(/\bplus\b/gi, '+')
      .replace(/\bminus\b/gi, '-')
      .replace(/\bdash\b/gi, '-')
      .replace(/\bhyphen\b/gi, '-')
      .replace(/\bopen paren\b/gi, '(')
      .replace(/\bopen parenthesis\b/gi, '(')
      .replace(/\bclose paren\b/gi, ')')
      .replace(/\bclose parenthesis\b/gi, ')')
      .replace(/\bleft paren\b/gi, '(')
      .replace(/\bright paren\b/gi, ')')
      .replace(/\bspace\b/gi, ' ')
      .replace(/\bzero\b/gi, '0')
      .replace(/\bone\b/gi, '1')
      .replace(/\btwo\b/gi, '2')
      .replace(/\bthree\b/gi, '3')
      .replace(/\bfour\b/gi, '4')
      .replace(/\bfive\b/gi, '5')
      .replace(/\bsix\b/gi, '6')
      .replace(/\bseven\b/gi, '7')
      .replace(/\beight\b/gi, '8')
      .replace(/\bnine\b/gi, '9');
    
    // Remove extra spaces between digits
    cleaned = cleaned.replace(/(\d)\s+(\d)/g, '$1$2');
    
    // Clean up common phone number patterns
    cleaned = cleaned
      .replace(/\s*\+\s*/g, '+') // Clean up spaces around +
      .replace(/\s*\(\s*/g, '(') // Clean up spaces around (
      .replace(/\s*\)\s*/g, ')') // Clean up spaces around )
      .replace(/\s*-\s*/g, '-')  // Clean up spaces around -
      .replace(/\s{2,}/g, ' ')   // Replace multiple spaces with single space
      .trim();
  } else if (stepType === 'email') {
    // Clean up email-related speech artifacts
    cleaned = cleaned
      .replace(/\bat symbol\b/gi, '@')
      .replace(/\bat sign\b/gi, '@')
      .replace(/\bat\b/gi, '@')
      .replace(/\bdot\b/gi, '.')
      .replace(/\bperiod\b/gi, '.')
      .replace(/\bcom\b/gi, 'com')
      .replace(/\borg\b/gi, 'org')
      .replace(/\bnet\b/gi, 'net')
      .replace(/\bedu\b/gi, 'edu')
      .replace(/\s+/g, '') // Remove all spaces from email
      .toLowerCase();
  } else if (stepType === 'text' || stepType === 'textarea') {
    // For text fields, just clean up extra spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  }
  
  return cleaned;
};

export const useLinkedInVoiceGuide = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configData, setConfigData] = useState<Record<string, string>>({});
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientRef = useRef<ElevenLabsClient | null>(null);

  const currentStep = CONFIGURATION_STEPS[currentStepIndex];

  // Initialize ElevenLabs client
  useEffect(() => {
    try {
      clientRef.current = createElevenLabsClient();
    } catch (error) {
      console.error('Failed to initialize ElevenLabs client:', error);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionClass();
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onresult = handleSpeechResult;
        recognitionRef.current.onerror = handleSpeechError;
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  const handleSpeechResult = useCallback((event: any) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) {
      handleUserResponse(transcript);
    }
  }, [currentStepIndex]);

  const handleSpeechError = useCallback((event: any) => {
    console.error('Speech recognition error:', event.error);
    setIsListening(false);
    
    if (event.error === 'not-allowed') {
      addMessage('assistant', "I couldn't access your microphone. Please check your browser permissions and try again, or you can type your response instead.");
    } else if (event.error === 'no-speech') {
      addMessage('assistant', "I didn't catch that. Could you please repeat your response? You can also click the microphone button to try again or use the keyboard icon to type.");
    } else if (event.error === 'network') {
      addMessage('assistant', "There was a network issue. Please try speaking again or use the text input option.");
    } else {
      addMessage('assistant', "I had trouble understanding. Please try again or use the keyboard option to type your response.");
    }
  }, []);

  const addMessage = useCallback((type: 'assistant' | 'user', content: string, audioUrl?: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      audioUrl
    };
    
    setConversation(prev => [...prev, message]);
    return message;
  }, []);

  const speakMessage = useCallback(async (text: string): Promise<string | null> => {
    try {
      if (!clientRef.current) {
        console.error('ElevenLabs client not initialized');
        return null;
      }

      setIsSpeaking(true);
      setIsLoading(true);
      
      // Get a suitable voice for professional guidance
      const voice = await clientRef.current.selectVoiceForPersonality({
        purpose: 'assistant',
        preferredGender: 'female',
        preferredAccent: 'American',
        tone: 'professional, helpful'
      });
      
      if (!voice) {
        throw new Error('No suitable voice found');
      }

      const audioBuffer = await clientRef.current.textToSpeech(text, voice.voice_id, {
        model: 'eleven_flash_v2_5'
      });
      
      // Convert ArrayBuffer to blob URL
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        
        return new Promise((resolve) => {
          if (audioRef.current) {
            audioRef.current.onended = () => {
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl); // Clean up blob URL
              resolve(audioUrl);
            };
            audioRef.current.onerror = () => {
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl);
              resolve(null);
            };
            audioRef.current.play().catch(() => {
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl);
              resolve(null);
            });
          }
        });
      }
      
      return audioUrl;
    } catch (error) {
      console.error('Error speaking message:', error);
      setIsSpeaking(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUserResponse = useCallback(async (response: string) => {
    setIsListening(false);
    
    // Add user message to conversation
    addMessage('user', response);
    
    const lowerResponse = response.toLowerCase().trim();
    
    // Handle special commands
    if (lowerResponse.includes('go back') || lowerResponse.includes('previous') || lowerResponse.includes('back')) {
      await goToPreviousStep();
      return;
    }
    
    if (lowerResponse.includes('repeat') || lowerResponse.includes('say that again') || lowerResponse.includes('what was the question')) {
      await replayLastMessage();
      return;
    }
    
    if (lowerResponse.includes('skip') && currentStepIndex < CONFIGURATION_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      const nextStep = CONFIGURATION_STEPS[nextIndex];
      const skipMessage = `Okay, I'll skip that for now. ${nextStep.prompt}`;
      const audioUrl = await speakMessage(skipMessage);
      addMessage('assistant', skipMessage, audioUrl || undefined);
      return;
    }
    
    // Handle step navigation commands
    if (lowerResponse.includes('go to phone') || lowerResponse.includes('phone step') || lowerResponse.includes('phone number step')) {
      const phoneStepIndex = CONFIGURATION_STEPS.findIndex(step => step.id === 'phone');
      if (phoneStepIndex !== -1) {
        setCurrentStepIndex(phoneStepIndex);
        const phoneStep = CONFIGURATION_STEPS[phoneStepIndex];
        const jumpMessage = `Sure! Let's go to the phone number step. ${phoneStep.prompt}`;
        const audioUrl = await speakMessage(jumpMessage);
        addMessage('assistant', jumpMessage, audioUrl || undefined);
        return;
      }
    }
    
    if (lowerResponse.includes('restart') || lowerResponse.includes('start over') || lowerResponse.includes('begin again')) {
      setCurrentStepIndex(0);
      setConfigData({});
      const welcomeStep = CONFIGURATION_STEPS[0];
      const restartMessage = `Okay, let's start over. ${welcomeStep.prompt}`;
      const audioUrl = await speakMessage(restartMessage);
      addMessage('assistant', restartMessage, audioUrl || undefined);
      return;
    }
    
    // Validate and process response
    const step = CONFIGURATION_STEPS[currentStepIndex];
    console.log(`DEBUG: Processing step ${currentStepIndex} (${step.id}), type: ${step.type}, field: ${step.field}, response: "${response}"`);
    
    // Clean up speech recognition artifacts based on step type
    let processedResponse = cleanupSpeechInput(response.trim(), step.type);
    console.log(`DEBUG: Cleaned response: "${processedResponse}"`);
    
    let isValid = true;
    let validationMessage = '';

    // Process response based on step type
    if (step.type === 'select' && step.options) {
      const matchedOption = step.options.find(option => 
        option.toLowerCase().includes(processedResponse.toLowerCase()) ||
        processedResponse.toLowerCase().includes(option.toLowerCase())
      );
      
      if (matchedOption) {
        processedResponse = matchedOption;
      } else {
        isValid = false;
        validationMessage = `Please choose from: ${step.options.join(', ')}`;
      }
    }

    // Apply validation if provided
    if (step.validation && !step.validation(processedResponse)) {
      isValid = false;
      console.log(`DEBUG: Validation failed for step ${step.id} (${step.type}) with processed response: "${processedResponse}"`);
      if (step.type === 'email') {
        validationMessage = 'Please provide a valid email address.';
      } else if (step.type === 'phone') {
        validationMessage = 'Please provide a valid phone number with country code (e.g., +1 555-123-4567).';
      } else if (step.field === 'targetCount') {
        validationMessage = 'Please provide a valid number greater than 0.';
      } else {
        validationMessage = 'Please provide a valid response.';
      }
      console.log(`DEBUG: Validation message: ${validationMessage}`);
    } else {
      console.log(`DEBUG: Validation passed for step ${step.id} (${step.type}) with processed response: "${processedResponse}"`);
    }

    if (!isValid) {
      let retryMessage = '';
      
      if (step.type === 'email') {
        retryMessage = `I need a valid email address. Please provide your LinkedIn email in the format like john@company.com`;
      } else if (step.type === 'phone') {
        retryMessage = `I need a valid phone number. Please provide your phone number with country code, like +1 555-123-4567 or +44 20 7946 0958`;
      } else if (step.field === 'targetCount') {
        retryMessage = `Please provide a valid number of applications, like 10 or 20.`;
      } else if (step.type === 'select' && step.options) {
        retryMessage = `${validationMessage}. Which one would you like to choose?`;
      } else {
        retryMessage = `${validationMessage} Could you please provide that information again?`;
      }
      
      console.log(`DEBUG: Sending retry message: "${retryMessage}"`);
      const audioUrl = await speakMessage(retryMessage);
      addMessage('assistant', retryMessage, audioUrl || undefined);
      return; // Stay on the same step, don't advance
    }

    // Save valid response
    if (step.field) {
      setConfigData(prev => ({ ...prev, [step.field]: processedResponse }));
      console.log(`DEBUG: Saved ${step.field} = "${processedResponse}"`);
    }

    // Move to next step or complete
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < CONFIGURATION_STEPS.length) {
      setCurrentStepIndex(nextIndex);
      const nextStep = CONFIGURATION_STEPS[nextIndex];
      console.log(`DEBUG: Moving to step ${nextIndex} (${nextStep.id}) - ${nextStep.type}`);
      const audioUrl = await speakMessage(nextStep.prompt);
      addMessage('assistant', nextStep.prompt, audioUrl || undefined);
    } else {
      // Configuration complete
      console.log(`DEBUG: Voice guide completed successfully`);
      const completionMessage = "Perfect! Your LinkedIn automation setup is now complete. You can review your settings and start the automation whenever you're ready.";
      const audioUrl = await speakMessage(completionMessage);
      addMessage('assistant', completionMessage, audioUrl || undefined);
      setIsActive(false);
    }
  }, [currentStepIndex, speakMessage, addMessage]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      addMessage('assistant', "Speech recognition is not supported in your browser. Please type your response instead.");
      return;
    }

    try {
      setIsListening(true);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      recognitionRef.current.start();
      
      // Auto-stop after 10 seconds
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current && isListening) {
          recognitionRef.current.stop();
        }
      }, 10000);
      
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
      addMessage('assistant', "I couldn't access your microphone. Please check your permissions and try again.");
    }
  }, [isListening, addMessage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsListening(false);
  }, [isListening]);

  const startVoiceGuide = useCallback(async () => {
    setIsActive(true);
    setCurrentStepIndex(0);
    setConversation([]);
    setConfigData({});
    
    const welcomeStep = CONFIGURATION_STEPS[0];
    console.log(`DEBUG: Starting voice guide with step 0 (${welcomeStep.id}) - ${welcomeStep.type}`);
    const audioUrl = await speakMessage(welcomeStep.prompt);
    addMessage('assistant', welcomeStep.prompt, audioUrl || undefined);
  }, [speakMessage, addMessage]);

  const stopVoiceGuide = useCallback(() => {
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [isListening]);

  const skipToStep = useCallback(async (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < CONFIGURATION_STEPS.length) {
      setCurrentStepIndex(stepIndex);
      const step = CONFIGURATION_STEPS[stepIndex];
      const audioUrl = await speakMessage(step.prompt);
      addMessage('assistant', step.prompt, audioUrl || undefined);
    }
  }, [speakMessage, addMessage]);

  const goToPreviousStep = useCallback(async () => {
    if (currentStepIndex > 0) {
      const previousIndex = currentStepIndex - 1;
      setCurrentStepIndex(previousIndex);
      const step = CONFIGURATION_STEPS[previousIndex];
      const goBackMessage = `Let me take you back to the previous step. ${step.prompt}`;
      const audioUrl = await speakMessage(goBackMessage);
      addMessage('assistant', goBackMessage, audioUrl || undefined);
    }
  }, [currentStepIndex, speakMessage, addMessage]);

  const replayLastMessage = useCallback(async () => {
    const lastAssistantMessage = [...conversation].reverse().find(msg => msg.type === 'assistant');
    if (lastAssistantMessage) {
      const audioUrl = await speakMessage(lastAssistantMessage.content);
      // Update the message with new audio URL if needed
      if (audioUrl) {
        setConversation(prev => prev.map(msg => 
          msg.id === lastAssistantMessage.id 
            ? { ...msg, audioUrl }
            : msg
        ));
      }
    }
  }, [conversation, speakMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return {
    // State
    isActive,
    currentStep,
    currentStepIndex,
    conversation,
    isListening,
    isSpeaking,
    isLoading,
    configData,
    totalSteps: CONFIGURATION_STEPS.length,
    
    // Actions
    startVoiceGuide,
    stopVoiceGuide,
    startListening,
    stopListening,
    handleUserResponse,
    skipToStep,
    goToPreviousStep,
    replayLastMessage,
    
    // Audio element ref for external control
    audioRef
  };
}; 