import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  BarChart3, 
  FileText, 
  PenTool, 
  CreditCard, 
  User, 
  Users,
  Settings, 
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Zap,
  Search,
  Bell,
  Command,
  ChevronDown,
  Crown,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Building,
  Send,
  AlertCircle,
  Info,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { getPlanNameByPriceId } from '../../stripe-config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Logo } from '../ui/Logo';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  time: string;
  read: boolean;
  icon: React.ComponentType<{ className?: string }>;
  data?: any;
}

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCareerToolsOpen, setIsCareerToolsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('Free');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [showSupabaseWarning, setShowSupabaseWarning] = useState(false);

  // Career tools dropdown items
  const careerTools = [
    { name: 'Resume Tools', href: '/resume', icon: FileText, description: 'Resume Optimization' },
    { name: 'CV Generator', href: '/cv-generator', icon: Bot, description: 'AI CV Generation', badge: 'AI' },
    { name: 'Cover Letters', href: '/cover-letter', icon: PenTool, description: 'AI-Generated Letters' },
  ];

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3, description: 'Overview & Analytics' },
    { name: 'Auto Apply', href: '/auto-apply', icon: Zap, description: 'AI Job Applications', badge: 'New' },
    { name: 'Interview Practice', href: '/interview-practice', icon: Users, description: 'CS Interview Coaching with Voice AI', badge: 'Beta' },
    { name: 'Profile', href: '/profile', icon: User, description: 'Personal Information' },
    { name: 'Billing', href: '/billing', icon: CreditCard, description: 'Plans & Usage' },
  ];

  const quickActions = [
    { name: 'Start Auto Apply', href: '/auto-apply', icon: Zap, description: 'Begin automated job applications' },
    { name: 'Practice Interview', href: '/interview-practice', icon: Users, description: 'CS interview coaching with voice AI (Beta)' },
    { name: 'Generate CV', href: '/cv-generator', icon: Bot, description: 'Create AI-powered CV' },
    { name: 'Generate Cover Letter', href: '/cover-letter', icon: PenTool, description: 'Write personalized cover letters' },
    { name: 'Analyze Resume', href: '/resume', icon: FileText, description: 'Get AI resume feedback' },
    { name: 'View Analytics', href: '/dashboard', icon: BarChart3, description: 'Check your job search progress' },
    { name: 'Manage Profile', href: '/profile', icon: User, description: 'Update personal information' },
    { name: 'Subscription Settings', href: '/billing', icon: CreditCard, description: 'Manage billing and plans' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Escape to close search
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setIsMobileMenuOpen(false);
        setIsCareerToolsOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchUserSubscription();
    checkSupabaseConnection();
    fetchNotifications();
    
    // Set up real-time notifications
    const interval = setInterval(fetchNotifications, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [user]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    // Search through navigation items
    navigation.forEach(item => {
      if (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'navigation',
          ...item
        });
      }
    });

    // Search through quick actions
    quickActions.forEach(action => {
      if (
        action.name.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'action',
          ...action
        });
      }
    });

    // Add some contextual search suggestions
    if (query.includes('job') || query.includes('apply')) {
      results.unshift({
        type: 'suggestion',
        name: 'Start Job Applications',
        href: '/auto-apply',
        icon: Zap,
        description: 'Begin automated job applications with AI'
      });
    }

    if (query.includes('resume') || query.includes('cv')) {
      results.unshift({
        type: 'suggestion',
        name: 'Resume Tools',
        href: '/resume',
        icon: FileText,
        description: 'Analyze and improve your resume'
      });
    }

    if (query.includes('cover') || query.includes('letter')) {
      results.unshift({
        type: 'suggestion',
        name: 'Cover Letter Generator',
        href: '/cover-letter',
        icon: PenTool,
        description: 'Create personalized cover letters'
      });
    }

    setSearchResults(results.slice(0, 8)); // Limit to 8 results
  }, [searchQuery]);

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

  const checkSupabaseConnection = () => {
    const configured = isSupabaseConfigured();
    if (!configured && user) {
      setShowSupabaseWarning(true);
      // Auto-hide warning after 10 seconds
      setTimeout(() => setShowSupabaseWarning(false), 10000);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setUserPlan('Demo');
        setHasActiveSubscription(false);
        return;
      }

      // Fetch subscription using the view - filtered by current user
      const { data: subData, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        setUserPlan('Free');
        setHasActiveSubscription(false);
        return;
      }

      if (subData && subData.subscription_status === 'active') {
        // Determine plan name from price_id using stripe config
        const planName = getPlanNameByPriceId(subData.price_id) || 'Pro';
        
        setUserPlan(planName);
        setHasActiveSubscription(true);
      } else {
        setUserPlan('Free');
        setHasActiveSubscription(false);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setUserPlan('Free');
      setHasActiveSubscription(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        // Use demo notifications if not configured
        setNotifications([
          {
            id: 'demo-1',
            title: 'Welcome to Jobotic',
            message: 'Connect Supabase to see real notifications',
            type: 'info',
            time: 'Just now',
            read: false,
            icon: Info
          }
        ]);
        return;
      }

      const realNotifications: Notification[] = [];

      // Fetch recent automation tasks
      const { data: automationTasks } = await supabase
        .from('automation_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (automationTasks) {
        automationTasks.forEach(task => {
          const timeAgo = getTimeAgo(new Date(task.created_at));
          
          if (task.status === 'completed') {
            realNotifications.push({
              id: `task-${task.id}`,
              title: 'Automation Completed',
              message: `${task.task_type} task finished successfully`,
              type: 'success',
              time: timeAgo,
              read: false,
              icon: CheckCircle,
              data: { taskId: task.task_id, type: task.task_type }
            });
          } else if (task.status === 'failed') {
            realNotifications.push({
              id: `task-${task.id}`,
              title: 'Automation Failed',
              message: task.error_message || 'Task encountered an error',
              type: 'error',
              time: timeAgo,
              read: false,
              icon: AlertCircle,
              data: { taskId: task.task_id, error: task.error_message }
            });
          } else if (task.status === 'running') {
            realNotifications.push({
              id: `task-${task.id}`,
              title: 'Automation Running',
              message: `${task.task_type} task is in progress`,
              type: 'info',
              time: timeAgo,
              read: false,
              icon: Clock,
              data: { taskId: task.task_id, type: task.task_type }
            });
          }
        });
      }

      // Fetch recent applications
      const { data: recentApplications } = await supabase
        .from('applications')
        .select(`
          *,
          job_campaigns!campaign_id(
            profiles!inner(user_id)
          )
        `)
        .eq('job_campaigns.profiles.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentApplications) {
        recentApplications.forEach(app => {
          const timeAgo = getTimeAgo(new Date(app.created_at));
          
          realNotifications.push({
            id: `app-${app.id}`,
            title: 'Job Application Submitted',
            message: `Applied to ${app.role || 'position'} at ${app.company || 'company'}`,
            type: 'success',
            time: timeAgo,
            read: false,
            icon: Send,
            data: { applicationId: app.id, company: app.company, role: app.role }
          });
        });
      }

      // Check token usage and add warnings if needed
      const { data: tokenUsage } = await supabase.rpc('get_user_monthly_ai_tokens', {
        user_uuid: user.id,
        target_date: new Date().toISOString().split('T')[0]
      });

      if (tokenUsage) {
        const result = Array.isArray(tokenUsage) ? tokenUsage[0] : tokenUsage;
        const totalTokens = Number(result?.total_tokens) || 0;
        const usagePercentage = (totalTokens / 150000) * 100; // 150k monthly limit

        if (usagePercentage >= 90) {
          realNotifications.unshift({
            id: 'token-warning-critical',
            title: 'Token Limit Critical',
            message: 'You\'ve used 90% of your monthly AI tokens',
            type: 'error',
            time: 'Now',
            read: false,
            icon: AlertTriangle
          });
        } else if (usagePercentage >= 75) {
          realNotifications.unshift({
            id: 'token-warning',
            title: 'Token Usage High',
            message: 'You\'ve used 75% of your monthly AI tokens',
            type: 'warning',
            time: 'Now',
            read: false,
            icon: AlertCircle
          });
        }
      }

      // Check browser use logs for recent activity
      const { data: browserLogs } = await supabase
        .from('browser_use_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (browserLogs) {
        browserLogs.forEach(log => {
          const timeAgo = getTimeAgo(new Date(log.created_at));
          
          realNotifications.push({
            id: `browser-${log.id}`,
            title: 'Automation Activity',
            message: `${log.step_count} automation steps completed`,
            type: 'info',
            time: timeAgo,
            read: false,
            icon: Bot,
            data: { stepCount: log.step_count, cost: log.cost_usd }
          });
        });
      }

      // Sort by time and limit to 10 most recent
      realNotifications.sort((a, b) => {
        const timeA = parseTimeAgo(a.time);
        const timeB = parseTimeAgo(b.time);
        return timeA - timeB;
      });

      setNotifications(realNotifications.slice(0, 10));

    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Fallback to demo notification
      setNotifications([
        {
          id: 'error-1',
          title: 'Notification Error',
          message: 'Unable to load recent notifications',
          type: 'error',
          time: 'Just now',
          read: false,
          icon: AlertCircle
        }
      ]);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const parseTimeAgo = (timeStr: string): number => {
    if (timeStr === 'Just now' || timeStr === 'Now') return 0;
    if (timeStr.includes('minute')) return parseInt(timeStr) * 60;
    if (timeStr.includes('hour')) return parseInt(timeStr) * 3600;
    if (timeStr.includes('day')) return parseInt(timeStr) * 86400;
    return 999999; // Old notifications
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation even if sign out fails
      navigate('/auth');
    }
  };

  const handleSearchSelect = (result: any) => {
    navigate(result.href);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== id)
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-emerald-500';
      case 'warning':
        return 'text-amber-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Supabase Connection Warning */}
      <AnimatePresence>
        {showSupabaseWarning && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="bg-amber-500 text-white px-4 py-3 text-center relative"
          >
            <div className="flex items-center justify-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Supabase not connected - Click "Connect to Supabase" in the top-right corner to enable full functionality
              </span>
              <button
                onClick={() => setShowSupabaseWarning(false)}
                className="ml-4 hover:bg-white/20 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="glass backdrop-blur-xl border-b border-white/20 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center space-x-3 group">
                <div className="relative w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <Logo 
                    width={32} 
                    height={32} 
                    className="object-contain"
                  />
                  {hasActiveSubscription && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="hidden sm:block">
                  <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Jobotic
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                    {hasActiveSubscription ? 'Premium' : isSupabaseConfigured() ? 'Free' : 'Demo'}
                  </div>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                );
              })}
              
              {/* Career Tools Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsCareerToolsOpen(!isCareerToolsOpen)}
                  className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    careerTools.some(tool => location.pathname === tool.href)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Career Tools</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isCareerToolsOpen ? 'rotate-180' : ''}`} />
                  {careerTools.some(tool => tool.badge) && (
                    <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                      AI
                    </span>
                  )}
                  {careerTools.some(tool => location.pathname === tool.href) && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {isCareerToolsOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 backdrop-blur-xl"
                    >
                      {careerTools.map((tool) => {
                        const Icon = tool.icon;
                        const isActive = location.pathname === tool.href;
                        
                        return (
                          <Link
                            key={tool.name}
                            to={tool.href}
                            onClick={() => setIsCareerToolsOpen(false)}
                            className={`flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <Icon className="w-4 h-4" />
                              <div>
                                <div className="font-medium">{tool.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</div>
                              </div>
                            </div>
                            {tool.badge && (
                              <span className="px-2 py-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                                {tool.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden md:flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 text-gray-600 dark:text-gray-300"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">Search</span>
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </button>

              {/* Mobile search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-96 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllNotificationsAsRead}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map((notification) => {
                            const Icon = notification.icon;
                            return (
                              <div
                                key={notification.id}
                                className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer border-l-4 ${
                                  !notification.read 
                                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' 
                                    : 'border-transparent'
                                }`}
                                onClick={() => markNotificationAsRead(notification.id)}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className={`p-2 rounded-lg ${getNotificationIcon(notification.type)} bg-gray-100 dark:bg-gray-700`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className={`text-sm font-medium ${
                                        !notification.read 
                                          ? 'text-gray-900 dark:text-white' 
                                          : 'text-gray-600 dark:text-gray-300'
                                      }`}>
                                        {notification.title}
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          clearNotification(notification.id);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                      {notification.time}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-8 text-center">
                            <Bell className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 dark:text-gray-400">No notifications</p>
                          </div>
                        )}
                      </div>
                      
                      {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                          <button 
                            onClick={fetchNotifications}
                            className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                          >
                            Refresh notifications
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user?.email?.split('@')[0] || 'Demo User'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      {hasActiveSubscription && <Crown className="w-3 h-3 mr-1 text-yellow-500" />}
                      {userPlan} Plan
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user?.email?.split('@')[0] || 'Demo User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user?.email || 'demo@jobotic.ai'}
                            </p>
                            <div className="flex items-center mt-1">
                              {hasActiveSubscription && <Crown className="w-3 h-3 mr-1 text-yellow-500" />}
                              <span className={`text-xs font-medium ${
                                hasActiveSubscription 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {userPlan} Plan {hasActiveSubscription ? 'Active' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="py-2">
                        <Link
                          to="/profile"
                          onClick={() => setIsProfileOpen(false)}
                          className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <User className="w-4 h-4 mr-3" />
                          Profile Settings
                        </Link>
                        
                        <Link
                          to="/billing"
                          onClick={() => setIsProfileOpen(false)}
                          className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <CreditCard className="w-4 h-4 mr-3" />
                          {hasActiveSubscription ? 'Manage Subscription' : 'Upgrade Plan'}
                        </Link>
                        
                        <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <Settings className="w-4 h-4 mr-3" />
                          Account Settings
                        </button>
                        
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-4"
              >
                <div className="space-y-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5" />
                          <div>
                            <div>{item.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                          </div>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  
                  {/* Career Tools Section for Mobile */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Career Tools
                    </div>
                    {careerTools.map((tool) => {
                      const Icon = tool.icon;
                      const isActive = location.pathname === tool.href;
                      
                      return (
                        <Link
                          key={tool.name}
                          to={tool.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className="w-5 h-5" />
                            <div>
                              <div>{tool.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</div>
                            </div>
                          </div>
                          {tool.badge && (
                            <span className="px-2 py-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                              {tool.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Enhanced Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl mx-4 glass-card rounded-3xl shadow-3xl border border-white/20 dark:border-gray-700/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3 mb-6">
                  <Search className="w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search for features, pages, or actions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-lg border-none shadow-none focus:ring-0 pl-2"
                    autoFocus
                  />
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <span>ESC</span>
                  </div>
                </form>

                {searchQuery === '' ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      {quickActions.slice(0, 5).map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.name}
                            onClick={() => handleSearchSelect(action)}
                            className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <Icon className="w-5 h-5 text-gray-400" />
                            <div>
                              <div className="text-gray-900 dark:text-white font-medium">{action.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{action.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    {searchResults.length > 0 ? (
                      <>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Search Results ({searchResults.length})
                        </h3>
                        <div className="space-y-2">
                          {searchResults.map((result, index) => {
                            const Icon = result.icon;
                            return (
                              <button
                                key={`${result.type}-${result.name}-${index}`}
                                onClick={() => handleSearchSelect(result)}
                                className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <Icon className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                  <div className="text-gray-900 dark:text-white font-medium">{result.name}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{result.description}</div>
                                </div>
                                {result.type === 'suggestion' && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                    Suggested
                                  </span>
                                )}
                                {result.badge && (
                                  <span className="px-2 py-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                                    {result.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          No results found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Try searching for "resume", "jobs", "cover letter", or "billing"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};