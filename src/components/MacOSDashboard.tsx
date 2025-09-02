import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { 
  Calendar, 
  ArrowUpRight, 
  Trophy,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Search,
  Zap,
  FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';

// Premium minimal palette unified to brand accent
const colors = {
  accent: '#23a972',
  accentDark: '#1e9463',
  slate: '#64748b',
  slateLight: '#94a3b8',
  warning: '#f59e0b',
  danger: '#ef4444',
  blueLight: '#93c5fd', // Tailwind blue-300
  blueDark: '#2563eb' // Tailwind blue-600
};

// Minimal card with optional subtle gradient accent
const Card = ({ children, className = '', padding = true, onClick = null, accent = false }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    onClick={onClick}
    whileHover={onClick ? { scale: 1.01 } : {}}
    className={`
      relative overflow-hidden glass-card
      transition-all duration-200
      ${padding ? 'p-6' : ''}
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
  >
    {accent && (
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{
          background: `linear-gradient(to right, ${colors.accent}, ${colors.accent})`,
        }}
      />
    )}
    {accent && (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            `radial-gradient(900px 160px at 0% 0%, ${colors.accent}22 0%, transparent 45%),` +
            `radial-gradient(900px 160px at 100% 100%, ${colors.accent}1f 0%, transparent 45%)`,
        }}
      />
    )}
    {children}
  </motion.div>
);

// Custom tooltip for line chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const apps = payload.find((p: any) => p.dataKey === 'applications');
    const interviews = payload.find((p: any) => p.dataKey === 'interviews');
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm" style={{ whiteSpace: 'nowrap' }}>
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="flex items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colors.blueLight }} />
            <span className="text-gray-600">Applications</span>
            <span className="font-medium text-gray-900">{apps?.value ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colors.blueDark }} />
            <span className="text-gray-600">Interviews</span>
            <span className="font-medium text-gray-900">{interviews?.value ?? 0}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// (Removed unused components for minimalism)

export default function MacOSDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const getDisplayName = () => {
    const meta: any = user?.user_metadata || {};
    const name = meta.name || meta.full_name || meta.fullName;
    return name || user?.email?.split('@')[0] || 'there';
  };
  
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

  // (Automation metrics removed for minimalist view)

  const [applications, setApplications] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
  const [applicationsByStatus, setApplicationsByStatus] = useState<any[]>([]);
  const [topCompanies, setTopCompanies] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Y-axis scaling to multiples of 10 with fixed tick step of 10
  const yMaxValue = useMemo(() => {
    const maxApps = weeklyActivity.reduce((m: number, d: any) => Math.max(m, Number(d?.applications || 0)), 0);
    const maxInterviews = weeklyActivity.reduce((m: number, d: any) => Math.max(m, Number(d?.interviews || 0)), 0);
    const maxVal = Math.max(maxApps, maxInterviews);
    const rounded = Math.max(10, Math.ceil(maxVal / 10) * 10);
    return rounded;
  }, [weeklyActivity]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 0; v <= yMaxValue; v += 10) ticks.push(v);
    return ticks;
  }, [yMaxValue]);

  const loadDashboardData = async () => {
    if (!user?.id) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log(`[${new Date().toISOString()}] Loading dashboard for user:`, user.id);

      // Fetch all applications
      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch job campaigns for additional stats
      // First get the profile_id for this user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      let campaigns = null;
      if (profile?.id) {
        const { data: campaignsData } = await supabase
          .from('job_campaigns')
          .select('*')
          .eq('profile_id', profile.id);
        campaigns = campaignsData;
      }


      console.log('Dashboard data fetched:', { apps, campaigns, appsError });
      
      if (!appsError && apps) {
        console.log('Raw application statuses:', apps.map(a => a.status));
        setApplications(apps); // Store all applications for pagination
        
        // Calculate real stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayApps = apps.filter(a => {
          const appDate = new Date(a.created_at);
          appDate.setHours(0, 0, 0, 0);
          return appDate.getTime() === today.getTime();
        });
        
        // Handle both uppercase and lowercase status values like main branch
        const interviews = apps.filter(a => {
          const status = a.status?.toUpperCase();
          return status === 'INTERVIEW' || status === 'OA' || status === 'INTERVIEWING' || status === 'OFFERED';
        });
        const offers = apps.filter(a => {
          const status = a.status?.toUpperCase();
          return status === 'ACCEPTED' || status === 'OFFERED' || status === 'OFFER';
        });
        const responses = apps.filter(a => {
          const status = a.status?.toUpperCase();
          return status !== 'SENT' && status !== 'PENDING' && status !== 'APPLIED';
        });
        
        // Calculate average response time if we have response dates
        let avgResponseTime = 0;
        const appsWithResponses = apps.filter(a => a.status !== 'pending' && a.status !== 'applied' && a.created_at);
        if (appsWithResponses.length > 0) {
          const responseTimes = appsWithResponses.map(a => {
            const created = new Date(a.created_at).getTime();
            const now = new Date().getTime();
            return (now - created) / (1000 * 60 * 60 * 24); // Days
          });
          avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
        }
        
        const calculatedStats = {
          totalApplications: apps.length,
          applicationsToday: todayApps.length,
          interviewsScheduled: interviews.length,
          offersReceived: offers.length,
          responseRate: apps.length > 0 ? Math.round((responses.length / apps.length) * 100) : 0,
          acceptanceRate: interviews.length > 0 ? Math.round((offers.length / interviews.length) * 100) : 0,
          avgTimeToResponse: avgResponseTime || 3,
          linkedinConnections: campaigns?.length || 0,
        };
        
        console.log('Calculated stats:', calculatedStats);
        console.log('Interviews found:', interviews);
        console.log('Today apps:', todayApps);
        
        setStats(calculatedStats);

        // Calculate status distribution - handle various status values case-insensitively
        const statusCounts = {
          applied: apps.filter(a => {
            const status = a.status?.toUpperCase();
            return status === 'SENT' || status === 'PENDING' || status === 'APPLIED' || status === 'SUCCESS';
          }).length,
          interviewing: apps.filter(a => {
            const status = a.status?.toUpperCase();
            return status === 'INTERVIEW' || status === 'OA' || status === 'INTERVIEWING';
          }).length,
          rejected: apps.filter(a => {
            const status = a.status?.toUpperCase();
            return status === 'REJECTED' || status === 'FAILED';
          }).length,
          offered: apps.filter(a => {
            const status = a.status?.toUpperCase();
            return status === 'ACCEPTED' || status === 'OFFERED' || status === 'OFFER';
          }).length
        };

        setApplicationsByStatus([
          { name: 'Applied', value: statusCounts.applied, color: colors.accent },
          { name: 'In Review', value: 0, color: colors.warning }, // Not in current data model
          { name: 'Interview', value: statusCounts.interviewing, color: colors.accent },
          { name: 'Offer', value: statusCounts.offered, color: colors.accent },
          { name: 'Rejected', value: statusCounts.rejected, color: colors.danger },
        ].filter(item => item.value > 0));

        // Get top companies
        const companyCount = apps.reduce((acc: any, app) => {
          const company = app.company_name || app.company || 'Unknown';
          acc[company] = (acc[company] || 0) + 1;
          return acc;
        }, {});

        const companies = Object.entries(companyCount)
          .map(([name, count]) => ({ name, applications: count }))
          .sort((a: any, b: any) => b.applications - a.applications)
          .slice(0, 5);
        
        setTopCompanies(companies);
      }

      // Generate weekly activity with real data
      if (apps && apps.length > 0) {
        const startDate = startOfWeek(new Date());
        const endDate = endOfWeek(new Date());
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        
        const weekData = days.map(day => {
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayApps = apps.filter(app => {
            const appDate = new Date(app.created_at);
            return appDate >= dayStart && appDate <= dayEnd;
          });

          const dayInterviews = dayApps.filter(a => {
            const status = a.status?.toUpperCase();
            return status === 'INTERVIEW' || status === 'INTERVIEWING' || status === 'OA';
          });

          return {
            day: format(day, 'EEE'),
            applications: dayApps.length,
            interviews: dayInterviews.length,
          };
        });
        
        setWeeklyActivity(weekData);
      } else {
        // Set empty week data if no applications
        const startDate = startOfWeek(new Date());
        const endDate = endOfWeek(new Date());
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const emptyWeekData = days.map(day => ({
          day: format(day, 'EEE'),
          applications: 0,
          interviews: 0,
        }));
        setWeeklyActivity(emptyWeekData);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  };

  // Presentation helper for status chips
  const getStatusClasses = (statusValue: string) => {
    const status = (statusValue || '').toUpperCase();
    if (status === 'ACCEPTED' || status === 'OFFER' || status === 'OFFERED') {
      return 'bg-[#23a972]/10 text-[#23a972] ring-1 ring-[#23a972]/20';
    }
    if (status === 'INTERVIEW' || status === 'INTERVIEWING' || status === 'OA') {
      return 'bg-[#23a972]/10 text-[#23a972] ring-1 ring-[#23a972]/20';
    }
    if (status === 'REJECTED' || status === 'FAILED') {
      return 'bg-red-100 text-red-700';
    }
    if (status === 'REVIEWING' || status === 'IN_REVIEW') {
      return 'bg-gray-100 text-gray-700';
    }
    // SENT, PENDING, APPLIED and unknown
    return 'bg-gray-100 text-gray-700';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
      
      // Refresh dashboard data when the page gains focus (e.g., after adding an application)
      const handleFocus = () => {
        loadDashboardData();
      };

      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [user?.id]);

  // Only show loading spinner when we're actively loading data
  // Don't show it during initial auth check
  if (loading && user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-4 border-[#23a972] border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  // If no user or data not loaded yet, render the dashboard with default values
  // This prevents the flash of loading state
  if (!user && !dataLoaded) {
    return null; // Let the auth redirect handle this
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Subtle page background accents */}
      <div
        className="fixed inset-0 pointer-events-none opacity-80"
        style={{
          background:
            `radial-gradient(700px 160px at 8% -12%, ${colors.accent}24 0%, transparent 60%),` +
            `radial-gradient(560px 130px at 110% 112%, ${colors.accent}22 0%, transparent 60%)`,
        }}
      />
      <div className="relative max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="relative overflow-hidden glass-card rounded-2xl">
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(to right, ${colors.accent}, ${colors.accent})` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(900px 180px at 0% 0%, ${colors.accent}22 0%, transparent 45%), radial-gradient(900px 180px at 100% 100%, ${colors.accent}1f 0%, transparent 45%)` }} />
            <div className="relative p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-semibold text-gray-900">
                    {getGreeting()}, {getDisplayName()}.
                  </h1>
                  <p className="text-gray-600 mt-2">Here's a quick look at your job search.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/jobs')}
                    className="flex items-center gap-2 px-4 py-2 bg-[#23a972] text-white rounded-lg hover:bg-[#1e9463] transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <Search className="w-4 h-4" />
                    Find Jobs
                  </button>
                  <button
                    onClick={() => navigate('/auto-apply')}
                    className="flex items-center gap-2 px-4 py-2 bg-[#23a972] text-white rounded-lg hover:bg-[#1e9463] transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <Zap className="w-4 h-4" />
                    Auto Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="mb-6">
          <div className="glass-card p-3">
            <div className="flex gap-3 overflow-x-auto pb-2">
              <Link
                to="/applications"
                className="flex items-center gap-2 px-4 py-2 bg-white/90 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
              >
                <Briefcase className="w-4 h-4" />
                View All Applications
              </Link>
              <Link
                to="/resume"
                className="flex items-center gap-2 px-4 py-2 bg-white/90 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                Resume Builder
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 bg-white/90 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
              >
                <Calendar className="w-4 h-4" />
                Profile Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Key stats - premium minimal stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { 
              label: 'Applications Today', 
              value: stats.applicationsToday || 0, 
              subtext: stats.totalApplications > 0 ? `${stats.totalApplications} total` : null 
            },
            { 
              label: 'Interviews Scheduled', 
              value: stats.interviewsScheduled || 0, 
              subtext: stats.offersReceived > 0 ? `${stats.offersReceived} offers` : null 
            },
            { 
              label: 'Response Rate', 
              value: stats.totalApplications > 0 ? `${stats.responseRate}%` : '0%', 
              subtext: stats.avgTimeToResponse > 0 ? `~${stats.avgTimeToResponse}d avg` : null 
            },
          ].map((stat, index) => {
            const isResponse = stat.label === 'Response Rate';
            const percent = stat.label === 'Applications Today'
              ? (stats.totalApplications > 0 ? Math.round((stats.applicationsToday / stats.totalApplications) * 100) : 0)
              : stat.label === 'Interviews Scheduled'
              ? (stats.totalApplications > 0 ? Math.round((stats.interviewsScheduled / stats.totalApplications) * 100) : 0)
              : (stats.responseRate || 0);

            if (isResponse) {
              return (
                <Card key={index} accent>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="relative w-16 h-16 md:w-20 md:h-20">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke={colors.accent}
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 28}`}
                              strokeDashoffset={`${2 * Math.PI * 28 * (1 - (stats.responseRate || 0) / 100)}`}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-3xl font-semibold text-gray-900 tracking-tight">{stats.responseRate || 0}%</p>
                          <p className="mt-1 text-xs text-gray-500">of {stats.totalApplications} apps{stats.avgTimeToResponse ? ` • avg ~${stats.avgTimeToResponse}d` : ''}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#23a972]"
                            style={{ width: `${Math.max(0, Math.min(100, stats.responseRate || 0))}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">{stats.responseRate || 0}%</div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            }

            return (
              <Card key={index} accent>
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">{stat.value}</p>
                    {stat.subtext && (
                      <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
                    )}
                    <div className="mt-3">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#23a972]"
                          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">{percent}%</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Chart + Right column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-6">
          <div className="lg:col-span-2">
            <Card accent className="overflow-visible">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Applications & Interviews</h3>
                  <p className="text-sm text-gray-500">This week</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.blueLight }} />
                    <span className="text-gray-600">Applications</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.blueDark }} />
                    <span className="text-gray-600">Interviews</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={weeklyActivity} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillAppsBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.blueLight} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={colors.blueLight} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillInterviewsBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.blueDark} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={colors.blueDark} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} interval={0} minTickGap={0} padding={{ left: 16, right: 16 }} tick={{ fontSize: 12, fill: colors.slate }} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} domain={[0, yMaxValue]} ticks={yTicks} tick={{ fontSize: 12, fill: colors.slate }} />
                  <Tooltip isAnimationActive={false} wrapperStyle={{ pointerEvents: 'none' }} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} content={<CustomTooltip />} />
                  <Area type="monotoneX" isAnimationActive={false} dataKey="applications" fill="url(#fillAppsBlue)" stroke={colors.blueLight} strokeWidth={3} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                  <Area type="monotoneX" isAnimationActive={false} dataKey="interviews" fill="url(#fillInterviewsBlue)" stroke={colors.blueDark} strokeWidth={3} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="flex flex-col space-y-6 min-h-0">
            {/* Pipeline summary - taller */}
            <Card accent className="">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Pipeline</h3>
                <Link
                  to="/applications"
                  className="text-sm text-[#23a972] hover:text-[#1e9463] font-medium"
                >
                  Manage →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {applicationsByStatus.slice(0, 4).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => navigate('/applications')}
                    className="p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <p className="text-xs text-gray-600">{s.name}</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{s.value}</p>
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#23a972]"
                          style={{ width: `${Math.max(0, Math.min(100, (stats.totalApplications > 0 ? Math.round((s.value / stats.totalApplications) * 100) : 0)))}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {stats.totalApplications > 0 ? Math.round((s.value / stats.totalApplications) * 100) : 0}%
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Applications + Top Companies side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-6">
          <div className="lg:col-span-2">
            <Card accent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Recent Applications</h3>
                <Link
                  to="/applications"
                  className="text-sm text-[#23a972] hover:text-[#1e9463] font-medium flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {applications.length > 0 ? (
                  <>
                    {applications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((app, index) => (
                      <div 
                        key={app.id || index} 
                        className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer rounded-lg px-2 -mx-2"
                        onClick={() => app.job_url && window.open(app.job_url, '_blank')}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {app.job_title || app.position || 'Software Engineer'}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {app.company_name || app.company || 'Tech Company'}
                            {app.location && ` • ${app.location}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusClasses(app.status)}`}>
                            {app.status === 'applied' ? 'pending' : (app.status || 'pending')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {app.created_at ? format(new Date(app.created_at), 'MMM d') : 'Today'}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                    {applications.length > itemsPerPage && (
                      <div className="pt-4 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, applications.length)} of {applications.length}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-2 text-xs text-gray-600">
                            {currentPage} / {Math.ceil(applications.length / itemsPerPage)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(applications.length / itemsPerPage), prev + 1))}
                            disabled={currentPage === Math.ceil(applications.length / itemsPerPage)}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">No applications yet</p>
                    <Link
                      to="/jobs"
                      className="inline-flex items-center gap-1 mt-3 px-4 py-2 bg-[#23a972] text-white rounded-lg hover:bg-[#1e9463] transition-all duration-200 text-sm font-medium"
                    >
                      Start applying
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div>
            <Card accent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Top Companies</h3>
                <Trophy className="w-5 h-5 text-gray-500" />
              </div>
              <div className="space-y-3 max-h-96 overflow-auto">
                {topCompanies.length > 0 ? (
                  topCompanies.map((company, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <p className="text-sm text-gray-900">{company.name}</p>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#23a972]/10 text-[#23a972] ring-1 ring-[#23a972]/20">
                        {company.applications}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No applications yet</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}