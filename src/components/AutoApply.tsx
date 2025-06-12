import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Target, 
  MapPin, 
  Briefcase, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Monitor,
  Activity,
  Zap,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useBrowserUseAutomation } from '../hooks/useBrowserUseAutomation';
import { LinkedInSessionManagerComponent } from './automation/LinkedInSessionManager';
import { TaskProgressMonitor } from './automation/TaskProgressMonitor';
import { ManualOverrideModal } from './automation/ManualOverrideModal';
import { AutomationDisclaimerModal } from './automation/AutomationDisclaimerModal';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  full_name: string;
  resume_url: string | null;
}

interface AutoApplyFormData {
  jobTitle: string;
  profileId: string;
  location: string;
  jobType: string;
  workType: string;
  experienceLevel: string;
  targetJobCount: string;
}

// Demo profiles for when Supabase is not configured
const DEMO_PROFILES: Profile[] = [
  {
    id: 'demo-profile-1',
    full_name: 'Demo User',
    resume_url: 'demo-resume.pdf'
  }
];

export const AutoApply: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formData, setFormData] = useState<AutoApplyFormData>({
    jobTitle: '',
    profileId: '',
    location: '',
    jobType: 'full-time',
    workType: 'remote',
    experienceLevel: 'mid',
    targetJobCount: '25'
  });

  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'expired' | 'invalid' | 'disconnected'>('disconnected');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Browser Use automation hook
  const {
    state: automationState,
    manualOverride,
    startAutomation,
    pauseAutomation,
    resumeAutomation,
    stopAutomation,
    submitManualOverride,
    closeManualOverride,
    checkSessionStatus,
  } = useBrowserUseAutomation();

  useEffect(() => {
    fetchProfiles();
    checkSessionStatus();
  }, [user]);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);

      if (!isSupabaseConfigured() || !user) {
        setProfiles(DEMO_PROFILES);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, resume_url')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching profiles:', error);
        setProfiles(DEMO_PROFILES);
      } else {
        setProfiles(data || []);
        if (!data || data.length === 0) {
          setProfiles(DEMO_PROFILES);
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      setProfiles(DEMO_PROFILES);
    } finally {
      setLoading(false);
    }
  };

  const jobTypeOptions = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'internship', label: 'Internship' },
    { value: 'contract', label: 'Contract' },
    { value: 'part-time', label: 'Part-time' }
  ];

  const workTypeOptions = [
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'on-site', label: 'On-site' }
  ];

  const experienceLevelOptions = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior Level' },
    { value: 'executive', label: 'Executive' }
  ];

  const targetJobCountOptions = [
    { value: '10', label: '10 jobs' },
    { value: '25', label: '25 jobs' },
    { value: '50', label: '50 jobs' },
    { value: '100', label: '100 jobs' }
  ];

  const handleStartAutomation = async () => {
    if (!formData.jobTitle || !formData.location || !formData.profileId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (sessionStatus !== 'active') {
      toast.error('Please initialize your LinkedIn session first');
      return;
    }

    // Show disclaimer modal before starting
    setShowDisclaimer(true);
  };

  const handleAcceptDisclaimer = async () => {
    setShowDisclaimer(false);
    
    try {
      let campaignId = 'demo-campaign-' + Date.now();

      if (isSupabaseConfigured() && user) {
        // Create job campaign in Supabase
        const { data: campaign, error } = await supabase
          .from('job_campaigns')
          .insert({
            profile_id: formData.profileId,
            job_title: formData.jobTitle,
            location: formData.location,
            job_type: formData.jobType,
            work_type: formData.workType,
            experience_level: formData.experienceLevel,
            target_count: parseInt(formData.targetJobCount),
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        campaignId = campaign.id;
      }

      const searchCriteria = {
        jobTitle: formData.jobTitle,
        location: formData.location,
        jobType: formData.jobType,
        workType: formData.workType,
        experienceLevel: formData.experienceLevel,
        targetCount: parseInt(formData.targetJobCount),
      };

      await startAutomation(searchCriteria, campaignId);
      
    } catch (error) {
      console.error('Error starting automation:', error);
      toast.error('Failed to start automation');
    }
  };

  const getSessionStatusIcon = () => {
    switch (sessionStatus) {
      case 'active': return <Wifi className="w-5 h-5 text-green-500" />;
      case 'expired': return <WifiOff className="w-5 h-5 text-red-500" />;
      case 'invalid': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <WifiOff className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSessionStatusText = () => {
    switch (sessionStatus) {
      case 'active': return 'LinkedIn Connected';
      case 'expired': return 'Session Expired';
      case 'invalid': return 'Session Invalid';
      default: return 'Not Connected';
    }
  };

  const getSessionStatusColor = () => {
    switch (sessionStatus) {
      case 'active': return 'text-green-600 dark:text-green-400';
      case 'expired': return 'text-red-600 dark:text-red-400';
      case 'invalid': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-indigo-600/5 dark:from-blue-400/5 dark:via-purple-400/5 dark:to-indigo-400/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium mb-6"
            >
              <Zap className="w-4 h-4 mr-2" />
              AI-Powered Browser Automation
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl font-bold text-gray-900 dark:text-white mb-6"
            >
              LinkedIn Auto Apply Bot
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed"
            >
              Automatically apply to jobs across LinkedIn using advanced AI browser automation. 
              Set your criteria, initialize your session, and let our intelligent bot handle applications while you focus on interviews.
            </motion.p>
            
            {/* Session Status Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 inline-flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700"
            >
              {getSessionStatusIcon()}
              <span className={`font-medium ${getSessionStatusColor()}`}>
                {getSessionStatusText()}
              </span>
              <button
                onClick={checkSessionStatus}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-gray-400" />
              </button>
            </motion.div>
            
            {!isSupabaseConfigured() && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4 text-sm text-amber-600 dark:text-amber-400"
              >
                Demo mode - Connect Supabase to save real campaigns and usage data
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Configuration Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <Settings className="w-6 h-6 mr-3" />
                  Automation Configuration
                </h2>
                <p className="text-blue-100 mt-2">Configure your job search parameters</p>
              </div>

              <div className="p-8 space-y-6">
                {/* Profile Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <Users className="w-4 h-4 inline mr-2" />
                    Select Profile *
                  </label>
                  {profiles.length === 0 ? (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                      <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-3">
                        No profiles found. Create a profile first to use auto-apply.
                      </p>
                      <button className="premium-button-primary text-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Profile
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.profileId}
                      onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="">Choose a profile...</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name} {profile.resume_url ? '(Resume uploaded)' : '(No resume)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Job Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <Target className="w-4 h-4 inline mr-2" />
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    placeholder="e.g., Software Engineer, Product Manager"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Location *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Remote, San Francisco, New York"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Job Type and Work Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <Briefcase className="w-4 h-4 inline mr-2" />
                      Job Type
                    </label>
                    <select
                      value={formData.jobType}
                      onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      {jobTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Work Type
                    </label>
                    <select
                      value={formData.workType}
                      onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      {workTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Experience Level and Target Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Experience Level
                    </label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      {experienceLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <Target className="w-4 h-4 inline mr-2" />
                      Target Job Count
                    </label>
                    <select
                      value={formData.targetJobCount}
                      onChange={(e) => setFormData({ ...formData, targetJobCount: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      {targetJobCountOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                  {!automationState.isRunning ? (
                    <button
                      onClick={handleStartAutomation}
                      disabled={!formData.jobTitle || !formData.location || !formData.profileId || sessionStatus !== 'active'}
                      className="w-full flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl"
                    >
                      <Play className="w-6 h-6 mr-3" />
                      Start Automation
                    </button>
                  ) : (
                    <div className="flex space-x-3">
                      {automationState.isPaused ? (
                        <button
                          onClick={resumeAutomation}
                          className="flex-1 flex items-center justify-center px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={pauseAutomation}
                          className="flex-1 flex items-center justify-center px-6 py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold transition-all"
                        >
                          <Pause className="w-5 h-5 mr-2" />
                          Pause
                        </button>
                      )}
                      <button
                        onClick={stopAutomation}
                        className="flex-1 flex items-center justify-center px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop
                      </button>
                    </div>
                  )}
                </div>

                {/* Session Status Warning */}
                {sessionStatus !== 'active' && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-medium mb-1">LinkedIn Session Required</p>
                        <p>
                          You need an active LinkedIn session to start automation. 
                          Please initialize your session in the LinkedIn Session Manager below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Live Automation Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Task Progress Monitor */}
            {(automationState.isRunning || automationState.logs.length > 0) && (
              <TaskProgressMonitor
                task={automationState.currentTask}
                logs={automationState.logs}
                onPause={pauseAutomation}
                onResume={resumeAutomation}
                onStop={stopAutomation}
                canControl={true}
                isPaused={automationState.isPaused}
                progress={{
                  completedApplications: automationState.completedApplications,
                  failedApplications: automationState.failedApplications,
                  totalJobs: automationState.totalJobs,
                  currentJobIndex: automationState.currentJobIndex,
                }}
              />
            )}

            {/* LinkedIn Session Manager */}
            <LinkedInSessionManagerComponent 
              onSessionChange={setSessionStatus}
            />
          </motion.div>
        </div>
      </div>

      {/* Disclaimer Modal */}
      <AutomationDisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        onAccept={handleAcceptDisclaimer}
        jobCriteria={{
          jobTitle: formData.jobTitle,
          location: formData.location,
          targetCount: parseInt(formData.targetJobCount),
        }}
      />

      {/* Manual Override Modal */}
      <ManualOverrideModal
        isOpen={manualOverride.isOpen}
        onClose={closeManualOverride}
        questions={manualOverride.questions}
        onSubmit={submitManualOverride}
        jobInfo={manualOverride.jobInfo}
      />
    </div>
  );
};