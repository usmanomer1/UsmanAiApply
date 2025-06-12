import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  LinkedInAutomation, 
  LinkedInSessionManager, 
  TaskMonitor, 
  BrowserUseTask,
  BrowserUseErrorHandler,
  ManualOverrideQuestion
} from '../lib/browserUseAPI';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AutomationState {
  isRunning: boolean;
  isPaused: boolean;
  currentTask: BrowserUseTask | null;
  logs: string[];
  error: string | null;
  completedApplications: number;
  failedApplications: number;
  totalJobs: number;
  currentJobIndex: number;
  estimatedCost: number;
  sessionStatus: 'active' | 'expired' | 'invalid' | 'disconnected';
}

interface JobApplication {
  url: string;
  title: string;
  company: string;
  location: string;
  posted_date: string;
  easy_apply: boolean;
}

interface ManualOverrideState {
  isOpen: boolean;
  questions: ManualOverrideQuestion[];
  taskId: string | null;
  jobInfo?: { title: string; company: string };
}

export const useBrowserUseAutomation = () => {
  const [state, setState] = useState<AutomationState>({
    isRunning: false,
    isPaused: false,
    currentTask: null,
    logs: [],
    error: null,
    completedApplications: 0,
    failedApplications: 0,
    totalJobs: 0,
    currentJobIndex: 0,
    estimatedCost: 0,
    sessionStatus: 'disconnected',
  });

  const [manualOverride, setManualOverride] = useState<ManualOverrideState>({
    isOpen: false,
    questions: [],
    taskId: null,
  });

  // Refs for managing automation state
  const currentCampaignRef = useRef<string | null>(null);
  const jobQueueRef = useRef<JobApplication[]>([]);
  const retryCountRef = useRef<Record<string, number>>({});
  const searchCriteriaRef = useRef<any>(null);

  // Check session status on mount
  useEffect(() => {
    checkSessionStatus();
  }, []);

  const updateState = useCallback((updates: Partial<AutomationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const icon = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    const logEntry = `[${timestamp}] ${icon} ${message}`;
    
    setState(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-49), logEntry], // Keep last 50 logs
    }));
  }, []);

  const checkSessionStatus = async () => {
    try {
      const session = await LinkedInSessionManager.getSession();
      if (!session) {
        updateState({ sessionStatus: 'disconnected' });
      } else if (!session.is_valid) {
        updateState({ sessionStatus: 'invalid' });
      } else if (new Date(session.expires_at) <= new Date()) {
        updateState({ sessionStatus: 'expired' });
      } else {
        updateState({ sessionStatus: 'active' });
      }
    } catch (error) {
      console.error('Error checking session status:', error);
      updateState({ sessionStatus: 'disconnected' });
    }
  };

  const handleTaskUpdate = useCallback((task: BrowserUseTask) => {
    updateState({ 
      currentTask: task,
      estimatedCost: state.estimatedCost + (task.cost_usd - (state.currentTask?.cost_usd || 0))
    });
    
    // Add new logs if available
    if (task.logs && task.logs.length > 0) {
      const newLogs = task.logs.slice(state.currentTask?.logs.length || 0);
      newLogs.forEach(log => addLog(log));
    }
  }, [state.currentTask, state.estimatedCost, updateState, addLog]);

  const handleTaskComplete = useCallback(async (task: BrowserUseTask) => {
    addLog(`Task completed: ${task.task_id}`, 'success');
    
    try {
      if (task.result) {
        switch (task.result.type) {
          case 'session_initialized':
            await handleSessionInitialized(task.result);
            break;
            
          case 'job_search_results':
            await handleJobSearchResults(task.result);
            break;
            
          case 'application_submitted':
            await handleApplicationSubmitted(task.result);
            break;
            
          case 'manual_input_required':
            await handleManualInputRequired(task.result, task.task_id);
            return; // Don't continue to next job yet
            
          default:
            addLog(`Unknown result type: ${task.result.type}`, 'warning');
        }
      }
      
      // Continue to next job if available
      await processNextJob();
      
    } catch (error) {
      console.error('Error processing task result:', error);
      addLog(`Error processing result: ${error}`, 'error');
      await handleTaskError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [addLog]);

  const handleSessionInitialized = async (result: any) => {
    try {
      if (result.success && result.session_id) {
        const newSession = {
          session_id: result.session_id,
          cookies: result.cookies || [],
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          is_valid: true,
        };
        
        await LinkedInSessionManager.saveSession(newSession);
        updateState({ sessionStatus: 'active' });
        addLog('LinkedIn session initialized successfully!', 'success');
        toast.success('LinkedIn session initialized successfully!');
      } else {
        throw new Error('Session initialization failed');
      }
    } catch (error) {
      addLog('Failed to save LinkedIn session', 'error');
      toast.error('Failed to save LinkedIn session');
      throw error;
    }
  };

  const handleJobSearchResults = async (result: any) => {
    const jobs = result.jobs || [];
    jobQueueRef.current = jobs.filter((job: JobApplication) => job.easy_apply);
    
    updateState({ 
      totalJobs: jobQueueRef.current.length,
      currentJobIndex: 0 
    });
    
    addLog(`Found ${jobs.length} jobs, ${jobQueueRef.current.length} with Easy Apply`, 'success');
    
    if (jobQueueRef.current.length === 0) {
      addLog('No jobs with Easy Apply found. Stopping automation.', 'warning');
      await stopAutomation();
      toast.warning('No jobs with Easy Apply found for your criteria.');
      return;
    }
    
    // Start applying to jobs
    await processNextJob();
  };

  const handleApplicationSubmitted = async (result: any) => {
    updateState(prev => ({ 
      completedApplications: prev.completedApplications + 1,
      currentJobIndex: prev.currentJobIndex + 1
    }));
    
    // Save application to database
    await saveApplicationResult(result);
    
    addLog(`✅ Application submitted to ${result.company} - ${result.title}`, 'success');
    toast.success(`Application submitted to ${result.company}!`);
  };

  const handleManualInputRequired = async (result: any, taskId: string) => {
    addLog('Manual input required for application questions', 'warning');
    
    setManualOverride({
      isOpen: true,
      questions: result.questions || [],
      taskId: taskId,
      jobInfo: result.jobInfo,
    });
    
    // Pause automation
    updateState({ isPaused: true });
  };

  const handleTaskError = useCallback(async (error: string, taskId?: string) => {
    addLog(`Task failed: ${error}`, 'error');
    
    // Check if we should retry
    const shouldRetry = taskId && BrowserUseErrorHandler.shouldRetry(error, retryCountRef.current[taskId] || 0);
    
    if (shouldRetry) {
      const retryCount = (retryCountRef.current[taskId!] || 0) + 1;
      retryCountRef.current[taskId!] = retryCount;
      
      const delay = BrowserUseErrorHandler.getRetryDelay(error, retryCount);
      addLog(`🔄 Retrying in ${delay / 1000}s (attempt ${retryCount})`, 'warning');
      
      setTimeout(() => {
        processNextJob();
      }, delay);
      
    } else {
      // Handle specific error types
      if (BrowserUseErrorHandler.isLoginExpired(error)) {
        addLog('🔐 LinkedIn session expired. Please refresh your session.', 'error');
        await LinkedInSessionManager.invalidateSession();
        updateState({ sessionStatus: 'expired' });
        toast.error('LinkedIn session expired. Please refresh your session.');
        await stopAutomation();
        return;
      }
      
      updateState(prev => ({ 
        failedApplications: prev.failedApplications + 1,
        currentJobIndex: prev.currentJobIndex + 1,
        error: BrowserUseErrorHandler.getErrorMessage(error)
      }));
      
      // Continue to next job
      await processNextJob();
    }
  }, [updateState, addLog]);

  const saveApplicationResult = async (result: any) => {
    try {
      if (!currentCampaignRef.current) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isSupabaseConfigured = () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
      };

      if (isSupabaseConfigured()) {
        await supabase.from('applications').insert({
          campaign_id: currentCampaignRef.current,
          company: result.company,
          role: result.title,
          applied_at: new Date().toISOString(),
          status: 'SENT',
          details: {
            job_url: result.url,
            application_method: 'browser_automation',
            automation_task_id: result.task_id,
            confirmation: result.confirmation,
            application_id: result.application_id,
          },
        });
      }
      
    } catch (error) {
      console.error('Error saving application result:', error);
    }
  };

  const processNextJob = async () => {
    if (jobQueueRef.current.length === 0) {
      // No more jobs, stop automation
      addLog('🎉 All jobs processed. Automation complete.', 'success');
      updateState({ 
        isRunning: false, 
        currentTask: null,
        isPaused: false
      });
      toast.success(`Job application automation completed! Applied to ${state.completedApplications} positions.`);
      return;
    }

    const nextJob = jobQueueRef.current.shift()!;
    addLog(`📝 Starting application to ${nextJob.company} - ${nextJob.title}`, 'info');
    
    try {
      const session = await LinkedInSessionManager.getSession();
      if (!session) {
        throw new Error('No valid LinkedIn session found');
      }

      // Get user profile data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const applicationData = {
        fullName: profile?.full_name || 'Not provided',
        email: user.email || 'Not provided',
        phone: profile?.phone || 'Not provided',
      };

      const taskId = await LinkedInAutomation.applyToJob(
        nextJob.url,
        session.session_id,
        applicationData
      );

      await TaskMonitor.startMonitoring(
        taskId,
        handleTaskUpdate,
        handleTaskComplete,
        (error) => handleTaskError(error, taskId)
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await handleTaskError(errorMessage);
    }
  };

  const startAutomation = async (searchCriteria: any, campaignId: string) => {
    try {
      updateState({ 
        isRunning: true,
        isPaused: false,
        error: null, 
        completedApplications: 0, 
        failedApplications: 0,
        totalJobs: 0,
        currentJobIndex: 0,
        estimatedCost: 0,
        logs: []
      });
      
      currentCampaignRef.current = campaignId;
      searchCriteriaRef.current = searchCriteria;
      jobQueueRef.current = [];
      retryCountRef.current = {};

      addLog('🚀 Starting LinkedIn job automation...', 'info');

      // Check session
      const session = await LinkedInSessionManager.getSession();
      if (!session) {
        throw new Error('No valid LinkedIn session found. Please initialize your session first.');
      }

      if (LinkedInSessionManager.isSessionExpiring(session)) {
        addLog('⚠️ LinkedIn session expires soon. Consider refreshing.', 'warning');
        toast.warning('Your LinkedIn session expires soon. Consider refreshing it.');
      }

      addLog('🔍 Searching for jobs...', 'info');

      // Start job search
      const taskId = await LinkedInAutomation.searchJobs(searchCriteria, session.session_id);
      
      await TaskMonitor.startMonitoring(
        taskId,
        handleTaskUpdate,
        handleTaskComplete,
        (error) => handleTaskError(error, taskId)
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to start automation: ${errorMessage}`, 'error');
      updateState({ 
        isRunning: false, 
        error: errorMessage 
      });
      toast.error(`Failed to start automation: ${errorMessage}`);
    }
  };

  const pauseAutomation = async () => {
    try {
      if (state.currentTask && state.currentTask.status === 'running') {
        await TaskMonitor.pauseTask(state.currentTask.task_id);
        updateState({ isPaused: true });
        addLog('⏸️ Automation paused', 'info');
        toast.success('Automation paused');
      }
    } catch (error) {
      console.error('Error pausing automation:', error);
      toast.error('Error pausing automation');
    }
  };

  const resumeAutomation = async () => {
    try {
      if (state.currentTask && state.currentTask.status === 'paused') {
        await TaskMonitor.resumeTask(state.currentTask.task_id);
        updateState({ isPaused: false });
        addLog('▶️ Automation resumed', 'info');
        toast.success('Automation resumed');
      } else if (state.isPaused && !state.currentTask) {
        // Resume from manual override
        updateState({ isPaused: false });
        await processNextJob();
      }
    } catch (error) {
      console.error('Error resuming automation:', error);
      toast.error('Error resuming automation');
    }
  };

  const stopAutomation = async () => {
    try {
      if (state.currentTask) {
        await TaskMonitor.cancelTask(state.currentTask.task_id);
      }
      
      updateState({ 
        isRunning: false, 
        isPaused: false,
        currentTask: null 
      });
      
      jobQueueRef.current = [];
      currentCampaignRef.current = null;
      
      addLog('⏹️ Automation stopped by user', 'info');
      toast.success('Automation stopped');
      
    } catch (error) {
      console.error('Error stopping automation:', error);
      toast.error('Error stopping automation');
    }
  };

  const submitManualOverride = async (answers: Record<string, any>) => {
    try {
      if (!manualOverride.taskId) return;

      addLog('📝 Submitting manual override answers...', 'info');
      
      // Continue the task with manual answers
      const taskId = await LinkedInAutomation.continueWithManualAnswers(
        manualOverride.taskId,
        answers
      );

      // Start monitoring the continuation task
      await TaskMonitor.startMonitoring(
        taskId,
        handleTaskUpdate,
        handleTaskComplete,
        (error) => handleTaskError(error, taskId)
      );
      
      setManualOverride({
        isOpen: false,
        questions: [],
        taskId: null,
      });

      updateState({ isPaused: false });
      
    } catch (error) {
      console.error('Error submitting manual override:', error);
      toast.error('Error submitting answers');
    }
  };

  const closeManualOverride = () => {
    setManualOverride({
      isOpen: false,
      questions: [],
      taskId: null,
    });
    
    // Skip this job and continue to next
    updateState(prev => ({ 
      failedApplications: prev.failedApplications + 1,
      currentJobIndex: prev.currentJobIndex + 1,
      isPaused: false
    }));
    
    addLog('❌ Application skipped due to manual override cancellation', 'warning');
    processNextJob();
  };

  return {
    state,
    manualOverride,
    startAutomation,
    pauseAutomation,
    resumeAutomation,
    stopAutomation,
    submitManualOverride,
    closeManualOverride,
    checkSessionStatus,
  };
};