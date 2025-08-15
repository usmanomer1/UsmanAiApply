import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
// Explicitly import AnimatePresence
import { AnimatePresence } from 'framer-motion';
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
  ChevronDown
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
// Session management removed
import { getPlanLimits, getProductByPriceId } from '../stripe-config';
import { BrowserUseClientProxy } from '../lib/browserUseClientProxy';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  getUserUsage, 
  canPerformAction, 
  createAutomationSession, 
  updateAutomationSession,
  getUsageHistory 
} from '../lib/usageTracking';

// Feature flags
const FEATURE_FLAGS = {
  // External job applications are currently disabled due to tab switching issues
  // The browser automation agent consistently fails to switch to new tabs after clicking external apply buttons
  // All external job application code is preserved for future re-enabling once the tab switching issue is resolved
  // Can be overridden with VITE_ENABLE_EXTERNAL_APPLICATIONS=true environment variable
  ENABLE_EXTERNAL_APPLICATIONS: import.meta.env.VITE_ENABLE_EXTERNAL_APPLICATIONS === 'true' || false,
};

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
  // External job application settings
  applyToExternalJobs?: boolean;
  externalJobEmail?: string;
  externalJobPassword?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  linkedInProfileUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
}

// LinkedIn location ID mapping - expanded with more locations
const LINKEDIN_LOCATIONS = {
  'San Francisco Bay Area': '90000084',
  'New York City': '90000070', 
  'Los Angeles': '90000049',
  'Chicago': '90000045',
  'Boston': '90000024',
  'Washington DC': '90000096',
  'Seattle': '90000102',
  'Austin': '90000023',
  'Denver': '90000052',
  'Atlanta': '90000001',
  'Dallas': '90000051',
  'Houston': '90000055',
  'Philadelphia': '90000080',
  'Phoenix': '90000081',
  'San Diego': '90000086',
  'Portland': '90000083',
  'Miami': '90000068',
  'Detroit': '90000053',
  'Minneapolis': '90000069',
  'Toronto': '100025096',
  'Vancouver': '100083280',
  'Montreal': '100073278',
  'London': '100853491',
  'Berlin': '102975707',
  'Amsterdam': '102011674',
  'Paris': '100985050',
  'Munich': '100968856',
  'Zurich': '100036621',
  'Dublin': '100842717',
  'Stockholm': '100086362',
  'Singapore': '102454443',
  'Hong Kong': '102817007',
  'Tokyo': '101355337',
  'Sydney': '105490917',
  'Melbourne': '101452733',
  'Dubai': '103588996',
  'Tel Aviv': '101620260',
  'Mumbai': '105214831',
  'Bangalore': '109524677',
  'Delhi': '102713980',
  'Hyderabad': '104869687',
  'Remote': '0'
};

