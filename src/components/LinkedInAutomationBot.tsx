import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  Eye, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Zap, 
  Target, 
  MapPin, 
  Briefcase, 
  Building, 
  DollarSign, 
  Users, 
  Calendar, 
  Globe, 
  Shield, 
  Key, 
  User, 
  Mail, 
  Lock,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Info,
  ExternalLink,
  Monitor,
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Browser Use API Configuration
const BROWSER_USE_API_KEY = import.meta.env.VITE_BROWSER_USE_API_KEY;
const BROWSER_USE_API_URL = 'https://api.browseruse.com/v1';

interface LinkedInCredentials {
  email: string;
  password: string;
}

interface JobPreferences {
  jobTitle: string;
  location: string;
  jobType: string; // Full-time, Part-time, Contract, etc.
  workType: string; // Remote, On-site, Hybrid
  experienceLevel: string; // Entry, Mid, Senior, Executive
  companySize: string; // Startup, Small, Medium, Large, Enterprise
  salaryRange: string;
  keywords: string;
}

interface AutomationTask {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  applicationsSubmitted: number;
  currentAction: string;
  startTime?: Date;
  endTime?: Date;
  previewUrl?: string; // Browser Use API provides preview URL
  error?: string;
}

interface ConfigurationStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export const LinkedInAutomationBot: React.FC = () => {
  const { user } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [credentials, setCredentials] = useState<LinkedInCredentials>({
    email: '',
    password: ''
  });
  const [preferences, setPreferences] = useState<JobPreferences>({
    jobTitle: '',
    location: '',
    jobType: '',
    workType: '',
    experienceLevel: '',
    companySize: '',
    salaryRange: '',
    keywords: ''
  });
  const [currentTask, setCurrentTask] = useState<AutomationTask | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const configurationSteps: ConfigurationStep[] = [
    {
      id: 1,
      title: 'LinkedIn Credentials',
      description: 'Provide your LinkedIn login credentials for automation',
      completed: false
    },
    {
      id: 2,
      title: 'Job Preferences',
      description: 'Set your job search criteria and filters',
      completed: false
    },
    {
      id: 3,
      title: 'Review & Start',
      description: 'Review your configuration and start automation',
      completed: false
    }
  ];

  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];
  const workTypes = ['Remote', 'On-site', 'Hybrid'];
  const experienceLevels = ['Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive'];
  const companySizes = ['Startup (1-10)', 'Small (11-50)', 'Medium (51-200)', 'Large (201-1000)', 'Enterprise (1000+)'];

  useEffect(() => {
    loadConfiguration();
  }, [user]);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  const loadConfiguration = async () => {
    if (!isSupabaseConfigured() || !user) {
      console.log('Supabase not configured or no user, using demo mode');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('automation_configs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading configuration:', error);
        return;
      }

      if (data && data.config) {
        const config = data.config;
        
        // Load preferences from config (credentials are NOT stored)
        if (config.preferences) {
          setPreferences(config.preferences);
        }
        
        // Check if configuration is complete (preferences exist, credentials will be entered each time)
        if (config.preferences && config.preferences.jobTitle && config.preferences.location) {
          setIsConfigured(true);
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const saveConfiguration = async () => {
    if (!isSupabaseConfigured() || !user) {
      toast.error('Database not configured');
      return;
    }

    try {
      // Only save preferences, NOT credentials for security
      const configData = {
        preferences,
        lastUpdated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('automation_configs')
        .upsert({
          user_id: user.id,
          config: configData
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      setIsConfigured(true);
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  const generateLinkedInSearchURL = (prefs: JobPreferences): string => {
    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams();

    // Add job title keywords
    if (prefs.jobTitle) {
      params.append('keywords', prefs.jobTitle);
    }

    // Add location
    if (prefs.location) {
      params.append('location', prefs.location);
    }

    // Add job type filter
    if (prefs.jobType) {
      const jobTypeMap: Record<string, string> = {
        'Full-time': 'F',
        'Part-time': 'P',
        'Contract': 'C',
        'Temporary': 'T',
        'Internship': 'I'
      };
      if (jobTypeMap[prefs.jobType]) {
        params.append('f_JT', jobTypeMap[prefs.jobType]);
      }
    }

    // Add work type filter (remote, on-site, hybrid)
    if (prefs.workType) {
      const workTypeMap: Record<string, string> = {
        'Remote': '2',
        'On-site': '1',
        'Hybrid': '3'
      };
      if (workTypeMap[prefs.workType]) {
        params.append('f_WT', workTypeMap[prefs.workType]);
      }
    }

    // Add experience level
    if (prefs.experienceLevel) {
      const experienceMap: Record<string, string> = {
        'Entry level': '1',
        'Associate': '2',
        'Mid-Senior level': '3',
        'Director': '4',
        'Executive': '5'
      };
      if (experienceMap[prefs.experienceLevel]) {
        params.append('f_E', experienceMap[prefs.experienceLevel]);
      }
    }

    // Add company size filter
    if (prefs.companySize) {
      const companySizeMap: Record<string, string> = {
        'Startup (1-10)': 'A',
        'Small (11-50)': 'B',
        'Medium (51-200)': 'C',
        'Large (201-1000)': 'D',
        'Enterprise (1000+)': 'E'
      };
      if (companySizeMap[prefs.companySize]) {
        params.append('f_C', companySizeMap[prefs.companySize]);
      }
    }

    // Add Easy Apply filter
    params.append('f_AL', 'true');

    return `${baseUrl}?${params.toString()}`;
  };

  const startAutomation = async () => {
    if (!BROWSER_USE_API_KEY) {
      toast.error('Browser Use API key not configured');
      return;
    }

    if (!credentials.email || !credentials.password) {
      toast.error('Please provide LinkedIn credentials');
      return;
    }

    if (!preferences.jobTitle || !preferences.location) {
      toast.error('Please configure job preferences first');
      return;
    }

    setLoading(true);
    
    try {
      // Generate LinkedIn search URL with filters
      const searchUrl = generateLinkedInSearchURL(preferences);
      
      // Create automation task with Browser Use API
      const taskPayload = {
        task: `LinkedIn Job Application Automation:
        
1. Navigate to LinkedIn and log in with email: ${credentials.email}
2. Go to the job search URL: ${searchUrl}
3. Apply to jobs using Easy Apply feature
4. For each job application:
   - Click on Easy Apply button
   - Fill out application forms automatically
   - Submit applications
   - Take screenshots of each step
5. Continue until ${preferences.salaryRange || '50'} applications are submitted or no more Easy Apply jobs are found
6. Provide regular status updates

Important: Only apply to jobs that have the "Easy Apply" button. Skip jobs that require external applications.`,
        session_id: `linkedin_session_${user?.id || 'demo'}_${Date.now()}`,
        max_steps: 1000,
        include_screenshot: true
      };

      const response = await fetch(`${BROWSER_USE_API_URL}/run-task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BROWSER_USE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskPayload)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Create task tracking object
      const newTask: AutomationTask = {
        id: result.task_id || `task_${Date.now()}`,
        status: 'running',
        progress: 0,
        applicationsSubmitted: 0,
        currentAction: 'Initializing LinkedIn automation...',
        startTime: new Date(),
        previewUrl: result.preview_url // Browser Use API provides preview URL
      };

      setCurrentTask(newTask);
      setIsConfigDialogOpen(false);
      
      // Start monitoring the task
      monitorTask(newTask.id);
      
      toast.success('Automation started successfully!');
    } catch (error) {
      console.error('Error starting automation:', error);
      toast.error('Failed to start automation');
    } finally {
      setLoading(false);
    }
  };

  const monitorTask = async (taskId: string) => {
    if (!BROWSER_USE_API_KEY) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${BROWSER_USE_API_URL}/get-task-status/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${BROWSER_USE_API_KEY}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to get task status');
        }

        const status = await response.json();
        
        setCurrentTask(prev => prev ? {
          ...prev,
          status: status.status,
          progress: status.progress || prev.progress,
          currentAction: status.current_action || prev.currentAction,
          applicationsSubmitted: status.applications_submitted || prev.applicationsSubmitted,
          previewUrl: status.preview_url || prev.previewUrl // Update preview URL if available
        } : null);

        // Stop polling if task is completed or failed
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          
          if (status.status === 'completed') {
            toast.success('Automation completed successfully!');
          } else {
            toast.error('Automation failed');
          }
        }
      } catch (error) {
        console.error('Error monitoring task:', error);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds
  };

  const pauseTask = async () => {
    if (!currentTask || !BROWSER_USE_API_KEY) return;

    try {
      await fetch(`${BROWSER_USE_API_URL}/pause-task/${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${BROWSER_USE_API_KEY}`
        }
      });

      setCurrentTask(prev => prev ? { ...prev, status: 'paused' } : null);
      toast.success('Automation paused');
    } catch (error) {
      console.error('Error pausing task:', error);
      toast.error('Failed to pause automation');
    }
  };

  const resumeTask = async () => {
    if (!currentTask || !BROWSER_USE_API_KEY) return;

    try {
      await fetch(`${BROWSER_USE_API_URL}/resume-task/${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${BROWSER_USE_API_KEY}`
        }
      });

      setCurrentTask(prev => prev ? { ...prev, status: 'running' } : null);
      toast.success('Automation resumed');
    } catch (error) {
      console.error('Error resuming task:', error);
      toast.error('Failed to resume automation');
    }
  };

  const stopTask = async () => {
    if (!currentTask || !BROWSER_USE_API_KEY) return;

    try {
      await fetch(`${BROWSER_USE_API_URL}/stop-task/${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${BROWSER_USE_API_KEY}`
        }
      });

      setCurrentTask(null);
      toast.success('Automation stopped');
    } catch (error) {
      console.error('Error stopping task:', error);
      toast.error('Failed to stop automation');
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfigurationComplete = () => {
    saveConfiguration();
    setIsConfigDialogOpen(false);
  };

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
          AI-Powered LinkedIn Job Applications
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Automate your LinkedIn job applications with AI. Set your preferences and let our bot apply to relevant positions using LinkedIn's Easy Apply feature.
        </p>
      </motion.div>

      {/* Configuration Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-card hover-lift">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                  isConfigured 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-amber-500 to-orange-600'
                }`}>
                  {isConfigured ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Settings className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isConfigured ? 'Configuration Complete' : 'Setup Required'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {isConfigured 
                      ? 'Your automation is configured and ready to start' 
                      : 'Configure your LinkedIn credentials and job preferences'
                    }
                  </p>
                </div>
              </div>
              
              <Button
                onClick={() => setIsConfigDialogOpen(true)}
                variant={isConfigured ? "outline" : "default"}
                size="lg"
                className="shadow-lg"
              >
                <Settings className="w-5 h-5 mr-2" />
                {isConfigured ? 'Reconfigure' : 'Configure'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Current Task Status */}
      {currentTask && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-900 dark:text-white">Automation Status</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Real-time automation progress and controls
                    </CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {currentTask.status === 'running' && (
                    <Button onClick={pauseTask} variant="outline" size="sm">
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  
                  {currentTask.status === 'paused' && (
                    <Button onClick={resumeTask} variant="outline" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  
                  <Button onClick={stopTask} variant="destructive" size="sm">
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status and Progress */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {currentTask.applicationsSubmitted}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Applications Submitted</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {Math.round(currentTask.progress)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Progress</div>
                </div>
                
                <div className="text-center">
                  <Badge className={`text-sm ${
                    currentTask.status === 'running' ? 'bg-green-100 text-green-800' :
                    currentTask.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentTask.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${currentTask.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                />
              </div>

              {/* Current Action */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">Current Action</div>
                    <div className="text-blue-700 dark:text-blue-300">{currentTask.currentAction}</div>
                  </div>
                </div>
              </div>

              {/* Live Browser Preview */}
              {currentTask.previewUrl && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Monitor className="w-5 h-5 mr-2" />
                    Live Browser Preview
                  </h4>
                  <div className="relative">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Live LinkedIn Session
                        </div>
                        <Button
                          onClick={() => window.open(currentTask.previewUrl, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open in New Tab
                        </Button>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                        <iframe
                          src={currentTask.previewUrl}
                          className="w-full h-96 border-0"
                          title="LinkedIn Automation Preview"
                          sandbox="allow-same-origin allow-scripts"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-green-800 dark:text-green-200">Live Preview</h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          This is a live view of the LinkedIn automation in progress. You can see exactly what the bot is doing in real-time.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Start Automation */}
      {!currentTask && isConfigured && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card hover-lift">
            <CardContent className="p-12 text-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 p-6 mx-auto mb-6 shadow-2xl">
                <Zap className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Ready to Start Automation
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto leading-relaxed">
                Your configuration is complete. Click below to start automated LinkedIn job applications.
              </p>
              <Button
                onClick={() => setIsConfigDialogOpen(true)}
                size="lg"
                className="premium-button-primary text-xl px-12 py-4 shadow-2xl"
              >
                <Play className="w-6 h-6 mr-3" />
                Start Auto Apply
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Configuration Dialog */}
      <AnimatePresence>
        {isConfigDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsConfigDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl glass-card rounded-3xl shadow-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                      LinkedIn Automation Setup
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">
                      Configure your credentials and job preferences
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsConfigDialogOpen(false)}
                    variant="ghost"
                    size="icon"
                  >
                    ✕
                  </Button>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8">
                  {configurationSteps.map((step, index) => (
                    <React.Fragment key={step.id}>
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          currentStep >= step.id
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                        }`}>
                          {currentStep > step.id ? (
                            <CheckCircle className="w-6 h-6" />
                          ) : (
                            <span className="font-bold">{step.id}</span>
                          )}
                        </div>
                        <div className="mt-2 text-center">
                          <div className={`text-sm font-medium ${
                            currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                          }`}>
                            {step.title}
                          </div>
                          <div className="text-xs text-gray-400 max-w-24">
                            {step.description}
                          </div>
                        </div>
                      </div>
                      {index < configurationSteps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-4 transition-colors ${
                          currentStep > step.id ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Step Content */}
                <div className="min-h-96">
                  {/* Step 1: LinkedIn Credentials */}
                  {currentStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <Shield className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          LinkedIn Credentials
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Your credentials are used securely and never stored permanently
                        </p>
                      </div>

                      <div className="max-w-md mx-auto space-y-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <Mail className="w-4 h-4 inline mr-2" />
                            LinkedIn Email
                          </label>
                          <Input
                            type="email"
                            value={credentials.email}
                            onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="your.email@example.com"
                            className="premium-input"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <Lock className="w-4 h-4 inline mr-2" />
                            LinkedIn Password
                          </label>
                          <Input
                            type="password"
                            value={credentials.password}
                            onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Your LinkedIn password"
                            className="premium-input"
                          />
                        </div>

                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start space-x-3">
                            <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-amber-800 dark:text-amber-200">Security Notice</h4>
                              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                Your credentials are transmitted securely and used only for automation. They are never stored in our database for your security.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Job Preferences */}
                  {currentStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <Target className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          Job Search Preferences
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Configure your job search criteria and filters
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <Briefcase className="w-4 h-4 inline mr-2" />
                            Job Title *
                          </label>
                          <Input
                            type="text"
                            value={preferences.jobTitle}
                            onChange={(e) => setPreferences(prev => ({ ...prev, jobTitle: e.target.value }))}
                            placeholder="e.g., Software Engineer, Product Manager"
                            className="premium-input"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <MapPin className="w-4 h-4 inline mr-2" />
                            Location *
                          </label>
                          <Input
                            type="text"
                            value={preferences.location}
                            onChange={(e) => setPreferences(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g., San Francisco, CA or Remote"
                            className="premium-input"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Job Type (Optional)
                          </label>
                          <Select value={preferences.jobType} onValueChange={(value) => setPreferences(prev => ({ ...prev, jobType: value }))}>
                            <SelectTrigger className="premium-select">
                              <SelectValue placeholder="Select job type" />
                            </SelectTrigger>
                            <SelectContent>
                              {jobTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Work Type (Optional)
                          </label>
                          <Select value={preferences.workType} onValueChange={(value) => setPreferences(prev => ({ ...prev, workType: value }))}>
                            <SelectTrigger className="premium-select">
                              <SelectValue placeholder="Select work type" />
                            </SelectTrigger>
                            <SelectContent>
                              {workTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Experience Level (Optional)
                          </label>
                          <Select value={preferences.experienceLevel} onValueChange={(value) => setPreferences(prev => ({ ...prev, experienceLevel: value }))}>
                            <SelectTrigger className="premium-select">
                              <SelectValue placeholder="Select experience level" />
                            </SelectTrigger>
                            <SelectContent>
                              {experienceLevels.map(level => (
                                <SelectItem key={level} value={level}>{level}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Company Size (Optional)
                          </label>
                          <Select value={preferences.companySize} onValueChange={(value) => setPreferences(prev => ({ ...prev, companySize: value }))}>
                            <SelectTrigger className="premium-select">
                              <SelectValue placeholder="Select company size" />
                            </SelectTrigger>
                            <SelectContent>
                              {companySizes.map(size => (
                                <SelectItem key={size} value={size}>{size}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <DollarSign className="w-4 h-4 inline mr-2" />
                            Target Applications (Optional)
                          </label>
                          <Input
                            type="text"
                            value={preferences.salaryRange}
                            onChange={(e) => setPreferences(prev => ({ ...prev, salaryRange: e.target.value }))}
                            placeholder="e.g., 50 (number of applications)"
                            className="premium-input"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Additional Keywords (Optional)
                          </label>
                          <Input
                            type="text"
                            value={preferences.keywords}
                            onChange={(e) => setPreferences(prev => ({ ...prev, keywords: e.target.value }))}
                            placeholder="e.g., React, Python, Machine Learning"
                            className="premium-input"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start space-x-3">
                          <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200">Smart Filtering Tip</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                              The more filters you use, the more targeted your job search becomes. This helps you find more relevant positions but may reduce the total number of available jobs. Only Job Title and Location are required - other filters are optional to help narrow your search.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Review & Start */}
                  {currentStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <CheckCircle className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          Review & Start Automation
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Review your configuration and start the automation
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            LinkedIn Account
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-600 dark:text-gray-400">Email</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {credentials.email || 'Not provided'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-600 dark:text-gray-400">Password</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {credentials.password ? '••••••••' : 'Not provided'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Job Preferences
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-600 dark:text-gray-400">Job Title</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {preferences.jobTitle || 'Not specified'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-600 dark:text-gray-400">Location</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {preferences.location || 'Not specified'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-600 dark:text-gray-400">Job Type</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {preferences.jobType || 'Any'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-gray-600 dark:text-gray-400">Work Type</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {preferences.workType || 'Any'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                          Generated LinkedIn Search URL
                        </h4>
                        <div className="text-sm text-green-700 dark:text-green-300 break-all font-mono bg-white/50 dark:bg-black/20 p-3 rounded-lg">
                          {generateLinkedInSearchURL(preferences)}
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          This URL will be used to search for jobs matching your criteria
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    variant="outline"
                    className={currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Step {currentStep} of 3
                  </div>

                  {currentStep < 3 ? (
                    <Button
                      onClick={nextStep}
                      disabled={
                        (currentStep === 1 && (!credentials.email || !credentials.password)) ||
                        (currentStep === 2 && (!preferences.jobTitle || !preferences.location))
                      }
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={startAutomation}
                      disabled={loading || !credentials.email || !credentials.password || !preferences.jobTitle || !preferences.location}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Automation
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LinkedInAutomationBot;