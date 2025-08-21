import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
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
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import {
  Search,
  Plus,
  TrendingUp,
  Calendar,
  Clock,
  Building2,
  Briefcase,
  Users,
  Target,
  Zap,
  Award,
  Activity,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Filter,
  Download,
  Bell,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

// Premium color palette
const colors = {
  primary: '#2563eb', // Sapphire blue
  secondary: '#10b981', // Emerald green
  accent: '#8b5cf6', // Purple
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#64748b',
  background: '#ffffff',
  surface: 'rgba(255, 255, 255, 0.8)',
  glass: 'rgba(255, 255, 255, 0.7)',
  border: 'rgba(148, 163, 184, 0.1)',
  gradient: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  },
};

// Glassmorphism card component
const GlassCard = ({ children, className = '', delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={`
      relative overflow-hidden rounded-2xl
      bg-white/70 backdrop-blur-xl
      border border-white/20
      shadow-[0_8px_32px_rgba(0,0,0,0.08)]
      hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)]
      transition-all duration-300
      ${className}
    `}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
    {children}
  </motion.div>
);

// Premium stat card component
const StatCard = ({ title, value, change, icon: Icon, color, delay }: any) => (
  <GlassCard delay={delay} className="p-6 group hover:scale-[1.02] transition-transform">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          {value}
        </p>
        {change !== undefined && (
          <div className="flex items-center mt-2 gap-1">
            {change >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Math.abs(change)}%
            </span>
            <span className="text-xs text-gray-500 ml-1">vs last week</span>
          </div>
        )}
      </div>
      <div
        className={`
          p-3 rounded-xl
          bg-gradient-to-br ${color}
          shadow-lg group-hover:scale-110 transition-transform
        `}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </GlassCard>
);

// Premium badge component
const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    interview: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    offer: 'bg-green-50 text-green-700 border-green-200',
    applied: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <span
      className={`
        px-3 py-1 rounded-full text-xs font-medium
        border ${styles[status.toLowerCase()] || styles.pending}
        transition-all hover:scale-105
      `}
    >
      {status}
    </span>
  );
};

