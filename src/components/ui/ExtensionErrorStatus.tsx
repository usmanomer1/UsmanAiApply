import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { extensionSuppressor, ExtensionError } from '../../lib/extensionSuppressor';

interface ExtensionErrorStatusProps {
  className?: string;
}

const ExtensionErrorStatus: React.FC<ExtensionErrorStatusProps> = ({ className = '' }) => {
  const [suppressedCount, setSuppressedCount] = useState(0);
  const [errorSummary, setErrorSummary] = useState<Record<string, number>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [recentErrors, setRecentErrors] = useState<ExtensionError[]>([]);

  useEffect(() => {
    const updateStatus = () => {
      setSuppressedCount(extensionSuppressor.getSuppressedErrorCount());
      setErrorSummary(extensionSuppressor.getErrorSummary());
      setRecentErrors(extensionSuppressor.getSuppressedErrors().slice(-5)); // Last 5 errors
    };

    // Update immediately
    updateStatus();

    // Update every 2 seconds
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  if (suppressedCount === 0) {
    return null; // Don't show if no errors have been suppressed
  }

  const getErrorTypeIcon = (type: string) => {
    switch (type) {
      case 'frame': return '🖼️';
      case 'resource': return '📁';
      case 'webgl': return '🎮';
      case 'script': return '📝';
      default: return '⚠️';
    }
  };

  const getErrorTypeDescription = (type: string) => {
    switch (type) {
      case 'frame': return 'Frame-related errors (usually from extensions)';
      case 'resource': return 'Missing resource files';
      case 'webgl': return 'WebGL context issues';
      case 'script': return 'Script loading errors';
      default: return 'Other errors';
    }
  };

  return (
    <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Console Protection Active
          </span>
          <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
            {suppressedCount} suppressed
          </span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
        >
          {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
        Browser extension errors are being automatically suppressed for a cleaner experience.
      </p>

      {showDetails && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-green-700 dark:text-green-300">
            <strong>Error Summary:</strong>
          </div>
          
          {Object.entries(errorSummary).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between text-xs bg-green-100 dark:bg-green-800/50 rounded px-2 py-1">
              <span className="flex items-center space-x-1">
                <span>{getErrorTypeIcon(type)}</span>
                <span>{getErrorTypeDescription(type)}</span>
              </span>
              <span className="font-mono text-green-600 dark:text-green-400">{count}</span>
            </div>
          ))}

          {recentErrors.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-green-700 dark:text-green-300 mb-1">
                <strong>Recent (last 5):</strong>
              </div>
              <div className="max-h-20 overflow-y-auto space-y-1">
                {recentErrors.map((error, index) => (
                  <div key={index} className="text-xs font-mono bg-green-100 dark:bg-green-800/50 rounded px-2 py-1 text-green-600 dark:text-green-400 truncate">
                    {getErrorTypeIcon(error.type)} {error.message.substring(0, 50)}...
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              extensionSuppressor.clearSuppressedErrors();
              setSuppressedCount(0);
              setErrorSummary({});
              setRecentErrors([]);
            }}
            className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline"
          >
            Clear error history
          </button>
        </div>
      )}
    </div>
  );
};

export default ExtensionErrorStatus; 