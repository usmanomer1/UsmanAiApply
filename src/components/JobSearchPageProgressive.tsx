import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Briefcase, Filter, Loader2, Heart, Users, DollarSign, Building2, Star, Bookmark, ArrowUpRight, TrendingUp, ChevronRight } from 'lucide-react';
import { joboticApi, JobMatchRequest, JobMatchProgressiveResponse } from '../lib/joboticApi';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { trackJobSearchUsage, updateCachedUsage } from '../lib/jobSearchUsage';
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

const JobSearchPageProgressive: React.FC = () => {
  const { user } = useAuth();
  const routeLocation = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalJobsFound, setTotalJobsFound] = useState(0);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'recommended' | 'liked' | 'applied'>('recommended');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [usageStats, setUsageStats] = useState<{ jobsViewed: number; jobLimit: number }>({ jobsViewed: 0, jobLimit: 100 });
  
  // Infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastJobElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreJobs();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  // Filter jobs based on activeTab
  const displayedJobs = jobs.filter(job => {
    if (activeTab === 'liked') return savedJobs.has(job.job_id);
    if (activeTab === 'applied') return appliedJobs.has(job.job_id);
    return activeTab === 'recommended';
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
      if (!user?.id) return;

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
          
          // Auto-search if we have job title
          if (initialLoad && profile.current_job_title) {
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
  }, [user, initialLoad]);

  const performSearch = async (query: string, loc: string, resume?: string) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setJobs([]); // Clear previous results
    setSessionId(null); // Start new session
    setOffset(0);
    setHasMore(false);
    
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
      
      const response = await joboticApi.searchJobsProgressive({
        ...request,
        limit: 10,
        offset: 0
      });
      
      if (response.success && response.data) {
        // Sanitize job data
        const sanitizedJobs = response.data.jobs.map(job => ({
          ...job,
          match_score: typeof job.match_score === 'number' && !isNaN(job.match_score) ? job.match_score : 0,
          job_min_salary: typeof job.job_min_salary === 'number' && !isNaN(job.job_min_salary) ? job.job_min_salary : null,
          job_max_salary: typeof job.job_max_salary === 'number' && !isNaN(job.job_max_salary) ? job.job_max_salary : null,
        }));
        
        setJobs(sanitizedJobs);
        setSessionId(response.sessionId);
        setHasMore(response.hasMore);
        setOffset(response.nextOffset);
        setTotalJobsFound(response.data.totalFound);
        
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
        
        // Track usage
        if (user?.id && sanitizedJobs.length > 0) {
          await trackJobSearchUsage(user.id, sanitizedJobs.length, {
            search_type: 'progressive_search',
            query,
            location: loc
          });
        }
        
        toast.success(`Found ${response.data.totalFound} jobs matching your search`);
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
    if (loadingMore || !hasMore || !sessionId) return;
    
    setLoadingMore(true);
    
    try {
      const request: JobMatchRequest = {
        resumeText,
        query: searchQuery,
        location: location || undefined,
        ...(filters.remote_jobs_only && { remote_jobs_only: true }),
        ...(filters.employment_types.length > 0 && { 
          employment_types: filters.employment_types as any 
        }),
        ...(filters.date_posted && { date_posted: filters.date_posted as any })
      };
      
      const response = await joboticApi.searchJobsProgressive({
        ...request,
        sessionId,
        limit: 10,
        offset
      });
      
      if (response.success && response.data) {
        // Sanitize and append new jobs
        const sanitizedJobs = response.data.jobs.map(job => ({
          ...job,
          match_score: typeof job.match_score === 'number' && !isNaN(job.match_score) ? job.match_score : 0,
          job_min_salary: typeof job.job_min_salary === 'number' && !isNaN(job.job_min_salary) ? job.job_min_salary : null,
          job_max_salary: typeof job.job_max_salary === 'number' && !isNaN(job.job_max_salary) ? job.job_max_salary : null,
        }));
        
        setJobs(prev => [...prev, ...sanitizedJobs]);
        setHasMore(response.hasMore);
        setOffset(response.nextOffset);
        
        // Update usage stats
        if (response.usage) {
          setUsageStats({
            jobsViewed: response.usage.monthly_used || 0,
            jobLimit: response.usage.monthly_limit || 100
          });
        }
        
        // Track usage
        if (user?.id && sanitizedJobs.length > 0) {
          await trackJobSearchUsage(user.id, sanitizedJobs.length, {
            search_type: 'progressive_load_more',
            query: searchQuery,
            location
          });
        }
      }
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
          
          {/* Results Summary */}
          {totalJobsFound > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              Found {totalJobsFound} jobs • Showing {jobs.length} of {totalJobsFound}
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

        {/* Jobs List */}
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
          {loading && !jobs.length && (
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
          {!hasMore && jobs.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>You've reached the end of the results</p>
              <p className="text-sm mt-1">Try adjusting your search criteria to find more jobs</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !jobs.length && searchQuery && (
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

export default JobSearchPageProgressive;