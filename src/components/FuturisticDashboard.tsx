import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useSpring as useReactSpring, animated } from '@react-spring/web';
import '../styles/futuristic.css';
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  Briefcase,
  TrendingUp,
  MessageCircle,
  Rocket,
  Clock,
  Trophy,
  Search,
  Plus,
  Filter,
  Download,
  Bell,
  Settings,
  ChevronRight,
  ChevronDown,
  Zap,
  Star,
  Target,
  Activity,
  Globe,
  Calendar,
  Award,
  Sparkles,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Command,
  ArrowUp,
  ArrowDown,
  Hash,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { useInView } from 'react-intersection-observer';

// Color palette for dark theme
const colors = {
  bg: {
    primary: '#0f172a',
    secondary: '#1e293b',
    tertiary: '#334155',
  },
  accent: {
    cyan: '#06b6d4',
    purple: '#a855f7',
    emerald: '#10b981',
    amber: '#f59e0b',
    pink: '#ec4899',
    blue: '#3b82f6',
  },
  glass: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.1)',
    heavy: 'rgba(255, 255, 255, 0.15)',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#cbd5e1',
    muted: '#64748b',
  },
};

// Animated counter component
const AnimatedCounter = ({ value, duration = 2000, prefix = '', suffix = '' }: any) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / duration;
      
      if (progress < 1) {
        setDisplayValue(Math.floor(value * progress));
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};

