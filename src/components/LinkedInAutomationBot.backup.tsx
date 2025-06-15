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
  Shield 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  
  // Get API key from environment variable with proper fallback
  const apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || import.meta.env.VITE_BROWSERUSE_API_KEY || '';
  
  const [config, setConfig] = useState<BrowserUseConfig>({
    apiKey: apiKey,
    linkedinEmail: '',
    linkedinPassword: '',
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
  }, [user]);

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

  const fetchUserSubscription = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setUserSubscription({
          subscription_status: 'active',
          price_id: 'price_1RYvf7QGabzJD80Bhd4V99CB' // Demo Pro plan
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

      console.log(`📊 Fetching usage from ${startDate} to ${endDate}`);

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

      console.log(`📈 Monthly usage: ${jobTokens} tokens (${totalTokens} steps), $${totalCost.toFixed(2)} cost`);
      
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
    
    if (priceId === 'price_1RYvocQGabzJD80BEVgRcdSa') {
      return 'Extreme Plan';
    }
    if (priceId === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
      return 'Pro Plus Plan';
    }
    if (priceId === 'price_1RYvf7QGabzJD80Bhd4V99CB') {
      return 'Pro Plan';
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
    
    if (priceId === 'price_1RYvocQGabzJD80BEVgRcdSa') {
      return 150; // Extreme Plan
    }
    if (priceId === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
      return 75; // Pro Plus Plan
    }
    if (priceId === 'price_1RYvf7QGabzJD80Bhd4V99CB') {
      return 50; // Pro Plan
    }
    
    // If subscription exists but price ID doesn't match, give basic tokens
    return userSubscription.subscription_status === 'active' ? 50 : 0;
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
    
    // Sort by most recent
    params.append('sortBy', 'DD');
    
    return `${baseUrl}?${params.toString()}`;
  };

  const trackUsage = async (steps: number, taskId: string) => {
    try {
      const jobTokens = Math.ceil(steps / 10);
      const costUsd = jobTokens * 0.01; // $0.01 per token
      
      if (isSupabaseConfigured() && user) {
        addLog(`💰 Used ${jobTokens} job token${jobTokens > 1 ? 's' : ''} (${steps} steps, $${costUsd.toFixed(2)})`);
        
        try {
          // Log to browser_use_logs table
          const { error: logError } = await supabase.from('browser_use_logs').insert({
            user_id: user.id,
            task_id: taskId,
            step_count: steps,
            cost_usd: costUsd,
            task_type: 'linkedin_auto_apply',
            campaign_id: null
          });

          if (logError) {
            console.error('Error saving to browser_use_logs:', logError);
            addLog(`⚠️ Browser use logging failed: ${logError.message}`, 'error');
          }

          // Also log to automation_tasks table for better tracking
          const { error: taskError } = await supabase.from('automation_tasks').insert({
            user_id: user.id,
            task_id: taskId,
            task_type: 'linkedin_auto_apply',
            status: 'running',
            step_count: steps,
            cost_usd: costUsd,
            started_at: new Date().toISOString()
          });

          if (taskError) {
            console.error('Error saving to automation_tasks:', taskError);
            // Don't log this error since it's not critical and might be a duplicate
          } else {
            addLog(`📊 Usage tracked: ${steps} steps, ${jobTokens} tokens, $${costUsd.toFixed(2)}`);
          }

          // Update the monthly usage immediately with the new tokens only
          setMonthlyUsage(prev => ({
            ...prev,
            tokens_used: prev.tokens_used + jobTokens,
            cost_usd: prev.cost_usd + costUsd
          }));

        } catch (dbError) {
          console.error('Error saving usage to database:', dbError);
          addLog(`⚠️ Usage tracking failed - data not saved`, 'error');
        }
      }
    } catch (error) {
      console.error('Error tracking usage:', error);
      addLog(`❌ Error tracking usage: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
  * If there's a country code dropdown, select: ${config.countryCode}
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
- Country Code: ${config.countryCode}
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
      const limit = getTokenLimit();
      if (limit === 0) {
        toast.error(`No tokens available. Current plan: ${getPlanName()}. Please upgrade your subscription.`);
        addLog(`❌ No tokens available. Current plan: ${getPlanName()}`, 'error');
      } else {
        toast.error(`Usage limit reached! You have used ${monthlyUsage.tokens_used}/${limit} job tokens this month.`);
        addLog(`❌ Cannot start automation: Monthly limit of ${limit} job tokens reached (${monthlyUsage.tokens_used} used)`, 'error');
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
              
              // Calculate total tokens used including the new tokens from this session
              const incrementalTokens = Math.ceil(newSteps / 10);
              const totalTokensUsed = monthlyUsage.tokens_used + incrementalTokens;
              const limit = getTokenLimit();
              
              if (totalTokensUsed >= limit) {
                clearInterval(pollInterval);
                setIsRunning(false);
                await stopTask(task.id);
                addLog(`🛑 Automation stopped: Monthly limit of ${limit} job tokens reached!`, 'error');
                toast.error('Automation stopped due to usage limit');
                return;
              } else if (totalTokensUsed >= limit * 0.9) {
                addLog(`⚠️ Warning: Approaching monthly limit (${totalTokensUsed}/${limit} tokens used)`);
              }
            }
            
            setStepCount(newStepCount);
            
            const applicationSteps = updatedTask.steps.filter(step => {
              if (!step.action) return false;
              
              const actionText = JSON.stringify(step.action).toLowerCase();
              return actionText.includes('submit application') || 
                     actionText.includes('easy apply') ||
                     (actionText.includes('click') && actionText.includes('submit'));
            });
            
            if (applicationSteps.length > appliedCount) {
              const newApplications = applicationSteps.length - appliedCount;
              for (let i = 0; i < newApplications; i++) {
                await saveJobApplication(
                  'LinkedIn Company',
                  config.jobTitle || 'Software Engineer',
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

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.05]"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Enhanced Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl mb-8 shadow-2xl shadow-blue-500/25 backdrop-blur-sm border border-white/20">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-wide">LinkedIn Auto Apply</span>
            <div className="ml-3 px-3 py-1 bg-white/20 rounded-full">
              <span className="text-white text-xs font-medium">PREMIUM</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 dark:from-white dark:via-blue-100 dark:to-purple-100 bg-clip-text text-transparent leading-tight">
              AI-Powered Job Applications
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
          </div>
          
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed font-light">
            Transform your job search with intelligent automation. Set your preferences and let our AI apply to 
            <span className="font-semibold text-blue-600 dark:text-blue-400"> relevant positions </span>
            while you focus on what matters most.
          </p>

          {/* Quick Stats */}
          <div className="flex items-center justify-center space-x-8 mt-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{monthlyUsage.tokens_used}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Applications This Month</div>
            </div>
            <div className="w-px h-12 bg-gray-300 dark:bg-gray-600"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{getPlanName()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Current Plan</div>
            </div>
            <div className="w-px h-12 bg-gray-300 dark:bg-gray-600"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{getTokenLimit() - monthlyUsage.tokens_used}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Remaining</div>
            </div>
          </div>
        </motion.div>

        {/* API Configuration Warning */}
        {!apiKey && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="premium-card p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-amber-800 dark:text-amber-200 mb-3">
                  Browser Use API Not Configured
                </h3>
                <p className="text-amber-700 dark:text-amber-300 mb-4 leading-relaxed">
                  To use the LinkedIn automation feature, you need to configure the Browser Use API key.
                </p>
                <div className="bg-amber-100 dark:bg-amber-900/40 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                    Required Environment Variables:
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• <code>VITE_BROWSER_USE_API_KEY</code> - Your Browser Use API key</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-10">
          {/* Left Column - Configuration & Controls */}
          <div className="xl:col-span-1 space-y-6">
            {/* LinkedIn Credentials Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card hover-lift border-0 shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
                <CardHeader className="pb-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-t-xl"></div>
                  <div className="relative flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/25 ring-4 ring-blue-500/10">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        LinkedIn Account
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300 text-base">
                        Your LinkedIn login credentials
                      </CardDescription>
                    </div>
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                      <span>Email Address</span>
                      <span className="ml-1 text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={config.linkedinEmail}
                      onChange={(e) => setConfig(prev => ({ ...prev, linkedinEmail: e.target.value }))}
                      placeholder="your.email@company.com"
                      className="h-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                      <span>Password</span>
                      <span className="ml-1 text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={config.linkedinPassword}
                      onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                      placeholder="••••••••••••"
                      className="h-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                        <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Secure & Encrypted</p>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Your credentials are encrypted and never stored permanently</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact & Resume Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="glass-card hover-lift">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">Contact & Resume</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Contact information and resume selection
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contact Number with Country Code */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Contact Number
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <Select value={config.countryCode} onValueChange={(value) => setConfig(prev => ({ ...prev, countryCode: value }))}>
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              <div className="flex items-center space-x-2">
                                <span>{country.flag}</span>
                                <span>{country.code}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="tel"
                        value={config.contactNumber}
                        onChange={(e) => setConfig(prev => ({ ...prev, contactNumber: e.target.value.replace(/[^0-9]/g, '') }))}
                        placeholder="Phone number"
                        className="premium-input col-span-3"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Select your country code and enter phone number without the country code
                    </p>
                  </div>

                  {/* LinkedIn Resume */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      LinkedIn Resume Name
                    </label>
                    <Input
                      type="text"
                      value={config.linkedinResume}
                      onChange={(e) => setConfig(prev => ({ ...prev, linkedinResume: e.target.value }))}
                      placeholder="e.g., 'Software Engineer Resume', 'Updated Resume 2024'"
                      className="premium-input"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Enter the exact name of your resume as saved on LinkedIn
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Job Search Preferences Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card hover-lift">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">Job Preferences</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Define your job search criteria
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Job Title / Keywords
                      </label>
                      <Input
                        type="text"
                        value={config.jobTitle}
                        onChange={(e) => setConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Software Engineer, Data Scientist, Product Manager..."
                        className="premium-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Location
                      </label>
                      <Input
                        type="text"
                        value={config.location}
                        onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="San Francisco, New York, Remote..."
                        className="premium-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Target Applications
                      </label>
                      <Input
                        type="number"
                        value={config.targetCount}
                        onChange={(e) => setConfig(prev => ({ ...prev, targetCount: e.target.value }))}
                        placeholder="10"
                        min="1"
                        max="50"
                        className="premium-input"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Advanced Filters Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="glass-card hover-lift">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Search className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">Advanced Filters</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Optional filters to refine your search
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Work Type
                      </label>
                      <Select value={config.workType} onValueChange={(value) => setConfig(prev => ({ ...prev, workType: value }))}>
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Any work type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="On-site">On-site</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Experience Level
                      </label>
                      <Select value={config.experienceLevel} onValueChange={(value) => setConfig(prev => ({ ...prev, experienceLevel: value }))}>
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Any experience level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="Internship">Internship</SelectItem>
                          <SelectItem value="Entry level">Entry level</SelectItem>
                          <SelectItem value="Associate">Associate</SelectItem>
                          <SelectItem value="Mid-Senior level">Mid-Senior level</SelectItem>
                          <SelectItem value="Director">Director</SelectItem>
                          <SelectItem value="Executive">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date Posted
                      </label>
                      <Select value={config.datePosted} onValueChange={(value) => setConfig(prev => ({ ...prev, datePosted: value }))}>
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Any time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any time</SelectItem>
                          <SelectItem value="r86400">Past 24 hours</SelectItem>
                          <SelectItem value="r604800">Past week</SelectItem>
                          <SelectItem value="r2592000">Past month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* AI Custom Instructions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="glass-card hover-lift">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">AI Instructions</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Customize the AI agent behavior
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Powered by GPT-4o</p>
                        <p>Our autonomous browser agent understands natural language and can adapt to your specific requirements.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Custom Instructions (Optional)
                    </label>
                    <textarea
                      value={config.customInstructions}
                      onChange={(e) => setConfig(prev => ({ ...prev, customInstructions: e.target.value }))}
                      placeholder="e.g., 'Focus on remote positions only', 'Skip jobs requiring security clearance', 'Prioritize startups over large corporations', 'Apply only to companies with 100+ employees'"
                      className="premium-input min-h-[100px] resize-none"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Provide specific guidance to help the AI make better decisions during applications
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Save Configuration Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button
                onClick={saveConfiguration}
                variant="outline"
                className="w-full h-12 text-base font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <Settings className="w-5 h-5 mr-2" />
                Save Configuration
              </Button>
            </motion.div>

            {/* Usage & Plan Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="glass-card hover-lift">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">Usage & Plan</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        {getPlanName()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Job Tokens</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {monthlyUsage.tokens_used}/{getTokenLimit()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min((monthlyUsage.tokens_used / getTokenLimit()) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {getTokenLimit() - monthlyUsage.tokens_used} tokens remaining this month
                    </div>
                  </div>

                  {!canStartAutomation() && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Usage limit reached
                        </span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Upgrade your plan to continue using automation features.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Dashboard & Live Preview */}
          <div className="xl:col-span-2 space-y-6">
            {/* Control Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="premium-card border-0 shadow-2xl bg-gradient-to-br from-white/95 to-gray-50/95 dark:from-gray-800/95 dark:to-gray-900/95">
                <CardHeader className="pb-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="card-icon bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 ring-emerald-500/10 shadow-emerald-500/25">
                          <Activity className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            Automation Control
                          </CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-300 text-lg">
                            Monitor and control your LinkedIn automation
                          </CardDescription>
                        </div>
                      </div>
                      {currentTask?.live_url && (
                        <Button
                          asChild
                          variant="outline"
                          size="lg"
                          className="bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm border-2 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200"
                        >
                          <a href={currentTask.live_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-5 h-5 mr-2" />
                            Live View
                          </a>
                        </Button>
                      )}
                    </div>
                    
                    {/* Enhanced Status Badge */}
                    {currentTask && (
                      <div className="flex items-center space-x-3">
                        <div className={`status-indicator ${
                          currentTask.status === 'running' ? 'status-running' : 
                          currentTask.status === 'finished' ? 'status-finished' : 
                          currentTask.status === 'failed' ? 'status-failed' : 'status-paused'
                        }`}>
                          {isRunning && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                          {!isRunning && currentTask.status === 'running' && <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>}
                          <span className="capitalize font-semibold">{currentTask.status}</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">
                          ID: {currentTask.id.slice(0, 8)}...
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stepCount}</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Steps</div>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{Math.ceil(stepCount / 10)}</div>
                      <div className="text-sm text-purple-600 dark:text-purple-400">Tokens</div>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between mb-2">
                        <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{appliedCount}</div>
                      <div className="text-sm text-emerald-600 dark:text-emerald-400">Applied</div>
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {appliedCount > 0 ? Math.round((appliedCount / Math.max(stepCount, 1)) * 100) : 0}%
                      </div>
                      <div className="text-sm text-orange-600 dark:text-orange-400">Success</div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {!isRunning ? (
                      <Button
                        onClick={startAutomation}
                        disabled={!canStartAutomation() || !apiKey}
                        className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start Auto Apply
                      </Button>
                    ) : (
                      <>
                        {!isPaused ? (
                          <Button
                            onClick={pauseAutomation}
                            variant="outline"
                            className="flex-1 h-14 text-lg font-bold"
                          >
                            <Pause className="w-5 h-5 mr-2" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            onClick={resumeAutomation}
                            className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            Resume
                          </Button>
                        )}
                        <Button
                          onClick={stopAutomation}
                          variant="destructive"
                          className="flex-1 h-14 text-lg font-bold"
                        >
                          <Square className="w-5 h-5 mr-2" />
                          Stop
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Status Display */}
                  {currentTask && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                        <Badge 
                          variant={
                            currentTask.status === 'running' ? 'default' : 
                            currentTask.status === 'finished' ? 'success' : 
                            currentTask.status === 'failed' ? 'destructive' : 'outline'
                          }
                          className="capitalize"
                        >
                          {isRunning && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {currentTask.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        Task ID: {currentTask.id}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Browser Preview Card */}
            {currentTask?.live_url && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="glass-card hover-lift">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl text-gray-900 dark:text-white">Live Browser Preview</CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-300">
                            Watch your automation in real-time
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                        >
                          <a href={currentTask.live_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Full Screen
                          </a>
                        </Button>
                        <Button
                          onClick={() => {
                            const iframe = document.getElementById('browser-preview-iframe') as HTMLIFrameElement;
                            if (iframe) {
                              iframe.src = iframe.src; // Refresh iframe
                            }
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Globe className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-96">
                                {currentTask.live_url}
                              </span>
                            </div>
                          </div>
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
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Activity className="w-4 h-4 text-blue-500" />
                              <span className="text-gray-600 dark:text-gray-400">
                                Status: <span className="font-medium text-gray-900 dark:text-white capitalize">{currentTask.status}</span>
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-purple-500" />
                              <span className="text-gray-600 dark:text-gray-400">
                                Steps: <span className="font-medium text-gray-900 dark:text-white">{stepCount}</span>
                              </span>
                            </div>
                          </div>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            <a href={currentTask.live_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Open in new tab
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkedInAutomationBot;