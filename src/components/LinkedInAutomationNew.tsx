import React, { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, Play, Pause, Square, RefreshCw, ExternalLink, CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { linkedInJobSearchApi, SessionStatus, AppliedJob } from '../lib/linkedInJobSearchApi';
import { useAuth } from '../contexts/AuthContext';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'info' | 'error' | 'success' | 'warning';
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
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  
  // UI state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [showIntervention, setShowIntervention] = useState(false);
  const [interventionMessage, setInterventionMessage] = useState('');
  
  // Metrics
  const [jobsFound, setJobsFound] = useState(0);
  const [jobsApplied, setJobsApplied] = useState(0);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check for existing session on mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem('activeSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      resumeSession(storedSessionId);
    }
  }, []);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    }]);
  };

  const resumeSession = async (sessionId: string) => {
    try {
      const status = await linkedInJobSearchApi.getStatus(sessionId);
      
      if (status.status === 'completed') {
        localStorage.removeItem('activeSessionId');
        addMessage({
          type: 'info',
          message: 'Previous session has completed.'
        });
        return;
      }

      setSessionStatus(status);
      setIsRunning(true);
      setIsPaused(status.status === 'paused');
      
      if (status.progress) {
        setJobsFound(status.progress.jobsFound || 0);
        setJobsApplied(status.progress.jobsApplied || 0);
      }

      if (status.liveViewUrl) {
        setLiveViewUrl(status.liveViewUrl);
      }

      addMessage({
        type: 'info',
        message: 'Resumed previous session'
      });

      startPollingStatus(sessionId);
    } catch (error) {
      console.error('Failed to resume session:', error);
      localStorage.removeItem('activeSessionId');
    }
  };

  const startPollingStatus = (sessionId: string) => {
    if (stopPollingRef.current) {
      stopPollingRef.current();
    }

    stopPollingRef.current = linkedInJobSearchApi.pollStatus(
      sessionId,
      (status) => {
        setSessionStatus(status);
        
        // Update metrics
        if (status.progress) {
          setJobsFound(status.progress.jobsFound || 0);
          setJobsApplied(status.progress.jobsApplied || 0);
        }

        // Handle intervention
        if (status.intervention?.required) {
          setShowIntervention(true);
          setInterventionMessage(status.intervention.message);
          
          // Add intervention message only once
          if (!messages.some(m => m.message === status.intervention!.message && m.type === 'warning')) {
            addMessage({
              type: 'warning',
              message: status.intervention.message
            });
          }
        } else {
          setShowIntervention(false);
          setInterventionMessage('');
        }

        // Handle completion
        if (status.status === 'completed') {
          handleCompletion();
        }
      },
      3000 // Poll every 3 seconds
    );
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

      // Check if user has existing context
      const hasContext = await linkedInJobSearchApi.hasLinkedInContext();
      
      const task = await linkedInJobSearchApi.createTask({
        jobSearch: {
          keywords: searchQuery,
          location: '',
          remote: false,
          easyApplyOnly: true,
          datePosted: null,
          under10Applicants: false,
          sortBy: 'Most relevant'
        },
        applicationSettings: {
          coverLetter: null,
          resumeUrl: null,
          phoneNumber: null
        }
      });

      setSessionId(task.id);
      localStorage.setItem('activeSessionId', task.id);
      
      // Set live view URL
      if (task.browserUrl) {
        setLiveViewUrl(task.browserUrl);
      }

      if (!hasContext) {
        addMessage({
          type: 'info',
          message: 'First time setup: Please log in to LinkedIn in the browser window above.'
        });
      }

      startPollingStatus(task.id);
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
      await linkedInJobSearchApi.pauseTask(sessionId);
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
      await linkedInJobSearchApi.resumeTask(sessionId);
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
      await linkedInJobSearchApi.stopTask(sessionId);
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
    if (stopPollingRef.current) {
      stopPollingRef.current();
    }
    setIsRunning(false);
    setIsPaused(false);
    setSessionId(null);
    localStorage.removeItem('activeSessionId');
    loadAppliedJobs();
  };

  const handleContinueIntervention = async () => {
    if (!sessionId) return;

    try {
      await linkedInJobSearchApi.continueTask(sessionId);
      setShowIntervention(false);
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

  const loadAppliedJobs = async () => {
    if (!sessionId) return;

    try {
      const jobs = await linkedInJobSearchApi.getAppliedJobs(sessionId);
      setAppliedJobs(jobs);
      
      // Add success messages for each applied job
      jobs.forEach(job => {
        if (job.applied) {
          addMessage({
            type: 'success',
            message: `Applied to ${job.jobTitle} at ${job.company}`,
            metadata: {
              jobTitle: job.jobTitle,
              company: job.company,
              jobUrl: job.jobUrl,
              applied: true
            }
          });
        }
      });
    } catch (error) {
      console.error('Failed to load applied jobs:', error);
    }
  };

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
        {showIntervention && (
          <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800">{interventionMessage}</p>
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

          {/* Metrics */}
          {isRunning && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-around text-sm">
              <div className="text-center">
                <div className="font-semibold text-gray-900">{jobsFound}</div>
                <div className="text-gray-500">Jobs Found</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600">{jobsApplied}</div>
                <div className="text-gray-500">Applied</div>
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