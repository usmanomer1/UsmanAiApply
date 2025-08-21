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
} from 'recharts';
import {
  Plus,
  Users,
  Clock,
  Calendar,
  MessageSquare,
  Activity,
  TrendingUp,
  Briefcase,
  Target,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Search,
  Bell,
  ChevronRight,
  FileText,
  Download,
  Send,
  Paperclip,
  Smile,
  Star,
  Filter,
  ChevronDown,
  Home,
  BarChart3,
  Mail,
  CalendarDays,
  ClipboardList,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, subDays } from 'date-fns';

// Clean, minimal color palette inspired by macOS
const colors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  purple: '#AF52DE',
  pink: '#FF2D55',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: {
    primary: '#1C1C1E',
    secondary: '#8E8E93',
    tertiary: '#C7C7CC',
  },
  border: '#E5E5EA',
  shadow: 'rgba(0, 0, 0, 0.04)',
};

// Soft card component with macOS-style design
const Card = ({ children, className = '', padding = true, onClick = null }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    onClick={onClick}
    className={`
      bg-white rounded-2xl
      shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.08)]
      hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.1)]
      transition-all duration-300
      ${padding ? 'p-6' : ''}
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
  >
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
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedTimeRange, setSelectedTimeRange] = useState('Month');
  const [messageInput, setMessageInput] = useState('');
  
  // Dashboard data
  const [stats, setStats] = useState({
    totalApplications: 127,
    activeApplications: 42,
    interviewRate: 23,
    responseRate: 67,
    projectsCompleted: 85,
    avgResponseTime: 3.2,
  });

  const [applications, setApplications] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch applications from Supabase
      const { data: apps, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && apps) {
        setApplications(apps);
        
        // Calculate stats
        const total = apps.length;
        const active = apps.filter(a => ['pending', 'interview'].includes(a.status)).length;
        const interviews = apps.filter(a => a.status === 'interview').length;
        const responses = apps.filter(a => a.status !== 'pending').length;
        
        setStats({
          totalApplications: total || 127,
          activeApplications: active || 42,
          interviewRate: total > 0 ? Math.round((interviews / total) * 100) : 23,
          responseRate: total > 0 ? Math.round((responses / total) * 100) : 67,
          projectsCompleted: 85,
          avgResponseTime: 3.2,
        });
      }

      // Generate activity data for chart
      const activity = Array.from({ length: 12 }, (_, i) => ({
        month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
        applications: Math.floor(Math.random() * 30) + 10,
        interviews: Math.floor(Math.random() * 10) + 2,
        offers: Math.floor(Math.random() * 5) + 1,
      }));
      setActivityData(activity);

      // Generate monthly trend data
      const monthly = Array.from({ length: 30 }, (_, i) => ({
        day: i + 1,
        value: Math.floor(Math.random() * 100) + 20,
      }));
      setMonthlyData(monthly);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigationTabs = ['Overview', 'Messages', 'Applications', 'Calendar', 'My Schedule', 'Activity'];

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
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-semibold text-gray-900">JobTracker</h1>
            <Tabs tabs={navigationTabs} activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors">
              <Plus className="w-4 h-4" />
              Create Task
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
              <Users className="w-4 h-4" />
              Invite Member
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-gray-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
              </div>
              <Avatar name={user?.email || 'User'} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-8 space-y-6">
            {/* Company Performance Card */}
            <Card>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Application Performance</h2>
                  <p className="text-sm text-gray-500 mt-1">Monthly Analyzed Report</p>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stats.projectsCompleted}%</p>
                    <p className="text-sm text-gray-500 mt-1">Applications Completed</p>
                  </div>
                  <div className="h-12 w-px bg-gray-200" />
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-sm text-gray-600">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      <span className="text-sm text-gray-600">Still Waiting</span>
                    </div>
                  </div>
                </div>
              </div>

              <ProgressBar progress={stats.projectsCompleted} color={colors.success} />
            </Card>

            {/* Current Project Card */}
            <Card>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Application Focus</h3>
                  <p className="text-sm text-gray-500 mt-1">3 tasks remaining</p>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg">
                  56% Progress
                </span>
              </div>

              <div className="mb-4">
                <p className="text-gray-700 mb-2">Update Resume & Portfolio</p>
                <p className="text-sm text-gray-500">Reflect the latest project updates and technical skills</p>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-lg">
                  Resume
                </span>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">
                  Portfolio
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {['John', 'Diana', 'Richard', 'Susan'].map((name, index) => (
                    <Avatar key={name} name={name} size="w-8 h-8" textSize="text-xs" />
                  ))}
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-600 font-medium">
                    +4
                  </div>
                </div>
                <button className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1">
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </Card>

            {/* Chat Section */}
            <Card className="h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Team Chat</h3>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                <div className="flex items-start gap-3">
                  <Avatar name="Diana" size="w-8 h-8" textSize="text-xs" />
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                      <p className="text-sm text-gray-700">Hey! How is it going?</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">10:25 AM</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Avatar name="Diana" size="w-8 h-8" textSize="text-xs" />
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                      <p className="text-sm text-gray-700">I have a new task to assign today. Let me know when done ✅</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">10:32 AM</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 justify-end">
                  <div className="flex-1 flex flex-col items-end">
                    <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                      <p className="text-sm">Sure thing Diana 👍</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">10:35 AM</p>
                  </div>
                  <Avatar name={user?.email || 'You'} size="w-8 h-8" textSize="text-xs" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Paperclip className="w-5 h-5 text-gray-400" />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Smile className="w-5 h-5 text-gray-400" />
                </button>
                <button className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-4 space-y-6">
            {/* Today's Task Card */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Today's Task</h3>
                <button className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                  View All
                </button>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Finalize Application Strategy</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Ensure all application materials, cover letters, and submission timelines are...
                </p>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900">64%</span>
                  </div>
                  <ProgressBar progress={64} color={colors.primary} height="h-1.5" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600">Oct 5, 2024</span>
                  </div>
                  <div className="flex -space-x-1">
                    {['A', 'B', 'C', 'D'].map((letter, i) => (
                      <div key={i} className="w-6 h-6 bg-white border-2 border-white rounded-full flex items-center justify-center">
                        <Avatar name={letter} size="w-5 h-5" textSize="text-[10px]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { title: 'Review Portfolio', time: '2:00 PM', status: 'pending' },
                  { title: 'Update LinkedIn', time: '3:30 PM', status: 'completed' },
                  { title: 'Send Follow-ups', time: '5:00 PM', status: 'pending' },
                ].map((task, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-500">{task.time}</p>
                      </div>
                    </div>
                    {task.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Activity Chart */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Activity</h3>
                  <p className="text-sm text-gray-500 mt-1">Monthly Report</p>
                </div>
                <select className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Year</option>
                  <option>Month</option>
                  <option>Week</option>
                </select>
              </div>

              <div className="mb-4">
                <p className="text-2xl font-bold text-gray-900">{stats.totalApplications}</p>
                <p className="text-sm text-gray-500">Total Applications</p>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
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
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="applications" fill={colors.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-xs text-green-600 font-medium">+12%</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.interviewRate}%</p>
                <p className="text-xs text-gray-500">Interview Rate</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-red-600 font-medium">-3%</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.responseRate}%</p>
                <p className="text-xs text-gray-500">Response Rate</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}