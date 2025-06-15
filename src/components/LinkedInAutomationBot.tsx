import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  User, 
  MapPin, 
  Briefcase, 
  Clock, 
  Target, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  Download, 
  RefreshCw,
  Loader2,
  Shield,
  Key,
  Globe,
  Search,
  Filter,
  Building,
  DollarSign,
  Calendar,
  Users,
  Sparkles,
  ArrowRight,
  Info,
  Lock,
  Unlock,
  ExternalLink,
  Activity,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface AutomationConfig {
  linkedinEmail: string;
  linkedinPassword: string;
  jobTitle: string;
  location: string;
  jobType?: string;
  workType?: string;
  experienceLevel?: string;
  salaryRange?: string;
  companySize?: string;
  datePosted?: string;
  targetCount?: string;
}

interface TaskStatus {
  task_id: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  current_step: number;
  total_steps: number;
  message: string;
  screenshots?: string[];
  gif_url?: string;
  preview_url?: string;
}

const LinkedInAutomationBot: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<AutomationConfig>({
    linkedinEmail: '',
    linkedinPassword: '',
    jobTitle: '',
    location: '',
    jobType: undefined,
    workType: undefined,
    experienceLevel: undefined,
    salaryRange: undefined,
    companySize: undefined,
    datePosted: undefined,
    targetCount: '10'
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  const API_URL = import.meta.env.VITE_BROWSER_USE_API_URL || 'https://api.browseruse.cloud/v1';
  const API_KEY = import.meta.env.VITE_BROWSER_USE_API_KEY;

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
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTaskId && isRunning) {
      interval = setInterval(() => {
        checkTaskStatus(currentTaskId);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTaskId, isRunning]);

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

    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const buildLinkedInUrl = () => {
    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams();

    if (config.jobTitle) {
      params.append('keywords', config.jobTitle);
    }
    if (config.location) {
      params.append('location', config.location);
    }
    if (config.jobType && config.jobType !== 'any') {
      params.append('f_JT', config.jobType);
    }
    if (config.workType && config.workType !== 'any') {
      params.append('f_WT', config.workType);
    }
    if (config.experienceLevel && config.experienceLevel !== 'any') {
      params.append('f_E', config.experienceLevel);
    }
    if (config.salaryRange && config.salaryRange !== 'any') {
      params.append('f_SB2', config.salaryRange);
    }
    if (config.companySize && config.companySize !== 'any') {
      params.append('f_C', config.companySize);
    }
    if (config.datePosted && config.datePosted !== 'any') {
      params.append('f_TPR', config.datePosted);
    }

    // Always add Easy Apply filter
    params.append('f_AL', 'true');

    return `${baseUrl}?${params.toString()}`;
  };

  const startAutomation = async () => {
    if (!API_KEY) {
      toast.error('Browser Use API key not configured');
      return;
    }

    if (!config.linkedinEmail || !config.linkedinPassword || !config.jobTitle || !config.location) {
      toast.error('Please fill in all required fields (email, password, job title, and location)');
      return;
    }

    setIsRunning(true);
    setIsPaused(false);

    try {
      const linkedinUrl = buildLinkedInUrl();
      
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
        max_steps: parseInt(config.targetCount || '10') * 5 // 5 steps per application estimate
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${API_URL}/run-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(taskData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.task_id) {
        setCurrentTaskId(result.task_id);
        setTaskStatus({
          task_id: result.task_id,
          status: 'running',
          current_step: 0,
          total_steps: parseInt(config.targetCount || '10'),
          message: 'Starting LinkedIn automation...',
          preview_url: result.preview_url
        });
        
        if (result.preview_url) {
          setPreviewUrl(result.preview_url);
        }
        
        toast.success('Automation started successfully!');
      } else {
        throw new Error('No task ID received from API');
      }
    } catch (error) {
      console.error('Error starting automation:', error);
      setIsRunning(false);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('Request timed out. Please check your internet connection and try again.');
        } else if (error.message.includes('Failed to fetch')) {
          toast.error(`Unable to connect to Browser Use API. Please check:\n• Internet connection\n• API URL: ${API_URL}\n• Firewall/network settings`);
        } else {
          toast.error(`Error starting automation: ${error.message}`);
        }
      } else {
        toast.error('Unknown error occurred while starting automation');
      }
    }
  };

  const pauseAutomation = async () => {
    if (!currentTaskId || !API_KEY) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/pause-task`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ task_id: currentTaskId }),
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
    if (!currentTaskId || !API_KEY) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/resume-task`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ task_id: currentTaskId }),
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
    if (!currentTaskId || !API_KEY) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/stop-task`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ task_id: currentTaskId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsRunning(false);
        setIsPaused(false);
        setCurrentTaskId(null);
        setTaskStatus(null);
        setPreviewUrl(null);
        toast.success('Automation stopped');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error stopping automation:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request timed out while stopping automation');
      } else {
        toast.error('Failed to stop automation');
      }
    }
  };

  const checkTaskStatus = async (taskId: string) => {
    if (!API_KEY) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/get-task-status?task_id=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const status = await response.json();
        setTaskStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          setIsRunning(false);
          setIsPaused(false);
          
          if (status.status === 'completed') {
            toast.success('Automation completed successfully!');
          } else {
            toast.error('Automation failed');
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error checking task status:', error);
      }
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
      {/* Header */}
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
      {!API_KEY && (
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
                Current API URL: <code className="bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded text-sm">{API_URL}</code>
              </p>
              <div className="bg-amber-100 dark:bg-amber-900/40 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                  Required Environment Variables:
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• <code>VITE_BROWSER_USE_API_KEY</code> - Your Browser Use API key</li>
                  <li>• <code>VITE_BROWSER_USE_API_URL</code> - API endpoint (optional, defaults to browseruse.cloud)</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Configuration Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="premium-card hover-lift">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-white">Automation Configuration</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Set up your LinkedIn credentials and job search preferences
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={saveConfiguration}
                disabled={saving || !isSupabaseConfigured()}
                variant="outline"
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Save Config
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* LinkedIn Credentials */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <Key className="w-5 h-5 mr-2" />
                  LinkedIn Credentials
                </h3>
                <Button
                  onClick={() => setShowCredentials(!showCredentials)}
                  variant="ghost"
                  size="sm"
                >
                  {showCredentials ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show
                    </>
                  )}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    LinkedIn Email *
                  </label>
                  <Input
                    type="email"
                    value={config.linkedinEmail}
                    onChange={(e) => setConfig(prev => ({ ...prev, linkedinEmail: e.target.value }))}
                    placeholder="your.email@example.com"
                    className="premium-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    LinkedIn Password *
                  </label>
                  <Input
                    type={showCredentials ? "text" : "password"}
                    value={config.linkedinPassword}
                    onChange={(e) => setConfig(prev => ({ ...prev, linkedinPassword: e.target.value }))}
                    placeholder="Your LinkedIn password"
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Security Notice
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Your credentials are used only for automation and are not stored permanently. 
                      They are transmitted securely to the Browser Use API for LinkedIn login.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Job Search Criteria */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Job Search Criteria
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Job Title *
                  </label>
                  <Input
                    type="text"
                    value={config.jobTitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, jobTitle: e.target.value }))}
                    placeholder="e.g., Software Engineer"
                    className="premium-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Location *
                  </label>
                  <Input
                    type="text"
                    value={config.location}
                    onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., San Francisco, CA"
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                      Filter Recommendation
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      The more filters you use, the more targeted your job search becomes. 
                      This can lead to higher quality matches but fewer total applications.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Filters */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Optional Filters
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Job Type
                  </label>
                  <Select value={config.jobType} onValueChange={(value) => setConfig(prev => ({ ...prev, jobType: value }))}>
                    <SelectTrigger className="premium-select">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="F">Full-time</SelectItem>
                      <SelectItem value="P">Part-time</SelectItem>
                      <SelectItem value="C">Contract</SelectItem>
                      <SelectItem value="T">Temporary</SelectItem>
                      <SelectItem value="I">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Work Type
                  </label>
                  <Select value={config.workType} onValueChange={(value) => setConfig(prev => ({ ...prev, workType: value }))}>
                    <SelectTrigger className="premium-select">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">On-site</SelectItem>
                      <SelectItem value="2">Remote</SelectItem>
                      <SelectItem value="3">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Experience Level
                  </label>
                  <Select value={config.experienceLevel} onValueChange={(value) => setConfig(prev => ({ ...prev, experienceLevel: value }))}>
                    <SelectTrigger className="premium-select">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Internship</SelectItem>
                      <SelectItem value="2">Entry level</SelectItem>
                      <SelectItem value="3">Associate</SelectItem>
                      <SelectItem value="4">Mid-Senior level</SelectItem>
                      <SelectItem value="5">Director</SelectItem>
                      <SelectItem value="6">Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
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

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
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
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="premium-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">Automation Control</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Start, pause, or stop your LinkedIn automation
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
              <div className="flex items-center space-x-4">
                {!isRunning ? (
                  <Button
                    onClick={startAutomation}
                    disabled={!API_KEY || !config.linkedinEmail || !config.linkedinPassword || !config.jobTitle || !config.location}
                    size="lg"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Automation
                  </Button>
                ) : (
                  <div className="flex items-center space-x-3">
                    {!isPaused ? (
                      <Button onClick={pauseAutomation} variant="outline" size="lg">
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </Button>
                    ) : (
                      <Button onClick={resumeAutomation} size="lg">
                        <Play className="w-5 h-5 mr-2" />
                        Resume
                      </Button>
                    )}
                    <Button onClick={stopAutomation} variant="destructive" size="lg">
                      <Square className="w-5 h-5 mr-2" />
                      Stop
                    </Button>
                  </div>
                )}
              </div>

              {previewUrl && (
                <div className="flex items-center space-x-3">
                  <Badge variant="success" className="flex items-center">
                    <Activity className="w-4 h-4 mr-1" />
                    Live Preview Available
                  </Badge>
                  <Button
                    onClick={() => window.open(previewUrl, '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Live
                  </Button>
                </div>
              )}
            </div>

            {/* Generated LinkedIn URL Preview */}
            {config.jobTitle && config.location && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Generated LinkedIn Search URL:
                  </h4>
                  <Button
                    onClick={() => window.open(buildLinkedInUrl(), '_blank')}
                    variant="ghost"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                </div>
                <code className="text-xs text-gray-600 dark:text-gray-400 break-all">
                  {buildLinkedInUrl()}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Status Panel */}
      {taskStatus && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="premium-card hover-lift">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                  taskStatus.status === 'running' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                  taskStatus.status === 'completed' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                  taskStatus.status === 'failed' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                  'bg-gradient-to-br from-yellow-500 to-orange-600'
                }`}>
                  {taskStatus.status === 'running' ? (
                    <Activity className="w-6 h-6 text-white animate-pulse" />
                  ) : taskStatus.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : taskStatus.status === 'failed' ? (
                    <AlertCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Pause className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-white">
                    Automation Status
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Task ID: {taskStatus.task_id}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {taskStatus.status}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {taskStatus.message}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      taskStatus.status === 'running' ? 'default' :
                      taskStatus.status === 'completed' ? 'success' :
                      taskStatus.status === 'failed' ? 'destructive' :
                      'warning'
                    }
                    className="text-sm px-3 py-1"
                  >
                    {taskStatus.status}
                  </Badge>
                </div>

                {taskStatus.status === 'running' && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>Progress</span>
                      <span>{taskStatus.current_step} / {taskStatus.total_steps}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
                        style={{ 
                          width: `${Math.min((taskStatus.current_step / taskStatus.total_steps) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default LinkedInAutomationBot;