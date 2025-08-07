import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Briefcase, Filter, Loader2, Heart, Users, DollarSign, Building2, Star, Bookmark, ArrowUpRight, TrendingUp, ChevronRight } from 'lucide-react';
import { joboticApi, JobMatchRequest } from '../lib/joboticApi';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { trackJobSearchUsage, updateCachedUsage } from '../lib/jobSearchUsage';
import { getPlanLimits } from '../stripe-config';
import { JobSkeleton } from './JobSkeleton';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

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

const JobSearchPageConvex: React.FC = () => {
  const { user } = useAuth();
  const routeLocation = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [filters, setFilters] = useState({
    employment_types: [] as string[],
    date_posted: '',
    job_requirements: [] as string[],
    remote_jobs_only: false
  });
  
  // Progressive loading states
  const [sessionId, setSessionId] = useState<Id<"jobSearchSessions"> | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalJobsFound, setTotalJobsFound] = useState(0);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'recommended' | 'liked' | 'applied'>('recommended');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [usageStats, setUsageStats] = useState<{ jobsViewed: number; jobLimit: number }>({ jobsViewed: 0, jobLimit: 100 });
  
  // Convex real-time queries
  // Page size for progressive pagination
  const PAGE_SIZE = 10;

  const processedJobsData = useQuery(
    api.jobs.getProcessedJobs,
    sessionId ? { sessionId, offset: currentOffset, limit: PAGE_SIZE } : "skip"
  );
  
  const sessionStatus = useQuery(
    api.jobs.getSessionStatus,
    sessionId ? { sessionId } : "skip"
  );
  
  // Get user's recent sessions
  const userSessions = useQuery(
    api.jobs.getUserSessions,
    user?.id ? { userId: user.id } : "skip"
  );
  
  // Process jobs from Convex query
  const jobs: Job[] = React.useMemo(() => {
    if (!processedJobsData?.jobs) return [];
    
    return processedJobsData.jobs.map((job: any) => ({
      job_id: job.jobId,
      employer_name: job.company,
      employer_logo: job.employerLogo,
      job_title: job.jobTitle,
      job_description: job.description,
      job_apply_link: job.jobUrl,
      job_is_remote: job.location?.toLowerCase().includes('remote') || false,
      job_city: job.location?.split(',')[0] || '',
      job_state: job.location?.split(',')[1]?.trim() || '',
      job_country: '',
      job_posted_at_datetime_utc: job.postedDate || new Date().toISOString(),
      job_employment_type: 'Full-time',
      job_required_skills: [],
      job_min_salary: job.salaryMin,
      job_max_salary: job.salaryMax,
      match_score: job.matchScore || 0,
      match_label: job.matchLabel,
      match_reasons: job.matchReasons,
      missing_skills: job.missingSkills,
      key_strengths: job.keyStrengths,
      job_highlights: {},
      job_apply_quality_score: undefined,
      job_offer_expiration_timestamp: undefined,
      application_deadline_days: undefined,
      job_apply_is_direct: true,
    }));
  }, [processedJobsData]);
  
  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastJobElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && processedJobsData?.hasMore) {
        loadMoreJobs();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, processedJobsData?.hasMore]);

  // Filter jobs based on activeTab
  const displayedJobs = jobs.filter(job => {
    if (activeTab === 'liked') return savedJobs.has(job.job_id);
    if (activeTab === 'applied') return appliedJobs.has(job.job_id);
    return activeTab === 'recommended';
  });

  // Check if we have an active session we can continue
  useEffect(() => {
    if (userSessions && userSessions.length > 0) {
      const recentSession = userSessions[0];
      // If there's a recent session that's still processing or completed recently (within 1 hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (recentSession.updatedAt > oneHourAgo && 
          (recentSession.status === 'processing' || recentSession.status === 'completed')) {
        setSessionId(recentSession._id);
        setSearchQuery(recentSession.query);
        setLocation(recentSession.location || '');
        setTotalJobsFound(recentSession.totalJobs);
      }
    }
  }, [userSessions]);

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

        // Load usage stats
        const { data: subscription } = await supabase
          .from('stripe_user_subscriptions')
          .select('price_id')
          .eq('user_id', user.id)
          .single();

        if (subscription?.price_id) {
          const planLimits = getPlanLimits(subscription.price_id);
          if (planLimits) {
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
        }
      } catch (error) {
        console.error('Error loading job interactions and usage:', error);
      }
    };
    
    loadJobInteractionsAndUsage();
  }, [user]);

  // Fetch user's resume and auto-search
  useEffect(() => {
    const fetchResumeAndAutoSearch = async () => {
      if (!user?.id || sessionId) return; // Don't auto-search if we already have a session

      try {
        // Fetch profile
        const { data: profiles } = await supabase
          .from('profiles')
          .select('resume_url, location, current_job_title')
          .eq('user_id', user.id)
          .limit(1);
          
        const profile = profiles?.[0];
        
        if (!profile?.resume_url) {
          setError('Please upload your resume in your profile to see job recommendations');
          return;
        }

        // Download and extract resume
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('resumes')
          .download(profile.resume_url);

        if (downloadError) {
          console.error('Error downloading resume:', downloadError);
          return;
        }

        if (fileData) {
          const text = await extractTextFromPDF(fileData as File);
          setResumeText(text);
          
          // Auto-search if we have job title and no existing session
          if (initialLoad && profile.current_job_title && !sessionId) {
            setSearchQuery(profile.current_job_title);
            setLocation(profile.location || '');
            performSearch(profile.current_job_title, profile.location || '', text);
          }
        }
      } catch (error) {
        console.error('Error fetching resume:', error);
        setError('Failed to load your profile. Please try again.');
      } finally {
        setInitialLoad(false);
      }
    };
    
    fetchResumeAndAutoSearch();
  }, [user, initialLoad, sessionId]);

  const performSearch = async (query: string, loc: string, resume?: string) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setSessionId(null); // Clear previous session
    setCurrentOffset(0);
    
    try {
      const request: JobMatchRequest = {
        resumeText: resume || resumeText,
        query,
        location: loc || undefined,
        ...(filters.remote_jobs_only && { remote_jobs_only: true }),
        ...(filters.employment_types.length > 0 && { 
          employment_types: filters.employment_types as any 
        }),
        ...(filters.date_posted && { date_posted: filters.date_posted as any })
      };
      
      // Call the backend API which will create a Convex session
      const response = await joboticApi.searchJobsProgressive({
        ...request,
        limit: 10,
        offset: 0
      });
      
      if (response.success && response.sessionId) {
        // Set the session ID to start receiving real-time updates
        setSessionId(response.sessionId as Id<"jobSearchSessions">);
        setTotalJobsFound(response.data?.totalFound || 0);
        
        // Update usage stats
        if (response.usage) {
          setUsageStats({
            jobsViewed: response.usage.monthly_used || 0,
            jobLimit: response.usage.monthly_limit || 100
          });
          
          if (user?.id) {
            updateCachedUsage(user.id, response.usage);
          }
        }
        
        toast.success(`Finding ${response.data?.totalFound || 0} jobs matching your search...`);
      } else {
        throw new Error('Failed to start job search');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setError(error.message || 'Failed to search jobs. Please try again.');
      toast.error('Failed to search jobs');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreJobs = async () => {
    if (loadingMore || !sessionId || !processedJobsData?.hasMore) return;
    setLoadingMore(true);
    try {
      setCurrentOffset(prev => prev + PAGE_SIZE);
      toast.info('Loading more jobs...');
    } catch (error: any) {
      console.error('Load more error:', error);
      toast.error('Failed to load more jobs');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a job title or keywords');
      return;
    }
    performSearch(searchQuery, location);
  };

  const toggleSaveJob = async (jobId: string) => {
    if (!user?.id) return;
    
    const isCurrentlySaved = savedJobs.has(jobId);
    
    try {
      if (isCurrentlySaved) {
        await supabase
          .from('job_interactions')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId)
          .eq('interaction_type', 'liked');
        
        setSavedJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
        
        toast.success('Job removed from saved');
      } else {
        await supabase
          .from('job_interactions')
          .insert({
            user_id: user.id,
            job_id: jobId,
            interaction_type: 'liked'
          });
        
        setSavedJobs(prev => new Set([...prev, jobId]));
        toast.success('Job saved');
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to save job');
    }
  };

  const markAsApplied = async (jobId: string) => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('job_interactions')
        .insert({
          user_id: user.id,
          job_id: jobId,
          interaction_type: 'applied'
        });
      
      setAppliedJobs(prev => new Set([...prev, jobId]));
      toast.success('Marked as applied');
    } catch (error) {
      console.error('Error marking as applied:', error);
      toast.error('Failed to mark as applied');
    }
  };

  // Show loading skeletons while initial search is happening
  const isSearching = loading || (sessionId && sessionStatus?.status === 'pending');
  const isProcessing = sessionStatus?.status === 'processing';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Job title, keywords, or company"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, state, or remote"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Search
                </>
              )}
            </button>
          </form>
          
          {/* Results Summary with Real-time Progress */}
          {sessionStatus && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {sessionStatus.status === 'processing' ? (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing {sessionStatus.processedCount} of {sessionStatus.totalJobs} jobs...
                    </span>
                  </>
                ) : sessionStatus.status === 'completed' ? (
                  `Found ${sessionStatus.totalJobs} jobs • Showing ${jobs.length} results`
                ) : sessionStatus.status === 'failed' ? (
                  <span className="text-red-600">Search failed: {sessionStatus.error}</span>
                ) : (
                  'Initializing search...'
                )}
              </div>
              {sessionStatus.status === 'processing' && (
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(sessionStatus.processedCount / sessionStatus.totalJobs) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          {(['recommended', 'liked', 'applied'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
              {tab === 'liked' && savedJobs.size > 0 && (
                <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {savedJobs.size}
                </span>
              )}
              {tab === 'applied' && appliedJobs.size > 0 && (
                <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {appliedJobs.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Real-time Processing Message */}
        {isProcessing && jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>New jobs are being processed and will appear automatically...</span>
          </motion.div>
        )}

        {/* Jobs List with Real-time Updates */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {displayedJobs.map((job, index) => (
              <motion.div
                key={job.job_id}
                ref={index === displayedJobs.length - 1 ? lastJobElementRef : null}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                layout
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {job.job_title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{job.employer_name}</span>
                          {job.job_city && (
                            <>
                              <span className="text-gray-400">•</span>
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">
                                {job.job_city}{job.job_state && `, ${job.job_state}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Match Score */}
                      {job.match_score > 0 && (
                        <div className="ml-4">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            job.match_score >= 80 ? 'bg-green-100 text-green-800' :
                            job.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {job.match_score}% Match
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Job Details */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {job.job_employment_type}
                      </span>
                      {job.job_is_remote && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Remote
                        </span>
                      )}
                      {(job.job_min_salary || job.job_max_salary) && (
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <DollarSign className="h-4 w-4" />
                          {job.job_min_salary && job.job_max_salary
                            ? `$${(job.job_min_salary / 1000).toFixed(0)}k - $${(job.job_max_salary / 1000).toFixed(0)}k`
                            : job.job_min_salary
                            ? `From $${(job.job_min_salary / 1000).toFixed(0)}k`
                            : `Up to $${(job.job_max_salary! / 1000).toFixed(0)}k`}
                        </span>
                      )}
                    </div>

                    {/* Description Preview */}
                    <p className="mt-3 text-gray-600 text-sm line-clamp-2">
                      {job.job_description}
                    </p>

                    {/* Match Reasons */}
                    {job.match_reasons && job.match_reasons.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {job.match_reasons.slice(0, 3).map((reason, idx) => (
                          <span key={idx} className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                            ✓ {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-4">
                      <a
                        href={job.job_apply_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markAsApplied(job.job_id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Apply Now
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => toggleSaveJob(job.job_id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                          savedJobs.has(job.job_id)
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${savedJobs.has(job.job_id) ? 'fill-current' : ''}`} />
                        {savedJobs.has(job.job_id) ? 'Saved' : 'Save'}
                      </button>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Skeletons */}
          {isSearching && !jobs.length && (
            <>
              {[...Array(3)].map((_, i) => (
                <JobSkeleton key={i} />
              ))}
            </>
          )}

          {/* Load More Indicator */}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          )}

          {/* End of Results */}
          {sessionStatus?.status === 'completed' && !processedJobsData?.hasMore && jobs.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>You've reached the end of the results</p>
              <p className="text-sm mt-1">Try adjusting your search criteria to find more jobs</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !jobs.length && searchQuery && sessionStatus?.status === 'completed' && (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or location</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobSearchPageConvex;