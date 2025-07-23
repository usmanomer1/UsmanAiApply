import React, { useState, useEffect, useRef } from 'react';
import { Settings, Sparkles, Pause, Play, Square, ExternalLink, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
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

export default function LinkedInAutomationNew() {
  const { user } = useAuth();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus['session'] | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [showIntervention, setShowIntervention] = useState(false);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([]);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    // Check if intervention is required
    if (sessionStatus?.interventionRequired && sessionStatus.interventionDetails) {
      setShowIntervention(true);
    }
  }, [sessionStatus]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [searchPrompt]);

  const handleStart = async () => {
    if (!config?.resumeUrl || !searchPrompt.trim()) {
      alert('Please configure your profile and enter a job search query');
      return;
    }

    setIsStarting(true);
    try {
      const result = await linkedinAutomationApi.startAutomation({
        userId: user!.id,
        searchPrompt: searchPrompt.trim(),
        resumeUrl: config.resumeUrl,
        resumeMetadata: config.resumeMetadata!,
        config: {
          maxApplications: 50,
          externalApplicationConfig: config.externalApplicationConfig
        }
      });

      setSessionId(result.sessionId);
      setLiveViewUrl(result.liveViewUrl);

      // Start polling for status
      stopPollingRef.current = linkedinAutomationApi.pollStatus(
        result.sessionId,
        (status) => {
          setSessionStatus(status);
          
          // Load applied jobs when complete
          if (status.status === 'COMPLETED') {
            loadAppliedJobs(result.sessionId);
          }
        }
      );
    } catch (error: any) {
      alert(error.message || 'Failed to start automation');
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
      if (sessionStatus.status === 'RUNNING') {
        await linkedinAutomationApi.pauseSession(sessionId);
      } else if (sessionStatus.status === 'PAUSED') {
        await linkedinAutomationApi.resumeSession(sessionId);
      }
    } catch (error: any) {
      alert(error.message || 'Operation failed');
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;

    if (confirm('Are you sure you want to stop the automation?')) {
      try {
        await linkedinAutomationApi.stopSession(sessionId);
        stopPollingRef.current?.();
        setSessionId(null);
        setSessionStatus(null);
        setLiveViewUrl(null);
        setAppliedJobs([]);
      } catch (error: any) {
        alert(error.message || 'Failed to stop automation');
      }
    }
  };

  const handleContinueAfterIntervention = async () => {
    if (!sessionId) return;

    try {
      await linkedinAutomationApi.continueAfterIntervention(sessionId);
      setShowIntervention(false);
    } catch (error: any) {
      alert(error.message || 'Failed to continue automation');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-400" />;
      case 'PAUSED':
        return <Pause className="w-5 h-5 text-yellow-400" />;
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'INTERVENTION_REQUIRED':
        return <AlertCircle className="w-5 h-5 text-orange-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'text-blue-400';
      case 'PAUSED': return 'text-yellow-400';
      case 'COMPLETED': return 'text-green-400';
      case 'FAILED': return 'text-red-400';
      case 'INTERVENTION_REQUIRED': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const progressPercentage = sessionStatus?.progress.totalJobs 
    ? (sessionStatus.progress.appliedJobs / sessionStatus.progress.totalJobs) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Settings Button */}
      <button
        onClick={() => setShowConfigModal(true)}
        className="absolute top-6 right-6 p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 shadow-lg z-40"
      >
        <Settings className="w-5 h-5 text-gray-700" />
      </button>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {!sessionId ? (
          // Initial State - Prompt Input
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="w-full max-w-2xl">
              <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Job Search Agent
              </h1>
              <p className="text-center text-gray-400 mb-8">
                Tell me what kind of job you're looking for
              </p>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={searchPrompt}
                  onChange={(e) => setSearchPrompt(e.target.value)}
                  placeholder="e.g., Senior React developer jobs in San Francisco with good benefits and remote options"
                  className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4 pr-14 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none transition-all duration-200 min-h-[120px]"
                  disabled={isStarting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleStart();
                    }
                  }}
                />
                <button
                  onClick={handleStart}
                  disabled={isStarting || !searchPrompt.trim() || !config?.resumeUrl}
                  className={`absolute bottom-4 right-4 p-3 rounded-xl transition-all duration-200 ${
                    isStarting || !searchPrompt.trim() || !config?.resumeUrl
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg'
                  }`}
                >
                  {isStarting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </button>
              </div>

              {!config?.resumeUrl && (
                <p className="text-center text-orange-400 text-sm mt-4">
                  Please configure your profile and upload your resume to get started
                </p>
              )}
            </div>
          </div>
        ) : (
          // Active Automation State
          <div className="space-y-6">
            {/* Status Header */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(sessionStatus?.status || '')}
                  <h2 className={`text-2xl font-semibold ${getStatusColor(sessionStatus?.status || '')}`}>
                    {sessionStatus?.status.replace('_', ' ')}
                  </h2>
                </div>
                {liveViewUrl && (
                  <a
                    href={liveViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <span>Live View</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{sessionStatus?.progress.appliedJobs || 0} / {sessionStatus?.progress.totalJobs || 0} jobs</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{sessionStatus?.progress.appliedJobs || 0}</p>
                  <p className="text-xs text-gray-600">Applied</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{sessionStatus?.progress.skippedJobs || 0}</p>
                  <p className="text-xs text-gray-600">Skipped</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{sessionStatus?.progress.failedJobs || 0}</p>
                  <p className="text-xs text-gray-600">Failed</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{sessionStatus?.progress.processedJobs || 0}</p>
                  <p className="text-xs text-gray-600">Processed</p>
                </div>
              </div>
            </div>

            {/* Current Job */}
            {sessionStatus?.currentJob && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Currently Processing</h3>
                <div className="space-y-2">
                  <p className="text-xl font-medium text-gray-900">{sessionStatus.currentJob.title}</p>
                  <p className="text-gray-600">{sessionStatus.currentJob.company}</p>
                  <p className="text-sm text-gray-500">{sessionStatus.currentJob.location}</p>
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={handlePauseResume}
                disabled={!['RUNNING', 'PAUSED'].includes(sessionStatus?.status || '')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl font-medium transition-all duration-200 ${
                  ['RUNNING', 'PAUSED'].includes(sessionStatus?.status || '')
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                }`}
              >
                {sessionStatus?.status === 'RUNNING' ? (
                  <>
                    <Pause className="w-5 h-5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Resume</span>
                  </>
                )}
              </button>
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center space-x-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-medium transition-all duration-200"
              >
                <Square className="w-5 h-5" />
                <span>Stop</span>
              </button>
            </div>

            {/* Applied Jobs */}
            {sessionStatus?.status === 'COMPLETED' && appliedJobs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Applied Jobs</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {appliedJobs.map((job) => (
                    <div key={job.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{job.title}</h4>
                          <p className="text-sm text-gray-600">{job.company} • {job.location}</p>
                          {job.errorMessage && (
                            <p className="text-sm text-red-600 mt-1">{job.errorMessage}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`text-sm ${
                            job.applicationStatus === 'SUCCESS' ? 'text-green-600' :
                            job.applicationStatus === 'ALREADY_APPLIED' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {job.applicationStatus === 'SUCCESS' ? 'Applied' :
                             job.applicationStatus === 'ALREADY_APPLIED' ? 'Already Applied' :
                             'Failed'}
                          </span>
                          <a
                            href={job.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      <LinkedInConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSave={(newConfig) => setConfig(newConfig)}
        initialConfig={config || undefined}
      />

      {/* Intervention Modal */}
      {showIntervention && sessionStatus?.interventionDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Action Required</h2>
              <p className="text-gray-600 mt-2">{sessionStatus.interventionDetails.message}</p>
            </div>
            <div className="p-6">
              <iframe
                src={sessionStatus.interventionDetails.liveViewUrl}
                className="w-full h-[60vh] rounded-lg border border-gray-200"
                title="LinkedIn Browser View"
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleContinueAfterIntervention}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
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