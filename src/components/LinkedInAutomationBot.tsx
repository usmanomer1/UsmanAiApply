import React, { useState, useEffect } from 'react';
import { Play, Square, Loader2, ExternalLink, Settings, UserCheck, Briefcase, Search, Info, TrendingUp, BarChart3, Shield, Zap, Bot, Activity, MonitorSpeaker, Terminal, Crown, Sparkles, ChevronRight, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

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
}

const BROWSER_USE_API_BASE = 'https://api.browser-use.com/api/v1';

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
  // Get API key from environment variable
  const apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || 'bu_FDJNzVlrXwmALvfa4Ntn_xMkrFFMrE_tXOQ2XPFOgp8';
  
  const [config, setConfig] = useState<BrowserUseConfig>({
    apiKey: apiKey,
    linkedinEmail: '',
    linkedinPassword: '',
    jobTitle: 'Software Engineer',
    location: 'San Francisco Bay Area',
    locationId: '90000084', // San Francisco Bay Area ID
    experience: 'Mid-Senior level',
    remotePreference: 'Remote'
  });
  
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stepCount, setStepCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [jobTokensUsed, setJobTokensUsed] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [monthlyUsage, setMonthlyUsage] = useState({ tokens_used: 0, ai_requests_used: 0 });

  // Fetch user subscription on mount
  useEffect(() => {
    fetchUserSubscription();
  }, []);

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

  const trackUsage = async (steps: number, taskId: string) => {
    try {
      // Convert steps to job tokens (10 steps = 1 token)
      const jobTokens = Math.ceil(steps / 10);
      
      // Track usage in Supabase if configured
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        addLog(`💰 Used ${jobTokens} job token${jobTokens > 1 ? 's' : ''} (${steps} steps)`);
        
        // Track usage in database for real analytics
        try {
          await supabase.from('browser_use_logs').insert({
            user_id: user.id,
            task_id: taskId,
            step_count: steps,
            cost_usd: jobTokens * 0.01, // $0.01 per token
            task_type: 'linkedin_auto_apply',
            campaign_id: null // Will be set when we have campaign context
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's profile to link the application
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Create a campaign entry first (or get existing one)
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
            company_size: '',
            experience_level: config.experience || '',
            work_type: config.remotePreference || '',
            status: 'ACTIVE'
          })
          .select('id')
          .single();

        campaignId = newCampaign?.id;
      }

      if (campaignId) {
        // Save the job application
        await supabase.from('applications').insert({
          campaign_id: campaignId,
          company: company,
          role: role,
          status: 'SENT',
          applied_at: new Date().toISOString(),
          automation_task_id: taskId,
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

  const fetchUserSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Fetching subscription for user:', user.id);

      // Fetch user subscription
      const { data: subscription, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .single();

      console.log('Subscription data:', subscription);
      console.log('Subscription error:', subError);

      setUserSubscription(subscription);

      // Fetch current month usage - only query existing columns
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // Format dates as YYYY-MM-DD
      const startDate = firstDayOfMonth.toISOString().split('T')[0];
      const endDate = lastDayOfMonth.toISOString().split('T')[0];

      const { data: usageData, error: usageError } = await supabase
        .from('browser_use_logs')
        .select('step_count')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      console.log('Usage data:', usageData);
      console.log('Usage error:', usageError);

      // Calculate job tokens from step_count (10 steps = 1 token)
      const totalTokens = usageData?.reduce((sum, log) => sum + Math.ceil((log.step_count || 0) / 10), 0) || 0;
      setMonthlyUsage(prev => ({ ...prev, tokens_used: totalTokens }));

      console.log('Total tokens used:', totalTokens);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const getPlanName = () => {
    console.log('Getting plan name for subscription:', userSubscription);
    
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      console.log('No active subscription found');
      return 'Free Plan';
    }
    
    // Use price_id instead of product_name (same logic as navbar)
    const priceId = userSubscription.price_id || '';
    console.log('Price ID:', priceId);
    
    if (priceId === 'price_1RYvocQGabzJD80BEVgRcdSa') {
      console.log('Extreme plan detected via price_id');
      return 'Extreme Plan';
    }
    if (priceId === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
      console.log('Pro Plus plan detected via price_id');
      return 'Pro Plus Plan';
    }
    if (priceId === 'price_1RYvf7QGabzJD80Bhd4V99CB') {
      console.log('Pro plan detected via price_id');
      return 'Pro Plan';
    }
    
    console.log('No matching plan found, defaulting to Free Plan');
    return 'Free Plan';
  };

  const getTokenLimit = () => {
    console.log('Getting token limit for subscription:', userSubscription);
    
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      console.log('No active subscription, returning 0 tokens');
      return 0; // Free plan - no tokens
    }
    
    // Use price_id instead of product_name (same logic as navbar)
    const priceId = userSubscription.price_id || '';
    console.log('Price ID for token limit:', priceId);
    
    if (priceId === 'price_1RYvocQGabzJD80BEVgRcdSa') {
      console.log('Extreme plan detected, returning 150 tokens');
      return 150;
    }
    if (priceId === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
      console.log('Pro Plus plan detected, returning 75 tokens');
      return 75;
    }
    if (priceId === 'price_1RYvf7QGabzJD80Bhd4V99CB') {
      console.log('Pro plan detected, returning 50 tokens');
      return 50;
    }
    
    console.log('No matching plan found for token limit, returning 0');
    return 0; // Default to free plan
  };

  const canStartAutomation = () => {
    const limit = getTokenLimit();
    console.log('Can start automation check - limit:', limit, 'used:', monthlyUsage.tokens_used);
    
    // Free plan users can't start automation
    if (limit === 0) {
      console.log('Cannot start automation: no token limit (free plan)');
      return false;
    }
    
    const estimatedTokensNeeded = 5; // Conservative estimate for a typical session
    const canStart = monthlyUsage.tokens_used + estimatedTokensNeeded <= limit;
    console.log('Can start automation:', canStart, '(used + needed <= limit):', monthlyUsage.tokens_used, '+', estimatedTokensNeeded, '<=', limit);
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
    const workType = WORK_TYPE_MAP[config.remotePreference as keyof typeof WORK_TYPE_MAP];
    if (workType) {
      params.append('f_WT', workType);
    }
    
    // Experience level
    const experienceLevel = EXPERIENCE_LEVEL_MAP[config.experience as keyof typeof EXPERIENCE_LEVEL_MAP];
    if (experienceLevel) {
      params.append('f_E', experienceLevel);
    }
    
    // Sort by most recent
    params.append('sortBy', 'DD');
    
    return `${baseUrl}?${params.toString()}`;
  };

  const makeApiCall = async (endpoint: string, options: RequestInit = {}) => {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    const response = await fetch(`${BROWSER_USE_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
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
      max_steps: 50
    };

    const response = await fetch('https://api.browseruse.com/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_BROWSERUSE_API_KEY}`
      },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.statusText}`);
    }

    return await response.json();
  };

  const getTaskStatus = async (taskId: string): Promise<TaskStatus> => {
    const response = await makeApiCall(`/task/${taskId}`);
    return {
      id: taskId,
      status: response.status,
      live_url: response.live_url,
      steps: response.steps,
      output: response.output,
      error: response.error
    };
  };

  const stopTask = async (taskId: string): Promise<void> => {
    await makeApiCall(`/stop-task?task_id=${taskId}`, {
      method: 'PUT'
    });
  };

  const startAutomation = async () => {
    // Validate required fields only
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

    // Check usage limits before starting
    if (!canStartAutomation()) {
      const limit = getTokenLimit();
      toast.error(`Usage limit reached! You have used ${monthlyUsage.tokens_used}/${limit} job tokens this month.`);
      addLog(`❌ Cannot start automation: Monthly limit of ${limit} job tokens reached (${monthlyUsage.tokens_used} used)`, 'error');
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setStepCount(0);
    setAppliedCount(0);
    setJobTokensUsed(0);

    try {
      addLog('🚀 Starting LinkedIn job application automation...');
      
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

          // Count steps and applications
          if (updatedTask.steps) {
            const newStepCount = updatedTask.steps.length;
            
            // Track usage when step count increases
            if (newStepCount > stepCount) {
              await trackUsage(newStepCount, task.id);
              const currentTokens = Math.ceil(newStepCount / 10);
              setJobTokensUsed(currentTokens);
              
              // Check if user is approaching or exceeding limit
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
            
            // Count successful applications with enhanced detection
            const applicationSteps = updatedTask.steps.filter(step => {
              if (!step.action) return false;
              
              const actionText = JSON.stringify(step.action).toLowerCase();
              return actionText.includes('submit application') || 
                     actionText.includes('easy apply') ||
                     (actionText.includes('click') && actionText.includes('submit'));
            });
            
            // If we detect a new application submission, try to extract company/role info
            if (applicationSteps.length > appliedCount) {
              const newApplications = applicationSteps.length - appliedCount;
              for (let i = 0; i < newApplications; i++) {
                // In a real implementation, you'd parse the job details from the task output
                // For now, we'll save with generic info
                await saveJobApplication(
                  'LinkedIn Company', // Would extract from page content
                  config.jobTitle || 'Software Engineer', // Would extract from job posting
                  task.id
                );
              }
            }
            
            setAppliedCount(applicationSteps.length);
          }

          // Handle different status updates
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
          console.error('Error checking task status:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Cleanup interval after 30 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isRunning) {
          addLog('⏰ Automation timed out after 30 minutes');
          setIsRunning(false);
        }
      }, 30 * 60 * 1000);

    } catch (error) {
      setIsRunning(false);
      addLog(`❌ Failed to start automation: ${error}`, 'error');
      console.error('Error starting automation:', error);
    }
  };

  const stopAutomation = async () => {
    if (!currentTask) return;

    try {
      await stopTask(currentTask.id);
      addLog('⏹️ Stopping automation...');
    } catch (error) {
      addLog(`❌ Error stopping automation: ${error}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 relative overflow-hidden">
      {/* Premium Radial Gradient Background */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/5 dark:to-black/20 pointer-events-none" />
      
      {/* Enhanced Dynamic Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute top-0 left-0 w-full h-full"
          animate={{
            background: [
              "linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.06))",
              "linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.06), rgba(59, 130, 246, 0.06))",
              "linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(59, 130, 246, 0.06), rgba(99, 102, 241, 0.06))"
            ]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Enhanced floating orbs with adaptive colors */}
        <motion.div
          className="absolute top-20 right-20 w-40 h-40 bg-gradient-to-br from-blue-400/15 to-indigo-500/15 dark:from-blue-400/8 dark:to-cyan-600/8 rounded-full blur-2xl"
          animate={{
            y: [0, -40, 0],
            x: [0, 30, 0],
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-to-br from-indigo-400/15 to-purple-500/15 dark:from-purple-400/8 dark:to-pink-600/8 rounded-full blur-2xl"
          animate={{
            y: [0, 40, 0],
            x: [0, -30, 0],
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 right-1/3 w-32 h-32 bg-gradient-to-br from-blue-300/12 to-indigo-400/12 dark:from-emerald-400/6 dark:to-teal-600/6 rounded-full blur-xl"
          animate={{
            y: [0, -20, 0],
            x: [0, 20, 0],
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-slate-300/8 to-indigo-300/8 dark:from-indigo-400/4 dark:to-purple-600/4 rounded-full blur-3xl"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
                </div>
      
      {/* Main Layout Container */}
      <div className="relative h-full flex flex-col">
        {/* Top Navigation Bar */}
        <motion.div
          className="flex-shrink-0 px-4 py-3 border-b border-gray-200/30 dark:border-gray-700/30 w-full bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-4">
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-xl">
                  <Zap className="w-5 h-5 text-white" />
              </div>
                <motion.div 
                  className="absolute inset-0 w-10 h-10 border border-blue-400/30 rounded-xl"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
              
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-xl font-black bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 dark:from-white dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent">
                    LinkedIn AutoApply
                  </h1>
                  <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none text-xs">
                    <div className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse" />
                    LIVE
                  </Badge>
                  </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  AI-powered automation platform
                </p>
              </div>
            </div>
            
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setShowConfig(!showConfig)}
                variant="outline"
                size="sm"
                className="border-gray-300 bg-white/50 hover:bg-gray-100/50 text-gray-900 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 dark:text-white"
              >
                <Settings className={`w-4 h-4 mr-2 transition-all duration-300 ${showConfig ? 'rotate-90' : ''}`} />
                Configure
              </Button>
            </motion.div>
                </div>
        </motion.div>

        {/* Configuration Panel */}
        <AnimatePresence>
        {showConfig && (
            <motion.div
              className="flex-shrink-0 px-4 py-2 border-b border-gray-200/30 dark:border-gray-700/30 w-full bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl border-gray-200/40 dark:border-gray-700/40 w-full rounded-2xl">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Credentials */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                        <UserCheck className="w-4 h-4 mr-2 text-blue-400" />
                        Credentials
                  </h3>
                      <div className="space-y-2">
                        <Input
                    type="email"
                    value={config.linkedinEmail}
                    onChange={(e) => setConfig(prev => ({ ...prev, linkedinEmail: e.target.value }))}
                          placeholder="LinkedIn Email"
                          className="h-9 bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 dark:bg-gray-900/50 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 text-sm"
                        />
                        <Input
                    type="password"
                    value={config.linkedinPassword}
                    onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                          placeholder="LinkedIn Password"
                          className="h-9 bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 dark:bg-gray-900/50 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 text-sm"
                  />
              </div>
            </div>

                    {/* Job Search */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                        <Briefcase className="w-4 h-4 mr-2 text-purple-400" />
                        Job Search
                      </h3>
                      <div className="space-y-2">
                        <Input
                    type="text"
                    value={config.jobTitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                          placeholder="Job Title"
                          className="h-9 bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 dark:bg-gray-900/50 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 text-sm"
                        />
                        <Input
                          type="text"
                    value={config.location}
                    onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Location"
                          className="h-9 bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 dark:bg-gray-900/50 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 text-sm"
                        />
                </div>
              </div>

                    {/* Preferences */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                        <Settings className="w-4 h-4 mr-2 text-green-400" />
                        Preferences
                      </h3>
                      <div className="space-y-2">
                        <Select value={config.experience} onValueChange={(value) => setConfig(prev => ({ ...prev, experience: value }))}>
                          <SelectTrigger className="h-9 bg-gray-50 border-gray-300 text-gray-900 dark:bg-gray-900/50 dark:border-gray-600 dark:text-white text-sm">
                            <SelectValue placeholder="Experience Level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internship">Internship</SelectItem>
                            <SelectItem value="entry">Entry Level</SelectItem>
                            <SelectItem value="associate">Associate</SelectItem>
                            <SelectItem value="mid">Mid Level</SelectItem>
                            <SelectItem value="senior">Senior Level</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="executive">Executive</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={config.remotePreference} onValueChange={(value) => setConfig(prev => ({ ...prev, remotePreference: value }))}>
                          <SelectTrigger className="h-9 bg-gray-50 border-gray-300 text-gray-900 dark:bg-gray-900/50 dark:border-gray-600 dark:text-white text-sm">
                            <SelectValue placeholder="Remote Preference" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on-site">On-site</SelectItem>
                            <SelectItem value="remote">Remote</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                  </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area - True Edge-to-Edge Full Width Layout */}
        <div className="flex-1 p-2 min-h-0 w-full">
          <div className="h-full w-full grid grid-cols-1 xl:grid-cols-12 gap-6 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-white/30 dark:border-gray-700/40 shadow-2xl p-8">
            
            {/* Left Panel - Mission Control */}
            <motion.div
              className="xl:col-span-5 h-full w-full xl:pr-4"
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Mission Control Dashboard */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                whileHover={{ y: -1, transition: { duration: 0.2 } }}
                className="h-full w-full"
              >
                <Card className="bg-gradient-to-br from-white/90 via-white/95 to-gray-50/90 dark:from-gray-800/40 dark:via-gray-800/30 dark:to-gray-900/40 backdrop-blur-2xl border border-gray-200/50 dark:border-gray-700/30 shadow-xl dark:shadow-2xl rounded-lg h-full w-full relative overflow-hidden group">
                  {/* Glassmorphism inner shadow for light mode */}
                  <div className="absolute inset-0 rounded-lg shadow-inner shadow-gray-900/5 dark:shadow-transparent pointer-events-none" />
                  
                  {/* Subtle glow border effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/8 via-purple-400/8 to-pink-400/8 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  {/* Neumorphism effect for light mode */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 dark:to-transparent rounded-lg pointer-events-none" />
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-xl">
                      <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                      <CardTitle className="text-xl text-gray-900 dark:text-white">Mission Control</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400">Real-time automation dashboard</CardDescription>
                  </div>
                </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Enhanced Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      className="relative bg-gradient-to-br from-blue-500/15 to-blue-600/15 backdrop-blur-sm border border-blue-500/30 rounded-lg p-5 group overflow-hidden"
                    >
                      {/* Animated gradient border */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-cyan-400/20 to-blue-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl flex items-center justify-center shadow-lg">
                            <Search className="w-5 h-5 text-blue-300" />
                         </div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                       </div>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stepCount}</div>
                        <div className="text-sm font-medium text-blue-300/80">Auto Steps</div>
                         </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      className="relative bg-gradient-to-br from-purple-500/15 to-purple-600/15 backdrop-blur-sm border border-purple-500/30 rounded-lg p-5 group overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 via-pink-400/20 to-purple-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-xl flex items-center justify-center shadow-lg">
                            <UserCheck className="w-5 h-5 text-purple-300" />
                         </div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                       </div>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{jobTokensUsed}</div>
                        <div className="text-sm font-medium text-purple-300/80">Tokens</div>
                         </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      className="relative bg-gradient-to-br from-emerald-500/15 to-emerald-600/15 backdrop-blur-sm border border-emerald-500/30 rounded-lg p-5 group overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-emerald-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-xl flex items-center justify-center shadow-lg">
                            <Briefcase className="w-5 h-5 text-emerald-300" />
                         </div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                       </div>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{appliedCount}</div>
                        <div className="text-sm font-medium text-emerald-300/80">Applications</div>
                         </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      className="relative bg-gradient-to-br from-orange-500/15 to-orange-600/15 backdrop-blur-sm border border-orange-500/30 rounded-lg p-5 group overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 via-red-400/20 to-orange-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-xl flex items-center justify-center shadow-lg">
                            <TrendingUp className="w-5 h-5 text-orange-300" />
                        </div>
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                      </div>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                          {appliedCount > 0 ? Math.round((appliedCount / Math.max(stepCount, 1)) * 100) : 0}%
                        </div>
                        <div className="text-sm font-medium text-orange-300/80">Success Rate</div>
                        </div>
                    </motion.div>
               </div>

                  {/* Enhanced Monthly Usage */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-br from-gray-100/60 via-gray-50/40 to-gray-100/60 dark:from-gray-900/60 dark:via-gray-800/40 dark:to-gray-900/60 backdrop-blur-sm rounded-lg p-6 border border-gray-300/40 dark:border-gray-700/40 shadow-xl"
                  >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-blue-300" />
                      </div>
                        <span className="text-base font-semibold text-gray-900 dark:text-white">Monthly Token Usage</span>
                    </div>
                    <div className="text-right">
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{jobTokensUsed}/75</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">tokens used</div>
                          </div>
                        </div>
                                          <div className="relative w-full bg-gray-300/60 dark:bg-gray-800/60 rounded-full h-3 overflow-hidden">
                      <motion.div 
                        className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-3 rounded-full shadow-lg"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((jobTokensUsed / 75) * 100, 100)}%` }}
                        transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-full animate-pulse" />
                          </div>
                                          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-500 mt-3">
                        <span>0%</span>
                        <span className="text-gray-700 dark:text-gray-400">{Math.round((jobTokensUsed / 75) * 100)}%</span>
                        <span>100%</span>
                        </div>
                    <div className="text-center mt-4">
                      <span className="text-sm text-emerald-300 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        {75 - jobTokensUsed} tokens remaining
                      </span>
                    </div>
                  </motion.div>

                  {/* Enhanced Action Buttons */}
                  <div className="space-y-4">
                    {!isRunning ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        whileHover={{ scale: 1.02, y: -2 }} 
                        whileTap={{ scale: 0.98 }}
                        className="relative group"
                      >
                        <Button
                          onClick={startAutomation}
                          disabled={!canStartAutomation()}
                          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white shadow-2xl border-none relative overflow-hidden group"
                        >
                          {/* Animated background glow */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
                          
                          {/* Shimmer effect */}
                          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
                          
                          <div className="relative z-10 flex items-center justify-center space-x-3">
                            <Play className="w-6 h-6" />
                            <span>Start Auto Apply</span>
                            <motion.div
                              animate={{ rotate: [0, 360] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                              <Sparkles className="w-5 h-5" />
                            </motion.div>
                      </div>
                        </Button>
                        
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        whileHover={{ scale: 1.02, y: -2 }} 
                        whileTap={{ scale: 0.98 }}
                        className="relative group"
                      >
                        <Button
                    onClick={stopAutomation}
                          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-2xl border-none relative overflow-hidden"
                  >
                          <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
                          <div className="relative z-10 flex items-center justify-center space-x-3">
                            <Square className="w-6 h-6" />
                    <span>Stop Automation</span>
                          </div>
                        </Button>
                        <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-700/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                      </motion.div>
                )}

                {currentTask?.live_url && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        whileHover={{ scale: 1.02, y: -1 }} 
                        whileTap={{ scale: 0.98 }}
                        className="relative group"
                      >
                        <Button
                          asChild
                          className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-xl border-none relative overflow-hidden"
                        >
                          <a href={currentTask.live_url} target="_blank" rel="noopener noreferrer">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10 flex items-center justify-center space-x-2">
                              <ExternalLink className="w-4 h-4" />
                    <span>View Live Browser</span>
                            </div>
                  </a>
                        </Button>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                      </motion.div>
                )}

                    {/* Status Section */}
              {currentTask && (
                      <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                        <div className="flex items-center space-x-3 mb-2">
                          {isRunning && <Loader2 className="animate-spin text-blue-400" size={16} />}
                          <span className="font-medium text-white text-sm">Status:</span>
                          <Badge 
                            variant={currentTask.status === 'running' ? 'default' : 
                                   currentTask.status === 'finished' ? 'secondary' : 
                                   currentTask.status === 'failed' ? 'destructive' : 'outline'}
                            className="capitalize text-xs"
                          >
                      {currentTask.status}
                          </Badge>
                  </div>
                        <div className="text-xs text-gray-400 font-mono">
                    Task ID: {currentTask.id}
                  </div>
                </div>
              )}
            </div>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>

            {/* Right Panel - Browser Preview & Activity Intelligence */}
            <motion.div
              className="xl:col-span-7 h-full w-full flex flex-col space-y-4 xl:border-l xl:border-gray-800/30 xl:pl-4"
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            >
              {/* Live Browser Preview */}
            {currentTask?.live_url && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                >
                  <Card className="bg-gradient-to-br from-gray-800/40 via-gray-800/30 to-gray-900/40 dark:from-gray-800/40 dark:via-gray-800/30 dark:to-gray-900/40 light:from-white/90 light:via-white/95 light:to-gray-50/90 backdrop-blur-2xl border border-gray-700/30 dark:border-gray-700/30 light:border-gray-200/50 shadow-2xl dark:shadow-2xl light:shadow-xl rounded-lg h-full w-full relative overflow-hidden group">
                    {/* Glassmorphism inner shadow for light mode */}
                    <div className="absolute inset-0 rounded-lg shadow-inner shadow-gray-900/5 dark:shadow-transparent light:shadow-gray-900/5 pointer-events-none" />
                    
                    {/* Subtle glow border effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 dark:from-emerald-500/10 dark:via-cyan-500/10 dark:to-blue-500/10 light:from-emerald-400/8 light:via-cyan-400/8 light:to-blue-400/8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    
                    {/* Neumorphism effect for light mode */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent light:from-white/40 light:to-transparent rounded-lg pointer-events-none" />
                    <CardHeader className="pb-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/30 via-cyan-600/30 to-blue-600/30 rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-sm border border-emerald-500/20">
                            <MonitorSpeaker className="w-6 h-6 text-emerald-300" />
                    </div>
                    <div>
                            <CardTitle className="text-xl text-white font-bold">Live Browser Session</CardTitle>
                            <CardDescription className="text-gray-400">Real-time automation viewport</CardDescription>
                    </div>
                  </div>
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs px-3 py-1 shadow-lg">
                            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-ping"></div>
                            LIVE
                          </Badge>
                        </motion.div>
                    </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-lg overflow-hidden border border-gray-700/40 shadow-2xl relative">
                        {/* Enhanced Browser Chrome with glow */}
                        <div className="bg-gradient-to-r from-gray-800/90 to-gray-700/90 backdrop-blur-sm px-4 py-3 flex items-center space-x-3 border-b border-gray-600/50 relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-blue-500/5" />
                          <div className="flex items-center space-x-2 relative z-10">
                            <motion.div 
                              className="w-3 h-3 bg-red-500 rounded-full shadow-lg"
                              whileHover={{ scale: 1.2, boxShadow: "0 0 10px rgba(239, 68, 68, 0.5)" }}
                            />
                            <motion.div 
                              className="w-3 h-3 bg-yellow-500 rounded-full shadow-lg"
                              whileHover={{ scale: 1.2, boxShadow: "0 0 10px rgba(234, 179, 8, 0.5)" }}
                            />
                            <motion.div 
                              className="w-3 h-3 bg-green-500 rounded-full shadow-lg"
                              whileHover={{ scale: 1.2, boxShadow: "0 0 10px rgba(34, 197, 94, 0.5)" }}
                            />
                  </div>
                          <div className="flex-1 bg-gray-700/60 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-gray-300 font-mono border border-gray-600/30 relative z-10">
                      <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                              <span>linkedin.com/jobs/search</span>
                      </div>
                      </div>
                    </div>
                    <iframe
                      src={currentTask.live_url}
                          className="w-full h-full border-0 bg-white"
                      title="LinkedIn Automation Live Preview"
                      allow="clipboard-read; clipboard-write"
                    />
                  </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Activity Intelligence - Modernized Terminal */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
              >
                <Card className="bg-gradient-to-br from-gray-800/40 via-gray-800/30 to-gray-900/40 dark:from-gray-800/40 dark:via-gray-800/30 dark:to-gray-900/40 light:from-white/90 light:via-white/95 light:to-gray-50/90 backdrop-blur-2xl border border-gray-700/30 dark:border-gray-700/30 light:border-gray-200/50 shadow-2xl dark:shadow-2xl light:shadow-xl rounded-lg flex-1 h-full w-full relative overflow-hidden group">
                  {/* Glassmorphism inner shadow for light mode */}
                  <div className="absolute inset-0 rounded-lg shadow-inner shadow-gray-900/5 dark:shadow-transparent light:shadow-gray-900/5 pointer-events-none" />
                  
                  {/* Neon terminal glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-red-500/10 light:from-amber-400/8 light:via-orange-400/8 light:to-red-400/8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  {/* Terminal neon glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400/5 via-cyan-400/5 to-blue-400/5 dark:from-green-400/5 dark:via-cyan-400/5 dark:to-blue-400/5 light:from-green-300/8 light:via-cyan-300/8 light:to-blue-300/8 rounded-lg animate-pulse pointer-events-none" />
                  
                  {/* Neumorphism effect for light mode */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent light:from-white/40 light:to-transparent rounded-lg pointer-events-none" />
                  <CardHeader className="pb-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500/30 via-orange-600/30 to-red-600/30 rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-sm border border-amber-500/20">
                          <Activity className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                          <CardTitle className="text-xl text-white font-bold">Activity Intelligence</CardTitle>
                          <CardDescription className="text-gray-400">Real-time automation monitoring</CardDescription>
                  </div>
                </div>
                {logs.length > 0 && (
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-3 py-1 shadow-lg">
                            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                            {logs.length} Events
                          </Badge>
                        </motion.div>
                )}
              </div>
                  </CardHeader>
                <CardContent className="relative z-10">
                  <div className="bg-gradient-to-br from-gray-900 to-black dark:from-gray-900 dark:to-black light:from-gray-100 light:to-gray-50 rounded-lg overflow-hidden border border-gray-700/40 dark:border-gray-700/40 light:border-gray-300/50 shadow-2xl relative">
                    {/* Enhanced Terminal Header with Neon Glow */}
                    <div className="bg-gradient-to-r from-gray-800/90 to-gray-700/90 dark:from-gray-800/90 dark:to-gray-700/90 light:from-gray-200/90 light:to-gray-100/90 backdrop-blur-sm px-4 py-3 flex items-center space-x-3 border-b border-gray-600/50 dark:border-gray-600/50 light:border-gray-300/50 relative">
                      {/* Neon terminal glow background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-red-500/5 dark:from-amber-500/5 dark:to-red-500/5 light:from-amber-400/8 light:to-red-400/8" />
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400/3 via-cyan-400/3 to-blue-400/3 dark:from-green-400/3 dark:via-cyan-400/3 dark:to-blue-400/3 light:from-green-300/6 light:via-cyan-300/6 light:to-blue-300/6 animate-pulse" />
                      
                      {/* Animated Traffic Light Dots */}
                      <div className="flex items-center space-x-2 relative z-10">
                        <motion.div 
                          className="w-3 h-3 bg-red-500 rounded-full shadow-lg"
                          animate={{ 
                            boxShadow: [
                              "0 0 5px rgba(239, 68, 68, 0.3)",
                              "0 0 15px rgba(239, 68, 68, 0.6)",
                              "0 0 5px rgba(239, 68, 68, 0.3)"
                            ]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                          whileHover={{ scale: 1.2, boxShadow: "0 0 20px rgba(239, 68, 68, 0.8)" }}
                        />
                        <motion.div 
                          className="w-3 h-3 bg-yellow-500 rounded-full shadow-lg"
                          animate={{ 
                            boxShadow: [
                              "0 0 5px rgba(234, 179, 8, 0.3)",
                              "0 0 15px rgba(234, 179, 8, 0.6)",
                              "0 0 5px rgba(234, 179, 8, 0.3)"
                            ]
                          }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                          whileHover={{ scale: 1.2, boxShadow: "0 0 20px rgba(234, 179, 8, 0.8)" }}
                        />
                        <motion.div 
                          className="w-3 h-3 bg-green-500 rounded-full shadow-lg"
                          animate={{ 
                            boxShadow: [
                              "0 0 5px rgba(34, 197, 94, 0.3)",
                              "0 0 15px rgba(34, 197, 94, 0.6)",
                              "0 0 5px rgba(34, 197, 94, 0.3)"
                            ]
                          }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                          whileHover={{ scale: 1.2, boxShadow: "0 0 20px rgba(34, 197, 94, 0.8)" }}
                        />
                    </div>
                      
                      {/* Terminal Path with Neon Effect */}
                      <div className="flex-1 text-center relative z-10">
                        <motion.span 
                          className="text-sm font-mono text-gray-300 dark:text-gray-300 light:text-gray-700 bg-gray-700/60 dark:bg-gray-700/60 light:bg-white/60 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-600/30 dark:border-gray-600/30 light:border-gray-400/30"
                          animate={{
                            boxShadow: [
                              "0 0 0 rgba(34, 197, 94, 0)",
                              "0 0 10px rgba(34, 197, 94, 0.2)",
                              "0 0 0 rgba(34, 197, 94, 0)"
                            ]
                          }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          ~/automation/linkedin-autoapply
                        </motion.span>
                    </div>
                      
                      {/* Active Status with Animated Dots */}
                      <div className="flex items-center space-x-2 relative z-10">
                        <motion.div 
                          className="w-2 h-2 bg-green-400 rounded-full shadow-lg"
                          animate={{ 
                            scale: [1, 1.3, 1], 
                            opacity: [0.7, 1, 0.7],
                            boxShadow: [
                              "0 0 5px rgba(74, 222, 128, 0.5)",
                              "0 0 15px rgba(74, 222, 128, 0.8)",
                              "0 0 5px rgba(74, 222, 128, 0.5)"
                            ]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.div 
                          className="w-1 h-1 bg-green-300 rounded-full"
                          animate={{ 
                            scale: [0.8, 1.2, 0.8], 
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                        />
                        <motion.div 
                          className="w-1 h-1 bg-green-300 rounded-full"
                          animate={{ 
                            scale: [0.8, 1.2, 0.8], 
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                        />
                        <span className="text-sm text-green-300 dark:text-green-300 light:text-green-600 font-bold">ACTIVE</span>
                    </div>
                  </div>
                  
                    {/* Enhanced Terminal Content */}
                    <div className="h-72 overflow-y-auto p-6 bg-gradient-to-b from-gray-900/50 to-black/50 dark:from-gray-900/50 dark:to-black/50 light:from-gray-50/80 light:to-white/80">
                    {logs.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-center py-12 flex flex-col items-center"
                        >
                          <motion.div 
                            className="w-16 h-16 bg-gradient-to-br from-gray-700/50 to-gray-600/50 dark:from-gray-700/50 dark:to-gray-600/50 light:from-gray-200/80 light:to-gray-300/80 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 border border-gray-600/30 dark:border-gray-600/30 light:border-gray-400/30"
                            animate={{ 
                              boxShadow: [
                                "0 0 0 rgba(156, 163, 175, 0)",
                                "0 0 20px rgba(156, 163, 175, 0.1)",
                                "0 0 0 rgba(156, 163, 175, 0)"
                              ]
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                          >
                            <Terminal className="w-8 h-8 text-gray-400 dark:text-gray-400 light:text-gray-600" />
                          </motion.div>
                          <p className="text-lg font-semibold mb-3 text-gray-300 dark:text-gray-300 light:text-gray-700">Monitoring Ready</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 light:text-gray-600 max-w-md leading-relaxed text-center">
                            Configure your automation settings and click <span className="text-blue-400 dark:text-blue-400 light:text-blue-600 font-medium">"Start Auto Apply"</span> to begin real-time activity monitoring
                          </p>
                        </motion.div>
                      ) : (
                        <div className="space-y-3">
                        {logs.map((log, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="group/log flex items-start space-x-4 hover:bg-gray-800/30 dark:hover:bg-gray-800/30 light:hover:bg-gray-100/50 rounded-xl px-4 py-3 transition-all duration-300 border border-transparent hover:border-gray-700/30 dark:hover:border-gray-700/30 light:hover:border-gray-300/40"
                            >
                            <div className="flex-shrink-0 mt-1">
                                <motion.div 
                                  className="w-2 h-2 bg-emerald-400 dark:bg-emerald-400 light:bg-emerald-500 rounded-full shadow-lg group-hover/log:bg-emerald-300 dark:group-hover/log:bg-emerald-300 light:group-hover/log:bg-emerald-400 group-hover/log:shadow-emerald-400/50"
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-emerald-300 dark:text-emerald-300 light:text-emerald-600 group-hover/log:text-emerald-200 dark:group-hover/log:text-emerald-200 light:group-hover/log:text-emerald-500 font-mono leading-relaxed transition-colors duration-300 break-words">
                                {log}
                              </div>
                            </div>
                              <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-500 light:text-gray-600 font-mono opacity-0 group-hover/log:opacity-100 transition-opacity duration-300 bg-gray-800/50 dark:bg-gray-800/50 light:bg-gray-200/60 px-2 py-1 rounded-md">
                              {new Date().toLocaleTimeString()}
                            </div>
                            </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkedInAutomationBot;