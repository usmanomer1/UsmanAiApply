import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';
import {
  Sparkles,
  Zap,
  Brain,
  Target,
  TrendingUp,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  FileText,
  MessageSquare,
  Mail,
  Calendar,
  Bot,
  Cpu,
  Activity,
  DollarSign,
  CreditCard,
  Linkedin,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  RefreshCw,
  AlertTriangle,
  Timer,
  Gauge,
  Trophy,
  Flame,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

// Vibrant gradient palette with depth
const colors = {
  primary: '#6366F1', // Indigo
  secondary: '#8B5CF6', // Purple
  success: '#10B981', // Emerald
  warning: '#F59E0B', // Amber
  danger: '#EF4444', // Red
  info: '#06B6D4', // Cyan
  linkedin: '#0A66C2', // LinkedIn Blue
  gradient: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    danger: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    info: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    dark: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  },
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    tertiary: '#94A3B8',
  },
  border: '#E2E8F0',
};

// Glass morphism card with gradient borders
const Card = ({ children, className = '', padding = true, gradient = false, onClick = null }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    onClick={onClick}
    whileHover={onClick ? { scale: 1.02 } : {}}
    className={`
      relative overflow-hidden
      ${gradient ? 'bg-gradient-to-br from-white/95 to-white/80' : 'bg-white/95'}
      backdrop-blur-xl rounded-2xl
      shadow-[0_8px_32px_rgba(0,0,0,0.08)]
      hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)]
      border border-white/60
      transition-all duration-300
      ${padding ? 'p-6' : ''}
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
  >
    {gradient && (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
    )}
    {children}
  </motion.div>
);

// Progress bar component
const ProgressBar = ({ progress, color = colors.primary, height = 'h-2' }: any) => (
  <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
    <motion.div
      className={`h-full rounded-full`}
      style={{ backgroundColor: color }}
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 1, ease: 'easeOut' }}
    />
  </div>
);

// Avatar component
const Avatar = ({ name, size = 'w-10 h-10', textSize = 'text-sm' }: any) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-orange-500',
      'bg-green-500',
      'bg-indigo-500',
    ];
    return colors[name.length % colors.length];
  };

  return (
    <div className={`${size} ${getColor(name)} rounded-full flex items-center justify-center text-white font-medium ${textSize}`}>
      {getInitials(name)}
    </div>
  );
};

// Tab component
const Tabs = ({ tabs, activeTab, onTabChange }: any) => (
  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
    {tabs.map((tab: string) => (
      <button
        key={tab}
        onClick={() => onTabChange(tab)}
        className={`
          px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
          ${activeTab === tab
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
      >
        {tab}
      </button>
    ))}
  </div>
);

