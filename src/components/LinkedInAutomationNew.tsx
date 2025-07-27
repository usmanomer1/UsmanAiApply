import React, { useState, useEffect, useRef } from 'react';
import { Settings, Send, Bot, AlertCircle, Loader2, CheckCircle, XCircle, Info, RefreshCw, ExternalLink, Pause, Play, Square, ArrowRight, Github, FileSpreadsheet, TrendingUp, Gamepad2, X, Briefcase, MapPin, Building2, Clock, Users, Bug } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { linkedInJobSearchApi, JobSearchConfig, Job, AutomationMetrics, SessionStatus, AppliedJob, setDebugMode, isDebugMode } from '../lib/linkedInJobSearchApi';
import LinkedInConfigModal from './LinkedInConfigModal';
import { supabase } from '../lib/supabase';

interface AutomationConfig {
  socialLinks: Array<{ id: string; title: string; url: string; icon?: string }>;
  resumeUrl?: string;
  resumeMetadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  externalApplicationConfig: {
    pauseOnAccountCreation: boolean;
    autoCreateAccount: boolean;
    defaultEmail?: string;
    defaultPassword?: string;
  };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'info' | 'error' | 'success' | 'warning' | 'step';
  message: string;
  timestamp: Date;
  status?: 'WAIT' | 'MESSAGE' | 'RUNNING' | 'COMPLETE';
  stepNumber?: number;
  metadata?: {
    status?: string;
    progress?: SessionStatus['progress'];
    intervention?: SessionStatus['intervention'];
    showContinueButton?: boolean;
  };
}

