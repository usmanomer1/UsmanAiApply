import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  User, 
  Briefcase, 
  Search, 
  TrendingUp, 
  BarChart3, 
  Shield, 
  Zap, 
  Activity, 
  Crown, 
  Sparkles, 
  ChevronRight, 
  Globe,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Lock,
  Unlock,
  Target,
  Calendar,
  MapPin,
  Building,
  DollarSign,
  Clock,
  ArrowRight,
  Info,
  RefreshCw
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
  status: 'pending' | 'running' | 'paused' | 'finished' | 'failed' | 'stopped';
  live_url?: string;
  steps?: any[];
  output?: string;
  error?: string;
}

interface BrowserUseConfig {
  apiKey: string;
  linkedinEmail: string;
  linkedinPassword: string;
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

const BROWSER_USE_API_BASE = import.meta.env.VITE_BROWSER_USE_API_URL || 'https://api.browseruse.cloud/v1';

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
  const [jobTokensUsed, setJobTokensUsed] = useState(0);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [monthlyUsage, setMonthlyUsage] = useState({ tokens_used: 0, ai_requests_used: 0 });
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
        setMonthlyUsage({ tokens_used: 15, ai_requests_used: 5 });
        return;
      }

      const { data: subscription, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .single();

      setUserSubscription(subscription);

      // Fetch current month usage
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const startDate = firstDayOfMonth.toISOString().split('T')[0];
      const endDate = lastDayOfMonth.toISOString().split('T')[0];

      const { data: usageData, error: usageError } = await supabase
        .from('browser_use_logs')
        .select('step_count')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      const totalTokens = usageData?.reduce((sum, log) => sum + Math.ceil((log.step_count || 0) / 10), 0) || 0;
      setMonthlyUsage(prev => ({ ...prev, tokens_used: totalTokens }));
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const getPlanName = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 'Free Plan';
    }
    
    const priceId = userSubscription.price_id || '';
    
    if (priceId === 'price_1RYvocQGabzJD80BEVgRcdSa') {
      return 'Extreme Plan';
    }
    if (priceId === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
      return 'Pro Plus Plan';
    }
    if (priceId === 'price_1RYvf7QGabzJD80Bhd4V99CB') {
      return 'Pro Plan';
    }
    
    return 'Free Plan';
  };

  const getTokenLimit = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 0;
    }
    
    const priceId = userSubscription.price_id || '';
    
    if (priceId === 'price_1RYvocQGabzJD80BEVgRcdSa') {
      return 150;
    }
    if (priceId === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
      return 75;
    }
    if (priceId === 'price_1RYvf7QGabzJD80Bhd4V99CB') {
      return 50;
    }
    
    return 0;
  };

  const canStartAutomation = () => {
    const limit = getTokenLimit();
    if (limit === 0) {
      return false;
    }
    
    const estimatedTokensNeeded = 5;
    return monthlyUsage.tokens_used + estimatedTokensNeeded <= limit;
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
      
      if (isSupabaseConfigured() && user) {
        addLog(`💰 Used ${jobTokens} job token${jobTokens > 1 ? 's' : ''} (${steps} steps)`);
        
        try {
          await supabase.from('browser_use_logs').insert({
            user_id: user.id,
            task_id: taskId,
            step_count: steps,
            cost_usd: jobTokens * 0.01,
            task_type: 'linkedin_auto_apply',
            campaign_id: null
          });
          
          addLog(`📊 Usage tracked: ${steps} steps, ${jobTokens} tokens`);
        } catch (dbError) {
          console.error('Error saving usage to database:', dbError);
          addLog(`⚠️ Usage tracking failed - data not saved`, 'error');
        }
      }
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  };

  const saveJobApplication = async (company: string, role: string, taskId: string) => {
    try {
      if (!isSupabaseConfigured() || !user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data: campaign } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('job_title', config.jobTitle || 'LinkedIn Auto Apply')
        .eq('location', config.location || 'Remote')
        .maybeSingle();

      let campaignId = campaign?.id;

      if (!campaignId) {
        const { data: newCampaign } = await supabase
          .from('job_campaigns')
          .insert({
            profile_id: profile.id,
            job_title: config.jobTitle || 'LinkedIn Auto Apply',
            location: config.location || 'Remote',
            experience_level: config.experience || '',
            work_type: config.remotePreference || ''
          })
          .select('id')
          .single();

        campaignId = newCampaign?.id;
      }

      if (campaignId) {
        await supabase.from('applications').insert({
          campaign_id: campaignId,
          company: company,
          role: role,
          status: 'SENT',
          applied_at: new Date().toISOString(),
          details: {
            automated: true,
            job_title: config.jobTitle,
            location: config.location
          }
        });

        addLog(`📝 Application saved: ${company} - ${role}`);
      }
    } catch (error) {
      console.error('Error saving job application:', error);
      addLog(`⚠️ Failed to save application to database`, 'error');
    }
  };

  const createLinkedInTask = async () => {
    const linkedinUrl = buildLinkedInJobsURL();
    
    const taskData = {
      url: linkedinUrl,
      task: `You are an AI assistant helping with LinkedIn job applications. Your goal is to apply to jobs using LinkedIn's "Easy Apply" feature.

CRITICAL SCROLLING INSTRUCTIONS:
- ALWAYS scroll down when you can't find buttons like "Submit", "Next", "Continue", or "Apply"
- LinkedIn forms often have content below the fold - scroll to reveal hidden elements
- If you encounter form questions but can't see all of them, scroll down to see more questions
- When stuck on any form, try scrolling both up and down to find missing elements
- Easy Apply modals often require scrolling to see the submit button

STEP-BY-STEP PROCESS:
1. First, log into LinkedIn using the provided credentials
2. Navigate to the job search URL: ${linkedinUrl}
3. Look for jobs with "Easy Apply" buttons
4. For each job with Easy Apply:
   a. Click the "Easy Apply" button
   b. Fill out the application form (scroll down if you can't see all fields)
   c. Answer any questions that appear (scroll to see all questions)
   d. Upload resume if prompted (use existing resume if available)
   e. SCROLL DOWN to find the "Submit" or "Submit application" button
   f. Click submit to complete the application
   g. Close the modal and move to the next job

FORM HANDLING GUIDELINES:
- Always scroll down in Easy Apply forms to ensure you see all content
- If you can't find a "Submit" button, scroll down - it's usually below the visible area
- For multi-step forms, look for "Next" or "Continue" buttons (may require scrolling)
- If forms have multiple questions, scroll to see all questions before proceeding
- Handle file uploads by using any existing resume/CV files
- Skip optional fields if they're complex, but fill required fields
- If a form seems stuck, try scrolling up and down to find missing elements

IMPORTANT SCROLLING BEHAVIORS:
- Scroll slowly and check for new elements after each scroll
- Pay special attention to modal dialogs - they often have scrollable content
- If you encounter a form that won't submit, scroll down to find the submit button
- LinkedIn's Easy Apply forms frequently hide submit buttons below the initial view
- When in doubt, scroll down - most issues are resolved by scrolling

CREDENTIALS:
- Email: ${config.linkedinEmail}
- Password: ${config.linkedinPassword}

Apply to as many relevant jobs as possible using Easy Apply. Focus on jobs that match the search criteria and have the Easy Apply option available.`,
      
      session_id: null,
      model: 'claude-3-5-sonnet-20241022',
      max_steps: parseInt(config.targetCount || '10') * 5
    };

    // Validate API key before making request
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Browser Use API key is not configured. Please check your environment variables.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${BROWSER_USE_API_BASE}/tasks`, {
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

      return await response.json();
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
      const response = await fetch(`${BROWSER_USE_API_BASE}/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          id: taskId,
          status: data.status,
          live_url: data.live_url,
          steps: data.steps,
          output: data.output,
          error: data.error
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
      const response = await fetch(`${BROWSER_USE_API_BASE}/stop-task?task_id=${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to stop task: ${response.statusText}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
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

    if (!apiKey || apiKey.trim() === '') {
      toast.error('Browser Use API key is not configured. Please check your environment variables.');
      addLog('❌ API key missing: VITE_BROWSER_USE_API_KEY not found in environment variables', 'error');
      return;
    }

    if (!canStartAutomation()) {
      const limit = getTokenLimit();
      toast.error(`Usage limit reached! You have used ${monthlyUsage.tokens_used}/${limit} job tokens this month.`);
      addLog(`❌ Cannot start automation: Monthly limit of ${limit} job tokens reached (${monthlyUsage.tokens_used} used)`, 'error');
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    setLogs([]);
    setStepCount(0);
    setAppliedCount(0);
    setJobTokensUsed(0);

    try {
      addLog('🚀 Starting LinkedIn job application automation...');
      addLog(`🔗 API Endpoint: ${BROWSER_USE_API_BASE}`);
      addLog(`🔑 API Key configured: ${apiKey.substring(0, 10)}...`);
      
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
              await trackUsage(newStepCount, task.id);
              const currentTokens = Math.ceil(newStepCount / 10);
              setJobTokensUsed(currentTokens);
              
              const totalTokensUsed = monthlyUsage.tokens_used + currentTokens;
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
            addLog('✅ Automation completed successfully!', 'success');
            
            if (updatedTask.output) {
              addLog(`📊 Final Results: ${updatedTask.output}`);
            }
          } else if (updatedTask.status === 'failed') {
            clearInterval(pollInterval);
            setIsRunning(false);
            addLog(`❌ Automation failed: ${updatedTask.error || 'Unknown error'}`, 'error');
          } else if (updatedTask.status === 'stopped') {
            clearInterval(pollInterval);
            setIsRunning(false);
            addLog('⏹️ Automation stopped by user');
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

      const response = await fetch(`${BROWSER_USE_API_BASE}/pause-task`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ task_id: currentTask.id }),
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

      const response = await fetch(`${BROWSER_USE_API_BASE}/resume-task`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ task_id: currentTask.id }),
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
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-6 shadow-lg">
          <Bot className="w-5 h-5 text-white mr-2" />
          <span className="text-white font-semibold">LinkedIn Auto Apply</span>
        </div>
        
        <h1 className="text-display-lg text-gray-900 dark:text-white mb-6">
          AI-Powered Job Applications
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Automate your LinkedIn job applications with AI. Set your preferences and let our bot apply to relevant positions using Easy Apply.
        </p>
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column - Configuration & Controls */}
        <div className="xl:col-span-1 space-y-6">
          {/* Configuration Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white">Configuration</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Set up your automation preferences
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* LinkedIn Credentials */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    LinkedIn Credentials
                  </h3>
                  <div className="space-y-3">
                    <Input
                      type="email"
                      value={config.linkedinEmail}
                      onChange={(e) => setConfig(prev => ({ ...prev, linkedinEmail: e.target.value }))}
                      placeholder="LinkedIn Email"
                      className="premium-input"
                    />
                    <Input
                      type="password"
                      value={config.linkedinPassword}
                      onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                      placeholder="LinkedIn Password"
                      className="premium-input"
                    />
                  </div>
                </div>

                {/* Job Search Criteria */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Job Search
                  </h3>
                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={config.jobTitle}
                      onChange={(e) => setConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                      placeholder="Job Title"
                      className="premium-input"
                    />
                    <Input
                      type="text"
                      value={config.location}
                      onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Location"
                      className="premium-input"
                    />
                    <Input
                      type="number"
                      value={config.targetCount}
                      onChange={(e) => setConfig(prev => ({ ...prev, targetCount: e.target.value }))}
                      placeholder="Target Applications"
                      min="1"
                      max="50"
                      className="premium-input"
                    />
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                    <Search className="w-4 h-4 mr-2" />
                    Filters (Optional)
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <Select value={config.workType} onValueChange={(value) => setConfig(prev => ({ ...prev, workType: value }))}>
                      <SelectTrigger className="premium-select">
                        <SelectValue placeholder="Work Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="Remote">Remote</SelectItem>
                        <SelectItem value="On-site">On-site</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={config.experienceLevel} onValueChange={(value) => setConfig(prev => ({ ...prev, experienceLevel: value }))}>
                      <SelectTrigger className="premium-select">
                        <SelectValue placeholder="Experience Level" />
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

                    <Select value={config.datePosted} onValueChange={(value) => setConfig(prev => ({ ...prev, datePosted: value }))}>
                      <SelectTrigger className="premium-select">
                        <SelectValue placeholder="Date Posted" />
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

                <Button
                  onClick={saveConfiguration}
                  variant="outline"
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Usage & Plan Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white">Usage & Plan</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      {getPlanName()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Job Tokens</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {monthlyUsage.tokens_used + jobTokensUsed}/{getTokenLimit()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-600 h-3 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(((monthlyUsage.tokens_used + jobTokensUsed) / getTokenLimit()) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {getTokenLimit() - (monthlyUsage.tokens_used + jobTokensUsed)} tokens remaining this month
                  </div>
                </div>

                {!canStartAutomation() && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Usage limit reached
                      </span>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
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
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-900 dark:text-white">Automation Control</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Monitor and control your LinkedIn automation
                      </CardDescription>
                    </div>
                  </div>
                  {currentTask?.live_url && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                    >
                      <a href={currentTask.live_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Live View
                      </a>
                    </Button>
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
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{jobTokensUsed}</div>
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

          {/* Activity Log */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white">Activity Log</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Real-time automation monitoring
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-6 h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 mb-2">Monitoring Ready</p>
                      <p className="text-sm text-gray-500">
                        Start automation to see real-time activity logs
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start space-x-3 text-sm"
                        >
                          <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0" />
                          <span className="text-emerald-300 font-mono leading-relaxed">
                            {log}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LinkedInAutomationBot;