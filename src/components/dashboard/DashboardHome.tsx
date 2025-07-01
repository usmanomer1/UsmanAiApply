import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Zap,
  Bot,
  FileText,
  Building,
  MapPin,
  Eye,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  PieChart,
  Activity,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import toast from 'react-hot-toast';
import ConditionalBackground from '../ui/ConditionalBackground';

interface DashboardStats {
  totalApplications: number;
  thisWeekApplications: number;
  successRate: number;
  activeJobs: number;
  tokensUsed: number;
  tokensRemaining: number;
}

interface RecentApplication {
  id: string;
  company: string;
  role: string;
  status: string;
  applied_at: string;
  campaign: {
    location: string;
  };
}

interface ApplicationTrendData {
  name: string;
  applications: number;
  date: string;
}

interface StatusDistributionData {
  name: string;
  value: number;
  color: string;
}

interface NewApplicationData {
  company: string;
  role: string;
  status: string;
  location: string;
  url: string;
}

export const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<DashboardStats>({
    totalApplications: 0,
    thisWeekApplications: 0,
    successRate: 0,
    activeJobs: 0,
    tokensUsed: 0,
    tokensRemaining: 75
  });
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [applicationTrendData, setApplicationTrendData] = useState<ApplicationTrendData[]>([]);
  const [statusDistributionData, setStatusDistributionData] = useState<StatusDistributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newApplication, setNewApplication] = useState<NewApplicationData>({
    company: '',
    role: '',
    status: 'SENT',
    location: '',
    url: ''
  });

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
    fetchDashboardData();
  }, [user]);



  const fetchApplicationTrendData = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setApplicationTrendData([]);
        return;
      }

      // Get applications from the last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6); // Last 7 days including today

      const { data: applicationsData, error } = await supabase
        .from('applications')
        .select(`
          created_at,
          job_campaigns!campaign_id(
            profiles!inner(
              user_id
            )
          )
        `)
        .eq('job_campaigns.profiles.user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        console.error('Error fetching trend data:', error);
        setApplicationTrendData([]);
        return;
      }

      // Group applications by day
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const trendData: ApplicationTrendData[] = [];

      // Create data for each of the last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayName = dayNames[date.getDay()];

        // Count applications created on this specific date
        const applicationsOnDay = applicationsData?.filter(app => {
          const appDate = new Date(app.created_at).toISOString().split('T')[0];
          return appDate === dateStr;
        }).length || 0;

        trendData.push({
          name: dayName,
          applications: applicationsOnDay,
          date: dateStr
        });
      }

      setApplicationTrendData(trendData);
    } catch (error) {
      console.error('Error fetching application trend data:', error);
      setApplicationTrendData([]);
    }
  };

  const fetchStatusDistributionData = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setStatusDistributionData([]);
        return;
      }

      // Get all applications for the user
      const { data: applicationsData, error } = await supabase
        .from('applications')
        .select(`
          status,
          job_campaigns!campaign_id(
            profiles!inner(
              user_id
            )
          )
        `)
        .eq('job_campaigns.profiles.user_id', user.id);

      if (error) {
        console.error('Error fetching status distribution data:', error);
        setStatusDistributionData([]);
        return;
      }

      // Count applications by status
      const statusCounts: Record<string, number> = {};
      const totalApplications = applicationsData?.length || 0;

      if (totalApplications === 0) {
        setStatusDistributionData([]);
        return;
      }

      applicationsData?.forEach(app => {
        const status = app.status || 'SENT';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Convert to percentage and create chart data
      const statusColors: Record<string, string> = {
        'SENT': '#3B82F6',
        'PENDING': '#F59E0B',
        'INTERVIEW': '#8B5CF6',
        'OA': '#06B6D4',
        'ACCEPTED': '#10B981',
        'REJECTED': '#EF4444'
      };

      const distributionData: StatusDistributionData[] = Object.entries(statusCounts).map(([status, count]) => ({
        name: status,
        value: Math.round((count / totalApplications) * 100),
        color: statusColors[status] || '#6B7280'
      }));

      setStatusDistributionData(distributionData);
    } catch (error) {
      console.error('Error fetching status distribution data:', error);
      setStatusDistributionData([]);
    }
  };

  const fetchDashboardData = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setStats({
          totalApplications: 0,
          thisWeekApplications: 0,
          successRate: 0,
          activeJobs: 0,
          tokensUsed: 0,
          tokensRemaining: 0
        });
        setRecentApplications([]);
        setApplicationTrendData([]);
        setStatusDistributionData([]);
        setLoading(false);
        return;
      }

      // Fetch real data from Supabase
      const currentDate = new Date();
      const weekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get total applications for the user
      const { count: totalCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', 
          await supabase
            .from('job_campaigns')
            .select('id')
            .in('profile_id',
              await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .then(({ data }) => data?.map(p => p.id) || [])
            )
            .then(({ data }) => data?.map(c => c.id) || [])
        );

      // Get this week's applications
      const { count: weekCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString())
        .in('campaign_id', 
          await supabase
            .from('job_campaigns')
            .select('id')
            .in('profile_id',
              await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .then(({ data }) => data?.map(p => p.id) || [])
            )
            .then(({ data }) => data?.map(c => c.id) || [])
        );

      // Get accepted applications for success rate calculation
      const { count: acceptedCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACCEPTED')
        .in('campaign_id', 
          await supabase
            .from('job_campaigns')
            .select('id')
            .in('profile_id',
              await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .then(({ data }) => data?.map(p => p.id) || [])
            )
            .then(({ data }) => data?.map(c => c.id) || [])
        );

      // Get recent applications
      const { data: applicationsData } = await supabase
        .from('applications')
        .select(`
          *,
          job_campaigns!campaign_id(
            location,
            profiles!inner(
              user_id
            )
          )
        `)
        .eq('job_campaigns.profiles.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get browser use stats for tokens
      const { data: usageData } = await supabase
        .from('browser_use_logs')
        .select('step_count')
        .eq('user_id', user.id)
        .gte('created_at', monthAgo.toISOString());

      const totalSteps = usageData?.reduce((sum, log) => sum + log.step_count, 0) || 0;
      const tokensUsed = Math.ceil(totalSteps / 10);

      // Calculate success rate as accepted/applied * 100
      const successRate = totalCount && totalCount > 0 
        ? Math.round(((acceptedCount || 0) / totalCount) * 100)
        : 0;

      setStats({
        totalApplications: totalCount || 0,
        thisWeekApplications: weekCount || 0,
        successRate,
        activeJobs: applicationsData?.filter(app => ['SENT', 'PENDING', 'INTERVIEW'].includes(app.status)).length || 0,
        tokensUsed,
        tokensRemaining: Math.max(0, 75 - tokensUsed)
      });

      const transformedApplications: RecentApplication[] = (applicationsData || []).map(app => ({
        id: app.id,
        company: app.company || 'Unknown Company',
        role: app.role || 'Unknown Role',
        status: app.status || 'SENT',
        applied_at: app.applied_at || app.created_at,
        campaign: {
          location: app.job_campaigns?.location || 'Not specified'
        }
      }));

      setRecentApplications(transformedApplications);
      
      // Fetch chart data
      await Promise.all([
        fetchApplicationTrendData(),
        fetchStatusDistributionData()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddApplication = async () => {
    if (!newApplication.company.trim() || !newApplication.role.trim()) {
      toast.error('Please fill in company and role fields');
      return;
    }

    if (!isSupabaseConfigured() || !user) {
      toast.error('Database not configured');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profile not found');
      }

      // Find or create "Manual Applications" campaign
      let { data: campaign, error: campaignError } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('job_title', 'Manual Applications')
        .maybeSingle();

      if (campaignError) {
        console.error('Error querying campaign:', campaignError);
        throw new Error('Failed to query campaigns');
      }

      if (!campaign) {
        // Create "Manual Applications" campaign
        const { data: newCampaign, error: createError } = await supabase
          .from('job_campaigns')
          .insert({
            profile_id: profile.id,
            job_title: 'Manual Applications',
            location: 'Various',
            job_type: 'Manual',
            work_type: 'Manual Entry',
            experience_level: 'All Levels',
            target_count: null
          })
          .select('id')
          .single();

        if (createError || !newCampaign) {
          throw new Error('Failed to create campaign');
        }

        campaign = newCampaign;
      }

      // Add the application
      const { error: applicationError } = await supabase
        .from('applications')
        .insert({
          campaign_id: campaign.id,
          company: newApplication.company.trim(),
          role: newApplication.role.trim(),
          status: newApplication.status,
          applied_at: new Date().toISOString(),
          details: {
            location: newApplication.location.trim() || null,
            source: 'manual',
            url: newApplication.url.trim() || null
          }
        });

      if (applicationError) {
        throw applicationError;
      }

      // Reset form and close modal
      setNewApplication({
        company: '',
        role: '',
        status: 'SENT',
        location: '',
        url: ''
      });
      setIsAddModalOpen(false);
      
      // Refresh dashboard data
      await fetchDashboardData();
      
      toast.success('Application added successfully!');
    } catch (error) {
      console.error('Error adding application:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'INTERVIEW': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'ACCEPTED': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const filteredApplications = recentApplications.filter(app => {
    const matchesSearch = !searchTerm.trim() || 
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.campaign.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const exportData = () => {
    const csvContent = [
      ['Company', 'Role', 'Status', 'Applied Date', 'Location'],
      ...recentApplications.map(app => [
        app.company,
        app.role,
        app.status,
        new Date(app.applied_at).toLocaleDateString(),
        app.campaign.location
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applications.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-white/20 dark:bg-white/20 rounded-lg w-1/3 mb-4 shimmer"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white/20 dark:bg-white/20 rounded-2xl shimmer"></div>
            ))}
          </div>
          <div className="h-96 bg-white/20 dark:bg-white/20 rounded-2xl shimmer"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConditionalBackground className="fixed inset-0 z-0" animate={false} />
      <div className="relative min-h-screen space-y-8 z-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0"
      >
        <div>
          <h1 className="text-display-lg text-gray-900 dark:text-white mb-3">Dashboard</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Track your job search progress and automation performance
          </p>
          {!isSupabaseConfigured() && (
            <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                              Database not configured
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={fetchDashboardData} 
            variant="outline" 
            size="sm"
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={exportData} 
            variant="outline" 
            size="sm"
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Link to="/auto-apply">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
              <Zap className="w-4 h-4 mr-2" />
              Start Auto Apply
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Applications</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalApplications}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-5 h-5 text-green-800 dark:text-green-300 mr-2 font-bold" />
              <span className="text-base font-semibold text-green-800 dark:text-green-300">+{stats.thisWeekApplications} this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.successRate}%</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <CheckCircle className="w-5 h-5 text-emerald-800 dark:text-emerald-300 mr-2 font-bold" />
              <span className="text-base font-semibold text-emerald-800 dark:text-emerald-300">Accepted/Applied</span>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Jobs</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.activeJobs}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <Clock className="w-5 h-5 text-purple-800 dark:text-purple-300 mr-2 font-bold" />
              <span className="text-base font-semibold text-purple-800 dark:text-purple-300">In progress</span>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tokens Remaining</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.tokensRemaining}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <Zap className="w-5 h-5 text-amber-800 dark:text-amber-300 mr-2 font-bold" />
              <span className="text-base font-semibold text-amber-800 dark:text-amber-300">{stats.tokensUsed} used</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
      >
        {/* Application Trend Chart */}
        <Card className="premium-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900 dark:text-white">Application Trends</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Daily applications over the past week
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={applicationTrendData}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="currentColor" 
                    opacity={0.2}
                    className="text-gray-300 dark:text-gray-600"
                  />
                  <XAxis 
                    dataKey="name" 
                    stroke="currentColor"
                    className="text-gray-700 dark:text-gray-300"
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="currentColor"
                    className="text-gray-700 dark:text-gray-300"
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', 
                      borderRadius: '8px',
                      color: isDark ? '#f9fafb' : '#111827',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                    labelStyle={{ color: isDark ? '#f9fafb' : '#111827', fontWeight: 'bold' }}
                    itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="applications" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Chart */}
        <Card className="premium-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <PieChart className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-gray-900 dark:text-white">Status Distribution</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Breakdown of application statuses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {statusDistributionData.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', 
                          borderRadius: '8px',
                          color: isDark ? '#f9fafb' : '#111827',
                          backdropFilter: 'blur(10px)',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        labelStyle={{ color: isDark ? '#f9fafb' : '#111827', fontWeight: 'bold' }}
                        itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {statusDistributionData.map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.name} ({item.value}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <PieChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No Application Data
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Start applying to jobs to see status distribution
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <Link to="/auto-apply">
          <Card className="premium-card hover-lift cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Start Auto Apply</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Begin automated job applications</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/resume">
          <Card className="premium-card hover-lift cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Optimize Resume</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered resume analysis</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/cover-letter">
          <Card className="premium-card hover-lift cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-pink-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Cover Letter</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create personalized letters</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      {/* Recent Applications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="premium-card hover-lift">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">View Applications</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Recent job applications and their status
                </CardDescription>
              </div>
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={() => setIsAddModalOpen(true)}
                  size="sm"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Application
                </Button>
                <Link to="/applications">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View All
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
                <Input
                  type="text"
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 premium-input"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 premium-select">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="INTERVIEW">Interview</SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {recentApplications.length === 0 ? 'No Applications Yet' : 'No Matching Applications'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {recentApplications.length === 0 
                    ? 'Start applying to jobs to see your applications here.' 
                    : 'Try adjusting your search or filter criteria.'
                  }
                </p>
                <Button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Application
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApplications.map((application, index) => (
                  <motion.div
                    key={application.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 glass-card rounded-xl hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-xl flex items-center justify-center">
                        <Building className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{application.company}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{application.role}</p>
                        <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3 h-3 mr-1" />
                          {application.campaign.location}
                          <span className="mx-2">•</span>
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(application.applied_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={getStatusColor(application.status)}>
                        {application.status}
                      </Badge>
                      <Link to="/applications">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
                
                {filteredApplications.length > 0 && (
                  <div className="text-center pt-4">
                    <Link to="/applications">
                      <Button 
                        variant="outline"
                        className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                      >
                        View All Applications
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Application Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-0 shadow-2xl rounded-3xl">
          <DialogHeader>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl text-gray-900 dark:text-white">Add Application</DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-300">
                    Manually add a job application to track
                  </DialogDescription>
                </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Company *
                </label>
                <Input
                  placeholder="Company name"
                  value={newApplication.company}
                  onChange={(e) => setNewApplication(prev => ({ ...prev, company: e.target.value }))}
                  className="premium-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role *
                </label>
                <Input
                  placeholder="Job title"
                  value={newApplication.role}
                  onChange={(e) => setNewApplication(prev => ({ ...prev, role: e.target.value }))}
                  className="premium-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <Select 
                  value={newApplication.status} 
                  onValueChange={(value) => setNewApplication(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="premium-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="INTERVIEW">Interview</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Location
                </label>
                <Input
                  placeholder="City, State"
                  value={newApplication.location}
                  onChange={(e) => setNewApplication(prev => ({ ...prev, location: e.target.value }))}
                  className="premium-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Job URL (Optional)
              </label>
              <Input
                placeholder="https://linkedin.com/jobs/view/..."
                value={newApplication.url}
                onChange={(e) => setNewApplication(prev => ({ ...prev, url: e.target.value }))}
                className="premium-input"
              />
            </div>



            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddApplication}
                disabled={isSubmitting || !newApplication.company.trim() || !newApplication.role.trim()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Application
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};