export default function LinkedInAutomationNew() {
  const { user } = useAuth();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [showIntervention, setShowIntervention] = useState(false);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [hasLinkedInContext, setHasLinkedInContext] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00');
  const [isInChatMode, setIsInChatMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [debugMode, setDebugModeState] = useState(isDebugMode());
  const [lastInterventionType, setLastInterventionType] = useState<string | null>(null);
  const [lastStatusMessage, setLastStatusMessage] = useState<string | null>(null);
  const [hasShownInitialRunningMessage, setHasShownInitialRunningMessage] = useState(false);
  // Filter states
  const [filters, setFilters] = useState({
    easyApplyOnly: false,
    remote: false,
    datePosted: null as 'day' | 'week' | 'month' | null,
    under10Applicants: false
  });
  const [userResume, setUserResume] = useState<{ id: string; url: string; metadata: any } | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [jobsFound, setJobsFound] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<AutomationMetrics>({});
  const stopPollingRef = useRef<(() => void) | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false); // Prevent double API calls in StrictMode

  // Preset action cards for job search
  const actionCards = [
    {
      icon: <Briefcase className="w-5 h-5" />,
      title: "Software Engineering Jobs",
      description: "Apply to developer positions automatically",
      prompt: "software engineer jobs in San Francisco"
    },
    {
      icon: <MapPin className="w-5 h-5" />,
      title: "Remote Tech Roles",
      description: "Find and apply to remote opportunities",
      prompt: "remote senior developer positions with React experience"
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: "Startup Positions",
      description: "Target early-stage startup roles",
      prompt: "software engineer at startups in Bay Area"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Tech Lead Roles",
      description: "Apply to leadership positions",
      prompt: "tech lead or engineering manager positions"
    }
  ];

  useEffect(() => {
    // Load saved config
    const savedConfig = localStorage.getItem(`linkedin-config-${user?.id}`);
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    // Check if user has LinkedIn context
    const hasContext = localStorage.getItem(`linkedin-context-${user?.id}`);
    setHasLinkedInContext(hasContext === 'true');
    
    // Show onboarding for first-time users
    if (hasContext === null && user) {
      setShowOnboarding(true);
    }
    
    // Load user profile and resume
    if (user) {
      loadUserProfile();
      loadUserResume();
    }
  }, [user]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    // Update session duration
    if (sessionStartTime && sessionId) {
      const updateDuration = () => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        setSessionDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      };
      
      updateDuration();
      durationIntervalRef.current = setInterval(updateDuration, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [sessionStartTime, sessionId]);

  useEffect(() => {
    // Check if intervention is required
    if (sessionStatus?.status === 'intervention_required' && sessionStatus.intervention) {
      if (!showIntervention) {
        setShowIntervention(true);
      }
    } else if (sessionStatus?.status !== 'intervention_required' && showIntervention) {
      setShowIntervention(false);
    }
  }, [sessionStatus, showIntervention]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const addChatMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setChatMessages(prev => {
      // Check if we just added an identical message (within last 3 seconds)
      const recentMessages = prev.slice(-5); // Check last 5 messages
      const now = new Date();
      
      for (const recentMsg of recentMessages) {
        const timeDiff = now.getTime() - recentMsg.timestamp.getTime();
        
        // If we find an identical message within the last 3 seconds, skip adding it
        if (timeDiff < 3000 && 
            recentMsg.type === message.type && 
            recentMsg.message === message.message &&
            recentMsg.status === message.status) {
          console.log('[FRONTEND] Skipping duplicate message:', message.message);
          return prev;
        }
      }
      
      return [...prev, {
        ...message,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: now
      }];
    });
  };

  // Load user profile from Supabase
  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load user resume from Supabase storage
  const loadUserResume = async () => {
    if (!user) return;
    
    try {
      // First get the resume metadata from the profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('resume_url, resume_text')
        .eq('id', user.id)
        .single();
      
      if (profileError || !profile?.resume_url) {
        console.log('No resume found for user');
        return;
      }
      
      // Get the file metadata
      const fileName = profile.resume_url.split('/').pop() || 'resume.pdf';
      
      setUserResume({
        id: `resume-${user.id}`,
        url: profile.resume_url,
        metadata: {
          fileName,
          fileType: 'application/pdf',
          extractedText: profile.resume_text
        }
      });
    } catch (error) {
      console.error('Error loading user resume:', error);
    }
  };

  // Clear any stored session on mount - always start fresh
  useEffect(() => {
    console.log('[FRONTEND] Component mounted, clearing any previous state');
    localStorage.removeItem('activeSessionId');
    setSessionId(null);
    setIsInChatMode(false);
    setSessionStatus(null);
    setLiveViewUrl(null);
    
    // Reset the starting ref on mount
    isStartingRef.current = false;
    
    // Cleanup function to reset state if component unmounts while starting
    return () => {
      console.log('[FRONTEND] Component unmounting');
      if (isStartingRef.current) {
        console.log('[FRONTEND] Component unmounting while start in progress, resetting ref');
        isStartingRef.current = false;
      }
    };
  }, []);

  // Debug logging for session tracking
  useEffect(() => {
    console.log('[FRONTEND DEBUG] Session info:', {
      sessionId,
      liveViewUrl,
      timestamp: new Date().toISOString()
    });
  }, [sessionId, liveViewUrl]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
    };
  }, []);

  // Centralized status update handler
  const handleStatusUpdate = (status: SessionStatus) => {
    const prevStatus = sessionStatus?.status;
    const prevIntervention = sessionStatus?.intervention;
    setSessionStatus(status);
    
    // Update live view URL if provided
    if (status.liveViewUrl) {
      setLiveViewUrl(status.liveViewUrl);
    }
    
    // Check if we transitioned from intervention to running (successful login)
    if (prevStatus === 'intervention_required' && status.status === 'running' && hasLinkedInContext === false) {
      // First successful login - mark context as created
      localStorage.setItem(`linkedin-context-${user?.id}`, 'true');
      setHasLinkedInContext(true);
      addChatMessage({
        type: 'success',
        message: 'Great! Your LinkedIn account is now connected. Future sessions will start automatically without requiring login.',
        status: 'COMPLETE'
      });
    }
    
    // Only add status messages when status actually changes
    if (prevStatus !== status.status) {
      if (status.status === 'running') {
        // Different messages based on previous state
        let message = '';
        
        if (!prevStatus && !hasShownInitialRunningMessage) {
          // Skip the initial running message since we already showed it
          setHasShownInitialRunningMessage(true);
          return;
        } else if (prevStatus === 'intervention_required') {
          message = 'Action completed! Resuming automation...';
        } else if (prevStatus === 'paused') {
          message = 'Automation resumed';
        } else {
          return;
        }
        
        if (message) {
          setCurrentStep(prev => prev + 1);
          addChatMessage({ 
            type: 'step', 
            message, 
            stepNumber: currentStep + 1,
            status: 'RUNNING',
            metadata: { status: status.status }
          });
        }
      } else if (status.status === 'completed') {
        addChatMessage({
          type: 'success',
          message: `Completed! Applied to ${status.progress.totalApplications} job${status.progress.totalApplications !== 1 ? 's' : ''}.`,
          status: 'COMPLETE',
          metadata: { status: status.status, progress: status.progress }
        });
        if (sessionId) {
          loadAppliedJobs(sessionId);
        }
        // Clear stored session
        localStorage.removeItem('activeSessionId');
      } else if (status.status === 'failed') {
        addChatMessage({
          type: 'error',
          message: 'Automation failed. Please try again.',
          status: 'COMPLETE',
          metadata: { status: status.status }
        });
        // Clear stored session
        localStorage.removeItem('activeSessionId');
      } else if (status.status === 'paused') {
        addChatMessage({
          type: 'system',
          message: 'Automation paused',
          status: 'WAIT',
          metadata: { status: status.status }
        });
      }
    }
    
    // Handle intervention changes separately
    if (status.status === 'intervention_required' && 
        JSON.stringify(prevIntervention) !== JSON.stringify(status.intervention)) {
      const interventionMessage = getInterventionMessage(status.intervention);
      const isLogin = status.intervention?.type === 'login';
      
      addChatMessage({
        type: 'warning',
        message: interventionMessage,
        status: 'WAIT',
        metadata: { 
          intervention: status.intervention,
          showContinueButton: true
        }
      });
      
      if (isLogin && hasLinkedInContext === false) {
        addChatMessage({
          type: 'info',
          message: '💡 One-time setup: After you log in, we\'ll save your session for all future automations.',
          status: 'MESSAGE'
        });
      }
    }
    
    // Add progress updates only if running and applications have increased
    if (status.status === 'running' && status.progress.totalApplications > 0) {
      const currentCount = status.progress.totalApplications;
      const prevCount = sessionStatus?.progress?.totalApplications || 0;
      
      // Only show progress update if count increased
      if (currentCount > prevCount) {
        setCurrentStep(prev => prev + 1);
        addChatMessage({
          type: 'step',
          message: `Applied to ${currentCount} job${currentCount !== 1 ? 's' : ''} so far...`,
          stepNumber: currentStep + 1,
          status: 'MESSAGE',
          metadata: { progress: status.progress }
        });
      }
    }
  };

  // Helper function to get intervention-specific messages
  const getInterventionMessage = (intervention?: SessionStatus['intervention']) => {
    if (!intervention) return 'Action required';
    
    switch (intervention.type) {
      case 'login':
        return 'Please log in to LinkedIn in the browser window';
      case 'captcha':
        return 'Please complete the security check (CAPTCHA)';
      case 'two_fa':
        return 'Please complete two-factor authentication';
      case 'blocked':
        return 'Your account appears to be restricted. Please check LinkedIn for security notifications.';
      case 'rate_limit':
        return 'Rate limit detected. Please wait a few minutes before continuing.';
      default:
        return intervention.message || 'Manual action required';
    }
  };

  const handleStart = async () => {
    if (!searchPrompt.trim()) {
      // Show error in UI, not as alert
      return;
    }

    if (!config && !userResume) {
      // Show error in UI, not as alert
      return;
    }

    // Multiple layers of duplicate prevention
    console.log(`[FRONTEND] handleStart called at ${new Date().toISOString()}`);
    console.log(`[FRONTEND] Current state:`, {
      isStartingRef: isStartingRef.current,
      isStarting,
      sessionId,
      isInChatMode
    });
    
    // 1. Check if we already have an active session
    if (sessionId) {
      console.warn('[FRONTEND] Already have an active session, ignoring start request');
      return;
    }
    
    // 2. Check the ref (for React StrictMode and rapid clicks)
    if (isStartingRef.current) {
      console.warn('[FRONTEND] Start already in progress (ref check), ignoring duplicate call');
      return;
    }
    
    // 3. Check the state (belt and suspenders)
    if (isStarting) {
      console.warn('[FRONTEND] Start already in progress (state check), ignoring duplicate call');
      return;
    }
    
    // Set both ref and state immediately
    isStartingRef.current = true;
    setIsStarting(true);
    
    console.log('[FRONTEND] All checks passed, proceeding with start');

    setIsInChatMode(true);
    setChatMessages([]); // Clear previous messages
    setSessionStartTime(new Date());
    setCurrentStep(0);
    setJobsFound([]);
    setMetrics({});
    setSessionId(null); // Clear any previous session
    setSessionStatus(null);
    setAppliedJobs([]);
    setLastInterventionType(null); // Reset intervention tracking
    setLastStatusMessage(null); // Reset status message tracking
    setHasShownInitialRunningMessage(false); // Reset initial message tracking
    localStorage.removeItem('activeSessionId'); // Clear any stored session
    
    // Add initial messages
    addChatMessage({
      type: 'user',
      message: searchPrompt.trim(),
      status: 'MESSAGE'
    });

    addChatMessage({
      type: 'step',
      message: 'Initializing job search automation...',
      stepNumber: 1,
      status: 'WAIT'
    });

    try {
      // Check context status first
      const contextStatus = await linkedInJobSearchApi.checkContextStatus();
      setHasLinkedInContext(contextStatus.hasContext);
      
      if (!contextStatus.hasContext) {
        addChatMessage({
          type: 'info',
          message: 'First time setup: You\'ll need to log in to LinkedIn once. After that, all future sessions will be automatic!',
          status: 'MESSAGE'
        });
      }
      
      // Build job search config
      const jobSearchConfig: JobSearchConfig = {
        searchPrompt: searchPrompt.trim(),
        maxApplications: 50,
        // Only include filters that are enabled
        ...(filters.easyApplyOnly && { easyApplyOnly: true }),
        ...(filters.remote && { remote: true }),
        ...(filters.datePosted && { datePosted: filters.datePosted }),
        ...(filters.under10Applicants && { under10Applicants: true }),
        // Include resume if available
        ...(userResume && {
          resumeId: userResume.id,
          resumeUrl: userResume.url,
          resumeMetadata: userResume.metadata
        }),
        // Include profile links if available
        ...(config?.socialLinks && {
          profileLinks: {
            github: config.socialLinks.find(l => l.title === 'GitHub')?.url,
            linkedin: config.socialLinks.find(l => l.title === 'LinkedIn')?.url,
            portfolio: config.socialLinks.find(l => l.title === 'Portfolio')?.url,
          }
        })
      };
      
      // Start job search
      const apiCallTimestamp = new Date().toISOString();
      console.log(`[${apiCallTimestamp}] Starting job search API call`);
      console.log(`[${apiCallTimestamp}] User ID:`, user!.id);
      console.log(`[${apiCallTimestamp}] Config:`, jobSearchConfig);
      
      const result = await linkedInJobSearchApi.startJobSearch(user!.id, jobSearchConfig);
      
      const responseTimestamp = new Date().toISOString();
      console.log(`[${responseTimestamp}] Session created:`, result.sessionId);
      console.log(`[${responseTimestamp}] Time taken:`, new Date(responseTimestamp).getTime() - new Date(apiCallTimestamp).getTime(), 'ms');
      console.log('[FRONTEND DEBUG] Full API response:', {
        sessionId: result.sessionId,
        liveViewUrl: result.liveViewUrl,
        browserbaseSessionId: result.browserbaseSessionId,
        status: result.status,
        taskId: result.taskId,
        timestamp: new Date().toISOString()
      });

      setSessionId(result.sessionId);
      setLiveViewUrl(result.liveViewUrl);
      
      // Don't store session - always start fresh
      
      setCurrentStep(2);
      addChatMessage({
        type: 'step',
        message: contextStatus.hasContext 
          ? 'Connected to LinkedIn. Starting job search...' 
          : 'Launching browser and navigating to LinkedIn...',
        stepNumber: 2,
        status: 'RUNNING'
      });

      // Start polling for status updates
      startPollingStatus(result.sessionId);
      
    } catch (error: any) {
      addChatMessage({
        type: 'error',
        message: `Error: ${error.message || 'Failed to start automation'}`,
        status: 'COMPLETE'
      });
      setIsInChatMode(false);
    } finally {
      setIsStarting(false);
      // Reset the ref after a delay to allow legitimate retries
      setTimeout(() => {
        isStartingRef.current = false;
      }, 1000);
    }
  };

  // Start polling for status updates
  const startPollingStatus = (sessionId: string) => {
    // Clear any existing polling
    if (stopPollingRef.current) {
      stopPollingRef.current();
    }

    // Poll every 3 seconds as recommended in the guide
    stopPollingRef.current = linkedInJobSearchApi.pollStatus(
      sessionId,
      (status) => {
        handleStatusUpdate(status);
        
        // Process status-specific updates
        if (status.intervention && status.intervention.required) {
          setShowIntervention(true);
          
          // Only add intervention message if it's a new intervention type
          if (status.intervention.type !== lastInterventionType) {
            setLastInterventionType(status.intervention.type);
            
            // Customize message based on intervention type
            let interventionMessage = status.intervention.message;
            if (status.intervention.type === 'LOGIN') {
              interventionMessage = 'Please log in to your LinkedIn account in the browser window above. Once you\'ve successfully logged in, click the continue button below.';
            }
            
            addChatMessage({
              type: 'warning',
              message: interventionMessage,
              status: 'WAIT',
              metadata: {
                intervention: status.intervention,
                showContinueButton: true
              }
            });
          }
        } else {
          // Clear intervention type when no intervention is required
          if (lastInterventionType) {
            setLastInterventionType(null);
          }
        }
        
        // Handle completion
        if (status.status === 'completed') {
          if (stopPollingRef.current) {
            stopPollingRef.current();
          }
          localStorage.removeItem('activeSessionId');
        }
      },
      3000 // Poll every 3 seconds
    );
  };

  // Legacy WebSocket handlers (commented out - using polling instead)
  /*
  const setupWebSocketHandlers = () => {
    // Agent reasoning updates
    linkedInJobSearchApi.onWebSocketEvent('agent:step:realtime', (data: any) => {
      setCurrentStep(prev => prev + 1);
      addChatMessage({
        type: 'step',
        message: data.step,
        stepNumber: currentStep + 1,
        status: 'RUNNING',
        metadata: { status: 'running' }
      });
    });
    
    // Agent reasoning
    linkedInJobSearchApi.onWebSocketEvent('agent:reasoning', (data: any) => {
      addChatMessage({
        type: 'assistant',
        message: data.reasoning,
        status: 'MESSAGE'
      });
    });
    
    // Job found
    linkedInJobSearchApi.onWebSocketEvent('job:found', (data: any) => {
      setJobsFound(prev => [...prev, data.job]);
      addChatMessage({
        type: 'info',
        message: `Found job: ${data.job.jobTitle} at ${data.job.company}`,
        status: 'MESSAGE'
      });
    });
    
    // Application submitted
    linkedInJobSearchApi.onWebSocketEvent('application:submitted', (data: any) => {
      setCurrentStep(prev => prev + 1);
      addChatMessage({
        type: 'success',
        message: `✅ Applied to ${data.job.jobTitle} at ${data.job.company}`,
        status: 'COMPLETE'
      });
    });
    
    // Job skipped
    linkedInJobSearchApi.onWebSocketEvent('job:skipped', (data: any) => {
      addChatMessage({
        type: 'system',
        message: `Skipped: ${data.reason}`,
        status: 'MESSAGE'
      });
    });
    
    // Intervention required
    linkedInJobSearchApi.onWebSocketEvent('intervention:required', (data: any) => {
      setShowIntervention(true);
      addChatMessage({
        type: 'warning',
        message: data.message,
        status: 'WAIT',
        metadata: {
          intervention: {
            required: true,
            type: data.interventionType || 'login',
            message: data.message,
            instructions: data.actionRequired || '',
            detectedAt: new Date().toISOString(),
            pageUrl: data.pageUrl
          },
          showContinueButton: true
        }
      });
    });
    
    // Metrics update
    linkedInJobSearchApi.onWebSocketEvent('metrics:updated', (data: any) => {
      setMetrics(data.metrics);
    });
    
    // Session completed
    linkedInJobSearchApi.onWebSocketEvent('session:completed', (data: any) => {
      addChatMessage({
        type: 'success',
        message: `Completed! Applied to ${data.totalApplications || metrics.successfulApplications || 0} jobs.`,
        status: 'COMPLETE'
      });
      localStorage.removeItem('activeSessionId');
    });
    
    // Context events
    linkedInJobSearchApi.onWebSocketEvent('context:first_login', () => {
      addChatMessage({
        type: 'info',
        message: 'First time setup: Please log in to LinkedIn in the browser window.',
        status: 'MESSAGE'
      });
    });
    
    linkedInJobSearchApi.onWebSocketEvent('context:created', () => {
      addChatMessage({
        type: 'success',
        message: 'LinkedIn session created successfully!',
        status: 'COMPLETE'
      });
      setHasLinkedInContext(true);
    });
  };
  */

  const loadAppliedJobs = async (sessionId: string) => {
    try {
      const response = await linkedInJobSearchApi.getAppliedJobs(sessionId);
      setAppliedJobs(response.jobs);
    } catch (error) {
      console.error('Error loading applied jobs:', error);
    }
  };


  const handleStop = async () => {
    if (!sessionId) return;

    // Don't use confirm dialog - just stop immediately
    try {
      await linkedInJobSearchApi.stopAutomation(sessionId);
        
        // Clear stored session
        localStorage.removeItem('activeSessionId');
        
        addChatMessage({
          type: 'system',
          message: 'Automation stopped',
          status: 'COMPLETE'
        });
        
        // Reset state after a delay to show the message
        setTimeout(() => {
          setSessionId(null);
          setSessionStatus(null);
          setLiveViewUrl(null);
          setAppliedJobs([]);
          setJobsFound([]);
          setMetrics({});
          setIsInChatMode(false);
          setSessionStartTime(null);
          setSessionDuration('00:00');
        }, 2000);
      } catch (error: any) {
        addChatMessage({
          type: 'error',
          message: `Error: ${error.message || 'Failed to stop automation'}`,
          status: 'COMPLETE'
        });
      }
    }
  };

  // Nuclear option - complete state reset
  const handleNuclearReset = () => {
    console.log('[NUCLEAR RESET] Starting complete state reset...');
    
    // Stop any active sessions
    if (sessionId) {
      linkedInJobSearchApi.stopAutomation(sessionId).catch(console.error);
    }
    
    // Clear all local storage
    if (user?.id) {
      localStorage.removeItem(`linkedin-context-${user.id}`);
      localStorage.removeItem(`browser-use-last-login`);
      localStorage.removeItem('activeSessionId');
    }
    
    // Reset all state to initial values
    setSessionId(null);
    setSessionStatus(null);
    setAppliedJobs([]);
    setShowIntervention(false);
    setLiveViewUrl(null);
    setChatMessages([]);
    setInputMessage('');
    setHasLinkedInContext(null);
    setShowOnboarding(false);
    setSessionStartTime(null);
    setSessionDuration('00:00');
    setIsInChatMode(false);
    setCurrentStep(0);
    setSearchPrompt('');
    setJobsFound([]);
    setMetrics({});
    setConfig(null);
    setLastInterventionType(null);
    setLastStatusMessage(null);
    setHasShownInitialRunningMessage(false);
    setFilters({
      easyApplyOnly: false,
      remote: false,
      datePosted: null,
      under10Applicants: false
    });
    
    // Clear any intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Clear any polling
    if (stopPollingRef.current) {
      stopPollingRef.current();
      stopPollingRef.current = null;
    }
    
    console.log('[NUCLEAR RESET] Complete. Reloading page...');
    
    // Force reload the page to ensure clean state
    window.location.reload();
  };

  const handleContinueAfterIntervention = async () => {
    if (!sessionId) return;

    // First, verify we have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      addChatMessage({
        type: 'error',
        message: 'Your session has expired. Please refresh the page and log in again.',
        status: 'COMPLETE'
      });
      return;
    }

    console.log('Attempting to continue automation:', {
      sessionId,
      hasSupabaseSession: !!session,
      sessionUser: session.user?.email
    });

    addChatMessage({
      type: 'system',
      message: 'Continuing automation...',
      status: 'RUNNING'
    });

    try {
      const response = await linkedInJobSearchApi.resumeAutomation(sessionId);
      setShowIntervention(false);
      
      if (response.success) {
        addChatMessage({
          type: 'success',
          message: 'Great! Automation resumed successfully.',
          status: 'COMPLETE'
        });
      }
      
      // The status should update through polling, but we can also update immediately
      if (sessionStatus) {
        setSessionStatus({
          ...sessionStatus,
          status: 'running',
          intervention: undefined
        });
      }
    } catch (error: any) {
      console.error('Continue after intervention error:', error);
      
      // Handle specific error cases
      if (error.status === 429) {
        addChatMessage({
          type: 'error',
          message: 'Rate limited. Please wait a few minutes before continuing.',
          status: 'COMPLETE'
        });
      } else if (error.status === 401) {
        addChatMessage({
          type: 'error',
          message: 'Authentication error. Please check your login status and try again.',
          status: 'COMPLETE'
        });
        // Check if user is still logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          addChatMessage({
            type: 'error',
            message: 'Your session has expired. Please log in again.',
            status: 'COMPLETE'
          });
          // Optionally redirect to login
        }
      } else if (error.status === 404) {
        addChatMessage({
          type: 'error',
          message: 'Session not found. The automation may have expired.',
          status: 'COMPLETE'
        });
        localStorage.removeItem('activeSessionId');
      } else if (error.status === 500 && error.message?.includes('login page')) {
        addChatMessage({
          type: 'error',
          message: 'Still on login page. Please complete the login process first.',
          status: 'COMPLETE'
        });
      } else {
        addChatMessage({
          type: 'error',
          message: `Error: ${error.message || 'Failed to continue automation'}`,
          status: 'COMPLETE'
        });
      }
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    addChatMessage({
      type: 'user',
      message: inputMessage,
      status: 'MESSAGE'
    });
    
    // Bot response
    addChatMessage({
      type: 'assistant',
      message: 'I\'m currently focused on applying to jobs. You can pause or stop the automation using the controls above.',
      status: 'MESSAGE'
    });
    
    setInputMessage('');
  };


  const handleClose = () => {
    handleStop();
  };


  if (!isInChatMode) {
    // Initial prompt interface
    return (
      <div className="h-[calc(100vh-4rem)] bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* macOS Window Chrome */}
          <div className="bg-gray-100 rounded-t-lg px-4 py-2 flex items-center space-x-2">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-b-lg p-8 shadow-sm">
            {/* Title and subtitle */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">Jobotic AI Agent</h1>
              <p className="text-gray-600">Hit run to watch AI apply to jobs for you.</p>
            </div>

            {/* Search input */}
            <div className="flex items-center space-x-3 mb-8">
              <input
                type="text"
                value={searchPrompt}
                onChange={(e) => setSearchPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
                placeholder="e.g., software engineer vancouver bc"
                className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                disabled={isStarting}
              />
              <button
                onClick={handleStart}
                disabled={isStarting || !searchPrompt.trim()}
                className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                  isStarting || !searchPrompt.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {isStarting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Run</span>
                    <span className="text-sm">⌘⏎</span>
                  </>
                )}
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setFilters(f => ({ ...f, easyApplyOnly: !f.easyApplyOnly }))}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filters.easyApplyOnly
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Easy Apply Only
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, remote: !f.remote }))}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filters.remote
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Remote
              </button>
              <button
                onClick={() => setFilters(f => ({ 
                  ...f, 
                  datePosted: f.datePosted === 'day' ? 'week' : 
                              f.datePosted === 'week' ? 'month' : 
                              f.datePosted === 'month' ? null : 'day'
                }))}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filters.datePosted
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filters.datePosted ? `Posted: Last ${filters.datePosted}` : 'Date Posted'}
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, under10Applicants: !f.under10Applicants }))}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filters.under10Applicants
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Under 10 Applicants
              </button>
            </div>

            {/* Action cards grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {actionCards.map((card, index) => (
                <button
                  key={index}
                  onClick={() => setSearchPrompt(card.prompt)}
                  className="p-4 bg-white border border-gray-200 rounded-lg text-left hover:shadow-md hover:scale-[1.02] transition-all duration-300 group"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                      {card.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">{card.title}</h3>
                      <p className="text-sm text-gray-600">{card.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer text */}
            <p className="text-center text-sm text-gray-500">Or type your own job search</p>

            {/* Settings button in corner */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Configuration Modal */}
        <LinkedInConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSave={(newConfig) => setConfig(newConfig)}
          initialConfig={config || undefined}
        />

        {/* Onboarding Modal */}
        {showOnboarding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">One-Time LinkedIn Setup</h2>
                    <p className="text-sm text-gray-600">Quick setup for automated job applications</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700 mb-4">To automate LinkedIn job applications, you'll need to:</p>
                  <ol className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">1</span>
                      <span>Start your first automation session</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">2</span>
                      <span>Log in to LinkedIn when prompted (one time only)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">3</span>
                      <span>Complete any security checks if requested</span>
                    </li>
                  </ol>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
                  <p className="text-sm text-green-800">
                    <strong>After this initial setup, all future sessions will start automatically!</strong> No more login interruptions.
                  </p>
                </div>
                
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  Got it, let's start!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Split screen chat view
  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-100 flex">
      {/* Chat interface - 30% width */}
      <div className="w-[30%] bg-[#2D2D2D] flex flex-col">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-white text-sm font-medium">AI Agent</h2>
              {sessionId && (
                <p className="text-gray-400 text-xs">
                  {metrics.jobsFound && `Found ${metrics.jobsFound} jobs`}
                  {metrics.successfulApplications && ` • Applied to ${metrics.successfulApplications}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Debug toggle */}
            <button
              onClick={() => {
                const newDebugMode = !isDebugMode();
                setDebugMode(newDebugMode);
                setDebugModeState(newDebugMode);
                (window as any).enableFetchDebug?.(newDebugMode);
                addChatMessage({
                  type: 'system',
                  message: `Debug mode ${newDebugMode ? 'enabled' : 'disabled'}. ${newDebugMode ? 'All API requests will be logged to console.' : ''}`
                });
              }}
              className={`p-1.5 rounded transition-colors ${
                isDebugMode() 
                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' 
                  : 'hover:bg-gray-700 text-gray-400 hover:text-gray-300'
              }`}
              title={`Debug mode is ${isDebugMode() ? 'ON' : 'OFF'}`}
            >
              <Bug className="w-4 h-4" />
            </button>
            
            {/* Nuclear reset - only show in debug mode */}
            {debugMode && (
              <button
                onClick={() => {
                  if (confirm('⚠️ NUCLEAR RESET ⚠️\n\nThis will:\n• Stop all active sessions\n• Clear ALL stored data\n• Reset ALL settings\n• Reload the page\n\nAre you absolutely sure?')) {
                    handleNuclearReset();
                  }
                }}
                className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors"
                title="Nuclear Reset - Clear EVERYTHING"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {sessionId && (
              <button
                onClick={handleStop}
                className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-red-400 rounded transition-colors"
              >
                <Square className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chat messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {chatMessages.map((message) => (
            <div key={message.id}>
              {message.type === 'step' ? (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-gray-500 text-sm font-medium mt-0.5">
                    Step {message.stepNumber}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {message.status === 'WAIT' && (
                        <span className="text-xs text-orange-400 font-medium">WAIT</span>
                      )}
                      {message.status === 'RUNNING' && (
                        <Loader2 className="w-3 h-3 text-orange-400 animate-spin" />
                      )}
                      {message.status === 'MESSAGE' && (
                        <span className="text-xs text-blue-400 font-medium">MESSAGE</span>
                      )}
                      {message.status === 'COMPLETE' && (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      )}
                    </div>
                    <p className="text-gray-300 text-sm mt-1">{message.message}</p>
                  </div>
                </div>
              ) : message.type === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-gray-700 rounded-lg px-3 py-2 max-w-[80%]">
                    <p className="text-white text-sm">{message.message}</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <p className={`text-sm ${
                      message.type === 'system' || message.type === 'assistant' ? 'text-gray-400' :
                      message.type === 'error' ? 'text-red-400' :
                      message.type === 'success' ? 'text-green-400' :
                      message.type === 'warning' ? 'text-orange-400' :
                      'text-gray-300'
                    }`}>{message.message}</p>
                    {message.metadata?.showContinueButton && sessionStatus?.status === 'intervention_required' && (
                      <button
                        onClick={handleContinueAfterIntervention}
                        className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        I've completed the action - Continue
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:border-gray-500 focus:outline-none"
              disabled={!sessionId}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !sessionId}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !inputMessage.trim() || !sessionId
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              Send
            </button>
          </div>
          
          {/* Session timer */}
          {sessionStartTime && (
            <div className="mt-3 text-center text-xs text-gray-500">
              Session time: {sessionDuration}
            </div>
          )}
        </div>
      </div>

      {/* Preview/browser area - 70% width */}
      <div className="flex-1 bg-white relative">
        {/* Top bar with buttons */}
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-3">
          <button
            onClick={() => window.open(liveViewUrl || '#', '_blank')}
            disabled={!liveViewUrl}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !liveViewUrl
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            View Browser
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        {/* Browser content */}
        {liveViewUrl ? (
          <iframe
            src={liveViewUrl}
            className="w-full h-full"
            title="LinkedIn Automation Browser"
            onLoad={() => console.log('[FRONTEND DEBUG] Iframe loaded:', liveViewUrl)}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Browser Preview</p>
              <p className="text-gray-500 text-sm mt-1">
                Waiting for automation to start...
              </p>
            </div>
          </div>
        )}

        {/* Applied Jobs Summary - Overlay */}
        {sessionStatus?.status === 'completed' && appliedJobs.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-h-60 overflow-y-auto">
            <h3 className="font-medium text-gray-900 mb-3">Applied Jobs Summary</h3>
            <div className="space-y-2">
              {appliedJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-gray-600">{job.company}</p>
                  </div>
                  <a
                    href={job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}