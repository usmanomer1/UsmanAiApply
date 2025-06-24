import React, { useState, useEffect } from 'react';
import { createElevenLabsClient } from '../../lib/elevenlabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import VoiceUsageDisplay from './VoiceUsageDisplay';
import { 
  Shield, 
  Settings, 
  RefreshCw, 
  Download,
  AlertTriangle,
  CheckCircle,
  Trash2
} from 'lucide-react';

interface VoiceAdminPanelProps {
  className?: string;
  isAdmin?: boolean;
}

export const VoiceAdminPanel: React.FC<VoiceAdminPanelProps> = ({
  className = '',
  isAdmin = false
}) => {
  const [testText, setTestText] = useState('Hello, this is a test message.');
  const [isTestingTTS, setIsTestingTTS] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  useEffect(() => {
    loadUsageHistory();
  }, []);

  const loadUsageHistory = () => {
    try {
      const stored = localStorage.getItem('elevenlabs_usage_history');
      if (stored) {
        const data = JSON.parse(stored);
        setUsageHistory(data);
      }
    } catch (error) {
      console.error('Failed to load usage history:', error);
    }
  };

  const testTTS = async () => {
    if (!testText.trim()) return;

    setIsTestingTTS(true);
    setTestResult(null);

    try {
      const client = createElevenLabsClient();
      
      // Check rate limit first
      const rateLimit = client.checkRateLimit(testText.length);
      if (rateLimit.isLimited) {
        setTestResult(`Rate limited: ${rateLimit.reason}`);
        return;
      }

      // Get a voice for testing
      const voice = await client.selectVoiceForPersonality({
        purpose: 'assistant',
        tone: 'professional'
      });

      if (!voice) {
        setTestResult('No voice available for testing');
        return;
      }

      // Test TTS with admin bypass
      const audioBuffer = await client.textToSpeech(testText, voice.voice_id, {
        bypassRateLimit: isAdmin,
        userId: 'admin_test'
      });

      // Play the audio
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setTestResult('✅ TTS test completed successfully!');
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setTestResult('❌ Audio playback failed');
      };

      await audio.play();
      
    } catch (error: any) {
      setTestResult(`❌ TTS test failed: ${error.message}`);
    } finally {
      setIsTestingTTS(false);
    }
  };

  const clearUsageHistory = () => {
    if (confirm('Are you sure you want to clear all usage history? This cannot be undone.')) {
      localStorage.removeItem('elevenlabs_usage_history');
      localStorage.removeItem('anonymous_user_id');
      setUsageHistory([]);
      window.location.reload(); // Refresh to reset client state
    }
  };

  const exportUsageData = () => {
    const data = {
      usageHistory,
      exportDate: new Date().toISOString(),
      totalEntries: usageHistory.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elevenlabs_usage_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span>Voice Credit Admin Panel</span>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Usage Display */}
      <VoiceUsageDisplay showDetails />

      {/* TTS Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>TTS Testing</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Test Text</label>
            <Input
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter text to test TTS..."
              className="font-mono"
            />
            <div className="text-xs text-gray-500">
              Characters: {testText.length}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              onClick={testTTS}
              disabled={isTestingTTS || !testText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isTestingTTS ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test TTS'
              )}
            </Button>

            {isAdmin && (
              <div className="flex items-center text-xs text-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Admin bypass enabled
              </div>
            )}
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg border ${
              testResult.startsWith('✅') 
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="text-sm font-mono">{testResult}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage History Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Usage Data Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Entries:</span>
              <span className="ml-2">{usageHistory.length.toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium">Oldest Entry:</span>
              <span className="ml-2">
                {usageHistory.length > 0 
                  ? new Date(usageHistory[0].timestamp).toLocaleDateString()
                  : 'None'
                }
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              onClick={exportUsageData}
              variant="outline"
              disabled={usageHistory.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>

            <Button
              onClick={clearUsageHistory}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              disabled={usageHistory.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>

            <Button
              onClick={loadUsageHistory}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Data Storage Notice</p>
                <p>Usage data is stored locally in the browser. Clearing browser data will reset all usage tracking.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceAdminPanel; 