export default function PremiumDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    interviewRate: 0,
    responseRate: 0,
    active: 0,
    avgResponseTime: 0,
    topCompany: '',
  });
  const [applications, setApplications] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch applications
      const { data: apps, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalApps = apps?.length || 0;
      const interviews = apps?.filter(a => a.status === 'interview').length || 0;
      const responses = apps?.filter(a => a.status !== 'pending').length || 0;
      const activeApps = apps?.filter(a => ['pending', 'interview'].includes(a.status)).length || 0;

      // Get top company
      const companyCount = apps?.reduce((acc: any, app: any) => {
        acc[app.company] = (acc[app.company] || 0) + 1;
        return acc;
      }, {});
      const topCompany = Object.entries(companyCount || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';

      setStats({
        total: totalApps,
        interviewRate: totalApps > 0 ? Math.round((interviews / totalApps) * 100) : 0,
        responseRate: totalApps > 0 ? Math.round((responses / totalApps) * 100) : 0,
        active: activeApps,
        avgResponseTime: 3.2, // Mock data
        topCompany,
      });

      // Set recent applications
      setApplications(apps?.slice(0, 5) || []);

      // Generate trend data (last 30 days)
      const trendDataPoints = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayApps = apps?.filter(a => {
          const appDate = new Date(a.created_at);
          return appDate.toDateString() === date.toDateString();
        }).length || 0;

        trendDataPoints.push({
          date: format(date, 'MMM dd'),
          applications: dayApps,
          cumulative: trendDataPoints.reduce((sum, d) => sum + d.applications, 0) + dayApps,
        });
      }
      setTrendData(trendDataPoints);

      // Generate status distribution
      const statusCounts = {
        Applied: apps?.filter(a => a.status === 'applied').length || 0,
        Pending: apps?.filter(a => a.status === 'pending').length || 0,
        Interview: apps?.filter(a => a.status === 'interview').length || 0,
        Offer: apps?.filter(a => a.status === 'offer').length || 0,
        Rejected: apps?.filter(a => a.status === 'rejected').length || 0,
      };

      setStatusData(
        Object.entries(statusCounts).map(([name, value]) => ({
          name,
          value,
          percentage: totalApps > 0 ? Math.round((value / totalApps) * 100) : 0,
        }))
      );

      // Generate heatmap data (mock)
      const heatmapGrid = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let hour = 0; hour < 24; hour++) {
        for (let day = 0; day < 7; day++) {
          heatmapGrid.push({
            day: days[day],
            hour: hour,
            value: Math.floor(Math.random() * 10),
          });
        }
      }
      setHeatmapData(heatmapGrid);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-lg p-3 rounded-lg shadow-xl border border-white/20">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-8 h-8 text-blue-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Animated background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-40 w-80 h-80 bg-green-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-xl">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Welcome back, {user?.email?.split('@')[0]}
                </h1>
                <p className="text-gray-600 mt-1">Your career command center</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-64 rounded-xl bg-white/70 backdrop-blur-lg border border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                />
              </div>

              {/* Quick Actions */}
              <button className="p-2.5 rounded-xl bg-white/70 backdrop-blur-lg border border-gray-200 hover:border-blue-500 transition-all">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2.5 rounded-xl bg-white/70 backdrop-blur-lg border border-gray-200 hover:border-blue-500 transition-all">
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <button className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2">
                <Plus className="w-5 h-5" />
                New Application
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard
            title="Total Applications"
            value={stats.total}
            change={12}
            icon={Briefcase}
            color="from-blue-500 to-blue-600"
            delay={0}
          />
          <StatCard
            title="Interview Rate"
            value={`${stats.interviewRate}%`}
            change={8}
            icon={Users}
            color="from-purple-500 to-purple-600"
            delay={0.1}
          />
          <StatCard
            title="Response Rate"
            value={`${stats.responseRate}%`}
            change={-3}
            icon={Target}
            color="from-green-500 to-green-600"
            delay={0.2}
          />
          <StatCard
            title="Active Applications"
            value={stats.active}
            change={5}
            icon={Activity}
            color="from-amber-500 to-amber-600"
            delay={0.3}
          />
          <StatCard
            title="Avg. Response Time"
            value={`${stats.avgResponseTime}d`}
            change={-2}
            icon={Clock}
            color="from-pink-500 to-pink-600"
            delay={0.4}
          />
          <StatCard
            title="Top Company"
            value={stats.topCompany}
            icon={Building2}
            color="from-indigo-500 to-indigo-600"
            delay={0.5}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Application Trend Chart */}
          <GlassCard delay={0.6} className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Application Trend</h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all">
                  7D
                </button>
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white">
                  30D
                </button>
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all">
                  90D
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorApplications)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Status Distribution */}
          <GlassCard delay={0.7} className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Status Distribution</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View Details →
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: chartColors[index % chartColors.length] }}
                  />
                  <span className="text-sm text-gray-600">{item.name}</span>
                  <span className="text-sm font-medium text-gray-900 ml-auto">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Recent Applications Table */}
        <GlassCard delay={0.8} className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Applications</h2>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all">
                <Filter className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Position</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date Applied</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, index) => (
                  <motion.tr
                    key={app.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-all"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {app.company?.[0] || 'C'}
                        </div>
                        <span className="font-medium text-gray-900">{app.company || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600">{app.position || 'N/A'}</td>
                    <td className="py-4 px-4 text-gray-600">
                      {app.created_at ? format(new Date(app.created_at), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={app.status || 'pending'} />
                    </td>
                    <td className="py-4 px-4">
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                        View
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Premium Insights Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Heatmap */}
          <GlassCard delay={1.4} className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Application Activity Heatmap</h2>
            <div className="grid grid-cols-8 gap-1">
              <div className="col-span-1" />
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs text-gray-600 text-center font-medium">
                  {day}
                </div>
              ))}
              {Array.from({ length: 24 }, (_, hour) => (
                <React.Fragment key={hour}>
                  <div className="text-xs text-gray-600 text-right pr-2">{hour}:00</div>
                  {Array.from({ length: 7 }, (_, day) => {
                    const intensity = Math.random();
                    return (
                      <div
                        key={`${hour}-${day}`}
                        className="aspect-square rounded transition-all hover:scale-110"
                        style={{
                          backgroundColor: `rgba(139, 92, 246, ${intensity})`,
                        }}
                        title={`${Math.floor(intensity * 10)} applications`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 justify-center">
              <span className="text-xs text-gray-600">Less</span>
              <div className="flex gap-1">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
                  <div
                    key={opacity}
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: `rgba(139, 92, 246, ${opacity})` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-600">More</span>
            </div>
          </GlassCard>

          {/* Response Time Leaderboard */}
          <GlassCard delay={1.5} className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Fastest Response Companies</h2>
            <div className="space-y-3">
              {[
                { company: 'Tech Corp', time: '1.2 days', trend: 'up' },
                { company: 'Innovation Labs', time: '2.1 days', trend: 'down' },
                { company: 'Future Systems', time: '2.8 days', trend: 'up' },
                { company: 'Digital Solutions', time: '3.5 days', trend: 'up' },
                { company: 'Cloud Dynamics', time: '4.2 days', trend: 'down' },
              ].map((item, index) => (
                <motion.div
                  key={item.company}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.6 + index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.company}</p>
                      <p className="text-sm text-gray-600">Average response time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{item.time}</span>
                    {item.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}