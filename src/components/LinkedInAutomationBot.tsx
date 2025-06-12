import React, { useState, useEffect } from 'react';
import { Play, Square, Loader2, ExternalLink, Settings, UserCheck, Briefcase, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

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
          await supabase.from('usage_logs').insert({
            user_id: user.id,
            task_id: taskId,
            browser_use_steps: steps,
            job_tokens: jobTokens,
            cost_usd: jobTokens * 0.01, // $0.01 per token
            recorded_at: new Date().toISOString(),
            activity_type: 'linkedin_automation'
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

      // Fetch user subscription
      const { data: subscription } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .single();

      setUserSubscription(subscription);

      // Fetch current month usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: usageData } = await supabase
        .from('usage_logs')
        .select('browser_use_steps, job_tokens')
        .gte('recorded_at', `${currentMonth}-01`)
        .lt('recorded_at', `${currentMonth}-32`);

      const totalTokens = usageData?.reduce((sum, log) => sum + (log.job_tokens || 0), 0) || 0;
      setMonthlyUsage(prev => ({ ...prev, tokens_used: totalTokens }));
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const getPlanName = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 'Free Plan';
    }
    
    const productName = userSubscription.product_name || '';
    if (productName.includes('Extreme')) return 'Extreme Plan';
    if (productName.includes('Plus')) return 'Pro Plus Plan';
    if (productName.includes('Pro')) return 'Pro Plan';
    
    return 'Free Plan';
  };

  const getTokenLimit = () => {
    if (!userSubscription || userSubscription.subscription_status !== 'active') {
      return 0; // Free plan - no tokens
    }
    
    const productName = userSubscription.product_name || '';
    if (productName.includes('Extreme')) return 150;
    if (productName.includes('Plus')) return 75;
    if (productName.includes('Pro')) return 50;
    
    return 0; // Default to free plan
  };

  const canStartAutomation = () => {
    const limit = getTokenLimit();
    
    // Free plan users can't start automation
    if (limit === 0) {
      return false;
    }
    
    const estimatedTokensNeeded = 5; // Conservative estimate for a typical session
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

  const createLinkedInTask = async (): Promise<TaskStatus> => {
    const jobsURL = buildLinkedInJobsURL();
    
    const taskInstructions = `
You are a LinkedIn job application assistant. Follow these steps exactly:

1. LOGIN TO LINKEDIN
   - Go to https://linkedin.com
   - Click "Sign in" 
   - Enter email: ${config.linkedinEmail}
   - Enter password: ${config.linkedinPassword}
   - Click "Sign in" button
   - Wait for login to complete

2. NAVIGATE TO PRE-FILTERED JOBS
   - Go directly to: ${jobsURL}
   - This URL has all filters already applied (Easy Apply, location, experience, work type)
   - Wait for the page to load completely

3. APPLY TO JOBS - For each job listing:
   - Click on the job title to view details
   - Look for the blue "Easy Apply" button and click it
   - Fill out the application form step by step:
     
   IMPORTANT SCROLLING: Always scroll down to see all form fields and the submit button!
   - Use scroll_down action to see more content if needed
   - Look for "Next", "Review", or "Submit application" buttons at the bottom
   
   Form filling guidelines:
   - Answer required questions with professional responses
   - For "Why are you interested?": "I am excited about this opportunity and believe my skills align well with this role."
   - For salary expectations: Leave blank or enter "Competitive" 
   - For availability: "Available with 2 weeks notice"
   - For work authorization: Select "Yes" if asked
   - For cover letter: Skip if optional
   
   SCROLL AND SUBMIT:
   - Always scroll to the bottom of each form page
   - Look for submit/next buttons at the very bottom
   - Click through all form steps until final submission
   - Confirm the application was submitted successfully

4. REPEAT PROCESS
   - Go back to job listings (browser back button)
   - Apply to the next Easy Apply job
   - Continue until 10 applications are submitted OR no more Easy Apply jobs

5. FINAL REPORT
   - Provide summary: total applications, job titles, any issues
   - Note any jobs that couldn't be applied to and why

CRITICAL: Always scroll down in forms to find submit buttons. Don't give up if you don't see the submit button immediately - scroll down!
`;

    const response = await makeApiCall('/run-task', {
      method: 'POST',
      body: JSON.stringify({
        task: taskInstructions,
        model: 'gpt-4o', // Use the most capable model
        max_steps: 50, // Limit steps to control costs
        timeout: 1800, // 30 minutes timeout
        save_browser_data: true, // Keep session for LinkedIn login
        allowed_domains: ['linkedin.com', '*.linkedin.com']
      }),
    });

    return {
      id: response.id,
      status: response.status || 'pending',
      live_url: response.live_url
    };
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-800 transition-all duration-500">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Header with Glassmorphism */}
        <div className="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-500 p-8 mb-8 group">
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Animated Logo Container */}
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-3xl flex items-center justify-center shadow-2xl group-hover:shadow-blue-500/25 transition-all duration-500 group-hover:scale-110">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl"></div>
                  <svg className="w-10 h-10 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                {/* Pulsing Ring */}
                <div className="absolute inset-0 w-20 h-20 border-2 border-blue-400/30 rounded-3xl animate-ping"></div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <h1 className="text-4xl font-black bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 dark:from-white dark:via-blue-100 dark:to-indigo-100 bg-clip-text text-transparent">
                    LinkedIn AutoApply
                  </h1>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">LIVE</span>
                  </div>
                </div>
                
                <p className="text-xl text-gray-600 dark:text-gray-300 font-medium">
                  Next-generation AI automation with enterprise-grade security
                </p>
                
                {/* Feature Pills */}
                <div className="flex items-center space-x-3">
                  <div className="px-4 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 dark:border-blue-700/50 rounded-full flex items-center space-x-2 group/pill hover:from-blue-500/20 hover:to-indigo-500/20 transition-all duration-300">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">AI-Powered</span>
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200/50 dark:border-emerald-700/50 rounded-full flex items-center space-x-2 group/pill hover:from-emerald-500/20 hover:to-teal-500/20 transition-all duration-300">
                    <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Secure</span>
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-700/50 rounded-full flex items-center space-x-2 group/pill hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300">
                    <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Lightning Fast</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Enhanced Settings Button */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`group relative overflow-hidden px-6 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                  showConfig ? 'bg-blue-50/80 border-blue-300/50 shadow-blue-500/20' : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/80'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:via-indigo-500/10 group-hover:to-purple-500/10 transition-all duration-500"></div>
                <div className="relative flex items-center space-x-2">
                  <Settings className={`w-5 h-5 transition-all duration-300 ${showConfig ? 'text-blue-600 rotate-90' : 'text-gray-600 dark:text-gray-300 group-hover:rotate-45'}`} />
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {showConfig ? 'Hide Configuration' : 'Configure Automation'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        {showConfig && (
          <div className="premium-card p-8 mb-8 glass hover-lift">
            <div className="mb-6">
              <h2 className="text-display-sm text-gray-900 dark:text-white mb-2">
                Automation Configuration
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Configure your job search preferences and credentials for automated applications
              </p>
            </div>

            {/* Security Notice */}
            <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Security & Privacy Notice
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    To provide seamless LinkedIn job application automation, your login credentials are securely transmitted and used only within isolated, temporary browser sessions operated by our trusted automation service provider. Your credentials are handled with strict confidentiality, are never stored permanently, and are only used to authenticate your session during the automated application process. We use encrypted connections to transmit your information and adhere to best practices in data privacy and security to protect your account.
                  </p>
                </div>
              </div>
            </div>

            {/* Credentials Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <UserCheck className="w-5 h-5 mr-2 text-blue-600" />
                LinkedIn Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={config.linkedinEmail}
                    onChange={(e) => setConfig(prev => ({ ...prev, linkedinEmail: e.target.value }))}
                    placeholder="your.email@example.com"
                    className="premium-input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={config.linkedinPassword}
                    onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                    placeholder="Your LinkedIn password"
                    className="premium-input"
                  />
                </div>
              </div>
            </div>

            {/* Job Search Preferences */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-purple-600" />
                Job Search Preferences
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Title / Keywords
                  </label>
                  <input
                    type="text"
                    value={config.jobTitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                    placeholder="e.g., Software Engineer"
                    className="premium-input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <select
                    value={config.location}
                    onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
                    className="premium-select"
                  >
                    <option value="San Francisco Bay Area">San Francisco Bay Area</option>
                    <option value="New York City">New York City</option>
                    <option value="Los Angeles">Los Angeles</option>
                    <option value="Seattle">Seattle</option>
                    <option value="Chicago">Chicago</option>
                    <option value="Boston">Boston</option>
                    <option value="Vancouver, BC">Vancouver, BC</option>
                    <option value="Toronto, ON">Toronto, ON</option>
                    <option value="London, UK">London, UK</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Experience Level
                  </label>
                  <select
                    value={config.experience}
                    onChange={(e) => setConfig(prev => ({ ...prev, experience: e.target.value }))}
                    className="premium-select"
                  >
                    <option value="Internship">Internship</option>
                    <option value="Entry level">Entry level</option>
                    <option value="Associate">Associate</option>
                    <option value="Mid-Senior level">Mid-Senior level</option>
                    <option value="Director">Director</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Work Type
                  </label>
                  <select
                    value={config.remotePreference}
                    onChange={(e) => setConfig(prev => ({ ...prev, remotePreference: e.target.value }))}
                    className="premium-select"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* URL Preview */}
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center">
                <ExternalLink className="w-4 h-4 mr-2" />
                Generated LinkedIn Search URL
              </h3>
              <div className="text-xs text-emerald-800 dark:text-emerald-200 break-all font-mono bg-white dark:bg-gray-800 p-3 rounded-xl border border-emerald-200 dark:border-emerald-700 mb-3">
                {buildLinkedInJobsURL()}
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                🎯 This optimized URL includes all your filters and will be used to efficiently target relevant job opportunities.
              </p>
            </div>
          </div>
        )}

        {/* Advanced Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Enhanced Control Panel */}
          <div className="lg:col-span-4">
            <div className="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-500 p-8 group">
              {/* Animated Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              
              {/* Header with Animation */}
              <div className="relative mb-8">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-purple-500/25 transition-all duration-500">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-pink-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-indigo-900 dark:from-white dark:to-indigo-100 bg-clip-text text-transparent">
                      Mission Control
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Real-time automation dashboard</p>
                  </div>
                </div>
              </div>
              
              {/* Advanced Metrics Grid */}
               <div className="relative grid grid-cols-3 gap-4 mb-8">
                 {/* Steps Counter */}
                 <div className="relative group/card">
                   <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
                   <div className="relative bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-900/40 dark:to-cyan-900/40 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-2xl p-4 hover:scale-105 transition-all duration-300">
                     <div className="flex items-center justify-between mb-3">
                       <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                         <Search className="w-4 h-4 text-white" />
                       </div>
                       <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                     </div>
                     <div className="text-2xl font-black text-blue-700 dark:text-blue-300 mb-1">{stepCount}</div>
                     <div className="text-xs font-semibold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">Automation Steps</div>
                   </div>
                 </div>
                 
                 {/* Tokens Counter */}
                 <div className="relative group/card">
                   <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
                   <div className="relative bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/40 dark:to-pink-900/40 backdrop-blur-sm border border-purple-200/50 dark:border-purple-700/50 rounded-2xl p-4 hover:scale-105 transition-all duration-300">
                     <div className="flex items-center justify-between mb-3">
                       <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                         <UserCheck className="w-4 h-4 text-white" />
                       </div>
                       <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                     </div>
                     <div className="text-2xl font-black text-purple-700 dark:text-purple-300 mb-1">{jobTokensUsed}</div>
                     <div className="text-xs font-semibold text-purple-600/70 dark:text-purple-400/70 uppercase tracking-wider">Session Tokens</div>
                   </div>
                 </div>
                 
                 {/* Applications Counter */}
                 <div className="relative group/card">
                   <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
                   <div className="relative bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-900/40 dark:to-teal-900/40 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/50 rounded-2xl p-4 hover:scale-105 transition-all duration-300">
                     <div className="flex items-center justify-between mb-3">
                       <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                         <Briefcase className="w-4 h-4 text-white" />
                       </div>
                       <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                     </div>
                     <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mb-1">{appliedCount}</div>
                     <div className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Applications</div>
                   </div>
                 </div>
               </div>

              {/* Premium Monthly Usage Tracker */}
              <div className="relative mb-8 p-6 bg-gradient-to-br from-slate-50/80 to-blue-50/80 dark:from-slate-800/40 dark:to-blue-900/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-2xl overflow-hidden group/usage">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover/usage:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        {getTokenLimit() === 0 ? 'Current Plan' : 'Monthly Token Usage'}
                      </span>
                    </div>
                    <div className="text-right">
                      {getTokenLimit() === 0 ? (
                        <div>
                          <div className="text-lg font-black text-gray-900 dark:text-white">
                            {getPlanName()}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">0 tokens included</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg font-black text-gray-900 dark:text-white">
                            {monthlyUsage.tokens_used + jobTokensUsed}<span className="text-sm font-medium text-gray-500">/{getTokenLimit()}</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">tokens consumed</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Enhanced Progress Bar */}
                  {getTokenLimit() === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">Upgrade to unlock automation</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">Choose a Pro plan to start applying to jobs automatically</p>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <div className="w-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full h-3 shadow-inner">
                          <div
                            className={`h-3 rounded-full transition-all duration-700 relative overflow-hidden ${
                              (monthlyUsage.tokens_used + jobTokensUsed) >= getTokenLimit() * 0.9
                                ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700' 
                                : (monthlyUsage.tokens_used + jobTokensUsed) >= getTokenLimit() * 0.7
                                ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500'
                                : 'bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-600'
                            }`}
                            style={{
                              width: `${Math.min(((monthlyUsage.tokens_used + jobTokensUsed) / getTokenLimit()) * 100, 100)}%`
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
                          </div>
                        </div>
                        
                        {/* Usage percentage indicator */}
                        <div className="flex justify-between mt-2 text-xs font-medium">
                          <span className="text-gray-600 dark:text-gray-400">0%</span>
                          <span className={`${
                            (monthlyUsage.tokens_used + jobTokensUsed) >= getTokenLimit() * 0.9
                              ? 'text-red-600 dark:text-red-400' 
                              : (monthlyUsage.tokens_used + jobTokensUsed) >= getTokenLimit() * 0.7
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {Math.round(((monthlyUsage.tokens_used + jobTokensUsed) / getTokenLimit()) * 100)}%
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">100%</span>
                        </div>
                      </div>
                      
                      {/* Status Message */}
                      <div className="mt-3 text-center">
                        <span className={`text-sm font-medium ${
                          (monthlyUsage.tokens_used + jobTokensUsed) >= getTokenLimit() * 0.9
                            ? 'text-red-700 dark:text-red-300' 
                            : (monthlyUsage.tokens_used + jobTokensUsed) >= getTokenLimit() * 0.7
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {getTokenLimit() - (monthlyUsage.tokens_used + jobTokensUsed) > 0 
                            ? `${getTokenLimit() - (monthlyUsage.tokens_used + jobTokensUsed)} tokens remaining this month`
                            : 'Monthly usage limit reached'
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {!isRunning ? (
                  <button
                    onClick={startAutomation}
                    disabled={
                      !config.linkedinEmail.trim() || 
                      !config.linkedinPassword.trim() || 
                      !canStartAutomation()
                    }
                    className="w-full premium-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={20} />
                    <span>
                      {getTokenLimit() === 0 ? 'Upgrade to Pro Plan' : !canStartAutomation() ? 'Monthly Limit Reached' : 'Start Auto Apply'}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={stopAutomation}
                    className="w-full premium-button bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Square size={20} />
                    <span>Stop Automation</span>
                  </button>
                )}

                {currentTask?.live_url && (
                  <a
                    href={currentTask.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full premium-button bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <ExternalLink size={20} />
                    <span>View Live Browser</span>
                  </a>
                )}
              </div>

              {/* Status */}
              {currentTask && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    {isRunning && <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={16} />}
                    <span className="font-medium text-gray-900 dark:text-white">Status:</span>
                    <span className={`capitalize px-2 py-1 rounded text-xs font-medium ${
                      currentTask.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                      currentTask.status === 'finished' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      currentTask.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                      'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
                    }`}>
                      {currentTask.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Task ID: {currentTask.id}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Browser Preview & Logs */}
          <div className="lg:col-span-8 space-y-6">
            {/* Ultra-Premium Live Browser Preview */}
            {currentTask?.live_url && (
              <div className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl border border-white/30 dark:border-gray-700/50 rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-700 p-8 group">
                {/* Dynamic Background Animation */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 rounded-3xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-700"></div>
                
                {/* Premium Header */}
                <div className="relative flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 via-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-emerald-500/30 transition-all duration-500">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="absolute -inset-1 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-emerald-900 dark:from-white dark:to-emerald-100 bg-clip-text text-transparent">
                        Live Browser Session
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Real-time automation viewport</p>
                    </div>
                  </div>
                  
                  {/* Enhanced Live Badge */}
                  <div className="relative">
                    <div className="px-4 py-2 bg-gradient-to-r from-red-500/90 to-pink-500/90 backdrop-blur-sm rounded-full flex items-center space-x-2 shadow-lg animate-pulse">
                      <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                      <span className="text-white font-bold text-sm">LIVE AUTOMATION</span>
                    </div>
                  </div>
                </div>
                
                {/* Ultra-Premium Browser Container */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-blue-400/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <div className="relative aspect-video bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 rounded-3xl overflow-hidden border-2 border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
                    {/* Browser Chrome Simulation */}
                    <div className="bg-gray-200 dark:bg-gray-800 px-4 py-3 flex items-center space-x-3 border-b border-gray-300/50 dark:border-gray-600/50">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex-1 bg-white dark:bg-gray-700 rounded-lg px-3 py-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                        linkedin.com/jobs/search
                      </div>
                    </div>
                    
                    {/* Actual Browser Content */}
                    <iframe
                      src={currentTask.live_url}
                      className="w-full h-full border-0 bg-white dark:bg-gray-900"
                      title="LinkedIn Automation Live Preview"
                      allow="clipboard-read; clipboard-write"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ultra-Premium Activity Logs */}
            <div className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl border border-white/30 dark:border-gray-700/50 rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-700 p-8 group">
              {/* Dynamic Background Animation */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 rounded-3xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-700"></div>
              
              {/* Premium Header */}
              <div className="relative flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-amber-500/30 transition-all duration-500">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-amber-400 to-red-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-amber-900 dark:from-white dark:to-amber-100 bg-clip-text text-transparent">
                      Activity Intelligence
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Real-time automation monitoring</p>
                  </div>
                </div>
                
                {/* Event Counter Badge */}
                {logs.length > 0 && (
                  <div className="relative">
                    <div className="px-4 py-2 bg-gradient-to-r from-blue-500/90 to-indigo-500/90 backdrop-blur-sm rounded-full flex items-center space-x-2 shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white font-bold text-sm">{logs.length} Events</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Ultra-Premium Terminal Container */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-red-400/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-950 dark:to-black rounded-3xl overflow-hidden border-2 border-gray-700/50 dark:border-gray-600/50 shadow-2xl">
                  {/* Terminal Header */}
                  <div className="bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-900 dark:to-gray-800 px-4 py-3 flex items-center space-x-3 border-b border-gray-600/50">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-xs font-mono text-gray-400">~/automation/linkedin-autoapply</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400 font-semibold">ACTIVE</span>
                    </div>
                  </div>
                  
                  {/* Terminal Content */}
                  <div className="h-80 overflow-y-auto p-4">
                    {logs.length === 0 ? (
                      <div className="text-gray-400 text-center py-12 flex flex-col items-center">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-600 rounded-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-br from-gray-600 to-gray-500 rounded-2xl blur opacity-20 animate-pulse"></div>
                        </div>
                        <p className="text-base font-medium mb-2">Monitoring Ready</p>
                        <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                          Configure your automation settings and click "Start Auto Apply" to begin real-time activity monitoring
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {logs.map((log, index) => (
                          <div key={index} className="group/log flex items-start space-x-3 hover:bg-gray-800/50 dark:hover:bg-gray-700/50 rounded-xl px-3 py-2 transition-all duration-200">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full group-hover/log:bg-emerald-300 transition-colors duration-200"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-emerald-400 group-hover/log:text-emerald-300 font-mono leading-relaxed transition-colors duration-200 break-words">
                                {log}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-xs text-gray-500 font-mono opacity-0 group-hover/log:opacity-100 transition-opacity duration-200">
                              {new Date().toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkedInAutomationBot; 