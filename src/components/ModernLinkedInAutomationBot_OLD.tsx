import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  AlertCircle, 
  Activity, 
  Eye, 
  ExternalLink, 
  TrendingUp, 
  Zap, 
  Info,
  Clock,
  CheckCircle,
  BarChart3,
  Cpu,
  ChevronDown,
  Briefcase,
  MapPin,
  Calendar,
  Target,
  Phone,
  Mail,
  Globe,
  Upload,
  FileText,
  RefreshCw
} from 'lucide-react';
import { 
  RiBriefcaseLine,
  RiCheckLine,
  RiTimeLine,
  RiAlertLine,
  RiPlayLine,
  RiPauseLine,
  RiStopLine,
  RiSettings3Line,
  RiEyeLine,
  RiExternalLinkLine,
  RiRobotLine,
  RiSparklingLine,
  RiTimer2Line,
  RiPercentLine,
  RiTrophyLine,
  RiMapPinLine,
  RiCalendarLine,
  RiTargetLine,
  RiPhoneLine,
  RiMailLine,
  RiGlobalLine,
  RiUploadLine,
  RiFileTextLine,
  RiRefreshLine,
  RiInformationLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiBarChartLine
} from '@remixicon/react';
import {
  Card,
  Metric,
  Text,
  Flex,
  ProgressBar,
  Badge,
  Grid,
  Button,
  TextInput,
  Select,
  SelectItem,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  AreaChart,
  BarList,
  List,
  ListItem,
  Callout,
  Divider,
  Title,
  Subtitle,
  Bold,
  Italic,
  NumberInput,
  SearchSelect,
  SearchSelectItem,
  Toggle,
  DateRangePicker,
  DateRangePickerValue
} from '@tremor/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { usePaywall } from '../hooks/usePaywall';
import PaywallModal from './ui/PaywallModal';
import { getPlanLimits, getProductByPriceId } from '../stripe-config';
import { BrowserUseClientProxy } from '../lib/browserUseClientProxy';
import { SessionManager } from '../lib/sessionManager';
import { isSupabaseConfigured } from '../lib/supabase';
import { 
  getUserUsage, 
  canPerformAction, 
  createAutomationSession, 
  updateAutomationSession,
  getUsageHistory 
} from '../lib/usageTracking';

// Import all the existing constants and interfaces from LinkedInAutomationBot
import { 
  FEATURE_FLAGS,
  LINKEDIN_LOCATIONS,
  COUNTRY_CODES,
  AI_MODELS
} from './LinkedInAutomationBot';

interface TaskStatus {
  id: string;
  status: 'created' | 'running' | 'paused' | 'finished' | 'failed' | 'stopped';
  live_url?: string;
  steps?: any[];
  output?: string;
  error?: string;
}

interface BrowserUseConfig {
  apiKey: string;
  linkedinEmail: string;
  linkedinPassword?: string;
  contactNumber: string;
  countryCode: string;
  linkedinResume: string;
  customInstructions: string;
  jobTitle: string;
  location: string;
  locationId: string;
  experience: string;
  remotePreference: string;
  jobType?: string;
  workType?: string;
  experienceLevel?: string;
  salaryRange?: string;
  companySize?: string;
  datePosted?: string;
  targetCount: string;
  applyToExternalJobs?: boolean;
  externalJobEmail?: string;
  externalJobPassword?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  linkedInProfileUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  aiModel?: string;
}

// Work type mapping
const WORK_TYPE_MAP = {
  'Remote': '2',
  'On-site': '1', 
  'Hybrid': '3'
};

// Experience level mapping (LinkedIn uses f_E parameter)
const EXPERIENCE_LEVEL_MAP = {
  'Internship': '1',
  'Entry level': '2',
  'Associate': '3',
  'Mid-Senior level': '4',
  'Director': '5',
  'Executive': '6'
};

