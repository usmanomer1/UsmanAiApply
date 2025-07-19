import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Briefcase, Filter, Loader2, ChevronRight, Heart, Users, DollarSign, Building2, Star, Bookmark, ArrowUpRight, TrendingUp } from 'lucide-react';
import { joboticApi, JobMatchRequest, StreamCallbacks } from '../lib/joboticApi';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import * as sessionUtils from '../lib/sessionUtils';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { ResumeAnalyzerV2 } from './ResumeAnalyzerV2';
import { toast } from 'react-hot-toast';
import LoadingTransition from './LoadingTransition';
import { useLocation } from 'react-router-dom';
import { trackJobSearchUsage } from '../lib/jobSearchUsage';
import { getPlanLimits } from '../stripe-config';
import { JobSkeleton } from './JobSkeleton';

interface Job {
  job_id: string;
  employer_name: string;
  employer_logo?: string;
  job_title: string;
  job_description: string;
  job_apply_link: string;
  job_is_remote: boolean;
  job_city: string;
  job_state: string;
  job_country?: string;
  job_posted_at_datetime_utc: string;
  job_employment_type: string;
  job_required_skills?: string[];
  job_min_salary?: number;
  job_max_salary?: number;
  match_score: number;
  match_label?: string;
  match_reasons?: string[];
  missing_skills?: string[];
  key_strengths?: string[];
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  };
  job_apply_quality_score?: number;
  job_offer_expiration_timestamp?: number;
  application_deadline_days?: number;
  job_apply_is_direct?: boolean;
}

