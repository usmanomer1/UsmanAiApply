import React, { useState, useEffect, useRef } from 'react';
import { Settings, Sparkles, Pause, Play, Square, ExternalLink, CheckCircle, XCircle, AlertCircle, Loader2, Send, Bot, User, Clock } from 'lucide-react';
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
  type: 'user' | 'bot' | 'system' | 'intervention';
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
  const stopPollingRef = useRef<(() => void) | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load saved config
    const savedConfig = localStorage.getItem(`linkedin-config-${user?.id}`);
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      // Show config modal if no config exists
      setShowConfigModal(true);
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
        addChatMessage({
          type: 'intervention',
          message: sessionStatus.intervention.message,
          metadata: { intervention: sessionStatus.intervention }
        });
      }
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
    setSessionStatus(status);
    
    // Update live view URL if provided
    if (status.liveViewUrl) {
      setLiveViewUrl(status.liveViewUrl);
    }
    
    // Add status updates to chat
    if (prevStatus !== status.status) {
      if (status.status === 'running') {
        addChatMessage({
          type: 'system',
          message: 'Automation is running...',
          metadata: { status: status.status }
        });
      } else if (status.status === 'completed') {
        addChatMessage({
          type: 'bot',
          message: `Great news! I've completed your job search. Applied to ${status.progress.totalApplications} jobs.`,
          metadata: { status: status.status, progress: status.progress }
        });
        if (sessionId) {
          loadAppliedJobs(sessionId);
        }
        // Clear stored session
        localStorage.removeItem('activeSessionId');
      } else if (status.status === 'failed') {
        addChatMessage({
          type: 'system',
          message: 'Automation failed. Please try again.',
          metadata: { status: status.status }
        });
        // Clear stored session
        localStorage.removeItem('activeSessionId');
      }
    }
    
    // Add progress updates
    if (status.progress.totalApplications > 0) {
      const progressMessage = `Progress: ${status.progress.totalApplications} applications (${status.progress.applicationsToday} today)`;
      setChatMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (!lastMessage || !lastMessage.message.startsWith('Progress:')) {
          return [...prev, {
            id: Date.now().toString(),
            type: 'bot' as const,
            message: progressMessage,
            timestamp: new Date(),
            metadata: { progress: status.progress }
          }];
        } else if (lastMessage.message !== progressMessage) {
          // Update the last progress message
          return [...prev.slice(0, -1), {
            ...lastMessage,
            message: progressMessage,
            timestamp: new Date(),
            metadata: { progress: status.progress }
          }];
        }
        return prev;
      });
    }
  };

  const handleStart = async () => {
    if (!searchPrompt.trim()) {
      alert('Please enter a job search query');
      return;
    }

    setIsStarting(true);
    setChatMessages([]); // Clear previous messages
    
    // Add initial messages
    addChatMessage({
      type: 'user',
      message: searchPrompt.trim()
    });
    
    addChatMessage({
      type: 'bot',
      message: 'Starting your LinkedIn job search automation...'
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
        type: 'bot',
        message: 'Automation started successfully! I\'ll apply to jobs matching your criteria.'
      });

      // Start polling for status
      stopPollingRef.current = linkedinAutomationApi.pollStatus(
        result.sessionId,
        handleStatusUpdate
      );
    } catch (error: any) {
      addChatMessage({
        type: 'system',
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
        addChatMessage({
          type: 'system',
          message: 'Automation paused'
        });
      } else if (sessionStatus.status === 'paused') {
        await linkedinAutomationApi.resumeSession(sessionId);
        addChatMessage({
          type: 'system',
          message: 'Automation resumed'
        });
      }
    } catch (error: any) {
      addChatMessage({
        type: 'system',
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
          type: 'system',
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
          type: 'bot',
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
          type: 'system',
          message: 'Rate limited. Please wait a few minutes before continuing.'
        });
      } else if (error.status === 401) {
        addChatMessage({
          type: 'system',
          message: 'Session expired. Please restart the automation.'
        });
        localStorage.removeItem('activeSessionId');
      } else {
        addChatMessage({
          type: 'system',
          message: `Error: ${error.message || 'Failed to continue automation'}`
        });
      }
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !sessionId) return;

    if (!sessionId) {
      // Initial prompt
      setSearchPrompt(inputMessage);
      handleStart();
    } else {
      // During automation - just add to chat
      addChatMessage({
        type: 'user',
        message: inputMessage
      });
      
      // Bot response
      addChatMessage({
        type: 'bot',
        message: 'I\'m currently focused on applying to jobs. You can pause or stop the automation using the controls above.'
      });
    }
    
    setInputMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'intervention_required':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">AI Job Search Agent</h1>
          {sessionStatus && (
            <div className="flex items-center space-x-2">
              {getStatusIcon(sessionStatus.status)}
              <span className="text-sm text-gray-600">
                {sessionStatus.status.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
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

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat Interface */}
        <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col">
          {/* Progress Stats */}
          {sessionStatus && sessionStatus.progress && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{sessionStatus.progress.totalApplications}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{sessionStatus.progress.applicationsToday}</p>
                  <p className="text-xs text-gray-600">Today</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{sessionStatus.progress.applicationsThisWeek}</p>
                  <p className="text-xs text-gray-600">This Week</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{sessionStatus.progress.applicationsThisMonth}</p>
                  <p className="text-xs text-gray-600">This Month</p>
                </div>
              </div>
              <div className="mt-3 text-center text-sm text-gray-500">
                Session Duration: {formatDuration(sessionStatus.progress.sessionDurationSeconds)}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            {chatMessages.length === 0 && !sessionId && (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Hi! I'm your AI job search assistant.</p>
                <p className="text-gray-500 text-sm">Tell me what kind of job you're looking for.</p>
              </div>
            )}
            
            {chatMessages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' ? 'bg-blue-600' : 
                    message.type === 'bot' ? 'bg-gradient-to-br from-blue-600 to-purple-600' :
                    message.type === 'intervention' ? 'bg-orange-500' :
                    'bg-gray-400'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : message.type === 'intervention' ? (
                      <AlertCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  
                  <div className={`${
                    message.type === 'user' ? 'bg-blue-600 text-white' : 
                    message.type === 'intervention' ? 'bg-orange-50 text-orange-900 border border-orange-200' :
                    'bg-gray-100 text-gray-900'
                  } rounded-2xl px-4 py-2`}>
                    <p className="text-sm">{message.message}</p>
                    <p className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Applied Jobs Summary */}
            {sessionStatus?.status === 'completed' && appliedJobs.length > 0 && (
              <div className="mt-6 bg-green-50 rounded-lg p-4">
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

          {/* Chat Input */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex space-x-3">
              <textarea
                ref={inputRef}
                value={sessionId ? inputMessage : searchPrompt}
                onChange={(e) => sessionId ? setInputMessage(e.target.value) : setSearchPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sessionId ? handleSendMessage() : handleStart();
                  }
                }}
                placeholder={sessionId ? "Type a message..." : "e.g., Senior React developer jobs in San Francisco with good benefits"}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
                rows={2}
                disabled={isStarting}
              />
              <button
                onClick={sessionId ? handleSendMessage : handleStart}
                disabled={isStarting || (!sessionId && !searchPrompt.trim())}
                className={`p-3 rounded-lg transition-colors ${
                  isStarting || (!sessionId && !searchPrompt.trim())
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                }`}
              >
                {isStarting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : sessionId ? (
                  <Send className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Browser Preview */}
        <div className="w-1/2 bg-gray-100 flex items-center justify-center">
          {liveViewUrl && sessionId ? (
            <iframe
              src={liveViewUrl}
              className="w-full h-full"
              title="LinkedIn Automation Browser"
            />
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <ExternalLink className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Browser Preview</p>
              <p className="text-gray-500 text-sm mt-1">
                Start an automation to see the live browser view
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      <LinkedInConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSave={(newConfig) => setConfig(newConfig)}
        initialConfig={config || undefined}
      />

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