const ModernLinkedInAutomationBot: React.FC = () => {
  // State management
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { checkFeatureAccess } = usePaywall();
  
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [logs, setLogs] = useState<Array<{message: string, type: 'info' | 'success' | 'error' | 'warning', timestamp: Date}>>([]);
  const [userUsage, setUserUsage] = useState<any>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [browserClient] = useState<BrowserUseClientProxy | null>(
    () => new BrowserUseClientProxy(config.apiKey)
  );
  const [sessionManager] = useState<SessionManager | null>(
    () => config.apiKey ? new SessionManager(config.apiKey) : null
  );
  const [userStoppedTask, setUserStoppedTask] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Automation metrics
  const [appliedCount, setAppliedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  // Get API key from environment variable with proper fallback
  const apiKey = import.meta.env.VITE_BROWSER_USE_API_KEY || import.meta.env.VITE_BROWSERUSE_API_KEY || 'proxy';
  
  // Configuration
  const [config, setConfig] = useState<BrowserUseConfig>({
    apiKey: apiKey,
    linkedinEmail: user?.email || '',
    linkedinPassword: '',
    contactNumber: '',
    countryCode: '+1',
    linkedinResume: '',
    customInstructions: '',
    jobTitle: '',
    location: 'San Francisco Bay Area',
    locationId: LINKEDIN_LOCATIONS['San Francisco Bay Area'],
    experience: 'All',
    remotePreference: 'All',
    datePosted: 'Past week',
    targetCount: '10',
    applyToExternalJobs: false,
    externalJobEmail: '',
    externalJobPassword: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    linkedInProfileUrl: '',
    portfolioUrl: '',
    githubUrl: '',
    aiModel: 'gpt-4o-mini'
  });

  // Chart data
  const [chartData, setChartData] = useState<any[]>([]);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);

  // Initialize and fetch data
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch subscription
      const { data: subscription } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('subscription_status', 'active')
        .maybeSingle();
      
      if (subscription) {
        setUserSubscription(subscription);
      }
      
      // Fetch usage
      const usage = await getUserUsage(user.id);
      setUserUsage(usage);
      
      // Fetch usage history for charts
      const history = await getUsageHistory(user.id, 30);
      if (history.length > 0) {
        setChartData(history.map(day => ({
          date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          Applications: day.applications,
          Steps: day.steps
        })));
      }
      
      // Fetch recent sessions
      const { data: sessions } = await supabase
        .from('automation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(5);
      
      if (sessions) {
        setSessionHistory(sessions);
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getPlanName = () => {
    return userSubscription?.product_name || 'Free';
  };

  const getRemainingApplications = () => {
    if (!userUsage) return 0;
    const remaining = userUsage.automation_steps.remaining;
    return Math.floor(remaining / 10); // 10 steps per application
  };

  const canStartAutomation = () => {
    if (!userUsage) return false;
    return userUsage.automation_steps.limit > 0 && userUsage.automation_steps.remaining > 0;
  };

  const startAutomation = async () => {
    // Implementation would go here - simplified for UI demo
    toast.success('Starting automation...');
    setIsRunning(true);
    setStartTime(new Date());
  };

  const pauseAutomation = () => {
    setIsPaused(true);
    toast.success('Automation paused');
  };

  const resumeAutomation = () => {
    setIsPaused(false);
    toast.success('Automation resumed');
  };

  const stopAutomation = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentTask(null);
    toast.success('Automation stopped');
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, startTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          AI Job Application Agent
        </h1>
        <p className="mt-2 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          Automate your LinkedIn job applications with intelligent AI assistance
        </p>
      </div>

      {/* Status Banner */}
      <Card className="mb-6" decoration="left" decorationColor={isRunning ? 'green' : 'gray'}>
        <Flex>
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-lg ${isRunning ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-900/30'}`}>
              <RiRobotLine className={`w-6 h-6 ${isRunning ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div>
              <Text className="font-semibold">Agent Status</Text>
              <Metric className="text-xl mt-1">
                {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Inactive'}
              </Metric>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isRunning ? (
              <Button
                size="lg"
                icon={RiPlayLine}
                onClick={startAutomation}
                disabled={!canStartAutomation()}
                color="green"
              >
                Start Agent
              </Button>
            ) : (
              <>
                {isPaused ? (
                  <Button
                    size="lg"
                    icon={RiPlayLine}
                    onClick={resumeAutomation}
                    color="blue"
                  >
                    Resume
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    icon={RiPauseLine}
                    onClick={pauseAutomation}
                    color="amber"
                  >
                    Pause
                  </Button>
                )}
                <Button
                  size="lg"
                  icon={RiStopLine}
                  onClick={stopAutomation}
                  color="red"
                >
                  Stop
                </Button>
              </>
            )}
          </div>
        </Flex>
      </Card>

      {/* Key Metrics */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-8">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Applications Sent</Text>
              <Metric className="mt-2">{appliedCount}</Metric>
              <Text className="mt-2 text-tremor-default">
                Target: {config.targetCount}
              </Text>
            </div>
            <Badge icon={RiBriefcaseLine} color="blue">
              {Math.round((appliedCount / parseInt(config.targetCount)) * 100)}%
            </Badge>
          </Flex>
          <ProgressBar value={(appliedCount / parseInt(config.targetCount)) * 100} className="mt-3" color="blue" />
        </Card>

        <Card decoration="top" decorationColor="green">
          <Flex alignItems="start">
            <div>
              <Text>Success Rate</Text>
              <Metric className="mt-2">
                {appliedCount > 0 ? Math.round((appliedCount / (appliedCount + errorCount)) * 100) : 0}%
              </Metric>
              <Text className="mt-2 text-tremor-default">
                {errorCount} errors
              </Text>
            </div>
            <Badge icon={RiCheckboxCircleLine} color="green">
              Active
            </Badge>
          </Flex>
          <ProgressBar 
            value={appliedCount > 0 ? (appliedCount / (appliedCount + errorCount)) * 100 : 0} 
            className="mt-3" 
            color="green" 
          />
        </Card>

        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <div>
              <Text>Time Elapsed</Text>
              <Metric className="mt-2">{formatTime(elapsedTime)}</Metric>
              <Text className="mt-2 text-tremor-default">
                {appliedCount > 0 ? `${Math.floor(elapsedTime / appliedCount)}s avg` : 'No data'}
              </Text>
            </div>
            <Badge icon={RiTimer2Line} color="amber">
              Running
            </Badge>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="purple">
          <Flex alignItems="start">
            <div>
              <Text>Remaining Credits</Text>
              <Metric className="mt-2">{getRemainingApplications()}</Metric>
              <Text className="mt-2 text-tremor-default">
                Plan: {getPlanName()}
              </Text>
            </div>
            <Badge icon={RiSparklingLine} color="purple">
              {userUsage ? `${Math.round((userUsage.automation_steps.used / userUsage.automation_steps.limit) * 100)}%` : '0%'}
            </Badge>
          </Flex>
          <ProgressBar 
            value={userUsage ? (userUsage.automation_steps.used / userUsage.automation_steps.limit) * 100 : 0} 
            className="mt-3" 
            color="purple" 
          />
        </Card>
      </Grid>

      {/* Main Content Tabs */}
      <TabGroup defaultIndex={0} onIndexChange={setSelectedTab}>
        <TabList className="mb-6">
          <Tab icon={RiSettings3Line}>Configuration</Tab>
          <Tab icon={RiEyeLine}>Browser Preview</Tab>
          <Tab icon={RiBarChartLine}>Analytics</Tab>
          <Tab icon={RiFileTextLine}>Activity Log</Tab>
          <Tab icon={RiInformationLine}>Help & Tips</Tab>
        </TabList>

        <TabPanels>
          {/* Configuration Tab */}
          <TabPanel>
            <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
              {/* Job Search Settings */}
              <Card>
                <div className="mb-4">
                  <Title>Job Search Criteria</Title>
                  <Text className="mt-1">Define what jobs the agent should apply to</Text>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Text className="mb-2">Job Title</Text>
                    <TextInput
                      placeholder="e.g., Software Engineer"
                      value={config.jobTitle}
                      onChange={(e) => setConfig(prev => ({...prev, jobTitle: e.target.value}))}
                    />
                  </div>

                  <div>
                    <Text className="mb-2">Location</Text>
                    <SearchSelect
                      value={config.location}
                      onValueChange={(value) => {
                        // Only update config, don't trigger any automation restart
                        const locationId = LINKEDIN_LOCATIONS[value as keyof typeof LINKEDIN_LOCATIONS] || '0';
                        setConfig(prev => ({...prev, location: value, locationId}));
                      }}
                      className="[&_button]:bg-white [&_button]:dark:bg-dark-tremor-background"
                    >
                      {Object.keys(LINKEDIN_LOCATIONS).map(loc => (
                        <SearchSelectItem key={loc} value={loc}>
                          {loc}
                        </SearchSelectItem>
                      ))}
                    </SearchSelect>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Text className="mb-2">Experience Level</Text>
                      <Select
                        value={config.experience}
                        onValueChange={(value) => setConfig(prev => ({...prev, experience: value}))}
                      >
                        <SelectItem value="All">All Levels</SelectItem>
                        <SelectItem value="Internship">Internship</SelectItem>
                        <SelectItem value="Entry level">Entry Level</SelectItem>
                        <SelectItem value="Associate">Associate</SelectItem>
                        <SelectItem value="Mid-Senior level">Mid-Senior</SelectItem>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Executive">Executive</SelectItem>
                      </Select>
                    </div>

                    <div>
                      <Text className="mb-2">Work Type</Text>
                      <Select
                        value={config.remotePreference}
                        onValueChange={(value) => setConfig(prev => ({...prev, remotePreference: value}))}
                      >
                        <SelectItem value="All">All Types</SelectItem>
                        <SelectItem value="Remote">Remote</SelectItem>
                        <SelectItem value="On-site">On-site</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Text className="mb-2">Date Posted</Text>
                      <Select
                        value={config.datePosted || 'All time'}
                        onValueChange={(value) => setConfig(prev => ({...prev, datePosted: value}))}
                      >
                        <SelectItem value="All time">All Time</SelectItem>
                        <SelectItem value="Past 24 hours">Past 24 Hours</SelectItem>
                        <SelectItem value="Past week">Past Week</SelectItem>
                        <SelectItem value="Past month">Past Month</SelectItem>
                      </Select>
                    </div>

                    <div>
                      <Text className="mb-2">Target Applications</Text>
                      <NumberInput
                        value={parseInt(config.targetCount)}
                        onValueChange={(value) => setConfig(prev => ({...prev, targetCount: value.toString()}))}
                        min={1}
                        max={50}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Contact Information */}
              <Card>
                <div className="mb-4">
                  <Title>Contact Information</Title>
                  <Text className="mt-1">Your details for job applications</Text>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Text className="mb-2">LinkedIn Email</Text>
                    <TextInput
                      type="email"
                      placeholder="your@email.com"
                      value={config.linkedinEmail}
                      onChange={(e) => setConfig(prev => ({...prev, linkedinEmail: e.target.value}))}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Text className="mb-2">Country</Text>
                      <Select
                        value={config.countryCode}
                        onValueChange={(value) => setConfig(prev => ({...prev, countryCode: value}))}
                        className="[&_button]:bg-white [&_button]:dark:bg-dark-tremor-background"
                      >
                        {COUNTRY_CODES.map(country => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.flag} {country.code}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Text className="mb-2">Phone Number</Text>
                      <TextInput
                        type="tel"
                        placeholder="123-456-7890"
                        value={config.contactNumber}
                        onChange={(e) => setConfig(prev => ({...prev, contactNumber: e.target.value}))}
                        className="bg-white dark:bg-dark-tremor-background"
                      />
                    </div>
                  </div>

                  <div>
                    <Text className="mb-2">Resume Name</Text>
                    <TextInput
                      placeholder="e.g., John_Doe_Resume.pdf"
                      value={config.linkedinResume}
                      onChange={(e) => setConfig(prev => ({...prev, linkedinResume: e.target.value}))}
                    />
                  </div>

                  <div>
                    <Text className="mb-2">AI Model</Text>
                    <Select
                      value={config.aiModel || 'gpt-4o-mini'}
                      onValueChange={(value) => setConfig(prev => ({...prev, aiModel: value}))}
                    >
                      {Object.entries(AI_MODELS).map(([key, model]) => (
                        <SelectItem key={key} value={key}>
                          {model.name} - {model.description}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Text className="mb-2">Custom Instructions (Optional)</Text>
                    <textarea
                      className="w-full px-3 py-2 text-tremor-default border border-tremor-border rounded-tremor-default focus:outline-none focus:ring-2 focus:ring-tremor-brand dark:bg-dark-tremor-background dark:border-dark-tremor-border"
                      rows={3}
                      placeholder="Any special instructions for the AI agent..."
                      value={config.customInstructions}
                      onChange={(e) => setConfig(prev => ({...prev, customInstructions: e.target.value}))}
                    />
                  </div>
                </div>
              </Card>

              {/* External Job Applications - Only show if feature flag is enabled */}
              {FEATURE_FLAGS.ENABLE_EXTERNAL_APPLICATIONS && (
                <Card className="lg:col-span-2">
                  <div className="mb-4">
                    <Title>External Job Applications</Title>
                    <Text className="mt-1">Settings for non-Easy Apply jobs</Text>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="applyToExternal"
                        checked={config.applyToExternalJobs}
                        onChange={(e) => setConfig(prev => ({...prev, applyToExternalJobs: e.target.checked}))}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="applyToExternal" className="text-tremor-default font-medium">
                        Apply to external jobs (non-Easy Apply)
                      </label>
                    </div>

                    {config.applyToExternalJobs && (
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <Text className="mb-2">External Job Email</Text>
                          <TextInput
                            type="email"
                            placeholder="email@example.com"
                            value={config.externalJobEmail}
                            onChange={(e) => setConfig(prev => ({...prev, externalJobEmail: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">External Job Password</Text>
                          <TextInput
                            type="password"
                            placeholder="Password for external sites"
                            value={config.externalJobPassword}
                            onChange={(e) => setConfig(prev => ({...prev, externalJobPassword: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">First Name</Text>
                          <TextInput
                            placeholder="John"
                            value={config.firstName}
                            onChange={(e) => setConfig(prev => ({...prev, firstName: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">Last Name</Text>
                          <TextInput
                            placeholder="Doe"
                            value={config.lastName}
                            onChange={(e) => setConfig(prev => ({...prev, lastName: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">LinkedIn Profile URL</Text>
                          <TextInput
                            type="url"
                            placeholder="https://linkedin.com/in/johndoe"
                            value={config.linkedInProfileUrl}
                            onChange={(e) => setConfig(prev => ({...prev, linkedInProfileUrl: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">Portfolio URL (Optional)</Text>
                          <TextInput
                            type="url"
                            placeholder="https://yourportfolio.com"
                            value={config.portfolioUrl}
                            onChange={(e) => setConfig(prev => ({...prev, portfolioUrl: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">GitHub URL (Optional)</Text>
                          <TextInput
                            type="url"
                            placeholder="https://github.com/yourusername"
                            value={config.githubUrl}
                            onChange={(e) => setConfig(prev => ({...prev, githubUrl: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">Street Address</Text>
                          <TextInput
                            placeholder="123 Main St"
                            value={config.address}
                            onChange={(e) => setConfig(prev => ({...prev, address: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">City</Text>
                          <TextInput
                            placeholder="San Francisco"
                            value={config.city}
                            onChange={(e) => setConfig(prev => ({...prev, city: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">State</Text>
                          <TextInput
                            placeholder="CA"
                            value={config.state}
                            onChange={(e) => setConfig(prev => ({...prev, state: e.target.value}))}
                          />
                        </div>

                        <div>
                          <Text className="mb-2">ZIP Code</Text>
                          <TextInput
                            placeholder="94105"
                            value={config.zipCode}
                            onChange={(e) => setConfig(prev => ({...prev, zipCode: e.target.value}))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </Grid>
          </TabPanel>

          {/* Browser Preview Tab */}
          <TabPanel>
            <Card>
              <div className="mb-4">
                <Title>Live Browser Preview</Title>
                <Text className="mt-1">Watch the automation in real-time</Text>
              </div>
              
              {currentTask?.live_url ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <RiEyeLine className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <Text className="font-semibold">Browser Session Active</Text>
                        <Text className="text-tremor-label">Automation is running</Text>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      icon={RiExternalLinkLine}
                      onClick={() => {
                        const width = 1280;
                        const height = 800;
                        const left = (window.screen.width - width) / 2;
                        const top = (window.screen.height - height) / 2;
                        window.open(
                          currentTask.live_url, 
                          'browser_preview',
                          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                        );
                      }}
                    >
                      Open Preview Window
                    </Button>
                  </div>
                  
                  <Callout title="Browser Control" icon={RiInformationLine} color="blue">
                    The browser preview opens in a separate window where you can watch the AI agent navigate LinkedIn and apply to jobs in real-time. 
                    The agent will pause if manual intervention is needed (e.g., login or captcha).
                  </Callout>
                  
                  <div className="mt-6">
                    <Text className="font-semibold mb-3">Current Activity</Text>
                    <div className="space-y-2">
                      {logs.slice(-5).map((log, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <div className={`mt-1 w-2 h-2 rounded-full ${
                            log.type === 'success' ? 'bg-green-500' : 
                            log.type === 'error' ? 'bg-red-500' : 
                            log.type === 'warning' ? 'bg-amber-500' : 
                            'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <Text className="text-tremor-default">{log.message}</Text>
                            <Text className="text-tremor-label">{log.timestamp.toLocaleTimeString()}</Text>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 mb-4 text-tremor-content-subtle dark:text-dark-tremor-content-subtle">
                    <RiEyeLine className="w-full h-full" />
                  </div>
                  <Text className="text-tremor-default font-medium mb-2">No Active Browser Session</Text>
                  <Text className="text-tremor-label">Start the automation to see the browser preview</Text>
                </div>
              )}
            </Card>
          </TabPanel>

          {/* Analytics Tab */}
          <TabPanel>
            <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
              <Card>
                <Title>Application Trends</Title>
                <Text>Daily applications over the last 30 days</Text>
                <AreaChart
                  className="h-72 mt-4"
                  data={chartData}
                  index="date"
                  categories={["Applications", "Steps"]}
                  colors={["blue", "purple"]}
                  showLegend={true}
                  showGridLines={false}
                  yAxisWidth={40}
                />
              </Card>

              <Card>
                <Title>Recent Sessions</Title>
                <Text>Your last 5 automation sessions</Text>
                <List className="mt-4">
                  {sessionHistory.map((session, idx) => (
                    <ListItem key={idx}>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Text className="font-medium">
                            {session.job_title || 'Job Search'}
                          </Text>
                          <Text className="text-tremor-label">
                            {new Date(session.started_at).toLocaleDateString()} • {session.applications_submitted || 0} applied
                          </Text>
                        </div>
                        <Badge color={session.status === 'finished' ? 'green' : session.status === 'failed' ? 'red' : 'amber'}>
                          {session.status}
                        </Badge>
                      </div>
                    </ListItem>
                  ))}
                  {sessionHistory.length === 0 && (
                    <Text className="text-center py-4 text-tremor-content">
                      No sessions yet. Start your first automation!
                    </Text>
                  )}
                </List>
              </Card>
            </Grid>
          </TabPanel>

          {/* Activity Log Tab */}
          <TabPanel>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <Title>Activity Log</Title>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setLogs([])}
                >
                  Clear Log
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      log.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                      log.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                      log.type === 'warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                      'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <Text className={`${
                        log.type === 'error' ? 'text-red-700 dark:text-red-400' :
                        log.type === 'success' ? 'text-green-700 dark:text-green-400' :
                        log.type === 'warning' ? 'text-amber-700 dark:text-amber-400' :
                        'text-gray-700 dark:text-gray-400'
                      }`}>
                        {log.message}
                      </Text>
                      <Text className="text-tremor-label text-tremor-content">
                        {log.timestamp.toLocaleTimeString()}
                      </Text>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <Text className="text-center py-8 text-tremor-content">
                    No activity yet. Start the agent to see logs here.
                  </Text>
                )}
              </div>
            </Card>
          </TabPanel>

          {/* Help Tab */}
          <TabPanel>
            <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
              <Card>
                <Title>Quick Tips</Title>
                <List className="mt-4 space-y-3">
                  <ListItem>
                    <RiCheckLine className="w-5 h-5 text-green-600 mr-2" />
                    <Text>Make sure your LinkedIn profile is complete before starting</Text>
                  </ListItem>
                  <ListItem>
                    <RiCheckLine className="w-5 h-5 text-green-600 mr-2" />
                    <Text>Upload your resume to LinkedIn for better application success</Text>
                  </ListItem>
                  <ListItem>
                    <RiCheckLine className="w-5 h-5 text-green-600 mr-2" />
                    <Text>Set realistic target numbers (10-20 applications per session)</Text>
                  </ListItem>
                  <ListItem>
                    <RiCheckLine className="w-5 h-5 text-green-600 mr-2" />
                    <Text>Use specific job titles for better matching</Text>
                  </ListItem>
                  <ListItem>
                    <RiCheckLine className="w-5 h-5 text-green-600 mr-2" />
                    <Text>Check your email for application confirmations</Text>
                  </ListItem>
                </List>
              </Card>

              <Card>
                <Title>Common Issues</Title>
                <div className="mt-4 space-y-4">
                  <Callout title="Login Required" color="blue">
                    The agent will pause when login is needed. Complete the login manually, then click Resume.
                  </Callout>
                  <Callout title="Session Timeout" color="amber">
                    LinkedIn sessions expire after inactivity. Refresh the page and restart if needed.
                  </Callout>
                  <Callout title="Rate Limiting" color="red">
                    Applying too quickly may trigger LinkedIn's rate limits. The agent will automatically slow down.
                  </Callout>
                </div>
              </Card>
            </Grid>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Paywall Modal */}
      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="AI Job Applications"
          requiredPlan="Plus"
        />
      )}
    </>
  );
};

export default ModernLinkedInAutomationBot;