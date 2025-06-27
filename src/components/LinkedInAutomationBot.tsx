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
  linkedinPassword: string;
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
    linkedinPassword: '',
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
  }, [user]);

  // Check access on component mount
  const checkAccess = async () => {
    if (!isAuthenticated) {
      setShowPaywall(true);
      setAccessCheckComplete(true);
      return;
    }

    try {
      const accessResult = await checkFeatureAccess('auto_apply');
      if (!accessResult.hasAccess) {
        setShowPaywall(true);
      }
    } catch (error) {
      console.error('Error checking auto apply access:', error);
      setShowPaywall(true);
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
        toast.error('Failed to load configuration');
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
      // Don't save credentials in the config
      const { linkedinEmail, linkedinPassword, ...configToSave } = config;
      
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
        setUserSubscription({
          subscription_status: 'active',
          price_id: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || null // Demo Pro plan
        });
        setMonthlyUsage({ tokens_used: 15, ai_requests_used: 5, cost_usd: 0.15 });
        return;
      }

      // Fetch subscription using the same table as Navbar (stripe_user_subscriptions)
      const { data: subscription, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        setUserSubscription({ subscription_status: 'inactive', price_id: null });
      } else if (subscription && subscription.subscription_status === 'active') {
        setUserSubscription(subscription);
      } else {
        setUserSubscription({ subscription_status: 'inactive', price_id: null });
      }

      // Fetch current month usage with proper timezone handling
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const startDate = firstDayOfMonth.toISOString();
      const endDate = nextMonth.toISOString();

      

      const { data: usageData, error: usageError } = await supabase
        .from('browser_use_logs')
        .select('step_count, cost_usd, created_at')
        .eq('user_id', user.id)
        .eq('task_type', 'linkedin_auto_apply')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false });

      if (usageError) {
        console.error('Error fetching usage data:', usageError);
        console.warn(`⚠️ Error fetching usage data: ${usageError.message}`);
      }

      const totalTokens = usageData?.reduce((sum, log) => {
        return sum + (log.step_count || 0);
      }, 0) || 0;
      
      const jobTokens = Math.ceil(totalTokens / 10);

      const totalCost = usageData?.reduce((sum, log) => sum + (log.cost_usd || 0), 0) || 0;

      
      
      setMonthlyUsage({ 
        tokens_used: jobTokens, 
        ai_requests_used: usageData?.length || 0,
        cost_usd: totalCost
      });

    } catch (error) {
      console.error('Error fetching subscription:', error);
              console.error(`❌ Error fetching subscription data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const getTokenLimit = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 0; // Free plan gets 0 tokens
    }
    
    // Use the price_id directly from the subscription
    const priceId = userSubscription.price_id;
    
    if (priceId === import.meta.env.VITE_STRIPE_MAX_PRICE_ID) {
      return 158; // Max Plan - 158 applications
    }
    if (priceId === import.meta.env.VITE_STRIPE_PRO_PRICE_ID) {
      return 77; // Pro Plan - 77 applications
    }
    if (priceId === import.meta.env.VITE_STRIPE_PLUS_PRICE_ID) {
      return 37; // Plus Plan - 37 applications
    }
    
    // If subscription exists but price ID doesn't match, give basic tokens
    return userSubscription.subscription_status === 'active' ? 37 : 0;
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

  const trackUsage = async (steps: number, taskId: string) => {
    if (!user) {
      addLog('❌ User not authenticated - cannot track usage', 'error');
      return;
    }

    try {
      const costPerStep = 0.03; // $0.03 per step
      const initializationCost = 0.01; // $0.01 initialization cost
      const costUsd = (steps * costPerStep) + initializationCost;
      
      // 🔒 SECURE SERVER-SIDE USAGE RECORDING WITH VALIDATION
      const { subscriptionService } = await import('../lib/subscriptionService');
      const result = await subscriptionService.recordSecureFeatureUsage(
        user.id,
        'auto_apply',
        steps,
        costUsd,
        {
          task_id: taskId,
          task_type: 'linkedin_auto_apply',
          target_location: config.location,
          target_role: config.jobTitle,
          session_timestamp: new Date().toISOString()
        }
      );

      if (!result.success) {
        console.error('Server-side usage recording failed:', result.error);
        addLog(`❌ Usage validation failed: ${result.error}`, 'error');
        
        // If server-side validation fails, stop automation for security
        if (result.error?.includes('Access denied') || result.error?.includes('limit exceeded')) {
          addLog('🛑 Stopping automation due to usage limit violation', 'error');
          await stopAutomation();
          toast.error('Automation stopped: Usage limit validation failed');
          return;
        }
      } else {
        addLog(`✅ Usage validated & recorded: ${steps} steps ($${costUsd.toFixed(3)})`, 'success');
      }

      // Update local state for immediate UI feedback
      setMonthlyUsage(prev => ({
        ...prev,
        tokens_used: prev.tokens_used + steps,
        cost_usd: prev.cost_usd + costUsd
      }));
      
    } catch (error) {
      console.error('Critical error in usage tracking:', error);
      addLog('🛑 Critical usage tracking error - stopping automation', 'error');
      await stopAutomation();
      toast.error('Automation stopped due to usage tracking failure');
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
    const linkedinUrl = buildLinkedInJobsURL();
    const fullContactNumber = `${config.countryCode}${config.contactNumber}`;
    
    const taskData = {
      task: `You are an AI assistant helping with LinkedIn job applications. Your goal is to apply to jobs using LinkedIn's "Easy Apply" feature.

CRITICAL SCROLLING INSTRUCTIONS:
- ALWAYS scroll down when you can't find buttons like "Submit", "Next", "Continue", or "Apply"
- LinkedIn forms often have content below the fold - scroll to reveal hidden elements
- If you encounter form questions but can't see all of them, scroll down to see more questions
- When stuck on any form, try scrolling both up and down to find missing elements
- Easy Apply modals often require scrolling to see the submit button

STEP-BY-STEP PROCESS:
1. First, go to LinkedIn.com and log in using the provided credentials
2. Navigate to the job search URL: ${linkedinUrl}
3. Look for jobs with "Easy Apply" buttons
4. For each job with Easy Apply:
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
- Handle file uploads by using any existing resume/CV files${config.linkedinResume ? ` - specifically look for: "${config.linkedinResume}"` : ''}
- Skip optional fields if they're complex, but fill required fields
- If a form seems stuck, try scrolling up and down to find missing elements
- When filling contact information:
  * If there's a country code dropdown, select: ${config.countryCode.split('-')[0]}
  * For the phone number field, use ONLY the number WITHOUT country code: ${config.contactNumber}
  * Do NOT add the country code to the phone number field if you already selected it in a dropdown

IMPORTANT SCROLLING BEHAVIORS:
- Scroll slowly and check for new elements after each scroll
- Pay special attention to modal dialogs - they often have scrollable content
- If you encounter a form that won't submit, scroll down to find the submit button
- LinkedIn's Easy Apply forms frequently hide submit buttons below the initial view
- When in doubt, scroll down - most issues are resolved by scrolling

CREDENTIALS:
- Email: ${config.linkedinEmail}
- Password: ${config.linkedinPassword}
- Country Code: ${config.countryCode.split('-')[0]}
- Phone Number (without country code): ${config.contactNumber}
- Resume to Use: ${config.linkedinResume || 'Most recent available'}

${config.customInstructions ? `
CUSTOM INSTRUCTIONS:
${config.customInstructions}
` : ''}

CRITICAL: For every application, you MUST clearly announce both BEFORE clicking Easy Apply and BEFORE submitting:
"APPLYING TO: [EXACT COMPANY NAME] - [EXACT JOB TITLE]"

This helps track which companies you applied to. Use the exact company names and job titles from the LinkedIn job postings.`
    };

    // Validate API key before making request
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Browser Use API key is not configured. Please check your environment variables.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${BROWSER_USE_API_BASE}/run-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify(taskData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      // Ensure we capture the live_url from the response
      return {
        id: result.id,
        live_url: result.live_url,
        status: result.status || 'created',
        steps: result.steps || [],
        output: result.output,
        error: result.error
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your internet connection and try again.');
        } else if (error.message.includes('Failed to fetch')) {
          throw new Error(`Unable to connect to Browser Use API at ${BROWSER_USE_API_BASE}. Please check:\n• Internet connection\n• API key configuration\n• Firewall/network settings`);
        }
      }
      
      throw error;
    }
  };

  const getTaskStatus = async (taskId: string): Promise<TaskStatus> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${BROWSER_USE_API_BASE}/task/${taskId}/status`, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const status = await response.json();
        
        // Get full task details if needed
        const taskResponse = await fetch(`${BROWSER_USE_API_BASE}/task/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
        });
        
        const data = taskResponse.ok ? await taskResponse.json() : {};
        
        return {
          id: taskId,
          status: status,
          steps: data.steps || [],
          output: data.output,
          error: data.error,
          live_url: data.live_url
        };
      }
      
      throw new Error(`Failed to get task status: ${response.statusText}`);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const stopTask = async (taskId: string): Promise<void> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      addLog(`🛑 Stopping task: ${taskId}`);
      
      const response = await fetch(`${BROWSER_USE_API_BASE}/stop-task?task_id=${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        addLog(`✅ Task stopped successfully: ${taskId}`, 'success');
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to stop task (${response.status}): ${errorText}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
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
      // Server-side access validation with estimated usage
      const accessResult = await checkFeatureAccess('auto_apply');
      if (!accessResult.hasAccess) {
        addLog(`❌ Access denied: ${accessResult.reason}`, 'error');
        toast.error('Access denied - subscription validation failed');
        setShowPaywall(true);
        return;
      }

      addLog(`✅ Access validated - automation authorized for current subscription`, 'success');
    } catch (error) {
      console.error('Security validation failed:', error);
      addLog('❌ Security validation failed', 'error');
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

    if (!config.linkedinEmail.trim() || !config.linkedinPassword.trim()) {
      toast.error('Please enter your LinkedIn email and password to begin automation');
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
              // Only track the NEW steps since last update
              const newSteps = newStepCount - stepCount;
              await trackUsage(newSteps, task.id);
              
              // Calculate total steps used including the new steps from this session
              const totalStepsUsed = monthlyUsage.tokens_used + newSteps;
              const limit = getTokenLimit() * 10; // Convert token limit to step limit (1 token = 10 steps originally)
              
              if (totalStepsUsed >= limit) {
                clearInterval(pollInterval);
                setIsRunning(false);
                await stopTask(task.id);
                addLog(`🛑 Automation stopped: Monthly limit of ${limit} steps reached!`, 'error');
                toast.error('Automation stopped due to usage limit');
                return;
              } else if (totalStepsUsed >= limit * 0.9) {
                addLog(`⚠️ Warning: Approaching monthly limit (${totalStepsUsed}/${limit} steps used)`);
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
            
            // Mark task as completed in database
            await markTaskCompleted(task.id, updatedTask.steps?.length || 0, 'finished');
            
            // Try to extract company names from the final steps
            if (updatedTask.steps && updatedTask.steps.length > 0) {
                              const applications = extractCompanyFromSteps(updatedTask.steps);
                applications.forEach(app => {
                  saveJobApplication(app.company, app.role, task.id);
                });
            }
            
            addLog('✅ Automation completed successfully!', 'success');
            
            if (updatedTask.output) {
              addLog(`📊 Final Results: ${updatedTask.output}`);
            }
            
            // Refresh usage data
            fetchUserSubscription();
          } else if (updatedTask.status === 'failed') {
            clearInterval(pollInterval);
            setIsRunning(false);
            
            // Mark task as failed in database
            await markTaskCompleted(task.id, updatedTask.steps?.length || 0, 'failed', updatedTask.error);
            
            addLog(`❌ Automation failed: ${updatedTask.error || 'Unknown error'}`, 'error');
            
            // Refresh usage data
            fetchUserSubscription();
          } else if (updatedTask.status === 'stopped') {
            clearInterval(pollInterval);
            setIsRunning(false);
            
            // Mark task as stopped in database
            await markTaskCompleted(task.id, updatedTask.steps?.length || 0, 'stopped');
            
            addLog('⏹️ Automation stopped by user');
            
            // Refresh usage data
            fetchUserSubscription();
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
    if (!currentTask) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${BROWSER_USE_API_BASE}/pause-task?task_id=${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsPaused(true);
        toast.success('Automation paused');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error pausing automation:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out while pausing automation');
      } else {
        toast.error('Failed to pause automation');
      }
    }
  };

  const resumeAutomation = async () => {
    if (!currentTask) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${BROWSER_USE_API_BASE}/resume-task?task_id=${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsPaused(false);
        toast.success('Automation resumed');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error resuming automation:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out while resuming automation');
      } else {
        toast.error('Failed to resume automation');
      }
    }
  };

  const stopAutomation = async () => {
    if (!currentTask) return;

    try {
      await stopTask(currentTask.id);
      setIsRunning(false);
      setIsPaused(false);
      setCurrentTask(null);
      addLog('⏹️ Automation stopped by user');
      toast.success('Automation stopped');
    } catch (error) {
      console.error('Error stopping automation:', error);
      toast.error('Failed to stop automation');
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
                  Email Address *
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
                  Password *
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 border border-white/20 dark:border-gray-600/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/60 transition-all duration-200"
                  placeholder="••••••••••••"
                  value={config.linkedinPassword}
                  onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                />
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
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
                loading="lazy"
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