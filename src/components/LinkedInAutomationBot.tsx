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
  Gauge
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  const [isConfigured, setIsConfigured] = useState(false);
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
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  const fetchStats = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        // Demo data
        setStats({
          autoSteps: 0,
          tokens: 0,
          applications: 0,
          successRate: 0,
          tokensUsed: 0,
          tokensRemaining: 75
        });
        setIsConfigured(false);
        return;
      }

      // Fetch real stats from Supabase
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
      const tokens = Math.ceil(totalSteps / 10); // 10 steps = 1 token

      // Get applications count
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
        tokensRemaining: Math.max(0, 75 - tokens) // Assuming 75 token limit
      });

      setIsConfigured(true);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAutomation = () => {
    if (!isSupabaseConfigured()) {
      toast.error('Please connect Supabase to enable automation features');
      return;
    }
    
    setTaskStatus({
      status: 'running',
      currentStep: 'Initializing LinkedIn session...',
      progress: 10,
      timeElapsed: 0,
      estimatedTimeRemaining: 300
    });
    toast.success('Automation started!');
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
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </motion.div>

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
        {/* Auto Steps */}
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

        {/* Tokens */}
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

        {/* Applications */}
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

        {/* Success Rate */}
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
        {/* Mission Control - Now smaller (2/5 width) */}
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
                    onClick={handleStartAutomation}
                    disabled={taskStatus.status === 'running'}
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

        {/* Activity Monitor - Now larger (3/5 width) */}
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
                          Configure your automation settings and click <span className="text-blue-400 font-medium">"Start Auto Apply"</span> to begin real-time activity monitoring
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

      {/* Configuration Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="premium-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900 dark:text-white">Automation Configuration</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Set up your job search preferences and automation parameters
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Job Title</label>
                <Input placeholder="e.g., Software Engineer" className="bg-white/50 dark:bg-gray-800/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Location</label>
                <Input placeholder="e.g., San Francisco, CA" className="bg-white/50 dark:bg-gray-800/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Experience Level</label>
                <Select>
                  <SelectTrigger className="bg-white/50 dark:bg-gray-800/50">
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
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Job Type</label>
                <Select>
                  <SelectTrigger className="bg-white/50 dark:bg-gray-800/50">
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
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button variant="outline" className="mr-3">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button>
                <CheckCircle className="w-4 h-4 mr-2" />
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LinkedInAutomationBot;