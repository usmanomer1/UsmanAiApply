import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Briefcase, Clock, Filter, X, Loader2, ExternalLink, ChevronRight, Heart, Users, DollarSign, Building2, Star, Bookmark, ArrowUpRight, Calendar, Shield, TrendingUp } from 'lucide-react';
import { joboticApi, JobMatchRequest, JobMatchResponse } from '../lib/joboticApi';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { ResumeAnalyzerV2 } from './ResumeAnalyzerV2';
import { handleApiError } from '../lib/apiErrorHandler';
import toast from 'react-hot-toast';
import LoadingTransition from './LoadingTransition';
import { useLocation } from 'react-router-dom';
import { canPerformAIOperation, trackAITokens } from '../lib/aiTokenTracking';

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
    jobType: '',
    salaryRange: '',
    datePosted: '',
    experienceLevel: '',
    remoteOnly: false
  });
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [showResumeOptimizeModal, setShowResumeOptimizeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommended' | 'liked' | 'applied'>('recommended');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [showLoadingTransition, setShowLoadingTransition] = useState(false);

  // Load saved job interactions
  useEffect(() => {
    const loadJobInteractions = async () => {
      if (!user?.id) return;
      
      try {
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
      } catch (error) {
        console.error('Error loading job interactions:', error);
      }
    };
    
    loadJobInteractions();
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
                    setFilters(prev => ({ ...prev, remoteOnly: true }));
                  }
                }
                
                // Perform auto-search
                const request: JobMatchRequest = {
                  resumeText: text,
                  preferences: {
                    jobTitle: primaryRole,
                    location: primaryLocation || undefined
                  },
                  page: 1
                };

                setLoading(true);
                try {
                  // Check AI token limits for auto-search
                  const { allowed } = await canPerformAIOperation(user.id);
                  if (allowed) {
                    const response = await joboticApi.searchJobs(request);
                    setJobs(response.data?.jobs || []);
                    setInitialLoad(false);
                    
                    // Track auto-search
                    if (response.data?.jobs && response.data.jobs.length > 0) {
                      await trackAITokens(user.id, 'job_search_match', {
                        jobTitle: primaryRole,
                        location: primaryLocation || 'Not specified',
                        resultsCount: response.data.jobs.length,
                        isAutoSearch: true
                      });
                    }
                  } else {
                    console.log('Auto-search skipped due to insufficient AI tokens');
                    setInitialLoad(false);
                  }
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
                
                const request: JobMatchRequest = {
                  resumeText: text,
                  preferences: {
                    jobTitle: 'Software Engineer',
                    location: 'Remote'
                  },
                  page: 1
                };

                setLoading(true);
                try {
                  // Check AI token limits for default search
                  const { allowed } = await canPerformAIOperation(user.id);
                  if (allowed) {
                    const response = await joboticApi.searchJobs(request);
                    setJobs(response.data?.jobs || []);
                    setInitialLoad(false);
                    
                    // Track default search
                    if (response.data?.jobs && response.data.jobs.length > 0) {
                      await trackAITokens(user.id, 'job_search_match', {
                        jobTitle: 'Software Engineer',
                        location: 'Remote',
                        resultsCount: response.data.jobs.length,
                        isAutoSearch: true,
                        isDefaultSearch: true
                      });
                    }
                  } else {
                    console.log('Default search skipped due to insufficient AI tokens');
                    setInitialLoad(false);
                  }
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

    if (!resumeText) {
      toast.error('Please upload a resume in your profile first');
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in to search for jobs');
      return;
    }

    // Check AI token limits
    const { allowed, reason } = await canPerformAIOperation(user.id);
    if (!allowed) {
      toast.error(reason || 'Insufficient AI tokens for job search');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: JobMatchRequest = {
        resumeText: resumeText,
        preferences: {
          jobTitle: searchQuery,
          location: location || undefined
        },
        page: 1
      };

      const response = await joboticApi.searchJobs(request);
      setJobs(response.data?.jobs || []);
      
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
    } catch (err) {
      const errorMessage = handleApiError(err);
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
        .onConflict('user_id,job_id,interaction_type');
        
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
                className={`px-4 py-2 bg-white border ${filters.jobType ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors flex items-center gap-2`}
              >
                <Briefcase className="h-4 w-4" />
                {filters.jobType || 'Job Type'}
              </button>
              {showFilters && (
                <div className="absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 min-w-[200px]">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="jobType"
                        value=""
                        checked={filters.jobType === ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
                        className="text-teal-600"
                      />
                      <span className="text-sm">All Types</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="jobType"
                        value="FULLTIME"
                        checked={filters.jobType === 'FULLTIME'}
                        onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Full-time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="jobType"
                        value="PARTTIME"
                        checked={filters.jobType === 'PARTTIME'}
                        onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Part-time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="jobType"
                        value="CONTRACT"
                        checked={filters.jobType === 'CONTRACT'}
                        onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Contract</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="jobType"
                        value="INTERN"
                        checked={filters.jobType === 'INTERN'}
                        onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
                        className="text-teal-600"
                      />
                      <span className="text-sm">Internship</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setFilters(prev => ({ ...prev, remoteOnly: !prev.remoteOnly }))}
              className={`px-4 py-2 bg-white border ${filters.remoteOnly ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors flex items-center gap-2`}
            >
              <MapPin className="h-4 w-4" />
              Remote Only
            </button>
            
            <select
              value={filters.datePosted}
              onChange={(e) => setFilters(prev => ({ ...prev, datePosted: e.target.value }))}
              className={`px-4 py-2 bg-white border ${filters.datePosted ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors appearance-none cursor-pointer`}
            >
              <option value="">Date Posted</option>
              <option value="24h">Last 24 hours</option>
              <option value="3d">Last 3 days</option>
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            
            <select
              value={filters.experienceLevel}
              onChange={(e) => setFilters(prev => ({ ...prev, experienceLevel: e.target.value }))}
              className={`px-4 py-2 bg-white border ${filters.experienceLevel ? 'border-teal-500 text-teal-600' : 'border-gray-200 text-gray-700'} rounded-full text-sm font-medium hover:border-gray-300 transition-colors appearance-none cursor-pointer`}
            >
              <option value="">Experience Level</option>
              <option value="internship">Internship</option>
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior Level</option>
              <option value="lead">Lead/Principal</option>
              <option value="executive">Executive</option>
            </select>
            
            {/* Clear Filters */}
            {(filters.jobType || filters.remoteOnly || filters.datePosted || filters.experienceLevel) && (
              <button
                onClick={() => setFilters({
                  jobType: '',
                  salaryRange: '',
                  datePosted: '',
                  experienceLevel: '',
                  remoteOnly: false
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
        {/* Results Count */}
        {jobs.length > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium text-gray-900">{jobs.length}</span> AI-matched opportunities
            </p>
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
              if (filters.jobType && job.job_employment_type !== filters.jobType) return false;
              if (filters.remoteOnly && !job.job_is_remote) return false;
              if (filters.datePosted) {
                const postedDate = new Date(job.job_posted_at_datetime_utc);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));
                
                switch(filters.datePosted) {
                  case '24h': if (diffDays > 1) return false; break;
                  case '3d': if (diffDays > 3) return false; break;
                  case '7d': if (diffDays > 7) return false; break;
                  case '14d': if (diffDays > 14) return false; break;
                  case '30d': if (diffDays > 30) return false; break;
                }
              }
              
              // Apply salary filter
              if (filters.salaryRange) {
                const [minStr, maxStr] = filters.salaryRange.split('-');
                const filterMin = parseInt(minStr);
                const filterMax = parseInt(maxStr);
                
                // Check if job has salary data
                if (job.job_min_salary && job.job_max_salary) {
                  // Job salary should overlap with user's desired range
                  if (job.job_max_salary < filterMin || job.job_min_salary > filterMax) {
                    return false;
                  }
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
                className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden group"
              >
                <div className="p-6">
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
                            className="ml-4 p-2 text-gray-400 hover:text-teal-600 transition-colors"
                          >
                            {savedJobs.has(job.job_id) ? (
                              <Heart className="h-5 w-5 fill-current text-teal-600" />
                            ) : (
                              <Heart className="h-5 w-5" />
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
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getMatchScoreColor(job.match_score)}`}>
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
                              strokeDashoffset={`${2 * Math.PI * 14 * (1 - job.match_score / 100)}`}
                              className="transition-all duration-500"
                            />
                          </svg>
                        </div>
                        <span>{job.match_score}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Match Score</p>
                    </div>
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
                          <span key={index} className="px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium border border-gray-100">
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
                  {job.match_reasons && job.match_reasons.length > 0 && (
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
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium flex items-center gap-2"
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