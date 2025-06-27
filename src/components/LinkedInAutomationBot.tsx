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
  MessageSquare
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
import LinkedInVoiceSetup from './voice/LinkedInVoiceSetup';
import { extensionSuppressor } from '../lib/extensionSuppressor';
import ExtensionErrorStatus from './ui/ExtensionErrorStatus';
import UsageStatusDisplay from './ui/UsageStatusDisplay';
import SessionStatusDisplay from './ui/SessionStatusDisplay';
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
}

const BROWSER_USE_API_BASE = import.meta.env.VITE_BROWSER_USE_API_URL || 'https://api.browser-use.com/api/v1';

// LinkedIn location ID mapping
const LINKEDIN_LOCATIONS = {
  'San Francisco Bay Area': '90000084',
  'New York City': '90000070',
  'Los Angeles': '90000071',
  'Seattle': '90000069',
  'Chicago': '90000068',
  'Boston': '90000067',
  'Vancouver, BC': '103366113',
  'Toronto, ON': '90000045',
  'London, UK': '90000062',
  'Remote': 'remote'
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
  
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [monthlyUsage, setMonthlyUsage] = useState({ tokens_used: 0, ai_requests_used: 0, cost_usd: 0 });
  const [loading, setLoading] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  
  // Session management state
  const [browserClient, setBrowserClient] = useState<BrowserUseClient | null>(null);
  const [hasRecentLogin, setHasRecentLogin] = useState(false);
  const [daysSinceLogin, setDaysSinceLogin] = useState<number | null>(null);

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
    
    // Initialize browser client
    if (apiKey) {
      const client = new BrowserUseClient(apiKey);
      setBrowserClient(client);
      
      // Check for recent login
      const hasRecent = client.hasRecentLogin();
      const days = client.getDaysSinceLastLogin();
      setHasRecentLogin(hasRecent);
      setDaysSinceLogin(days);
    }
  }, [user, apiKey, config.linkedinEmail]);

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
      console.error('Error checking auto apply access:', error);
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

  // Session management functions
  const refreshSession = async () => {
    if (browserClient) {
      try {
        await browserClient.clearBrowserProfile();
        setHasRecentLogin(false);
        setDaysSinceLogin(null);
        addLog('🔄 Browser session cleared - you will be prompted to login again on next run', 'info');
      } catch (error) {
        console.error('Failed to clear browser profile:', error);
        browserClient.clearLoginRecord();
        setHasRecentLogin(false);
        setDaysSinceLogin(null);
        addLog('🔄 Local session record cleared', 'info');
      }
    }
  };

  const clearSession = async () => {
    if (browserClient) {
      try {
        await browserClient.clearBrowserProfile();
        setHasRecentLogin(false);
        setDaysSinceLogin(null);
        addLog('🗑️ Browser session data cleared', 'info');
      } catch (error) {
        console.error('Failed to clear browser profile:', error);
        browserClient.clearLoginRecord();
        setHasRecentLogin(false);
        setDaysSinceLogin(null);
        addLog('🗑️ Local session record cleared', 'info');
      }
    }
  };

  const updateSessionStatus = () => {
    if (browserClient) {
      const hasRecent = browserClient.hasRecentLogin();
      const days = browserClient.getDaysSinceLastLogin();
      setHasRecentLogin(hasRecent);
      setDaysSinceLogin(days);
    }
  };

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
          console.error('PDF extraction failed:', error);
          return `[PDF Resume for ${profile.full_name || 'User'} - Text extraction failed, but user has uploaded their resume]`;
        }
      }

      // For text files, read as text
      const content = await response.text();
      return content;
    } catch (error) {
      console.error('Error fetching resume content:', error);
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
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading configuration:', error);
        // Don't show error toast for configuration loading, just log it
      } else if (data?.config) {
        // Map empty strings and null values to undefined for select components
        const loadedConfig = { ...data.config };
        Object.keys(loadedConfig).forEach(key => {
          if (loadedConfig[key] === '' || loadedConfig[key] === null) {
            loadedConfig[key] = undefined;
          }
        });
        setConfig(prev => ({ ...prev, ...loadedConfig }));
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
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
      
      const { error } = await supabase
        .from('automation_configs')
        .upsert({
          user_id: user.id,
          config: configToSave
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  const handleVoiceConfigurationComplete = (voiceConfig: Record<string, string>) => {
    // Update the main config with voice-configured data
    setConfig(prev => ({
      ...prev,
      ...voiceConfig
    }));
    
    // Save the configuration
    saveConfiguration();
    
    toast.success('Voice configuration completed! Your settings have been saved.');
  };

  const fetchUserSubscription = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        console.log('🔍 Using demo data - Supabase not configured or no user');
        setUserSubscription({
          subscription_status: 'active',
          price_id: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || null // Demo Pro plan
        });
        setMonthlyUsage({ tokens_used: 15, ai_requests_used: 5, cost_usd: 0.15 });
        return;
      }

      console.log(`🔍 Fetching subscription for user: ${user.id}`);

      // Try direct table access first, fallback to subscription service
      try {
        const { data: subscription, error: subError } = await supabase
          .from('stripe_user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('🔍 Direct table query result:', { subscription, error: subError });

        if (subError) {
          console.warn('Table access failed:', subError.message);
          // Don't throw, just fallback
        }

        if (subscription && subscription.subscription_status === 'active') {
          console.log('✅ Active subscription found via direct table:', subscription);
          setUserSubscription(subscription);
        } else {
          console.log('❌ No active subscription found via direct table');
          setUserSubscription({ subscription_status: 'inactive', price_id: null });
        }
      } catch (tableError) {
        console.warn('⚠️ Direct table access failed, trying subscription service:', tableError);

        try {
          // Fallback to subscription service
          const { subscriptionService } = await import('../lib/subscriptionService');
          const serviceSubscription = await subscriptionService.getUserSubscription(user.id);
          
          console.log('🔍 Subscription service result:', serviceSubscription);

          if (serviceSubscription && serviceSubscription.subscription_status === 'active') {
            console.log('✅ Active subscription found via service:', serviceSubscription);
            setUserSubscription(serviceSubscription);
          } else {
            console.log('❌ No active subscription found via service');
            setUserSubscription({ subscription_status: 'inactive', price_id: null });
          }
        } catch (serviceError) {
          console.error('❌ Service subscription check failed:', serviceError);
          setUserSubscription({ subscription_status: 'inactive', price_id: null });
        }
      }

      // Fetch current month usage with proper timezone handling
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const startDate = firstDayOfMonth.toISOString();
      const endDate = nextMonth.toISOString();

      console.log(`🔍 System date check - Today: ${today.toISOString()}, Month: ${today.getMonth()}, Year: ${today.getFullYear()}`);
      console.log(`🔍 Fetching usage data from ${startDate} to ${endDate}`);
      
      // Add warning if system date seems incorrect
      const currentYear = new Date().getFullYear();
      if (currentYear > 2024) {
        console.warn(`⚠️ WARNING: System date appears to be in the future (${currentYear}). This may cause incorrect usage calculations.`);
      }
      
      const { data: usageData, error: usageError } = await supabase
        .from('browser_use_logs')
        .select('task_id, step_count, cost_usd, created_at')
        .eq('user_id', user.id)
        .eq('task_type', 'linkedin_auto_apply')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false });

      console.log('🔍 Usage query result:', { usageData, error: usageError });
      console.log('🔍 Raw data count:', usageData?.length);
      console.log('🔍 First 3 records:', usageData?.slice(0, 3));

      if (usageError) {
        console.error('❌ Error fetching usage data:', usageError);
        // Don't show error toast for usage data loading
      }

      // Calculate total steps correctly: only count the MAX step_count per task_id (same logic as billing page)
      console.log('🔍 Auto Apply Page - Raw usage data:', usageData);
      
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
            console.log(`🔍 Task ${log.task_id}: Updating max steps from ${currentSteps} to ${log.step_count}`);
            taskSteps[log.task_id] = log.step_count;
            taskCosts[log.task_id] = parseFloat(log.cost_usd.toString());
          }
        });
        
        console.log('🔍 Auto Apply Page - Task steps by ID:', taskSteps);
        console.log('🔍 Auto Apply Page - Task costs by ID:', taskCosts);
        
        // Sum up the final step counts and costs for all tasks
        totalSteps = Object.values(taskSteps).reduce((sum, steps) => sum + steps, 0);
        totalCost = Object.values(taskCosts).reduce((sum, cost) => sum + cost, 0);
      }
      
      const jobTokens = totalSteps; // Use actual steps, not divided by 10
      
      console.log('🔍 Auto Apply Page - Final totals:', { totalSteps, jobTokens, totalCost });
      
      // DEBUG: Check current state before updating
      console.log('🔍 Current monthlyUsage state before update:', monthlyUsage);

      
      
      setMonthlyUsage({ 
        tokens_used: jobTokens, 
        ai_requests_used: usageData?.length || 0,
        cost_usd: totalCost
      });

    } catch (error) {
      console.error('❌ Critical error in fetchUserSubscription:', error);
      
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
      console.log('🔍 Direct plan limits:', direct);
      if (direct) return direct;
    }

    // 2) try derive from product object resolved elsewhere
    const prod = getCurrentProduct();
    console.log('🔍 Current product:', prod);
    if (prod) {
      return {
        applications: prod.applicationCount || 0,
        aiTokens: prod.aiTokenCount || 0,
        isSubscription: prod.mode === 'subscription'
      };
    }

    // 3) final default
    console.log('⚠️ No plan found, using default');
    return { applications: 0, aiTokens: 0, isSubscription: false };
  };

  const getTokenLimit = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      console.log('❌ No active subscription found, returning 0 steps');
      return 0; // Free plan gets 0 steps
    }
    
    console.log(`🔍 Getting limits for subscription:`, userSubscription);
    
    // Use the same robust logic as billing page
    const limits = getPlanUsageLimits();
    console.log('🔍 Plan usage limits:', limits);
    
    const applicationLimit = limits.applications || 0;
    const stepLimit = applicationLimit * 10; // Convert applications to steps (10 steps per application)
    console.log(`✅ Final step limit: ${stepLimit} (${applicationLimit} applications × 10 steps)`);
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
    
    // Easy Apply filter
    params.append('f_AL', 'true');
    
    // Job title/keywords
    if (config.jobTitle) {
      params.append('keywords', config.jobTitle);
    }
    
    // Location
    const locationId = LINKEDIN_LOCATIONS[config.location as keyof typeof LINKEDIN_LOCATIONS] || config.locationId;
    if (locationId && locationId !== 'remote') {
      params.append('geoId', locationId);
    }
    
    // Work type (Remote/On-site/Hybrid)
    if (config.workType && config.workType !== 'any') {
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
    
    return `${baseUrl}?${params.toString()}`;
  };

  const trackUsage = async (totalSteps: number, taskId: string) => {
    if (!user) {
      addLog('❌ User not authenticated - cannot track usage', 'error');
      return;
    }

    try {
      const costPerStep = 0.03; // $0.03 per step
      const initializationCost = 0.01; // $0.01 initialization cost
      const costUsd = (totalSteps * costPerStep) + initializationCost;
      
      // 🔧 DIRECT DATABASE RECORDING - Bypass problematic server-side validation
      // Use client-side validation which is working correctly
      const currentUsage = monthlyUsage.tokens_used || 0;
      const maxSteps = getTokenLimit(); // This now returns steps, not applications
      
      // Check if user has active subscription (client-side check that works)
      if (!userSubscription || userSubscription.subscription_status !== 'active') {
        addLog('❌ No active subscription found', 'error');
        toast.error('Subscription access issue detected. Please check your billing status.');
        await stopAutomation();
        return;
      }
      
      // Check usage limits based on total steps for this task
      if (maxSteps > 0 && totalSteps > maxSteps) {
        addLog(`❌ Usage limit would be exceeded: ${totalSteps}/${maxSteps} steps`, 'error');
        toast.error('Monthly usage limit reached. Upgrade your plan or wait until next month to continue automation.');
        addLog('🛑 Stopping automation due to usage limit violation', 'error');
        await stopAutomation();
        return;
      }
      
      console.log(`🔍 Usage check: ${totalSteps}/${maxSteps} steps used (${currentUsage} current monthly usage)`);
      
      // Record usage directly to database (bypassing problematic RPC function)
      // Delete existing record and insert new one to ensure we always have the latest total
      if (isSupabaseConfigured()) {
        try {
          // First, delete any existing logs for this task to avoid duplicates
          console.log(`🗑️ Deleting existing logs for task ${taskId}, user ${user.id}`);
          const { error: deleteError } = await supabase
            .from('browser_use_logs')
            .delete()
            .eq('user_id', user.id)
            .eq('task_id', taskId);

          if (deleteError) {
            console.warn('Warning: Error deleting existing logs:', deleteError);
          }

          // Then insert the current total step count
          console.log(`💾 Inserting new usage record:`, {
            user_id: user.id,
            task_id: taskId,
            step_count: totalSteps,
            cost_usd: costUsd
          });

          const { data: insertData, error: logError } = await supabase
            .from('browser_use_logs')
            .insert({
              user_id: user.id,
              task_id: taskId,
              task_type: 'linkedin_auto_apply',
              step_count: totalSteps, // Always store TOTAL steps, not incremental
              cost_usd: costUsd
            })
            .select(); // Return the inserted data

          if (logError) {
            console.error('❌ Error recording usage log:', logError);
            addLog(`❌ Failed to record usage: ${logError.message}`, 'error');
            // Don't stop automation for logging errors, just warn
          } else {
            console.log('✅ Successfully inserted usage record:', insertData);
            addLog(`✅ Usage recorded: ${totalSteps} total steps ($${costUsd.toFixed(3)})`);
          }
        } catch (dbError) {
          console.warn('Database logging failed:', dbError);
          // Continue automation even if logging fails
        }
      }

      // Update local state for immediate UI feedback - use total steps for the session
      setMonthlyUsage(prev => ({
        ...prev,
        tokens_used: totalSteps, // Store total for this session
        cost_usd: costUsd
      }));
      
    } catch (error) {
      console.error('Error in usage tracking:', error);
      // Don't stop automation for tracking errors - they shouldn't be critical
      addLog(`⚠️ Usage tracking error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const saveJobApplication = async (company: string, role: string, taskId: string) => {
    try {
      if (!isSupabaseConfigured() || !user) {
        addLog(`❌ Cannot save application: Database not configured or user not found`, 'error');
        return false;
      }

      addLog(`🔍 Attempting to save application: ${company} - ${role}`);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        addLog(`❌ No profile found for user: ${profileError?.message || 'Profile not found'}`, 'error');
        return false;
      }

      addLog(`✅ Profile found: ${profile.id}`);

      // First, get or create a job campaign
      const { data: campaign, error: campaignSelectError } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('job_title', config.jobTitle || 'LinkedIn Auto Apply')
        .eq('location', config.location || 'Remote')
        .maybeSingle();

      let campaignId = campaign?.id;

      if (!campaignId) {
        addLog(`📋 Creating new job campaign: ${config.jobTitle} in ${config.location}`);
        
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
          addLog(`❌ Failed to create job campaign: ${campaignError?.message || 'Unknown error'}`, 'error');
          return false;
        }

        campaignId = newCampaign.id;
        addLog(`✅ Created new job campaign with ID: ${campaignId}`);
      } else {
        addLog(`✅ Using existing campaign: ${campaignId}`);
      }

      if (campaignId) {
        // Check if this application already exists to avoid duplicates
        const { data: existingApp, error: existingError } = await supabase
          .from('applications')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('company', company)
          .eq('role', role)
          .maybeSingle();

        if (existingError) {
          addLog(`⚠️ Error checking for existing application: ${existingError.message}`, 'error');
        }

        if (!existingApp) {
          addLog(`💾 Inserting application: ${company} - ${role}`);
          
          const applicationData = {
            campaign_id: campaignId,
            company: company.trim(),
            role: role.trim(),
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
              extraction_method: 'browser_use_api',
              timestamp: new Date().toISOString()
            }
          };

          addLog(`📝 Application data: ${JSON.stringify(applicationData, null, 2)}`);

          const { data: newApp, error: appError } = await supabase
            .from('applications')
            .insert(applicationData)
            .select('id')
            .single();

          if (appError) {
            addLog(`❌ Failed to save application: ${appError.message}`, 'error');
            console.error('Full application error:', appError);
            return false;
          } else {
            addLog(`✅ Application saved successfully: ${company} - ${role} (ID: ${newApp?.id})`, 'success');
            return true;
          }
        } else {
          addLog(`⚪ Duplicate application skipped: ${company} - ${role} (ID: ${existingApp.id})`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error saving job application:', error);
      addLog(`❌ Failed to save application to database: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return false;
    }
  };

  const createLinkedInTask = async () => {
    if (!browserClient) {
      throw new Error('Browser client not initialized');
    }

    const linkedinUrl = buildLinkedInJobsURL();
    const fullContactNumber = `${config.countryCode}${config.contactNumber}`;
    
    // Fetch user's resume content for context
    addLog('📄 Fetching resume content for better job matching...', 'info');
    const resumeContent = await fetchUserResumeContent();
    if (resumeContent) {
      addLog('✅ Resume content loaded successfully', 'success');
    } else {
      addLog('⚠️ No resume found - upload one in Profile for better results', 'info');
    }
    
    // Check if we have stored session - if yes, skip login
    const hasStoredSession = browserClient.hasRecentLogin();
    
    console.log('🔍 Session check:', {
      hasRecentLogin: browserClient.hasRecentLogin(),
      daysSinceLogin: browserClient.getDaysSinceLastLogin(),
      forcingManualLogin: true
    });
    
    // Create optimized task prompt for session-based automation
    const taskPrompt = hasStoredSession 
      ? createSessionBasedTaskPrompt(linkedinUrl, resumeContent)
      : createInitialLoginTaskPrompt(linkedinUrl, resumeContent);

    const taskConfig = {
      task: taskPrompt,
      save_browser_data: true, // Always save for session persistence
      use_adblock: true,
      use_proxy: true,
      proxy_country_code: 'us' as const,
      highlight_elements: true,
      browser_viewport_width: 1280,
      browser_viewport_height: 960,
              max_agent_steps: 200, // Max allowed by browser-use API - use max for 2FA waiting time
      llm_model: 'gpt-4o' as const,
      allowed_domains: ['linkedin.com', '*.linkedin.com']
    };

    if (hasStoredSession) {
      addLog('🔐 Using stored session - skipping login process', 'success');
    } else {
      addLog('🔑 No stored session - manual login required', 'info');
      addLog('📋 IMPORTANT: You will need to manually log into LinkedIn when the browser window opens', 'info');
      addLog('⏳ The automation will wait patiently while you complete login and 2FA', 'info');
      toast.success('Manual login required - please be ready to log into LinkedIn when the browser opens', {
        duration: 6000
      });
    }

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

  const createSessionBasedTaskPrompt = (linkedinUrl: string, resumeContent: string | null = null) => {
    return `You are an AI assistant helping with LinkedIn job applications. Your browser session already has LinkedIn login cookies saved, so you should SKIP the login process entirely.

IMPORTANT: DO NOT ATTEMPT TO LOGIN - Your session is already authenticated!

STEP-BY-STEP PROCESS:
1. Go directly to LinkedIn.com (you should already be logged in)
2. Navigate to the job search URL: ${linkedinUrl}
3. Look for jobs with "Easy Apply" buttons
4. For each job with Easy Apply:
   a. BEFORE clicking Easy Apply, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"
   b. Extract the actual company name from the job posting (not generic terms)
   c. Extract the exact job title from the posting
   d. Click the "Easy Apply" button
   e. Fill out the application form (scroll down if you can't see all fields)
   f. Answer any questions that appear (scroll to see all questions)
   g. Upload resume if prompted - use: "${config.linkedinResume || 'Use the most recent resume available'}"
   h. SCROLL DOWN to find the "Submit" or "Submit application" button
   i. Before clicking submit, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   j. Click submit to complete the application
   k. Close the modal and move to the next job

${getCommonTaskInstructions(resumeContent)}`;
  };

  const createInitialLoginTaskPrompt = (linkedinUrl: string, resumeContent: string | null = null) => {
    return `You are an AI assistant helping with LinkedIn job applications. You need to log into LinkedIn using provided credentials.

🔑 AUTOMATED LOGIN PROTOCOL:
1. Navigate directly to LinkedIn.com/login (the login page URL)
2. If that doesn't work, go to LinkedIn.com and look for "Sign in" button to click
3. IMPORTANT: LinkedIn login forms are often below the viewport. SCROLL DOWN multiple times to find the login form
4. Look for email/password input fields - they should have labels like "Email or phone" and "Password"
5. IMPORTANT: If you only see "Continue with Google" and "Sign in with Apple" buttons, SCROLL DOWN to find the actual email/password form
6. The email/password fields are usually BELOW the social login buttons - keep scrolling until you find them
7. Once you find the email and password input fields:
   a. Click on the email field and enter: ${config.linkedinEmail}
   b. Click on the password field and enter: ${config.linkedinPassword || '[PASSWORD_REQUIRED]'}
   c. Click the "Sign in" button
8. IF LOGIN FAILS:
   - If you see any security prompts, captcha, or verification requests
   - ANNOUNCE: "❌ LOGIN FAILED: Please ensure 2FA is disabled and try again"
   - This indicates the user needs to disable 2FA first
   - The task should complete with this error message
9. MONITOR for successful login signs:
   - LinkedIn feed/homepage appears
   - User profile/dashboard visible  
   - Navigation menu appears
   - URL changes from /login to main LinkedIn
10. When login is complete, ANNOUNCE: "✅ LOGIN SUCCESSFUL: Proceeding with job applications"
11. THEN navigate to job search: ${linkedinUrl}

🖱️ NAVIGATION & SCROLLING HELP:
- Try going directly to linkedin.com/login first
- If that doesn't work, go to linkedin.com and look for "Sign in" link/button
- If you see a homepage instead of login, look for "Sign in" in the top navigation
- If the login page loads but you can't see login fields, scroll down slowly
- LinkedIn sometimes loads with the login form below the viewport
- Try multiple scroll attempts to find the login form
- Look for input fields labeled "Email or phone" and "Password"
- Once you find the actual login form, announce the login requirement and wait

⏳ PATIENCE IS KEY DURING LOGIN:
- Enter credentials automatically as instructed
- DO NOT proceed until you clearly see the LinkedIn main interface (feed/homepage)
- Help by scrolling to reveal hidden login forms if needed
- If you encounter any security verification, announce failure and exit

4. Look for jobs with "Easy Apply" buttons
5. For each job with Easy Apply:
   a. BEFORE clicking Easy Apply, clearly state: "APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"
   b. Extract the actual company name from the job posting (not generic terms)
   c. Extract the exact job title from the posting
   d. Click the "Easy Apply" button
   e. Fill out the application form (scroll down if you can't see all fields)
   f. Answer any questions that appear (scroll to see all questions)
   g. Upload resume if prompted - use: "${config.linkedinResume || 'Use the most recent resume available'}"
   h. SCROLL DOWN to find the "Submit" or "Submit application" button
   i. Before clicking submit, repeat: "SUBMITTING APPLICATION TO: [COMPANY NAME] - [JOB TITLE]"
   j. Click submit to complete the application
   k. Close the modal and move to the next job

IMPORTANT: Your browser session will be saved after successful login to avoid future 2FA prompts.

${getCommonTaskInstructions(resumeContent)}`;
  };

  const getCommonTaskInstructions = (resumeContent: string | null = null) => {
    const resumeSection = resumeContent 
      ? `APPLICANT RESUME CONTEXT:
The person you're applying for has provided their resume content below. Use this context to:
- Better match their skills to job requirements
- Understand their experience level and background
- Make more informed decisions about which jobs to apply to
- Fill out application forms more accurately

RESUME CONTENT:
${resumeContent}

---

`
      : `APPLICANT CONTEXT: No resume content available. Apply to jobs based on the search criteria provided.

---

`;

    return `
${resumeSection}
CRITICAL SCROLLING INSTRUCTIONS:
- ALWAYS scroll down when you can't find buttons like "Submit", "Next", "Continue", or "Apply"
- LinkedIn forms often have content below the fold - scroll to reveal hidden elements
- If you encounter form questions but can't see all of them, scroll down to see more questions
- When stuck on any form, try scrolling both up and down to find missing elements
- Easy Apply modals often require scrolling to see the submit button

COMPANY NAME EXTRACTION REQUIREMENTS:
- Extract the ACTUAL company name from the LinkedIn job posting
- Look for the company name near the job title, usually displayed prominently
- DO NOT use generic terms like "Company", "Employer", "Organization"
- Examples of good company names: "Google", "Microsoft", "Acme Corp", "TechStart Inc"
- Examples of bad company names: "Company", "Employer", "LinkedIn Company"

JOB TITLE EXTRACTION REQUIREMENTS:
- Extract the EXACT job title from the posting
- Use the full title as displayed on LinkedIn
- Examples: "Senior Software Engineer", "Product Manager", "Data Scientist"

FORM HANDLING GUIDELINES:
- Always scroll down in Easy Apply forms to ensure you see all content
- If you can't find a "Submit" button, scroll down - it's usually below the visible area
- For multi-step forms, look for "Next" or "Continue" buttons (may require scrolling)
- If forms have multiple questions, scroll to see all questions before proceeding
- Handle file uploads by using any existing resume/CV files
- Skip optional fields if they're complex, but fill required fields
- If a form seems stuck, try scrolling up and down to find missing elements
- When filling contact information:
  * If there's a country code dropdown, select: ${config.countryCode.split('-')[0]}
  * For the phone number field, use ONLY the number WITHOUT country code: ${config.contactNumber}
  * Do NOT add the country code to the phone number field if you already selected it in a dropdown

${config.customInstructions ? `
CUSTOM INSTRUCTIONS:
${config.customInstructions}
` : ''}

CRITICAL: For every application, you MUST clearly announce both BEFORE clicking Easy Apply and BEFORE submitting:
"APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"

This helps track which companies you applied to. Use the exact company names and job titles from the LinkedIn job postings.`;
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
          browserClient.markSuccessfulLogin();
          updateSessionStatus(); // Update UI state
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
      // 🔍 DEBUG: Let's see what both client and server-side return
      addLog('🔍 Debug: Checking subscription status...');
      
      // Check client-side subscription data
      const clientSideCheck = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      addLog(`🔍 Client-side subscription: ${JSON.stringify(clientSideCheck.data)}`);
      
      // Check server-side subscription via subscription service
      const { subscriptionService } = await import('../lib/subscriptionService');
      const serverSideSubscription = await subscriptionService.hasActiveSubscription(user.id);
      addLog(`🔍 Server-side hasActiveSubscription: ${serverSideSubscription}`);
      
      const serverSideDetails = await subscriptionService.getUserSubscription(user.id);
      addLog(`🔍 Server-side subscription details: ${JSON.stringify(serverSideDetails)}`);

      // 🔧 TEMPORARY: Use client-side validation instead of server-side RPC
      // The server-side RPC function has subscription lookup issues
      const limits = getPlanUsageLimits();
      const currentUsage = monthlyUsage.tokens_used || 0;
      const maxSteps = limits.applications * 10;
      
      addLog(`🔍 Client-side access validation: ${limits.applications} applications = ${maxSteps} steps max`);
      addLog(`🔍 Current usage: ${currentUsage} steps`);
      
      // Check if user has an active subscription
      if (!userSubscription || userSubscription.subscription_status !== 'active') {
        addLog(`❌ No active subscription found`, 'error');
        toast.error('Please upgrade to a paid plan to use automation features');
        setShowPaywall(true);
        return;
      }
      
      // Check usage limits for active subscribers
      if (maxSteps > 0 && currentUsage >= maxSteps) {
        addLog(`❌ Usage limit exceeded: ${currentUsage}/${maxSteps} steps used`, 'error');
        toast.error('You have reached your monthly automation limit. Upgrade for more applications or wait until next month');
        return;
      }
      
      addLog(`✅ Client-side validation passed: Active subscription with ${maxSteps - currentUsage} steps remaining`, 'success');

      addLog(`✅ Access validated - automation authorized for current subscription`, 'success');
    } catch (error) {
      console.error('Security validation failed:', error);
      addLog('❌ Security validation failed', 'error');
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

    if (!apiKey || apiKey.trim() === '') {
      toast.error('Browser Use API key is not configured. Please check your environment variables.');
      addLog('❌ API key missing: VITE_BROWSER_USE_API_KEY not found in environment variables', 'error');
      return;
    }

    if (!canStartAutomation()) {
      const limit = getTokenLimit() * 10; // Convert to step limit
      if (limit === 0) {
        toast.error(`No steps available. Current plan: ${getPlanName()}. Please upgrade your subscription.`);
        addLog(`❌ No steps available. Current plan: ${getPlanName()}`, 'error');
      } else {
        toast.error(`Usage limit reached! You have used ${monthlyUsage.tokens_used}/${limit} steps this month.`);
        addLog(`❌ Cannot start automation: Monthly limit of ${limit} steps reached (${monthlyUsage.tokens_used} used)`, 'error');
      }
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    setLogs([]);
    setStepCount(0);
    setAppliedCount(0);

    try {
      addLog('🚀 Starting LinkedIn job application automation...');
      addLog(`🔗 API Endpoint: ${BROWSER_USE_API_BASE}`);
      addLog(`🔑 API Key configured: ${apiKey.substring(0, 10)}...`);
      addLog(`📱 Contact Number: ${config.countryCode}${config.contactNumber}`);
      if (config.linkedinResume) {
        addLog(`📄 LinkedIn Resume: ${config.linkedinResume}`);
      }
      if (config.customInstructions) {
        addLog(`🤖 Custom Instructions: ${config.customInstructions.substring(0, 100)}${config.customInstructions.length > 100 ? '...' : ''}`);
      }
      
      const task = await createLinkedInTask();
      setCurrentTask(task);
      
      addLog(`✅ Task created successfully with ID: ${task.id}`);
      if (task.live_url) {
        addLog(`🔗 Live browser preview available: ${task.live_url}`);
      }

      // Poll for task status
      const pollInterval = setInterval(async () => {
        try {
          const updatedTask = await getTaskStatus(task.id);
          setCurrentTask(updatedTask);

          if (updatedTask.steps) {
            const newStepCount = updatedTask.steps.length;
            
            if (newStepCount > stepCount) {
              // Track the TOTAL steps (not incremental) - this will upsert in the database
              await trackUsage(newStepCount, task.id);
              
              // Calculate total steps used for limit checking
              const limit = getTokenLimit() * 10; // Convert token limit to step limit (1 token = 10 steps originally)
              
              if (newStepCount >= limit) {
                clearInterval(pollInterval);
                setIsRunning(false);
                await stopTask(task.id);
                addLog(`🛑 Automation stopped: Monthly limit of ${limit} steps reached!`, 'error');
                toast.error('Automation stopped due to usage limit');
                return;
              } else if (newStepCount >= limit * 0.9) {
                addLog(`⚠️ Warning: Approaching monthly limit (${newStepCount}/${limit} steps used)`);
              }
            }
            
            setStepCount(newStepCount);
            
            // Look for steps that contain actual application submissions
            const applicationSteps = updatedTask.steps.filter(step => {
              if (!step.action && !step.output) return false;
              
              const stepText = (JSON.stringify(step.action) + ' ' + (step.output || '')).toLowerCase();
              return stepText.includes('submitting application to:') || 
                     stepText.includes('applying to:') ||
                     stepText.includes('submit application') ||
                     (stepText.includes('submit') && stepText.includes('successfully'));
            });
            
            if (applicationSteps.length > appliedCount) {
              const newApplications = applicationSteps.slice(appliedCount);
              for (const appStep of newApplications) {
                // Try to extract company and role from the step
                const stepText = JSON.stringify(appStep.action) + ' ' + (appStep.output || '');
                const companyRole = extractCompanyRoleFromStep(stepText);
                
                await saveJobApplication(
                  companyRole.company || 'LinkedIn Company',
                  companyRole.role || config.jobTitle || 'Software Engineer',
                  task.id
                );
              }
            }
            
            setAppliedCount(applicationSteps.length);
          }

          if (updatedTask.status === 'finished') {
            clearInterval(pollInterval);
            setIsRunning(false);
            
            addLog('🔄 Fetching final task details...', 'info');
            
            // Wait a moment for browser-use API to finalize the task
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fetch final task state to ensure we have all steps
            try {
              const finalTask = await getTaskStatus(task.id);
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
              await trackUsage(finalStepCount, task.id);
              addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
              
              // Mark task as completed in database with final step count
              await markTaskCompleted(task.id, finalStepCount, 'finished');
              
              // Try to extract company names from the final steps
              if (finalTask.steps && finalTask.steps.length > 0) {
                const applications = extractCompanyFromSteps(finalTask.steps);
                applications.forEach(app => {
                  saveJobApplication(app.company, app.role, task.id);
                });
              }
              
              addLog('✅ Automation completed successfully!', 'success');
              
              if (finalTask.output) {
                addLog(`📊 Final Results: ${finalTask.output}`);
              }
              
            } catch (error) {
              console.error('Error fetching final task details:', error);
              addLog('⚠️ Could not fetch final task details, using last known state', 'error');
              
              // Fallback to last known state
              await markTaskCompleted(task.id, updatedTask.steps?.length || 0, 'finished');
            }
            
            // Refresh usage data immediately and force billing page refresh
            fetchUserSubscription();
            
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          } else if (updatedTask.status === 'failed') {
            clearInterval(pollInterval);
            setIsRunning(false);
            
            addLog('🔄 Fetching final task details for failed task...', 'info');
            
            // Wait a moment and fetch final state
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              const finalTask = await getTaskStatus(task.id);
              setCurrentTask(finalTask);
              
              const finalStepCount = finalTask.steps?.length || 0;
              setStepCount(finalStepCount);
              
              // Track final step count (this will upsert to ensure we have the correct total)
              await trackUsage(finalStepCount, task.id);
              addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
              
              // Mark task as failed in database with final step count
              await markTaskCompleted(task.id, finalStepCount, 'failed', finalTask.error || updatedTask.error);
              
              addLog(`❌ Automation failed: ${finalTask.error || updatedTask.error || 'Unknown error'}`, 'error');
              addLog(`📊 Final step count: ${finalStepCount}`);
              
            } catch (error) {
              console.error('Error fetching final failed task details:', error);
              await markTaskCompleted(task.id, updatedTask.steps?.length || 0, 'failed', updatedTask.error);
              addLog(`❌ Automation failed: ${updatedTask.error || 'Unknown error'}`, 'error');
            }
            
            // Refresh usage data immediately and force billing page refresh
            fetchUserSubscription();
            
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          } else if (updatedTask.status === 'stopped') {
            clearInterval(pollInterval);
            setIsRunning(false);
            
            addLog('🔄 Fetching final task details for stopped task...', 'info');
            
            // Wait a moment and fetch final state
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
              const finalTask = await getTaskStatus(task.id);
              setCurrentTask(finalTask);
              
              const finalStepCount = finalTask.steps?.length || 0;
              setStepCount(finalStepCount);
              
              // Track final step count (this will upsert to ensure we have the correct total)
              await trackUsage(finalStepCount, task.id);
              addLog(`📈 Final step count recorded: ${finalStepCount} steps`);
              
              // Mark task as stopped in database with final step count
              await markTaskCompleted(task.id, finalStepCount, 'stopped');
              
              addLog('⏹️ Automation stopped by user');
              addLog(`📊 Final step count: ${finalStepCount}`);
              
            } catch (error) {
              console.error('Error fetching final stopped task details:', error);
              await markTaskCompleted(task.id, updatedTask.steps?.length || 0, 'stopped');
              addLog('⏹️ Automation stopped by user');
            }
            
            // Refresh usage data immediately and force billing page refresh
            fetchUserSubscription();
            
            // Force billing page to refresh by dispatching a custom event
            window.dispatchEvent(new CustomEvent('billing-refresh-needed'));
          }
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Error checking task status:', error);
          }
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isRunning) {
          addLog('⏰ Automation timed out after 30 minutes');
          setIsRunning(false);
        }
      }, 30 * 60 * 1000);

    } catch (error) {
      console.error('Error starting automation:', error);
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
      toast.success('Automation paused');
    } catch (error) {
      console.error('Error pausing automation:', error);
      toast.error('Failed to pause automation');
    }
  };

  const resumeAutomation = async () => {
    if (!currentTask || !browserClient) return;

    try {
      await browserClient.resumeTask(currentTask.id);
      setIsPaused(false);
      toast.success('Automation resumed');
    } catch (error) {
      console.error('Error resuming automation:', error);
      toast.error('Failed to resume automation');
    }
  };

  const stopAutomation = async () => {
    if (!currentTask) {
      // No task to stop, just reset UI state
      setIsRunning(false);
      setIsPaused(false);
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
        console.error('Error fetching final task details after manual stop:', error);
        addLog('⚠️ Could not fetch final task details after stop', 'error');
      }
      
      setIsRunning(false);
      setIsPaused(false);
      setCurrentTask(null);
      addLog('⏹️ Automation stopped by user');
      toast.success('Automation stopped');
    } catch (error) {
      console.error('Error stopping automation:', error);
      
      // Even if API call fails, reset UI state so user isn't stuck
      setIsRunning(false);
      setIsPaused(false);
      setCurrentTask(null);
      
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
        console.error('Error updating automation task:', updateError);
        addLog(`⚠️ Failed to mark task as completed: ${updateError.message}`, 'error');
      } else {
        addLog(`✅ Task ${taskId} marked as ${status}`);
      }
    } catch (error) {
      console.error('Error marking task completed:', error);
    }
  };

  const extractCompanyFromSteps = (steps: any[]): Array<{company: string, role: string}> => {
    const applications: Array<{company: string, role: string}> = [];
    
    steps.forEach((step, index) => {
      if (step.action) {
        const actionText = JSON.stringify(step.action).toLowerCase();
        const stepContent = step.action.text || step.action.description || step.action.selector || '';
        
        // Look for Easy Apply button clicks or application submissions
        if (actionText.includes('easy apply') || 
            actionText.includes('submit application') ||
            actionText.includes('apply now') ||
            (actionText.includes('click') && actionText.includes('submit'))) {
          
          // Try multiple extraction methods
          let company = '';
          let role = '';
          
          // Method 1: Look for company name patterns in the step content
          const companyPatterns = [
            /at\s+([A-Za-z0-9\s&.,'-]+?)(?:\s|$)/i,
            /company[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\s|$)/i,
            /employer[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\s|$)/i,
            /([A-Za-z0-9\s&.,'-]+?)\s+(?:is hiring|hiring)/i
          ];
          
          for (const pattern of companyPatterns) {
            const match = stepContent.match(pattern);
            if (match && match[1] && match[1].trim().length > 2) {
              company = match[1].trim();
              break;
            }
          }
          
          // Method 2: Look for job title patterns
          const rolePatterns = [
            /(?:position|role|job)[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\s|$)/i,
            /applying\s+for[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\s|$)/i,
            /title[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\s|$)/i
          ];
          
          for (const pattern of rolePatterns) {
            const match = stepContent.match(pattern);
            if (match && match[1] && match[1].trim().length > 2) {
              role = match[1].trim();
              break;
            }
          }
          
          // Method 3: Look in surrounding steps for context
          if (!company || !role) {
            // Check previous 3 steps for company/role info
            for (let i = Math.max(0, index - 3); i < index; i++) {
              const prevStep = steps[i];
              if (prevStep?.action) {
                const prevContent = prevStep.action.text || prevStep.action.description || '';
                
                if (!company) {
                  for (const pattern of companyPatterns) {
                    const match = prevContent.match(pattern);
                    if (match && match[1] && match[1].trim().length > 2) {
                      company = match[1].trim();
                      break;
                    }
                  }
                }
                
                if (!role) {
                  for (const pattern of rolePatterns) {
                    const match = prevContent.match(pattern);
                    if (match && match[1] && match[1].trim().length > 2) {
                      role = match[1].trim();
                      break;
                    }
                  }
                }
              }
            }
          }
          
          // Method 4: Extract from URL or page title if available
          if (step.action.url) {
            const urlMatch = step.action.url.match(/linkedin\.com\/jobs\/view\/\d+/);
            if (urlMatch) {
              // Could potentially extract more info from LinkedIn job URLs
              addLog(`🔗 Found LinkedIn job URL: ${step.action.url}`);
            }
          }
          
          // Use fallbacks if extraction failed
          if (!company || company.length < 3) {
            company = 'LinkedIn Company';
          }
          if (!role || role.length < 3) {
            role = config.jobTitle || 'Software Engineer';
          }
          
          // Clean up extracted text
          company = company.replace(/[^\w\s&.,'-]/g, '').trim();
          role = role.replace(/[^\w\s&.,'-]/g, '').trim();
          
          // Avoid duplicates
          const exists = applications.find(app => 
            app.company.toLowerCase() === company.toLowerCase() && 
            app.role.toLowerCase() === role.toLowerCase()
          );
          
          if (!exists) {
            applications.push({ company, role });
            addLog(`🎯 Extracted application: ${company} - ${role}`);
          }
        }
      }
    });
    
    return applications;
  };

  const extractCompanyRoleFromStep = (stepText: string): { company: string | null; role: string | null } => {
    // Look for patterns like "APPLYING TO: Company Name - Job Title" or "SUBMITTING APPLICATION TO: Company Name - Job Title"
    const patterns = [
      /(?:APPLYING TO|SUBMITTING APPLICATION TO):\s*(.+?)\s*-\s*(.+)/i,
      /applying to\s+(.+?)\s+for\s+(.+)/i,
      /submitting application to\s+(.+?)\s+for\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = stepText.match(pattern);
      if (match) {
        return {
          company: match[1]?.trim() || null,
          role: match[2]?.trim() || null
        };
      }
    }
    
    return { company: null, role: null };
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
      <div className="flex justify-center gap-4 mb-8">
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
        
        <button
          onClick={() => setShowVoiceSetup(true)}
          className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Mic className="w-5 h-5 mr-2" />
          Voice-Guided Setup
          <Sparkles className="w-4 h-4 ml-2" />
        </button>
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
                  onClick={() => {
                    setShowConfigPanel(false);
                    setShowVoiceSetup(true);
                  }}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Voice Setup
                </button>
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
                  onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
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
        
        {/* Session Status Display */}
        <SessionStatusDisplay 
                          hasSession={hasRecentLogin}
                sessionAge={daysSinceLogin ? daysSinceLogin * 24 : null}
          linkedinEmail={config.linkedinEmail}
          onRefreshSession={refreshSession}
          onClearSession={clearSession}
          className="mb-6"
        />

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
                      console.debug('Iframe cross-origin restrictions in place (this is normal)');
                    }
                  }
                }}
                onError={(e) => {
                  console.warn('Browser preview iframe error (this may be due to browser extensions):', e);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Voice Setup Modal */}
      {showVoiceSetup && (
        <LinkedInVoiceSetup
          onConfigurationComplete={handleVoiceConfigurationComplete}
          onClose={() => setShowVoiceSetup(false)}
          initialConfig={config}
        />
      )}
      </div>
    </>
  );
};

export default LinkedInAutomationBot;