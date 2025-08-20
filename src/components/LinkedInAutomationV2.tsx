import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Zap, 
  Target, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  User,
  Mail,
  Lock,
  ExternalLink,
  Play,
  Pause,
  StopCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { invokeFunction, getStreamUrl, getAuthHeaders } from '../lib/edgeFunctions';

// Configuration interface matching existing LinkedInAutomationBot
interface BrowserUseConfig {
  jobTitle: string;
  location: string;
  locationId?: string;
  experience: string;
  remotePreference: string;
  jobType?: string;
  datePosted?: string;
  salaryMin?: string;
  salaryMax?: string;
  targetCount: string;
  applyToExternalJobs?: boolean;
  externalJobEmail?: string;
  externalJobPassword?: string;
  firstName?: string;
  lastName?: string;
  selectedModel?: string;
}

interface TaskStatus {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  steps?: any[];
  output?: any;
  error?: string;
  live_url?: string;
  step_count?: number;
}

export const LinkedInAutomationV2: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [jobPrompt, setJobPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [activityLogs, setActivityLogs] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  
  // Configuration state (matching existing structure)
  const [config, setConfig] = useState<BrowserUseConfig>({
    jobTitle: '',
    location: 'San Francisco Bay Area',
    locationId: '90000084',
    experience: 'Mid-Senior level',
    remotePreference: 'Remote',
    datePosted: undefined,
    targetCount: '10',
    applyToExternalJobs: false,
    externalJobEmail: '',
    externalJobPassword: '',
    firstName: '',
    lastName: '',
    selectedModel: 'gemini-2.0-flash'
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  // Add log message
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    setActivityLogs(prev => [...prev, `[${timestamp}] ${icon} ${message}`]);
  };
  
  // Parse prompt with Gemini
  const parseWithGemini = async () => {
    if (!jobPrompt.trim()) {
      toast.error('Please describe what job you\'re looking for');
      return;
    }
    
    setIsParsing(true);
    
    try {
      const { data, error } = await invokeFunction('gemini-parser', {
        body: { 
          prompt: jobPrompt,
          currentConfig: config
        }
      });
      
      if (error) throw error;
      
      if (data.parsed) {
        // Update config with parsed values
        setConfig(prevConfig => ({
          ...prevConfig,
          ...data.parsed
        }));
        
        // Highlight fields that were auto-filled
        setHighlightedFields(data.extractedFields || []);
        
        // Show success message
        const fieldsFound = data.extractedFields?.length || 0;
        toast.success(`Found ${fieldsFound} job parameters from your description`);
        
        // Clear highlights after 3 seconds
        setTimeout(() => setHighlightedFields([]), 3000);
      }
    } catch (error: any) {
      console.error('Gemini parsing error:', error);
      toast.error('Could not parse your request. Try being more specific.');
    } finally {
      setIsParsing(false);
    }
  };
  
  // Validate profile
  const validateProfile = async (): Promise<boolean> => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, resume_url, email')
      .eq('user_id', user?.id)
      .single();
    
    if (error || !profile) {
      toast.error('Could not load your profile');
      return false;
    }
    
    if (!profile.full_name || !profile.resume_url) {
      toast.error(
        <div className="flex flex-col gap-2">
          <span>Please complete your profile first</span>
          <button 
            onClick={() => navigate('/profile')}
            className="text-sm underline"
          >
            Go to Profile →
          </button>
        </div>
      );
      return false;
    }
    
    return true;
  };
  
  // Start automation
  const handleStart = async () => {
    // Validate profile
    if (!await validateProfile()) return;
    
    // Validate job title
    if (!config.jobTitle) {
      toast.error('Please specify what job you\'re looking for');
      return;
    }
    
    // Validate external job config if needed
    if (config.applyToExternalJobs) {
      if (!config.firstName || !config.lastName || 
          !config.externalJobEmail || !config.externalJobPassword) {
        toast.error('Please fill in all external application fields');
        return;
      }
    }
    
    setIsRunning(true);
    addLog('Starting LinkedIn automation...', 'info');
    
    try {
      // Start automation via edge function
      const { data, error } = await invokeFunction('automation-controller', {
        body: {
          action: 'start',
          userId: user?.id,
          data: { config }
        }
      });
      
      if (error) throw error;
      
      if (data.error) {
        if (data.error === 'incomplete_profile') {
          toast.error(data.message);
          navigate('/profile');
          return;
        }
        throw new Error(data.message || data.error);
      }
      
      // Success - set task and start streaming
      setCurrentTask({ 
        id: data.taskId, 
        status: 'running',
        live_url: data.liveUrl 
      });
      
      addLog(`Task started successfully. ID: ${data.taskId}`, 'success');
      if (data.liveUrl) {
        addLog(`Live preview available: ${data.liveUrl}`, 'info');
      }
      
      // Start SSE streaming
      startStreaming(data.taskId);
      
    } catch (error: any) {
      console.error('Start error:', error);
      toast.error(error.message || 'Failed to start automation');
      addLog(`Failed to start: ${error.message}`, 'error');
      setIsRunning(false);
    }
  };
  
  // Start SSE streaming
  const startStreaming = async (taskId: string) => {
    // Close existing stream if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    try {
      // Get auth headers
      const authHeaders = await getAuthHeaders();
      
      // Create new EventSource for SSE with auth
      const streamUrl = getStreamUrl('automation-stream', { taskId });
      
      // Note: EventSource doesn't support custom headers directly
      // We need to append the token as a query parameter for SSE
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session for streaming');
      }
      
      const eventSource = new EventSource(
        `${streamUrl}&access_token=${session.access_token}`
      );
      
      eventSourceRef.current = eventSource;
      
      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch(message.type) {
            case 'connected':
              addLog('Connected to automation stream', 'success');
              break;
              
            case 'status':
              const taskData = message.data;
              setCurrentTask(prev => ({
                ...prev,
                ...taskData
              }));
              
              // Log significant updates
              if (taskData.has_new_steps) {
                addLog(`Progress: ${taskData.step_count} steps completed`, 'info');
              }
              break;
              
            case 'intervention':
              if (message.data.type === 'login_required') {
                setShowLoginPrompt(true);
                addLog('Manual login required - please complete login in the browser', 'warning');
                toast.warning('Manual login required');
              }
              break;
              
            case 'complete':
              const result = message.data;
              if (result.status === 'completed' || result.status === 'finished') {
                addLog(`Automation completed successfully! ${result.total_steps} steps executed`, 'success');
                toast.success('Automation completed!');
              } else if (result.status === 'failed') {
                addLog(`Automation failed: ${result.error || 'Unknown error'}`, 'error');
                toast.error('Automation failed');
              }
              setIsRunning(false);
              eventSource.close();
              break;
              
            case 'error':
              addLog(`Stream error: ${message.error}`, 'error');
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
    
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        addLog('Connection to automation stream lost', 'warning');
        eventSource.close();
        setIsRunning(false);
      };
      
    } catch (error) {
      console.error('Failed to start streaming:', error);
      addLog('Failed to connect to stream', 'error');
    }
  };
  
  // Handle pause
  const handlePause = async () => {
    if (!currentTask) return;
    
    try {
      const { error } = await invokeFunction('automation-controller', {
        body: {
          action: 'pause',
          userId: user?.id,
          data: { taskId: currentTask.id }
        }
      });
      
      if (error) throw error;
      
      setCurrentTask(prev => prev ? { ...prev, status: 'paused' } : null);
      addLog('Automation paused', 'info');
      toast.info('Automation paused');
    } catch (error: any) {
      toast.error('Failed to pause automation');
    }
  };
  
  // Handle resume
  const handleResume = async () => {
    if (!currentTask) return;
    
    try {
      const { error } = await invokeFunction('automation-controller', {
        body: {
          action: 'resume',
          userId: user?.id,
          data: { taskId: currentTask.id }
        }
      });
      
      if (error) throw error;
      
      setCurrentTask(prev => prev ? { ...prev, status: 'running' } : null);
      setShowLoginPrompt(false);
      addLog('Automation resumed', 'success');
      toast.success('Automation resumed');
      
      // Restart streaming
      startStreaming(currentTask.id);
    } catch (error: any) {
      toast.error('Failed to resume automation');
    }
  };
  
  // Handle stop
  const handleStop = async () => {
    if (!currentTask) return;
    
    try {
      const { error } = await invokeFunction('automation-controller', {
        body: {
          action: 'stop',
          userId: user?.id,
          data: { taskId: currentTask.id }
        }
      });
      
      if (error) throw error;
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      setCurrentTask(null);
      setIsRunning(false);
      addLog('Automation stopped', 'info');
      toast.info('Automation stopped');
    } catch (error: any) {
      toast.error('Failed to stop automation');
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI-Powered Job Applications
          </h1>
          <p className="text-gray-600 mt-2">
            Tell me what you're looking for, and I'll handle the applications
          </p>
        </motion.div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Prompt Input */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">What job are you looking for?</h2>
                <Sparkles className="w-5 h-5 text-indigo-500" />
              </div>
              
              <div className="space-y-4">
                <textarea
                  value={jobPrompt}
                  onChange={(e) => setJobPrompt(e.target.value)}
                  placeholder="e.g., 'Senior React developer roles in NYC, $150k+, remote preferred, startup environment'"
                  className="w-full h-32 p-4 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none"
                  disabled={isRunning}
                />
                
                <button
                  onClick={parseWithGemini}
                  disabled={isParsing || !jobPrompt.trim() || isRunning}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Smart Fill
                    </>
                  )}
                </button>
              </div>
            </motion.div>
            
            {/* Parsed Configuration */}
            {config.jobTitle && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                <h3 className="text-lg font-semibold mb-4">Search Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 bg-gray-50 rounded-lg ${highlightedFields.includes('jobTitle') ? 'ring-2 ring-indigo-500' : ''}`}>
                    <span className="text-sm text-gray-600">Job Title</span>
                    <p className="font-medium">{config.jobTitle}</p>
                  </div>
                  <div className={`p-3 bg-gray-50 rounded-lg ${highlightedFields.includes('location') ? 'ring-2 ring-indigo-500' : ''}`}>
                    <span className="text-sm text-gray-600">Location</span>
                    <p className="font-medium">{config.location}</p>
                  </div>
                  <div className={`p-3 bg-gray-50 rounded-lg ${highlightedFields.includes('experience') ? 'ring-2 ring-indigo-500' : ''}`}>
                    <span className="text-sm text-gray-600">Experience</span>
                    <p className="font-medium">{config.experience}</p>
                  </div>
                  <div className={`p-3 bg-gray-50 rounded-lg ${highlightedFields.includes('targetCount') ? 'ring-2 ring-indigo-500' : ''}`}>
                    <span className="text-sm text-gray-600">Applications</span>
                    <p className="font-medium">{config.targetCount} jobs</p>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Mode Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Application Mode</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setConfig({ ...config, applyToExternalJobs: false })}
                  disabled={isRunning}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    !config.applyToExternalJobs 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  } disabled:opacity-50`}
                >
                  <Zap className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                  <div className="font-semibold">Easy Apply Only</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Quick LinkedIn applications
                  </div>
                </button>
                
                <button
                  onClick={() => setConfig({ ...config, applyToExternalJobs: true })}
                  disabled={isRunning}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    config.applyToExternalJobs 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  } disabled:opacity-50`}
                >
                  <Target className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                  <div className="font-semibold">All Jobs</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Including external sites
                  </div>
                </button>
              </div>
            </motion.div>
            
            {/* External Job Config */}
            <AnimatePresence>
              {config.applyToExternalJobs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-2xl shadow-lg p-6"
                >
                  <h3 className="text-lg font-semibold mb-4">External Application Settings</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Required for applying to jobs outside LinkedIn
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="w-4 h-4 inline mr-1" />
                        First Name
                      </label>
                      <input
                        type="text"
                        value={config.firstName}
                        onChange={(e) => setConfig({ ...config, firstName: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isRunning}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="w-4 h-4 inline mr-1" />
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={config.lastName}
                        onChange={(e) => setConfig({ ...config, lastName: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isRunning}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Mail className="w-4 h-4 inline mr-1" />
                        Email for External Sites
                      </label>
                      <input
                        type="email"
                        value={config.externalJobEmail}
                        onChange={(e) => setConfig({ ...config, externalJobEmail: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isRunning}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Lock className="w-4 h-4 inline mr-1" />
                        Password for External Sites
                      </label>
                      <input
                        type="password"
                        value={config.externalJobPassword}
                        onChange={(e) => setConfig({ ...config, externalJobPassword: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isRunning}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Action Buttons */}
            <div className="flex gap-4">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={!config.jobTitle}
                  className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Automation
                </button>
              ) : (
                <>
                  {currentTask?.status === 'paused' ? (
                    <button
                      onClick={handleResume}
                      className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={handlePause}
                      className="flex-1 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Pause className="w-5 h-5" />
                      Pause
                    </button>
                  )}
                  <button
                    onClick={handleStop}
                    className="flex-1 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Right Column - Status & Activity */}
          <div className="space-y-6">
            {/* Current Status */}
            {currentTask && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                <h3 className="text-lg font-semibold mb-4">Current Status</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      currentTask.status === 'running' ? 'bg-green-100 text-green-700' :
                      currentTask.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      currentTask.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {currentTask.status}
                    </span>
                  </div>
                  
                  {currentTask.step_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Steps Completed</span>
                      <span className="font-medium">{currentTask.step_count}</span>
                    </div>
                  )}
                  
                  {currentTask.live_url && (
                    <div className="pt-3 border-t">
                      <a
                        href={currentTask.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Live Browser
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            
            {/* Activity Feed */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold mb-4">Activity Feed</h3>
              
              <div className="h-96 overflow-y-auto space-y-2 text-sm">
                {activityLogs.length > 0 ? (
                  activityLogs.map((log, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-gray-700">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    No activity yet. Start an automation to see updates here.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Login Intervention Modal */}
        <AnimatePresence>
          {showLoginPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full"
              >
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-center mb-2">Manual Login Required</h3>
                <p className="text-gray-600 text-center mb-6">
                  LinkedIn needs you to log in manually. Please complete the login in the browser window.
                </p>
                
                <div className="space-y-3">
                  {currentTask?.live_url && (
                    <a
                      href={currentTask.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Open Browser & Login
                    </a>
                  )}
                  
                  <button
                    onClick={handleResume}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    I've Logged In - Continue
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};