import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  AlertCircle, 
  Activity, 
  Eye, 
  ExternalLink, 
  TrendingUp, 
  Zap, 
  Info,
  Clock,
  CheckCircle,
  BarChart3,
  Cpu,
  ChevronDown,
  Monitor,
  Briefcase,
  Lock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PaywallModal from './ui/PaywallModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import browserUseSDK, { BrowserUseConfig, StreamEvent } from '../lib/browserUseSDK';
import { 
  getUserUsage, 
  canPerformAction, 
  createAutomationSession, 
  updateAutomationSession
} from '../lib/usageTracking';

interface TaskStatus {
  id: string;
  status: 'created' | 'running' | 'paused' | 'finished' | 'failed' | 'stopped';
  live_url?: string;
  steps?: any[];
  output?: string;
  error?: string;
}

export default function LinkedInAutomationBotV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Core state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  
  // Activity feed
  const [activities, setActivities] = useState<any[]>([]);
  const [showIntervention, setShowIntervention] = useState(false);
  const [interventionMessage, setInterventionMessage] = useState('');
  const [interventionType, setInterventionType] = useState<'login' | '2fa' | null>(null);
  
  // Config state
  const [config, setConfig] = useState<BrowserUseConfig>({
    jobTitle: '',
    location: '',
    targetCount: 10,
    linkedinEmail: '',
    linkedinPassword: '',
    customInstructions: '',
    extractJobs: true,
  });
  
  // UI state
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const activityFeedRef = useRef<HTMLDivElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Check for active session on mount
  useEffect(() => {
    checkActiveSession();
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
      }
    };
  }, []);

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityFeedRef.current) {
      activityFeedRef.current.scrollTop = activityFeedRef.current.scrollHeight;
    }
  }, [activities]);

  const checkActiveSession = async () => {
    try {
      setLoading(true);
      const result = await browserUseSDK.getActiveSession();
      
      if (result.active && result.session) {
        // Resume existing session
        setTaskId(result.session.task_id);
        setSessionId(result.session.id);
        setTaskStatus(result.task);
        setLiveUrl(result.session.live_view_url || result.task?.live_url);
        setIsRunning(result.session.status === 'active');
        setIsPaused(result.session.status === 'paused');
        
        // Restore config
        if (result.session.config) {
          setConfig(result.session.config);
        }
        
        // Start streaming if active
        if (result.session.status === 'active' || result.session.status === 'paused') {
          startStreaming(result.session.task_id);
        }
        
        addActivity('Session restored', 'info', {
          status: result.session.status,
          task_id: result.session.task_id
        });
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = (taskId: string) => {
    // Clean up previous stream
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
    }

    // Start new stream
    streamCleanupRef.current = browserUseSDK.streamTaskUpdates(
      taskId,
      (event: StreamEvent) => {
        handleStreamEvent(event);
      },
      (error) => {
        console.error('Stream error:', error);
        addActivity('Stream connection error', 'error', { error: error.message });
      }
    );
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'status':
        setTaskStatus(prev => ({ ...prev, status: event.data.status }));
        if (event.data.live_url) {
          setLiveUrl(event.data.live_url);
        }
        break;
        
      case 'step':
        addActivity(
          `Step ${event.data.step}: ${event.data.goal}`,
          'info',
          {
            evaluation: event.data.evaluation,
            url: event.data.url
          }
        );
        break;
        
      case 'intervention':
        handleIntervention(event.data);
        break;
        
      case 'jobs_extracted':
        addActivity(
          `Extracted ${event.data.length} job listings`,
          'success',
          { jobs: event.data }
        );
        break;
        
      case 'output':
        addActivity('Task completed', 'success', { output: event.data });
        break;
        
      case 'complete':
        handleTaskComplete(event.data);
        break;
        
      case 'error':
        addActivity('Error occurred', 'error', { message: event.data.message });
        break;
    }
  };

  const handleIntervention = (data: any) => {
    setShowIntervention(true);
    setInterventionType(data.type === '2fa_required' ? '2fa' : 'login');
    setInterventionMessage(data.message);
    
    // Add prominent activity
    addActivity(
      data.message,
      'warning',
      {
        type: data.type,
        live_url: data.live_url,
        timeout: data.timeout
      }
    );
    
    // Auto-hide after timeout if 2FA
    if (data.type === '2fa_required' && data.timeout) {
      setTimeout(() => {
        setShowIntervention(false);
        setInterventionType(null);
      }, data.timeout * 1000);
    }
  };

  const handleTaskComplete = (data: any) => {
    setIsRunning(false);
    setTaskStatus(prev => ({ ...prev, status: data.status }));
    
    // Clean up stream
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
    
    addActivity(
      `Task ${data.status === 'finished' ? 'completed successfully' : data.status}`,
      data.status === 'finished' ? 'success' : 'info',
      data
    );
  };

  const addActivity = (message: string, type: 'info' | 'success' | 'warning' | 'error', data?: any) => {
    const activity = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString(),
      data
    };
    setActivities(prev => [...prev, activity]);
  };

  const handleStart = async () => {
    if (!config.jobTitle || !config.location || !config.linkedinEmail || !config.linkedinPassword) {
      toast.error('Please fill in all required fields including password');
      return;
    }

    // Check usage limits
    const canUse = await canPerformAction(user!.id, 'auto_apply');
    if (!canUse) {
      toast.error('You have reached your automation limit for this billing period');
      setShowPaywall(true);
      return;
    }

    try {
      setIsRunning(true);
      setActivities([]);
      
      // Create task
      const result = await browserUseSDK.createTask(config);
      
      setTaskId(result.task_id);
      setSessionId(result.session_id);
      
      // Start streaming updates
      startStreaming(result.task_id);
      
      // Track usage
      await createAutomationSession(
        user!.id,
        result.task_id,
        config.jobTitle,
        config.location,
        config.targetCount
      );
      
      addActivity('Automation started', 'success', {
        task_id: result.task_id,
        session_id: result.session_id
      });
      
      toast.success('Automation started successfully');
    } catch (error: any) {
      console.error('Start error:', error);
      toast.error(error.message || 'Failed to start automation');
      setIsRunning(false);
    }
  };

  const handlePause = async () => {
    if (!taskId) return;
    
    try {
      await browserUseSDK.pauseTask(taskId);
      setIsPaused(true);
      addActivity('Automation paused', 'info');
      toast.success('Automation paused');
    } catch (error: any) {
      console.error('Pause error:', error);
      toast.error(error.message || 'Failed to pause automation');
    }
  };

  const handleResume = async () => {
    if (!taskId) return;
    
    try {
      await browserUseSDK.resumeTask(taskId);
      setIsPaused(false);
      addActivity('Automation resumed', 'info');
      toast.success('Automation resumed');
    } catch (error: any) {
      console.error('Resume error:', error);
      toast.error(error.message || 'Failed to resume automation');
    }
  };

  const handleStop = async () => {
    if (!taskId) return;
    
    try {
      await browserUseSDK.stopTask(taskId);
      setIsRunning(false);
      setIsPaused(false);
      
      // Clean up stream
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
        streamCleanupRef.current = null;
      }
      
      // Update session
      if (taskId) {
        await updateAutomationSession(taskId, {
          status: 'stopped'
        });
      }
      
      addActivity('Automation stopped', 'warning');
      toast.success('Automation stopped');
      
      // Clear state
      setTaskId(null);
      setSessionId(null);
      setTaskStatus(null);
      setLiveUrl(null);
    } catch (error: any) {
      console.error('Stop error:', error);
      toast.error(error.message || 'Failed to stop automation');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {showPaywall && (
        <PaywallModal 
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="auto_apply"
        />
      )}
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">LinkedIn Automation</h1>
              <p className="text-gray-600 mt-1">AI-powered job application assistant</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isRunning && (
              <Badge variant="outline" className="px-3 py-1.5">
                <Activity className="w-4 h-4 mr-2 animate-pulse" />
                {isPaused ? 'Paused' : 'Running'}
              </Badge>
            )}
            
            <Button
              variant="outline"
              onClick={() => setShowConfig(!showConfig)}
              disabled={isRunning}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </Button>
          </div>
        </div>
      </div>

      {/* Intervention Alert */}
      <AnimatePresence>
        {showIntervention && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 mb-2">
                      {interventionType === '2fa' ? 'Two-Factor Authentication Required' : 'Manual Login Required'}
                    </h3>
                    <p className="text-orange-800 mb-4">{interventionMessage}</p>
                    {liveUrl && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(liveUrl, '_blank')}
                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Browser Window
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configuration Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Automation Configuration</CardTitle>
                <CardDescription>Set up your job search parameters and credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Title *
                    </label>
                    <Input
                      value={config.jobTitle}
                      onChange={(e) => setConfig({ ...config, jobTitle: e.target.value })}
                      placeholder="e.g., Software Engineer"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location *
                    </label>
                    <Input
                      value={config.location}
                      onChange={(e) => setConfig({ ...config, location: e.target.value })}
                      placeholder="e.g., San Francisco, CA"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LinkedIn Email *
                    </label>
                    <Input
                      type="email"
                      value={config.linkedinEmail}
                      onChange={(e) => setConfig({ ...config, linkedinEmail: e.target.value })}
                      placeholder="your@email.com"
                      disabled={isRunning}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LinkedIn Password *
                    </label>
                    <div className="relative">
                      <Input
                        type="password"
                        value={config.linkedinPassword}
                        onChange={(e) => setConfig({ ...config, linkedinPassword: e.target.value })}
                        placeholder="Enter your password"
                        disabled={isRunning}
                      />
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <Lock className="w-3 h-3" />
                        <span>Password is encrypted and never stored</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Applications
                    </label>
                    <Input
                      type="number"
                      value={config.targetCount}
                      onChange={(e) => setConfig({ ...config, targetCount: parseInt(e.target.value) || 10 })}
                      min="1"
                      max="50"
                      disabled={isRunning}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>If 2FA is enabled on your LinkedIn account, you'll have 30 seconds to enter the code when prompted</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Instructions (Optional)
                  </label>
                  <textarea
                    value={config.customInstructions}
                    onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Add any specific preferences or instructions..."
                    disabled={isRunning}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Live Preview</CardTitle>
              {liveUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(liveUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {liveUrl ? (
              <div className="relative w-full h-[600px] bg-gray-100 rounded-lg overflow-hidden">
                <iframe
                  src={browserUseSDK.getIframeSafeUrl(liveUrl)}
                  className="w-full h-full border-0"
                  title="Browser Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
                {!browserUseSDK.isIframeAllowed(liveUrl) && (
                  <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="mb-3">Preview not available in iframe</p>
                      <Button
                        variant="outline"
                        onClick={() => window.open(liveUrl, '_blank')}
                        className="bg-white text-gray-900 hover:bg-gray-100"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in New Tab
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-[600px] bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Browser preview will appear here</p>
                  <p className="text-sm text-gray-400 mt-1">Start automation to see live preview</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Activity Feed</CardTitle>
              <Badge variant="outline">
                {activities.length} events
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              ref={activityFeedRef}
              className="h-[600px] overflow-y-auto space-y-3 pr-2"
            >
              {activities.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No activity yet</p>
                    <p className="text-sm text-gray-400 mt-1">Start automation to see real-time logs</p>
                  </div>
                </div>
              ) : (
                activities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border ${
                      activity.type === 'error' ? 'bg-red-50 border-red-200' :
                      activity.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                      activity.type === 'success' ? 'bg-green-50 border-green-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded ${
                        activity.type === 'error' ? 'bg-red-100' :
                        activity.type === 'warning' ? 'bg-orange-100' :
                        activity.type === 'success' ? 'bg-green-100' :
                        'bg-gray-100'
                      }`}>
                        {activity.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-600" /> :
                         activity.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-orange-600" /> :
                         activity.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                         <Info className="w-4 h-4 text-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          activity.type === 'error' ? 'text-red-900' :
                          activity.type === 'warning' ? 'text-orange-900' :
                          activity.type === 'success' ? 'text-green-900' :
                          'text-gray-900'
                        }`}>
                          {activity.message}
                        </p>
                        {activity.data && (
                          <div className="mt-1">
                            {activity.data.evaluation && (
                              <p className="text-xs text-gray-600">{activity.data.evaluation}</p>
                            )}
                            {activity.data.url && (
                              <p className="text-xs text-gray-500 truncate">{activity.data.url}</p>
                            )}
                            {activity.data.jobs && (
                              <p className="text-xs text-gray-600">
                                Found {activity.data.jobs.filter((j: any) => j.applied).length} applied jobs
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Buttons */}
      <div className="mt-6 flex justify-center gap-4">
        {!isRunning ? (
          <Button
            onClick={handleStart}
            size="lg"
            className="px-8"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Agent
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button
                onClick={handleResume}
                size="lg"
                variant="outline"
              >
                <Play className="w-5 h-5 mr-2" />
                Resume
              </Button>
            ) : (
              <Button
                onClick={handlePause}
                size="lg"
                variant="outline"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
            )}
            <Button
              onClick={handleStop}
              size="lg"
              variant="destructive"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}