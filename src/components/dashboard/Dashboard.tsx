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
  Zap,
  FileText,
  Search,
  Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
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
  RadialBarChart,
  RadialBar
} from 'recharts';

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
      icon: Briefcase,
      bgColor: 'bg-teal-50',
      iconColor: 'text-teal-600',
      progressColor: 'bg-teal-500'
    },
    {
      title: 'Interview Rate',
      value: `${stats.interviewRate}%`,
      change: null,
      icon: Users,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      progressColor: 'bg-blue-500',
      isPercentage: true,
      progress: stats.interviewRate
    },
    {
      title: 'Response Rate',
      value: `${stats.responseRate}%`,
      change: null,
      icon: Activity,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      progressColor: 'bg-purple-500',
      isPercentage: true,
      hasChart: true
    },
    {
      title: 'Active Applications',
      value: stats.activeApplications,
      change: null,
      icon: Activity,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      progressColor: 'bg-amber-500',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-white to-teal-50 p-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.user_metadata?.full_name || 'there'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">Your personalized job search overview</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/jobs" className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              <Search className="h-4 w-4" /> Discover Jobs
            </Link>
            <Link to="/resume" className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FileText className="h-4 w-4" /> Improve Resume
            </Link>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Calendar className="h-4 w-4" />
              {dateRange}
            </button>
          </div>
        </div>

        {/* Weekly strip */}
        <div className="mt-5 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span className="text-gray-600">This week:</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {stats.monthlyTrend.slice(-7).reduce((sum, day) => sum + day.applications, 0)} applications
              </span>
              {stats.weeklyChange > 0 ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <ArrowUp className="h-3 w-3" />
                  {Math.abs(stats.weeklyChange).toFixed(0)}%
                </span>
              ) : stats.weeklyChange < 0 ? (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <ArrowDown className="h-3 w-3" />
                  {Math.abs(stats.weeklyChange).toFixed(0)}%
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/applications" className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              <Plus className="h-4 w-4" /> Add Application
            </Link>
            <Link to="/jobs" className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Search className="h-4 w-4" /> Find Jobs
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards + Focus Widgets */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                  {stat.change !== null && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      stat.change > 0 ? 'text-green-600' : stat.change < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {stat.change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {Math.abs(stat.change).toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                </div>
                {stat.isPercentage && stat.progress !== undefined && (
                  <div className="mt-4">
                    <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`absolute inset-y-0 left-0 ${stat.progressColor} rounded-full`}
                      />
                    </div>
                  </div>
                )}
                {stat.hasChart && (
                  <div className="mt-4 h-14">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.monthlyTrend.slice(-7)}>
                        <defs>
                          <linearGradient id="kpiLine" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <Line type="monotone" dataKey="applications" stroke="url(#kpiLine)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Application Status Distribution (Pie) */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Application Status Distribution</h2>
              {stats.statusDistribution.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {stats.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                      <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" formatter={(value: string) => <span className="text-sm text-gray-700">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">No application data yet</div>
              )}
            </motion.div>

            {/* Application Trend - Last 30 Days */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Application Trend - Last 30 Days</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthlyTrend}>
                    <defs>
                      <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#eaeef2" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="applications" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorApplications)" />
                    <Line type="monotone" dataKey="applications" stroke="#0ea5e9" strokeWidth={1.5} dot={false} opacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Recent Applications - premium table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
              <Link to="/applications" className="text-sm text-teal-600 hover:text-teal-700 font-medium">View all →</Link>
            </div>

            {recentApplications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Company</th>
                      <th className="px-6 py-3">Position</th>
                      <th className="px-6 py-3">Date Applied</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedApplications.map((app, index) => (
                      <motion.tr key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.05 }} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {app.company_logo ? (
                              <img src={app.company_logo} alt={app.company_name} className="w-10 h-10 rounded-lg object-contain bg-gray-50 p-1" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Building2 className="h-5 w-5 text-gray-400" /></div>
                            )}
                            <span className="font-medium text-gray-900">{app.company_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{app.job_title}</td>
                        <td className="px-6 py-4 text-gray-500 text-sm">{new Date(app.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No applications yet</p>
                <Link to="/jobs" className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium">Start applying to jobs →</Link>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-600">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, recentApplications.length)} of {recentApplications.length} applications</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-5 w-5" /></button>
                </div>
              </div>
            )}
          </motion.div>
        </div>


      </div>
    </div>
  );
};

export default Dashboard;