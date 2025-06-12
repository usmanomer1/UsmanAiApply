import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, AlertTriangle, RefreshCw, LogIn, LogOut, Clock, Monitor, Loader2, ExternalLink, Info, Wifi, WifiOff, Eye, User, ArrowRight, Rows as Browser, MousePointer, Globe, ExternalLinkIcon } from 'lucide-react';
import { LinkedInSessionManager, LinkedInAutomation, TaskMonitor, BrowserUseTask } from '../../lib/browserUseAPI';
import { LiveBrowserPreview } from './LiveBrowserPreview';
import toast from 'react-hot-toast';

interface LinkedInSession {
  session_id: string;
  cookies: any[];
  user_id: string;
  created_at: string;
  expires_at: string;
  is_valid: boolean;
}

interface LinkedInSessionManagerProps {
  onSessionChange?: (status: 'active' | 'expired' | 'invalid' | 'disconnected') => void;
}

export const LinkedInSessionManagerComponent: React.FC<LinkedInSessionManagerProps> = ({
  onSessionChange
}) => {
  const [session, setSession] = useState<LinkedInSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [currentTask, setCurrentTask] = useState<BrowserUseTask | null>(null);
  const [taskLogs, setTaskLogs] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [initializationStep, setInitializationStep] = useState<'idle' | 'starting' | 'waiting_for_login' | 'detecting_login' | 'completed'>('idle');

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (onSessionChange) {
      onSessionChange(getSessionStatus());
    }
  }, [session, onSessionChange]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const existingSession = await LinkedInSessionManager.getSession();
      setSession(existingSession);
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('Failed to load LinkedIn session');
    } finally {
      setLoading(false);
    }
  };

  const initializeSession = async () => {
    try {
      setInitializing(true);
      setTaskLogs([]);
      setCurrentTask(null);
      setShowInstructions(true);
      setInitializationStep('starting');
      
      toast('Starting LinkedIn session initialization...', {
        duration: 3000,
        icon: '🚀'
      });
      
      const taskId = await LinkedInAutomation.initializeSession();
      
      setInitializationStep('waiting_for_login');
      
      await TaskMonitor.startMonitoring(
        taskId,
        (task) => {
          setCurrentTask(task);
          if (task.logs) {
            setTaskLogs(task.logs);
            
            // Update step based on logs
            const latestLog = task.logs[task.logs.length - 1];
            if (latestLog?.includes('login page')) {
              setInitializationStep('waiting_for_login');
            } else if (latestLog?.includes('detecting') || latestLog?.includes('monitoring')) {
              setInitializationStep('detecting_login');
            }
          }
        },
        async (task) => {
          setInitializationStep('completed');
          
          if (task.result && task.result.type === 'session_initialized' && task.result.success) {
            const newSession = {
              session_id: task.result.session_id,
              cookies: task.result.cookies || [],
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
              is_valid: true,
            };
            
            await LinkedInSessionManager.saveSession(newSession);
            await loadSession();
            toast.success('LinkedIn session initialized successfully!');
            setShowInstructions(false);
          } else {
            toast.error('Failed to initialize LinkedIn session');
          }
          setCurrentTask(null);
          setInitializing(false);
          setInitializationStep('idle');
        },
        (error) => {
          console.error('Session initialization failed:', error);
          toast.error(`Session initialization failed: ${error}`);
          setCurrentTask(null);
          setInitializing(false);
          setInitializationStep('idle');
          setShowInstructions(false);
        }
      );
    } catch (error) {
      console.error('Error initializing session:', error);
      toast.error('Failed to start session initialization');
      setInitializing(false);
      setInitializationStep('idle');
      setShowInstructions(false);
    }
  };

  const refreshSession = async () => {
    try {
      const taskId = await LinkedInSessionManager.refreshSession();
      setInitializing(true);
      setTaskLogs([]);
      setCurrentTask(null);
      setShowInstructions(true);
      setInitializationStep('starting');
      
      await TaskMonitor.startMonitoring(
        taskId,
        (task) => {
          setCurrentTask(task);
          if (task.logs) {
            setTaskLogs(task.logs);
          }
        },
        async (task) => {
          if (task.result && task.result.type === 'session_initialized' && task.result.success) {
            await loadSession();
            toast.success('LinkedIn session refreshed successfully!');
            setShowInstructions(false);
          } else {
            toast.error('Failed to refresh LinkedIn session');
          }
          setCurrentTask(null);
          setInitializing(false);
          setInitializationStep('idle');
        },
        (error) => {
          console.error('Session refresh failed:', error);
          toast.error(`Session refresh failed: ${error}`);
          setCurrentTask(null);
          setInitializing(false);
          setInitializationStep('idle');
          setShowInstructions(false);
        }
      );
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Failed to refresh session');
    }
  };

  const invalidateSession = async () => {
    try {
      await LinkedInSessionManager.invalidateSession();
      setSession(null);
      toast.success('LinkedIn session disconnected');
    } catch (error) {
      console.error('Error invalidating session:', error);
      toast.error('Failed to disconnect session');
    }
  };

  const cancelInitialization = async () => {
    if (currentTask) {
      try {
        await TaskMonitor.cancelTask(currentTask.task_id);
        setCurrentTask(null);
        setInitializing(false);
        setInitializationStep('idle');
        setShowInstructions(false);
        toast.success('Session initialization canceled');
      } catch (error) {
        console.error('Error canceling task:', error);
        toast.error('Failed to cancel initialization');
      }
    }
  };

  const getSessionStatus = () => {
    if (!session) return 'disconnected';
    
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (!session.is_valid) return 'invalid';
    if (expiresAt <= now) return 'expired';
    if (LinkedInSessionManager.isSessionExpiring(session)) return 'expiring';
    
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 dark:text-green-400';
      case 'expiring': return 'text-yellow-600 dark:text-yellow-400';
      case 'expired': return 'text-red-600 dark:text-red-400';
      case 'invalid': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Wifi className="w-5 h-5 text-green-500" />;
      case 'expiring': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'expired': return <WifiOff className="w-5 h-5 text-red-500" />;
      case 'invalid': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <WifiOff className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'premium-badge-green',
      expiring: 'premium-badge-yellow',
      expired: 'premium-badge-red',
      invalid: 'premium-badge-red',
      disconnected: 'premium-badge bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
    };
    return badges[status as keyof typeof badges] || badges.disconnected;
  };

  const formatTimeRemaining = () => {
    if (!session) return '';
    
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const getStepInstructions = () => {
    switch (initializationStep) {
      case 'starting':
        return {
          title: 'Initializing Browser Session...',
          description: 'Starting remote browser automation and navigating to LinkedIn',
          icon: <Loader2 className="w-5 h-5 animate-spin text-blue-500" />,
          showBrowserNote: true
        };
      case 'waiting_for_login':
        return {
          title: 'Remote Browser Ready - Login Required',
          description: 'The remote browser has opened LinkedIn. You can see it in the live preview below.',
          icon: <Globe className="w-5 h-5 text-blue-500" />,
          showBrowserNote: false
        };
      case 'detecting_login':
        return {
          title: 'Detecting Login Status...',
          description: 'Monitoring the remote browser for successful login completion',
          icon: <Eye className="w-5 h-5 text-blue-500" />,
          showBrowserNote: false
        };
      case 'completed':
        return {
          title: 'Session Initialized Successfully!',
          description: 'LinkedIn session has been created and saved securely',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          showBrowserNote: false
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="premium-card p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600 dark:text-gray-300">Loading LinkedIn session...</span>
        </div>
      </div>
    );
  }

  const status = getSessionStatus();
  const stepInfo = getStepInstructions();

  return (
    <div className="space-y-6">
      {/* Session Status Card */}
      <div className="premium-card p-6 hover-lift">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">LinkedIn Session</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">Remote browser automation session</p>
            </div>
          </div>
          
          <button
            onClick={loadSession}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh session status"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status Display */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="flex items-center space-x-3">
              {getStatusIcon(status)}
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`font-semibold ${getStatusColor(status)}`}>
                    {status === 'active' && 'Connected & Active'}
                    {status === 'expiring' && 'Connected (Expiring Soon)'}
                    {status === 'expired' && 'Session Expired'}
                    {status === 'invalid' && 'Session Invalid'}
                    {status === 'disconnected' && 'Not Connected'}
                  </span>
                  <span className={getStatusBadge(status)}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>
                {session && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatTimeRemaining()}
                  </div>
                )}
              </div>
            </div>
            
            {session && (
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Session ID</div>
                <div className="text-xs font-mono text-gray-600 dark:text-gray-300">
                  {session.session_id.substring(0, 8)}...
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {!session || status === 'expired' || status === 'invalid' ? (
              <button
                onClick={initializeSession}
                disabled={initializing}
                className="premium-button-primary flex-1"
              >
                {initializing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Initialize LinkedIn Session
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={refreshSession}
                  disabled={initializing}
                  className="premium-button-secondary flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Session
                </button>
                <button
                  onClick={invalidateSession}
                  className="premium-button-secondary text-red-600 hover:text-red-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </button>
              </>
            )}
          </div>

          {/* Session Expiry Warning */}
          {session && status === 'expiring' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium mb-1">Session Expiring Soon</p>
                  <p>
                    Your LinkedIn session will expire in {formatTimeRemaining()}. 
                    Consider refreshing it to avoid interruptions during automation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-2">How Remote Browser Sessions Work:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Browser automation runs on secure cloud servers (not your local machine)</li>
                  <li>• You can view the remote browser through the live preview below</li>
                  <li>• Login to LinkedIn in the remote browser when prompted</li>
                  <li>• The system detects successful login and saves your session securely</li>
                  <li>• Sessions expire after 24 hours for security and must be refreshed</li>
                  <li>• All data is encrypted and stored securely</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Instructions Modal */}
      <AnimatePresence>
        {showInstructions && stepInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="premium-card p-6 border-2 border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {stepInfo.icon}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stepInfo.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {stepInfo.description}
                  </p>
                </div>
              </div>
              
              {initializing && (
                <button
                  onClick={cancelInitialization}
                  className="premium-button-secondary text-red-600 hover:text-red-700 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Browser Note for Starting Step */}
            {stepInfo.showBrowserNote && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-start space-x-3">
                  <Globe className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Remote Browser Automation</p>
                    <p>
                      The browser automation runs on secure cloud servers, not on your local machine. 
                      You'll see the remote browser activity in the live preview below once it starts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step-specific content */}
            {initializationStep === 'waiting_for_login' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-2">Login Instructions:</p>
                      <ol className="space-y-1 list-decimal list-inside">
                        <li>View the remote browser in the live preview below</li>
                        <li>The LinkedIn login page should be visible</li>
                        <li>Enter your LinkedIn credentials in the remote browser</li>
                        <li>Complete any 2FA or security challenges if prompted</li>
                        <li>Wait for the system to detect your successful login</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="text-sm text-green-800 dark:text-green-200">
                      <p className="font-medium mb-1">Security Note</p>
                      <p>Your login credentials are entered directly into LinkedIn's official website. We never store or access your password.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Browser Preview */}
            {currentTask && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900 dark:text-white flex items-center">
                    <Monitor className="w-4 h-4 mr-2" />
                    Live Remote Browser View
                  </h5>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live Updates</span>
                  </div>
                </div>
                
                <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <LiveBrowserPreview
                    taskId={currentTask.task_id}
                    isActive={true}
                    className="h-80"
                  />
                </div>
                
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                  This is a live view of the remote browser running on our secure servers
                </div>
              </div>
            )}

            {/* Progress Info */}
            {currentTask && (
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentTask.step_count}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Steps</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${currentTask.cost_usd.toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Cost</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentTask.status}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                </div>
              </div>
            )}

            {/* Live Logs */}
            {taskLogs.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Activity Log</h5>
                <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 h-24 overflow-y-auto">
                  <div className="space-y-1">
                    {taskLogs.slice(-5).map((log, index) => (
                      <div key={index} className="text-xs text-gray-300 font-mono">
                        <span className="text-gray-500">
                          [{new Date().toLocaleTimeString()}]
                        </span>
                        <span className="ml-2">{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};