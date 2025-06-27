import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';

export interface SessionStatusProps {
  hasSession: boolean;
  sessionAge?: number | null;
  linkedinEmail?: string;
  onRefreshSession?: () => void;
  onClearSession?: () => void;
  className?: string;
}

const SessionStatusDisplay: React.FC<SessionStatusProps> = ({
  hasSession,
  sessionAge,
  linkedinEmail,
  onRefreshSession,
  onClearSession,
  className = ''
}) => {
  const getSessionStatusBadge = () => {
    if (!hasSession) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          No Session
        </Badge>
      );
    }

    if (sessionAge && sessionAge < 24) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3" />
          Fresh Session
        </Badge>
      );
    }

    if (sessionAge && sessionAge < 72) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="w-3 h-3" />
          Active Session
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1 bg-orange-100 text-orange-800 border-orange-200">
        <Clock className="w-3 h-3" />
        Aging Session
      </Badge>
    );
  };

  const getSessionAgeText = () => {
    if (!sessionAge) return null;
    
    if (sessionAge < 1) {
      return `${Math.round(sessionAge * 60)} minutes ago`;
    } else if (sessionAge < 24) {
      return `${Math.round(sessionAge)} hours ago`;
    } else {
      return `${Math.round(sessionAge / 24)} days ago`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/50 backdrop-blur-sm border border-gray-200 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">LinkedIn Session</span>
        </div>
        {getSessionStatusBadge()}
      </div>

      {hasSession ? (
        <div className="space-y-2">
          {linkedinEmail && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Account:</span> {linkedinEmail}
            </div>
          )}
          
          {sessionAge && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Last login:</span> {getSessionAgeText()}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {onRefreshSession && (
              <Button
                onClick={onRefreshSession}
                size="sm"
                variant="outline"
                className="flex items-center gap-1 text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            )}
            
            {onClearSession && (
              <Button
                onClick={onClearSession}
                size="sm"
                variant="outline"
                className="flex items-center gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                Clear Session
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            No saved session found. You'll need to login during the first automation run.
          </div>
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border">
            💡 <strong>Tip:</strong> After your first successful login, we'll save your session to avoid 2FA prompts on future runs.
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SessionStatusDisplay; 