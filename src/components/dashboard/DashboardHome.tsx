import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Clock, 
  XCircle, 
  CheckCircle, 
  Calendar,
  Users,
  Building,
  ExternalLink,
  Edit3,
  ArrowUpRight,
  ArrowRight,
  Target,
  Filter,
  Download,
  RefreshCw,
  Award,
  Briefcase,
  MapPin,
  ChevronRight,
  Plus,
  Search,
  Bell,
  Settings,
  Zap,
  Star,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { 
  LineChart as RechartsLineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: 'SENT' | 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'INTERVIEW' | 'OA';
  applied_at: string;
  details: any;
  created_at: string;
  campaign: {
    job_title: string;
    location: string;
  };
}

interface Analytics {
  sent: number;
  pending: number;
  rejected: number;
  accepted: number;
  interview: number;
  oa: number;
}

// Dummy data for demo mode
const DUMMY_APPLICATIONS: JobApplication[] = [
  {
    id: '1',
    company: 'Google',
    role: 'Senior Software Engineer',
    status: 'INTERVIEW',
    applied_at: '2024-01-15T10:00:00Z',
    details: {},
    created_at: '2024-01-15T10:00:00Z',
    campaign: {
      job_title: 'Senior Software Engineer',
      location: 'Mountain View, CA'
    }
  },
  {
    id: '2',
    company: 'Microsoft',
    role: 'Principal Software Engineer',
    status: 'PENDING',
    applied_at: '2024-01-14T14:30:00Z',
    details: {},
    created_at: '2024-01-14T14:30:00Z',
    campaign: {
      job_title: 'Principal Software Engineer',
      location: 'Seattle, WA'
    }
  },
  {
    id: '3',
    company: 'Meta',
    role: 'Staff Frontend Engineer',
    status: 'SENT',
    applied_at: '2024-01-13T09:15:00Z',
    details: {},
    created_at: '2024-01-13T09:15:00Z',
    campaign: {
      job_title: 'Staff Frontend Engineer',
      location: 'Menlo Park, CA'
    }
  },
  {
    id: '4',
    company: 'Apple',
    role: 'Senior iOS Developer',
    status: 'REJECTED',
    applied_at: '2024-01-10T16:45:00Z',
    details: {},
    created_at: '2024-01-10T16:45:00Z',
    campaign: {
      job_title: 'Senior iOS Developer',
      location: 'Cupertino, CA'
    }
  },
  {
    id: '5',
    company: 'Amazon',
    role: 'Software Development Engineer III',
    status: 'OA',
    applied_at: '2024-01-12T11:20:00Z',
    details: {},
    created_at: '2024-01-12T11:20:00Z',
    campaign: {
      job_title: 'Software Development Engineer III',
      location: 'Seattle, WA'
    }
  },
  {
    id: '6',
    company: 'Netflix',
    role: 'Senior Backend Engineer',
    status: 'ACCEPTED',
    applied_at: '2024-01-08T13:00:00Z',
    details: {},
    created_at: '2024-01-08T13:00:00Z',
    campaign: {
      job_title: 'Senior Backend Engineer',
      location: 'Los Gatos, CA'
    }
  }
];

// Enhanced chart data with more realistic trends
const applicationTrendData = [
  { month: 'Aug', applications: 8, interviews: 2, offers: 0, response_rate: 25 },
  { month: 'Sep', applications: 15, interviews: 4, offers: 1, response_rate: 27 },
  { month: 'Oct', applications: 22, interviews: 7, offers: 2, response_rate: 32 },
  { month: 'Nov', applications: 28, interviews: 9, offers: 2, response_rate: 32 },
  { month: 'Dec', applications: 35, interviews: 12, offers: 3, response_rate: 34 },
  { month: 'Jan', applications: 42, interviews: 15, offers: 4, response_rate: 36 },
];

const statusDistributionData = [
  { name: 'Sent', value: 28, color: '#3B82F6' },
  { name: 'Pending', value: 15, color: '#F59E0B' },
  { name: 'Interview', value: 12, color: '#8B5CF6' },
  { name: 'OA', value: 8, color: '#06B6D4' },
  { name: 'Accepted', value: 6, color: '#10B981' },
  { name: 'Rejected', value: 18, color: '#EF4444' },
];

