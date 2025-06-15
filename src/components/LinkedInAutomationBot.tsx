import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Monitor, 
  Activity, 
  Zap, 
  Bot, 
  Target, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Crown,
  Shield,
  Rocket,
  Brain,
  Eye,
  Download,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Users,
  Building,
  MapPin,
  Briefcase,
  Star,
  ArrowRight,
  Loader2,
  Info,
  Lightbulb,
  Globe,
  Search,
  Filter,
  Calendar,
  Award,
  Gauge,
  X,
  Save,
  User,
  Lock,
  Mail,
  Phone,
  FileText,
  Upload,
  Link,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';

interface AutomationStats {
  autoSteps: number;
  tokens: number;
  applications: number;
  successRate: number;
  tokensUsed: number;
  tokensRemaining: number;
}

interface TaskStatus {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStep: string;
  progress: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
}

interface LinkedInCredentials {
  email: string;
  password: string;
  twoFactorEnabled: boolean;
}

interface JobPreferences {
  jobTitle: string;
  location: string;
  experienceLevel: string;
  jobType: string;
  workType: string;
  salaryRange: string;
  keywords: string[];
  excludeKeywords: string[];
  companySize: string;
  industries: string[];
  maxApplicationsPerDay: number;
  applyToEasyApplyOnly: boolean;
  skipAlreadyApplied: boolean;
}

interface AutomationConfig {
  credentials: LinkedInCredentials;
  preferences: JobPreferences;
  isConfigured: boolean;
}