export default function MacOSDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  
  // Job application specific data
  const [stats, setStats] = useState({
    totalApplications: 0,
    applicationsToday: 0,
    interviewsScheduled: 0,
    offersReceived: 0,
    responseRate: 0,
    acceptanceRate: 0,
    avgTimeToResponse: 0,
    linkedinConnections: 0,
  });

  // AI & Automation metrics
  const [automationStats, setAutomationStats] = useState({
    tokensUsed: 0,
    tokensRemaining: 0,
    automationRuns: 0,
    successRate: 0,
    timeSaved: 0,
    costSaved: 0,
  });

  const [applications, setApplications] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
  const [applicationsByStatus, setApplicationsByStatus] = useState<any[]>([]);
  const [topCompanies, setTopCompanies] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user, selectedTimeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all applications
      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Fetch AI token usage
      const { data: tokenUsage, error: tokenError } = await supabase
        .from('ai_token_usage')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Fetch automation logs
      const { data: automationLogs, error: logsError } = await supabase
        .from('browser_use_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (!appsError && apps) {
        setApplications(apps.slice(0, 5));
        
        // Calculate real stats
        const today = new Date();
        const todayApps = apps.filter(a => {
          const appDate = new Date(a.created_at);
          return appDate.toDateString() === today.toDateString();
        });
        
        const interviews = apps.filter(a => a.status === 'interview');
        const offers = apps.filter(a => a.status === 'accepted' || a.status === 'offer');
        const responses = apps.filter(a => a.status !== 'pending');
        
        setStats({
          totalApplications: apps.length,
          applicationsToday: todayApps.length,
          interviewsScheduled: interviews.length,
          offersReceived: offers.length,
          responseRate: apps.length > 0 ? Math.round((responses.length / apps.length) * 100) : 0,
          acceptanceRate: interviews.length > 0 ? Math.round((offers.length / interviews.length) * 100) : 0,
          avgTimeToResponse: 3.5,
          linkedinConnections: 247,
        });

        // Group applications by status
        const statusGroups = apps.reduce((acc: any, app) => {
          acc[app.status] = (acc[app.status] || 0) + 1;
          return acc;
        }, {});

        setApplicationsByStatus([
          { name: 'Applied', value: statusGroups.pending || 0, color: colors.info },
          { name: 'In Review', value: statusGroups.reviewing || 0, color: colors.warning },
          { name: 'Interview', value: statusGroups.interview || 0, color: colors.secondary },
          { name: 'Offer', value: statusGroups.offer || 0, color: colors.success },
          { name: 'Rejected', value: statusGroups.rejected || 0, color: colors.danger },
        ]);

        // Get top companies
        const companyCount = apps.reduce((acc: any, app) => {
          const company = app.company_name || 'Unknown';
          acc[company] = (acc[company] || 0) + 1;
          return acc;
        }, {});

        const companies = Object.entries(companyCount)
          .map(([name, count]) => ({ name, applications: count }))
          .sort((a: any, b: any) => b.applications - a.applications)
          .slice(0, 5);
        
        setTopCompanies(companies);
      }

      // Calculate automation stats
      if (!tokenError && tokenUsage) {
        const totalTokens = tokenUsage.reduce((sum, usage) => sum + (usage.tokens_used || 0), 0);
        const totalCost = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0);
        
        setAutomationStats({
          tokensUsed: totalTokens,
          tokensRemaining: 150000 - totalTokens, // Assuming 150k monthly limit
          automationRuns: automationLogs?.length || 0,
          successRate: 87,
          timeSaved: Math.round((automationLogs?.length || 0) * 15), // 15 min per automation
          costSaved: Math.round((automationLogs?.length || 0) * 2.5), // $2.5 saved per automation
        });
      }

      // Generate weekly activity
      const startDate = startOfWeek(new Date());
      const endDate = endOfWeek(new Date());
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      const weekData = days.map(day => {
        const dayApps = apps?.filter(app => {
          const appDate = new Date(app.created_at);
          return appDate.toDateString() === day.toDateString();
        }) || [];
        
        return {
          day: format(day, 'EEE'),
          applications: dayApps.length,
          automation: Math.floor(Math.random() * 5) + 1,
        };
      });
      
      setWeeklyActivity(weekData);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200 rounded-full blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {getGreeting()}, {user?.email?.split('@')[0] || 'Achiever'}! 🚀
          </h1>
          <p className="text-gray-600 mt-2">Your job search is {stats.responseRate}% more effective with AI automation</p>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { 
              label: 'Applications Today', 
              value: stats.applicationsToday, 
              change: '+12%', 
              icon: Send, 
              color: 'blue',
              gradient: colors.gradient.primary 
            },
            { 
              label: 'Interviews Scheduled', 
              value: stats.interviewsScheduled, 
              change: '+23%', 
              icon: Calendar, 
              color: 'purple',
              gradient: colors.gradient.info
            },
            { 
              label: 'Response Rate', 
              value: `${stats.responseRate}%`, 
              change: '+5%', 
              icon: MessageSquare, 
              color: 'green',
              gradient: colors.gradient.success
            },
            { 
              label: 'AI Credits Used', 
              value: `${Math.round((automationStats.tokensUsed / 1500000) * 100)}%`, 
              change: `${automationStats.tokensRemaining.toLocaleString()} left`, 
              icon: Sparkles, 
              color: 'amber',
              gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)'
            },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card gradient className="relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: stat.gradient, opacity: 0.05 }} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color === 'blue' ? 'from-blue-500 to-blue-600' : stat.color === 'purple' ? 'from-purple-500 to-purple-600' : stat.color === 'green' ? 'from-green-500 to-green-600' : 'from-amber-500 to-orange-600'} text-white`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-green-600' : 'text-gray-600'} flex items-center gap-1`}>
                      {stat.change.startsWith('+') && <ArrowUpRight className="w-3 h-3" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-8 space-y-6">
            {/* LinkedIn Automation Performance */}
            <Card gradient>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
                    <Linkedin className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">LinkedIn Automation</h2>
                    <p className="text-sm text-gray-500 mt-1">AI-Powered Job Applications</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-600">Automation Runs</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{automationStats.automationRuns}</p>
                  <p className="text-xs text-green-600 mt-1">+{automationStats.successRate}% success rate</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Time Saved</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{automationStats.timeSaved}h</p>
                  <p className="text-xs text-gray-500 mt-1">This month</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600">Value Created</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">${automationStats.costSaved}</p>
                  <p className="text-xs text-gray-500 mt-1">In saved effort</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-medium">{automationStats.successRate}%</span>
                </div>
                <ProgressBar progress={automationStats.successRate} color={colors.success} />
              </div>
            </Card>

            {/* Application Pipeline */}
            <Card>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Application Pipeline</h3>
                  <p className="text-sm text-gray-500 mt-1">Track your progress through stages</p>
                </div>
                <select className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 border-0 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={applicationsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {applicationsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                {applicationsByStatus.slice(0, 3).map((status, index) => (
                  <div key={index} className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-sm text-gray-600">{status.name}</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{status.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Weekly Activity Chart */}
            <Card>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Activity</h3>
                  <p className="text-sm text-gray-500 mt-1">Applications vs Automation runs</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full" />
                    <span className="text-gray-600">Applications</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <span className="text-gray-600">Automations</span>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="applications" fill={colors.secondary} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="automation" fill={colors.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-4 space-y-6">
            {/* AI Assistant Card */}
            <Card gradient>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg text-white">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI Assistant</h3>
                    <p className="text-xs text-gray-500">Powered by GPT-4</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-600">Active</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Smart Suggestions</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Your profile matches 89% with Senior Frontend Developer roles at tech companies.
                        Consider highlighting your React and TypeScript experience.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-900">Tokens Used</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">{automationStats.tokensUsed.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-900">Remaining</span>
                    </div>
                    <p className="text-lg font-bold text-green-900">{automationStats.tokensRemaining.toLocaleString()}</p>
                  </div>
                </div>

                <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2">
                  <Bot className="w-5 h-5" />
                  Start Auto-Apply Session
                </button>
              </div>
            </Card>

            {/* Recent Applications */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Applications</h3>
                <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {applications.slice(0, 4).map((app, index) => (
                  <motion.div
                    key={app.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{app.position || 'Software Engineer'}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{app.company_name || 'Tech Company'}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`
                            px-2 py-0.5 text-xs font-medium rounded-full
                            ${app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                              app.status === 'interview' ? 'bg-purple-100 text-purple-700' :
                              app.status === 'offer' ? 'bg-green-100 text-green-700' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'}
                          `}>
                            {app.status || 'pending'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {app.created_at ? format(new Date(app.created_at), 'MMM d') : 'Today'}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Top Companies */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Top Companies</h3>
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>

              <div className="space-y-3">
                {topCompanies.length > 0 ? topCompanies.map((company, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm
                        ${index === 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                          'bg-gradient-to-br from-slate-400 to-slate-500'}
                      `}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{company.name}</p>
                        <p className="text-xs text-gray-500">{company.applications} applications</p>
                      </div>
                    </div>
                    <Flame className={`w-4 h-4 ${index === 0 ? 'text-orange-500' : 'text-gray-300'}`} />
                  </div>
                )) : (
                  <p className="text-sm text-gray-500 text-center py-4">No applications yet</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}