// Country codes with flags - sorted by country name
const COUNTRY_CODES = [
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+1-CA', country: 'Canada', flag: '🇨🇦' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
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
  // When using Netlify Functions, we don't need the API key on client side
  const apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || import.meta.env.VITE_BROWSERUSE_API_KEY || 'proxy';
  
  const [config, setConfig] = useState<BrowserUseConfig>({
    apiKey: apiKey,
    linkedinEmail: '',
    contactNumber: '',
    countryCode: '+1',
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
    targetCount: '10',
    applyToExternalJobs: FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS,
    externalJobEmail: '',
    externalJobPassword: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    linkedInProfileUrl: '',
    portfolioUrl: '',
    githubUrl: ''
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
  const [logs, setLogs] = useState<{ message: string; type: string; timestamp: string }[]>([]);
  const [loginDetection, setLoginDetection] = useState<any | null>(null);
  const [showResumeButton, setShowResumeButton] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  const [userStoppedTask, setUserStoppedTask] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [userUsage, setUserUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  
  // Browser client state (no session management)
  const [browserClient, setBrowserClient] = useState<BrowserUseClientProxy | null>(null);

  // Add state for dropdown
  const [showImportantInstructions, setShowImportantInstructions] = useState(false);

  // Time elapsed state
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Stats for display
  const [stats, setStats] = useState({
    successRate: 0,
    avgTimePerApp: 0,
    totalTime: 0
  });

  // Monthly usage chart data
  const [chartData, setChartData] = useState<any[]>([]);

  // Session ID for heartbeat tracking
  const sessionId = useRef<string>(crypto.randomUUID());
  const heartbeatInterval = useRef<number | null>(null);

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
      const client = new BrowserUseClientProxy(apiKey);
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

  // Handle page close/refresh to warn user and stop tasks
  useEffect(() => {
    // Only show warning when actually closing/refreshing the page
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRunning && currentTask) {
        // Show warning to user
        const message = 'Your LinkedIn automation is still running. Leaving this page will stop the automation to prevent charges.';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };

    // Handle visibility change (tab switching, minimizing)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isRunning && currentTask) {
        // Just save state when tab becomes hidden, don't stop the task
        saveAutomationState(currentTask);
        console.log('Tab hidden - automation continues running in background');
      }
    };

    // Handle actual page unload (after warning is dismissed)
    const handleUnload = () => {
      if (isRunning && currentTask) {
        // Stop heartbeat locally - the edge function will detect stale heartbeat and stop the task
        stopHeartbeat();
        
        // Clear local state
        clearAutomationState();
        
        console.log('Page unloading - task will be stopped by edge function after heartbeat timeout');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, currentTask, browserClient, apiKey]);

  // Handle navigation within the app
  useEffect(() => {
    if (!isRunning || !currentTask) return;

    // Block navigation when task is running
    const handleNavigation = (e: PopStateEvent) => {
      e.preventDefault();
      
      if (window.confirm('Your LinkedIn automation is still running. Leaving this page will stop the automation. Continue?')) {
        // User confirmed, stop the task
        handleStopTask();
      } else {
        // User cancelled, stay on page
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    // Push current state to enable back button blocking
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [isRunning, currentTask]);

  // Component unmount handler for in-app navigation
  useEffect(() => {
    return () => {
      // Stop heartbeat on component unmount (navigation within app)
      if (isRunning && currentTask) {
        // Check if this is an actual navigation vs page refresh
        // Page refresh will be handled by state restoration
        const isPageRefresh = window.performance.navigation.type === 1;
        
        if (!isPageRefresh) {
          // Stop heartbeat - edge function will detect and stop the task
          stopHeartbeat();
          clearAutomationState();
          console.log('Component unmounting - task will be stopped by edge function');
        }
      }
    };
  }, [isRunning, currentTask]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, startTime]);

  // Update stats effect
  useEffect(() => {
    if (appliedCount > 0) {
      const successRate = Math.round((appliedCount / (appliedCount + errorCount)) * 100);
      const avgTime = elapsedTime > 0 ? Math.floor(elapsedTime / appliedCount) : 0;
      setStats({
        successRate,
        avgTimePerApp: avgTime,
        totalTime: elapsedTime
      });
    }
  }, [appliedCount, errorCount, elapsedTime]);


  // Chart data is now loaded from real usage history in fetchUserSubscription

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const checkAccess = async () => {
    if (!isSupabaseConfigured()) {
      // Development mode or no auth configured
      setAccessCheckComplete(true);
      return;
    }

    try {
      const hasAccess = await checkFeatureAccess('auto_apply');
      setAccessCheckComplete(true);
      
      // If they don't have access and are authenticated, show paywall
      if (!hasAccess && isAuthenticated) {
        setShowPaywall(true);
      }
    } catch (error) {
      console.error('Error checking feature access:', error);
      setAccessCheckComplete(true);
    }
  };

  const fetchUserSubscription = async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription details from stripe_user_subscriptions table (flat structure)
      const { data: subscription, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('subscription_status', 'active')
        .maybeSingle();

      if (!subError && subscription) {
        setUserSubscription(subscription);
      } else if (subError) {
        console.warn('Error fetching subscription:', subError);
      }

      // Get usage from new tracking system
      const usage = await getUserUsage(user.id);
      setUserUsage(usage);
      
      // Get usage history for chart
      const history = await getUsageHistory(user.id, 30);
      if (history.length > 0) {
        setChartData(history.map(day => ({
          date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          applications: day.applications,
          steps: day.steps
        })));
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanName = () => {
    // Legacy support: read product_name directly from the flat subscription object
    const productName = userSubscription?.product_name;
    if (!productName) {
      return isSupabaseConfigured() ? 'Free' : 'Development';
    }
    return productName;
  };

  const getTokenLimit = () => {
    if (!isSupabaseConfigured()) {
      return 10000; // High limit for development
    }

    // Legacy support: read price_id directly from the flat subscription object
    const priceId = userSubscription?.price_id;
    if (!priceId) {
      return 0; // Free tier has no access
    }

    const limits = getPlanLimits(priceId);
    if (!limits) {
      console.error(`No plan limits found for price ID: "${priceId}"`);
      return 0;
    }

    // Return the step limit directly (applications * 10)
    return limits.applications ? limits.applications * 10 : 0;
  };

  const canStartAutomation = () => {
    if (!userUsage) {
      return false;
    }
    
    // Check if user has any limit (not just remaining)
    const hasLimit = userUsage.automation_steps.limit > 0;
    const underLimit = userUsage.automation_steps.used < userUsage.automation_steps.limit;
    
    // For paid users, check limit exists; for usage tracking, check remaining
    return hasLimit && underLimit;
  };

  const getRemainingApplications = () => {
    const stepLimit = getTokenLimit();
    if (stepLimit === -1) return 'Unlimited';
    if (stepLimit === 0) return 0;
    
    const usedSteps = userUsage?.automation_steps.used || 0;
    const remainingSteps = Math.max(0, stepLimit - usedSteps);
    // Convert steps back to applications (10 steps per application)
    return Math.floor(remainingSteps / 10);
  };

  const fetchUserResumeContent = async (): Promise<string | null> => {
    try {
      if (!user || !user.id) {
        console.warn('No authenticated user for profile fetch');
        return null;
      }

      // Ensure we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No active session for profile fetch');
        return null;
      }

      // Get user profile with resume URL
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('resume_url, full_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile for resume:', error);
        // Try a simpler query if the first one fails
        const { data: simpleProfile, error: simpleError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (simpleError) {
          console.error('Failed to fetch profile:', simpleError);
          return null;
        }
        
        if (!simpleProfile?.resume_url) {
          return null;
        }
        
        return simpleProfile;
      }
      
      if (!profile?.resume_url) {
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
    if (!user || !isSupabaseConfigured()) return;

    try {
      const { data } = await supabase
        .from('automation_configs')
        .select('config')
        .eq('user_id', user.id)
        .single();

      if (data?.config) {
        setConfig(prev => ({
          ...prev,
          ...data.config,
          apiKey: apiKey // Always use the environment variable API key
        }));
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const saveConfiguration = async () => {
    if (!user || !isSupabaseConfigured()) return;

    // Don't save API key to database
    const { apiKey: _, ...configToSave } = config;

    try {
      const { error } = await supabase
        .from('automation_configs')
        .upsert({
          user_id: user.id,
          config: configToSave,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      toast.success('Configuration saved');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
    
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    }
    
    // Extension suppressor will automatically handle extension-related errors
  };

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
      errorCount,
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
      
      addLog('🔍 Checking for previous automation session...');
      
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
            setErrorCount(state.errorCount || 0);
            
            // Restore logs if available
            if (state.logs && Array.isArray(state.logs)) {
              setLogs(state.logs);
            }
            
            addLog(`🔄 Restored automation session - Task ${state.taskId} is ${currentTaskStatus.status}`);
            addLog(`📊 Restored state: ${state.stepCount || 0} steps, ${state.appliedCount || 0} applications`);
            
            // Always show browser preview after restoration
            if (currentTaskStatus.live_url) {
              addLog(`🌐 Live preview restored: ${currentTaskStatus.live_url}`);
            } else {
              // If live_url is not immediately available, it will be updated during polling
              addLog(`🌐 Browser preview will be available shortly...`);
            }
            
            // Resume polling if task is running
            if (currentTaskStatus.status === 'running') {
              startPolling(state.taskId);
              startHeartbeat(state.taskId);
              addLog(`▶️ Resumed monitoring task progress`);
              
              // Force an immediate status update to ensure we have the latest live_url
              setTimeout(async () => {
                try {
                  const refreshedTask = await getTaskStatus(state.taskId);
                  setCurrentTask(refreshedTask);
                  if (refreshedTask.live_url && !currentTaskStatus.live_url) {
                    addLog(`🌐 Live preview now available: ${refreshedTask.live_url}`);
                  }
                } catch (error) {
                  console.warn('Failed to refresh task status after restoration:', error);
                }
              }, 1000);
              
            } else if (currentTaskStatus.status === 'paused') {
              addLog(`⏸️ Task is paused - you can resume it anytime`);
              
              // For paused tasks, also force an immediate status update to ensure we have the live_url
              setTimeout(async () => {
                try {
                  const refreshedTask = await getTaskStatus(state.taskId);
                  setCurrentTask(refreshedTask);
                  if (refreshedTask.live_url && !currentTaskStatus.live_url) {
                    addLog(`🌐 Live preview now available: ${refreshedTask.live_url}`);
                  }
                } catch (error) {
                  console.warn('Failed to refresh paused task status after restoration:', error);
                }
              }, 1000);
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


  const markTaskCompleted = async (taskId: string, finalSteps: number, status: 'finished' | 'failed' | 'stopped', error?: string) => {
    try {
      // Stop heartbeat monitoring
      stopHeartbeat();
      
      // Clean up heartbeat record
      await cleanupHeartbeat(taskId);
      
      // Update automation session in new tracking system
      await updateAutomationSession(taskId, {
        step_count: finalSteps,
        status: status,
        error_message: error
      });
      
      addLog(`✅ Task ${taskId} marked as ${status}`);
      
      // Create notification for task completion
      if (isSupabaseConfigured() && user) {
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
              status: status,
              error: error || null
            }
          });
      }
    } catch (error) {
      console.error('Error marking task completed:', error);
    }
  };

  // Send heartbeat to indicate the task is still active
  const sendHeartbeat = async (taskId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('task_heartbeats')
        .upsert({
          task_id: taskId,
          session_id: sessionId.current,
          last_heartbeat: new Date().toISOString()
        }, {
          onConflict: 'task_id'
        });
      
      if (error) {
        console.error('Error sending heartbeat:', error);
      }
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  };

  // Start heartbeat interval
  const startHeartbeat = (taskId: string) => {
    // Clear any existing interval
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }

    // Send initial heartbeat
    sendHeartbeat(taskId);

    // Send heartbeat every 10 seconds
    heartbeatInterval.current = window.setInterval(() => {
      sendHeartbeat(taskId);
    }, 10000);
  };

  // Stop heartbeat interval
  const stopHeartbeat = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  };

  // Clean up heartbeat record when task completes
  const cleanupHeartbeat = async (taskId: string) => {
    try {
      await supabase
        .from('task_heartbeats')
        .delete()
        .eq('task_id', taskId);
    } catch (error) {
      console.error('Error cleaning up heartbeat:', error);
    }
  };

  // Clean up all heartbeats for the current user
  const cleanupUserHeartbeats = async () => {
    if (!user) return;
    
    try {
      // First get all tasks for this user
      const { data: userTasks } = await supabase
        .from('automation_tasks')
        .select('task_id')
        .eq('user_id', user.id);
      
      if (userTasks && userTasks.length > 0) {
        const taskIds = userTasks.map(t => t.task_id);
        
        // Delete all heartbeats for this user's tasks
        await supabase
          .from('task_heartbeats')
          .delete()
          .in('task_id', taskIds);
        
        console.log(`Cleaned up ${taskIds.length} heartbeats for user`);
      }
    } catch (error) {
      console.error('Error cleaning up user heartbeats:', error);
    }
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
          step.next_goal?.includes('SUBMITTING EXTERNAL APPLICATION') ||
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
      
      // Stop heartbeat monitoring
      stopHeartbeat();
      
      // Clean up heartbeat record
      await cleanupHeartbeat(taskId);
      
      addLog(`✅ Task stopped successfully: ${taskId}`, 'success');
    } catch (error) {
      addLog(`❌ Error stopping task: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error;
    }
  };

  const buildLinkedInJobsURL = () => {
    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams();
    
    // Essential LinkedIn parameters
    if (!FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS || !config.applyToExternalJobs) {
      params.append('f_AL', 'true'); // Easy Apply filter only when not applying to external jobs
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
        if (locationId === 'remote' || locationId === '0') {
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
    } else if (config.remotePreference && config.remotePreference !== 'All' && !params.has('f_WT')) {
      const workType = WORK_TYPE_MAP[config.remotePreference as keyof typeof WORK_TYPE_MAP];
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
    } else if (config.experience && config.experience !== 'All') {
      const experienceLevel = EXPERIENCE_LEVEL_MAP[config.experience as keyof typeof EXPERIENCE_LEVEL_MAP];
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
      if (config.datePosted.startsWith('r')) {
        params.append('f_TPR', config.datePosted);
      } else {
        const dateMap: { [key: string]: string } = {
          'Past 24 hours': 'r86400',
          'Past week': 'r604800',
          'Past month': 'r2592000'
        };
        if (dateMap[config.datePosted]) {
          params.append('f_TPR', dateMap[config.datePosted]);
        }
      }
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

  const createComprehensivePrompt = (linkedinUrl: string, resumeContent: string | null = null, uploadedFileNames: string[] = []) => {
    const applyToExternalJobs = FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS && config.applyToExternalJobs;
    
    return `You are an AI assistant helping with LinkedIn job applications. Your goal is to apply to ${config.targetCount} jobs ${applyToExternalJobs ? '(including both Easy Apply and external job postings)' : 'using LinkedIn\'s "Easy Apply" feature'}.

CRITICAL - MANUAL LOGIN HANDLING:
When you see a login page, login modal, or "Sign in" overlay on LinkedIn:
1. Take a screenshot of the page
2. In your next action description or evaluation, include the exact text: "INTERVENTION:LOGIN_REQUIRED - Manual login needed"
3. Then simply wait (use wait action for 30 seconds)
4. DO NOT search for this text on Google
5. DO NOT use done() - this would end the entire automation
6. The system will detect the intervention text in your output and pause
7. After manual login, the automation will resume automatically

STEP-BY-STEP PROCESS:
1. Navigate directly to the job search URL: ${linkedinUrl}
2. Wait 3-5 seconds for the page to fully load before proceeding
3. Check if login is required - if you see any login modal or sign-in overlay, output "INTERVENTION:LOGIN_REQUIRED - Manual login needed"
4. After login is complete and you're on the jobs page, look for the left sidebar with job listings - if it's collapsed or missing, try clicking any "expand" or "menu" buttons
4. Look for jobs with ${applyToExternalJobs ? '"Easy Apply" buttons OR external application links' : '"Easy Apply" buttons'} in the job listings
5. For each job (continue until you reach ${config.targetCount} applications):
   a. BEFORE clicking any apply button, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"
   b. Extract the actual company name from the job posting (not generic terms)
   c. Extract the exact job title from the posting
   ${applyToExternalJobs ? `
   d. Check if it's an Easy Apply job or external application:
      - If Easy Apply: Click the "Easy Apply" button and follow steps e-l below
      - If External: 
        🚨 **CRITICAL TAB SWITCHING INSTRUCTIONS** 🚨
        1. Click the external apply button/link
        2. **WAIT 2-3 SECONDS** for new tab to open
        3. Look at the browser tab bar at the top - you should see TWO tabs now
        4. **CLICK ON THE NEW TAB** (it will have the company name, not LinkedIn)
        5. Verify URL changed - you should NOT be on linkedin.com anymore
        6. If still on LinkedIn:
           - Look for tabs at the very top of the browser window
           - The new tab might be to the right of the LinkedIn tab
           - Click directly on that new tab
           - Or try keyboard shortcut: Ctrl+Tab (Windows) or Cmd+Tab (Mac)
        7. ONLY after switching tabs, follow the EXTERNAL JOB APPLICATION INSTRUCTIONS
        8. **STAY ON EXTERNAL SITE** until application is fully submitted - DO NOT return to LinkedIn prematurely
   ` : 'd. Click the "Easy Apply" button'}
   e. Fill out the application form (ALWAYS scroll down to see all fields - some are hidden below)
   f. Answer any questions that appear (scroll down after each answer to see more questions)
   g. For multi-step forms: Complete current step, then scroll down to find "Next" or "Continue" button
   h. Upload resume if prompted - use the specified LinkedIn resume: "${config.linkedinResume || 'Use the most recent resume available'}"
   i. CRITICAL: ALWAYS SCROLL DOWN to find the "Submit" or "Submit application" button
      - The submit button is ALWAYS at the bottom of the form
      - Keep scrolling down until you see the submit button - it's never visible without scrolling
      - Look for buttons like "Submit", "Submit application", "Apply", or "Send application"
      - If you don't see a submit button, scroll down more - it's there
   j. Before clicking submit, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   k. Click the submit button to complete the application
   l. Close the modal and move to the next job
   
   📍 **IMPORTANT**: Steps e-l above are ONLY for Easy Apply jobs on LinkedIn. If you clicked an external apply button, you should NOT be following these steps - you should be on an external company website following the EXTERNAL JOB APPLICATION INSTRUCTIONS.
6. Continue applying to jobs until you've completed ${config.targetCount} applications
7. If you run out of ${applyToExternalJobs ? 'applicable jobs (Easy Apply or external)' : 'Easy Apply jobs'} on the current page:
   - Scroll down to load more jobs or click "See more jobs" if available
   ${applyToExternalJobs ? '- Look for jobs with external application links if Easy Apply jobs are exhausted' : ''}
   - Try adjusting filters or broadening search criteria
   - Only stop when you've reached the target or no more suitable jobs are available

🚨 CRITICAL SCROLLING INSTRUCTIONS - MUST FOLLOW:

- **MANDATORY**: ALWAYS scroll down when you can't find buttons like "Submit", "Next", "Continue", or "Apply"
- **SUBMIT BUTTON RULE**: The submit button is NEVER visible without scrolling down - this is LinkedIn's design
- **KEEP SCROLLING**: If you don't see a submit button, keep scrolling down until you find it
- **LinkedIn FORM BEHAVIOR**: LinkedIn forms often have content below the fold - scroll to reveal hidden elements
- **FORM COMPLETION**: If you encounter form questions but can't see all of them, scroll down to see more questions
- **TROUBLESHOOTING**: When stuck on any form, try scrolling both up and down to find missing elements
- **FINAL REVIEW PAGE**: On the final review page, the submit button is always at the bottom - scroll to find it
- **NEVER SKIP**: Never assume there's no submit button - always scroll down to look for it

📝 SUBMISSION PROCESS - CRITICAL:
1. **FIND THE SUBMIT BUTTON**: After filling all fields, scroll to the very bottom of the form
2. **BUTTON VARIATIONS**: Look for "Submit", "Submit application", "Apply", "Send application", or "Review and submit"
3. **SCROLL PERSISTENCE**: If you don't see any submit button, keep scrolling down - it exists
4. **PAGE COMPLETION**: Make sure all required fields are filled before the submit button becomes active
5. **FINAL ACTION**: Click the submit button only after scrolling down and finding it
6. **CONFIRMATION**: Wait for LinkedIn to show a success message or redirect before moving to next job

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

🔧 FORM HANDLING GUIDELINES - LINKEDIN EASY APPLY:
- **ESSENTIAL**: Always scroll down in Easy Apply forms to ensure you see all content
- **SUBMIT BUTTON LOCATION**: Submit buttons are ALWAYS at the bottom - never visible without scrolling
- **MULTI-STEP PROCESS**: LinkedIn Easy Apply often has 2-4 steps with Next/Continue buttons between them
- **STEP NAVIGATION**: For multi-step forms, look for "Next" or "Continue" buttons (ALWAYS scroll down to find them)
- **COMPLETE ALL FIELDS**: If forms have multiple questions, scroll to see all questions before proceeding
- **FORM VALIDATION**: LinkedIn will not show the submit button until all required fields are filled
- **FINAL REVIEW**: The last step is usually a review page - scroll down to find the final submit button
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
- When you encounter a login page or modal, output "INTERVENTION:LOGIN_REQUIRED"
- The automation will pause for manual login
- After login, wait for the resume signal before continuing
- If already logged in, proceed directly to job applications

CONTACT INFORMATION FOR APPLICATIONS:
- Email: ${config.linkedinEmail}
- Country Code: ${config.countryCode.split('-')[0]}
- Phone Number (without country code): ${config.contactNumber}
- Resume to Use: ${config.linkedinResume || 'Most recent available'}

${applyToExternalJobs ? `
🌐 EXTERNAL JOB APPLICATION INSTRUCTIONS:

🔥🔥🔥 **EMERGENCY ALERT - TAB SWITCHING ISSUE** 🔥🔥🔥
⚠️  **YOU HAVE BEEN FAILING TO SWITCH TABS PROPERLY**
⚠️  **THIS IS THE #1 ISSUE THAT MUST BE FIXED IMMEDIATELY**

**THE PROBLEM**: You click external apply buttons but stay on LinkedIn instead of switching to the new tab
**THE SOLUTION**: Follow the mandatory tab switching steps below EXACTLY
**THE RESULT**: You will successfully apply to external jobs instead of failing

When you encounter job postings that don't have "Easy Apply" but have external application links:

🔄 **TAB MANAGEMENT RULES** (ABSOLUTELY CRITICAL - MANDATORY BEHAVIOR):
⚠️  **THIS IS THE MOST IMPORTANT INSTRUCTION - FOLLOW EXACTLY:**

1. **IMMEDIATE TAB SWITCH REQUIREMENT**: The MOMENT you click any external apply button on LinkedIn:
   - LinkedIn will open the external site in a NEW TAB
   - You ABSOLUTELY MUST immediately switch to that new tab
   - DO NOT perform any other actions on LinkedIn before switching tabs
   - DO NOT look for more jobs on LinkedIn before switching tabs
   - DO NOT continue browsing LinkedIn before switching tabs

2. **HOW TO SWITCH TABS** (Follow these exact steps):
   - Step 1: Click the external apply button (new tab opens)
   - Step 2: Look at the browser tab bar at the top of your screen
   - Step 3: You will see multiple tabs - one will be LinkedIn, one will be the new external site
   - Step 4: Click on the NEW tab (not the LinkedIn tab)
   - Step 5: Verify the URL has changed and you're no longer on linkedin.com

3. **VERIFICATION STEPS** (MANDATORY after each external apply click):
   - Check the URL bar - it should NOT contain "linkedin.com"
   - Check the page content - it should be a company career page, not LinkedIn
   - If you see LinkedIn content after clicking external apply, YOU DID NOT SWITCH TABS
   - If still on LinkedIn, try again: look for tabs at top and click the non-LinkedIn tab

4. **FORBIDDEN BEHAVIORS** (NEVER DO THESE):
   ❌ NEVER continue looking at LinkedIn jobs after clicking external apply
   ❌ NEVER scroll LinkedIn job listings after clicking external apply
   ❌ NEVER click other LinkedIn buttons after clicking external apply
   ❌ NEVER assume the external site opened in the same tab

🚨 **TAB SWITCHING TROUBLESHOOTING** (Try these if switching fails):
- Problem: External link doesn't open new tab
  Solution: Right-click the apply button → select "Open in new tab"
- Problem: Can't find tab controls
  Solution: Look at the very top of browser window for tab bar
- Problem: Multiple tabs are confusing
  Solution: Click each tab until you find one that's NOT LinkedIn
- Problem: Tab switching completely fails
  Solution: Close all tabs except LinkedIn, try the external apply again
- Problem: Still seeing LinkedIn after clicking external button
  Solution: You haven't switched tabs - look for tab controls and click the NEW tab

1. IDENTIFY EXTERNAL JOBS:
   - Look for jobs with "Apply on company website" or similar buttons
   - These typically open new tabs/windows to external career sites
   
2. CLICK THE EXTERNAL LINK AND IMMEDIATELY SWITCH TABS:
   🚨 **CRITICAL SEQUENCE - FOLLOW EXACTLY IN THIS ORDER:**
   
   A. Click the external application button/link (this opens a new tab)
   B. **IMMEDIATELY** - within 1 second - switch to the new tab:
      - Look for browser tabs at the top of the screen
      - Identify the NEW tab (will have a different title, not LinkedIn)
      - Click on that NEW tab to switch to it
   C. Wait for the new tab to fully load (2-3 seconds)
   D. **MANDATORY VERIFICATION** before proceeding:
      - Check browser address bar - URL must NOT contain "linkedin.com"
      - Check page title - should be company name or job site, not LinkedIn
      - Check page content - should show company career page, not LinkedIn jobs
   E. If verification fails (still on LinkedIn):
      - You failed to switch tabs
      - Look for tabs again and click the correct one
      - Do NOT continue until you're on the external site
   
   **THIS STEP IS CRITICAL**: You must be on the external company website before proceeding to step 3
   
3. ACCOUNT CREATION (if needed):
   - Look for "Sign up", "Create account", "Register" options
   - Use these credentials for new accounts:
     * Email: ${config.externalJobEmail || config.linkedinEmail}
     * Password: ${config.externalJobPassword || '(use the value from the secret variable ext_password)'}
     * First Name: ${config.firstName}
     * Last Name: ${config.lastName}
     * Phone: ${config.countryCode} ${config.contactNumber}
     * Address: ${config.address}
     * City: ${config.city}
     * State: ${config.state}
     * Zip: ${config.zipCode}
   - If the site requires email verification, skip and move to next job
   
4. LOGIN (if account exists):
   - Try logging in with the external job email/password first
   - If that fails, create a new account as described above
   
5. FILL APPLICATION FORM:
   - Use the provided personal information above
   - For LinkedIn profile: ${config.linkedInProfileUrl || 'Use your LinkedIn URL'}
   - For portfolio: ${config.portfolioUrl || 'Skip if optional'}
   - For GitHub: ${config.githubUrl || 'Skip if optional'}
   
6. RESUME UPLOAD:
   ${uploadedFileNames.length > 0 ? `
   - When asked to upload a resume, you have access to the following file(s): ${uploadedFileNames.join(', ')}
   - These files are already available to you - just select them when prompted
   - When you see a file upload field, look for and select: "${uploadedFileNames[0]}"
   - The file is already uploaded and ready to use - you don't need to upload it again
   - If the site has a "Choose File" or "Upload Resume" button, click it and select the available file
   ${resumeContent ? `
   - Additionally, here's the resume content for reference when filling forms:
     [Resume content provided below in context]
   ` : ''}
   ` : `
   - If resume upload is required but you can't proceed, skip this job
   - Note: User hasn't uploaded a resume to their profile
   `}
   
7. ANSWER QUESTIONS:
   - Use the resume content and job context to answer questions
   - For salary expectations, research typical ranges for the role/location
   - For availability, default to "2 weeks notice" or "Immediately"
   - Make educated guesses based on the job requirements
   
8. SUBMIT & TRACK:
   - Before submitting: "SUBMITTING EXTERNAL APPLICATION TO: [COMPANY] - [JOB TITLE]"
   - Click the submit button to complete the external application
   - **WAIT FOR CONFIRMATION** - Do not leave the page until you see:
     * Success message
     * Confirmation page
     * "Application submitted" notification
     * Thank you page
   - Only AFTER seeing confirmation, proceed to return to LinkedIn
   
9. **RETURN TO LINKEDIN** (ONLY after application is confirmed submitted):
     
     🚨 **DO NOT SKIP THESE STEPS - REQUIRED TO CONTINUE JOB SEARCH:**
     
     1. **CLOSE EXTERNAL TAB**: 
        - Right-click on the current external job site tab
        - Select "Close tab" or use Ctrl+W (Cmd+W on Mac)
        - The external company website should now be closed
        
     2. **SWITCH TO LINKEDIN TAB**:
        - Look at remaining browser tabs
        - Click on the tab that shows "LinkedIn" in the title
        - This should be the original tab you started from
        
     3. **MANDATORY VERIFICATION** (before continuing):
        - Check URL bar contains "linkedin.com"
        - Check page shows LinkedIn job listings (not external company site)
        - Check you can see the job search results you were working on
        
     4. **RESUME JOB HUNTING**:
        - Look for the next job posting in the LinkedIn results
        - Continue applying to reach your target count
        - DO NOT get stuck on external sites - always return here
     
     ⚠️ **IF YOU CANNOT RETURN TO LINKEDIN**: Navigate directly to the original LinkedIn search URL: ${linkedinUrl}

9. HANDLING FAILURES:
   - If email verification is required: Close tab, return to LinkedIn, skip and move to next job
   - If technical errors occur: Try once more, then close tab, return to LinkedIn, skip if it fails
   - If the form is too complex or requires documents you don't have: Close tab, return to LinkedIn, skip
   - **ALWAYS**: Return to LinkedIn tab to continue searching - never get stuck on external sites

IMPORTANT EXTERNAL JOB NOTES:
- You can navigate to any domain when applying to external jobs (not just linkedin.com)
- Prioritize Easy Apply jobs first, then move to external applications
- Keep track of successful applications regardless of type
- If you run out of Easy Apply jobs, actively look for external application opportunities

FILE UPLOAD INSTRUCTIONS:
${uploadedFileNames.length > 0 ? `
- You have access to these pre-uploaded files: ${uploadedFileNames.join(', ')}
- When you encounter a file upload field:
  1. Click the "Choose File" or "Upload" button
  2. The file "${uploadedFileNames[0]}" should be available for selection
  3. Select it from the file picker dialog
  4. The file will be automatically uploaded
- These files are already prepared and ready - you don't need to upload anything new
- If a site shows a file input, the files are accessible through the browser's file system
` : `
- No resume file is available for upload
- If file upload is mandatory, you may need to skip this application
`}
` : ''}

${config.customInstructions ? `
CUSTOM INSTRUCTIONS:
${config.customInstructions}
` : ''}

${resumeContent && applyToExternalJobs ? `
USER'S RESUME CONTENT FOR REFERENCE:
${resumeContent}

Use this resume information to:
- Answer questions about experience, skills, and qualifications
- Fill in work history and education sections
- Provide accurate information about the candidate's background
- Make informed decisions when answering screening questions
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

This tracking is essential for saving your applications correctly.

🚨🚨🚨 **FINAL CRITICAL REMINDER - TAB SWITCHING** 🚨🚨🚨

**IF YOU ARE APPLYING TO EXTERNAL JOBS:**
✅ **CORRECT BEHAVIOR**: Click external apply → Switch to new tab → Fill external form → Return to LinkedIn
❌ **WRONG BEHAVIOR**: Click external apply → Stay on LinkedIn → Continue to next job (THIS IS FAILING)

**THE KEY BEHAVIOR CHANGE NEEDED:**
- When you click "Apply on company website" or similar external links
- LinkedIn opens the company website in a NEW BROWSER TAB
- You MUST click on that new tab to switch to it
- You MUST complete the application on that external site
- ONLY THEN return to LinkedIn for the next job

**IF YOU DON'T SWITCH TABS, THE EXTERNAL APPLICATION FAILS**
**ALWAYS VERIFY**: After clicking external apply, check the URL - it should NOT be linkedin.com

This is the #1 issue that needs to be fixed immediately.`;
  };

  const createLinkedInTask = async (): Promise<TaskStatus> => {
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

    // Clear browser profile to prevent session sharing between users
    // This is critical for security - without this, User B could access User A's LinkedIn session
    try {
      addLog('🧹 Clearing browser profile for security...', 'info');
      await browserClient.clearBrowserProfile();
      addLog('🔒 Successfully cleared browser profile', 'success');
    } catch (error) {
      // Log detailed error for debugging
      console.error('Failed to clear browser profile:', error);
      if (error instanceof Error) {
        addLog(`⚠️ Could not clear browser profile: ${error.message}`, 'warning');
      } else {
        addLog('⚠️ Could not clear browser profile, proceeding with caution', 'warning');
      }
      // Don't fail - the automation can still proceed
    }

    const linkedinUrl = buildLinkedInJobsURL();
    
    // Override external job applications if feature is disabled
    const effectiveConfig = {
      ...config,
      applyToExternalJobs: config.applyToExternalJobs && FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS
    };
    
    // Handle resume for external job applications
    let resumeContent: string | null = null;
    let uploadedFileNames: string[] = [];
    
    if (effectiveConfig.applyToExternalJobs) {
      addLog('📄 Preparing your resume for external job applications...');
      
      try {
        // First try to get the user's resume file
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('resume_url')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (profileError) {
            console.warn('Error fetching profile:', profileError);
          }
          
          if (profile?.resume_url) {
            // Get signed URL for the resume
            const { data: signedUrlData } = await supabase.storage
              .from('resumes')
              .createSignedUrl(profile.resume_url, 60);
            
            if (signedUrlData?.signedUrl) {
              // Fetch the resume file
              const response = await fetch(signedUrlData.signedUrl);
              if (response.ok) {
                const blob = await response.blob();
                const fileName = profile.resume_url.split('/').pop() || 'resume.pdf';
                const file = new File([blob], fileName, { type: blob.type });
                
                // Upload to browser-use
                addLog(`📤 Uploading resume: ${fileName} (${(file.size / 1024).toFixed(2)}KB)...`);
                const uploadedFileName = await browserClient.uploadFile(file);
                uploadedFileNames.push(uploadedFileName);
                addLog('✅ Resume uploaded successfully for external applications');
                
                // Also get text content for context
                resumeContent = await fetchUserResumeContent();
              }
            }
          }
        }
        
        if (uploadedFileNames.length === 0) {
          addLog('⚠️ Warning: Could not upload resume. External job applications may be limited.', 'warning');
        }
      } catch (error) {
        console.error('Error preparing resume:', error);
        if (error instanceof Error) {
          addLog(`⚠️ Resume upload failed: ${error.message}`, 'warning');
        } else {
          addLog('⚠️ Warning: Failed to prepare resume for upload. External applications may be limited.', 'warning');
        }
      }
    }
    
    // Manual login mode
    addLog('🔐 Manual login mode enabled', 'info');
    addLog('📋 You will be prompted to log in manually when the browser opens', 'info');
    
    // Use comprehensive single prompt approach (proven to work better)
    // INSTRUCTION: Use the LinkedIn password from the secret variable ln_password
    const comprehensivePrompt = createComprehensivePrompt(linkedinUrl, resumeContent, uploadedFileNames);

    // Only pass secrets if we have external job password and are applying to external jobs
    const secrets: Record<string, string> | undefined = 
      (effectiveConfig.applyToExternalJobs && config.externalJobPassword) 
        ? { ext_password: config.externalJobPassword }
        : undefined;
    
    const taskConfig = {
      task: comprehensivePrompt,
      
      secrets: secrets,
      save_browser_data: false,
      use_adblock: true, // Enable to reduce page load and prevent crashes from heavy scripts
      use_proxy: true,
      
      proxy_country_code: 'us' as const,
      highlight_elements: true,
      max_agent_steps: Math.max(100, parseInt(config.targetCount) * 15), // 15 steps per application for external jobs
      llm_model: selectedModel,
      // Don't restrict domains when applying to external jobs, otherwise restrict to LinkedIn
      allowed_domains: effectiveConfig.applyToExternalJobs ? undefined : ['linkedin.com', 'www.linkedin.com'],
      included_file_names: uploadedFileNames.length > 0 ? uploadedFileNames : undefined,
    };

    addLog(`🚀 Starting LinkedIn automation with ${AI_MODELS[selectedModel].name} (${AI_MODELS[selectedModel].provider})`, 'success');

    console.log('Creating task with config:', {
      ...taskConfig,
      task: taskConfig.task.substring(0, 200) + '...', // Just show first 200 chars
      secrets: secrets ? 'PROVIDED' : 'NOT PROVIDED',
      allowed_domains: taskConfig.allowed_domains
    });
    
    const result = await browserClient.createLinkedInTask(taskConfig);
    
    console.log('Task creation result:', result);
    console.log('Task ID:', result.id);
    console.log('Initial status:', result.status);
    
    // Wait a bit before fetching details to let task initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Immediately fetch task details to get the live URL
    const taskDetails = await browserClient.getTask(result.id);
    console.log('Task details after creation:', taskDetails);
    console.log('Initial task status:', taskDetails.status);
    console.log('Initial live_url:', taskDetails.live_url);
    
    // If task is already stopped, log why
    if (taskDetails.status === 'stopped' || taskDetails.status === 'failed') {
      console.error('Task immediately stopped/failed:', {
        status: taskDetails.status,
        error: taskDetails.error,
        output: taskDetails.output
      });
      addLog(`⚠️ Task was ${taskDetails.status}: ${taskDetails.error || taskDetails.output || 'Unknown reason'}`, 'error');
    }
    
    const taskStatus = {
      id: result.id,
      live_url: taskDetails.live_url || undefined,
      status: taskDetails.status || 'created' as const,
      steps: taskDetails.steps || [],
      output: taskDetails.output || undefined,
      error: taskDetails.error || undefined
    };
    
    console.log('Returning task status:', taskStatus);
    
    return taskStatus;
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profileError) {
        console.warn('Error fetching profile:', profileError);
        return false;
      }
      
      if (!profile) {
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

  const extractCompanyRoleFromStep = (stepText: string): { company: string | null; role: string | null; url: string | null } => {
    // Look for multiple patterns: "SUBMITTING APPLICATION TO:", "SUBMITTING EXTERNAL APPLICATION TO:", or "APPLYING TO:"
    const patterns = [
      /SUBMITTING (?:EXTERNAL )?APPLICATION TO:\s*([^-\n]+?)\s*-\s*([^\n]+)/i,
      /APPLYING TO:\s*([^-\n]+?)\s*-\s*([^\n]+)/i
    ];
    
    let match = null;
    for (const pattern of patterns) {
      match = stepText.match(pattern);
      if (match) break;
    }
    
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
      // Look for LinkedIn job URLs or external career site URLs
      const jobUrl = urlMatches.find(u => 
        u.includes('linkedin.com/jobs/view/') || 
        u.includes('linkedin.com/jobs/collections/') ||
        u.includes('careers.') ||
        u.includes('jobs.') ||
        u.includes('job-openings') ||
        u.includes('apply')
      );
      url = jobUrl || urlMatches[0] || null; // Use first URL if no specific job URL found
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

  const startAutomation = async () => {
    // Reset user stopped flag when starting new task
    setUserStoppedTask(false);
    
    // 🔒 BULLETPROOF SECURITY CHECK - Server-side validation first
    if (!user) {
      setShowPaywall(true);
      addLog('❌ Authentication required to start automation', 'error');
      return;
    }

    try {
      // Validate subscription and usage limits
      const product = userSubscription?.prices ? getProductByPriceId(userSubscription.prices.id) : null;
      const limits = product ? getPlanLimits(product.name) : null;
      const currentUsage = userUsage?.automation_steps.used || 0 || 0;
      const maxSteps = limits ? limits.applications * 10 : 0;
      
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

    if (!config.contactNumber.trim()) {
      toast.error('Please enter your contact number for job applications');
      return;
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
        toast.error(`Usage limit reached! You have used ${userUsage?.automation_steps.used || 0}/${limit} steps this month.`);
      }
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    setLogs([]);
    setStepCount(0);
    setAppliedCount(0);
    setStartTime(new Date());
    setElapsedTime(0);
    setErrorCount(0);

    try {
      addLog('🚀 Starting LinkedIn automation...');
      
      // Clean up any stale heartbeats for this user before starting
      await cleanupUserHeartbeats();
      
      const task = await createLinkedInTask();
      setCurrentTask(task);
      
      addLog(`✅ Task created: ${task.id}`);
      
      // Create automation session in new tracking system
      if (isSupabaseConfigured() && user) {
        await createAutomationSession(
          user.id,
          task.id,
          config.jobTitle,
          config.location,
          parseInt(config.targetCount) || 10
        );
      }
      
      // Save initial automation state
      saveAutomationState(task);
      
      // Wait longer for the task to fully initialize before polling
      addLog('⏳ Waiting for task to initialize...', 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Start polling for status updates
      addLog('📊 Starting status monitoring...', 'info');
      startPolling(task.id);
      
      // Start heartbeat to track active session
      startHeartbeat(task.id);

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
      
      // Resume heartbeat monitoring
      startHeartbeat(currentTask.id);
      
      // Force an immediate status update to ensure we have the latest live_url after resuming
      setTimeout(async () => {
        try {
          const refreshedTask = await getTaskStatus(currentTask.id);
          setCurrentTask(refreshedTask);
          if (refreshedTask.live_url && !currentTask.live_url) {
            addLog(`🌐 Live preview available: ${refreshedTask.live_url}`);
          }
        } catch (error) {
          console.warn('Failed to refresh task status after resuming:', error);
        }
      }, 1000);
      
      addLog('▶️ Automation resumed - task is now running');
      toast.success('Automation resumed');
    } catch (error) {
      toast.error('Failed to resume automation');
    }
  };

  const handleResume = async () => {
    if (!currentTask || !browserClient) return;
    
    try {
      await browserClient.resumeTask(currentTask.id);
      setIsPaused(false);
      setShowResumeButton(false);
      setLoginDetection(null);
      addLog('✅ Task resumed - Continuing automation', 'success');
      
      // Mark successful login
      browserClient.markSuccessfulLogin();
    } catch (error) {
      addLog('❌ Failed to resume task', 'error');
      console.error('Resume error:', error);
    }
  };

  const stopAutomation = async () => {
    // Set flag to indicate user manually stopped the task
    setUserStoppedTask(true);
    
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
      setUserStoppedTask(false);
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
        
        // Mark task as stopped in database with final step count
        await markTaskCompleted(currentTask.id, finalStepCount, 'stopped');
        
        addLog(`📊 Automation stopped - ${finalStepCount} steps completed`);
        
        // Wait for database writes to complete, then refresh usage data
        setTimeout(async () => {
          await fetchUserSubscription();
          addLog('📊 Usage data refreshed');
        }, 2000);
        
      } catch (error) {
        addLog('⚠️ Could not fetch final task details after stop', 'error');
      }
      
      setIsRunning(false);
      setIsPaused(false);
      setCurrentTask(null);
      clearAutomationState();
      addLog('⏹️ Automation stopped by user');
      toast.success('Automation stopped');
      setUserStoppedTask(false);
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
        // Only show toast if not already handled by polling
        if (!userStoppedTask) {
          toast.success('Automation stopped');
        }
      } else {
        addLog(`⚠️ Stop command failed but UI reset: ${errorMessage}`, 'error');
        toast.error('Automation stopped locally (server may still be running)');
      }
      setUserStoppedTask(false);
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
        if (!browserClient) {
          console.error('Browser client not initialized during polling');
          return;
        }
        
        // Fetch full task details during polling, not just status
        const fullTaskDetails = await browserClient.getTask(taskId);
        const updatedTask: TaskStatus = {
          id: taskId,
          status: fullTaskDetails.status,
          steps: fullTaskDetails.steps || [],
          output: fullTaskDetails.output || undefined,
          error: undefined,
          live_url: fullTaskDetails.live_url || undefined
        };
        
        console.log('Polling - Updated task:', updatedTask);
        console.log('Polling - Live URL:', updatedTask.live_url);
        console.log('Polling - Steps:', updatedTask.steps?.length);
        setCurrentTask(updatedTask);
        
        // Log live URL when it first appears
        if (updatedTask.live_url && (!currentTask || !currentTask.live_url)) {
          addLog(`🌐 Live preview now available: ${updatedTask.live_url}`);
        }

        if (updatedTask.steps) {
          const newStepCount = updatedTask.steps.length;
            
            if (newStepCount > stepCount) {
              // Process new steps and filter out repetitive updates
              for (let i = stepCount; i < newStepCount; i++) {
                const step = updatedTask.steps[i];
                if (step.next_goal) {
                  const goal = step.next_goal;
                  
                  // Filter out repetitive or low-value updates
                  const skipPatterns = [
                    /waiting/i,
                    /extracting.*elements/i,
                    /evaluating page/i,
                    /thinking/i,
                    /^navigate to/i,
                    /^click/i,
                    /^scroll/i,
                    /^wait/i
                  ];
                  
                  const isRepetitive = skipPatterns.some(pattern => pattern.test(goal));
                  
                  // Show high-value updates
                  if (!isRepetitive) {
                    // Extract meaningful information
                    if (goal.includes('APPLYING TO:')) {
                      addLog(`🎯 ${goal}`, 'success');
                    } else if (goal.includes('login') || goal.includes('sign in')) {
                      addLog(`🔐 Login required - preparing to pause`, 'info');
                    } else if (goal.includes('job') || goal.includes('application')) {
                      addLog(`📋 ${goal}`, 'info');
                    } else if (goal.includes('error') || goal.includes('failed')) {
                      addLog(`⚠️ ${goal}`, 'error');
                    } else if (goal.includes('complete') || goal.includes('success')) {
                      addLog(`✅ ${goal}`, 'success');
                    } else {
                      // Only show other updates if they're meaningful
                      const meaningfulKeywords = ['form', 'submit', 'upload', 'resume', 'question', 'answer'];
                      if (meaningfulKeywords.some(keyword => goal.toLowerCase().includes(keyword))) {
                        addLog(`🤖 ${goal}`, 'info');
                      }
                    }
                  }
                }
              }
              
              // Track the TOTAL steps (not incremental) - this will upsert in the database
            // await trackUsage(newStepCount, taskId);
              
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
            
            // Update automation session with latest step count
            await updateAutomationSession(taskId, {
              step_count: newStepCount,
              applications_submitted: appliedCount
            });
            
            console.log(`Updated usage tracking - Task: ${taskId}, Steps: ${newStepCount}`);
            
            // Refresh usage display to show updated numbers
            if (user) {
              const updatedUsage = await getUserUsage(user.id);
              setUserUsage(updatedUsage);
            }
            
          // Look for successful application submissions only
            const applicationSteps = updatedTask.steps.filter(step => {
            const stepText = step.next_goal || step.evaluation_previous_goal || '';
            // Count steps with any of our announcement formats
            return /SUBMITTING (?:EXTERNAL )?APPLICATION TO:/i.test(stepText) || /APPLYING TO:/i.test(stepText);
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
            const totalApplications = sessionProcessedApps.size;
            setAppliedCount(totalApplications);
            
            if (newApplicationsCount > 0) {
              const targetCount = parseInt(config.targetCount) || 10;
              addLog(`✅ Progress: ${totalApplications}/${targetCount} applications completed`, 'success');
              
              // Show milestone messages
              if (totalApplications === 5) {
                addLog(`🎉 Halfway there! Keep going!`, 'info');
              } else if (totalApplications === targetCount) {
                addLog(`🎯 Target reached! All ${targetCount} applications completed!`, 'success');
              }
            }
          }
          }

        // Check for login requirement
        if (!isPaused && updatedTask.status === 'running') {
          const detection = await browserClient.detectLoginRequirement(taskId);
          
          if (detection.loginRequired && detection.confidence >= 0.8) {
            // Pause the task
            await browserClient.pauseTask(taskId);
            
            setIsPaused(true);
            setLoginDetection(detection);
            setShowResumeButton(true);
            
            // Add comprehensive login message
            addLog('🔐 LOGIN REQUIRED - Automation paused', 'info');
            addLog('⏱️ You have 30 seconds to complete the login', 'warning');
            addLog('👉 If you need more time:', 'info');
            addLog('   1. Click the "Pause" button to stop the timer', 'info');
            addLog('   2. Complete your login in the browser window', 'info');
            addLog('   3. Click "Resume" when ready to continue', 'info');
            addLog(`📊 Detection confidence: ${(detection.confidence * 100).toFixed(0)}%`, 'info');
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
          
          // Wait for database writes to complete before refreshing
          setTimeout(async () => {
            await fetchUserSubscription();
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          }, 2000);
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
              
              // Mark task as failed in database with final step count
            await markTaskCompleted(taskId, finalStepCount, 'failed', finalTask.error || updatedTask.error);
              
              addLog(`❌ Automation failed: ${finalTask.error || updatedTask.error || 'Unknown error'}`, 'error');
              addLog(`📊 ${finalStepCount} steps completed before failure`);
              
            } catch (error) {
            await markTaskCompleted(taskId, updatedTask.steps?.length || 0, 'failed', updatedTask.error);
              addLog(`❌ Automation failed: ${updatedTask.error || 'Unknown error'}`, 'error');
            }
            
          // Clear automation state and refresh usage data
          clearAutomationState();
          
          // Wait for database writes to complete before refreshing
          setTimeout(async () => {
            await fetchUserSubscription();
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          }, 2000);
          } else if (updatedTask.status === 'stopped') {
          clearInterval(interval);
          setPollInterval(null);
            setIsRunning(false);
            
            // Only process if this wasn't a manual user stop (to avoid duplicate processing)
            if (!userStoppedTask) {
              addLog('🔄 Fetching final task details for stopped task...', 'info');
              
              // Wait a moment and fetch final state
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              try {
              const finalTask = await getTaskStatus(taskId);
                setCurrentTask(finalTask);
                
                const finalStepCount = finalTask.steps?.length || 0;
                setStepCount(finalStepCount);
                
                // Mark task as stopped in database with final step count
              await markTaskCompleted(taskId, finalStepCount, 'stopped');
                
                addLog(`⏹️ Automation stopped - ${finalStepCount} steps completed`);
                
              } catch (error) {
              await markTaskCompleted(taskId, updatedTask.steps?.length || 0, 'stopped');
                addLog('⏹️ Automation stopped');
              }
              
            // Clear automation state and refresh usage data
            clearAutomationState();
            
            // Wait for database writes to complete before refreshing
            setTimeout(async () => {
              await fetchUserSubscription();
              // Force billing page to refresh by dispatching a custom event
              window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
            }, 2000);
            }
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

  try {
    return (
      <div className="min-h-screen -m-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-teal-50 to-white border-b border-gray-100">
        <div className="px-8 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-3">LinkedIn Auto Apply Agent</h1>
                <p className="text-lg text-gray-600">
                  AI-powered automation that applies to jobs while you focus on what matters
                </p>
              </div>
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{
                    scale: isRunning ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    duration: 2,
                    repeat: isRunning ? Infinity : 0,
                  }}
                  className={`px-4 py-2 rounded-full flex items-center gap-2 ${
                    isRunning
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="font-medium">{isRunning ? 'Active' : 'Inactive'}</span>
                </motion.div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Applications Sent</span>
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                </div>
                <motion.div
                  key={appliedCount}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold text-gray-900"
                >
                  {appliedCount}
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-gray-900">{stats.successRate}%</div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.successRate}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Time Elapsed</span>
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{formatTime(elapsedTime)}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Steps Used</span>
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stepCount}</div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Configuration Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* AI Model Selector */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-gray-600" />
                      <h3 className="text-lg font-semibold text-gray-900">AI Model</h3>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Info className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="relative z-20">
                    <button
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 flex items-center justify-between hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{AI_MODELS[selectedModel].icon}</span>
                        <div className="text-left">
                          <div className="font-medium text-gray-900">{AI_MODELS[selectedModel].name}</div>
                          <div className="text-xs text-gray-500">{AI_MODELS[selectedModel].speed} • {AI_MODELS[selectedModel].requestLabel}</div>
                        </div>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isModelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-gray-200 shadow-lg z-50"
                        >
                          {Object.entries(AI_MODELS).map(([key, model]) => (
                            <button
                              key={key}
                              onClick={() => {
                                setSelectedModel(key as any);
                                setIsModelDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                                selectedModel === key ? 'bg-teal-50' : ''
                              }`}
                            >
                              <span className="text-2xl">{model.icon}</span>
                              <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{model.name}</div>
                                <div className="text-xs text-gray-500">{model.description}</div>
                              </div>
                              {selectedModel === key && (
                                <CheckCircle className="h-5 w-5 text-teal-600" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              {/* Configuration Settings */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-gray-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
                    </div>
                    <button
                      onClick={() => setShowConfigPanel(!showConfigPanel)}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {showConfigPanel ? 'Hide' : 'Edit'}
                    </button>
                  </div>

                  {showConfigPanel ? (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {/* Login Credentials */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Email</label>
                        <input
                          type="email"
                          value={config.linkedinEmail}
                          onChange={(e) => setConfig({ ...config, linkedinEmail: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="your@email.com"
                        />
                      </div>

                      {/* Contact Information */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                          <select
                            value={config.countryCode}
                            onChange={(e) => setConfig({ ...config, countryCode: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            {COUNTRY_CODES.map(country => (
                              <option key={country.code} value={country.code}>
                                {country.flag} {country.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                          <input
                            type="tel"
                            value={config.contactNumber}
                            onChange={(e) => setConfig({ ...config, contactNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="123-456-7890"
                          />
                        </div>
                      </div>

                      {/* Job Search Criteria */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                        <input
                          type="text"
                          value={config.jobTitle}
                          onChange={(e) => setConfig({ ...config, jobTitle: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Software Engineer"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <select
                          value={config.location}
                          onChange={(e) => {
                            const location = e.target.value;
                            const locationId = LINKEDIN_LOCATIONS[location as keyof typeof LINKEDIN_LOCATIONS] || '0';
                            setConfig({ ...config, location, locationId });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {Object.keys(LINKEDIN_LOCATIONS).map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                        <select
                          value={config.experience}
                          onChange={(e) => setConfig({ ...config, experience: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="All">All</option>
                          <option value="Internship">Internship</option>
                          <option value="Entry level">Entry level</option>
                          <option value="Associate">Associate</option>
                          <option value="Mid-Senior level">Mid-Senior level</option>
                          <option value="Director">Director</option>
                          <option value="Executive">Executive</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
                        <select
                          value={config.remotePreference}
                          onChange={(e) => setConfig({ ...config, remotePreference: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="All">All</option>
                          <option value="Remote">Remote</option>
                          <option value="On-site">On-site</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date Posted</label>
                        <select
                          value={config.datePosted || 'All time'}
                          onChange={(e) => setConfig({ ...config, datePosted: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="All time">All time</option>
                          <option value="Past 24 hours">Past 24 hours</option>
                          <option value="Past week">Past week</option>
                          <option value="Past month">Past month</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Applications</label>
                        <input
                          type="number"
                          value={config.targetCount}
                          onChange={(e) => setConfig({ ...config, targetCount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          min="1"
                          max="50"
                        />
                      </div>

                      {FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS && (
                        <>
                          <div className="col-span-2 border-t pt-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">External Job Applications</h4>
                          </div>

                          <div className="col-span-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={config.applyToExternalJobs}
                                onChange={(e) => setConfig({ ...config, applyToExternalJobs: e.target.checked })}
                                className="h-4 w-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                              />
                              <span className="text-sm font-medium text-gray-700">Apply to external jobs (non-Easy Apply)</span>
                            </label>
                          </div>

                          {config.applyToExternalJobs && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">External Job Email</label>
                                <input
                                  type="email"
                                  value={config.externalJobEmail}
                                  onChange={(e) => setConfig({ ...config, externalJobEmail: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="email@example.com"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">External Job Password</label>
                                <input
                                  type="password"
                                  value={config.externalJobPassword}
                                  onChange={(e) => setConfig({ ...config, externalJobPassword: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="Password for external sites"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                  type="text"
                                  value={config.firstName}
                                  onChange={(e) => setConfig({ ...config, firstName: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="John"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                  type="text"
                                  value={config.lastName}
                                  onChange={(e) => setConfig({ ...config, lastName: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="Doe"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
                                <input
                                  type="url"
                                  value={config.linkedInProfileUrl}
                                  onChange={(e) => setConfig({ ...config, linkedInProfileUrl: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="https://linkedin.com/in/johndoe"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                <input
                                  type="text"
                                  value={config.address}
                                  onChange={(e) => setConfig({ ...config, address: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="123 Main St"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <input
                                  type="text"
                                  value={config.city}
                                  onChange={(e) => setConfig({ ...config, city: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="San Francisco"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                <input
                                  type="text"
                                  value={config.state}
                                  onChange={(e) => setConfig({ ...config, state: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="CA"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                                <input
                                  type="text"
                                  value={config.zipCode}
                                  onChange={(e) => setConfig({ ...config, zipCode: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="94105"
                                />
                              </div>

                              <div className="col-span-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                                  <div className="text-sm text-amber-800">
                                    <p className="font-medium">External Job Applications Note:</p>
                                    <p className="mt-1">The bot will automatically switch between tabs to apply on external company websites. Make sure your resume is uploaded in your profile settings.</p>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Custom Instructions (Optional)</label>
                        <textarea
                          value={config.customInstructions}
                          onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          rows={3}
                          placeholder="Any special instructions for the AI..."
                        />
                      </div>

                      <button
                        onClick={saveConfiguration}
                        className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        Save Configuration
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">Email</span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                          {config.linkedinEmail || 'Not configured'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">Job Title</span>
                        <span className="text-sm font-medium text-gray-900">
                          {config.jobTitle}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">Location</span>
                        <span className="text-sm font-medium text-gray-900">
                          {config.location}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">Experience</span>
                        <span className="text-sm font-medium text-gray-900">
                          {config.experience}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">Work Type</span>
                        <span className="text-sm font-medium text-gray-900">
                          {config.remotePreference}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">Target Jobs</span>
                        <span className="text-sm font-medium text-gray-900">{config.targetCount}</span>
                      </div>
                      {FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS && config.applyToExternalJobs && (
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-gray-600">External Jobs</span>
                          <span className="text-sm font-medium text-green-600">Enabled</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Usage Metrics */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-gray-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Usage This Month</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Steps Used</span>
                        <span className="text-sm font-medium text-gray-900">
                          {userUsage?.automation_steps.used || 0} / {getTokenLimit() === -1 ? '∞' : getTokenLimit()}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: getTokenLimit() === -1 ? '0%' : `${((userUsage?.automation_steps.used || 0) / getTokenLimit()) * 100}%` }}
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">Remaining Applications</span>
                      <span className="text-sm font-bold text-teal-600">
                        {getRemainingApplications() === 'Unlimited' ? '∞' : getRemainingApplications()}
                      </span>
                    </div>

                    {getTokenLimit() > 0 && (userUsage?.automation_steps.used || 0) / getTokenLimit() > 0.8 && (
                      <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Approaching limit</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          Consider upgrading for more applications
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Control Button */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                {!isRunning ? (
                  <button
                    onClick={startAutomation}
                    disabled={!canStartAutomation() || !config.linkedinEmail}
                    className="w-full px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold text-lg hover:from-teal-700 hover:to-teal-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    <Play className="h-6 w-6" />
                    Start Automation
                  </button>
                ) : isPaused ? (
                  <div className="space-y-3">
                    {loginDetection && showResumeButton && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-medium text-yellow-900">Manual Login Required</h4>
                            <p className="text-sm text-yellow-700 mt-1">{loginDetection.description}</p>
                            <p className="text-sm text-yellow-600 mt-2">
                              Please complete the login process in the browser window below.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={showResumeButton ? handleResume : resumeAutomation}
                      className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                    >
                      <Play className="h-6 w-6" />
                      {showResumeButton ? "I've Logged In - Resume" : "Resume"}
                    </button>
                    <button
                      onClick={stopAutomation}
                      className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Square className="h-5 w-5" />
                      Stop
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={pauseAutomation}
                      className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl font-semibold text-lg hover:from-amber-700 hover:to-amber-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                    >
                      <Pause className="h-6 w-6" />
                      Pause
                    </button>
                    <button
                      onClick={stopAutomation}
                      className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Square className="h-5 w-5" />
                      Stop
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Activity Feed & Browser Preview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Browser Preview */}
              {currentTask?.live_url && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Live Browser Preview</h3>
                      </div>
                      <a
                        href={currentTask.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Open Full View
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  <div className="relative bg-gray-50" style={{ height: '600px' }}>
                    <iframe
                      src={currentTask.live_url}
                      className="w-full h-full"
                      title="LinkedIn Automation Preview"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                      allow="fullscreen"
                      onError={(e) => {
                        console.error('Iframe failed to load:', e);
                        console.log('Failed URL:', currentTask.live_url);
                      }}
                    />
                    {/* Fallback message */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 text-center hidden" id="iframe-fallback">
                        <p className="text-gray-600 mb-4">If the preview doesn't load, you can view it directly:</p>
                        <a
                          href={currentTask.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 font-medium pointer-events-auto"
                        >
                          Open in new tab →
                        </a>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Live
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Activity Logs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
                  </div>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-center py-12">
                      <Bot className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No activity yet. Start automation to see logs.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {logs.map((log, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            log.type === 'error'
                              ? 'bg-red-50'
                              : log.type === 'success'
                              ? 'bg-green-50'
                              : 'bg-gray-50'
                          }`}
                        >
                          <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                            {log.timestamp}
                          </span>
                          <span className={`text-sm ${
                            log.type === 'error'
                              ? 'text-red-700'
                              : log.type === 'success'
                              ? 'text-green-700'
                              : 'text-gray-700'
                          }`}>
                            {log.message}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Monthly Usage Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">30-Day Activity</h3>
                  </div>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9ca3af"
                        fontSize={12}
                        tickFormatter={(value) => value.split(' ')[1]}
                      />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="steps"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Steps"
                      />
                      <Line
                        type="monotone"
                        dataKey="applications"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        dot={{ fill: '#14b8a6', r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Applications"
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="line"
                        wrapperStyle={{
                          paddingTop: '10px',
                          fontSize: '12px'
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Paywall Modal */}
      <PaywallModal 
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="LinkedIn Automation"
      />
    </div>
  );
  } catch (error) {
    console.error('LinkedInAutomationBot: Error rendering component', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Component</h2>
          <p className="text-gray-600 mb-4">There was an error loading the LinkedIn Automation Bot.</p>
          <p className="text-sm text-gray-500">Please check the console for more details.</p>
        </div>
      </div>
    );
  }
};

export default LinkedInAutomationBot;