const weeklyActivityData = [
  { day: 'Mon', applications: 8, responses: 2, interviews: 1 },
  { day: 'Tue', applications: 12, responses: 3, interviews: 0 },
  { day: 'Wed', applications: 6, responses: 1, interviews: 2 },
  { day: 'Thu', applications: 15, responses: 4, interviews: 1 },
  { day: 'Fri', applications: 10, responses: 2, interviews: 0 },
  { day: 'Sat', applications: 4, responses: 1, interviews: 0 },
  { day: 'Sun', applications: 2, responses: 0, interviews: 0 },
];

const companyInsights = [
  { company: 'Google', applications: 5, response_rate: 60, avg_salary: '$215k', trend: 'up' },
  { company: 'Microsoft', applications: 4, response_rate: 75, avg_salary: '$200k', trend: 'up' },
  { company: 'Meta', applications: 3, response_rate: 33, avg_salary: '$235k', trend: 'down' },
  { company: 'Amazon', applications: 6, response_rate: 50, avg_salary: '$175k', trend: 'stable' },
  { company: 'Apple', applications: 2, response_rate: 50, avg_salary: '$190k', trend: 'up' },
];

export const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    sent: 0,
    pending: 0,
    rejected: 0,
    accepted: 0,
    interview: 0,
    oa: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Always fetch applications, regardless of user state
    fetchApplications();
  }, [user]);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  const calculateAnalytics = (apps: JobApplication[]) => {
    const stats = apps.reduce((acc, app) => {
      const status = app.status.toLowerCase() as keyof Analytics;
      if (status in acc) {
        acc[status]++;
      }
      return acc;
    }, {
      sent: 0,
      pending: 0,
      rejected: 0,
      accepted: 0,
      interview: 0,
      oa: 0,
    });
    setAnalytics(stats);
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      console.log('Fetching applications...');

      if (!isSupabaseConfigured()) {
        console.log('Supabase not configured, using demo data');
        // Simulate loading delay for demo
        await new Promise(resolve => setTimeout(resolve, 800));
        setApplications(DUMMY_APPLICATIONS);
        calculateAnalytics(DUMMY_APPLICATIONS);
        return;
      }

      if (!user) {
        console.log('No user found, using demo data');
        await new Promise(resolve => setTimeout(resolve, 800));
        setApplications(DUMMY_APPLICATIONS);
        calculateAnalytics(DUMMY_APPLICATIONS);
        return;
      }

      console.log('Fetching real applications for user:', user.email);

      // First, ensure user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Show empty state instead of demo data for real users
        setApplications([]);
        calculateAnalytics([]);
        return;
      }

      if (!profile) {
        console.log('No profile found for user, showing empty state');
        setApplications([]);
        calculateAnalytics([]);
        return;
      }

      // Fetch applications with campaign details
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          job_campaigns!inner(
            job_title,
            location,
            profiles!inner(
              user_id
            )
          )
        `)
        .eq('job_campaigns.profiles.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        // Show empty state instead of demo data for real users
        setApplications([]);
        calculateAnalytics([]);
        return;
      }

      console.log('Fetched applications:', data?.length || 0);

      // Transform data to match interface
      const transformedApplications: JobApplication[] = (data || []).map(app => ({
        id: app.id,
        company: app.company || 'Unknown Company',
        role: app.role || 'Unknown Role',
        status: (app.status || 'SENT') as JobApplication['status'],
        applied_at: app.applied_at || app.created_at,
        details: app.details || {},
        created_at: app.created_at,
        campaign: {
          job_title: app.job_campaigns.job_title,
          location: app.job_campaigns.location || 'Remote'
        }
      }));

      setApplications(transformedApplications);
      calculateAnalytics(transformedApplications);
    } catch (error) {
      console.error('Error fetching applications:', error);
      // Show empty state on error for real users
      setApplications([]);
      calculateAnalytics([]);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (id: string, status: JobApplication['status']) => {
    try {
      if (isSupabaseConfigured() && user) {
        const { error } = await supabase
          .from('applications')
          .update({ status })
          .eq('id', id);

        if (error) {
          throw error;
        }
      }

      setApplications(apps => 
        apps.map(app => 
          app.id === id ? { ...app, status } : app
        )
      );

      // Recalculate analytics
      const updatedApps = applications.map(app => 
        app.id === id ? { ...app, status } : app
      );
      
      calculateAnalytics(updatedApps);
      setEditingApp(null);
      toast.success('Application status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'premium-badge-blue';
      case 'PENDING': return 'premium-badge-yellow';
      case 'REJECTED': return 'premium-badge-red';
      case 'ACCEPTED': return 'premium-badge-green';
      case 'INTERVIEW': return 'premium-badge-purple';
      case 'OA': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return <TrendingUp className="w-4 h-4" />;
      case 'PENDING': return <Clock className="w-4 h-4" />;
      case 'REJECTED': return <XCircle className="w-4 h-4" />;
      case 'ACCEPTED': return <CheckCircle className="w-4 h-4" />;
      case 'INTERVIEW': return <Users className="w-4 h-4" />;
      case 'OA': return <Calendar className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const totalApplications = Object.values(analytics).reduce((sum, val) => sum + val, 0);
  const responseRate = totalApplications > 0 ? Math.round(((analytics.interview + analytics.oa + analytics.accepted) / totalApplications) * 100) : 0;
  const successRate = totalApplications > 0 ? Math.round((analytics.accepted / totalApplications) * 100) : 0;

  const filteredApplications = applications.filter(app =>
    app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.campaign.job_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Enhanced Loading State */}
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-80 mb-3"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
            </div>
            <div className="flex space-x-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
              ))}
            </div>
          </div>
          
          {/* Metrics Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 bg-gray-200 dark:bg-gray-700 rounded-2xl shimmer"></div>
            ))}
          </div>

          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl shimmer"></div>
            ))}
          </div>

          {/* Applications List Skeleton */}
          <div className="h-[600px] bg-gray-200 dark:bg-gray-700 rounded-2xl shimmer"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header with Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-display-lg text-gray-900 dark:text-white mb-3">
            Welcome back, {user?.email?.split('@')[0] || 'User'}! 👋
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Here's your job search performance and latest updates
          </p>
          {!isSupabaseConfigured() && (
            <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Demo mode - Connect Supabase to see real data
            </div>
          )}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-wrap items-center gap-3"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="premium-input pl-10 w-64"
            />
          </div>
          
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="premium-select w-40"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button 
            onClick={fetchApplications}
            className="premium-button-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          
          <button className="premium-button-primary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </motion.div>
      </div>

      {/* Quick Action Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="premium-card p-6 hover-lift cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Start Auto Apply</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">Let AI apply to jobs automatically</p>
        </div>

        <div className="premium-card p-6 hover-lift cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform">
              <PieChart className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Generate Cover Letter</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">Create personalized cover letters</p>
        </div>

        <div className="premium-card p-6 hover-lift cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Analyze Resume</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">Optimize your resume with AI</p>
        </div>
      </motion.div>

      {/* Enhanced Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center text-emerald-600">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span className="text-sm font-semibold">+12%</span>
            </div>
          </div>
          <div className="text-display-sm text-gray-900 dark:text-white mb-1">{totalApplications}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Total Applications</div>
          <div className="text-xs text-blue-600 dark:text-blue-400">vs last month</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center text-emerald-600">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span className="text-sm font-semibold">+8%</span>
            </div>
          </div>
          <div className="text-display-sm text-gray-900 dark:text-white mb-1">{analytics.interview + analytics.oa}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Active Processes</div>
          <div className="text-xs text-purple-600 dark:text-purple-400">interviews & assessments</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center text-emerald-600">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span className="text-sm font-semibold">+15%</span>
            </div>
          </div>
          <div className="text-display-sm text-gray-900 dark:text-white mb-1">{responseRate}%</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Response Rate</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400">above industry avg</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center text-emerald-600">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span className="text-sm font-semibold">+22%</span>
            </div>
          </div>
          <div className="text-display-sm text-gray-900 dark:text-white mb-1">{successRate}%</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Success Rate</div>
          <div className="text-xs text-amber-600 dark:text-amber-400">offers received</div>
        </motion.div>
      </div>

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Application Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Application Trends</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monthly application and response patterns</p>
            </div>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={applicationTrendData}>
              <defs>
                <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="applications" 
                stroke="#3B82F6" 
                fillOpacity={1} 
                fill="url(#colorApplications)"
                strokeWidth={3}
              />
              <Area 
                type="monotone" 
                dataKey="interviews" 
                stroke="#8B5CF6" 
                fillOpacity={1} 
                fill="url(#colorInterviews)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Status Distribution</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Current application status breakdown</p>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={statusDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Weekly Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Weekly Activity</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Daily application and response patterns</p>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyActivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar 
                dataKey="applications" 
                fill="#3B82F6" 
                radius={[4, 4, 0, 0]}
                name="Applications"
              />
              <Bar 
                dataKey="responses" 
                fill="#10B981" 
                radius={[4, 4, 0, 0]}
                name="Responses"
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Company Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="premium-card p-6 hover-lift"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Top Companies</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Performance by company</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {companyInsights.map((company, index) => (
              <div key={company.company} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{company.company}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{company.applications} applications</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{company.response_rate}% response</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{company.avg_salary} avg</div>
                  </div>
                  {getTrendIcon(company.trend)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Enhanced Recent Applications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="premium-card hover-lift"
      >
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Recent Applications</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Track and manage your job applications with detailed insights</p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="premium-button-secondary">
                <Plus className="w-4 h-4 mr-2" />
                Add Application
              </button>
              <button className="premium-button-primary">
                <ExternalLink className="w-4 h-4 mr-2" />
                View All
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {filteredApplications.length === 0 ? (
            <div className="p-12 text-center">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {isSupabaseConfigured() && user ? 'No applications found' : 'No applications yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms.' 
                  : isSupabaseConfigured() && user
                    ? 'Start using the auto-apply feature to see your applications here.'
                    : 'Your job applications will appear here once you start using the auto-apply feature.'
                }
              </p>
              <button className="premium-button-primary">
                <Plus className="w-4 h-4 mr-2" />
                {isSupabaseConfigured() && user ? 'Start Auto Apply' : 'Add Your First Application'}
              </button>
            </div>
          ) : (
            <>
              {filteredApplications.slice(0, 8).map((app, index) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div className="flex items-start space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">{app.role}</h3>
                        <p className="text-gray-600 dark:text-gray-300 font-medium">{app.company}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Applied {new Date(app.applied_at).toLocaleDateString()}
                          </div>
                          {app.campaign.location && (
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {app.campaign.location}
                            </div>
                          )}
                          <div className="flex items-center">
                            <Briefcase className="w-4 h-4 mr-1" />
                            {app.campaign.job_title}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 lg:flex-shrink-0">
                      <div className="relative">
                        {editingApp === app.id ? (
                          <select
                            value={app.status}
                            onChange={(e) => updateApplicationStatus(app.id, e.target.value as JobApplication['status'])}
                            className="premium-select text-sm min-w-32"
                            onBlur={() => setEditingApp(null)}
                            autoFocus
                          >
                            <option value="SENT">Sent</option>
                            <option value="PENDING">Pending</option>
                            <option value="INTERVIEW">Interview</option>
                            <option value="OA">Online Assessment</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingApp(app.id)}
                            className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium border-2 ${getStatusColor(app.status)} hover:shadow-lg transition-all group-hover:scale-105`}
                          >
                            {getStatusIcon(app.status)}
                            <span className="ml-2">{app.status}</span>
                            <Edit3 className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Application Summary Disclaimer */}
              <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Application Review Reminder</p>
                    <p>
                      <strong>Note:</strong> Some form fields may have been auto-filled by AI with generic information. 
                      Please verify your application details in your LinkedIn account to ensure accuracy.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {filteredApplications.length > 8 && (
          <div className="p-6 border-t border-gray-100 dark:border-gray-700 text-center">
            <button className="premium-button-secondary">
              View {filteredApplications.length - 8} more applications
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};