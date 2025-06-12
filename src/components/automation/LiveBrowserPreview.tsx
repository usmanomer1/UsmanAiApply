import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  Loader2, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  Pause, 
  Square,
  Camera,
  Film,
  Download,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { browserUseAPI, BrowserUseTask } from '../../lib/browserUseAPI';

interface LiveBrowserPreviewProps {
  taskId: string | null;
  isActive: boolean;
  onError?: (error: string) => void;
  className?: string;
}

interface MediaAsset {
  type: 'screenshot' | 'gif';
  url: string;
  timestamp: string;
  index: number;
}

export const LiveBrowserPreview: React.FC<LiveBrowserPreviewProps> = ({
  taskId,
  isActive,
  onError,
  className = ''
}) => {
  // State management
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Refs for cleanup and control
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const lastTaskIdRef = useRef<string | null>(null);

  // Constants
  const POLL_INTERVAL = 3000; // 3 seconds
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000; // 5 seconds

  // Demo screenshots for when API is not available
  const DEMO_SCREENSHOTS = [
    'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&h=600&fit=crop&q=80'
  ];

  /**
   * Fetch latest screenshots from Browser Use API
   */
  const fetchScreenshots = useCallback(async (currentTaskId: string): Promise<string[]> => {
    try {
      const screenshots = await browserUseAPI.getTaskScreenshots(currentTaskId);
      return screenshots || [];
    } catch (error) {
      console.error('Error fetching screenshots:', error);
      // Return demo screenshots as fallback
      setIsDemoMode(true);
      return DEMO_SCREENSHOTS;
    }
  }, []);

  /**
   * Fetch GIF animation from Browser Use API
   */
  const fetchGif = useCallback(async (currentTaskId: string): Promise<string | null> => {
    try {
      const gifUrl = await browserUseAPI.getTaskGif(currentTaskId);
      return gifUrl || null;
    } catch (error) {
      // GIF might not be available yet, don't throw error
      console.warn('GIF not available yet:', error);
      return DEMO_SCREENSHOTS[0]; // Use first demo screenshot as GIF fallback
    }
  }, []);

  /**
   * Fetch all media assets and update state
   */
  const fetchMediaAssets = useCallback(async (currentTaskId: string) => {
    if (!currentTaskId || !mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch screenshots and GIF in parallel
      const [newScreenshots, newGifUrl] = await Promise.all([
        fetchScreenshots(currentTaskId),
        fetchGif(currentTaskId)
      ]);

      if (!mountedRef.current) return;

      // Always update with new data (including demo data)
      setScreenshots(newScreenshots);
      
      // Create media assets array
      const assets: MediaAsset[] = newScreenshots.map((url, index) => ({
        type: 'screenshot',
        url,
        timestamp: new Date().toISOString(),
        index
      }));

      // Add GIF if available
      if (newGifUrl && newGifUrl !== gifUrl) {
        setGifUrl(newGifUrl);
        assets.push({
          type: 'gif',
          url: newGifUrl,
          timestamp: new Date().toISOString(),
          index: assets.length
        });
      }

      setMediaAssets(assets);
      
      // Auto-advance to latest media if we were at the end
      if (currentMediaIndex >= mediaAssets.length - 1) {
        setCurrentMediaIndex(Math.max(0, assets.length - 1));
      }

      setLastUpdate(new Date());
      setRetryCount(0); // Reset retry count on success
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch media';
      console.error('Error fetching media assets:', error);
      
      if (mountedRef.current) {
        setError(errorMessage);
        onError?.(errorMessage);
        
        // Implement retry logic
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            if (mountedRef.current && taskId) {
              fetchMediaAssets(taskId);
            }
          }, RETRY_DELAY);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [taskId, screenshots.length, gifUrl, currentMediaIndex, mediaAssets.length, retryCount, fetchScreenshots, fetchGif, onError]);

  /**
   * Start polling for media updates
   */
  const startPolling = useCallback(() => {
    if (!taskId || !isActive) return;

    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Initial fetch
    fetchMediaAssets(taskId);

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      if (taskId && isActive && mountedRef.current) {
        fetchMediaAssets(taskId);
      }
    }, POLL_INTERVAL);
  }, [taskId, isActive, fetchMediaAssets]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Handle task changes
   */
  useEffect(() => {
    // Reset state when task changes
    if (lastTaskIdRef.current !== taskId) {
      setScreenshots([]);
      setGifUrl(null);
      setMediaAssets([]);
      setCurrentMediaIndex(0);
      setError(null);
      setRetryCount(0);
      setIsDemoMode(false);
      lastTaskIdRef.current = taskId;
    }

    if (taskId && isActive) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [taskId, isActive, startPolling, stopPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  /**
   * Handle visibility change to pause/resume polling when tab is hidden
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (taskId && isActive) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [taskId, isActive, startPolling, stopPolling]);

  /**
   * Navigation handlers
   */
  const goToPrevious = () => {
    setCurrentMediaIndex(prev => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentMediaIndex(prev => Math.min(mediaAssets.length - 1, prev + 1));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const toggleControls = () => {
    setShowControls(prev => !prev);
  };

  const downloadCurrentMedia = () => {
    const currentAsset = mediaAssets[currentMediaIndex];
    if (currentAsset) {
      const link = document.createElement('a');
      link.href = currentAsset.url;
      link.download = `browser-preview-${currentAsset.type}-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const manualRefresh = () => {
    if (taskId) {
      setRetryCount(0);
      fetchMediaAssets(taskId);
    }
  };

  /**
   * Get current media asset
   */
  const currentAsset = mediaAssets[currentMediaIndex];

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Loader2 className="w-12 h-12 animate-spin mb-4" />
      <p className="text-lg font-medium mb-2">Loading Browser Preview</p>
      <p className="text-sm">Fetching live screenshots and media...</p>
      {retryCount > 0 && (
        <p className="text-xs mt-2 text-yellow-400">
          Retry attempt {retryCount}/{MAX_RETRIES}
        </p>
      )}
    </div>
  );

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
      <p className="text-lg font-medium mb-2 text-red-400">Preview Unavailable</p>
      <p className="text-sm text-center mb-4 max-w-md">
        {error || 'Unable to load browser preview. The task may not have started yet or media is not available.'}
      </p>
      <button
        onClick={manualRefresh}
        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Retry
      </button>
    </div>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Monitor className="w-16 h-16 mb-4 opacity-50" />
      <p className="text-lg font-medium mb-2">Browser Agent Preview</p>
      <p className="text-sm text-center max-w-md">
        {!taskId 
          ? 'Start an automation task to see live browser preview'
          : !isActive 
          ? 'Task is paused or stopped'
          : 'Waiting for browser automation to begin...'
        }
      </p>
      {taskId && isActive && (
        <div className="mt-4 flex items-center text-xs text-blue-400">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
          Monitoring for updates...
        </div>
      )}
    </div>
  );

  /**
   * Render media content
   */
  const renderMediaContent = () => {
    if (!currentAsset) return renderEmptyState();

    return (
      <div className="relative w-full h-full">
        {/* Demo Mode Indicator */}
        {isDemoMode && (
          <div className="absolute top-3 right-3 z-20">
            <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-medium">
              Demo Mode
            </div>
          </div>
        )}

        {/* Media Display */}
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          {currentAsset.type === 'gif' ? (
            <img
              src={currentAsset.url}
              alt="Browser automation GIF"
              className="max-w-full max-h-full object-contain"
              onError={() => setError('Failed to load GIF')}
            />
          ) : (
            <img
              src={currentAsset.url}
              alt={`Browser screenshot ${currentAsset.index + 1}`}
              className="max-w-full max-h-full object-contain"
              onError={() => setError('Failed to load screenshot')}
            />
          )}
        </div>

        {/* Media Controls Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 flex items-center justify-center"
              onMouseLeave={() => setShowControls(false)}
            >
              {/* Navigation Controls */}
              {mediaAssets.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    disabled={currentMediaIndex === 0}
                    className="absolute left-4 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  <button
                    onClick={goToNext}
                    disabled={currentMediaIndex === mediaAssets.length - 1}
                    className="absolute right-4 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Top Controls */}
              <div className="absolute top-4 right-4 flex space-x-2">
                <button
                  onClick={downloadCurrentMedia}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
                  title="Download current media"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
                  title="Toggle fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                
                <button
                  onClick={toggleControls}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
                  title="Hide controls"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between text-white text-sm">
                    <div className="flex items-center space-x-3">
                      {currentAsset.type === 'gif' ? (
                        <Film className="w-4 h-4" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <span>
                        {currentAsset.type === 'gif' ? 'Live Animation' : `Screenshot ${currentAsset.index + 1}`}
                        {isDemoMode && ' (Demo)'}
                      </span>
                    </div>
                    
                    {mediaAssets.length > 1 && (
                      <span className="text-xs text-gray-300">
                        {currentMediaIndex + 1} of {mediaAssets.length}
                      </span>
                    )}
                  </div>
                  
                  {lastUpdate && (
                    <div className="text-xs text-gray-300 mt-1">
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show controls button when hidden */}
        {!showControls && (
          <button
            onClick={toggleControls}
            className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 text-white rounded-lg transition-all"
            title="Show controls"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  /**
   * Main render
   */
  const containerClasses = `
    relative bg-gray-900 rounded-xl overflow-hidden
    ${isFullscreen ? 'fixed inset-0 z-50' : 'h-64 md:h-80 lg:h-96'}
    ${className}
  `;

  return (
    <div className={containerClasses}>
      {/* Status Indicator */}
      <div className="absolute top-3 left-3 z-10">
        <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
          <div className={`w-2 h-2 rounded-full ${
            isActive && taskId ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`}></div>
          <span className="text-white text-xs font-medium">
            {loading ? 'Updating...' : 
             error ? 'Error' :
             isActive && taskId ? (isDemoMode ? 'Demo' : 'Live') : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Refresh Button */}
      {taskId && (
        <div className="absolute top-3 left-20 z-10">
          <button
            onClick={manualRefresh}
            disabled={loading}
            className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all disabled:opacity-50"
            title="Refresh preview"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div 
        className="w-full h-full"
        onMouseEnter={() => currentAsset && setShowControls(true)}
      >
        {loading && !currentAsset ? renderLoadingState() :
         error && !currentAsset ? renderErrorState() :
         currentAsset ? renderMediaContent() :
         renderEmptyState()}
      </div>

      {/* Media Thumbnails */}
      {mediaAssets.length > 1 && !isFullscreen && (
        <div className="absolute bottom-3 left-3 right-3">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
            <div className="flex space-x-2 overflow-x-auto">
              {mediaAssets.map((asset, index) => (
                <button
                  key={`${asset.type}-${index}`}
                  onClick={() => setCurrentMediaIndex(index)}
                  className={`flex-shrink-0 w-12 h-8 rounded border-2 transition-all relative ${
                    index === currentMediaIndex 
                      ? 'border-blue-400' 
                      : 'border-transparent hover:border-gray-400'
                  }`}
                >
                  <img
                    src={asset.url}
                    alt={`${asset.type} ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                  />
                  {asset.type === 'gif' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-3 h-3 text-white drop-shadow" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Demo Mode Info */}
      {isDemoMode && !isFullscreen && (
        <div className="absolute bottom-3 right-3">
          <div className="bg-amber-500/90 text-white px-2 py-1 rounded text-xs">
            <Info className="w-3 h-3 inline mr-1" />
            Demo Preview
          </div>
        </div>
      )}
    </div>
  );
};