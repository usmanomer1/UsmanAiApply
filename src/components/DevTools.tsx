import React, { useState } from 'react';
import { testChunkLoading } from '../hooks/useChunkLoader';

interface DevToolsProps {
  show?: boolean;
}

/**
 * Development tools for testing and debugging chunk loading
 * Only visible in development mode
 */
export default function DevTools({ show = false }: DevToolsProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Only show in development
  if (import.meta.env.PROD && !show) {
    return null;
  }

  const runChunkTest = async () => {
    setIsRunning(true);
    try {
      const results = await testChunkLoading();
      setTestResults(results);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const clearServiceWorkerCache = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.active) {
          registration.active.postMessage({ type: 'CLEAR_CACHE' });
        }
      }
      console.log('Service worker cache cleared');
    }
  };

  const forceReload = () => {
    window.location.reload();
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-50"
        title="Open Dev Tools"
      >
        🔧
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Dev Tools</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <button
          onClick={runChunkTest}
          disabled={isRunning}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {isRunning ? 'Testing...' : 'Test Chunk Loading'}
        </button>

        <button
          onClick={clearServiceWorkerCache}
          className="w-full px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
        >
          Clear SW Cache
        </button>

        <button
          onClick={forceReload}
          className="w-full px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
        >
          Force Reload
        </button>

        {testResults.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto">
            <h4 className="text-xs font-medium text-gray-700 mb-2">Test Results:</h4>
            {testResults.map((result, index) => (
              <div key={index} className="text-xs mb-1">
                <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {result.status === 'success' ? '✅' : '❌'}
                </span>
                <span className="ml-1 text-gray-700">{result.name}</span>
                {result.loadTime && (
                  <span className="ml-1 text-gray-500">({result.loadTime})</span>
                )}
                {result.error && (
                  <div className="text-red-500 text-xs ml-4 truncate" title={result.error}>
                    {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}