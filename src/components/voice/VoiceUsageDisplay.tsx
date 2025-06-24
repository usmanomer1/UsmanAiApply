import React, { useState, useEffect } from 'react';
import { createElevenLabsClient, RateLimitInfo } from '../../lib/elevenlabs';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  Mic, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Users,
  Calendar
} from 'lucide-react';

interface VoiceUsageDisplayProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

interface UsageStats {
  totalUsed: number;
  totalRemaining: number;
  todayUsed: number;
  dailyLimit: number;
  percentageUsed: number;
  daysRemaining: number;
  projectedDuration: number;
}

export const VoiceUsageDisplay: React.FC<VoiceUsageDisplayProps> = ({
  className = '',
  showDetails = true,
  compact = false
}) => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const client = createElevenLabsClient();
        const usageStats = client.getUsageStats();
        const rateLimitCheck = client.checkRateLimit(100); // Check with sample text
        
        setStats(usageStats);
        setRateLimit(rateLimitCheck);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage stats');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (percentage: number): string => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage < 50) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (percentage < 80) return <Clock className="w-4 h-4 text-yellow-600" />;
    return <AlertTriangle className="w-4 h-4 text-red-600" />;
  };

  if (loading) {
    return (
      <Card className={`${className} ${compact ? 'p-3' : ''}`}>
        <CardContent className={compact ? 'p-0' : ''}>
          <div className="flex items-center space-x-2">
            <Mic className="w-4 h-4 animate-pulse" />
            <span className="text-sm text-gray-500">Loading usage stats...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={`${className} ${compact ? 'p-3' : ''}`}>
        <CardContent className={compact ? 'p-0' : ''}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-500">
              {error || 'Unable to load usage stats'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {getStatusIcon(stats.percentageUsed)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Voice Credits</span>
            <span>{Math.round(stats.percentageUsed)}%</span>
          </div>
          <Progress 
            value={stats.percentageUsed} 
            className="h-1.5"
          />
        </div>
        {rateLimit?.isLimited && (
          <Badge variant="destructive" className="text-xs px-1 py-0">
            Limited
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base font-medium">
          <Mic className="w-4 h-4 mr-2" />
          Voice Usage
          {getStatusIcon(stats.percentageUsed)}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Rate Limit Warning */}
        {rateLimit?.isLimited && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Voice Temporarily Limited</p>
                <p className="text-xs text-red-600 mt-1">{rateLimit.reason}</p>
                {rateLimit.waitTime && (
                  <p className="text-xs text-red-600">
                    Available in: {formatTime(rateLimit.waitTime)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Total Credits Used</span>
            <span className={`font-mono ${getStatusColor(stats.percentageUsed)}`}>
              {stats.totalUsed.toLocaleString()} / {(stats.totalUsed + stats.totalRemaining).toLocaleString()}
            </span>
          </div>
          <Progress 
            value={stats.percentageUsed} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{Math.round(stats.percentageUsed)}% used</span>
            <span>{stats.totalRemaining.toLocaleString()} remaining</span>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Today's Usage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-3 h-3 mr-1" />
                  Today's Usage
                </div>
                <div className="text-lg font-mono font-semibold">
                  {stats.todayUsed.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  of {stats.dailyLimit.toLocaleString()} daily limit
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center text-sm text-gray-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Projected Duration
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(stats.projectedDuration)} days
                </div>
                <div className="text-xs text-gray-500">
                  Target: {stats.daysRemaining} days
                </div>
              </div>
            </div>

            {/* Status Messages */}
            <div className="text-xs text-gray-600 space-y-1">
              {stats.projectedDuration > stats.daysRemaining ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Credits are lasting longer than expected!
                </div>
              ) : stats.projectedDuration < stats.daysRemaining * 0.8 ? (
                <div className="flex items-center text-red-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Usage is higher than planned. Rate limiting may increase.
                </div>
              ) : (
                <div className="flex items-center text-blue-600">
                  <Clock className="w-3 h-3 mr-1" />
                  Usage is on track for the 3-month plan.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceUsageDisplay; 