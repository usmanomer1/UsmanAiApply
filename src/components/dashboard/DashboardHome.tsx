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
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

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

export const DashboardHome: React.FC = () => {
  const { user } = useAuth();
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

  const generateDemoTrendData = (): ApplicationTrendData[] => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    
    return days.map((day, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index)); // Last 7 days
      
      return {
        name: day,
        applications: Math.floor(Math.random() * 8) + 1, // Random 1-8 applications
        date: date.toISOString().split('T')[0]
      };
    });
  };

  const generateDemoStatusData = (): StatusDistributionData[] => {
    return [
      { name: 'Sent', value: 45, color: '#3B82F6' },
      { name: 'Pending', value: 25, color: '#F59E0B' },
      { name: 'Interview', value: 20, color: '#8B5CF6' },
      { name: 'Rejected', value: 10, color: '#EF4444' },
    ];
  };

  const fetchApplicationTrendData = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        console.log('Using demo trend data - Supabase not configured or no user');
        setApplicationTrendData(generateDemoTrendData());
        return;
      }

      console.log('Fetching application trend data for user:', user.id);

      // Get applications from the last 7 days using the correct relationship chain
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6); // Last 7 days including today

      // First, get the user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        console.log('No profile found for user, using demo data');
        setApplicationTrendData(generateDemoTrendData());
        return;
      }

      console.log('Found profile:', profileData.id);

      // Get the user's campaigns
      const { data: campaignData, error: campaignError } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profileData.id);

      if (campaignError || !campaignData || campaignData.length === 0) {
        console.log('No campaigns found for profile, using demo data');
        setApplicationTrendData(generateDemoTrendData());
        return;
      }

      console.log('Found campaigns:', campaignData.map(c => c.id));

      // Get applications for these campaigns in the last 7 days
      const campaignIds = campaignData.map(c => c.id);
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select('created_at')
        .in('campaign_id', campaignIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (applicationsError) {
        console.error('Error fetching applications:', applicationsError);
        setApplicationTrendData(generateDemoTrendData());
        return;
      }

      console.log('Found applications:', applicationsData?.length || 0);

      // Group applications by day
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const trendData: ApplicationTrendData[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayName = dayNames[date.getDay()];

        const applicationsOnDay = applicationsData?.filter(app => 
          app.created_at.startsWith(dateStr)
        ).length || 0;

        trendData.push({
          name: dayName,
          applications: applicationsOnDay,
          date: dateStr
        });
      }

      console.log('Generated trend data:', trendData);
      setApplicationTrendData(trendData);
    } catch (error) {
      console.error('Error fetching application trend data:', error);
      setApplicationTrendData(generateDemoTrendData());
    }
  };

  const fetchStatusDistributionData = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        console.log('Using demo status data - Supabase not configured or no user');
        setStatusDistributionData(generateDemoStatusData());
        return;
      }

      console.log('Fetching status distribution data for user:', user.id);

      // First, get the user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        console.log('No profile found for user, using demo data');
        setStatusDistributionData(generateDemoStatusData());
        return;
      }

      // Get the user's campaigns
      const { data: campaignData, error: campaignError } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profileData.id);

      if (campaignError || !campaignData || campaignData.length === 0) {
        console.log('No campaigns found for profile, using demo data');
        setStatusDistributionData(generateDemoStatusData());
        return;
      }

      // Get all applications for these campaigns
      const campaignIds = campaignData.map(c => c.id);
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select('status')
        .in('campaign_id', campaignIds);

      if (applicationsError) {
        console.error('Error fetching status distribution data:', applicationsError);
        setStatusDistributionData(generateDemoStatusData());
        return;
      }

      const totalApplications = applicationsData?.length || 0;

      if (totalApplications === 0) {
        console.log('No applications found, showing empty state');
        setStatusDistributionData([]);
        return;
      }

      // Count applications by status
      const statusCounts: Record<string, number> = {};
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

      console.log('Generated status distribution data:', distributionData);
      setStatusDistributionData(distributionData);
    } catch (error) {
      console.error('Error fetching status distribution data:', error);
      setStatusDistributionData(generateDemoStatusData());
    }
  };

  const fetchDashboardData = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        console.log('Using demo data - Supabase not configured or no user');
        // Demo data with corrected success rate calculation
        const totalApps = 23;
        const acceptedApps = 3; // 3 accepted out of 23 applications
        setStats({
          totalApplications: totalApps,
          thisWeekApplications: 8,
          successRate: Math.round((acceptedApps / totalApps) * 100), // 3/23 * 100 = 13%
          activeJobs: 5,
          tokensUsed: 15,
          tokensRemaining: 60
        });
        setRecentApplications([
          {
            id: '1',
            company: 'TechCorp Inc.',
            role: 'Senior Software Engineer',
            status: 'SENT',
            applied_at: new Date().toISOString(),
            campaign: { location: 'San Francisco, CA' }
          },
          {
            id: '2',
            company: 'StartupXYZ',
            role: 'Full Stack Developer',
            status: 'INTERVIEW',
            applied_at: new Date(Date.now() - 86400000).toISOString(),
            campaign: { location: 'Remote' }
          },
          {
            id: '3',
            company: 'BigTech Solutions',
            role: 'Frontend Engineer',
            status: 'PENDING',
            applied_at: new Date(Date.now() - 172800000).toISOString(),
            campaign: { location: 'New York, NY' }
          }
        ]);
        
        // Fetch chart data separately
        await Promise.all([
          fetchApplicationTrendData(),
          fetchStatusDistributionData()
        ]);
        setLoading(false);
        return;
      }

      console.log('Fetching real dashboard data for user:', user.id);

      // First, get the user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        console.log('No profile found, using demo data');
        setStats({
          totalApplications: 0,
          thisWeekApplications: 0,
          successRate: 0,
          activeJobs: 0,
          tokensUsed: 0,
          tokensRemaining: 75
        });
        setRecentApplications([]);
        await Promise.all([
          fetchApplicationTrendData(),
          fetchStatusDistributionData()
        ]);
        setLoading(false);
        return;
      }

      // Get the user's campaigns
      const { data: campaignData, error: campaignError } = await supabase
        .from('job_campaigns')
        .select('id, job_title, location')
        .eq('profile_id', profileData.id);

      if (campaignError || !campaignData || campaignData.length === 0) {
        console.log('No campaigns found, using empty stats');
        setStats({
          totalApplications: 0,
          thisWeekApplications: 0,
          successRate: 0,
          activeJobs: 0,
          tokensUsed: 0,
          tokensRemaining: 75
        });
        setRecentApplications([]);
        await Promise.all([
          fetchApplicationTrendData(),
          fetchStatusDistributionData()
        ]);
        setLoading(false);
        return;
      }

      const campaignIds = campaignData.map(c => c.id);
      const currentDate = new Date();
      const weekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all applications for these campaigns
      const { data: allApplicationsData, error: allAppsError } = await supabase
        .from('applications')
        .select('*')
        .in('campaign_id', campaignIds);

      if (allAppsError) {
        console.error('Error fetching applications:', allAppsError);
        setStats({
          totalApplications: 0,
          thisWeekApplications: 0,
          successRate: 0,
          activeJobs: 0,
          tokensUsed: 0,
          tokensRemaining: 75
        });
        setRecentApplications([]);
        await Promise.all([
          fetchApplicationTrendData(),
          fetchStatusDistributionData()
        ]);
        setLoading(false);
        return;
      }

      const totalApplications = allApplicationsData?.length || 0;
      const thisWeekApplications = allApplicationsData?.filter(app => 
        new Date(app.created_at) >= weekAgo
      ).length || 0;
      const acceptedApplications = allApplicationsData?.filter(app => 
        app.status === 'ACCEPTED'
      ).length || 0;
      const activeApplications = allApplicationsData?.filter(app => 
        ['SENT', 'PENDING', 'INTERVIEW'].includes(app.status)
      ).length || 0;

      const successRate = totalApplications > 0 
        ? Math.round((acceptedApplications / totalApplications) * 100)
        : 0;

      // Get recent applications with campaign info
      const recentAppsData = allApplicationsData
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(app => {
          const campaign = campaignData.find(c => c.id === app.campaign_id);
          return {
            id: app.id,
            company: app.company || 'Unknown Company',
            role: app.role || 'Unknown Role',
            status: app.status || 'SENT',
            applied_at: app.applied_at || app.created_at,
            campaign: {
              location: campaign?.location || 'Not specified'
            }
          };
        }) || [];

      // Get browser use stats for tokens (if available)
      const { data: usageData } = await supabase
        .from('browser_use_logs')
        .select('step_count')
        .eq('user_id', user.id)
        .gte('created_at', monthAgo.toISOString());

      const totalSteps = usageData?.reduce((sum, log) => sum + log.step_count, 0) || 0;
      const tokensUsed = Math.ceil(totalSteps / 10);

      setStats({
        totalApplications,
        thisWeekApplications,
        successRate,
        activeJobs: activeApplications,
        tokensUsed,
        tokensRemaining: Math.max(0, 75 - tokensUsed)
      });

      setRecentApplications(recentAppsData);
      
      // Fetch chart data
      await Promise.all([
        fetchApplicationTrendData(),
        fetchStatusDistributionData()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use demo data as fallback
      setStats({
        totalApplications: 0,
        thisWeekApplications: 0,
        successRate: 0,
        activeJobs: 0,
        tokensUsed: 0,
        tokensRemaining: 75
      });
      setRecentApplications([]);
      await Promise.all([
        fetchApplicationTrendData(),
        fetchStatusDistributionData()
      ]);
    } finally {
      setLoading(false);
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
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
              Demo mode - Connect Supabase to see real data
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Link to="/auto-apply">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
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
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600 dark:text-green-400">+{stats.thisWeekApplications} this week</span>
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
              <CheckCircle className="w-4 h-4 text-emerald-500 mr-1" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400">Accepted/Applied</span>
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
              <Clock className="w-4 h-4 text-purple-500 mr-1" />
              <span className="text-sm text-purple-600 dark:text-purple-400">In progress</span>
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
              <Zap className="w-4 h-4 text-amber-500 mr-1" />
              <span className="text-sm text-amber-600 dark:text-amber-400">{stats.tokensUsed} used</span>
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
                <CardTitle className="text-xl text-gray-900 dark:text-white">Application Trend</CardTitle>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }} 
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
                          backgroundColor: '#1F2937', 
                          border: 'none', 
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }} 
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
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
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
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Cover Letter</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create personalized letters</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
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
              <Link to="/applications">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
            
            {/* Search and Filter Controls - Moved here */}
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
                <Input
                  type="text"
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
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
                <Link to="/auto-apply">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Start Applying
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApplications.map((application, index) => (
                  <motion.div
                    key={application.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 backdrop-blur-sm"
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
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
                
                {filteredApplications.length > 0 && (
                  <div className="text-center pt-4">
                    <Link to="/applications">
                      <Button variant="outline">
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
    </div>
  );
};