// Glassmorphic card component
const GlassCard = ({ children, className = '', delay = 0, hover = true }: any) => {
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ 
        duration: 0.6, 
        delay,
        ease: [0.215, 0.61, 0.355, 1.0],
      }}
      whileHover={hover ? { 
        scale: 1.02,
        transition: { duration: 0.2 }
      } : {}}
      className={`
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-white/5 to-white/[0.02]
        backdrop-blur-xl backdrop-saturate-150
        border border-white/10
        shadow-2xl shadow-black/20
        ${hover ? 'hover:shadow-cyan-500/10 hover:border-cyan-500/20' : ''}
        transition-all duration-300
        ${className}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none" />
      {children}
    </motion.div>
  );
};

// Neon stat card component
const NeonStatCard = ({ title, value, change, icon: Icon, color, delay, index }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const glowColor = colors.accent[color as keyof typeof colors.accent];
  
  return (
    <GlassCard 
      delay={delay} 
      className="p-6 group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at center, ${glowColor}20 0%, transparent 70%)`,
        }}
      />
      
      {/* Mini sparkline in background */}
      <div className="absolute inset-0 opacity-20 p-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={Array.from({ length: 10 }, (_, i) => ({ value: Math.random() * 100 }))}>
            <defs>
              <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={glowColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={glowColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="none" fill={`url(#gradient-${index})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-2">{title}</p>
          <div className="text-4xl font-bold text-white mb-2">
            <AnimatedCounter value={value} prefix={title.includes('Rate') ? '' : ''} suffix={title.includes('Rate') ? '%' : ''} />
          </div>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              <motion.div
                animate={{ y: change >= 0 ? -2 : 2 }}
                transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
              >
                {change >= 0 ? (
                  <ArrowUp className="w-4 h-4" style={{ color: colors.accent.emerald }} />
                ) : (
                  <ArrowDown className="w-4 h-4" style={{ color: colors.accent.pink }} />
                )}
              </motion.div>
              <span className={`text-sm font-medium ${change >= 0 ? 'text-emerald-400' : 'text-pink-400'}`}>
                {Math.abs(change)}%
              </span>
              <span className="text-xs text-gray-500 ml-1">vs last week</span>
            </div>
          )}
        </div>
        <motion.div
          className={`
            p-3 rounded-xl relative
            bg-gradient-to-br from-${color}-500/20 to-${color}-600/20
            border border-${color}-500/30
          `}
          style={{
            boxShadow: isHovered ? `0 0 30px ${glowColor}40` : 'none',
          }}
          animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-6 h-6" style={{ color: glowColor }} />
          {isHovered && (
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{ border: `2px solid ${glowColor}` }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </motion.div>
      </div>
    </GlassCard>
  );
};

// Animated background orbs
const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs */}
      <motion.div
        className="absolute w-96 h-96 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.accent.cyan}30 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 100, 0],
          y: [0, -100, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        className="absolute right-0 top-1/2 w-96 h-96 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.accent.purple}30 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, -100, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        className="absolute left-1/3 bottom-0 w-96 h-96 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.accent.emerald}30 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(${colors.accent.cyan}40 1px, transparent 1px), linear-gradient(90deg, ${colors.accent.cyan}40 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
};

// 3D Donut Chart Component
const ThreeDDonutChart = ({ data }: any) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const chartColors = [
    colors.accent.cyan,
    colors.accent.purple,
    colors.accent.emerald,
    colors.accent.amber,
    colors.accent.pink,
  ];

  const CustomLabel = ({ cx, cy }: any) => {
    const activeItem = data[activeIndex];
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
        <tspan x={cx} dy="-0.5em" className="text-2xl font-bold fill-white">
          {activeItem.value}
        </tspan>
        <tspan x={cx} dy="1.5em" className="text-sm fill-gray-400">
          {activeItem.name}
        </tspan>
      </text>
    );
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <defs>
            {data.map((entry: any, index: number) => (
              <linearGradient key={`gradient-${index}`} id={`gradient-chart-${index}`}>
                <stop offset="0%" stopColor={chartColors[index]} stopOpacity={0.8} />
                <stop offset="100%" stopColor={chartColors[index]} stopOpacity={0.3} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            animationBegin={0}
            animationDuration={1500}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            label={<CustomLabel cx="50%" cy="50%" />}
          >
            {data.map((entry: any, index: number) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#gradient-chart-${index})`}
                className="cursor-pointer transition-all duration-200"
                style={{
                  filter: activeIndex === index ? `drop-shadow(0 0 20px ${chartColors[index]}80)` : 'none',
                  transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                }}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              background: colors.glass.heavy,
              border: `1px solid ${colors.accent.cyan}40`,
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
            }}
            labelStyle={{ color: colors.text.primary }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Activity heatmap component
const ActivityHeatmap = ({ data }: any) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getIntensityColor = (value: number) => {
    const intensity = value / 10;
    return `rgba(6, 182, 212, ${intensity})`; // cyan with varying opacity
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1">
        <div /> {/* Empty corner cell */}
        {days.map(day => (
          <div key={day} className="text-xs text-gray-400 text-center font-medium">
            {day}
          </div>
        ))}
      </div>
      {hours.map(hour => (
        <div key={hour} className="grid grid-cols-8 gap-1">
          <div className="text-xs text-gray-400 text-right pr-2">{hour}:00</div>
          {days.map((day, dayIndex) => {
            const value = Math.floor(Math.random() * 10);
            return (
              <motion.div
                key={`${hour}-${dayIndex}`}
                className="aspect-square rounded cursor-pointer relative group"
                style={{
                  backgroundColor: getIntensityColor(value),
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
                whileHover={{ 
                  scale: 1.2,
                  zIndex: 10,
                  boxShadow: `0 0 20px ${colors.accent.cyan}60`,
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-bold text-white">{value}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Status badge with animation
const AnimatedStatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    pending: { color: colors.accent.amber, icon: Loader2, pulse: true },
    interview: { color: colors.accent.blue, icon: MessageCircle, pulse: false },
    rejected: { color: colors.accent.pink, icon: XCircle, pulse: false },
    offer: { color: colors.accent.emerald, icon: CheckCircle, pulse: false },
    applied: { color: colors.accent.purple, icon: Rocket, pulse: true },
  };

  const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <motion.span
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium
        inline-flex items-center gap-1.5
        backdrop-blur-xl
        transition-all duration-200
      `}
      style={{
        background: `${config.color}15`,
        border: `1px solid ${config.color}40`,
        color: config.color,
      }}
      whileHover={{ scale: 1.05 }}
    >
      {config.pulse && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background: `${config.color}20`,
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <Icon className="w-3 h-3" />
      {status}
    </motion.span>
  );
};

export default function FuturisticDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30D');
  const [showAchievements, setShowAchievements] = useState(false);
  
  const [stats, setStats] = useState({
    total: 127,
    interviewRate: 23,
    responseRate: 67,
    active: 42,
    avgResponseTime: 3.2,
    successRate: 18,
  });
  
  const [applications, setApplications] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setLoading(false);
      loadDashboardData();
    }, 1500);
  }, [user]);

  const loadDashboardData = async () => {
    // Mock data for demonstration
    const mockApplications = [
      { id: 1, company: 'TechCorp', position: 'Senior Frontend Engineer', status: 'interview', date: new Date(), responseTime: 2 },
      { id: 2, company: 'Innovation Labs', position: 'Full Stack Developer', status: 'pending', date: new Date(), responseTime: null },
      { id: 3, company: 'Future Systems', position: 'React Specialist', status: 'offer', date: new Date(), responseTime: 5 },
      { id: 4, company: 'Digital Dynamics', position: 'UI/UX Engineer', status: 'applied', date: new Date(), responseTime: null },
      { id: 5, company: 'Cloud Nine', position: 'DevOps Engineer', status: 'rejected', date: new Date(), responseTime: 7 },
    ];
    setApplications(mockApplications);

    // Generate trend data
    const trend = Array.from({ length: 30 }, (_, i) => ({
      date: format(subDays(new Date(), 29 - i), 'MMM dd'),
      applications: Math.floor(Math.random() * 10) + 5,
      responses: Math.floor(Math.random() * 5) + 2,
      interviews: Math.floor(Math.random() * 3),
    }));
    setTrendData(trend);

    // Status distribution
    setStatusData([
      { name: 'Applied', value: 45, percentage: 35 },
      { name: 'Screening', value: 30, percentage: 24 },
      { name: 'Interview', value: 25, percentage: 20 },
      { name: 'Offer', value: 15, percentage: 12 },
      { name: 'Rejected', value: 12, percentage: 9 },
    ]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <motion.div className="relative">
          <motion.div
            className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      <AnimatedBackground />
      
      <div className="relative z-10 max-w-[1600px] mx-auto p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-2xl shadow-cyan-500/25">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <motion.div 
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-900"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                  Command Center
                </h1>
                <p className="text-gray-400 mt-1">Mission Control Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2.5 w-64 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none transition-all"
                />
              </div>

              {/* Quick Actions */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2.5 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all"
              >
                {soundEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
              </motion.button>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 transition-all"
              >
                {darkMode ? <Moon className="w-5 h-5 text-purple-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-medium shadow-lg shadow-cyan-500/25 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Mission
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <NeonStatCard
            title="Total Applications"
            value={stats.total}
            change={12}
            icon={Briefcase}
            color="blue"
            delay={0}
            index={0}
          />
          <NeonStatCard
            title="Interview Rate"
            value={stats.interviewRate}
            change={8}
            icon={TrendingUp}
            color="purple"
            delay={0.1}
            index={1}
          />
          <NeonStatCard
            title="Response Rate"
            value={stats.responseRate}
            change={-3}
            icon={MessageCircle}
            color="emerald"
            delay={0.2}
            index={2}
          />
          <NeonStatCard
            title="Active Applications"
            value={stats.active}
            change={5}
            icon={Rocket}
            color="amber"
            delay={0.3}
            index={3}
          />
          <NeonStatCard
            title="Avg Response Time"
            value={stats.avgResponseTime}
            change={-2}
            icon={Clock}
            color="cyan"
            delay={0.4}
            index={4}
          />
          <NeonStatCard
            title="Success Rate"
            value={stats.successRate}
            change={15}
            icon={Trophy}
            color="pink"
            delay={0.5}
            index={5}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Trend Chart */}
          <GlassCard delay={0.6} className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Application Trend</h2>
              <div className="flex items-center gap-2">
                {['7D', '30D', '90D'].map((range) => (
                  <motion.button
                    key={range}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedTimeRange === range
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                        : 'text-gray-400 hover:text-white bg-white/5'
                    }`}
                  >
                    {range}
                  </motion.button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent.cyan} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={colors.accent.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent.purple} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={colors.accent.purple} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent.emerald} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={colors.accent.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.glass.light} />
                <XAxis dataKey="date" stroke={colors.text.muted} fontSize={12} />
                <YAxis stroke={colors.text.muted} fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    background: colors.glass.heavy,
                    border: `1px solid ${colors.accent.cyan}40`,
                    borderRadius: '12px',
                    backdropFilter: 'blur(12px)',
                  }}
                  labelStyle={{ color: colors.text.primary }}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke={colors.accent.cyan}
                  strokeWidth={2}
                  fill="url(#colorApplications)"
                />
                <Area
                  type="monotone"
                  dataKey="responses"
                  stroke={colors.accent.purple}
                  strokeWidth={2}
                  fill="url(#colorResponses)"
                />
                <Area
                  type="monotone"
                  dataKey="interviews"
                  stroke={colors.accent.emerald}
                  strokeWidth={2}
                  fill="url(#colorInterviews)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* 3D Donut Chart */}
          <GlassCard delay={0.7} className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">Status Distribution</h2>
            <ThreeDDonutChart data={statusData} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusData.map((item, index) => (
                <motion.div
                  key={item.name}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: [
                        colors.accent.cyan,
                        colors.accent.purple,
                        colors.accent.emerald,
                        colors.accent.amber,
                        colors.accent.pink,
                      ][index],
                      boxShadow: `0 0 10px ${[
                        colors.accent.cyan,
                        colors.accent.purple,
                        colors.accent.emerald,
                        colors.accent.amber,
                        colors.accent.pink,
                      ][index]}60`,
                    }}
                  />
                  <span className="text-sm text-gray-400">{item.name}</span>
                  <span className="text-sm font-medium text-white ml-auto">{item.percentage}%</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Applications Table & Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Applications */}
          <GlassCard delay={0.9} className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Recent Missions</h2>
              <div className="flex items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Filter className="w-5 h-5" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Download className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            <div className="space-y-3">
              {applications.map((app, index) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-cyan-500/20 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div 
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-white font-bold"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        {app.company[0]}
                      </motion.div>
                      <div>
                        <p className="font-medium text-white">{app.company}</p>
                        <p className="text-sm text-gray-400">{app.position}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Applied</p>
                        <p className="text-sm text-gray-300">{format(app.date, 'MMM dd')}</p>
                      </div>
                      <AnimatedStatusBadge status={app.status} />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          {/* Activity Heatmap */}
          <GlassCard delay={1.5} className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">Activity Matrix</h2>
            <ActivityHeatmap data={[]} />
            <div className="flex items-center gap-4 mt-6 justify-center">
              <span className="text-xs text-gray-500">Less</span>
              <div className="flex gap-1">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
                  <div
                    key={opacity}
                    className="w-4 h-4 rounded"
                    style={{ 
                      backgroundColor: `rgba(6, 182, 212, ${opacity})`,
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">More</span>
            </div>
          </GlassCard>
        </div>

        {/* Achievement Modal */}
        <AnimatePresence>
          {showAchievements && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setShowAchievements(false)}
            >
              <GlassCard className="p-8 max-w-md">
                <h3 className="text-2xl font-bold text-white mb-4">Achievements Unlocked!</h3>
                <div className="space-y-3">
                  {[
                    { name: 'First Application', icon: Rocket, color: colors.accent.cyan },
                    { name: '10 Applications', icon: Target, color: colors.accent.purple },
                    { name: 'Interview Master', icon: MessageCircle, color: colors.accent.emerald },
                  ].map((achievement, index) => (
                    <motion.div
                      key={achievement.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <achievement.icon className="w-8 h-8" style={{ color: achievement.color }} />
                      <div className="flex-1">
                        <p className="font-medium text-white">{achievement.name}</p>
                        <p className="text-xs text-gray-400">Unlocked on {format(new Date(), 'MMM dd, yyyy')}</p>
                      </div>
                      <Star className="w-5 h-5 text-amber-400" />
                    </motion.div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Quick Add Button */}
      <motion.button
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-2xl shadow-cyan-500/25 flex items-center justify-center"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Keyboard shortcuts hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2 }}
        className="fixed bottom-8 left-8 flex items-center gap-2 text-gray-500 text-sm"
      >
        <Command className="w-4 h-4" />
        <span>Press</span>
        <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400">⌘K</kbd>
        <span>for quick actions</span>
      </motion.div>
    </div>
  );
}