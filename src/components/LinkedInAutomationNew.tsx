import React, { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, Play, Pause, Square, AlertCircle, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { linkedInAutomationAPI, LinkedInJobConfig, StartSessionRequest, SessionProgress, JobFound, InterventionRequired } from '../lib/linkedinAutomationApiV2';
import { Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'info' | 'error' | 'success' | 'warning' | 'action';
  message: string;
  timestamp: Date;
  metadata?: {
    jobTitle?: string;
    company?: string;
    jobUrl?: string;
    applied?: boolean;
  };
}

export default function LinkedInAutomationNew() {
  const { user } = useAuth();
  
  // Core state
  const [searchQuery, setSearchQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  
  // UI state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showIntervention, setShowIntervention] = useState(false);
  const [interventionData, setInterventionData] = useState<InterventionRequired | null>(null);
  
  // Metrics
  const [progress, setProgress] = useState<SessionProgress>({
    totalJobs: 0,
    processedJobs: 0,
    appliedJobs: 0,
    skippedJobs: 0,
    failedJobs: 0,
    currentPage: 0
  });
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check for existing sessions on mount
  useEffect(() => {
    checkExistingSessions();
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        linkedInAutomationAPI.disconnectWebSocket();
      }
    };
  }, []);

  const checkExistingSessions = async () => {
    try {
      const { sessions } = await linkedInAutomationAPI.getUserSessions();
      const activeSession = sessions.find(s => s.status === 'active' || s.status === 'paused');
      
      if (activeSession) {
        setSessionId(activeSession.id);
        setLiveViewUrl(activeSession.live_view_url);
        setIsRunning(true);
        setIsPaused(activeSession.status === 'paused');
        
        // Connect WebSocket for existing session
        await connectWebSocket(activeSession.id);
        
        // Get current progress
        const { progress } = await linkedInAutomationAPI.getProgress(activeSession.id);
        setProgress(progress);
        
        addMessage({
          type: 'info',
          message: 'Resumed existing session'
        });
      }
    } catch (error) {
      console.error('Error checking existing sessions:', error);
    }
  };

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    }]);
  };

  const connectWebSocket = async (sessionId: string) => {
    try {
      const socket = await linkedInAutomationAPI.connectWebSocket(sessionId);
      socketRef.current = socket;

      // Set up event listeners
      socket.on('session_started', (data) => {
        addMessage({
          type: 'success',
          message: 'Session started successfully'
        });
        // The liveViewUrl might come in the session_started event
        if (data.liveViewUrl) {
          setLiveViewUrl(data.liveViewUrl);
        }
      });

      socket.on('intervention_required', (data) => {
        setShowIntervention(true);
        setInterventionData(data.intervention);
        addMessage({
          type: 'warning',
          message: data.intervention.message
        });
      });

      socket.on('action_performed', (data) => {
        addMessage({
          type: 'action',
          message: data.action
        });
      });

      socket.on('job_found', (data) => {
        const job: JobFound = data.job;
        addMessage({
          type: 'info',
          message: `Found job: ${job.jobTitle} at ${job.company}`,
          metadata: {
            jobTitle: job.jobTitle,
            company: job.company,
            jobUrl: job.jobUrl
          }
        });
      });

      socket.on('application_started', (data) => {
        addMessage({
          type: 'info',
          message: `Applying to: ${data.job.jobTitle} at ${data.job.company}`
        });
      });

      socket.on('application_submitted', (data) => {
        if (data.success) {
          addMessage({
            type: 'success',
            message: `✅ Applied to ${data.job.jobTitle} at ${data.job.company}`,
            metadata: {
              jobTitle: data.job.jobTitle,
              company: data.job.company,
              jobUrl: data.job.jobUrl,
              applied: true
            }
          });
        }
      });

      socket.on('job_skipped', (data) => {
        addMessage({
          type: 'system',
          message: `Skipped: ${data.job.company} - ${data.reason}`
        });
      });

      socket.on('session_completed', (data) => {
        addMessage({
          type: 'success',
          message: `Completed! Applied to ${data.totalApplications} jobs.`
        });
        handleCompletion();
      });

      socket.on('error', (data) => {
        addMessage({
          type: 'error',
          message: `Error: ${data.error}`
        });
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      toast.error('Failed to connect to real-time updates');
    }
  };

  const handleStart = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsRunning(true);
      setMessages([]); // Clear previous messages
      
      addMessage({
        type: 'user',
        message: searchQuery
      });

      addMessage({
        type: 'system',
        message: 'Starting LinkedIn job automation...'
      });

      // Get user ID from auth context
      if (!user?.id) {
        throw new Error('User ID not available');
      }

      const request: StartSessionRequest = {
        userId: user.id,
        searchPrompt: searchQuery,
        config: {
          filters: {
            easyApplyOnly: true
          },
          maxApplications: 20
        }
      };

      const response = await linkedInAutomationAPI.startSession(request);
      
      setSessionId(response.sessionId);
      setLiveViewUrl(response.liveViewUrl);
      
      // Connect WebSocket for real-time updates
      await connectWebSocket(response.sessionId);

      addMessage({
        type: 'info',
        message: 'Automation started. You can watch the progress in the browser view.'
      });

    } catch (error: any) {
      console.error('Failed to start automation:', error);
      addMessage({
        type: 'error',
        message: error.message || 'Failed to start automation'
      });
      setIsRunning(false);
    }
  };

  const handlePause = async () => {
    if (!sessionId) return;

    try {
      await linkedInAutomationAPI.pauseSession(sessionId);
      setIsPaused(true);
      addMessage({
        type: 'system',
        message: 'Automation paused'
      });
    } catch (error: any) {
      addMessage({
        type: 'error',
        message: error.message || 'Failed to pause automation'
      });
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;

    try {
      await linkedInAutomationAPI.resumeSession(sessionId);
      setIsPaused(false);
      addMessage({
        type: 'system',
        message: 'Automation resumed'
      });
    } catch (error: any) {
      addMessage({
        type: 'error',
        message: error.message || 'Failed to resume automation'
      });
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;

    try {
      await linkedInAutomationAPI.stopSession(sessionId);
      handleCompletion();
      addMessage({
        type: 'system',
        message: 'Automation stopped'
      });
    } catch (error: any) {
      addMessage({
        type: 'error',
        message: error.message || 'Failed to stop automation'
      });
    }
  };

  const handleCompletion = () => {
    setIsRunning(false);
    setIsPaused(false);
    setSessionId(null);
    setShowIntervention(false);
    setInterventionData(null);
    
    if (socketRef.current) {
      linkedInAutomationAPI.disconnectWebSocket();
      socketRef.current = null;
    }
  };

  const handleContinueIntervention = async () => {
    if (!sessionId) return;

    try {
      await linkedInAutomationAPI.continueSession(sessionId);
      setShowIntervention(false);
      setInterventionData(null);
      addMessage({
        type: 'info',
        message: 'Continuing automation...'
      });
    } catch (error: any) {
      addMessage({
        type: 'error',
        message: error.message || 'Failed to continue automation'
      });
    }
  };

  // Poll for progress updates
  useEffect(() => {
    if (!sessionId || !isRunning || isPaused) return;

    const interval = setInterval(async () => {
      try {
        const { progress } = await linkedInAutomationAPI.getProgress(sessionId);
        setProgress(progress);
      } catch (error) {
        console.error('Error fetching progress:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [sessionId, isRunning, isPaused]);

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 flex">
      {/* Chat Panel - 30% width */}
      <div className="w-[30%] bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">LinkedIn AI Agent</h2>
            </div>
            {isRunning && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600">Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  message.type === 'user'
                    ? 'bg-orange-500 text-white'
                    : message.type === 'error'
                    ? 'bg-red-100 text-red-800'
                    : message.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : message.type === 'warning'
                    ? 'bg-yellow-100 text-yellow-800'
                    : message.type === 'action'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.message}
                {message.metadata?.jobUrl && (
                  <a
                    href={message.metadata.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Intervention Alert */}
        {showIntervention && interventionData && (
          <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">{interventionData.message}</p>
                <p className="text-xs text-yellow-700 mt-1">{interventionData.instructions}</p>
                <button
                  onClick={handleContinueIntervention}
                  className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 border-t border-gray-200">
          {!isRunning ? (
            <div className="space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
                placeholder="e.g., software engineer remote"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleStart}
                disabled={!searchQuery.trim()}
                className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Automation</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              {!isPaused ? (
                <button
                  onClick={handlePause}
                  className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume</span>
                </button>
              )}
              <button
                onClick={handleStop}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            </div>
          )}

          {/* Progress Metrics */}
          {isRunning && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{progress.processedJobs}</div>
                  <div className="text-gray-500">Processed</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">{progress.appliedJobs}</div>
                  <div className="text-gray-500">Applied</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-yellow-600">{progress.skippedJobs}</div>
                  <div className="text-gray-500">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{progress.totalJobs}</div>
                  <div className="text-gray-500">Total Found</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live View - 70% width */}
      <div className="flex-1 bg-gray-900 relative">
        {liveViewUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={liveViewUrl}
              className="w-full h-full"
              title="LinkedIn Automation Browser"
              allow="clipboard-read; clipboard-write"
            />
            <div className="absolute top-4 right-4 bg-black/75 backdrop-blur px-3 py-1.5 rounded-lg flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Live View</span>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Start automation to see live browser view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}