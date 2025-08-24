import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Briefcase, 
  Users,
  Calendar,
  Activity,
  ArrowUp,
  ArrowDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Target,
  BarChart3,
  Bot,
  CheckCircle,
  Clock,
  Zap,
  Eye,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  ComposedChart,
  Bar
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import ConditionalBackground from '../ui/ConditionalBackground';

interface DashboardStats {
  totalApplications: number;
  interviewRate: number;
  responseRate: number;
  activeApplications: number;
  weeklyChange: number;
  monthlyTrend: Array<{ date: string; applications: number }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
}

interface RecentApplication {
  id: string;
  company_name: string;
  job_title: string;
  created_at: string;
  status: 'applied' | 'interviewing' | 'rejected' | 'offered';
  company_logo?: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    interviewRate: 0,
    responseRate: 0,
    activeApplications: 0,
    weeklyChange: 0,
    monthlyTrend: [],
    statusDistribution: []
  });
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Refresh dashboard data when the page gains focus (e.g., after adding an application)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchDashboardData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch applications
      const { data: applications, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Dashboard applications data:', applications);

      // Calculate stats - handle both uppercase and lowercase status values
      const total = applications?.length || 0;
      const interviewed = applications?.filter(app => {
        const status = app.status?.toUpperCase();
        return status === 'INTERVIEW' || status === 'OA' || status === 'INTERVIEWING' || status === 'OFFERED';
      }).length || 0;
      const responded = applications?.filter(app => {
        const status = app.status?.toUpperCase();
        return status !== 'SENT' && status !== 'PENDING' && status !== 'APPLIED';
      }).length || 0;
      const active = applications?.filter(app => {
        const status = app.status?.toUpperCase();
        return status === 'SENT' || status === 'PENDING' || status === 'INTERVIEW' || status === 'OA' || status === 'APPLIED' || status === 'INTERVIEWING';
      }).length || 0;

      // Calculate weekly change
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const thisWeekApps = applications?.filter(app => 
        new Date(app.created_at) > lastWeek
      ).length || 0;
      const lastWeekApps = applications?.filter(app => 
        new Date(app.created_at) > twoWeeksAgo && new Date(app.created_at) <= lastWeek
      ).length || 0;
      
      const weeklyChange = lastWeekApps > 0 
        ? ((thisWeekApps - lastWeekApps) / lastWeekApps) * 100 
        : thisWeekApps * 100;

      // Generate monthly trend data
      const monthlyTrend = generateMonthlyTrend(applications || []);

      // Calculate status distribution - handle various status values
      const statusCounts = {
        applied: applications?.filter(app => {
          const status = app.status?.toUpperCase();
          return status === 'SENT' || status === 'PENDING' || status === 'APPLIED' || status === 'SUCCESS';
        }).length || 0,
        interviewing: applications?.filter(app => {
          const status = app.status?.toUpperCase();
          return status === 'INTERVIEW' || status === 'OA' || status === 'INTERVIEWING';
        }).length || 0,
        rejected: applications?.filter(app => {
          const status = app.status?.toUpperCase();
          return status === 'REJECTED' || status === 'FAILED';
        }).length || 0,
        offered: applications?.filter(app => {
          const status = app.status?.toUpperCase();
          return status === 'ACCEPTED' || status === 'OFFERED' || status === 'OFFER';
        }).length || 0
      };
      
      console.log('Raw application statuses:', applications?.map(app => app.status));
      console.log('Calculated status counts:', statusCounts);

      const statusDistribution = [
        { name: 'Applied', value: statusCounts.applied, color: '#14b8a6' },
        { name: 'Interviewing', value: statusCounts.interviewing, color: '#0d9488' },
        { name: 'Rejected', value: statusCounts.rejected, color: '#9ca3af' },
        { name: 'Offered', value: statusCounts.offered, color: '#10b981' }
      ].filter(item => item.value > 0);

      console.log('Status counts:', statusCounts);
      console.log('Status distribution:', statusDistribution);

      setStats({
        totalApplications: total,
        interviewRate: total > 0 ? Math.round((interviewed / total) * 100) : 0,
        responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
        activeApplications: active,
        weeklyChange,
        monthlyTrend,
        statusDistribution
      });

      // Transform recent applications - handle both field names
      const recentApps: RecentApplication[] = (applications?.slice(0, 20) || []).map(app => ({
        id: app.id,
        company_name: app.company_name || app.company || 'Unknown Company',
        job_title: app.job_title || app.role || 'Unknown Position',
        created_at: app.created_at,
        status: app.status || 'applied',
        company_logo: app.company_logo || app.details?.company_logo
      }));

      setRecentApplications(recentApps);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyTrend = (applications: any[]) => {
    const trend = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const count = applications.filter(app => {
        const appDate = new Date(app.created_at);
        return appDate.toDateString() === date.toDateString();
      }).length;
      
      trend.push({ date: dateStr, applications: count });
    }
    
    return trend;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'bg-teal-100 text-teal-700';
      case 'interviewing': return 'bg-blue-100 text-blue-700';
      case 'rejected': return 'bg-gray-100 text-gray-700';
      case 'offered': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const statCards = [
    {
      title: 'Total Applications',
      value: stats.totalApplications,
      change: stats.weeklyChange,
      icon: Target,
      gradient: 'bg-gradient-to-br from-teal-500 to-emerald-600',
      bgGradient: 'bg-gradient-to-br from-teal-50/50 to-emerald-50/50',
      ringColor: 'ring-teal-500/20',
      textColor: 'text-teal-600',
      subtext: '+' + stats.monthlyTrend.slice(-7).reduce((sum, day) => sum + day.applications, 0) + ' this week',
      sparkles: true
    },
    {
      title: 'Interview Rate',
      value: `${stats.interviewRate}%`,
      change: null,
      icon: BarChart3,
      gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      bgGradient: 'bg-gradient-to-br from-blue-50/50 to-indigo-50/50',
      ringColor: 'ring-blue-500/20',
      textColor: 'text-blue-600',
      progress: stats.interviewRate,
      subtext: 'Success rate',
      hasProgressBar: true
    },
    {
      title: 'Response Rate',
      value: `${stats.responseRate}%`,
      change: null,
      icon: Activity,
      gradient: 'bg-gradient-to-br from-purple-500 to-pink-600',
      bgGradient: 'bg-gradient-to-br from-purple-50/50 to-pink-50/50',
      ringColor: 'ring-purple-500/20',
      textColor: 'text-purple-600',
      progress: stats.responseRate,
      subtext: 'Employer responses',
      hasChart: true,
      hasProgressBar: true
    },
    {
      title: 'Active Jobs',
      value: stats.activeApplications,
      change: null,
      icon: Clock,
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
      bgGradient: 'bg-gradient-to-br from-amber-50/50 to-orange-50/50',
      ringColor: 'ring-amber-500/20',
      textColor: 'text-amber-600',
      subtext: 'In progress',
      isPulse: true
    }
  ];

  // Pagination
  const totalPages = Math.ceil(recentApplications.length / itemsPerPage);
  const paginatedApplications = recentApplications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConditionalBackground className="fixed inset-0 z-0" animate={true} />
      <div className="relative z-10 space-y-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  Welcome back, {user?.user_metadata?.full_name || 'there'}! 
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300">Here's your job search overview</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white/30 transition-all shadow-lg"
            >
              <Calendar className="h-4 w-4" />
              {dateRange}
            </motion.button>
            
            <Link to="/auto-apply">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl text-sm font-semibold hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Zap className="h-4 w-4" />
                Start Auto Apply
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Quick Insights Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-teal-50/60 to-emerald-50/60 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center gap-6">
              <span className="text-gray-600 dark:text-gray-300 font-medium">This week:</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.monthlyTrend.slice(-7).reduce((sum, day) => sum + day.applications, 0)} applications
                </span>
                {stats.weeklyChange > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-100/50 px-3 py-1 rounded-full">
                    <ArrowUp className="h-4 w-4" />
                    {Math.abs(stats.weeklyChange).toFixed(0)}%
                  </span>
                ) : stats.weeklyChange < 0 ? (
                  <span className="flex items-center gap-1 text-red-600 font-semibold bg-red-100/50 px-3 py-1 rounded-full">
                    <ArrowDown className="h-4 w-4" />
                    {Math.abs(stats.weeklyChange).toFixed(0)}%
                  </span>
                ) : null}
              </div>
            </div>
            <Link to="/jobs" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-semibold group">
              Find more jobs
              <ArrowUp className="h-4 w-4 rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`relative overflow-hidden bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 ${stat.ringColor} ring-1`}
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 ${stat.bgGradient} opacity-30`}></div>
              
              {/* Sparkles Effect */}
              {stat.sparkles && (
                <div className="absolute top-4 right-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5 text-teal-400 opacity-60" />
                  </motion.div>
                </div>
              )}
              
              {/* Pulse Animation */}
              {stat.isPulse && (
                <div className="absolute top-4 right-4">
                  <div className="relative">
                    <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                  </div>
                </div>
              )}
              
              <div className="relative z-10">
                {/* Icon and Change Indicator */}
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-4 ${stat.gradient} rounded-2xl shadow-lg`}>
                    <stat.icon className="h-7 w-7 text-white" />
                  </div>
                  {stat.change !== null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className={`flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full ${
                        stat.change > 0 
                          ? 'text-emerald-700 bg-emerald-100/60' 
                          : stat.change < 0 
                            ? 'text-red-700 bg-red-100/60' 
                            : 'text-gray-700 bg-gray-100/60'
                      }`}
                    >
                      {stat.change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {Math.abs(stat.change).toFixed(0)}%
                    </motion.div>
                  )}
                </div>
                
                {/* Value and Title */}
                <div className="space-y-2 mb-4">
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="text-3xl font-bold text-gray-900 dark:text-white"
                  >
                    {stat.value}
                  </motion.h3>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                  <p className={`text-xs font-medium ${stat.textColor}`}>{stat.subtext}</p>
                </div>

                {/* Progress Bar */}
                {stat.hasProgressBar && stat.progress !== undefined && (
                  <div className="mb-4">
                    <div className="relative w-full h-2 bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.progress}%` }}
                        transition={{ duration: 1.5, delay: 0.5 + index * 0.1, ease: "easeOut" }}
                        className={`absolute inset-y-0 left-0 ${stat.gradient} rounded-full`}
                      />
                    </div>
                  </div>
                )}

                {/* Mini Chart */}
                {stat.hasChart && (
                  <div className="h-16 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.monthlyTrend.slice(-7)}>
                        <Line 
                          type="monotone" 
                          dataKey="applications" 
                          stroke="#a855f7" 
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Enhanced Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Application Status Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-1 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Status Distribution</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Application breakdown</p>
              </div>
            </div>
            
            {stats.statusDistribution.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge> 
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <Pie
                      data={stats.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {stats.statusDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          filter="url(#glow)"
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '16px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        backdropFilter: 'blur(20px)'
                      }}
                      labelStyle={{ color: isDark ? '#f9fafb' : '#111827', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {stats.statusDistribution.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="flex items-center gap-3 p-3 bg-white/30 dark:bg-gray-700/30 rounded-2xl backdrop-blur-sm"
                    >
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm" 
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{item.value}%</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-200/50 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-center">No application data yet</p>
              </div>
            )}
          </motion.div>

          {/* Application Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Application Trend</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Daily activity over the last 30 days</p>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="currentColor" 
                    opacity={0.1}
                    className="text-gray-300 dark:text-gray-600"
                  />
                  
                  <XAxis 
                    dataKey="date" 
                    stroke="currentColor"
                    className="text-gray-500 dark:text-gray-400"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor' }}
                  />
                  
                  <YAxis 
                    stroke="currentColor"
                    className="text-gray-500 dark:text-gray-400"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor' }}
                  />
                  
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '16px',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      backdropFilter: 'blur(20px)'
                    }}
                    labelStyle={{ color: isDark ? '#f9fafb' : '#111827', fontWeight: 'bold' }}
                    itemStyle={{ color: '#14b8a6' }}
                  />
                  
                  <Area
                    type="monotone"
                    dataKey="applications"
                    stroke="url(#colorLine)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorApplications)"
                  />
                  
                  <Line 
                    type="monotone" 
                    dataKey="applications" 
                    stroke="url(#colorLine)" 
                    strokeWidth={3}
                    dot={{ fill: '#14b8a6', strokeWidth: 0, r: 6 }}
                    activeDot={{ r: 8, stroke: '#14b8a6', strokeWidth: 3, fill: 'white' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Premium Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-r from-teal-50/40 via-emerald-50/40 to-blue-50/40 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-xl"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Insights</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Smart recommendations for your job search</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-6 h-6 text-teal-500" />
            </motion.div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Peak Activity Time */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-white/30 dark:bg-gray-700/30 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Peak Activity</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">Tuesday</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Best day for applications</p>
            </motion.div>
            
            {/* Success Rate Trend */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 }}
              className="bg-white/30 dark:bg-gray-700/30 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Success Trend</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-600">+{stats.interviewRate > 15 ? '🔥' : '📈'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats.interviewRate > 15 ? 'Above average!' : 'Keep pushing!'}
              </p>
            </motion.div>
            
            {/* Next Goal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 }}
              className="bg-white/30 dark:bg-gray-700/30 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Next Goal</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.max(0, 50 - stats.totalApplications)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats.totalApplications >= 50 ? 'Goal achieved! 🎉' : 'applications to 50'}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Enhanced Recent Applications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-xl overflow-hidden"
        >
          <div className="p-8 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Applications</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track your latest submissions</p>
                </div>
              </div>
              <Link 
                to="/applications" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl text-sm font-semibold hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
              >
                View all
                <ArrowUp className="h-4 w-4 rotate-45" />
              </Link>
            </div>
          </div>

          {recentApplications.length > 0 ? (
            <div className="p-8">
              <div className="space-y-4">
                {paginatedApplications.map((app, index) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="group relative bg-white/30 dark:bg-gray-700/30 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {app.company_logo ? (
                            <img 
                              src={app.company_logo} 
                              alt={app.company_name}
                              className="w-14 h-14 rounded-2xl object-contain bg-white/50 p-2 shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center shadow-sm">
                              <Building2 className="h-7 w-7 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                          
                          {/* Status Indicator */}
                          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                            app.status === 'offered' ? 'bg-emerald-500' :
                            app.status === 'interviewing' ? 'bg-blue-500' :
                            app.status === 'applied' ? 'bg-teal-500' :
                            'bg-gray-400'
                          }`} />
                        </div>
                        
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-teal-600 transition-colors">
                            {app.company_name}
                          </h3>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {app.job_title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(app.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2 + index * 0.1 }}
                          className={`px-4 py-2 rounded-2xl text-xs font-bold border backdrop-blur-sm ${
                            app.status === 'offered' 
                              ? 'bg-emerald-100/60 text-emerald-700 border-emerald-200/30' :
                            app.status === 'interviewing'
                              ? 'bg-blue-100/60 text-blue-700 border-blue-200/30' :
                            app.status === 'applied'
                              ? 'bg-teal-100/60 text-teal-700 border-teal-200/30' :
                            app.status === 'rejected'
                              ? 'bg-red-100/60 text-red-700 border-red-200/30' :
                              'bg-gray-100/60 text-gray-700 border-gray-200/30'
                          }`}
                        >
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </motion.div>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-xl hover:bg-white/20"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Elegant Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, recentApplications.length)} of {recentApplications.length} applications
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-3 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-white/20"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </motion.button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <motion.button
                          key={page}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 ${
                            currentPage === page
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-white/20'
                          }`}
                        >
                          {page}
                        </motion.button>
                      ))}
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-3 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-white/20"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-16 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-800 dark:to-emerald-800 rounded-3xl flex items-center justify-center mx-auto mb-6"
              >
                <Briefcase className="h-10 w-10 text-teal-600 dark:text-teal-400" />
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No applications yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8">Start your job search journey today!</p>
              <Link 
                to="/auto-apply" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl font-semibold hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Zap className="h-5 w-5" />
                Start Auto Apply
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default Dashboard;