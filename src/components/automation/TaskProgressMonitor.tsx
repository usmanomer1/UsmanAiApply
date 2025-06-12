import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, 
  Activity, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  Pause,
  Square,
  Play,
  Target,
  TrendingUp,
  Zap,
  Camera,
  Film,
  Maximize2
} from 'lucide-react';
import { BrowserUseTask } from '../../lib/browserUseAPI';
import { LiveBrowserPreview } from './LiveBrowserPreview';

interface TaskProgressMonitorProps {
  task: BrowserUseTask | null;
  logs: string[];
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  canControl?: boolean;
  isPaused?: boolean;
  progress?: {
    completedApplications: number;
    failedApplications: number;
    totalJobs: number;
    currentJobIndex: number;
  };
}

export const TaskProgressMonitor: React.FC<TaskProgressMonitorProps> = ({
  task,
  logs,
  onPause,
  onResume,
  onStop,
  canControl = false,
  isPaused = false,
  progress,
}) => {
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  // Clear preview error when task changes
  useEffect(() => {
    setPreviewError(null);
  }, [task?.task_id]);

  if (!task && !logs.length) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600 dark:text-blue-400';
      case 'paused': return 'text-yellow-600 dark:text-yellow-400';
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      case 'cancelled': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'paused': return <Pause className="w-5 h-5" />;
      case 'completed': return <CheckCircle className="w-5 h-5" />;
      case 'failed': return <AlertTriangle className="w-5 h-5" />;
      case 'cancelled': return <Square className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getProgressPercentage = () => {
    if (!progress || progress.totalJobs === 0) return 0;
    return Math.round((progress.currentJobIndex / progress.totalJobs) * 100);
  };

  const getSuccessRate = () => {
    if (!progress) return 0;
    const total = progress.completedApplications + progress.failedApplications;
    if (total === 0) return 0;
    return Math.round((progress.completedApplications / total) * 100);
  };

  const isTaskActive = task && (task.status === 'running' || task.status === 'paused') && !isPaused;

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <div className="premium-card p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Automation Progress</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">Live automation monitoring with browser preview</p>
            </div>
          </div>

          {canControl && (
            <div className="flex space-x-2">
              {isPaused ? (
                onResume && (
                  <button
                    onClick={onResume}
                    className="premium-button-secondary text-sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </button>
                )
              ) : (
                onPause && task?.status === 'running' && (
                  <button
                    onClick={onPause}
                    className="premium-button-secondary text-sm"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </button>
                )
              )}
              {onStop && (
                <button
                  onClick={onStop}
                  className="premium-button-secondary text-red-600 hover:text-red-700 text-sm"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </button>
              )}
            </div>
          )}
        </div>

        {/* Overall Progress */}
        {progress && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Overall Progress
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {progress.currentJobIndex} of {progress.totalJobs} jobs
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{getProgressPercentage()}% complete</span>
              <span>{progress.totalJobs - progress.currentJobIndex} remaining</span>
            </div>
          </div>
        )}

        {/* Status and Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {task && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className={getStatusColor(isPaused ? 'paused' : task.status)}>
                  {getStatusIcon(isPaused ? 'paused' : task.status)}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
              </div>
              <div className={`font-semibold ${getStatusColor(isPaused ? 'paused' : task.status)}`}>
                {isPaused ? 'Paused' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </div>
            </div>
          )}

          {progress && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Applied</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {progress.completedApplications}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {getSuccessRate()}% success rate
              </div>
            </div>
          )}

          {task && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Steps</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {task.step_count}
              </div>
            </div>
          )}

          {task && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                ${task.cost_usd.toFixed(4)}
              </div>
            </div>
          )}
        </div>

        {/* Current Task Info */}
        {task && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Current Task</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Task ID: {task.task_id.substring(0, 8)}...
                  </p>
                  {task.created_at && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Started: {new Date(task.created_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Preview Error Indicator */}
              {previewError && (
                <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs">Preview unavailable</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Browser Preview */}
      <div className="premium-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Live Browser Preview</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Real-time screenshots and automation preview
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            className="premium-button-secondary text-sm"
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            {isPreviewExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        <LiveBrowserPreview
          taskId={task?.task_id || null}
          isActive={!!isTaskActive}
          onError={setPreviewError}
          className={isPreviewExpanded ? 'h-[600px]' : ''}
        />

        {/* Preview Status */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isTaskActive && !previewError ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className="text-gray-600 dark:text-gray-300">
                {previewError ? 'Preview Error' :
                 isTaskActive ? 'Live Updates Active' : 'Preview Inactive'}
              </span>
            </div>
            
            {task && (
              <div className="text-gray-500 dark:text-gray-400">
                Updates every 3 seconds
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <Camera className="w-4 h-4" />
            <span>Screenshots</span>
            <Film className="w-4 h-4 ml-2" />
            <span>GIF Animation</span>
          </div>
        </div>
      </div>

      {/* Live Logs */}
      <div className="premium-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Live Activity Log</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Real-time automation steps and status updates
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
          </div>
        </div>
        
        <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-4 h-48 overflow-y-auto">
          <div className="space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-sm">Waiting for activity...</div>
            ) : (
              logs.slice(-30).map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-mono"
                >
                  <span className="text-gray-500">
                    {log.includes('[') ? log.split(']')[0] + ']' : '[' + new Date().toLocaleTimeString() + ']'}
                  </span>
                  <span className={`ml-2 ${
                    log.includes('✅') ? 'text-green-400' :
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('⚠️') ? 'text-yellow-400' :
                    log.includes('🔍') ? 'text-blue-400' :
                    log.includes('📝') ? 'text-purple-400' :
                    log.includes('🚀') ? 'text-cyan-400' :
                    'text-gray-300'
                  }`}>
                    {log.includes(']') ? log.split(']').slice(1).join(']') : log}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {task?.status === 'failed' && task.error && (
        <div className="premium-card p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h5 className="font-semibold text-red-800 dark:text-red-200 mb-1">Task Failed</h5>
              <p className="text-sm text-red-700 dark:text-red-300">{task.error}</p>
              {previewError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Preview Error: {previewError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};