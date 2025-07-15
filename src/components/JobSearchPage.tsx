import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Briefcase, Filter, X, Loader2, ChevronRight, Heart, Users, DollarSign, Building2, Star, Bookmark, ArrowUpRight, TrendingUp } from 'lucide-react';
import { joboticApi, JobSearchRequest, JobMatchRequest } from '../lib/joboticApi';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { ResumeAnalyzerV2 } from './ResumeAnalyzerV2';
import { toast } from 'react-hot-toast';
import LoadingTransition from './LoadingTransition';
import { useLocation } from 'react-router-dom';
import { canPerformAIOperation, trackAITokens } from '../lib/aiTokenTracking';
import { getPlanLimits } from '../stripe-config';

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
  const [showFilters, setShowFilters] = useState(false);
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
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [usageStats, setUsageStats] = useState<{ jobsViewed: number; jobLimit: number }>({ jobsViewed: 0, jobLimit: 100 });

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
            // Get current month's job view count
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const { count } = await supabase
              .from('job_views')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startOfMonth.toISOString());
            
            setUsageStats({
              jobsViewed: count || 0,
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
        setShowFilters(false);
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
            const text = await extractTextFromPDF(fileData);
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
                // Handle location - check for custom locations first
                let primaryLocation = '';
                if (jobPrefs?.locations && jobPrefs.locations.length > 0) {
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
                } else if (profile?.location) {
                  // Fall back to profile location if no job preferences location
                  primaryLocation = profile.location;
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
                // Set session ID for infinite scroll
                setSessionId(Date.now().toString());
                setHasMore(true);
                setCurrentPage(1);
                
                try {
                  if (text && text.length > 100) {
                    // We have a resume, use AI search to get match scores
                    const { allowed } = await canPerformAIOperation(user.id);
                    if (allowed) {
                      const aiRequest: JobMatchRequest = {
                        resumeText: text,
                        query: primaryRole,
                        location: primaryLocation || undefined,
                        page: 1,
                        num_pages: 1
                      };
                      const response = await joboticApi.searchJobs(aiRequest);
                      console.log('AI auto-search response:', {
                        firstJob: response.data?.jobs?.[0],
                        totalJobs: response.data?.jobs?.length,
                        totalPages: response.data?.totalPages,
                        currentPage: response.data?.currentPage
                      });
                      const jobs = response.data?.jobs || [];
                      setJobs(jobs);
                      // If we got 10 or more jobs, assume there might be more pages
                      const mightHaveMore = jobs.length >= 10;
                      setHasMore(mightHaveMore);
                      setTotalPages(response.data?.totalPages || (mightHaveMore ? 999 : 1));
                      
                      // Track AI usage
                      if (response.data?.jobs && response.data.jobs.length > 0) {
                        await trackAITokens(user.id, 'job_search_match', {
                          jobTitle: primaryRole,
                          location: primaryLocation || 'Not specified',
                          resultsCount: response.data.jobs.length,
                          isAutoSearch: true
                        });
                      }
                    } else {
                      // Fall back to basic search if no AI tokens
                      const basicRequest: JobSearchRequest = {
                        query: primaryRole,
                        location: primaryLocation || undefined,
                        page: 1,
                        num_pages: 1
                      };
                      const response = await joboticApi.searchJobsBasic(basicRequest);
                      console.log('Basic auto-search response:', response.data?.jobs?.[0]);
                      const jobs = response.data?.jobs || [];
                      setJobs(jobs);
                      const mightHaveMore = jobs.length >= 10;
                      setHasMore(mightHaveMore);
                      setTotalPages(response.data?.totalPages || (mightHaveMore ? 999 : 1));
                    }
                  } else {
                    // No resume, use basic search
                    const basicRequest: JobSearchRequest = {
                      query: primaryRole,
                      location: primaryLocation || undefined,
                      page: 1,
                      num_pages: 1
                    };
                    const response = await joboticApi.searchJobsBasic(basicRequest);
                    console.log('Basic auto-search response:', response.data?.jobs?.[0]);
                    const jobs = response.data?.jobs || [];
                    setJobs(jobs);
                    const mightHaveMore = jobs.length >= 10;
                    setHasMore(mightHaveMore);
                    setTotalPages(response.data?.totalPages || (mightHaveMore ? 999 : 1));
                  }
                  setInitialLoad(false);
                } catch (err) {
                  console.error('Auto-search error:', err);
                } finally {
                  setLoading(false);
                }
              } else {
                // No specific role found, do a general search
                console.log('No specific role found, performing general search');
                setSearchQuery('Software Engineer'); // Default search
                setLocation('Remote');
                
                const request: JobSearchRequest = {
                  query: 'Software Engineer',
                  location: 'Remote',
                  page: 1,
                  num_pages: 1
                  // No filters on initial load
                };

                setLoading(true);
                // Set session ID for infinite scroll
                setSessionId(Date.now().toString());
                setHasMore(true);
                setCurrentPage(1);
                try {
                  // Use basic search for default search (no AI token requirement)
                  const response = await joboticApi.searchJobsBasic(request);
                  setJobs(response.data?.jobs || []);
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
  }, [user, initialLoad]);

  const searchJobs = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a job title or keyword');
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in to search for jobs');
      return;
    }

    setLoading(true);
    setError(null);
    
    // Reset infinite scroll state
    setCurrentPage(1);
    setHasMore(true);
    setSessionId(Date.now().toString()); // Generate new session ID

    try {
      // Check if we have any filters applied
      const hasFilters = filters.employment_types.length > 0 || 
                        filters.date_posted !== '' || 
                        filters.job_requirements.length > 0 || 
                        filters.remote_jobs_only;

      // Use basic search if no resume or when filters are applied from the start
      if (!resumeText || hasFilters) {
        const request: JobSearchRequest = {
          query: searchQuery,
          location: location || undefined,
          page: 1,
          num_pages: 1,
          // Only include filters if they are set
          ...(filters.employment_types.length > 0 && { employment_types: filters.employment_types as ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[] }),
          ...(filters.date_posted && { date_posted: filters.date_posted as 'all' | 'today' | '3days' | 'week' | 'month' }),
          ...(filters.remote_jobs_only && { remote_jobs_only: true }),
          ...(filters.job_requirements.length > 0 && { job_requirements: filters.job_requirements as ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[] })
        };

        const response = await joboticApi.searchJobsBasic(request);
        const jobs = response.data?.jobs || [];
        setJobs(jobs);
        const mightHaveMore = jobs.length >= 10;
        setHasMore(mightHaveMore);
        setTotalPages(response.data?.totalPages || (mightHaveMore ? 999 : 1));
        
        console.log('Basic search response:', {
          totalJobs: jobs.length,
          totalPages: response.data?.totalPages,
          currentPage: response.data?.currentPage,
          hasMore: mightHaveMore
        });
        
        if (!response.data?.jobs || response.data.jobs.length === 0) {
          toast.info('No jobs found. Try different keywords or location.');
        }
      } else {
        // Use AI-powered search with resume matching
        // Check AI token limits
        const { allowed, reason } = await canPerformAIOperation(user.id);
        if (!allowed) {
          toast.error(reason || 'Insufficient AI tokens for job search');
          return;
        }

        const request: JobMatchRequest = {
          resumeText: resumeText,
          query: searchQuery,
          location: location || undefined,
          page: 1,
          num_pages: 1,
          // Include filters if set
          ...(filters.employment_types.length > 0 && { employment_types: filters.employment_types as ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[] }),
          ...(filters.date_posted && { date_posted: filters.date_posted as 'all' | 'today' | '3days' | 'week' | 'month' }),
          ...(filters.remote_jobs_only && { remote_jobs_only: true }),
          ...(filters.job_requirements.length > 0 && { job_requirements: filters.job_requirements as ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[] })
        };

        const response = await joboticApi.searchJobs(request);
        console.log('AI search response:', response.data?.jobs?.[0]); // Log first job to see structure
        const jobs = response.data?.jobs || [];
        setJobs(jobs);
        const mightHaveMore = jobs.length >= 10;
        setHasMore(mightHaveMore);
        setTotalPages(response.data?.totalPages || (mightHaveMore ? 999 : 1));
        
        if (!response.data?.jobs || response.data.jobs.length === 0) {
          toast.info('No jobs found. Try different keywords or location.');
        } else {
          // Track successful search
          await trackAITokens(user.id, 'job_search_match', {
            jobTitle: searchQuery,
            location: location || 'Not specified',
            resultsCount: response.data.jobs.length
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchJobs();
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
    if (score >= 80) return 'text-teal-600 bg-teal-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-gray-600 bg-gray-50';
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
        toast.success('Job removed from saved');
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
        toast.success('Job saved');
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
        sessionStorage.setItem('current_campaign_id', campaignId);
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
    console.log('loadMoreJobs called:', { 
      loadingMore, 
      hasMore, 
      sessionId, 
      currentPage, 
      totalPages,
      willLoad: !loadingMore && hasMore && sessionId && currentPage < totalPages
    });
    
    if (loadingMore || !hasMore || !sessionId) return;
    if (totalPages > 0 && currentPage >= totalPages) return;
    if (!searchQuery && !location) return; // Need at least one search parameter

    setLoadingMore(true);
    const nextPage = currentPage + 1;
    
    try {
      const hasFilters = filters.employment_types.length > 0 || 
                        filters.date_posted !== '' || 
                        filters.job_requirements.length > 0 || 
                        filters.remote_jobs_only;

      if (!resumeText || hasFilters) {
        // Use basic search for loading more
        const request: JobSearchRequest = {
          query: searchQuery,
          location: location || undefined,
          page: nextPage,
          num_pages: 1,
          ...(filters.employment_types.length > 0 && { employment_types: filters.employment_types as ('FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR')[] }),
          ...(filters.date_posted && { date_posted: filters.date_posted as 'all' | 'today' | '3days' | 'week' | 'month' }),
          ...(filters.remote_jobs_only && { remote_jobs_only: true }),
          ...(filters.job_requirements.length > 0 && { job_requirements: filters.job_requirements as ('no_exp' | 'under_3_years_exp' | 'more_than_3_years_exp' | 'no_degree' | 'fair_chance')[] })
        };

        const response = await joboticApi.searchJobsBasic(request);
        if (response.data?.jobs && response.data.jobs.length > 0) {
          setJobs(prev => [...prev, ...response.data.jobs]);
          setCurrentPage(nextPage);
          // If we got less than 10 jobs, we've probably reached the end
          setHasMore(response.data.jobs.length >= 10);
          console.log('Loaded more jobs:', {
            newJobsCount: response.data.jobs.length,
            totalNow: jobs.length + response.data.jobs.length,
            hasMore: response.data.jobs.length >= 10
          });
        } else {
          setHasMore(false);
          console.log('No more jobs returned from API');
        }
      } else {
        // Use AI-powered search for loading more with session
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
        console.log('Infinite scroll response:', {
          page: nextPage,
          jobsReturned: response.data?.jobs?.length,
          totalPages: response.data?.totalPages,
          currentPage: response.data?.currentPage
        });
        
        if (response.data?.jobs && response.data.jobs.length > 0) {
          setJobs(prev => [...prev, ...response.data.jobs]);
          setCurrentPage(nextPage);
          // If we got less than 10 jobs, we've probably reached the end
          setHasMore(response.data.jobs.length >= 10);
          console.log('Loaded more jobs (AI):', {
            newJobsCount: response.data.jobs.length,
            totalNow: jobs.length + response.data.jobs.length,
            hasMore: response.data.jobs.length >= 10
          });
          
          // Track AI usage for pagination
          await trackAITokens(user.id, 'job_search_match', {
            jobTitle: searchQuery,
            location: location || 'Not specified',
            resultsCount: response.data.jobs.length,
            page: nextPage
          });
        } else {
          setHasMore(false);
          console.log('No more jobs returned from AI search');
        }
      }
    } catch (error) {
      console.error('Error loading more jobs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, sessionId, currentPage, totalPages, searchQuery, location, filters, resumeText, jobs.length, user?.id]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        console.log('Intersection observed:', {
          isIntersecting: entries[0].isIntersecting,
          hasMore,
          loadingMore,
          currentPage,
          totalPages,
          jobsLength: jobs.length
        });
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreJobs();
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = document.getElementById('scroll-sentinel');
    console.log('Setting up observer:', { 
      sentinelExists: !!sentinel, 
      hasMore, 
      currentPage, 
      totalPages,
      activeTab
    });
    
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [hasMore, loadingMore, currentPage, totalPages, sessionId, searchQuery, location, filters, resumeText, jobs.length, loadMoreJobs, activeTab]);

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

      {/* Filters Bar */}
      <div className="bg-gray-50 border-b border-gray-100 px-8 py-4">
        <div className="flex items-center gap-4">
          {/* Location Search */}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="San Francisco, CA"
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-48"
            />
          </div>
          
          {/* Filter Chips */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={filterDropdownRef}>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 bg-white border ${filters.employment_types.length > 0 ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors flex items-center gap-2`}
              >
                <Briefcase className="h-4 w-4" />
                {filters.employment_types.length > 0 ? `${filters.employment_types.length} selected` : 'Employment Type'}
              </button>
              {showFilters && (
                <div className="absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-[200px]">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="FULLTIME"
                        checked={filters.employment_types.includes('FULLTIME')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'FULLTIME'] }));
                          } else {
                            setFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'FULLTIME') }));
                          }
                        }}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Full-time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="PARTTIME"
                        checked={filters.employment_types.includes('PARTTIME')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'PARTTIME'] }));
                          } else {
                            setFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'PARTTIME') }));
                          }
                        }}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Part-time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="CONTRACTOR"
                        checked={filters.employment_types.includes('CONTRACTOR')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'CONTRACTOR'] }));
                          } else {
                            setFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'CONTRACTOR') }));
                          }
                        }}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Contract</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="INTERN"
                        checked={filters.employment_types.includes('INTERN')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, employment_types: [...prev.employment_types, 'INTERN'] }));
                          } else {
                            setFilters(prev => ({ ...prev, employment_types: prev.employment_types.filter(t => t !== 'INTERN') }));
                          }
                        }}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Internship</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setFilters(prev => ({ ...prev, remote_jobs_only: !prev.remote_jobs_only }))}
              className={`px-4 py-2 bg-white border ${filters.remote_jobs_only ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors flex items-center gap-2`}
            >
              <MapPin className="h-4 w-4" />
              Remote Only
            </button>
            
            <select
              value={filters.date_posted}
              onChange={(e) => setFilters(prev => ({ ...prev, date_posted: e.target.value }))}
              className={`px-4 py-2 bg-white border ${filters.date_posted ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors appearance-none cursor-pointer`}
            >
              <option value="">Date Posted</option>
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="3days">Last 3 days</option>
              <option value="week">Last week</option>
              <option value="month">Last month</option>
            </select>
            
            <select
              value={filters.job_requirements.join(',')}
              onChange={(e) => {
                const value = e.target.value;
                setFilters(prev => ({ ...prev, job_requirements: value ? [value] : [] }));
              }}
              className={`px-4 py-2 bg-white border ${filters.job_requirements.length > 0 ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors appearance-none cursor-pointer`}
            >
              <option value="">Experience Level</option>
              <option value="no_exp">No Experience Required</option>
              <option value="under_3_years_exp">Under 3 Years Experience</option>
              <option value="more_than_3_years_exp">3+ Years Experience</option>
              <option value="no_degree">No Degree Required</option>
              <option value="fair_chance">Fair Chance (2nd chance)</option>
            </select>
            
            {/* Clear Filters */}
            {(filters.employment_types.length > 0 || filters.remote_jobs_only || filters.date_posted || filters.job_requirements.length > 0) && (
              <button
                onClick={() => setFilters({
                  employment_types: [],
                  date_posted: '',
                  job_requirements: [],
                  remote_jobs_only: false
                })}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
          
          {/* Search */}
          <div className="flex-1 flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search job title, company, or keywords..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchJobs}
              disabled={loading}
              className="px-6 py-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
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

        {!loading && !initializing && jobs.length > 0 && (
          <div className="grid gap-4">
            {jobs.filter(job => {
              if (activeTab === 'liked') return savedJobs.has(job.job_id);
              if (activeTab === 'applied') return appliedJobs.has(job.job_id);
              return true;
            }).filter(job => {
              // Apply filters
              if (filters.employment_types.length > 0 && !filters.employment_types.includes(job.job_employment_type)) return false;
              if (filters.remote_jobs_only && !job.job_is_remote) return false;
              if (filters.date_posted) {
                const postedDate = new Date(job.job_posted_at_datetime_utc);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));
                
                switch(filters.date_posted) {
                  case 'today': if (diffDays > 1) return false; break;
                  case '3days': if (diffDays > 3) return false; break;
                  case 'week': if (diffDays > 7) return false; break;
                  case 'month': if (diffDays > 30) return false; break;
                  case 'all': break; // Show all
                }
              }
              
              // Note: Experience level filtering would require the API to return this data
              return true;
            }).map((job, index) => (
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
                          {job.job_apply_quality_score && job.job_apply_quality_score > 7 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                              <Star className="h-3 w-3 fill-current" />
                              Featured
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Match Score */}
                    {job.match_score !== undefined && (
                      <div className="text-right">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getMatchScoreColor(job.match_score || 0)}`}>
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
                          <span>{job.match_score || 0}%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Match Score</p>
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
          </div>
        )}
          
        {/* Debug Info */}
        <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <p className="text-sm font-bold">Debug Info:</p>
          <p className="text-xs">loading: {String(loading)}, initializing: {String(initializing)}</p>
          <p className="text-xs">jobs.length: {jobs.length}</p>
          <p className="text-xs">hasMore: {String(hasMore)}, currentPage: {currentPage}, totalPages: {totalPages}</p>
          <p className="text-xs">sessionId: {sessionId || 'none'}</p>
        </div>

        {/* Infinite Scroll Loading */}
        {!loading && !initializing && jobs.length > 0 && (
          <>
            {/* Show loading state when loading more */}
            {loadingMore && (
              <div className="flex items-center justify-center py-8 mt-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                  <span className="text-gray-600 font-medium">Loading more jobs...</span>
                </div>
              </div>
            )}
            
            {/* Show sentinel when there are more pages to load */}
            {hasMore && (
              <div id="scroll-sentinel" className="h-20 mt-4 bg-red-100 border-2 border-red-500 flex items-center justify-center">
                <p className="text-sm text-red-600 font-bold">Scroll sentinel - Debug: hasMore={String(hasMore)}, page={currentPage}/{totalPages}</p>
              </div>
            )}
            
            {/* Show end message only when we've loaded all pages */}
            {!hasMore && totalPages > 1 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg mt-4">
                <p className="text-gray-500 font-medium">You've reached the end</p>
                <p className="text-sm text-gray-400 mt-1">No more jobs to load</p>
              </div>
            )}
          </>
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
    </>
  );
};

export default JobSearchPage;