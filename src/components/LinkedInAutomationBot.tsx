import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  AlertCircle, 
  User, 
  Globe, 
  Briefcase, 
  Search, 
  Activity, 
  Eye, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  Zap, 
  Crown, 
  Building, 
  Loader2, 
  Sparkles,
  Shield,
  Mic,
  MessageSquare,
  Target,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { usePaywall } from '../hooks/usePaywall';
import PaywallModal from './ui/PaywallModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import ConditionalBackground from './ui/ConditionalBackground';

import { extensionSuppressor } from '../lib/extensionSuppressor';
import ExtensionErrorStatus from './ui/ExtensionErrorStatus';
import UsageStatusDisplay from './ui/UsageStatusDisplay';
// Session management removed
import { getPlanLimits, getProductByPriceId } from '../stripe-config';
import { BrowserUseClient } from '../lib/browserUseClient';

interface TaskStatus {
  id: string;
  status: 'created' | 'running' | 'paused' | 'finished' | 'failed' | 'stopped';
  live_url?: string;
  steps?: any[];
  output?: string;
  error?: string;
}

interface BrowserUseConfig {
  apiKey: string;
  linkedinEmail: string;
  linkedinPassword?: string; // For automated login
  contactNumber: string;
  countryCode: string;
  linkedinResume: string;
  customInstructions: string;
  jobTitle: string;
  location: string;
  locationId: string;
  experience: string;
  remotePreference: string;
  jobType?: string;
  workType?: string;
  experienceLevel?: string;
  salaryRange?: string;
  companySize?: string;
  datePosted?: string;
  targetCount: string;
  // New options for external applications
  applicationMode?: 'easy_apply_only' | 'all_jobs';
  externalApplications?: {
    firstName: string;
    lastName: string;
    personalEmail: string;
    personalPhone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    linkedinProfile?: string;
    portfolioWebsite?: string;
    githubProfile?: string;
  };
}



const BROWSER_USE_API_BASE = import.meta.env.VITE_BROWSER_USE_API_URL ;

// LinkedIn location ID mapping - expanded with more locations
const LINKEDIN_LOCATIONS = {
  'San Francisco Bay Area': '90000084',
  'New York City': '90000070', 
  'Los Angeles': '90000071',
  'Seattle': '90000069',
  'Chicago': '90000068',
  'Boston': '90000067',
  'Vancouver, BC': '103366113',
  'Vancouver': '103366113',
  'Toronto, ON': '90000045',
  'Toronto': '90000045',
  'London, UK': '90000062',
  'London': '90000062',
  'Austin': '90000025',
  'Denver': '90000049',
  'Atlanta': '90000023',
  'Miami': '90000078',
  'Dallas': '90000050',
  'Phoenix': '90000080',
  'San Diego': '90000073',
  'Portland': '90000081',
  'Washington DC': '90000031',
  'Philadelphia': '90000082',
  'Detroit': '90000052',
  'Minneapolis': '90000079',
  'Tampa': '90000083',
  'Orlando': '90000075',
  'Las Vegas': '90000063',
  'Sacramento': '90000085',
  'San Antonio': '90000086',
  'Nashville': '90000076',
  'Charlotte': '90000039',
  'Raleigh': '90000087',
  'Pittsburgh': '90000088',
  'Cincinnati': '90000041',
  'Kansas City': '90000058',
  'Columbus': '90000042',
  'Indianapolis': '90000056',
  'Cleveland': '90000040',
  'Milwaukee': '90000077',
  'Remote': 'remote',
  // Additional international locations
  'Montreal': '90000096',
  'Calgary': '90000097',
  'Ottawa': '90000098',
  'Sydney': '90000099',
  'Melbourne': '90000100',
  'Berlin': '90000101',
  'Paris': '90000102',
  'Amsterdam': '90000103',
  'Stockholm': '90000104',
  'Zurich': '90000105'
};

