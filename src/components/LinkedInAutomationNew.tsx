import React, { useState, useEffect, useRef } from 'react';
import { Settings, Send, Bot, AlertCircle, Loader2, CheckCircle, XCircle, Info, RefreshCw, ExternalLink, Pause, Play, Square, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { linkedinAutomationApi, SessionStatus, AppliedJob } from '../lib/linkedinAutomationApi';
import LinkedInConfigModal from './LinkedInConfigModal';

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
  type: 'user' | 'assistant' | 'system' | 'info' | 'error' | 'success' | 'warning';
  message: string;
  timestamp: Date;
  metadata?: {
    status?: string;
    progress?: SessionStatus['progress'];
    intervention?: SessionStatus['intervention'];
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
  const stopPollingRef = useRef<(() => void) | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  }, [user]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

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
    };
  }, []);

  const addChatMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setChatMessages(prev => [...prev, {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }]);
  };

  // Resume active session on mount
  useEffect(() => {
    const activeSessionId = localStorage.getItem('activeSessionId');
    if (activeSessionId && !sessionId) {
      setSessionId(activeSessionId);
      // Resume polling for this session
      linkedinAutomationApi.getStatus(activeSessionId)
        .then(status => {
          setSessionStatus(status);
          if (status.liveViewUrl) {
            setLiveViewUrl(status.liveViewUrl);
          }
          // Resume polling if session is active
          if (['running', 'intervention_required', 'paused'].includes(status.status)) {
            stopPollingRef.current = linkedinAutomationApi.pollStatus(
              activeSessionId,
              (updatedStatus) => handleStatusUpdate(updatedStatus)
            );
          }
        })
        .catch(error => {
          console.error('Failed to resume session:', error);
          localStorage.removeItem('activeSessionId');
        });
    }
  }, [sessionId]);

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
        message: 'Great! Your LinkedIn account is now connected. Future sessions will start automatically without requiring login.'
      });
    }
    
    // Only add status messages when status actually changes
    if (prevStatus !== status.status) {
      if (status.status === 'running') {
        // Different messages based on previous state
        let message = '';
        let type: ChatMessage['type'] = 'info';
        
        if (!prevStatus) {
          message = hasLinkedInContext 
            ? 'Automation started with your saved LinkedIn session!'
            : 'Automation started! Setting up LinkedIn session...';
          type = 'info';
        } else if (prevStatus === 'intervention_required') {
          message = 'Action completed! Resuming automation...';
          type = 'success';
        } else if (prevStatus === 'paused') {
          message = 'Automation resumed';
          type = 'info';
        } else {
          return;
        }
        
        if (message) {
          addChatMessage({ type, message, metadata: { status: status.status } });
        }
      } else if (status.status === 'completed') {
        addChatMessage({
          type: 'success',
          message: `Completed! Applied to ${status.progress.totalApplications} job${status.progress.totalApplications !== 1 ? 's' : ''}.`,
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
          metadata: { status: status.status }
        });
        // Clear stored session
        localStorage.removeItem('activeSessionId');
      } else if (status.status === 'paused') {
        addChatMessage({
          type: 'info',
          message: 'Automation paused',
          metadata: { status: status.status }
        });
      }
    }
    
    // Handle intervention changes separately
    if (status.status === 'intervention_required' && 
        JSON.stringify(prevIntervention) !== JSON.stringify(status.intervention)) {
      addChatMessage({
        type: 'warning',
        message: getInterventionMessage(status.intervention),
        metadata: { intervention: status.intervention }
      });
    }
    
    // Add progress updates only if running and applications have increased
    if (status.status === 'running' && status.progress.totalApplications > 0) {
      const currentCount = status.progress.totalApplications;
      const prevCount = sessionStatus?.progress?.totalApplications || 0;
      
      // Only show progress update if count increased
      if (currentCount > prevCount) {
        addChatMessage({
          type: 'info',
          message: `Progress update: Applied to ${currentCount} job${currentCount !== 1 ? 's' : ''} (${status.progress.applicationsToday} today)`,
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
      alert('Please enter a job search query');
      return;
    }

    if (!config) {
      setShowConfigModal(true);
      return;
    }

    setIsStarting(true);
    setChatMessages([]); // Clear previous messages
    
    // Add initial messages
    addChatMessage({
      type: 'user',
      message: searchPrompt.trim()
    });

    try {
      const result = await linkedinAutomationApi.startAutomation({
        userId: user!.id,
        searchPrompt: searchPrompt.trim(),
        config: {
          maxApplications: 50,
          filters: {
            easyApplyOnly: true,
            datePosted: 'week'
          }
        }
      });

      setSessionId(result.sessionId);
      setLiveViewUrl(result.liveViewUrl);
      
      // Store session ID for page refresh handling
      localStorage.setItem('activeSessionId', result.sessionId);
      
      addChatMessage({
        type: 'assistant',
        message: hasLinkedInContext 
          ? 'Starting automation with your saved LinkedIn session. No login required!' 
          : 'Automation started! You may need to log in to LinkedIn (one-time setup).'
      });

      // Start polling for status
      stopPollingRef.current = linkedinAutomationApi.pollStatus(
        result.sessionId,
        handleStatusUpdate
      );
    } catch (error: any) {
      addChatMessage({
        type: 'error',
        message: `Error: ${error.message || 'Failed to start automation'}`
      });
    } finally {
      setIsStarting(false);
    }
  };

  const loadAppliedJobs = async (sessionId: string) => {
    try {
      const response = await linkedinAutomationApi.getAppliedJobs(sessionId);
      setAppliedJobs(response.jobs);
    } catch (error) {
      console.error('Error loading applied jobs:', error);
    }
  };

  const handlePauseResume = async () => {
    if (!sessionId || !sessionStatus) return;

    try {
      if (sessionStatus.status === 'running') {
        await linkedinAutomationApi.pauseSession(sessionId);
      } else if (sessionStatus.status === 'paused') {
        await linkedinAutomationApi.resumeSession(sessionId);
      }
    } catch (error: any) {
      addChatMessage({
        type: 'error',
        message: `Error: ${error.message || 'Operation failed'}`
      });
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;

    if (confirm('Are you sure you want to stop the automation?')) {
      try {
        await linkedinAutomationApi.stopSession(sessionId);
        stopPollingRef.current?.();
        
        // Clear stored session
        localStorage.removeItem('activeSessionId');
        
        addChatMessage({
          type: 'system',
          message: 'Automation stopped'
        });
        
        // Reset state after a delay to show the message
        setTimeout(() => {
          setSessionId(null);
          setSessionStatus(null);
          setLiveViewUrl(null);
          setAppliedJobs([]);
        }, 2000);
      } catch (error: any) {
        addChatMessage({
          type: 'error',
          message: `Error: ${error.message || 'Failed to stop automation'}`
        });
      }
    }
  };

  const handleContinueAfterIntervention = async () => {
    if (!sessionId) return;

    try {
      const response = await linkedinAutomationApi.continueAfterIntervention(sessionId);
      setShowIntervention(false);
      
      if (response.status === 'running') {
        addChatMessage({
          type: 'assistant',
          message: 'Thanks! Continuing with the automation...'
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
      // Handle specific error cases
      if (error.status === 429) {
        addChatMessage({
          type: 'error',
          message: 'Rate limited. Please wait a few minutes before continuing.'
        });
      } else if (error.status === 401) {
        addChatMessage({
          type: 'error',
          message: 'Session expired. Please restart the automation.'
        });
        localStorage.removeItem('activeSessionId');
      } else {
        addChatMessage({
          type: 'error',
          message: `Error: ${error.message || 'Failed to continue automation'}`
        });
      }
    }
  };

  const handleSendMessage = () => {
    if (!searchPrompt.trim()) return;

    // Initial prompt
    handleStart();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getMessageColor = (type: ChatMessage['type']) => {
    switch (type) {
      case 'user':
        return 'bg-gray-50 text-gray-900';
      case 'assistant':
        return 'bg-blue-50 text-blue-900';
      case 'system':
        return 'bg-gray-100 text-gray-700';
      case 'info':
        return 'bg-teal-50 text-teal-900';
      case 'error':
        return 'bg-red-50 text-red-900';
      case 'success':
        return 'bg-green-50 text-green-900';
      case 'warning':
        return 'bg-orange-50 text-orange-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const getMessageIcon = (type: ChatMessage['type']) => {
    switch (type) {
      case 'assistant':
        return <Bot className="w-5 h-5 text-blue-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-teal-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">LinkedIn Agent</h1>
          {sessionStatus && (
            <div className="flex items-center space-x-2">
              {sessionStatus.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              {sessionStatus.status === 'paused' && <Pause className="w-4 h-4 text-yellow-500" />}
              {sessionStatus.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
              {sessionStatus.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
              {sessionStatus.status === 'intervention_required' && <AlertCircle className="w-4 h-4 text-orange-500" />}
              <span className="text-sm text-gray-600 capitalize">
                {sessionStatus.status.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* LinkedIn Context Status */}
          {hasLinkedInContext !== null && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-lg">
              {hasLinkedInContext ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700">LinkedIn Connected</span>
                </>
              ) : (
                <>
                  <Info className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Not Connected</span>
                </>
              )}
            </div>
          )}
          
          {sessionId && sessionStatus && (
            <>
              <button
                onClick={handlePauseResume}
                disabled={!['running', 'paused'].includes(sessionStatus.status)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  ['running', 'paused'].includes(sessionStatus.status)
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {sessionStatus.status === 'running' ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Resume</span>
                  </>
                )}
              </button>
              <button
                onClick={handleStop}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {chatMessages.length === 0 && !sessionId && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  AI Job Search Assistant
                </h2>
                <p className="text-gray-600 mb-8">
                  Tell me what kind of job you're looking for and I'll help you apply automatically on LinkedIn
                </p>
                
                {/* Sample prompts */}
                <div className="space-y-3">
                  <button
                    onClick={() => setSearchPrompt('Senior React developer jobs in San Francisco')}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Senior React developer jobs in San Francisco</span>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </button>
                  <button
                    onClick={() => setSearchPrompt('Remote Product Manager positions with good benefits')}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Remote Product Manager positions with good benefits</span>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </button>
                  <button
                    onClick={() => setSearchPrompt('Data Scientist roles at startups')}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Data Scientist roles at startups</span>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4 max-w-3xl mx-auto">
            {chatMessages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl px-4 py-3 ${getMessageColor(message.type)}`}>
                    {message.type !== 'user' && getMessageIcon(message.type) && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getMessageIcon(message.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{message.message}</p>
                          <p className="text-xs mt-1 opacity-60">
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    )}
                    {message.type === 'user' && (
                      <>
                        <p className="text-sm leading-relaxed">{message.message}</p>
                        <p className="text-xs mt-1 opacity-60">
                          {formatTime(message.timestamp)}
                        </p>
                      </>
                    )}
                    {!getMessageIcon(message.type) && message.type !== 'user' && (
                      <>
                        <p className="text-sm leading-relaxed">{message.message}</p>
                        <p className="text-xs mt-1 opacity-60">
                          {formatTime(message.timestamp)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Applied Jobs Summary */}
            {sessionStatus?.status === 'completed' && appliedJobs.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-3">Applied Jobs Summary</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
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

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex space-x-3">
              <textarea
                ref={inputRef}
                value={searchPrompt}
                onChange={(e) => setSearchPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
                placeholder="e.g., Senior React developer jobs in San Francisco with good benefits"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                rows={1}
                disabled={isStarting || sessionId !== null}
                style={{
                  minHeight: '48px',
                  maxHeight: '120px'
                }}
              />
              <button
                onClick={handleStart}
                disabled={isStarting || !searchPrompt.trim() || sessionId !== null}
                className={`px-4 py-3 rounded-2xl font-medium transition-all ${
                  isStarting || !searchPrompt.trim() || sessionId !== null
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                }`}
              >
                {isStarting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
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
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
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
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">1</span>
                    <span>Start your first automation session</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">2</span>
                    <span>Log in to LinkedIn when prompted (one time only)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">3</span>
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
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Got it, let's start!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intervention Modal */}
      {showIntervention && sessionStatus?.intervention && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {sessionStatus.intervention.type === 'login' && 'LinkedIn Login Required'}
                    {sessionStatus.intervention.type === 'captcha' && 'CAPTCHA Verification'}
                    {sessionStatus.intervention.type === 'two_fa' && 'Two-Factor Authentication'}
                    {sessionStatus.intervention.type === 'blocked' && 'Account Access Restricted'}
                    {sessionStatus.intervention.type === 'rate_limit' && 'Rate Limited'}
                  </h2>
                  <p className="text-sm text-gray-600">Your attention is needed</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-3">{sessionStatus.intervention.message}</p>
              
              {sessionStatus.intervention.type === 'login' && hasLinkedInContext === false && (
                <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
                  <p className="text-sm text-green-800">
                    <strong>This is a one-time setup!</strong> After you log in, we'll save your session for all future automations.
                  </p>
                </div>
              )}
              
              <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                <p className="text-sm text-blue-800 font-medium mb-1">Instructions:</p>
                <p className="text-sm text-blue-700">{sessionStatus.intervention.instructions}</p>
              </div>

              {liveViewUrl && (
                <a
                  href={liveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mb-3 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Browser View in New Tab</span>
                </a>
              )}
              
              <button
                onClick={handleContinueAfterIntervention}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                I've completed the action - Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}