const JobSearchPage: React.FC = () => {
  const { user } = useAuth();
  const routeLocation = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    employment_types: [] as string[],
    date_posted: '',
    job_requirements: [] as string[],
    remote_jobs_only: false
  });
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [showResumeOptimizeModal, setShowResumeOptimizeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommended' | 'liked' | 'applied'>('recommended');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [showLoadingTransition, setShowLoadingTransition] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const [usageStats, setUsageStats] = useState<{ jobsViewed: number; jobLimit: number }>({ jobsViewed: 0, jobLimit: 100 });
  
  // Streaming states
  const [streamProgress, setStreamProgress] = useState(0);
  const [totalJobsFound, setTotalJobsFound] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const currentControllerRef = useRef<AbortController | null>(null);
  
  // Modal state - temporary values while modal is open
  const [modalFilters, setModalFilters] = useState({
    searchQuery: '',
    location: '',
    employment_types: [] as string[],
    date_posted: '',
    job_requirements: [] as string[],
    remote_jobs_only: false
  });

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (currentControllerRef.current) {
        currentControllerRef.current.abort();
        currentControllerRef.current = null;
      }
    };
  }, []);

  // Filter jobs based on activeTab only (backend handles other filters)
  const displayedJobs = jobs.filter(job => {
    if (activeTab === 'liked') return savedJobs.has(job.job_id);
    if (activeTab === 'applied') return appliedJobs.has(job.job_id);
    return activeTab === 'recommended'; // Show all jobs for recommended tab
  });

  // Load saved job interactions and usage stats
  useEffect(() => {
    const loadJobInteractionsAndUsage = async () => {
      if (!user?.id) return;
      
      try {
        // Load job interactions
        const { data, error } = await supabase
          .from('job_interactions')
          .select('job_id, interaction_type')
          .eq('user_id', user.id);
          
        if (!error && data) {
          const saved = new Set<string>();
          const applied = new Set<string>();
          
          data.forEach(interaction => {
            if (interaction.interaction_type === 'liked') {
              saved.add(interaction.job_id);
            } else if (interaction.interaction_type === 'applied') {
              applied.add(interaction.job_id);
            }
          });
          
          setSavedJobs(saved);
          setAppliedJobs(applied);
        }

        // Load usage stats based on user's subscription
        const { data: subscription } = await supabase
          .from('stripe_user_subscriptions')
          .select('price_id')
          .eq('user_id', user.id)
          .single();

        if (subscription?.price_id) {
          const planLimits = getPlanLimits(subscription.price_id);
          if (planLimits) {
            setUsageStats({
              jobsViewed: 0,
              jobLimit: planLimits.applications || 100
            });
          }
        } else {
          // Free tier defaults
          setUsageStats({ jobsViewed: 0, jobLimit: 100 });
        }
      } catch (error) {
        console.error('Error loading job interactions and usage:', error);
      }
    };
    
    loadJobInteractionsAndUsage();
  }, [user]);
  
  // Handle click outside for filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterModal(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if coming from onboarding
  useEffect(() => {
    if (routeLocation.state?.fromOnboarding) {
      setShowLoadingTransition(true);
    }
  }, [routeLocation]);

  // Fetch user's resume and preferences, then auto-search
  useEffect(() => {
    const fetchResumeAndPreferences = async () => {
      if (!user?.id) return;

      setInitializing(true);
      try {
        // Fetch profile and preferences separately
        // Use .limit(1) and handle array response to avoid errors with multiple profiles
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('resume_url, location, current_job_title, salary_min, salary_max, desired_roles')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        const profile = profiles?.[0] || null;
        console.log('Profile fetch result:', { profile, profileError, profileCount: profiles?.length });

        // Try to fetch job preferences from the new table
        let jobPrefs = null;
        try {
          const { data, error } = await supabase
            .from('job_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (!error || error.code === 'PGRST116') { // PGRST116 = no rows returned
            jobPrefs = data;
          }
        } catch (error) {
          console.log('job_preferences fetch error:', error);
        }
        
        // If no profile found or no resume, show a message
        if (!profile || !profile.resume_url) {
          console.log('No profile or resume found');
          setError('Please upload your resume in your profile to see job recommendations');
          setLoading(false);
          setInitializing(false);
          return;
        }

        if (profile?.resume_url) {
          // The resume_url is already just the path (e.g., "user-id/resume.pdf")
          const filePath = profile.resume_url;
          console.log('Attempting to download resume from:', filePath);
          
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('resumes')
            .download(filePath);

          if (downloadError) {
            console.error('Error downloading resume:', downloadError);
          } else if (fileData) {
            const text = await extractTextFromPDF(fileData as File);
            setResumeText(text);
            console.log('Resume text extracted, length:', text.length);
            
            // Auto-search with preferences if available
            console.log('Auto-search conditions:', { initialLoad, jobPrefs, hasText: !!text, profile });
            if (initialLoad && text && (jobPrefs || profile?.current_job_title)) {
              console.log('Job preferences:', jobPrefs);
              console.log('Profile data:', profile);
              
              // Determine search query
              let primaryRole = '';
              if (jobPrefs?.job_titles && jobPrefs.job_titles.length > 0) {
                // Use the first job title as the search query
                primaryRole = jobPrefs.job_titles[0]
                  .replace('-', ' ')
                  .split(' ')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
              } else if (profile?.current_job_title) {
                // Fall back to profile job title
                primaryRole = profile.current_job_title;
              }
              
              // Only proceed if we have a role to search for
              if (primaryRole) {
                // Handle location - prioritize profile.location first (most recent update)
                let primaryLocation = '';
                if (profile?.location) {
                  // Use profile location as primary source
                  primaryLocation = profile.location;
                } else if (jobPrefs?.locations && jobPrefs.locations.length > 0) {
                  // Fall back to job preferences location
                  const firstLocation = jobPrefs.locations[0];
                  if (firstLocation === 'remote') {
                    primaryLocation = 'Remote';
                  } else if (['san-francisco', 'new-york', 'austin', 'seattle', 'denver', 'boston', 'chicago'].includes(firstLocation)) {
                    // Standard location - format it
                    primaryLocation = firstLocation.replace('-', ' ').split(' ')
                      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                  } else {
                    // Custom location - use as is
                    primaryLocation = firstLocation;
                  }
                }
                
                setSearchQuery(primaryRole);
                setLocation(primaryLocation);
                
                // Apply salary preferences to filters if available
                if (profile?.salary_min && profile?.salary_max) {
                  setFilters(prev => ({
                    ...prev,
                    salaryRange: `${profile.salary_min}-${profile.salary_max}`
                  }));
                }
                
                // Apply job type preferences if available in desired_roles
                if (profile?.desired_roles && profile.desired_roles.length > 0) {
                  // Check if desired roles contain specific job types
                  const roles = profile.desired_roles.map((r: string) => r.toLowerCase());
                  if (roles.some((r: string) => r.includes('remote'))) {
                    setFilters(prev => ({ ...prev, remote_jobs_only: true }));
                  }
                }
                
                // Perform auto-search - use AI search if we have resume for match scores
                setLoading(true);
                setIsStreaming(true);
                setStreamProgress(0);
                setTotalJobsFound(0);
                setProcessedCount(0);
                setProgressMessage('Searching for jobs...');
                // Create new session for infinite scroll
                const session = sessionUtils.createSession(primaryRole, primaryLocation || '', filters);
                setSessionId(session.sessionId);
                setHasMore(true);
                setCurrentPage(1);
                
                // Create abort controller for auto-search
                currentControllerRef.current = new AbortController();
                
                try {
                  const aiRequest: JobMatchRequest = {
                    resumeText: text,
                    query: primaryRole,
                    location: primaryLocation || undefined,
                    page: 1,
                    num_pages: 2, // Get 2 pages (20 jobs) by default - backend limit
                    session_id: session.sessionId,
                    // Apply saved filters if available
                    ...(filters.remote_jobs_only && { remote_jobs_only: true })
                  };
                  
                  // Define streaming callbacks for auto-search
                  const autoSearchCallbacks: StreamCallbacks = {
                    initial: (data) => {
                      setTotalJobsFound(data.totalFound);
                      setProgressMessage(`Found ${data.totalFound} jobs matching your profile`);
                    },
                    keepalive: (data) => {
                      console.log('Auto-search keepalive received at:', new Date(data.timestamp * 1000));
                    },
                    jobs: (data) => {
                      // Sanitize job data to prevent NaN issues
                      const sanitizedJobs = data.jobs.map(job => ({
                        ...job,
                        match_score: typeof job.match_score === 'number' && !isNaN(job.match_score) ? job.match_score : null,
                        job_min_salary: typeof job.job_min_salary === 'number' && !isNaN(job.job_min_salary) ? job.job_min_salary : null,
                        job_max_salary: typeof job.job_max_salary === 'number' && !isNaN(job.job_max_salary) ? job.job_max_salary : null,
                        job_apply_quality_score: typeof job.job_apply_quality_score === 'number' && !isNaN(job.job_apply_quality_score) ? job.job_apply_quality_score : null,
                        // Ensure required string fields have defaults
                        employer_name: job.employer_name || 'Unknown Company',
                        job_title: job.job_title || 'Unknown Position',
                        job_city: job.job_city || '',
                        job_state: job.job_state || '',
                        job_description: job.job_description || '',
                        job_employment_type: job.job_employment_type || 'Full-time',
                        job_posted_at_datetime_utc: job.job_posted_at_datetime_utc || new Date().toISOString(),
                      }));
                      
                      setJobs(prevJobs => [...prevJobs, ...sanitizedJobs]);
                      setStreamProgress((data.batchNumber / data.totalBatches) * 100);
                      setProcessedCount(prev => prev + data.jobs.length);
                    },
                    progress: (data) => {
                      setProcessedCount(data.processed);
                      setProgressMessage(`Processing ${data.processed} of ${data.total} jobs...`);
                      setStreamProgress(data.percentage);
                    },
                    complete: async (data) => {
                      setUsageStats({
                        jobsViewed: data.usage?.monthly_used || 0,
                        jobLimit: data.usage?.monthly_limit || 100
                      });
                      setLoading(false);
                      setIsStreaming(false);
                      setProgressMessage('');
                      
                      if (user?.id && data.totalProcessed > 0) {
                        await trackJobSearchUsage(user.id, data.totalProcessed, {
                          search_type: 'auto_search',
                          query: primaryRole,
                          location: primaryLocation
                        });
                      }
                      
                      // Update pagination state
                      const jobsPerPage = 10;
                      const totalPages = Math.ceil(data.totalProcessed / jobsPerPage);
                      setTotalPages(totalPages);
                      setHasMore(data.totalProcessed > jobsPerPage);
                      
                      // Update session with results
                      sessionUtils.updateSession({
                        totalJobsFound: data.totalProcessed,
                        jobsLoaded: jobs.length
                      });
                      
                      // Only show toast if no jobs found (important feedback)
                      if (data.totalProcessed === 0) {
                        toast('No jobs found. Try updating your preferences.');
                      }
                      // Silent success - jobs are already visible on screen
                    },
                    error: (data) => {
                      console.error('Auto-search streaming error:', data);
                    }
                  };
                  
                  await joboticApi.searchJobsStreaming(aiRequest, autoSearchCallbacks, currentControllerRef.current.signal);
                  
                  setInitialLoad(false);
                } catch (err) {
                  if (err instanceof Error && err.name !== 'AbortError') {
                    console.error('Auto-search error:', err);
                  }
                } finally {
                  setLoading(false);
                  setIsStreaming(false);
                  currentControllerRef.current = null;
                }
              } else {
                // No specific role found, do a general search
                console.log('No specific role found, performing general search');
                setSearchQuery('Software Engineer'); // Default search
                setLocation('Remote');
                
                const session = sessionUtils.createSession('Software Engineer', 'Remote', filters);
                const aiRequest: JobMatchRequest = {
                  resumeText: text,
                  query: 'Software Engineer',
                  location: 'Remote',
                  page: 1,
                  num_pages: 2, // Get 2 pages (20 jobs) by default - backend limit
                  session_id: session.sessionId
                };

                setLoading(true);
                // Set session ID for infinite scroll
                setSessionId(session.sessionId);
                setHasMore(true);
                setCurrentPage(1);
                try {
                  // Always use AI-powered search
                  const response = await joboticApi.searchJobs(aiRequest);
                  setJobs(response.data?.jobs || []);
                  // Set pagination state from response
                  setHasMore(response.data?.hasMore || false);
                  setTotalPages(response.data?.totalPages || 1);
                  setCurrentPage(response.data?.currentPage || 1);
                  
                  // Update usage stats from API response
                  if (response.usage) {
                    setUsageStats({
                      jobsViewed: response.usage.monthly_used,
                      jobLimit: typeof response.usage.monthly_limit === 'number' ? response.usage.monthly_limit : -1
                    });
                  }
                  
                  setInitialLoad(false);
                } catch (err) {
                  console.error('Default search error:', err);
                  setError('Unable to load jobs. Please try searching manually.');
                } finally {
                  setLoading(false);
                }
              } // end if (primaryRole)
            } // end if (initialLoad && text && (jobPrefs || profile?.current_job_title))
          }
        }
      } catch (error) {
        console.error('Error fetching resume:', error);
        setError('Error loading your profile. Please refresh the page.');
      } finally {
        setInitializing(false);
      }
    };

    fetchResumeAndPreferences();
  }, [user, initialLoad, filters, jobs.length]);

  const searchJobs = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a job title or keyword');
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in to search for jobs');
      return;
    }

    // Cancel previous search if any
    if (currentControllerRef.current) {
      currentControllerRef.current.abort();
    }

    // Reset state
    setJobs([]);
    setLoading(true);
    setError(null);
    setIsStreaming(true);
    setStreamProgress(0);
    setTotalJobsFound(0);
    setProcessedCount(0);
    setProgressMessage('Initializing search...');
    
    // Create new session for search
    const session = sessionUtils.createSession(searchQuery, location || '', filters);
    setSessionId(session.sessionId);
    setCurrentPage(1);
    setHasMore(true);

    // Create new abort controller
    currentControllerRef.current = new AbortController();

    try {
      // Always use AI-powered search endpoint
      if (!resumeText) {
        toast('Please upload your resume in your profile to get AI-matched job recommendations.');
        setError('Resume required for job matching. Please upload your resume in your profile.');
        setLoading(false);
        setIsStreaming(false);
        return;
      }

      const request: JobMatchRequest = {
        resumeText: resumeText,
        query: searchQuery,
        location: location || undefined,
        page: 1,
        num_pages: 2, // Default to 2 pages (20 jobs) - backend limit
        session_id: session.sessionId,
        // Include filters
        ...(filters.employment_types.length > 0 && { employment_types: filters.employment_types as ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[] }),
        ...(filters.date_posted && { date_posted: filters.date_posted as 'all' | 'today' | '3days' | 'week' | 'month' }),
        ...(filters.remote_jobs_only && { remote_jobs_only: true }),
        ...(filters.job_requirements.length > 0 && { job_requirements: filters.job_requirements as ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[] })
      };

      // Define streaming callbacks
      const callbacks: StreamCallbacks = {
        initial: (data) => {
          setTotalJobsFound(data.totalFound);
          setProgressMessage(`Found ${data.totalFound} jobs matching your criteria`);
        },
        keepalive: (data) => {
          console.log('Search keepalive received at:', new Date(data.timestamp * 1000));
        },
        jobs: (data) => {
          // Sanitize job data to prevent NaN issues
          const sanitizedJobs = data.jobs.map(job => ({
            ...job,
            match_score: typeof job.match_score === 'number' && !isNaN(job.match_score) ? job.match_score : null,
            job_min_salary: typeof job.job_min_salary === 'number' && !isNaN(job.job_min_salary) ? job.job_min_salary : null,
            job_max_salary: typeof job.job_max_salary === 'number' && !isNaN(job.job_max_salary) ? job.job_max_salary : null,
            job_apply_quality_score: typeof job.job_apply_quality_score === 'number' && !isNaN(job.job_apply_quality_score) ? job.job_apply_quality_score : null,
            // Ensure required string fields have defaults
            employer_name: job.employer_name || 'Unknown Company',
            job_title: job.job_title || 'Unknown Position',
            job_city: job.job_city || '',
            job_state: job.job_state || '',
            job_description: job.job_description || '',
            job_employment_type: job.job_employment_type || 'Full-time',
            job_posted_at_datetime_utc: job.job_posted_at_datetime_utc || new Date().toISOString(),
          }));
          
          setJobs(prevJobs => [...prevJobs, ...sanitizedJobs]);
          setStreamProgress((data.batchNumber / data.totalBatches) * 100);
          setProcessedCount(prev => prev + data.jobs.length);
        },
        progress: (data) => {
          setProcessedCount(data.processed);
          setProgressMessage(`Processing ${data.processed} of ${data.total} jobs...`);
          setStreamProgress(data.percentage);
        },
        complete: async (data) => {
          setUsageStats({
            jobsViewed: data.usage?.monthly_used || 0,
            jobLimit: data.usage?.monthly_limit || 100
          });
          setLoading(false);
          setIsStreaming(false);
          setProgressMessage('');
          
          if (user?.id && data.totalProcessed > 0) {
            await trackJobSearchUsage(user.id, data.totalProcessed, {
              search_type: 'manual_search',
              query: searchQuery,
              location: location
            });
          }
          
          // Update pagination state based on total processed
          const jobsPerPage = 10;
          const totalPages = Math.ceil(data.totalProcessed / jobsPerPage);
          setTotalPages(totalPages);
          setHasMore(data.totalProcessed > jobsPerPage);
          
          // Update session with results
          sessionUtils.updateSession({
            totalJobsFound: data.totalProcessed,
            jobsLoaded: jobs.length
          });
        },
        error: (data) => {
          console.error('Streaming error:', data);
          toast.error(`Error processing batch ${data.batchNumber}: ${data.message}`);
        }
      };

      // Use streaming API
      await joboticApi.searchJobsStreaming(request, callbacks, currentControllerRef.current.signal);
      
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const errorMessage = err.message;
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
      setIsStreaming(false);
      currentControllerRef.current = null;
    }
  };


  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    if (min) return `$${(min / 1000).toFixed(0)}k+`;
    if (max) return `Up to $${(max / 1000).toFixed(0)}k`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-teal-600 bg-teal-50 border-teal-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };
  
  const getMatchLabel = (score: number): string => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Fair Match';
    return 'Low Match';
  };
  
  const getMatchIcon = (score: number) => {
    if (score >= 80) return '🎯';
    if (score >= 60) return '✨';
    if (score >= 40) return '👍';
    return '🔍';
  };

  const toggleSaveJob = async (jobId: string) => {
    if (!user?.id) return;
    
    const isCurrentlySaved = savedJobs.has(jobId);
    
    // Optimistically update UI
    setSavedJobs(prev => {
      const newSet = new Set(prev);
      if (isCurrentlySaved) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
    
    try {
      if (isCurrentlySaved) {
        // Remove from saved
        const { error } = await supabase
          .from('job_interactions')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId)
          .eq('interaction_type', 'liked');
          
        if (error) throw error;
        // Silent success - UI already shows visual feedback
      } else {
        // Add to saved
        const job = jobs.find(j => j.job_id === jobId);
        if (!job) return;
        
        const { error } = await supabase
          .from('job_interactions')
          .insert({
            user_id: user.id,
            job_id: jobId,
            interaction_type: 'liked',
            job_data: {
              employer_name: job.employer_name,
              job_title: job.job_title,
              job_location: job.job_is_remote ? 'Remote' : `${job.job_city}, ${job.job_state}`,
              job_apply_link: job.job_apply_link,
              match_score: job.match_score
            }
          });
          
        if (error) throw error;
        // Silent success - UI already shows visual feedback
      }
    } catch (error) {
      console.error('Error toggling saved job:', error);
      // Revert on error
      setSavedJobs(prev => {
        const newSet = new Set(prev);
        if (isCurrentlySaved) {
          newSet.add(jobId);
        } else {
          newSet.delete(jobId);
        }
        return newSet;
      });
      toast.error('Failed to update saved status');
    }
  };

  const markAsApplied = async (jobId: string) => {
    if (!user?.id) return;
    
    // Optimistically update UI
    setAppliedJobs(prev => {
      const newSet = new Set(prev);
      newSet.add(jobId);
      return newSet;
    });
    
    try {
      const job = jobs.find(j => j.job_id === jobId);
      if (!job) return;
      
      // First, save to job_interactions
      const { error: interactionError } = await supabase
        .from('job_interactions')
        .insert({
          user_id: user.id,
          job_id: jobId,
          interaction_type: 'applied',
          job_data: {
            employer_name: job.employer_name,
            job_title: job.job_title,
            job_location: job.job_is_remote ? 'Remote' : `${job.job_city}, ${job.job_state}`,
            job_apply_link: job.job_apply_link,
            match_score: job.match_score
          }
        })
        .select();
        
      if (interactionError) throw interactionError;
      
      // Get or create a campaign for this search
      let campaignId = sessionStorage.getItem('current_campaign_id');
      
      if (!campaignId) {
        // Get user profile
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
          
        const profileId = profiles?.[0]?.id;
        if (!profileId) throw new Error('Profile not found');
        
        // Create a campaign for this session
        const { data: campaign, error: campaignError } = await supabase
          .from('job_campaigns')
          .insert({
            profile_id: profileId,
            job_title: searchQuery || job.job_title,
            location: location || (job.job_is_remote ? 'Remote' : `${job.job_city}, ${job.job_state}`),
            work_type: job.job_is_remote ? 'remote' : 'onsite'
          })
          .select()
          .single();
          
        if (campaignError) throw campaignError;
        campaignId = campaign.id;
        sessionStorage.setItem('current_campaign_id', campaignId || '');
      }
      
      // Save to applications table
      const { error: appError } = await supabase
        .from('applications')
        .insert({
          campaign_id: campaignId,
          company: job.employer_name,
          role: job.job_title,
          applied_at: new Date().toISOString(),
          status: 'applied',
          details: {
            job_id: jobId,
            job_apply_link: job.job_apply_link,
            job_location: job.job_is_remote ? 'Remote' : `${job.job_city}, ${job.job_state}`,
            job_employment_type: job.job_employment_type,
            match_score: job.match_score,
            job_description: job.job_description,
            salary_range: formatSalary(job.job_min_salary, job.job_max_salary)
          }
        });
        
      if (appError) throw appError;
      
      toast.success('Marked as applied and saved to applications');
    } catch (error) {
      console.error('Error marking as applied:', error);
      // Revert on error
      setAppliedJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      toast.error('Failed to mark as applied');
    }
  };

  const handleOptimizeResume = (job: Job) => {
    setSelectedJob(job);
    setShowResumeOptimizeModal(true);
  };

  // Function to load more jobs for infinite scroll
  const loadMoreJobs = useCallback(async () => {
    // Debouncing check - prevent calls within 1 second of each other
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;
    if (timeSinceLastLoad < 1000) {
      console.log('Debounced: Too soon since last load', timeSinceLastLoad);
      return;
    }
    
    // Check if already loading using ref
    if (isLoadingMoreRef.current) {
      console.log('Blocked: Already loading more jobs');
      return;
    }
    
    // Get current session and validate
    const session = sessionUtils.getStoredSession();
    
    console.log('loadMoreJobs called with state:', {
      loadingMore,
      hasMore,
      sessionId,
      sessionValid: !!session,
      totalPages,
      currentPage,
      searchQuery,
      location,
      jobsCount: jobs.length
    });
    
    if (loadingMore) {
      console.log('Blocked: loadingMore is true');
      return;
    }
    if (!hasMore) {
      console.log('Blocked: hasMore is false');
      return;
    }
    if (!session || session.sessionId !== sessionId) {
      console.log('Blocked: no valid session');
      return;
    }
    
    // Validate session hasn't expired
    if (!sessionUtils.isSessionValid(session, searchQuery, location || '', filters)) {
      console.log('Session expired or search params changed');
      toast('Session expired. Please search again.');
      setHasMore(false);
      return;
    }
    
    
    // Touch session to update last accessed time
    sessionUtils.touchSession();
    
    console.log('All checks passed, making API call...');

    // Set loading state in both ref and state
    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    
    try {
      if (!resumeText) {
        toast('Resume required for loading more jobs');
        setLoadingMore(false);
        return;
      }
      
      // Always use AI-powered search for loading more with session
      const request: JobMatchRequest = {
        resumeText: resumeText,
        query: searchQuery,
        location: location || undefined,
        page: nextPage,
        num_pages: 1,
        session_id: sessionId,
        offset: jobs.length, // Number of jobs already displayed
        ...(filters.employment_types.length > 0 && { employment_types: filters.employment_types as ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[] }),
        ...(filters.date_posted && { date_posted: filters.date_posted as 'all' | 'today' | '3days' | 'week' | 'month' }),
        ...(filters.remote_jobs_only && { remote_jobs_only: true }),
        ...(filters.job_requirements.length > 0 && { job_requirements: filters.job_requirements as ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[] })
      };

      const response = await joboticApi.searchJobs(request);
      
      if (response.data?.jobs && response.data.jobs.length > 0) {
        setJobs(prev => [...prev, ...response.data.jobs]);
        setCurrentPage(response.data?.currentPage || nextPage);
        setHasMore(response.data?.hasMore || false);
        setTotalPages(response.data?.totalPages || totalPages);
        
        // Update session with new job count
        sessionUtils.updateSession({
          jobsLoaded: jobs.length + response.data.jobs.length
        });
        
        // Update usage stats from API response
        if (response.usage) {
          setUsageStats({
            jobsViewed: response.usage.monthly_used,
            jobLimit: typeof response.usage.monthly_limit === 'number' ? response.usage.monthly_limit : -1
          });
        }
        
        // Track job search usage for pagination
        if (user?.id) {
          await trackJobSearchUsage(user.id, response.data.jobs.length, {
              search_type: 'load_more',
              query: searchQuery,
              location: location || 'Not specified'
            });
          }
        } else {
          setHasMore(false);
        }
    } catch (error) {
      console.error('Error loading more jobs:', error);
      toast.error('Failed to load more jobs. Please try again.');
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [loadingMore, hasMore, sessionId, currentPage, totalPages, searchQuery, location, filters, resumeText, jobs.length, user?.id]);

  return (
    <>
      {/* Loading Transition */}
      {showLoadingTransition && (
        <LoadingTransition 
          onComplete={() => setShowLoadingTransition(false)}
          minDuration={4000}
        />
      )}
      
      <div className="min-h-screen -m-8">
        {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <span>Dashboard</span>
                <ChevronRight className="h-4 w-4 mx-2" />
                <span className="text-gray-900 font-medium">Jobs</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">JOBS</h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-8 border-b border-gray-100 -mb-px">
            <button
              onClick={() => setActiveTab('recommended')}
              className={`pb-4 px-1 text-sm font-medium transition-all relative ${
                activeTab === 'recommended'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Recommended
              {activeTab === 'recommended' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`pb-4 px-1 text-sm font-medium transition-all relative ${
                activeTab === 'liked'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Liked
              {savedJobs.size > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-600 rounded-full text-xs">
                  {savedJobs.size}
                </span>
              )}
              {activeTab === 'liked' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('applied')}
              className={`pb-4 px-1 text-sm font-medium transition-all relative ${
                activeTab === 'applied'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Applied
              {appliedJobs.size > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-600 rounded-full text-xs">
                  {appliedJobs.size}
                </span>
              )}
              {activeTab === 'applied' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filters Section */}
      <div className="bg-gray-50 border-b border-gray-100 px-8 py-4">
        <div className="flex items-center gap-3">
          {/* Quick Filter Pills */}
          <button 
            onClick={() => {
              setFilters(prev => ({ ...prev, remote_jobs_only: !prev.remote_jobs_only }));
              // Trigger search after filter change
              setTimeout(() => searchJobs(), 100);
            }}
            className={`px-4 py-2 border ${filters.remote_jobs_only ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'} rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2`}
          >
            <MapPin className="h-4 w-4" />
            Remote Only
          </button>
          
          <button 
            onClick={() => {
              const newTypes = filters.employment_types.includes('FULLTIME') 
                ? filters.employment_types.filter(t => t !== 'FULLTIME')
                : [...filters.employment_types, 'FULLTIME'];
              setFilters(prev => ({ ...prev, employment_types: newTypes }));
              setTimeout(() => searchJobs(), 100);
            }}
            className={`px-4 py-2 border ${filters.employment_types.includes('FULLTIME') ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'} rounded-full text-sm font-medium transition-all duration-200`}
          >
            Full-time
          </button>
          
          <button 
            onClick={() => {
              const newTypes = filters.employment_types.includes('PARTTIME') 
                ? filters.employment_types.filter(t => t !== 'PARTTIME')
                : [...filters.employment_types, 'PARTTIME'];
              setFilters(prev => ({ ...prev, employment_types: newTypes }));
              setTimeout(() => searchJobs(), 100);
            }}
            className={`px-4 py-2 border ${filters.employment_types.includes('PARTTIME') ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'} rounded-full text-sm font-medium transition-all duration-200`}
          >
            Part-time
          </button>
          
          <button 
            onClick={() => {
              const newTypes = filters.employment_types.includes('INTERN') 
                ? filters.employment_types.filter(t => t !== 'INTERN')
                : [...filters.employment_types, 'INTERN'];
              setFilters(prev => ({ ...prev, employment_types: newTypes }));
              setTimeout(() => searchJobs(), 100);
            }}
            className={`px-4 py-2 border ${filters.employment_types.includes('INTERN') ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'} rounded-full text-sm font-medium transition-all duration-200`}
          >
            Internship
          </button>
          
          <button 
            onClick={() => {
              const hasEntryLevel = filters.job_requirements.includes('no_exp') || filters.job_requirements.includes('under_3_years_exp');
              const newReqs = hasEntryLevel ? [] : ['no_exp'];
              setFilters(prev => ({ ...prev, job_requirements: newReqs }));
              setTimeout(() => searchJobs(), 100);
            }}
            className={`px-4 py-2 border ${(filters.job_requirements.includes('no_exp') || filters.job_requirements.includes('under_3_years_exp')) ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'} rounded-full text-sm font-medium transition-all duration-200`}
          >
            Entry Level
          </button>
          
          <div className="ml-auto flex items-center gap-3">
            {/* Filters Button */}
            <button 
              onClick={() => {
                // Populate modal with current values
                setModalFilters({
                  searchQuery,
                  location,
                  employment_types: filters.employment_types,
                  date_posted: filters.date_posted,
                  job_requirements: filters.job_requirements,
                  remote_jobs_only: filters.remote_jobs_only
                });
                setShowFilterModal(true);
              }}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:border-gray-300 transition-colors flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {(filters.employment_types.length > 0 || filters.remote_jobs_only || filters.date_posted || filters.job_requirements.length > 0 || location || searchQuery) && (
                <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs">
                  {[
                    filters.employment_types.length,
                    filters.remote_jobs_only ? 1 : 0,
                    filters.date_posted ? 1 : 0,
                    filters.job_requirements.length,
                    location ? 1 : 0,
                    searchQuery ? 1 : 0
                  ].reduce((a, b) => a + b, 0)}
                </span>
              )}
            </button>
            
            {/* Usage Stats */}
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
              <span className="text-xs text-gray-600">Usage:</span>
              <span className={`text-xs font-medium ${usageStats.jobsViewed >= usageStats.jobLimit ? 'text-red-600' : 'text-gray-900'}`}>
                {usageStats.jobsViewed}/{usageStats.jobLimit === -1 ? '∞' : usageStats.jobLimit}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Results Count and Usage */}
        {jobs.length > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{jobs.length}</span> AI-matched opportunities
              </p>
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
                <span className="text-xs text-gray-600">Usage:</span>
                <span className={`text-xs font-medium ${usageStats.jobsViewed >= usageStats.jobLimit ? 'text-red-600' : 'text-gray-900'}`}>
                  {usageStats.jobsViewed}/{usageStats.jobLimit === -1 ? '∞' : usageStats.jobLimit} jobs this month
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingUp className="h-4 w-4" />
              <span>Sorted by match score</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {(loading || initializing) && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-teal-600 mb-4" />
            <p className="text-gray-600 font-medium">
              {initializing ? 'Loading your profile and preferences...' : 'Searching for jobs...'}
            </p>
          </div>
        )}

        {/* Progress Bar for Streaming */}
        {isStreaming && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {progressMessage || 'Loading jobs...'}
              </span>
              <span className="text-sm text-gray-500">
                {processedCount} of {totalJobsFound} jobs
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${streamProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Jobs Grid */}
        {(displayedJobs.length > 0 || isStreaming) && (
          <div className="grid gap-4">
            {displayedJobs.map((job, index) => (
              <motion.div
                key={job.job_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl border border-gray-100 hover:border-teal-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 overflow-hidden group cursor-pointer relative"
              >
                {/* Hover overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-50/0 to-teal-50/0 group-hover:from-teal-50/5 group-hover:to-teal-100/5 transition-all duration-300 pointer-events-none" />
                
                <div className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      {/* Company Logo */}
                      <div className="relative">
                        {job.employer_logo ? (
                          <img 
                            src={job.employer_logo} 
                            alt={job.employer_name}
                            className="w-14 h-14 rounded-xl object-contain bg-gray-50 p-2 border border-gray-100"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center border border-teal-100">
                            <Building2 className="h-6 w-6 text-teal-600" />
                          </div>
                        )}
                      </div>
                      
                      {/* Job Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                            {job.job_title}
                          </h3>
                          <button
                            onClick={() => toggleSaveJob(job.job_id)}
                            className="ml-4 p-2 text-gray-400 hover:text-teal-600 hover:scale-110 transition-all duration-200"
                          >
                            {savedJobs.has(job.job_id) ? (
                              <Heart className="h-5 w-5 fill-current text-teal-600" />
                            ) : (
                              <Heart className="h-5 w-5 hover:fill-current" />
                            )}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-3">
                          <p className="text-gray-700 font-medium">{job.employer_name}</p>
                          <span className="text-gray-300">•</span>
                          <span className="text-sm text-gray-500">
                            {formatDate(job.job_posted_at_datetime_utc)}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {job.job_is_remote ? 'Remote' : `${job.job_city}, ${job.job_state}`}
                          </span>
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <Briefcase className="h-4 w-4 text-gray-400" />
                            {job.job_employment_type}
                          </span>
                          {formatSalary(job.job_min_salary, job.job_max_salary) && (
                            <span className="flex items-center gap-1.5 font-medium text-gray-700">
                              <DollarSign className="h-4 w-4 text-gray-400" />
                              {formatSalary(job.job_min_salary, job.job_max_salary)}
                            </span>
                          )}
                          {job.job_apply_quality_score && !isNaN(job.job_apply_quality_score) && job.job_apply_quality_score > 7 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                              <Star className="h-3 w-3 fill-current" />
                              Featured
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Match Score */}
                    {job.match_score !== undefined && job.match_score !== null && (
                      <div className="text-right">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${getMatchScoreColor(job.match_score || 0)}`}>
                          <span className="text-lg">{getMatchIcon(job.match_score)}</span>
                          <div className="relative">
                            <svg className="w-8 h-8 transform -rotate-90">
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                opacity="0.2"
                              />
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 14}`}
                                strokeDashoffset={`${2 * Math.PI * 14 * (1 - (job.match_score || 0) / 100)}`}
                                className="transition-all duration-500"
                              />
                            </svg>
                          </div>
                          <span>{Math.round(job.match_score || 0)}%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{job.match_label || getMatchLabel(job.match_score || 0)}</p>
                      </div>
                    )}
                  </div>

                  {/* Job Description */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                    {job.job_description}
                  </p>

                  {/* Skills & Stats Row */}
                  <div className="flex items-center justify-between mb-4">
                    {/* Skills */}
                    {job.job_required_skills && job.job_required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {job.job_required_skills.slice(0, 4).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium border border-gray-100 group-hover:bg-teal-50 group-hover:border-teal-200 group-hover:text-teal-700 transition-all duration-200">
                            {skill}
                          </span>
                        ))}
                        {job.job_required_skills.length > 4 && (
                          <span className="px-3 py-1 text-gray-500 text-xs font-medium">
                            +{job.job_required_skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Applicant Count */}
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="h-4 w-4" />
                      <span>{Math.floor(Math.random() * 50) + 10} applicants</span>
                    </div>
                  </div>

                  {/* Match Insights */}
                  {job.match_reasons && job.match_reasons.length > 0 && !job.match_reasons[0].toLowerCase().includes('unable to') && (
                    <div className="mb-4 p-3 bg-teal-50 rounded-lg border border-teal-100">
                      <p className="text-xs font-medium text-teal-700 mb-1">Why you're a match:</p>
                      <p className="text-xs text-teal-600 line-clamp-2">{job.match_reasons[0]}</p>
                    </div>
                  )}
                  
                  {/* Key Strengths */}
                  {job.key_strengths && job.key_strengths.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1">
                      {job.key_strengths.slice(0, 3).map((strength, idx) => (
                        <span key={idx} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                          ✓ {strength}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Missing Skills */}
                  {job.missing_skills && job.missing_skills.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1">
                      {job.missing_skills.slice(0, 2).map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full border border-orange-200">
                          ⚡ {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOptimizeResume(job)}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm font-medium flex items-center gap-2"
                      >
                        Optimize Resume
                      </button>
                      <button
                        onClick={() => markAsApplied(job.job_id)}
                        disabled={appliedJobs.has(job.job_id)}
                        className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {appliedJobs.has(job.job_id) ? 'Applied' : 'Mark Applied'}
                      </button>
                    </div>
                    <a
                      href={job.job_apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors group"
                    >
                      {job.job_apply_is_direct ? 'Apply on Company Site' : 'View on Job Board'}
                      <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Skeleton Loaders while streaming */}
            {isStreaming && (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <JobSkeleton key={`skeleton-${index}`} />
                ))}
              </>
            )}
          </div>
        )}
          

        {/* Load More Section */}
        {!loading && !initializing && jobs.length > 0 && activeTab === 'recommended' && (
          <div className="mt-8">
            {/* Job count indicator */}
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{jobs.length}</span>
                {totalJobsFound > 0 && (
                  <> of <span className="font-semibold text-gray-900">{totalJobsFound}</span></>
                )}
                {' '}jobs
              </p>
            </div>
            
            {/* Load More Button */}
            {hasMore && (
              <div className="text-center">
                <button
                  onClick={loadMoreJobs}
                  disabled={loadingMore}
                  className="px-8 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto shadow-sm hover:shadow-md"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more jobs...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More Jobs</span>
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
                
                {/* Progress indicator */}
                {currentPage > 0 && totalPages > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Page {currentPage} of {totalPages}
                  </p>
                )}
              </div>
            )}
            
            {/* End message */}
            {!hasMore && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-gray-500 mb-2">
                  <div className="h-px bg-gray-300 w-12" />
                  <p className="font-medium">You've reached the end</p>
                  <div className="h-px bg-gray-300 w-12" />
                </div>
                <p className="text-sm text-gray-400">
                  All {jobs.length} jobs loaded
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !initializing && jobs.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs to display</h3>
            <p className="text-gray-600 mb-6">Start searching to find AI-matched job opportunities</p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Search className="h-4 w-4" />
              <span>Use the search bar above to find jobs</span>
            </div>
          </div>
        )}

        {/* Empty State for Filtered Tabs */}
        {!loading && activeTab === 'liked' && savedJobs.size === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved jobs yet</h3>
            <p className="text-gray-600">Jobs you save will appear here</p>
          </div>
        )}

        {!loading && activeTab === 'applied' && appliedJobs.size === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bookmark className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No applications yet</h3>
            <p className="text-gray-600">Jobs you've applied to will appear here</p>
          </div>
        )}
      </div>

      {/* Resume Optimizer Modal */}
      {showResumeOptimizeModal && selectedJob && (
        <ResumeAnalyzerV2
          isOpen={true}
          onClose={() => setShowResumeOptimizeModal(false)}
          job={selectedJob}
          resumeText={resumeText}
        />
      )}
    </div>
    
    {/* Filters Modal */}
    {showFilterModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => setShowFilterModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 z-50">
          <h2 className="text-lg font-semibold mb-4">Search Filters</h2>
        
        <div className="space-y-4 py-4">
          {/* Job Title Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Job Title</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={modalFilters.searchQuery}
                onChange={(e) => setModalFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                placeholder="Search job title, company, or keywords..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={modalFilters.location}
                onChange={(e) => setModalFilters(prev => ({ ...prev, location: e.target.value }))}
                placeholder="San Francisco, CA"
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Employment Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Employment Type</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalFilters.employment_types.includes('FULLTIME')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setModalFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'FULLTIME'] }));
                    } else {
                      setModalFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'FULLTIME') }));
                    }
                  }}
                  className="text-teal-600"
                />
                <span className="text-sm">Full-time</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalFilters.employment_types.includes('PARTTIME')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setModalFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'PARTTIME'] }));
                    } else {
                      setModalFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'PARTTIME') }));
                    }
                  }}
                  className="text-teal-600"
                />
                <span className="text-sm">Part-time</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalFilters.employment_types.includes('CONTRACTOR')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setModalFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'CONTRACTOR'] }));
                    } else {
                      setModalFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'CONTRACTOR') }));
                    }
                  }}
                  className="text-teal-600"
                />
                <span className="text-sm">Contract</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalFilters.employment_types.includes('INTERN')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setModalFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'INTERN'] }));
                    } else {
                      setModalFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'INTERN') }));
                    }
                  }}
                  className="text-teal-600"
                />
                <span className="text-sm">Internship</span>
              </label>
            </div>
          </div>
          
          {/* Date Posted */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Date Posted</label>
            <select
              value={modalFilters.date_posted || ""}
              onChange={(e) => setModalFilters(prev => ({ ...prev, date_posted: e.target.value }))}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">All time</option>
              <option value="today">Today</option>
              <option value="3days">Last 3 days</option>
              <option value="week">Last week</option>
              <option value="month">Last month</option>
            </select>
          </div>
          
          {/* Experience Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Experience Level</label>
            <select
              value={modalFilters.job_requirements.join(',') || ""}
              onChange={(e) => {
                const value = e.target.value;
                setModalFilters(prev => ({ ...prev, job_requirements: value ? [value] : [] }));
              }}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Any experience</option>
              <option value="no_exp">No Experience Required</option>
              <option value="under_3_years_exp">Under 3 Years Experience</option>
              <option value="more_than_3_years_exp">3+ Years Experience</option>
              <option value="no_degree">No Degree Required</option>
              <option value="fair_chance">Fair Chance (2nd chance)</option>
            </select>
          </div>
          
          {/* Remote Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={modalFilters.remote_jobs_only}
              onChange={(e) => setModalFilters(prev => ({ ...prev, remote_jobs_only: e.target.checked }))}
              className="text-teal-600"
            />
            <span className="text-sm font-medium text-gray-700">Remote jobs only</span>
          </label>
        </div>
        
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              // Reset to current values
              setModalFilters({
                searchQuery,
                location,
                employment_types: filters.employment_types,
                date_posted: filters.date_posted,
                job_requirements: filters.job_requirements,
                remote_jobs_only: filters.remote_jobs_only
              });
              setShowFilterModal(false);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Apply filters and search
              setSearchQuery(modalFilters.searchQuery);
              setLocation(modalFilters.location);
              setFilters({
                employment_types: modalFilters.employment_types,
                date_posted: modalFilters.date_posted,
                job_requirements: modalFilters.job_requirements,
                remote_jobs_only: modalFilters.remote_jobs_only
              });
              setShowFilterModal(false);
              // Trigger search after state updates
              setTimeout(() => searchJobs(), 100);
            }}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
          >
            Update
          </button>
        </div>
        </div>
      </div>
    )}
    </>
  );
};

export default JobSearchPage;