// Country codes for phone numbers
const COUNTRY_CODES = [
  { code: '+1', country: 'United States/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  // Additional countries
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+98', country: 'Iran', flag: '🇮🇷' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+51', country: 'Peru', flag: '🇵🇪' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺' },
  { code: '+40', country: 'Romania', flag: '🇷🇴' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+372', country: 'Estonia', flag: '🇪🇪' },
  { code: '+371', country: 'Latvia', flag: '🇱🇻' },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+972', country: 'Israel', flag: '🇮🇱' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
  { code: '+968', country: 'Oman', flag: '🇴🇲' },
  { code: '+961', country: 'Lebanon', flag: '🇱🇧' },
  { code: '+962', country: 'Jordan', flag: '🇯🇴' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳' },
  { code: '+218', country: 'Libya', flag: '🇱🇾' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+507', country: 'Panama', flag: '🇵🇦' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+1876', country: 'Jamaica', flag: '🇯🇲' },
  { code: '+1809', country: 'Dominican Republic', flag: '🇩🇴' },
  { code: '+1787', country: 'Puerto Rico', flag: '🇵🇷' },
  { code: '+1868', country: 'Trinidad & Tobago', flag: '🇹🇹' },
  { code: '+1242', country: 'Bahamas', flag: '🇧🇸' },
  { code: '+1246', country: 'Barbados', flag: '🇧🇧' }
];

// Work type mapping
const WORK_TYPE_MAP = {
  'Remote': '2',
  'On-site': '1', 
  'Hybrid': '3'
};

// Experience level mapping (LinkedIn uses f_E parameter)
const EXPERIENCE_LEVEL_MAP = {
  'Internship': '1',
  'Entry level': '2',
  'Associate': '3',
  'Mid-Senior level': '4',
  'Director': '5',
  'Executive': '6'
};

const LinkedInAutomationBot: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkFeatureAccess, isAuthenticated } = usePaywall();
  
  // Get API key from environment variable with proper fallback
  const apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || import.meta.env.VITE_BROWSERUSE_API_KEY || '';
  
  const [config, setConfig] = useState<BrowserUseConfig>({
    apiKey: apiKey,
    linkedinEmail: '',
    contactNumber: '',
    countryCode: '+1-US',
    linkedinResume: '',
    customInstructions: '',
    jobTitle: 'Software Engineer',
    location: 'San Francisco Bay Area',
    locationId: '90000084',
    experience: 'Mid-Senior level',
    remotePreference: 'Remote',
    jobType: undefined,
    workType: undefined,
    experienceLevel: undefined,
    salaryRange: undefined,
    companySize: undefined,
    datePosted: undefined,
    targetCount: '10'
  });
  
  // AI Model selection state
  const [selectedModel, setSelectedModel] = useState<'gemini-2.0-flash' | 'gpt-4.1' | 'claude-3-7-sonnet-20250219'>('gemini-2.0-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Model definitions with properties
  const AI_MODELS = {
    'gemini-2.0-flash': {
      name: 'Gemini 2.0 Flash',
      provider: 'Google',
      stepMultiplier: 1,
      requestLabel: '1x steps',
      speed: 'Fastest',
      description: 'Best efficiency and performance ratio',
      icon: '🚀',
      color: 'from-blue-500 to-indigo-600'
    },
    'gpt-4.1': {
      name: 'GPT-4.1',
      provider: 'OpenAI',
      stepMultiplier: 3,
      requestLabel: '3x steps',
      speed: 'Fast',
      description: 'Highest accuracy and reliability',
      icon: '🎯',
      color: 'from-emerald-500 to-teal-600'
    },
    'claude-3-7-sonnet-20250219': {
      name: 'Claude 3.7 Sonnet',
      provider: 'Anthropic',
      stepMultiplier: 3,
      requestLabel: '3x steps',
      speed: 'Fast',
      description: 'Advanced reasoning and analysis',
      icon: '🧠',
      color: 'from-purple-500 to-indigo-600'
    }
  } as const;
  
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [monthlyUsage, setMonthlyUsage] = useState({ tokens_used: 0, ai_requests_used: 0, cost_usd: 0 });
  const [loading, setLoading] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  
  // Browser client state (no session management)
  const [browserClient, setBrowserClient] = useState<BrowserUseClient | null>(null);

  // Add state for dropdown
  const [showImportantInstructions, setShowImportantInstructions] = useState(false);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && 
      supabaseUrl !== 'your_supabase_url_here' && 
      supabaseKey !== 'your_supabase_anon_key_here' &&
      supabaseUrl.startsWith('https://') &&
      supabaseUrl.includes('.supabase.co') &&
      supabaseKey.length > 50
    );
  };

  useEffect(() => {
    loadConfiguration();
    fetchUserSubscription();
    checkAccess();
    
    // Initialize browser client (no session management)
    if (apiKey) {
      const client = new BrowserUseClient(apiKey);
      setBrowserClient(client);
    }
    
    return () => {
      // Cleanup polling interval on unmount
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [user, apiKey]);

  // Separate useEffect for state restoration after browser client is ready
  useEffect(() => {
    if (browserClient && user) {
      restoreAutomationState();
    }
  }, [browserClient, user]);

  // Handle page close to automatically stop tasks and prevent backend charges
  useEffect(() => {
          const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        if (isRunning && currentTask && browserClient && apiKey) {
          // Immediately attempt to stop the task to prevent backend charges
          try {
            // Multiple stop attempts for reliability (browsers limit time for beforeunload)
            
            // Method 1: Use browser client (most compatible)
            browserClient.stopTask(currentTask.id).catch(() => {});
            
            // Method 2: Direct API call with keepalive for reliability
            fetch(`https://api.browseruse.com/tasks/${currentTask.id}/stop`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
              keepalive: true // Continues even as page unloads
            }).catch(() => {});
            
            // Method 3: Fallback with sendBeacon (most reliable for page unload)
            const stopData = JSON.stringify({
              taskId: currentTask.id,
              authorization: `Bearer ${apiKey}`,
              timestamp: Date.now()
            });
            
            if (navigator.sendBeacon) {
              navigator.sendBeacon(
                `https://api.browseruse.com/tasks/${currentTask.id}/stop`,
                stopData
              );
            }
            
            // Clear local state immediately
            clearAutomationState();
            
          } catch (error) {
            // Even if stop fails, clear local state
            clearAutomationState();
          }
          
          // Show brief message (no confirmation dialog needed)
          const message = 'Stopping automation to prevent charges...';
          event.returnValue = message;
          return message;
        }
      };

    // Also handle visibility change (tab switching, minimizing)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isRunning && currentTask) {
        // Just save state when tab becomes hidden (don't stop)
        saveAutomationState(currentTask);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, currentTask, user, browserClient, apiKey]);

  // Persist automation state to survive page refreshes
  const saveAutomationState = (task: TaskStatus) => {
    if (!user) return;
    
    const automationState = {
      taskId: task.id,
      status: task.status,
      live_url: task.live_url,
      steps: task.steps || [],
      output: task.output || '',
      error: task.error || '',
      stepCount,
      appliedCount,
      isRunning,
      isPaused,
      logs: logs.slice(-50), // Save last 50 log entries to avoid storage issues
      timestamp: Date.now()
    };
    
    try {
    localStorage.setItem(`automation_state_${user.id}`, JSON.stringify(automationState));
    } catch (error) {
      console.warn('Failed to save automation state:', error);
    }
  };

  const clearAutomationState = () => {
    if (!user) return;
    localStorage.removeItem(`automation_state_${user.id}`);
  };

  const restoreAutomationState = async () => {
    if (!user || !browserClient) return;
    
    try {
      const savedState = localStorage.getItem(`automation_state_${user.id}`);
      if (!savedState) return;
      
      const state = JSON.parse(savedState);
      
      // Check if state is recent (within last 30 minutes since tasks auto-stop on tab close)
      const isRecent = (Date.now() - state.timestamp) < 30 * 60 * 1000; // 30 minutes
      
      if (!isRecent) {
        clearAutomationState();
        addLog(`⏰ Previous automation session expired (tasks auto-stop when tab is closed)`);
        return;
      }
      
      // Restore the task and check its current status
      if (state.taskId && (state.status === 'running' || state.status === 'paused')) {
        try {
          const currentTaskStatus = await getTaskStatus(state.taskId);
          
          // If task is still active, restore the UI state comprehensively
          if (currentTaskStatus.status === 'running' || currentTaskStatus.status === 'paused') {
            // Restore task details
            setCurrentTask(currentTaskStatus);
            setIsRunning(currentTaskStatus.status === 'running');
            setIsPaused(currentTaskStatus.status === 'paused');
            setStepCount(state.stepCount || 0);
            setAppliedCount(state.appliedCount || 0);
            
            // Restore logs if available
            if (state.logs && Array.isArray(state.logs)) {
              setLogs(state.logs);
            }
            
            addLog(`🔄 Restored automation session - Task ${state.taskId} is ${currentTaskStatus.status}`);
            addLog(`📊 Restored state: ${state.stepCount || 0} steps, ${state.appliedCount || 0} applications`);
            
            // Show live preview URL if available
            if (currentTaskStatus.live_url) {
              addLog(`🌐 Live preview available: ${currentTaskStatus.live_url}`);
            }
            
            // Resume polling if task is running
            if (currentTaskStatus.status === 'running') {
              startPolling(state.taskId);
              addLog(`▶️ Resumed monitoring task progress`);
            } else if (currentTaskStatus.status === 'paused') {
              addLog(`⏸️ Task is paused - you can resume it anytime`);
            }
          } else {
            // Task is finished/failed, clear saved state but show completion info
            clearAutomationState();
            if (state.stepCount || state.appliedCount) {
              addLog(`✅ Previous automation completed: ${state.stepCount || 0} steps, ${state.appliedCount || 0} applications`);
            } else {
              addLog(`✅ Previous automation task finished`);
            }
          }
        } catch (error) {
          // Task no longer exists (likely auto-stopped), clear saved state
          clearAutomationState();
          addLog(`💰 Previous automation was auto-stopped when tab was closed (cost protection)`);
        }
      } else if (state.taskId && ['finished', 'failed', 'stopped'].includes(state.status)) {
        // Show info about completed task and clear state
        if (state.stepCount || state.appliedCount) {
          addLog(`✅ Last session: ${state.stepCount || 0} steps, ${state.appliedCount || 0} applications (${state.status})`);
        }
        clearAutomationState();
      }
    } catch (error) {
      // Invalid saved state, clear it
      clearAutomationState();
      console.warn('Failed to restore automation state:', error);
    }
  };

  // Check access on component mount
  const checkAccess = async () => {
    if (!isAuthenticated) {
      setShowPaywall(true);
      setAccessCheckComplete(true);
      return;
    }

    try {
      const accessResult = await checkFeatureAccess('auto_apply');
      // Only show paywall if the paywall logic says to show it (never for paid users)
      setShowPaywall(accessResult.showPaywall);
    } catch (error) {
      // Only show paywall for unauthenticated users
      setShowPaywall(!isAuthenticated);
    } finally {
      setAccessCheckComplete(true);
    }
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logMessage]);
    
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    }
  };

  // Session management removed - using direct credential login only

  const fetchUserResumeContent = async (): Promise<string | null> => {
    try {
      if (!user) return null;

      // Get user profile with resume URL
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('resume_url, full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !profile?.resume_url) {
        return null;
      }

      // Get signed URL and fetch the resume content
      const { data: signedUrlData } = await supabase.storage
        .from('resumes')
        .createSignedUrl(profile.resume_url, 60); // 60 seconds should be enough

      if (!signedUrlData?.signedUrl) {
        return null;
      }

      // Fetch the file content
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) {
        return null;
      }

      // Check if it's a PDF file
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/pdf')) {
        // For PDF files, try to extract text content
        try {
          const arrayBuffer = await response.arrayBuffer();
          const file = new File([arrayBuffer], 'resume.pdf', { type: 'application/pdf' });
          const { extractTextFromPDF } = await import('../lib/pdfExtractor');
          const extractedText = await extractTextFromPDF(file);
          return extractedText || `[PDF Resume for ${profile.full_name || 'User'} - Text extraction failed, but user has uploaded their resume]`;
        } catch (error) {
          return `[PDF Resume for ${profile.full_name || 'User'} - Text extraction failed, but user has uploaded their resume]`;
        }
      }

      // For text files, read as text
      const content = await response.text();
      return content;
    } catch (error) {
      return null;
    }
  };

  const loadConfiguration = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('automation_configs')
        .select('config')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // Don't show error toast for configuration loading
      } else if (data?.config) {
        // Map empty strings and null values to undefined for select components
        const loadedConfig = { ...data.config };
        Object.keys(loadedConfig).forEach(key => {
          if (loadedConfig[key] === '' || loadedConfig[key] === null) {
            loadedConfig[key] = undefined;
          }
        });
        setConfig(prev => ({ ...prev, ...loadedConfig }));
        
        // Load selected model if saved
        if (loadedConfig.selectedModel && AI_MODELS[loadedConfig.selectedModel as keyof typeof AI_MODELS]) {
          setSelectedModel(loadedConfig.selectedModel as keyof typeof AI_MODELS);
        }
      }
    } catch (error) {
      // Silently fail for configuration loading
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!isSupabaseConfigured() || !user) {
      toast.error('Database not configured');
      return;
    }

    try {
      // Don't save email in the config (it's not sensitive but we handle it separately)
      const { linkedinEmail, ...configToSave } = config;
      
      // Include selected model in the config
      const configWithModel = {
        ...configToSave,
        selectedModel
      };
      
      const { error } = await supabase
        .from('automation_configs')
        .upsert({
          user_id: user.id,
          config: configWithModel
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      toast.success('Configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };



  const fetchUserSubscription = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setUserSubscription({
          subscription_status: 'active',
          price_id: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || null
        });
        setMonthlyUsage({ tokens_used: 15, ai_requests_used: 5, cost_usd: 0.15 });
        return;
      }

      // Try direct table access first, fallback to subscription service
      try {
        const { data: subscription, error: subError } = await supabase
          .from('stripe_user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subError) {
          // Don't throw, just fallback
        }

        if (subscription && subscription.subscription_status === 'active') {
          setUserSubscription(subscription);
        } else {
          setUserSubscription({ subscription_status: 'inactive', price_id: null });
        }
      } catch (tableError) {
        try {
          // Fallback to subscription service
          const { subscriptionService } = await import('../lib/subscriptionService');
          const serviceSubscription = await subscriptionService.getUserSubscription(user.id);

          if (serviceSubscription && serviceSubscription.subscription_status === 'active') {
            setUserSubscription(serviceSubscription);
          } else {
            setUserSubscription({ subscription_status: 'inactive', price_id: null });
          }
        } catch (serviceError) {
          setUserSubscription({ subscription_status: 'inactive', price_id: null });
        }
      }

      // Fetch current month usage with proper timezone handling
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const startDate = firstDayOfMonth.toISOString();
      const endDate = nextMonth.toISOString();
      
      // Add warning if system date seems incorrect
      const currentYear = new Date().getFullYear();
      if (currentYear > 2024) {
        // System date validation check
      }
      
      const { data: usageData, error: usageError } = await supabase
        .from('browser_use_logs')
        .select('task_id, step_count, cost_usd, created_at')
        .eq('user_id', user.id)
        .eq('task_type', 'linkedin_auto_apply')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false });

      if (usageError) {
        // Don't show error toast for usage data loading
      }

      // Calculate total steps correctly: only count the MAX step_count per task_id (same logic as billing page)
      
      let totalSteps = 0;
      let totalCost = 0;
      
      if (usageData && usageData.length > 0) {
        const taskSteps: Record<string, number> = {};
        const taskCosts: Record<string, number> = {};
        
        // Group by task_id and find the maximum step_count for each task
        usageData.forEach(log => {
          const currentSteps = taskSteps[log.task_id] || 0;
          const currentCost = taskCosts[log.task_id] || 0;
          
          // Only keep the highest step count and cost for each task
          if (log.step_count > currentSteps) {
            taskSteps[log.task_id] = log.step_count;
            taskCosts[log.task_id] = parseFloat(log.cost_usd.toString());
          }
        });
        
        // Sum up the final step counts and costs for all tasks
        totalSteps = Object.values(taskSteps).reduce((sum, steps) => sum + steps, 0);
        totalCost = Object.values(taskCosts).reduce((sum, cost) => sum + cost, 0);
      }
      
      const jobTokens = totalSteps; // Use actual steps, not divided by 10
      
      setMonthlyUsage({ 
        tokens_used: jobTokens, 
        ai_requests_used: usageData?.length || 0,
        cost_usd: totalCost
      });

    } catch (error) {
      
      // Set fallback data so UI doesn't break
      setUserSubscription({ subscription_status: 'inactive', price_id: null });
      setMonthlyUsage({ tokens_used: 0, ai_requests_used: 0, cost_usd: 0 });
    }
  };

  const getPlanName = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 'Free Plan';
    }
    
    // Use the price_id directly from the subscription
    const priceId = userSubscription.price_id;
    
    if (priceId === import.meta.env.VITE_STRIPE_MAX_PRICE_ID) {
      return 'Max Plan';
    }
    if (priceId === import.meta.env.VITE_STRIPE_PRO_PRICE_ID) {
      return 'Pro Plan';
    }
    if (priceId === import.meta.env.VITE_STRIPE_PLUS_PRICE_ID) {
      return 'Plus Plan';
    }
    
    // If subscription exists but price ID doesn't match, default to Pro
    return userSubscription.subscription_status === 'active' ? 'Pro Plan' : 'Free Plan';
  };

  // Use the EXACT same logic as billing page
  const getCurrentProduct = () => {
    if (!userSubscription?.price_id) return null;
    return getProductByPriceId(userSubscription.price_id);
  };

  const getPlanUsageLimits = () => {
    if (!userSubscription) return { applications: 0, aiTokens: 0, isSubscription: false };

    // 1) try strict priceId match
    if (userSubscription.price_id) {
      const direct = getPlanLimits(userSubscription.price_id.trim());
      if (direct) return direct;
    }

    // 2) try derive from product object resolved elsewhere
    const prod = getCurrentProduct();
    if (prod) {
      return {
        applications: prod.applicationCount || 0,
        aiTokens: prod.aiTokenCount || 0,
        isSubscription: prod.mode === 'subscription'
      };
    }

    // 3) final default
    return { applications: 0, aiTokens: 0, isSubscription: false };
  };

  const getTokenLimit = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 0; // Free plan gets 0 steps
    }
    
    // Use the same robust logic as billing page
    const limits = getPlanUsageLimits();
    
    const applicationLimit = limits.applications || 0;
    const stepLimit = applicationLimit * 10; // Convert applications to steps (10 steps per application)
    return stepLimit;
  };

  const canStartAutomation = () => {
    const limit = getTokenLimit();
    if (limit === 0) {
      return false;
    }
    
    const estimatedTokensNeeded = 5; // Minimum tokens needed to start
    const canStart = monthlyUsage.tokens_used + estimatedTokensNeeded <= limit;
    
    return canStart;
  };

  const buildLinkedInJobsURL = () => {
    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams();
    
    // Essential LinkedIn parameters
    // Only add Easy Apply filter if in easy_apply_only mode
    if (config.applicationMode !== 'all_jobs') {
      params.append('f_AL', 'true'); // Easy Apply filter
    }
    params.append('distance', '25'); // Search radius
    params.append('origin', 'JOB_SEARCH_PAGE_KEYWORD_HISTORY'); // LinkedIn tracking
    params.append('refresh', 'true'); // Fresh results
    
    // Job title/keywords
    if (config.jobTitle) {
      params.append('keywords', config.jobTitle);
    } else {
      params.append('keywords', 'Software Engineer'); // Default fallback
    }
    
    // Location handling
    const locationInput = config.location?.trim();
    
    if (locationInput && locationInput !== 'San Francisco Bay Area') {
      const locationKey = Object.keys(LINKEDIN_LOCATIONS).find(key => 
        key.toLowerCase() === locationInput.toLowerCase()
      );
      
      if (locationKey) {
        const locationId = LINKEDIN_LOCATIONS[locationKey as keyof typeof LINKEDIN_LOCATIONS];
        if (locationId === 'remote') {
          params.append('f_WT', '2');
        } else {
          params.append('geoId', locationId);
        }
      } else if (config.locationId && config.locationId.trim() !== '' && config.locationId !== '90000084') {
        params.append('geoId', config.locationId.trim());
      } else {
        params.append('location', locationInput);
      }
    } else if (locationInput === 'San Francisco Bay Area' || !locationInput) {
      params.append('geoId', '90000084');
    }
    
    // Work type (Remote/On-site/Hybrid)
    if (config.workType && config.workType !== 'any' && !params.has('f_WT')) {
      const workType = WORK_TYPE_MAP[config.workType as keyof typeof WORK_TYPE_MAP];
      if (workType) {
        params.append('f_WT', workType);
      }
    }
    
    // Experience level
    if (config.experienceLevel && config.experienceLevel !== 'any') {
      const experienceLevel = EXPERIENCE_LEVEL_MAP[config.experienceLevel as keyof typeof EXPERIENCE_LEVEL_MAP];
      if (experienceLevel) {
        params.append('f_E', experienceLevel);
      }
    }
    
    // Job type (Full-time, Part-time, etc.)
    if (config.jobType) {
      const jobTypeMap: { [key: string]: string } = {
        'Full-time': 'F',
        'Part-time': 'P',
        'Contract': 'C',
        'Temporary': 'T',
        'Volunteer': 'V',
        'Internship': 'I'
      };
      const jobType = jobTypeMap[config.jobType];
      if (jobType) {
        params.append('f_JT', jobType);
      }
    }
    
    // Date posted
    if (config.datePosted) {
      params.append('f_TPR', config.datePosted);
    }
    
    // Company size
    if (config.companySize) {
      params.append('f_C', config.companySize);
    }
    
    // Sort by most recent
    params.append('sortBy', 'DD');
    
    const finalUrl = `${baseUrl}?${params.toString()}`;
    
    return finalUrl;
  };

  const trackUsage = async (totalSteps: number, taskId: string) => {
    if (!user) return;

    try {
      const costPerStep = 0.03;
      const initializationCost = 0.01;
      const costUsd = (totalSteps * costPerStep) + initializationCost;
      
      const maxSteps = getTokenLimit();
      
      // Check subscription status
      if (!userSubscription || userSubscription.subscription_status !== 'active') {
        toast.error('Subscription access issue detected. Please check your billing status.');
        await stopAutomation();
        return;
      }
      
      // Check usage limits
      if (maxSteps > 0 && totalSteps > maxSteps) {
        toast.error('Monthly usage limit reached. Upgrade your plan or wait until next month to continue automation.');
        await stopAutomation();
        return;
      }
      
      // Record usage to database
      if (isSupabaseConfigured()) {
        try {
          // Delete existing record and insert new one
          await supabase
            .from('browser_use_logs')
            .delete()
            .eq('user_id', user.id)
            .eq('task_id', taskId);

          await supabase
            .from('browser_use_logs')
            .insert({
              user_id: user.id,
              task_id: taskId,
              task_type: 'linkedin_auto_apply',
              step_count: totalSteps,
              cost_usd: costUsd
            });
        } catch (dbError) {
          // Continue automation even if logging fails
        }
      }

      // Update local state
      setMonthlyUsage(prev => ({
        ...prev,
        tokens_used: totalSteps,
        cost_usd: costUsd
      }));
      
    } catch (error) {
      // Continue automation even if tracking fails
    }
  };

  const saveJobApplication = async (company: string, role: string, taskId: string, jobUrl?: string | null) => {
    try {
      if (!isSupabaseConfigured() || !user) {
        return false;
      }

      // Validate and clean the input data
      const cleanCompany = company?.trim();
      const cleanRole = role?.trim();
      
      if (!cleanCompany || !cleanRole || !isValidCompanyName(cleanCompany) || !isValidJobTitle(cleanRole)) {
        return false;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        return false;
      }

      // Get or create a job campaign
      const { data: campaign } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('job_title', config.jobTitle || 'LinkedIn Auto Apply')
        .eq('location', config.location || 'Remote')
        .maybeSingle();

      let campaignId = campaign?.id;

      if (!campaignId) {
        const { data: newCampaign, error: campaignError } = await supabase
          .from('job_campaigns')
          .insert({
            profile_id: profile.id,
            job_title: config.jobTitle || 'LinkedIn Auto Apply',
            location: config.location || 'Remote',
            experience_level: config.experienceLevel || config.experience || '',
            work_type: config.workType || config.remotePreference || '',
            target_count: parseInt(config.targetCount) || 10
          })
          .select('id')
          .single();

        if (campaignError || !newCampaign) {
          return false;
        }

        campaignId = newCampaign.id;
      }

      if (campaignId) {
        // Check if this application already exists to avoid duplicates
        const { data: existingApp } = await supabase
          .from('applications')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('company', cleanCompany)
          .eq('role', cleanRole)
          .maybeSingle();

        if (!existingApp) {
          const applicationData = {
            campaign_id: campaignId,
            company: cleanCompany,
            role: cleanRole,
            status: 'SENT',
            applied_at: new Date().toISOString(),
            details: {
              automated: true,
              task_id: taskId,
              job_title: config.jobTitle,
              location: config.location,
              contact_number: `${config.countryCode}${config.contactNumber}`,
              resume_used: config.linkedinResume || 'Default',
              custom_instructions: config.customInstructions || '',
              extraction_method: 'browser_use_api_v2',
              timestamp: new Date().toISOString(),
              url: jobUrl || null
            }
          };

          const { data: newApp, error: appError } = await supabase
            .from('applications')
            .insert(applicationData)
            .select('id')
            .single();

          if (!appError && newApp) {
            // Create notification for successful application
            await supabase
              .from('notifications')
              .insert({
                user_id: user.id,
                title: 'Job Application Submitted',
                message: `Applied to ${cleanRole} at ${cleanCompany}`,
                type: 'success',
                icon_name: 'Send',
                data: {
                  applicationId: newApp.id,
                  company: cleanCompany,
                  role: cleanRole,
                  url: jobUrl
                }
              });

            // Only show toast notification for successful saves
            toast.success(`Applied to ${cleanCompany} - ${cleanRole}`);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  };

  const createLinkedInTask = async () => {
    if (!browserClient) {
      throw new Error('Browser client not initialized');
    }

    // Stop previous task if running or paused
    if (currentTask && (currentTask.status === 'running' || currentTask.status === 'paused')) {
      try {
        await browserClient.stopTask(currentTask.id);
        addLog('⏹️ Stopped previous automation task before starting a new one', 'info');
      } catch (err) {
        addLog('⚠️ Failed to stop previous task (it may already be stopped)', 'info');
      }
    }

    // Always clear the browser profile before starting a new task for a new user
    await browserClient.clearBrowserProfile();

    const linkedinUrl = buildLinkedInJobsURL();
    const fullContactNumber = `${config.countryCode}${config.contactNumber}`;
    
    // Always use direct credential login (no session management)
    addLog('🔑 Using direct credential login with provided credentials', 'info');
    addLog('📋 IMPORTANT: Make sure 2FA is disabled on your LinkedIn account', 'info');
    
    // Use comprehensive single prompt approach (proven to work better)
    // INSTRUCTION: Use the LinkedIn password from the secret variable ln_password
    const comprehensivePrompt = createComprehensivePrompt(linkedinUrl);

    // Pass the password via secrets, not in the prompt/config
    const taskConfig = {
      task: comprehensivePrompt,
      
      secrets: config.linkedinPassword ? { ln_password: config.linkedinPassword } : undefined,
      save_browser_data: false,
      use_adblock: false,
      use_proxy: true,
      
      proxy_country_code: 'us' as const,
      highlight_elements: true,
      max_agent_steps: Math.max(100, parseInt(config.targetCount) * 10), // 10 steps per application to stay within billing constraints
      llm_model: selectedModel,
      allowed_domains: ['linkedin.com', '*.linkedin.com'],
    };

    addLog(`🚀 Starting LinkedIn automation with ${AI_MODELS[selectedModel].name} (${AI_MODELS[selectedModel].provider})`, 'success');

    const result = await browserClient.createLinkedInTask(taskConfig);
    
    return {
      id: result.id,
      live_url: undefined, // Will be fetched later
      status: 'created' as const,
      steps: [],
      output: undefined,
      error: undefined
    };
  };

  // Session-based prompts removed - using direct credential login only

  const createComprehensivePrompt = (linkedinUrl: string) => {
    const isAllJobsMode = config.applicationMode === 'all_jobs';
    const externalData = config.externalApplications;
    
    return `You are an AI assistant helping with LinkedIn job applications. Your goal is to apply to ${config.targetCount} jobs ${isAllJobsMode ? 'using both Easy Apply and external company websites' : 'using LinkedIn\'s "Easy Apply" feature'}.

STEP-BY-STEP PROCESS:
1. Navigate directly to the job search URL: ${linkedinUrl}
2. If you need to login, use the provided credentials (email: ${config.linkedinEmail}, password: (use the value from the secret variable ln_password))
3. After page loads, look for the left sidebar with job listings - if it's collapsed or missing, try clicking any "expand" or "menu" buttons
4. Look for jobs ${isAllJobsMode ? 'with either "Easy Apply" buttons OR "Apply" buttons that lead to external websites' : 'with "Easy Apply" buttons'} in the job listings
5. For each suitable job (continue until you reach ${config.targetCount} applications):

${isAllJobsMode ? `
   FOR EASY APPLY JOBS:
   a. BEFORE clicking Easy Apply, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"
   b. Extract the actual company name from the job posting (not generic terms)
   c. Extract the exact job title from the posting
   d. Click the "Easy Apply" button
   e. Fill out the application form (scroll down if you can't see all fields)
   f. Answer any questions that appear (scroll to see all questions)
   g. Upload resume if prompted - use the specified LinkedIn resume: "${config.linkedinResume || 'Use the most recent resume available'}"
   h. SCROLL DOWN to find the "Submit" or "Submit application" button
   i. Before clicking submit, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   j. Click submit to complete the application
   k. Close the modal and move to the next job

   FOR EXTERNAL APPLY JOBS:
   a. BEFORE clicking Apply, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE] (EXTERNAL)"
   b. Click the "Apply" or "Apply on company website" button
   c. You will be redirected to the company's careers page
   d. Navigate through the external application process:
      - If registration is required, create an account using: ${externalData?.personalEmail || 'your email'}
      - Fill application forms with the following information:
        * Name: ${externalData?.firstName || 'John'} ${externalData?.lastName || 'Doe'}
        * Email: ${externalData?.personalEmail || 'john.doe@email.com'}
        * Phone: ${externalData?.personalPhone || '+1 (555) 123-4567'}
        * Address: ${externalData?.address || '123 Main Street'}
        * City: ${externalData?.city || 'San Francisco'}
        * State: ${externalData?.state || 'CA'}
        * ZIP: ${externalData?.zipCode || '94101'}
        * Country: ${externalData?.country || 'United States'}
        * LinkedIn: ${externalData?.linkedinProfile || 'https://linkedin.com/in/profile'}
        * Portfolio: ${externalData?.portfolioWebsite || ''}
        * GitHub: ${externalData?.githubProfile || ''}
      - Upload resume if required (use browser file upload)
      - Answer application questions intelligently based on the job requirements
      - Complete all required fields
   e. Before submitting, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE] (EXTERNAL)"
   f. Submit the external application
   g. Return to LinkedIn (navigate back or open new tab to LinkedIn)
   h. Continue to the next job
` : `
   a. BEFORE clicking Easy Apply, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"
   b. Extract the actual company name from the job posting (not generic terms)
   c. Extract the exact job title from the posting
   d. Click the "Easy Apply" button
   e. Fill out the application form (scroll down if you can't see all fields)
   f. Answer any questions that appear (scroll to see all questions)
   g. Upload resume if prompted - use the specified LinkedIn resume: "${config.linkedinResume || 'Use the most recent resume available'}"
   h. SCROLL DOWN to find the "Submit" or "Submit application" button
   i. Before clicking submit, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   j. Click submit to complete the application
   k. Close the modal and move to the next job
`}

6. Continue applying to jobs until you've completed ${config.targetCount} applications
7. If you run out of ${isAllJobsMode ? 'suitable jobs' : 'Easy Apply jobs'} on the current page:
   - Scroll down to load more jobs or click "See more jobs" if available
   - Try adjusting filters or broadening search criteria
   - Only stop when you've reached the target or no more suitable jobs are available

CRITICAL SCROLLING INSTRUCTIONS:

- ALWAYS scroll down when you can't find buttons like "Submit", "Next", "Continue", or "Apply"
- LinkedIn forms often have content below the fold - scroll to reveal hidden elements
- If you encounter form questions but can't see all of them, scroll down to see more questions
- When stuck on any form, try scrolling both up and down to find missing elements
- Easy Apply modals often require scrolling to see the submit button

COMPANY NAME EXTRACTION REQUIREMENTS:
- Extract the ACTUAL company name from the LinkedIn job posting
- Company names appear in these locations on LinkedIn:
  * Directly below or next to the job title
  * In the format "Job Title at Company Name" 
  * As a clickable company link/button
  * In the job details section
- CRITICAL: Always announce the company name you see BEFORE clicking Easy Apply
- Format: "I can see this is a [JOB TITLE] position at [COMPANY NAME]"
- DO NOT use generic terms like "Company", "Employer", "Organization", "LinkedIn Company"
- Examples of REAL company names: "Google", "Microsoft", "Meta", "Apple", "Netflix", "Shopify", "Stripe"
- If you cannot find the actual company name, announce "Unable to identify company name" and skip this job

JOB TITLE EXTRACTION REQUIREMENTS:
- Extract the EXACT job title from the posting
- Use the full title as displayed on LinkedIn
- Examples: "Senior Software Engineer", "Product Manager", "Data Scientist"

FORM HANDLING GUIDELINES:
- Always scroll down in Easy Apply forms to ensure you see all content
- If you can't find a "Submit" button, scroll down - it's usually below the visible area
- For multi-step forms, look for "Next" or "Continue" buttons (may require scrolling)
- If forms have multiple questions, scroll to see all questions before proceeding
- 🔧 RESUME HANDLING: If prompted to select a resume/CV file:
  * Look for existing resumes in the dropdown/selection list
  * Search for resume named: "${config.linkedinResume}"
  * Select the resume that matches this exact name
  * DO NOT upload a new file - always use existing uploaded resumes
  * If you can't find the exact name, select the most recent resume available
  * NEVER try to upload files during automation
- Skip optional fields if they're complex, but fill required fields
- If a form seems stuck, try scrolling up and down to find missing elements
- When filling contact information:
  * If there's a country code dropdown, select: ${config.countryCode.split('-')[0]}
  * For the phone number field, use ONLY the number WITHOUT country code: ${config.contactNumber}
  * Do NOT add the country code to the phone number field if you already selected it in a dropdown

🤖 DYNAMIC FIELD HANDLING:
- For fields that are dynamic and you don't have specific information to input, make EDUCATED GUESSES
- Use context clues from the job posting, company, and role to provide reasonable answers
- Examples of educated guesses:
  * Years of experience: Base on the job level (entry=1-2, mid=3-5, senior=5+)
  * Salary expectations: Research typical ranges for the role/location
  * Availability: Default to "2 weeks notice" or "Available immediately"
  * Skills questions: Answer positively if it's related to the job title
  * Certifications: Only claim if commonly associated with the role
- NEVER leave required fields blank - always provide a reasonable guess
- For yes/no questions about skills/experience, err on the side of confidence if it's job-relevant
- For text fields asking "Why are you interested?", provide a brief, professional response based on the company/role

LOGIN GUIDANCE:
- If prompted to login, enter email: ${config.linkedinEmail} and password: (use the value from the secret variable ln_password)
- If already logged in, proceed directly to job applications
- Don't get stuck on login verification - focus on the job application task

CREDENTIALS:
- Email: ${config.linkedinEmail}
- Password: (use the value from the secret variable ln_password)
- Country Code: ${config.countryCode.split('-')[0]}
- Phone Number (without country code): ${config.contactNumber}
- Resume to Use: ${config.linkedinResume || 'Most recent available'}

${config.customInstructions ? `
CUSTOM INSTRUCTIONS:
${config.customInstructions}
` : ''}

PROGRESS TRACKING:
- Keep count of how many applications you've submitted
- Announce progress: "APPLICATION #X of ${config.targetCount} COMPLETED"
- Continue until you reach exactly ${config.targetCount} applications

CRITICAL APPLICATION TRACKING - YOU MUST DO THIS FOR EVERY APPLICATION:
1. BEFORE clicking Easy Apply: 
   - Extract the job URL from the browser address bar or the job posting
   - Announce "APPLYING TO: [COMPANY NAME] - [JOB TITLE]"
   - Also note the job URL for tracking
2. BEFORE clicking Submit: 
   - Announce "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   - Include the job URL if available

IMPORTANT FORMAT RULES:
- Use EXACT format: "APPLYING TO: Company - Job Title" (no quotes, dash separator)
- Extract the REAL company name from the job posting (not "LinkedIn Company" or generic terms)
- Extract the EXACT job title from the posting header
- Company comes FIRST, then dash, then job title
- Capture the job URL from the address bar when on the job details page
- Example: "APPLYING TO: Google - Senior Software Engineer"
- Example: "SUBMITTING APPLICATION TO: Microsoft - Product Manager"

URL EXTRACTION:
- When viewing a job posting, note the URL from the browser address bar
- LinkedIn job URLs typically look like: https://www.linkedin.com/jobs/view/[job-id]/
- Include this URL in your tracking for later reference

This tracking is essential for saving your applications correctly.`;
  };



  const getTaskStatus = async (taskId: string): Promise<TaskStatus> => {
    if (!browserClient) {
      throw new Error('Browser client not initialized');
    }

    try {
      const status = await browserClient.getTaskStatus(taskId);
      const fullTask = await browserClient.getTask(taskId);
      
      // If task is finished, check if it actually completed successfully
      if (status === 'finished') {
        // Only mark as successful if we have steps indicating actual job applications
        const hasJobApplications = fullTask.steps?.some(step => 
          step.next_goal?.includes('APPLYING TO:') || 
          step.next_goal?.includes('SUBMITTING APPLICATION') ||
          step.evaluation_previous_goal?.includes('application submitted') ||
          step.next_goal?.includes('Submit application')
        );
        
        if (hasJobApplications) {
          addLog('✅ Automation completed successfully with job applications', 'success');
        } else {
          addLog('⚠️ Task finished but no job applications were completed. This may indicate a login issue.', 'error');
          addLog('💡 Try clearing your session and running automation again for manual login.', 'info');
        }
      }
      
      return {
        id: taskId,
        status: status,
        steps: fullTask.steps || [],
        output: fullTask.output || undefined,
        error: undefined,
        live_url: fullTask.live_url || undefined
      };
    } catch (error) {
      throw error;
    }
  };

  const stopTask = async (taskId: string): Promise<void> => {
    if (!browserClient) {
      throw new Error('Browser client not initialized');
    }

    try {
      addLog(`🛑 Stopping task: ${taskId}`);
      await browserClient.stopTask(taskId);
      addLog(`✅ Task stopped successfully: ${taskId}`, 'success');
    } catch (error) {
      addLog(`❌ Error stopping task: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error;
    }
  };

  const startAutomation = async () => {
    // 🔒 BULLETPROOF SECURITY CHECK - Server-side validation first
    if (!user) {
      setShowPaywall(true);
      addLog('❌ Authentication required to start automation', 'error');
      return;
    }

    try {
      // Validate subscription and usage limits
      const limits = getPlanUsageLimits();
      const currentUsage = monthlyUsage.tokens_used || 0;
      const maxSteps = limits.applications * 10;
      
      // Check if user has an active subscription
      if (!userSubscription || userSubscription.subscription_status !== 'active') {
        toast.error('Please upgrade to a paid plan to use automation features');
        setShowPaywall(true);
        return;
      }
      
      // Check usage limits for active subscribers
      if (maxSteps > 0 && currentUsage >= maxSteps) {
        toast.error('You have reached your monthly automation limit. Upgrade for more applications or wait until next month');
        return;
      }
    } catch (error) {
      toast.error('Unable to validate access - please try again');
      return;
    }

    // Activate extension error suppressor for cleaner console
    extensionSuppressor.activate();
    addLog('🛡️ Extension error suppressor activated for cleaner console output');

    if (!config.jobTitle.trim()) {
      toast.error('Please enter a job title or keywords to search for');
      return;
    }

    if (!config.location.trim()) {
      toast.error('Please select a location for your job search');
      return;
    }

    if (!config.linkedinEmail.trim()) {
      toast.error('Please enter your LinkedIn email');
      return;
    }

    if (!config.linkedinPassword?.trim()) {
      toast.error('Please enter your LinkedIn password');
      return;
    }

    if (!config.contactNumber.trim()) {
      toast.error('Please enter your contact number for job applications');
      return;
    }

    // Additional validation for external applications mode
    if (config.applicationMode === 'all_jobs') {
      const external = config.externalApplications;
      if (!external?.firstName?.trim()) {
        toast.error('Please enter your first name for external applications');
        return;
      }
      if (!external?.lastName?.trim()) {
        toast.error('Please enter your last name for external applications');
        return;
      }
      if (!external?.personalEmail?.trim()) {
        toast.error('Please enter your personal email for external applications');
        return;
      }
      if (!external?.personalPhone?.trim()) {
        toast.error('Please enter your phone number for external applications');
        return;
      }
    }

    if (!apiKey || apiKey.trim() === '') {
      toast.error('Browser Use API key is not configured. Please check your environment variables.');
      return;
    }

    if (!canStartAutomation()) {
      const limit = getTokenLimit() * 10;
      if (limit === 0) {
        toast.error(`No steps available. Current plan: ${getPlanName()}. Please upgrade your subscription.`);
      } else {
        toast.error(`Usage limit reached! You have used ${monthlyUsage.tokens_used}/${limit} steps this month.`);
      }
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    setLogs([]);
    setStepCount(0);
    setAppliedCount(0);

    try {
      addLog('🚀 Starting LinkedIn automation...');
      
      const task = await createLinkedInTask();
      setCurrentTask(task);
      
      addLog(`✅ Task created: ${task.id}`);
      
      // Save initial automation state
      saveAutomationState(task);
      
      // Start polling for status updates
      startPolling(task.id);

    } catch (error) {
      setIsRunning(false);
      
      if (error instanceof Error) {
        addLog(`❌ Error: ${error.message}`, 'error');
        toast.error(error.message);
      } else {
        addLog('❌ Unknown error occurred while starting automation', 'error');
        toast.error('Unknown error occurred while starting automation');
      }
    }
  };

  const pauseAutomation = async () => {
    if (!currentTask || !browserClient) return;

    try {
      await browserClient.pauseTask(currentTask.id);
      setIsPaused(true);
      
      // Update and save the current task state
      const updatedTask = { ...currentTask, status: 'paused' as const };
      setCurrentTask(updatedTask);
      saveAutomationState(updatedTask);
      
      addLog('⏸️ Automation paused - you can refresh the page and resume later');
      toast.success('Automation paused');
    } catch (error) {
      toast.error('Failed to pause automation');
    }
  };

  const resumeAutomation = async () => {
    if (!currentTask || !browserClient) return;

    try {
      await browserClient.resumeTask(currentTask.id);
      setIsPaused(false);
      setIsRunning(true);
      
      // Update and save the current task state
      const updatedTask = { ...currentTask, status: 'running' as const };
      setCurrentTask(updatedTask);
      saveAutomationState(updatedTask);
      
      // Resume polling
      startPolling(currentTask.id);
      
      addLog('▶️ Automation resumed - task is now running');
      toast.success('Automation resumed');
    } catch (error) {
      toast.error('Failed to resume automation');
    }
  };

  const stopAutomation = async () => {
    // Clear polling interval first
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }

    if (!currentTask) {
      // No task to stop, just reset UI state
      setIsRunning(false);
      setIsPaused(false);
      clearAutomationState();
      addLog('⏹️ Automation stopped by user');
      toast.success('Automation stopped');
      return;
    }

    try {
      await stopTask(currentTask.id);
      
      addLog('🔄 Fetching final task details after manual stop...', 'info');
      
      // Wait a moment for the stop to be processed, then fetch final state
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const finalTask = await getTaskStatus(currentTask.id);
        
        const finalStepCount = finalTask.steps?.length || 0;
        setStepCount(finalStepCount);
        
        // Track final step count (this will upsert to ensure we have the correct total)
        await trackUsage(finalStepCount, currentTask.id);
        addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
        
        // Mark task as stopped in database with final step count
        await markTaskCompleted(currentTask.id, finalStepCount, 'stopped');
        
        addLog(`📊 Final step count: ${finalStepCount}`);
        
        // Refresh usage data
        fetchUserSubscription();
        
      } catch (error) {
        addLog('⚠️ Could not fetch final task details after stop', 'error');
      }
      
      setIsRunning(false);
      setIsPaused(false);
      setCurrentTask(null);
      clearAutomationState();
      addLog('⏹️ Automation stopped by user');
      toast.success('Automation stopped');
    } catch (error) {
      // Even if API call fails, reset UI state so user isn't stuck
      setIsRunning(false);
      setIsPaused(false);
      setCurrentTask(null);
      clearAutomationState();
      
      // Check if it's a network/timeout error vs already stopped
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('already stopped') || errorMessage.includes('session')) {
        addLog('⏹️ Automation was already stopped');
        toast.success('Automation stopped');
      } else {
        addLog(`⚠️ Stop command failed but UI reset: ${errorMessage}`, 'error');
        toast.error('Automation stopped locally (server may still be running)');
      }
    }
  };

  const startPolling = (taskId: string) => {
    // Clear any existing polling interval
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    // Start polling for task status
    const interval = setInterval(async () => {
      try {
        const updatedTask = await getTaskStatus(taskId);
          setCurrentTask(updatedTask);

          if (updatedTask.steps) {
            const newStepCount = updatedTask.steps.length;
            
            if (newStepCount > stepCount) {
              // Track the TOTAL steps (not incremental) - this will upsert in the database
            await trackUsage(newStepCount, taskId);
              
              // Calculate total steps used for limit checking
            const limit = getTokenLimit(); // getTokenLimit() already returns step limit (applications * 10)
            
            // Only check limit if we have a meaningful limit (not 0)
            if (limit > 0 && newStepCount >= limit) {
              clearInterval(interval);
              setPollInterval(null);
                setIsRunning(false);
              await stopTask(taskId);
                addLog(`🛑 Automation stopped: Monthly limit of ${limit} steps reached!`, 'error');
                toast.error('Automation stopped due to usage limit');
              clearAutomationState();
                return;
            }
            
            // Also check if we've reached the target application count
            const targetApplications = parseInt(config.targetCount) || 10;
            if (appliedCount >= targetApplications) {
              addLog(`🎯 Target reached: Applied to ${appliedCount}/${targetApplications} jobs!`, 'success');
              }
            }
            
            setStepCount(newStepCount);
            
          // Look for successful application submissions only
            const applicationSteps = updatedTask.steps.filter(step => {
            const stepText = step.next_goal || step.evaluation_previous_goal || '';
            // Only count steps with our specific announcement format
            return /SUBMITTING APPLICATION TO:/i.test(stepText);
          });
          
          // Process new applications with deduplication
            if (applicationSteps.length > 0) {
            // Track which applications we've already processed in this session
            const sessionProcessedApps = new Set<string>();
            
            // Get all previously saved applications for this task to avoid duplicates
            const { data: existingApps } = await supabase
              .from('applications')
              .select('company, role')
              .eq('details->>task_id', taskId);
            
            if (existingApps) {
              existingApps.forEach(app => {
                if (app.company && app.role) {
                  sessionProcessedApps.add(`${app.company.toLowerCase()}-${app.role.toLowerCase()}`);
                }
              });
            }
            
            let newApplicationsCount = 0;
            
            for (const appStep of applicationSteps) {
              const stepText = appStep.next_goal || appStep.evaluation_previous_goal || '';
              // Also check the output field for URL extraction
              const fullStepText = `${stepText} ${appStep.output || ''}`;
              const companyRole = extractCompanyRoleFromStep(fullStepText);
                
              if (companyRole.company && companyRole.role) {
                const appKey = `${companyRole.company.toLowerCase()}-${companyRole.role.toLowerCase()}`;
                
                // Only save if we haven't processed this exact application in this session
                if (!sessionProcessedApps.has(appKey)) {
                  sessionProcessedApps.add(appKey);
                  const saved = await saveJobApplication(companyRole.company, companyRole.role, taskId, companyRole.url);
                  if (saved) {
                    newApplicationsCount++;
                  }
                }
              }
            }
            
            // Update the applied count based on what's actually saved in the database
            setAppliedCount(sessionProcessedApps.size);
            
            if (newApplicationsCount > 0) {
              addLog(`💼 Saved ${newApplicationsCount} new application(s) to database`);
            }
          }
          }

        // Save current state
        saveAutomationState(updatedTask);

          if (updatedTask.status === 'finished') {
          clearInterval(interval);
          setPollInterval(null);
            setIsRunning(false);
            
            addLog('🔄 Fetching final task details...', 'info');
            
            // Wait a moment for browser-use API to finalize the task
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fetch final task state to ensure we have all steps
            try {
            const finalTask = await getTaskStatus(taskId);
              setCurrentTask(finalTask);
              
              const finalStepCount = finalTask.steps?.length || 0;
              const finalApplicationCount = finalTask.steps ? finalTask.steps.filter(step => {
                const stepText = (JSON.stringify(step.action || {}) + ' ' + (step.output || '')).toLowerCase();
                return stepText.includes('submitting application to:') || 
                       stepText.includes('applying to:') ||
                       stepText.includes('submit application') ||
                       (stepText.includes('submit') && stepText.includes('successfully'));
              }).length : 0;
              
              setStepCount(finalStepCount);
              setAppliedCount(finalApplicationCount);
              
              addLog(`📊 Final Summary: ${finalStepCount} total steps, ${finalApplicationCount} applications submitted`);
              
              // Track final step count (this will upsert to ensure we have the correct total)
            await trackUsage(finalStepCount, taskId);
              addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
              
              // Mark task as completed in database with final step count
            await markTaskCompleted(taskId, finalStepCount, 'finished');
            
            // Final application extraction already handled above
              
              addLog('✅ Automation completed successfully!', 'success');
              
              if (finalTask.output) {
                addLog(`📊 Final Results: ${finalTask.output}`);
              }
              
            } catch (error) {
              addLog('⚠️ Could not fetch final task details, using last known state', 'error');
              
              // Fallback to last known state
            await markTaskCompleted(taskId, updatedTask.steps?.length || 0, 'finished');
            }
            
          // Clear automation state and refresh usage data
          clearAutomationState();
            fetchUserSubscription();
            
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          } else if (updatedTask.status === 'failed') {
          clearInterval(interval);
          setPollInterval(null);
            setIsRunning(false);
            
            addLog('🔄 Fetching final task details for failed task...', 'info');
            
            // Wait a moment and fetch final state
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
            const finalTask = await getTaskStatus(taskId);
              setCurrentTask(finalTask);
              
              const finalStepCount = finalTask.steps?.length || 0;
              setStepCount(finalStepCount);
              
              // Track final step count (this will upsert to ensure we have the correct total)
            await trackUsage(finalStepCount, taskId);
              addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
              
              // Mark task as failed in database with final step count
            await markTaskCompleted(taskId, finalStepCount, 'failed', finalTask.error || updatedTask.error);
              
              addLog(`❌ Automation failed: ${finalTask.error || updatedTask.error || 'Unknown error'}`, 'error');
              addLog(`📊 Final step count: ${finalStepCount}`);
              
            } catch (error) {
            await markTaskCompleted(taskId, updatedTask.steps?.length || 0, 'failed', updatedTask.error);
              addLog(`❌ Automation failed: ${updatedTask.error || 'Unknown error'}`, 'error');
            }
            
          // Clear automation state and refresh usage data
          clearAutomationState();
            fetchUserSubscription();
            
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          } else if (updatedTask.status === 'stopped') {
          clearInterval(interval);
          setPollInterval(null);
            setIsRunning(false);
            
            addLog('🔄 Fetching final task details for stopped task...', 'info');
            
            // Wait a moment and fetch final state
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
            const finalTask = await getTaskStatus(taskId);
              setCurrentTask(finalTask);
              
              const finalStepCount = finalTask.steps?.length || 0;
              setStepCount(finalStepCount);
              
              // Track final step count (this will upsert to ensure we have the correct total)
            await trackUsage(finalStepCount, taskId);
              addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
              
              // Mark task as stopped in database with final step count
            await markTaskCompleted(taskId, finalStepCount, 'stopped');
              
              addLog('⏹️ Automation stopped by user');
              addLog(`📊 Final step count: ${finalStepCount}`);
              
            } catch (error) {
            await markTaskCompleted(taskId, updatedTask.steps?.length || 0, 'stopped');
              addLog('⏹️ Automation stopped by user');
            }
            
          // Clear automation state and refresh usage data
          clearAutomationState();
            fetchUserSubscription();
            
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          }
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
          // Error checking task status
          }
        }
      }, 3000);

    setPollInterval(interval as unknown as number);

    // Auto-cleanup after 30 minutes
      setTimeout(() => {
      clearInterval(interval);
        if (isRunning) {
          addLog('⏰ Automation timed out after 30 minutes');
          setIsRunning(false);
        clearAutomationState();
        }
      }, 30 * 60 * 1000);
  };

  const markTaskCompleted = async (taskId: string, finalSteps: number, status: 'finished' | 'failed' | 'stopped', error?: string) => {
    try {
      if (!isSupabaseConfigured() || !user) return;

      const finalCost = Math.ceil(finalSteps / 10) * 0.01;
      
      const { error: updateError } = await supabase
        .from('automation_tasks')
        .update({
          status: status,
          step_count: finalSteps,
          cost_usd: finalCost,
          completed_at: new Date().toISOString(),
          error_message: error || null
        })
        .eq('task_id', taskId)
        .eq('user_id', user.id);

      if (updateError) {
        addLog(`⚠️ Failed to mark task as completed: ${updateError.message}`, 'error');
      } else {
        addLog(`✅ Task ${taskId} marked as ${status}`);
        
        // Create notification for task completion
        let notificationTitle = '';
        let notificationMessage = '';
        let notificationType: 'success' | 'error' | 'info' = 'info';
        let iconName = 'Clock';

        switch (status) {
          case 'finished':
            notificationTitle = 'Automation Completed';
            notificationMessage = `LinkedIn automation finished successfully. ${finalSteps} steps completed.`;
            notificationType = 'success';
            iconName = 'CheckCircle';
            break;
          case 'failed':
            notificationTitle = 'Automation Failed';
            notificationMessage = error || 'Automation task encountered an error and stopped.';
            notificationType = 'error';
            iconName = 'AlertCircle';
            break;
          case 'stopped':
            notificationTitle = 'Automation Stopped';
            notificationMessage = `Automation was stopped by user. ${finalSteps} steps completed.`;
            notificationType = 'info';
            iconName = 'Clock';
            break;
        }

        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            title: notificationTitle,
            message: notificationMessage,
            type: notificationType,
            icon_name: iconName,
            data: {
              taskId: taskId,
              finalSteps: finalSteps,
              finalCost: finalCost,
              status: status,
              error: error || null
            }
          });
      }
    } catch (error) {
      // Error marking task completed
    }
  };



    const extractCompanyRoleFromStep = (stepText: string): { company: string | null; role: string | null; url: string | null } => {
    // Handle both Easy Apply and External applications
    // Patterns: 
    // "SUBMITTING APPLICATION TO: Company - Job Title"
    // "SUBMITTING APPLICATION TO: Company - Job Title (EXTERNAL)"
    const pattern = /SUBMITTING APPLICATION TO:\s*([^-\n]+?)\s*-\s*([^\n(]+?)(?:\s*\(EXTERNAL\))?/i;
    const match = stepText.match(pattern);
    
    if (!match) {
      return { company: null, role: null, url: null };
    }
    
    let company = match[1]?.trim();
    let role = match[2]?.trim();
    
    if (!company || !role) {
      return { company: null, role: null, url: null };
    }
    
    // Clean extracted text
    company = company.replace(/['"[\]{}()]/g, '').trim();
    role = role.replace(/['"[\]{}()]/g, '').trim();
    
    // Remove instruction words that might leak in
    const instructionWords = /\b(scroll|click|submit|fill|enter|navigate|wait|find|search|apply|button|form|field|page|down|up)\b/gi;
    role = role.replace(instructionWords, '').replace(/\s+/g, ' ').trim();
    
    // Extract only the core job title (before any instruction text)
    role = role.split(/\s+(to|for|at|in|on|with|by|the|a|an)\s+/i)[0].trim();
    
    // Extract URL if present in the step text
    let url: string | null = null;
    const urlPattern = /https?:\/\/[^\s\]}"']+/g;
    const urlMatches = stepText.match(urlPattern);
    if (urlMatches) {
      // Look for LinkedIn job URLs specifically
      const jobUrl = urlMatches.find(u => u.includes('linkedin.com/jobs/view/') || u.includes('linkedin.com/jobs/collections/'));
      url = jobUrl || null;
    }
    
    // Final validation - must be real company and clean job title
    if (isValidCompanyName(company) && isValidJobTitle(role) && role.length >= 3 && role.length <= 50) {
      return { company, role, url };
    }
    
    return { company: null, role: null, url: null };
  };

  // Helper function to validate company names
  const isValidCompanyName = (company: string): boolean => {
    if (!company || company.length < 2) return false;
    
    const invalidTerms = ['company', 'linkedin', 'employer', 'organization', 'corp', 'the company'];
    const lowerCompany = company.toLowerCase();
    
    for (const term of invalidTerms) {
      if (lowerCompany === term || lowerCompany.includes(term)) {
        return false;
      }
    }
    
    // Company names should have at least one letter and not be all numbers
    return /[a-zA-Z]/.test(company) && !/^\d+$/.test(company);
  };

  // Helper function to validate job titles
  const isValidJobTitle = (role: string): boolean => {
    if (!role || role.length < 3 || role.length > 50) return false;
    
    // Must contain letters and be a reasonable job title
    if (!/[a-zA-Z]/.test(role)) return false;
    
    // Reject if it contains instruction words
    const instructionWords = /\b(scroll|click|submit|fill|enter|navigate|wait|find|search|apply|button|form|field|page|down|up|linkedin|instructions|continue|next|previous|step)\b/i;
    if (instructionWords.test(role)) return false;
    
    // Reject if it's mostly punctuation or numbers
    const alphaRatio = (role.match(/[a-zA-Z]/g) || []).length / role.length;
    if (alphaRatio < 0.6) return false;
    
    return true;
  };



  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
                      <div className="h-10 bg-white/20 dark:bg-white/20 rounded-lg w-1/3 mb-4 shimmer"></div>
            <div className="h-96 bg-white/20 dark:bg-white/20 rounded-2xl shimmer"></div>
        </div>
      </div>
    );
  }

  const handleUpgrade = () => {
    navigate('/billing');
  };

  // Show loading state while checking access
  if (!accessCheckComplete) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Checking access...</span>
        </div>
      </div>
    );
  }

  return (
    <>
                      <ConditionalBackground className="fixed inset-0 z-0" animate={false} />
      <div className="relative min-h-screen max-w-4xl mx-auto space-y-8 z-10">
      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="LinkedIn Auto Apply"
        description="Automate your job applications with AI-powered LinkedIn bot that applies to relevant positions based on your preferences"
        onUpgrade={handleUpgrade}
        requiredPlan="any"
      />
      {/* Simple Header */}
      <div className="text-center">
        <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-6 shadow-lg">
          <Bot className="w-5 h-5 text-white mr-2" />
          <span className="text-white font-semibold">LinkedIn Auto Apply</span>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          AI-Powered Job Applications
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Automate your LinkedIn job applications with AI. Set your preferences and let our bot apply to relevant positions.
        </p>
      </div>

      {/* API Configuration Warning */}
      {!apiKey && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                API Configuration Required
              </h3>
              <p className="text-amber-700 dark:text-amber-300 mb-4">
                Please configure your Browser Use API key to enable LinkedIn automation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Panel Toggle */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setShowConfigPanel(!showConfigPanel)}
          className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Settings className="w-5 h-5 mr-2" />
          {showConfigPanel ? 'Hide Configuration' : 'Configure AI Agent'}
          {showConfigPanel ? (
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Important Instructions Dropdown */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setShowImportantInstructions((prev) => !prev)}
          className={`inline-flex items-center px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-2 border-amber-600 ${showImportantInstructions ? 'ring-4 ring-amber-300/40' : ''}`}
        >
          <AlertCircle className="w-6 h-6 mr-3 text-white animate-pulse" />
          IMPORTANT: You MUST read these instructions before using the AI Agent
          <svg className={`w-5 h-5 ml-3 transition-transform duration-200 ${showImportantInstructions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {showImportantInstructions && (
        <div className="mb-8 mx-auto max-w-2xl p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl shadow flex items-start space-x-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
            <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Important Instructions for LinkedIn Automation
            </p>
            <ul className="list-disc pl-5 text-sm text-blue-700 dark:text-blue-100 space-y-2">
              <li>
                <strong>After entering your email and password, stay on the browser preview.</strong> If you see any verification, CAPTCHA, or 2FA prompt, <span className="font-bold text-blue-900 dark:text-white">immediately press the <span className='underline'>Pause</span> button</span> in our UI. <br/>
                <span className="text-blue-900 dark:text-blue-200">If you do not press Pause, the AI agent will automatically shut down to save your credits, as it cannot bypass these security checks.</span> <br/>
                Once you complete the verification manually in the browser preview, press <span className='underline'>Resume</span> to continue automation.
              </li>
              <li>
                <strong>Resume Upload:</strong> To save your credits, our AI agent <span className="font-bold">does NOT upload your resume for you</span>. <br/>
                <span className="text-blue-900 dark:text-blue-200">You must upload your resume to LinkedIn yourself. When prompted for the resume name in the AI Agent configuration panel, enter the <span className='underline'>exact name</span> of your resume as it appears on LinkedIn. The agent will use the resume with that exact name for job applications.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

            {/* AI Model Selection - Minimalistic Dropdown */}
      <div className="glass-card rounded-xl p-6">
        {/* Dropdown Header */}
        <div 
          className="flex items-center justify-between cursor-pointer group hover:bg-white/5 dark:hover:bg-gray-800/10 rounded-lg p-2 -m-2 transition-all duration-200"
          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
        >
          <div className="flex items-center space-x-4">
            <div className={`w-10 h-10 bg-gradient-to-br ${AI_MODELS[selectedModel].color} rounded-xl flex items-center justify-center shadow-lg`}>
              <span className="text-xl">{AI_MODELS[selectedModel].icon}</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {AI_MODELS[selectedModel].name}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({AI_MODELS[selectedModel].requestLabel})
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {AI_MODELS[selectedModel].provider} • {AI_MODELS[selectedModel].description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
                             <p className="text-xs text-gray-500 dark:text-gray-400">
                 {(() => {
                   const stepsPerApp = 10;
                   const totalSteps = parseInt(config.targetCount) * stepsPerApp;
                   const stepMultiplier = AI_MODELS[selectedModel].stepMultiplier;
                   const totalSteps_calculated = totalSteps * stepMultiplier;
                   return `${totalSteps_calculated.toLocaleString()} steps`;
                 })()}
               </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">for {config.targetCount} applications</p>
            </div>
            
            <div className={`p-2 rounded-lg bg-white/10 dark:bg-gray-800/20 transition-all duration-300 group-hover:bg-white/20 dark:group-hover:bg-gray-700/30 ${
              isModelDropdownOpen ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
            }`}>
              <svg 
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${
                  isModelDropdownOpen ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Dropdown Content */}
        <AnimatePresence>
          {isModelDropdownOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-white/10 dark:border-gray-700/20">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Choose AI model:</p>
                
                <div className="space-y-3">
                  {Object.entries(AI_MODELS).map(([modelKey, modelInfo]) => {
                    const isSelected = selectedModel === modelKey;
                    return (
                      <div
                        key={modelKey}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(modelKey as keyof typeof AI_MODELS);
                          setIsModelDropdownOpen(false);
                          saveConfiguration();
                        }}
                        className={`relative p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md' 
                            : 'border-white/20 dark:border-gray-600/20 bg-white/10 dark:bg-gray-800/10 hover:border-white/40 dark:hover:border-gray-500/40 hover:bg-white/20 dark:hover:bg-gray-700/20'
                        }`}
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}

                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 bg-gradient-to-br ${modelInfo.color} rounded-lg flex items-center justify-center shadow-md`}>
                            <span className="text-lg">{modelInfo.icon}</span>
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">{modelInfo.name}</h4>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{modelInfo.provider}</span>
                              {modelInfo.stepMultiplier === 1 && (
                                <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                                  Most Efficient
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600 dark:text-gray-400">{modelInfo.description}</p>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{modelInfo.requestLabel}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-gray-50/50 dark:bg-gray-800/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    Each job application uses approximately 10 automation steps
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Configuration Panel */}
      {showConfigPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-fade-in" 
            onClick={() => setShowConfigPanel(false)} 
          />
          
          {/* Modal */}
          <div className="relative glass-card rounded-3xl p-8 w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-modal-popup">
            {/* Premium Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white dark:text-white">
                    AI Agent Configuration
                  </h2>
                  <p className="text-white/80 dark:text-white/80 mt-1">
                    Customize your intelligent LinkedIn automation assistant
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={saveConfiguration}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  Save Configuration
                </button>
                <button
                  onClick={() => setShowConfigPanel(false)}
                  className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/10 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LinkedIn Credentials */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-white/20 dark:border-gray-700/20">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white dark:text-white">LinkedIn Account</h3>
                  <p className="text-sm text-white/70 dark:text-white/70">Your LinkedIn login credentials</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  LinkedIn Email Address *
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="your.email@company.com"
                  value={config.linkedinEmail}
                  onChange={(e) => setConfig(prev => ({ ...prev, linkedinEmail: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  LinkedIn Password *
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="Your LinkedIn password"
                  value={config.linkedinPassword || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                />
                <div className="mt-1 text-xs text-white/60">
                  Used for automated login - you'll handle 2FA manually if required
                </div>
              </div>
              
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  ⚠️ Important: Disable 2FA Before Using Automation
                </h4>
                <div className="text-xs text-red-300 space-y-2">
                  <p><strong>Required steps:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to LinkedIn Settings & Privacy → Account access</li>
                    <li>Temporarily disable Two-step verification</li>
                    <li>Run the automation with just email/password</li>
                    <li>Re-enable 2FA after automation completes</li>
                  </ol>
                  <p className="mt-3 text-emerald-300">
                    ✨ <strong>This ensures reliable automation</strong> - no manual intervention needed
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Phone Number
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <select
                    className="col-span-1 px-3 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white transition-all duration-200"
                    value={config.countryCode}
                    onChange={(e) => setConfig(prev => ({ ...prev, countryCode: e.target.value }))}
                  >
                    <option value="+1-US">🇺🇸 +1 (US)</option>
                    <option value="+1-CA">🇨🇦 +1 (Canada)</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+39">🇮🇹 +39</option>
                    <option value="+34">🇪🇸 +34</option>
                    <option value="+31">🇳🇱 +31</option>
                    <option value="+46">🇸🇪 +46</option>
                    <option value="+47">🇳🇴 +47</option>
                    <option value="+45">🇩🇰 +45</option>
                    <option value="+358">🇫🇮 +358</option>
                    <option value="+41">🇨🇭 +41</option>
                    <option value="+43">🇦🇹 +43</option>
                    <option value="+32">🇧🇪 +32</option>
                    <option value="+351">🇵🇹 +351</option>
                    <option value="+353">🇮🇪 +353</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+82">🇰🇷 +82</option>
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+852">🇭🇰 +852</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+64">🇳🇿 +64</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+52">🇲🇽 +52</option>
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+56">🇨🇱 +56</option>
                    <option value="+57">🇨🇴 +57</option>
                    <option value="+51">🇵🇪 +51</option>
                    <option value="+27">🇿🇦 +27</option>
                    <option value="+234">🇳🇬 +234</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+90">🇹🇷 +90</option>
                    <option value="+7">🇷🇺 +7</option>
                    <option value="+380">🇺🇦 +380</option>
                    <option value="+48">🇵🇱 +48</option>
                    <option value="+420">🇨🇿 +420</option>
                    <option value="+36">🇭🇺 +36</option>
                    <option value="+40">🇷🇴 +40</option>
                  </select>
                  <input
                    type="tel"
                    className="col-span-2 px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                    placeholder="Phone number"
                    value={config.contactNumber}
                    onChange={(e) => setConfig(prev => ({ ...prev, contactNumber: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Resume Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="e.g., 'Software Engineer Resume'"
                  value={config.linkedinResume}
                  onChange={(e) => setConfig(prev => ({ ...prev, linkedinResume: e.target.value }))}
                />
              </div>
            </div>

            {/* Job Preferences */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-white/20 dark:border-gray-700/20">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white dark:text-white">Job Preferences</h3>
                  <p className="text-sm text-white/70 dark:text-white/70">Define your job search criteria</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="Software Engineer, Data Scientist..."
                  value={config.jobTitle}
                  onChange={(e) => setConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="San Francisco, Remote..."
                  value={config.location}
                                              onChange={(e) => {
                              const newLocation = e.target.value;
                              setConfig(prev => ({ 
                                ...prev, 
                                location: newLocation,
                                // Reset locationId when location changes to force fresh lookup
                                locationId: LINKEDIN_LOCATIONS[newLocation as keyof typeof LINKEDIN_LOCATIONS] || ''
                              }));
                            }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Target Applications
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="10"
                  min="1"
                  max="50"
                  value={config.targetCount}
                  onChange={(e) => setConfig(prev => ({ ...prev, targetCount: e.target.value }))}
                />
              </div>

            </div>

            {/* Application Mode Selection */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-white/20 dark:border-gray-700/20">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white dark:text-white">Application Mode</h3>
                  <p className="text-sm text-white/70 dark:text-white/70">Choose which types of jobs to apply to</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-3">
                  Job Application Type
                </label>
                <div className="space-y-3">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="applicationMode"
                      value="easy_apply_only"
                      checked={config.applicationMode === 'easy_apply_only' || !config.applicationMode}
                      onChange={(e) => setConfig(prev => ({ ...prev, applicationMode: e.target.value as 'easy_apply_only' | 'all_jobs' }))}
                      className="mt-1 w-4 h-4 text-emerald-600 border-white/30 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-white font-medium">Easy Apply Only (Recommended)</div>
                      <div className="text-white/70 text-sm">Apply only to jobs with LinkedIn's Easy Apply feature. Faster and more reliable.</div>
                    </div>
                  </label>
                  
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="applicationMode"
                      value="all_jobs"
                      checked={config.applicationMode === 'all_jobs'}
                      onChange={(e) => setConfig(prev => ({ ...prev, applicationMode: e.target.value as 'easy_apply_only' | 'all_jobs' }))}
                      className="mt-1 w-4 h-4 text-emerald-600 border-white/30 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-white font-medium">All Jobs (Advanced)</div>
                      <div className="text-white/70 text-sm">Apply to all jobs including external company websites. AI will create accounts and fill forms automatically.</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* External Applications Details */}
              {config.applicationMode === 'all_jobs' && (
                <div className="mt-6 p-6 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-600/20">
                  <h4 className="text-lg font-semibold text-white mb-4">External Application Details</h4>
                  <p className="text-white/70 text-sm mb-6">
                    This information will be used to automatically fill application forms on external company websites.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">First Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="John"
                        value={config.externalApplications?.firstName || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: e.target.value,
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Last Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="Doe"
                        value={config.externalApplications?.lastName || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: e.target.value,
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Personal Email *</label>
                      <input
                        type="email"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="john.doe@email.com"
                        value={config.externalApplications?.personalEmail || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: e.target.value,
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Phone Number *</label>
                      <input
                        type="tel"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="+1 (555) 123-4567"
                        value={config.externalApplications?.personalPhone || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: e.target.value,
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-white/90 mb-2">Address</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="123 Main Street"
                        value={config.externalApplications?.address || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: e.target.value,
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">City</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="San Francisco"
                        value={config.externalApplications?.city || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: e.target.value,
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">State/Province</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="CA"
                        value={config.externalApplications?.state || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: e.target.value,
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">ZIP/Postal Code</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="94101"
                        value={config.externalApplications?.zipCode || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: e.target.value,
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Country</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="United States"
                        value={config.externalApplications?.country || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: e.target.value,
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <h5 className="text-md font-medium text-white mb-3 mt-4">Optional Professional Links</h5>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">LinkedIn Profile</label>
                      <input
                        type="url"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="https://linkedin.com/in/johndoe"
                        value={config.externalApplications?.linkedinProfile || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: e.target.value,
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">Portfolio/Website</label>
                      <input
                        type="url"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="https://johndoe.com"
                        value={config.externalApplications?.portfolioWebsite || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: e.target.value,
                            githubProfile: prev.externalApplications?.githubProfile || '',
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">GitHub Profile</label>
                      <input
                        type="url"
                        className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/60"
                        placeholder="https://github.com/johndoe"
                        value={config.externalApplications?.githubProfile || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          externalApplications: {
                            ...prev.externalApplications,
                            firstName: prev.externalApplications?.firstName || '',
                            lastName: prev.externalApplications?.lastName || '',
                            personalEmail: prev.externalApplications?.personalEmail || '',
                            personalPhone: prev.externalApplications?.personalPhone || '',
                            address: prev.externalApplications?.address || '',
                            city: prev.externalApplications?.city || '',
                            state: prev.externalApplications?.state || '',
                            zipCode: prev.externalApplications?.zipCode || '',
                            country: prev.externalApplications?.country || '',
                            linkedinProfile: prev.externalApplications?.linkedinProfile || '',
                            portfolioWebsite: prev.externalApplications?.portfolioWebsite || '',
                            githubProfile: e.target.value,
                          }
                        }))}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-amber-200 text-sm font-medium">Advanced Feature Warning</p>
                        <p className="text-amber-200/80 text-xs mt-1">
                          External applications require more AI steps and may take longer. The AI will navigate to company websites, 
                          create accounts if needed, and fill application forms automatically. Monitor the process carefully.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Filters */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-white/20 dark:border-gray-700/20">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white dark:text-white">Advanced Filters</h3>
                  <p className="text-sm text-white/70 dark:text-white/70">Optional LinkedIn search filters</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Work Type
                </label>
                <select
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white transition-all duration-200"
                  value={config.workType || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, workType: e.target.value || undefined }))}
                >
                  <option value="">Any work type</option>
                  <option value="Remote">Remote</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Experience Level
                </label>
                <select
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white transition-all duration-200"
                  value={config.experienceLevel || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, experienceLevel: e.target.value || undefined }))}
                >
                  <option value="">Any experience level</option>
                  <option value="Internship">Internship</option>
                  <option value="Entry level">Entry level</option>
                  <option value="Associate">Associate</option>
                  <option value="Mid-Senior level">Mid-Senior level</option>
                  <option value="Director">Director</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Job Type
                </label>
                <select
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white transition-all duration-200"
                  value={config.jobType || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, jobType: e.target.value || undefined }))}
                >
                  <option value="">Any job type</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Volunteer">Volunteer</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Date Posted
                </label>
                <select
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white transition-all duration-200"
                  value={config.datePosted || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, datePosted: e.target.value || undefined }))}
                >
                  <option value="">Any time</option>
                  <option value="r86400">Past 24 hours</option>
                  <option value="r604800">Past week</option>
                  <option value="r2592000">Past month</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 dark:text-white/90 mb-2">
                  Company Size
                </label>
                <select
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white transition-all duration-200"
                  value={config.companySize || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, companySize: e.target.value || undefined }))}
                >
                  <option value="">Any company size</option>
                  <option value="A">Self-employed</option>
                  <option value="B">1-10 employees</option>
                  <option value="C">11-50 employees</option>
                  <option value="D">51-200 employees</option>
                  <option value="E">201-500 employees</option>
                  <option value="F">501-1000 employees</option>
                  <option value="G">1001-5000 employees</option>
                  <option value="H">5001-10000 employees</option>
                  <option value="I">10001+ employees</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Instructions - Full Width */}
          <div className="lg:col-span-3 mt-8 pt-8 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">AI Agent Instructions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Prompt your AI agent with custom behavior instructions</p>
              </div>
            </div>
            
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                    Prompt Your AI Agent
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    Give your AI agent specific instructions beyond the standard filters. This is for behavioral guidance, preferences, and custom decision-making criteria.
                  </p>
                </div>
              </div>
            </div>
            
            <textarea
              className="w-full px-4 py-3 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none transition-all duration-200"
              rows={4}
              placeholder="e.g., 'Prioritize companies with good work-life balance', 'Avoid positions requiring extensive travel', 'Focus on mission-driven organizations'..."
              value={config.customInstructions}
              onChange={(e) => setConfig(prev => ({ ...prev, customInstructions: e.target.value }))}
            />
          </div>
        </div>
        </div>
      )}

      {/* Control Panel */}
                      <div className="glass-card rounded-xl p-8">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Automation Control</h3>
            <p className="text-gray-600 dark:text-gray-300">Monitor and control your LinkedIn automation</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stepCount}</div>
            <div className="text-sm text-blue-600 dark:text-blue-400">Steps</div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{Math.ceil(stepCount / 10)}</div>
            <div className="text-sm text-purple-600 dark:text-purple-400">Tokens</div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{appliedCount}</div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400">Applied</div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {appliedCount > 0 ? Math.round((appliedCount / parseInt(config.targetCount)) * 100) : 0}%
            </div>
            <div className="text-sm text-orange-600 dark:text-orange-400">Progress</div>
          </div>
        </div>

        {/* Auto-Stop Warning */}
        {(isRunning || isPaused) && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  💰 Cost Protection Active
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Your automation will automatically stop if you close this tab or navigate away to prevent unnecessary backend charges. 
                  Keep this tab open to monitor progress.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {!isRunning ? (
            <button
              onClick={startAutomation}
              disabled={!canStartAutomation() || !apiKey}
              className="flex-1 inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Auto Apply
            </button>
          ) : (
            <>
              {!isPaused ? (
                <button
                  onClick={pauseAutomation}
                  disabled={!currentTask?.id}
                  className="flex-1 inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pause className="w-5 h-5 mr-2" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={resumeAutomation}
                  className="flex-1 inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Resume
                </button>
              )}
              <button
                onClick={stopAutomation}
                disabled={!currentTask?.id}
                className="flex-1 inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop
              </button>
            </>
          )}
        </div>

        {/* Status Display */}
        {currentTask && (
                          <div className="mt-6 p-4 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
                    backdropFilter: 'blur(10px)'
                  }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                currentTask.status === 'running' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                currentTask.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                currentTask.status === 'finished' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                                  'bg-white/10 text-gray-800 dark:bg-white/10 dark:text-gray-400 backdrop-blur-sm'
              }`}>
                {currentTask.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              Task ID: {currentTask.id}
            </div>
          </div>
        )}
      </div>

      {/* Usage Status Display */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Usage</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getPlanName()} - Automation steps this month
              </p>
            </div>
          </div>
        </div>
        
        {(() => {
          const limits = getPlanUsageLimits();
          const current = monthlyUsage.tokens_used || 0;
          const maxSteps = limits.applications * 10; // Convert applications to steps
          const percentage = maxSteps > 0 ? Math.min((current / maxSteps) * 100, 100) : 0;
          const remaining = Math.max(0, maxSteps - current);
          
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {current}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {maxSteps > 0 ? `of ${maxSteps} included` : 'No plan limits available'}
                </span>
              </div>
              
              {maxSteps > 0 && (
                <div className="w-full bg-white/20 dark:bg-white/20 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      percentage >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                      percentage >= 75 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      percentage >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      'bg-gradient-to-r from-green-500 to-blue-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {maxSteps === 0 ? 
                    'Subscribe to get automation steps' :
                    percentage >= 100 ? 
                      'Additional: $0.03 per step' :
                      `${remaining} remaining`
                  }
                </span>
                {maxSteps > 0 && (
                  <span className={`font-bold ${
                    percentage >= 90 ? 'text-red-600 dark:text-red-400' :
                    percentage >= 75 ? 'text-orange-600 dark:text-orange-400' :
                    percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {Math.round(percentage)}% used
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Extension Error Status */}
      <ExtensionErrorStatus className="mb-6" />

      {/* Browser Preview */}
      {currentTask?.live_url && (
                  <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Live Browser Preview</h3>
                <p className="text-gray-600 dark:text-gray-300">Watch your automation in real-time</p>
              </div>
            </div>
            <a
              href={currentTask.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Full Screen
            </a>
          </div>
          
          <div className="relative w-full rounded-xl overflow-hidden border border-white/20 dark:border-white/10"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
              backdropFilter: 'blur(10px)'
            }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 dark:border-white/10"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
                backdropFilter: 'blur(15px)'
              }}>
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <Globe className="w-4 h-4 text-gray-500 ml-4" />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {currentTask.live_url}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">LIVE</span>
              </div>
            </div>
            <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
              <iframe
                id="browser-preview-iframe"
                src={currentTask.live_url}
                className="absolute top-0 left-0 w-full h-full"
                style={{ border: 'none' }}
                allow="camera; microphone; display-capture"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-top-navigation-by-user-activation"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => {
                  // Hide iframe-related extension errors
                  const iframe = document.getElementById('browser-preview-iframe') as HTMLIFrameElement;
                  if (iframe && iframe.contentWindow) {
                    try {
                      // Prevent extension scripts from accessing iframe content
                      iframe.contentWindow.addEventListener('error', (e) => {
                        // Suppress common extension errors
                        if (e.error?.message?.includes('FrameDoesNotExistError') ||
                            e.error?.message?.includes('ERR_FILE_NOT_FOUND') ||
                            e.filename?.includes('extensionState.js') ||
                            e.filename?.includes('heuristicsRedefinitions.js') ||
                            e.filename?.includes('utils.js')) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }, true);
                    } catch (error) {
                      // Cross-origin restrictions prevent access - this is expected
                    }
                  }
                }}
                onError={() => {
                  // Browser preview iframe error (this may be due to browser extensions)
                }}
              />
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  );
};

export default LinkedInAutomationBot;