const LinkedInAutomationBot: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AutomationStats>({
    autoSteps: 0,
    tokens: 0,
    applications: 0,
    successRate: 0,
    tokensUsed: 0,
    tokensRemaining: 75
  });
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    status: 'idle',
    currentStep: 'Ready to start automation',
    progress: 0,
    timeElapsed: 0,
    estimatedTimeRemaining: 0
  });
  const [config, setConfig] = useState<AutomationConfig>({
    credentials: {
      email: '',
      password: '',
      twoFactorEnabled: false
    },
    preferences: {
      jobTitle: '',
      location: '',
      experienceLevel: '',
      jobType: '',
      workType: '',
      salaryRange: '',
      keywords: [],
      excludeKeywords: [],
      companySize: '',
      industries: [],
      maxApplicationsPerDay: 10,
      applyToEasyApplyOnly: true,
      skipAlreadyApplied: true
    },
    isConfigured: false
  });
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [configStep, setConfigStep] = useState<'credentials' | 'preferences' | 'review'>('credentials');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');

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

  const isBrowserUseConfigured = () => {
    const apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY;
    return !!(apiKey && apiKey !== 'your_browser_use_api_key_here' && apiKey.length > 10);
  };

  useEffect(() => {
    fetchStats();
    loadConfiguration();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadConfiguration = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setLoading(false);
        return;
      }

      // Load saved configuration from Supabase
      const { data: configData, error } = await supabase
        .from('automation_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading configuration:', error);
        setLoading(false);
        return;
      }

      if (configData) {
        setConfig({
          credentials: {
            email: configData.linkedin_email || '',
            password: '', // Never load password from storage
            twoFactorEnabled: configData.two_factor_enabled || false
          },
          preferences: {
            jobTitle: configData.job_title || '',
            location: configData.location || '',
            experienceLevel: configData.experience_level || '',
            jobType: configData.job_type || '',
            workType: configData.work_type || '',
            salaryRange: configData.salary_range || '',
            keywords: configData.keywords || [],
            excludeKeywords: configData.exclude_keywords || [],
            companySize: configData.company_size || '',
            industries: configData.industries || [],
            maxApplicationsPerDay: configData.max_applications_per_day || 10,
            applyToEasyApplyOnly: configData.easy_apply_only || true,
            skipAlreadyApplied: configData.skip_already_applied || true
          },
          isConfigured: !!configData.linkedin_email && !!configData.job_title
        });
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
      const configData = {
        user_id: user.id,
        linkedin_email: config.credentials.email,
        two_factor_enabled: config.credentials.twoFactorEnabled,
        job_title: config.preferences.jobTitle,
        location: config.preferences.location,
        experience_level: config.preferences.experienceLevel,
        job_type: config.preferences.jobType,
        work_type: config.preferences.workType,
        salary_range: config.preferences.salaryRange,
        keywords: config.preferences.keywords,
        exclude_keywords: config.preferences.excludeKeywords,
        company_size: config.preferences.companySize,
        industries: config.preferences.industries,
        max_applications_per_day: config.preferences.maxApplicationsPerDay,
        easy_apply_only: config.preferences.applyToEasyApplyOnly,
        skip_already_applied: config.preferences.skipAlreadyApplied,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('automation_configs')
        .upsert(configData, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      setConfig(prev => ({ ...prev, isConfigured: true }));
      setIsConfigDialogOpen(false);
      toast.success('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setStats({
          autoSteps: 0,
          tokens: 0,
          applications: 0,
          successRate: 0,
          tokensUsed: 0,
          tokensRemaining: 75
        });
        return;
      }

      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data: usageData, error: usageError } = await supabase
        .from('browser_use_logs')
        .select('step_count, cost_usd')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (usageError) {
        console.error('Error fetching usage data:', usageError);
        return;
      }

      const totalSteps = usageData?.reduce((sum, log) => sum + log.step_count, 0) || 0;
      const totalCost = usageData?.reduce((sum, log) => sum + parseFloat(log.cost_usd.toString()), 0) || 0;
      const tokens = Math.ceil(totalSteps / 10);

      const { count: applicationsCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      setStats({
        autoSteps: totalSteps,
        tokens: tokens,
        applications: applicationsCount || 0,
        successRate: applicationsCount ? Math.round((applicationsCount / Math.max(tokens, 1)) * 100) : 0,
        tokensUsed: tokens,
        tokensRemaining: Math.max(0, 75 - tokens)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const startAutomation = async () => {
    if (!isBrowserUseConfigured()) {
      toast.error('Browser Use API key not configured. Please add VITE_BROWSER_USE_API_KEY to your environment variables.');
      return;
    }

    if (!config.isConfigured) {
      toast.error('Please configure your LinkedIn credentials and job preferences first');
      setIsConfigDialogOpen(true);
      return;
    }

    if (!config.credentials.password) {
      toast.error('Please enter your LinkedIn password in the configuration');
      setIsConfigDialogOpen(true);
      setConfigStep('credentials');
      return;
    }

    setTaskStatus({
      status: 'running',
      currentStep: 'Initializing LinkedIn session...',
      progress: 10,
      timeElapsed: 0,
      estimatedTimeRemaining: 300
    });

    try {
      // Call Browser Use API to start automation
      const response = await fetch('https://api.browseruse.com/v1/run-task', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_BROWSER_USE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: `LinkedIn job application automation for ${config.preferences.jobTitle} positions`,
          session_id: `linkedin_${user?.id}_${Date.now()}`,
          max_steps: config.preferences.maxApplicationsPerDay * 10, // Estimate 10 steps per application
          include_screenshot: true,
          config: {
            credentials: {
              email: config.credentials.email,
              password: config.credentials.password,
              twoFactorEnabled: config.credentials.twoFactorEnabled
            },
            preferences: config.preferences
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      setTaskStatus(prev => ({
        ...prev,
        currentStep: 'LinkedIn session established, searching for jobs...',
        progress: 25
      }));

      toast.success('Automation started successfully!');
      
      // Start monitoring the task
      monitorTask(result.task_id);
      
    } catch (error) {
      console.error('Error starting automation:', error);
      setTaskStatus({
        status: 'error',
        currentStep: 'Failed to start automation',
        progress: 0,
        timeElapsed: 0,
        estimatedTimeRemaining: 0
      });
      toast.error('Failed to start automation. Please check your configuration and try again.');
    }
  };

  const monitorTask = async (taskId: string) => {
    // This would monitor the Browser Use API task status
    // Implementation would depend on the specific API endpoints available
    console.log('Monitoring task:', taskId);
  };

  const handlePauseAutomation = () => {
    setTaskStatus(prev => ({
      ...prev,
      status: 'paused',
      currentStep: 'Automation paused by user'
    }));
    toast.info('Automation paused');
  };

  const handleStopAutomation = () => {
    setTaskStatus({
      status: 'idle',
      currentStep: 'Ready to start automation',
      progress: 0,
      timeElapsed: 0,
      estimatedTimeRemaining: 0
    });
    toast.success('Automation stopped');
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !config.preferences.keywords.includes(newKeyword.trim())) {
      setConfig(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          keywords: [...prev.preferences.keywords, newKeyword.trim()]
        }
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        keywords: prev.preferences.keywords.filter(k => k !== keyword)
      }
    }));
  };

  const addExcludeKeyword = () => {
    if (newExcludeKeyword.trim() && !config.preferences.excludeKeywords.includes(newExcludeKeyword.trim())) {
      setConfig(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          excludeKeywords: [...prev.preferences.excludeKeywords, newExcludeKeyword.trim()]
        }
      }));
      setNewExcludeKeyword('');
    }
  };

  const removeExcludeKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        excludeKeywords: prev.preferences.excludeKeywords.filter(k => k !== keyword)
      }
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-emerald-600 dark:text-emerald-400';
      case 'paused': return 'text-amber-600 dark:text-amber-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'completed': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity className="w-4 h-4 animate-pulse" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
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
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-display-lg text-gray-900 dark:text-white mb-3">
              LinkedIn Auto Apply
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              AI-powered job application automation
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsConfigDialogOpen(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Configuration Status Banner */}
      {!config.isConfigured && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                Configuration Required
              </h3>
              <p className="text-amber-700 dark:text-amber-300 mb-4">
                Please configure your LinkedIn credentials and job preferences to start automation.
              </p>
              <Button 
                onClick={() => setIsConfigDialogOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure Now
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="premium-card p-6 hover-lift"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${getStatusColor(taskStatus.status)}`}>
              {getStatusIcon(taskStatus.status)}
              <span className="font-semibold capitalize">{taskStatus.status}</span>
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {taskStatus.currentStep}
            </div>
          </div>
          
          {taskStatus.status === 'running' && (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Progress: {taskStatus.progress}%
              </div>
              <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${taskStatus.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                Active
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.autoSteps.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Auto Steps
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Automation actions performed
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                Premium
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.tokens}
              </div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                Tokens
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Job application credits used
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                Success
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.applications}
              </div>
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Applications
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Jobs applied to this month
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                Trending
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.successRate}%
              </div>
              <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Success Rate
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Application efficiency score
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Control Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Mission Control */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="xl:col-span-2"
        >
          <Card className="premium-card hover-lift h-full">
            <CardHeader className="pb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-900 dark:text-white">Mission Control</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Real-time automation dashboard
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token Usage Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-semibold text-gray-900 dark:text-white">Monthly Token Usage</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {stats.tokensUsed}/{stats.tokensUsed + stats.tokensRemaining}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      tokens used
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <motion.div
                      className="h-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 relative overflow-hidden"
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.tokensUsed / (stats.tokensUsed + stats.tokensRemaining)) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
                    </motion.div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">0%</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {Math.round((stats.tokensUsed / (stats.tokensUsed + stats.tokensRemaining)) * 100)}% used
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">100%</span>
                  </div>
                </div>

                <div className="text-center">
                  <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    {stats.tokensRemaining} tokens remaining
                  </Badge>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex flex-col space-y-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={startAutomation}
                    disabled={taskStatus.status === 'running' || !config.isConfigured}
                    size="lg"
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl"
                  >
                    <Play className="w-5 h-5 mr-3" />
                    Start Auto Apply
                    <Sparkles className="w-5 h-5 ml-3" />
                  </Button>
                </motion.div>

                {taskStatus.status === 'running' && (
                  <div className="flex space-x-3">
                    <Button
                      onClick={handlePauseAutomation}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                    <Button
                      onClick={handleStopAutomation}
                      variant="outline"
                      size="lg"
                      className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Monitor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="xl:col-span-3"
        >
          <Card className="premium-card hover-lift h-full">
            <CardHeader className="pb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-gray-900 dark:text-white">Activity Monitor</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Real-time automation monitoring
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Terminal-like Monitor */}
                <div className="bg-gray-900 dark:bg-black rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-gray-400 text-sm font-mono">~/automation/linkedin-autoapply</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-xs font-mono">ACTIVE</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gray-800 rounded-xl flex items-center justify-center mb-6 mx-auto">
                          <Monitor className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-3">Monitoring Ready</h3>
                        <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                          {config.isConfigured 
                            ? 'Click "Start Auto Apply" to begin real-time activity monitoring'
                            : 'Configure your automation settings first, then start monitoring'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.applications}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Applications
                    </div>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {stats.successRate}%
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Success Rate
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>LinkedIn Automation Configuration</span>
            </DialogTitle>
            <DialogDescription>
              Configure your LinkedIn credentials and job search preferences for automation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Step Navigation */}
            <div className="flex items-center justify-center space-x-4">
              {['credentials', 'preferences', 'review'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      configStep === step 
                        ? 'bg-blue-600 text-white' 
                        : index < ['credentials', 'preferences', 'review'].indexOf(configStep)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {index < ['credentials', 'preferences', 'review'].indexOf(configStep) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    configStep === step ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                  {index < 2 && <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {configStep === 'credentials' && (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      LinkedIn Credentials
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Enter your LinkedIn login credentials for automation
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        LinkedIn Email *
                      </label>
                      <Input
                        type="email"
                        value={config.credentials.email}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          credentials: { ...prev.credentials, email: e.target.value }
                        }))}
                        placeholder="your.email@example.com"
                        className="premium-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        LinkedIn Password *
                      </label>
                      <Input
                        type="password"
                        value={config.credentials.password}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          credentials: { ...prev.credentials, password: e.target.value }
                        }))}
                        placeholder="Your LinkedIn password"
                        className="premium-input"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="twoFactor"
                      checked={config.credentials.twoFactorEnabled}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, twoFactorEnabled: !!checked }
                      }))}
                    />
                    <label htmlFor="twoFactor" className="text-sm text-gray-700 dark:text-gray-300">
                      Two-factor authentication is enabled on my LinkedIn account
                    </label>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Security Notice
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Your credentials are encrypted and stored securely. We recommend using an app-specific password if available.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {configStep === 'preferences' && (
                <motion.div
                  key="preferences"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Job Search Preferences
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Configure your job search criteria and automation settings
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Job Title *
                      </label>
                      <Input
                        value={config.preferences.jobTitle}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, jobTitle: e.target.value }
                        }))}
                        placeholder="e.g., Software Engineer"
                        className="premium-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Location
                      </label>
                      <Input
                        value={config.preferences.location}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, location: e.target.value }
                        }))}
                        placeholder="e.g., San Francisco, CA"
                        className="premium-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Experience Level
                      </label>
                      <Select 
                        value={config.preferences.experienceLevel} 
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, experienceLevel: value }
                        }))}
                      >
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entry">Entry Level</SelectItem>
                          <SelectItem value="mid">Mid Level</SelectItem>
                          <SelectItem value="senior">Senior Level</SelectItem>
                          <SelectItem value="executive">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Job Type
                      </label>
                      <Select 
                        value={config.preferences.jobType} 
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, jobType: value }
                        }))}
                      >
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="internship">Internship</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Work Type
                      </label>
                      <Select 
                        value={config.preferences.workType} 
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, workType: value }
                        }))}
                      >
                        <SelectTrigger className="premium-select">
                          <SelectValue placeholder="Select work type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="onsite">On-site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Salary Range
                      </label>
                      <Input
                        value={config.preferences.salaryRange}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, salaryRange: e.target.value }
                        }))}
                        placeholder="e.g., $80,000 - $120,000"
                        className="premium-input"
                      />
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Include Keywords
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="Add keyword..."
                          className="premium-input flex-1"
                          onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                        />
                        <Button onClick={addKeyword} variant="outline" size="sm">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {config.preferences.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                            <span>{keyword}</span>
                            <button
                              onClick={() => removeKeyword(keyword)}
                              className="ml-1 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Exclude Keywords
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <Input
                          value={newExcludeKeyword}
                          onChange={(e) => setNewExcludeKeyword(e.target.value)}
                          placeholder="Add keyword to exclude..."
                          className="premium-input flex-1"
                          onKeyPress={(e) => e.key === 'Enter' && addExcludeKeyword()}
                        />
                        <Button onClick={addExcludeKeyword} variant="outline" size="sm">
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {config.preferences.excludeKeywords.map((keyword, index) => (
                          <Badge key={index} variant="destructive" className="flex items-center space-x-1">
                            <span>{keyword}</span>
                            <button
                              onClick={() => removeExcludeKeyword(keyword)}
                              className="ml-1 hover:text-red-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Automation Settings */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Automation Settings
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Max Applications Per Day
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={config.preferences.maxApplicationsPerDay}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            preferences: { ...prev.preferences, maxApplicationsPerDay: parseInt(e.target.value) || 10 }
                          }))}
                          className="premium-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="easyApplyOnly"
                          checked={config.preferences.applyToEasyApplyOnly}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            preferences: { ...prev.preferences, applyToEasyApplyOnly: !!checked }
                          }))}
                        />
                        <label htmlFor="easyApplyOnly" className="text-sm text-gray-700 dark:text-gray-300">
                          Apply to Easy Apply jobs only
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skipApplied"
                          checked={config.preferences.skipAlreadyApplied}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            preferences: { ...prev.preferences, skipAlreadyApplied: !!checked }
                          }))}
                        />
                        <label htmlFor="skipApplied" className="text-sm text-gray-700 dark:text-gray-300">
                          Skip jobs I've already applied to
                        </label>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {configStep === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Review Configuration
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Review your settings before saving
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Credentials</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Email: </span>
                          <span className="text-gray-900 dark:text-white">{config.credentials.email}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Password: </span>
                          <span className="text-gray-900 dark:text-white">
                            {config.credentials.password ? '••••••••' : 'Not set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">2FA: </span>
                          <span className="text-gray-900 dark:text-white">
                            {config.credentials.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Job Preferences</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Job Title: </span>
                          <span className="text-gray-900 dark:text-white">{config.preferences.jobTitle || 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Location: </span>
                          <span className="text-gray-900 dark:text-white">{config.preferences.location || 'Any'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Experience: </span>
                          <span className="text-gray-900 dark:text-white">{config.preferences.experienceLevel || 'Any'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Max Applications/Day: </span>
                          <span className="text-gray-900 dark:text-white">{config.preferences.maxApplicationsPerDay}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {config.preferences.keywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Include Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {config.preferences.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {config.preferences.excludeKeywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Exclude Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {config.preferences.excludeKeywords.map((keyword, index) => (
                          <Badge key={index} variant="destructive">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  if (configStep === 'preferences') setConfigStep('credentials');
                  else if (configStep === 'review') setConfigStep('preferences');
                }}
                disabled={configStep === 'credentials'}
              >
                Previous
              </Button>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsConfigDialogOpen(false)}
                >
                  Cancel
                </Button>

                {configStep === 'review' ? (
                  <Button
                    onClick={saveConfiguration}
                    disabled={saving || !config.credentials.email || !config.preferences.jobTitle}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (configStep === 'credentials') setConfigStep('preferences');
                      else if (configStep === 'preferences') setConfigStep('review');
                    }}
                    disabled={
                      (configStep === 'credentials' && (!config.credentials.email || !config.credentials.password)) ||
                      (configStep === 'preferences' && !config.preferences.jobTitle)
                    }
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LinkedInAutomationBot;