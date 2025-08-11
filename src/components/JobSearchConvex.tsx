import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, Briefcase, Filter, Loader2, Heart, 
  Building2, Star, Bookmark, ArrowUpRight, TrendingUp, 
  ChevronRight, Clock, DollarSign, Users, Sparkles,
  Grid3X3, List, LayoutGrid, SlidersHorizontal,
  CheckCircle2, XCircle, AlertCircle, FileText
} from 'lucide-react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../contexts/AuthContext';
import { useConvexAuth } from '../hooks/useConvexAuth';
import { jobStreamClient } from '../lib/jobStreamClient';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getApiToken } from '../lib/resumeApiClient';
import { ResumeOptimizer } from './ResumeOptimizer';

// Types
interface Job {
  _id: Id<"jobs">;
  job_id: string;
  employer_name: string;
  employer_logo?: string;
  job_title: string;
  job_description: string;
  job_apply_link: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote: boolean;
  job_posted_at_datetime_utc?: string;
  job_highlights?: any;
  job_required_experience?: any;
  match_score?: number;
  gaps_analysis?: any;
  missing_skills?: string[];
  matching_skills?: string[];
  createdAt: number;
  batchIndex: number;
}

interface Filters {
  datePosted?: string;
  remote?: boolean;
  likedOnly?: boolean;
  employmentTypes?: string[];
  experienceLevel?: string[];
  radius?: number;
}

type SortBy = 'match_score' | 'date' | 'salary';

const JobSearchConvex: React.FC = () => {
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [sessionId, setSessionId] = useState<Id<"jobSearchSessions"> | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]); // Local state for streamed jobs
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('match_score');
  const [filters, setFilters] = useState<Filters>({
    datePosted: 'week',
    remote: false,
    employmentTypes: [],
    experienceLevel: [],
    radius: 50
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'connecting' | 'searching' | 'processing' | 'completed' | 'error'>('idle');
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });
  const [likedJobs, setLikedJobs] = useState<Set<string>>(new Set());
  const [processingLikes, setProcessingLikes] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  
  // Resume optimizer modal state
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [selectedJobForOptimization, setSelectedJobForOptimization] = useState<Job | null>(null);
  
  // Refs for virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<HTMLDivElement>(null);
  const measuredHeights = useRef<Map<string, number>>(new Map());
  const averageHeightRef = useRef<number>(180);
  const isFirstRenderRef = useRef<Set<string>>(new Set());
  
  // Convex mutations for interactions only (not for job search)
  const logSearchSession = useMutation(api.jobs.mutations.logSearchSession);
  const likeJob = useMutation(api.jobs.mutations.likeJob);
  const unlikeJob = useMutation(api.jobs.mutations.unlikeJob);
  const markApplied = useMutation(api.jobs.mutations.markApplied);
  
  // Queries - only for session metadata and interactions
  const session = useQuery(
    api.jobs.queries.getSession,
    sessionId ? { sessionId } : "skip"
  );
  
  const userInteractions = useQuery(
    api.jobs.queries.getUserInteractions,
    jobs && jobs.length > 0 && isAuthenticated ? { jobIds: jobs.map(j => j.job_id) } : "skip"
  );
  
  // Always query liked jobs to show count and for filter
  const likedJobsData = useQuery(
    api.jobs.queries.getLikedJobsWithData,
    isAuthenticated ? {} : "skip"
  );
  
  // Process and sort jobs
  const processedJobs = useMemo(() => {
    let jobsToProcess = [];
    
    // PRIORITY 1: If liked filter is on, ONLY show liked jobs from Convex
    if (filters.likedOnly) {
      if (!likedJobsData) {
        // Still loading liked jobs
        return [];
      }
      // Convert liked jobs data to Job format
      jobsToProcess = likedJobsData.map(liked => ({
        ...liked,
        job_id: liked.jobId,
        _id: liked.jobId as any,
        createdAt: liked.likedAt || Date.now(),
        batchIndex: 0,
      }));
    } else {
      // Use streamed jobs from current session
      jobsToProcess = jobs || [];
    }
    
    if (!jobsToProcess || jobsToProcess.length === 0) return [];
    
    let sortedJobs = [...jobsToProcess];
    
    // Apply sorting
    switch (sortBy) {
      case 'match_score':
        sortedJobs.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        break;
      case 'date':
        sortedJobs.sort((a, b) => b.createdAt - a.createdAt);
        break;
      // Add salary sorting if needed
    }
    
    // Apply other filters (remote, employment type, etc.)
    // NOTE: These filters only work on jobs currently in memory:
    // - For liked filter: filters the persisted liked jobs from Convex
    // - For regular search: filters the streamed jobs from current session
    // - Without a search, there are no jobs to filter (except liked jobs)
    if (filters.remote) {
      sortedJobs = sortedJobs.filter(job => job.job_is_remote);
    }
    
    return sortedJobs;
  }, [jobs, sortBy, filters, likedJobsData]);
  
  // Calculate average height from measured items
  useEffect(() => {
    if (measuredHeights.current.size > 0) {
      const heights = Array.from(measuredHeights.current.values());
      const avg = heights.reduce((sum, h) => sum + h, 0) / heights.length;
      averageHeightRef.current = Math.round(avg);
    }
  }, [processedJobs.length]);
  
  // Virtual scrolling setup for performance
  const virtualizer = useVirtualizer({
    count: processedJobs.length,
    getScrollElement: () => scrollingRef.current,
    estimateSize: useCallback((index) => {
      const job = processedJobs[index];
      if (!job) return averageHeightRef.current;
      
      // Use measured height if available, otherwise use average
      const measured = measuredHeights.current.get(job._id);
      return measured || averageHeightRef.current;
    }, [processedJobs]),
    overscan: 3,
    measureElement: useCallback((element) => {
      if (element) {
        const index = parseInt(element.dataset.index || '0');
        const job = processedJobs[index];
        if (job) {
          const height = element.getBoundingClientRect().height;
          if (height > 0) {
            const totalHeight = height + 8; // Include gap
            measuredHeights.current.set(job._id, totalHeight);
            return totalHeight;
          }
        }
      }
      return averageHeightRef.current;
    }, [processedJobs]),
    getItemKey: useCallback((index) => processedJobs[index]?._id || `index-${index}`, [processedJobs]),
  });
  
  // Track new jobs for animation purposes
  useEffect(() => {
    processedJobs.forEach(job => {
      if (!isFirstRenderRef.current.has(job._id)) {
        isFirstRenderRef.current.add(job._id);
      }
    });
  }, [processedJobs]);
  
  // Debounced remeasure to prevent thrashing
  const measureTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Smooth remeasure when jobs change
  useEffect(() => {
    if (virtualizer && processedJobs.length > 0) {
      // Clear any pending measure
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
      
      // Preserve scroll position during updates
      const currentOffset = virtualizer.scrollOffset;
      
      // Debounced measure to prevent thrashing
      measureTimeoutRef.current = setTimeout(() => {
        startTransition(() => {
          requestAnimationFrame(() => {
            virtualizer.measure();
            
            // Restore scroll position if it jumped
            if (Math.abs(virtualizer.scrollOffset - currentOffset) > 100) {
              virtualizer.scrollToOffset(currentOffset, { behavior: 'auto' });
            }
          });
        });
      }, 10); // Small debounce to batch updates
    }
    
    return () => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
    };
  }, [processedJobs.length, virtualizer]);
  
  // Load resume on mount
  useEffect(() => {
    const loadResume = async () => {
      if (!user?.id) return;
      
      try {
        // Try IndexedDB first for better performance
        const cachedResume = localStorage.getItem('resume_text_cache');
        if (cachedResume) {
          setResumeText(cachedResume);
          return;
        }
        
        // Load from Supabase
        const { data: profile } = await supabase
          .from('profiles')
          .select('resume_url')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.resume_url) {
          const { data: fileData } = await supabase.storage
            .from('resumes')
            .download(profile.resume_url);
          
          if (fileData) {
            const text = await extractTextFromPDF(fileData);
            setResumeText(text);
            // Cache for performance
            try {
              localStorage.setItem('resume_text_cache', text);
            } catch (e) {
              console.warn('Could not cache resume:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading resume:', error);
        toast.error('Please upload your resume to use job search');
      }
    };
    
    loadResume();
  }, [user]);
  
  // Update liked/applied sets when interactions change
  useEffect(() => {
    if (userInteractions) {
      const liked = new Set<string>();
      const applied = new Set<string>();
      
      Object.entries(userInteractions).forEach(([jobId, action]: [string, any]) => {
        if (action === 'liked') liked.add(jobId);
        if (action === 'applied') applied.add(jobId);
      });
      
      setLikedJobs(liked);
      setAppliedJobs(applied);
    }
  }, [userInteractions]);
  
  // Handle resume upload
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    
    try {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      
      // Cache for performance
      try {
        localStorage.setItem('resume_text_cache', text);
      } catch (err) {
        console.warn('Could not cache resume:', err);
      }
      
      toast.success('Resume uploaded successfully!');
    } catch (error) {
      console.error('Error processing resume:', error);
      toast.error('Failed to process resume. Please try again.');
    }
  };
  
  // Handle search
  const handleSearch = async () => {
    console.log('Starting search...', { searchQuery, isAuthenticated, user });
    
    if (!searchQuery.trim()) {
      toast.error('Please enter a job title or keywords');
      return;
    }
    
    if (!resumeText) {
      toast.error('Please upload your resume first');
      return;
    }
    
    if (!isAuthenticated) {
      toast.error('Please log in to search for jobs');
      return;
    }
    
    setIsSearching(true);
    setJobs([]); // Clear previous results
    setSearchStatus('connecting');
    setSearchProgress({ current: 0, total: 0 });
    
    try {
      // Combine location with query since backend expects it in query
      const combinedQuery = location?.trim() 
        ? `${searchQuery} in ${location}`
        : searchQuery;
      
      // Stream jobs directly from backend
      await jobStreamClient.streamJobs(
        {
          resumeText,
          query: combinedQuery,
          // Don't send location separately - it's in the query now
          filters,
          numJobs: 100,
        },
        {
          onConnected: (sessionId) => {
            console.log('Connected to stream:', sessionId);
            setSearchStatus('searching');
          },
          onJobsFound: (total, fetchTime) => {
            console.log(`Found ${total} jobs in ${fetchTime}ms`);
            setSearchStatus('processing');
            setSearchProgress({ current: 0, total });
            toast.success(`Found ${total} jobs!`);
          },
          onJob: (job) => {
            // Add job to state immediately as it arrives
            setJobs(prev => [...prev, job]);
            setSearchProgress(prev => ({ ...prev, current: prev.current + 1 }));
          },
          onComplete: async (totalProcessed) => {
            console.log('Stream complete:', totalProcessed);
            setSearchStatus('completed');
            setSearchProgress(prev => ({ ...prev, current: totalProcessed }));
            
            // Log search to Convex for history
            try {
              const combinedQuery = location?.trim() 
                ? `${searchQuery} in ${location}`
                : searchQuery;
              
              await logSearchSession({
                query: combinedQuery,
                totalFound: totalProcessed,
              });
            } catch (err) {
              console.error('Failed to log search:', err);
            }
          },
          onError: (error) => {
            console.error('Stream error:', error);
            setSearchStatus('error');
            toast.error(error);
          },
        }
      );
    } catch (error: any) {
      console.error('Search error details:', error);
      
      // Check if it's a rate limit error
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.type === 'RATE_LIMIT') {
          // Show rate limit message with retry time
          toast.error(errorData.message, {
            duration: 5000,
            icon: '⏰',
          });
          
          // Optional: Show countdown timer
          if (errorData.retryInSeconds && errorData.retryInSeconds < 300) {
            // If retry is less than 5 minutes, show countdown
            setTimeout(() => {
              toast.success('You can search again now!', {
                icon: '✅',
              });
            }, errorData.retryInSeconds * 1000);
          }
          
          return;
        }
      } catch {
        // Not a JSON error, handle normally
      }
      
      toast.error('Failed to start search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Handle resume optimization
  const handleOptimizeResume = (job: Job) => {
    if (!user) {
      toast.error('Please log in to optimize your resume');
      return;
    }
    
    // Parse JSON fields if they exist
    let parsedJob = { ...job };
    
    // Parse gaps_analysis if it's a JSON string
    if (typeof job.gaps_analysis === 'string') {
      try {
        parsedJob.gaps_analysis = JSON.parse(job.gaps_analysis);
      } catch (e) {
        console.error('Failed to parse gaps_analysis:', e);
        parsedJob.gaps_analysis = {};
      }
    }
    
    // Parse job_required_experience if it's a JSON string
    if (typeof job.job_required_experience === 'string') {
      try {
        parsedJob.job_required_experience = JSON.parse(job.job_required_experience);
      } catch (e) {
        console.error('Failed to parse job_required_experience:', e);
        parsedJob.job_required_experience = {};
      }
    }
    
    // Parse job_highlights if it's a JSON string
    if (typeof job.job_highlights === 'string') {
      try {
        parsedJob.job_highlights = JSON.parse(job.job_highlights);
      } catch (e) {
        console.error('Failed to parse job_highlights:', e);
        parsedJob.job_highlights = {};
      }
    }
    
    // Set the selected job and open the modal
    setSelectedJobForOptimization(parsedJob);
    setIsOptimizerOpen(true);
  };
  
  // Handle interactions with optimistic UI updates
  const handleLike = async (jobId: string) => {
    if (!user?.id) {
      toast.error('Please log in to save jobs');
      return;
    }
    
    // Prevent rapid clicking on the same job
    if (processingLikes.has(jobId)) {
      return;
    }
    
    const isLiked = likedJobs.has(jobId);
    const job = jobs.find(j => j.job_id === jobId);
    
    // Optimistic update - update UI immediately for instant feedback
    if (isLiked) {
      setLikedJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } else {
      setLikedJobs(prev => new Set([...prev, jobId]));
    }
    
    // Mark as processing
    setProcessingLikes(prev => new Set([...prev, jobId]));
    
    try {
      // API call in background without blocking UI
      if (isLiked) {
        // Unlike the job
        await unlikeJob({ jobId });
      } else {
        // Like the job with cached data
        await likeJob({ 
          jobId,
          jobData: job ? {
            job_title: job.job_title,
            employer_name: job.employer_name,
            employer_logo: job.employer_logo,
            job_city: job.job_city,
            job_state: job.job_state,
            job_country: job.job_country,
            job_is_remote: job.job_is_remote,
            job_apply_link: job.job_apply_link,
            job_description: job.job_description,
            job_posted_at_datetime_utc: job.job_posted_at_datetime_utc,
            match_score: job.match_score,
            missing_skills: job.missing_skills,
            matching_skills: job.matching_skills,
          } : undefined
        });
      }
      
      // Success - remove from processing
      setProcessingLikes(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } catch (error) {
      console.error('Like error:', error);
      
      // Remove from processing
      setProcessingLikes(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      
      // Rollback on error - revert the optimistic update
      if (isLiked) {
        // Was liked, tried to unlike, failed - add it back
        setLikedJobs(prev => new Set([...prev, jobId]));
        toast.error('Failed to unsave job', {
          duration: 2000,
          style: {
            background: '#FEE2E2',
            color: '#991B1B',
          },
        });
      } else {
        // Wasn't liked, tried to like, failed - remove it
        setLikedJobs(prev => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        toast.error('Failed to save job', {
          duration: 2000,
          style: {
            background: '#FEE2E2',
            color: '#991B1B',
          },
        });
      }
    }
  };
  
  // Get match score color
  const getMatchScoreColor = (score?: number) => {
    if (!score) return 'border-gray-200';
    if (score >= 80) return 'border-emerald-500';
    if (score >= 60) return 'border-amber-500';
    return 'border-rose-500';
  };
  
  // Progress calculation
  const progress = useMemo(() => {
    if (searchStatus === 'idle') return 0;
    if (searchStatus === 'completed') return 100;
    if (searchProgress.total === 0) return 0;
    return Math.round((searchProgress.current / searchProgress.total) * 100);
  }, [searchStatus, searchProgress]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Search Section */}
      <div className="sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
          {/* Resume Upload Alert */}
          {!resumeText && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3"
            >
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-amber-900 font-medium">Upload your resume to unlock AI-powered job matching</span>
              <motion.button
                type="button"
                onClick={() => navigate('/profile?tab=professional')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="ml-auto px-5 py-2 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] text-white font-medium rounded-lg hover:shadow-md transition-all cursor-pointer"
              >
                Upload Resume
              </motion.button>
            </motion.div>
          )}
          
          {/* Search Inputs */}
          <div className="flex gap-3 items-start">
            <div className="flex-1 relative flex items-center">
              <Search className="absolute left-3 text-gray-400 h-5 w-5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Job title, keywords, or company"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-[#1DE0DD] transition-all"
              />
            </div>
            
            <div className="flex-1 relative flex items-center">
              <MapPin className="absolute left-3 text-gray-400 h-5 w-5 pointer-events-none" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="City, state, or remote"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-[#1DE0DD] transition-all"
              />
            </div>
            
            <div className="flex flex-col">
              <motion.button
                onClick={handleSearch}
                disabled={isSearching || !resumeText || !isAuthenticated}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg flex items-center gap-2 h-[42px]"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Search Jobs
                  </>
                )}
              </motion.button>
              <span className="text-[10px] text-gray-400 text-center mt-1">
                10 searches per hour
              </span>
            </div>
          </div>
          </div>
        </div>
      </div>
        
        {/* Filter Controls - Outside the container for full width */}
        <div className="bg-gray-50 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                  showFilters 
                    ? 'bg-[#1DE0DD] text-white shadow-sm' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
              
              <button
                onClick={() => setFilters({ ...filters, remote: !filters.remote })}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                  filters.remote
                    ? 'bg-[#1DE0DD] text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Remote Only
              </button>
              
              <button
                onClick={() => setFilters({ ...filters, likedOnly: !filters.likedOnly })}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                  filters.likedOnly
                    ? 'bg-[#1DE0DD] text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <Heart className={`h-4 w-4 ${filters.likedOnly ? 'fill-current' : ''}`} />
                Liked Jobs {likedJobsData && likedJobsData.length > 0 && `(${likedJobsData.length})`}
              </button>
              
              {/* Sort Dropdown - Moved to right */}
              <div className="ml-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-[#1DE0DD] transition-all"
                >
                  <option value="match_score">Best Match</option>
                  <option value="date">Most Recent</option>
                  <option value="salary">Highest Salary</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Premium Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {/* Date Posted Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Posted</label>
                    <select
                      value={filters.datePosted || 'week'}
                      onChange={(e) => setFilters({ ...filters, datePosted: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-[#1DE0DD] transition-all"
                    >
                      <option value="today">Today</option>
                      <option value="3days">Last 3 days</option>
                      <option value="week">Last week</option>
                      <option value="month">Last month</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                  
                  {/* Employment Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                    <div className="space-y-2">
                      {['FULLTIME', 'PARTTIME', 'CONTRACT', 'INTERNSHIP'].map((type) => (
                        <label key={type} className="flex items-center text-gray-700 hover:text-gray-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.employmentTypes?.includes(type) || false}
                            onChange={(e) => {
                              const types = filters.employmentTypes || [];
                              if (e.target.checked) {
                                setFilters({ ...filters, employmentTypes: [...types, type] });
                              } else {
                                setFilters({ ...filters, employmentTypes: types.filter(t => t !== type) });
                              }
                            }}
                            className="mr-2 text-[#1DE0DD] focus:ring-[#1DE0DD] rounded"
                          />
                          <span className="text-sm">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Experience Level Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
                    <div className="space-y-2">
                      {['entry', 'mid', 'senior', 'executive'].map((level) => (
                        <label key={level} className="flex items-center text-gray-700 hover:text-gray-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.experienceLevel?.includes(level) || false}
                            onChange={(e) => {
                              const levels = filters.experienceLevel || [];
                              if (e.target.checked) {
                                setFilters({ ...filters, experienceLevel: [...levels, level] });
                              } else {
                                setFilters({ ...filters, experienceLevel: levels.filter(l => l !== level) });
                              }
                            }}
                            className="mr-2 text-[#1DE0DD] focus:ring-[#1DE0DD] rounded"
                          />
                          <span className="text-sm capitalize">{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Remote Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Type</label>
                    <label className="flex items-center text-gray-700 hover:text-gray-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.remote || false}
                        onChange={(e) => setFilters({ ...filters, remote: e.target.checked })}
                        className="mr-2 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm">Remote Only</span>
                    </label>
                  </div>
                  
                  {/* Search Radius Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Radius: <span className="text-[#1DE0DD] font-semibold">{filters.radius || 50}</span> miles
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="10"
                      value={filters.radius || 50}
                      onChange={(e) => setFilters({ ...filters, radius: parseInt(e.target.value) })}
                      className="w-full accent-[#1DE0DD]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>10 mi</span>
                      <span>200 mi</span>
                    </div>
                  </div>
                </div>
                
                {/* Apply/Clear Buttons */}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setFilters({
                      datePosted: 'week',
                      remote: false,
                      employmentTypes: [],
                      experienceLevel: [],
                      radius: 50
                    })}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="px-5 py-2 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] text-white rounded-lg font-medium hover:shadow-md transition-all"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Progress Indicator */}
        {searchStatus !== 'idle' && searchProgress.total > 0 && (
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Stage Indicators */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 ${
                    searchStatus === 'searching' || searchStatus === 'processing' || searchStatus === 'completed'
                      ? 'text-[#1DE0DD]' : 'text-gray-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Searching</span>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                  
                  <div className={`flex items-center gap-2 ${
                    searchStatus === 'processing' || searchStatus === 'completed'
                      ? 'text-[#1DE0DD]' : 'text-gray-400'
                  }`}>
                    <div className="relative">
                      {searchStatus === 'processing' && (
                        <div className="absolute inset-0 animate-ping">
                          <div className="h-5 w-5 rounded-full bg-[#1DE0DD] opacity-75" />
                        </div>
                      )}
                      <CheckCircle2 className="h-5 w-5 relative" />
                    </div>
                    <span className="text-sm font-medium">Processing</span>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                  
                  <div className={`flex items-center gap-2 ${
                    searchStatus === 'completed' ? 'text-[#1DE0DD]' : 'text-gray-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Complete</span>
                  </div>
                </div>
                
                {/* Job Count */}
                <div className="flex items-center gap-2">
                  <div className="bg-[#1DE0DD] text-white px-3 py-1.5 rounded-full text-sm font-bold min-w-[40px] text-center">
                    {searchProgress.current}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">of</span>
                  <div className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-bold min-w-[40px] text-center">
                    {searchProgress.total}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">jobs found</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="flex items-center gap-4">
                <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{progress}%</span>
              </div>
            </div>
          </div>
        )}
      
      {/* Jobs List with Virtual Scrolling */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Job Count Header */}
        {jobs.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {processedJobs.length} {processedJobs.length === 1 ? 'Job' : 'Jobs'} Found
              </h2>
              {filters.likedOnly && (
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  Liked Jobs
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {searchStatus === 'searching' && (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </span>
              )}
              {searchStatus === 'processing' && (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing {searchProgress.current} of {searchProgress.total}...
                </span>
              )}
              {searchStatus === 'completed' && (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Search Complete
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Empty State - Moved outside scrolling container for visibility */}
        {!sessionId && !isSearching && jobs.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center justify-center py-8"
          >
            {/* Minimalist Icon */}
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
              className="relative mb-8"
            >
              {/* Subtle glow effect */}
              <div className="absolute inset-0 w-24 h-24 bg-[#1DE0DD]/10 rounded-full blur-2xl" />
              
              {/* Clean icon container */}
              <div className="relative bg-gradient-to-b from-gray-50 to-white border border-gray-200 p-6 rounded-2xl shadow-sm">
                <Briefcase className="h-12 w-12 text-gray-700" strokeWidth={1.5} />
              </div>
            </motion.div>
            
            {/* Elegant Typography */}
            <motion.h3 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-2xl font-light text-gray-900 mb-3 tracking-tight"
            >
              Find Your Next Opportunity
            </motion.h3>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-gray-500 text-center max-w-md mb-12 leading-relaxed"
            >
              AI-powered job matching tailored to your experience and aspirations
            </motion.p>
            
            {/* Premium Statistics */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex gap-12 mb-12"
            >
              <div className="text-center">
                <div className="text-3xl font-light text-gray-900 mb-1">10K+</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Active Jobs</div>
              </div>
              <div className="text-center border-l border-r border-gray-200 px-12">
                <div className="text-3xl font-light text-gray-900 mb-1">85%</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Match Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-light text-gray-900 mb-1">24h</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Updates</div>
              </div>
            </motion.div>
            
            {/* Subtle Features */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex gap-6 mb-8"
            >
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1 h-1 bg-[#1DE0DD] rounded-full" />
                <span className="text-sm">Smart Matching</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1 h-1 bg-[#1DE0DD] rounded-full" />
                <span className="text-sm">Real-time Updates</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-1 h-1 bg-[#1DE0DD] rounded-full" />
                <span className="text-sm">Resume Analysis</span>
              </div>
            </motion.div>
            
            {/* Elegant CTA */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex items-center gap-2"
            >
              <span className="text-sm text-gray-400">Enter a job title above to begin</span>
              <motion.div
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowUpRight className="h-3 w-3 text-gray-400 rotate-[-45deg]" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
        
        {/* Loading State */}
        {isSearching && processedJobs.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24"
          >
            {/* Elegant loading indicator */}
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border border-gray-200 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 w-16 h-16 border border-transparent border-t-[#1DE0DD] rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
              </div>
            </div>
            
            <motion.h3 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg font-light text-gray-900 mb-2"
            >
              Analyzing opportunities
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-gray-500"
            >
              Matching your profile with available positions
            </motion.p>
          </motion.div>
        )}
        
        {/* Loading state for liked jobs filter */}
        {filters.likedOnly && !likedJobsData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-2 border-gray-200 rounded-full"
              />
              <motion.div
                className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-red-500 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <Heart className="absolute inset-0 m-auto h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-lg font-light text-gray-900 mb-2">
              Loading liked jobs...
            </h3>
            <p className="text-sm text-gray-500">
              Fetching your saved positions
            </p>
          </motion.div>
        )}
        
        {/* No liked jobs message */}
        {filters.likedOnly && likedJobsData && likedJobsData.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <Heart className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-light text-gray-900 mb-2">
              No liked jobs yet
            </h3>
            <p className="text-sm text-gray-500">
              Start searching and save jobs you're interested in
            </p>
          </motion.div>
        )}
        
        {/* Jobs Container - Only show when we have jobs */}
        {processedJobs.length > 0 && (
          <div
            ref={scrollingRef}
            className="relative h-[calc(100vh-280px)] overflow-auto"
            style={{ 
              contain: 'strict',
              willChange: 'scroll-position'
            }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
                contain: 'layout style',
                willChange: 'height',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const job = processedJobs[virtualItem.index];
                if (!job) return null;
                
                const isLiked = likedJobs.has(job.job_id);
                const isApplied = appliedJobs.has(job.job_id);
                const isMeasured = measuredHeights.current.has(job._id);
                const isNewItem = !isMeasured && !isFirstRenderRef.current.has(job._id);
              
              return (
                  <div
                    key={job._id}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                      willChange: 'transform',
                      contain: 'layout style',
                      minHeight: `${averageHeightRef.current}px`,
                    }}
                  >
                    <motion.div
                      initial={isNewItem ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={{ 
                        duration: isNewItem ? 0.2 : 0,
                        ease: 'easeOut'
                      }}
                      whileHover={isMeasured ? { y: -2, transition: { duration: 0.2 } } : undefined}
                      className={`bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow p-4 mx-2 border ${getMatchScoreColor(job.match_score)}`}
                      style={{ 
                        minHeight: Math.max(160, averageHeightRef.current - 20) + 'px',
                        willChange: isNewItem ? 'opacity' : 'auto',
                        contain: 'layout style paint'
                      }}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            {/* Company Logo or Initial */}
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                              {job.employer_logo ? (
                                <img src={job.employer_logo} alt={job.employer_name} className="w-full h-full object-contain rounded-lg" />
                              ) : (
                                <span className="text-xl font-bold text-indigo-600">
                                  {job.employer_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {job.job_title}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-4 w-4" />
                                  {job.employer_name}
                                </span>
                                {(job.job_city || job.job_state) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {job.job_city}{job.job_state && `, ${job.job_state}`}
                                  </span>
                                )}
                                {job.job_is_remote && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                    Remote
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Match Score */}
                            {job.match_score && (
                              <div className="relative w-16 h-16">
                                <svg className="w-16 h-16 transform -rotate-90">
                                  <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    className="text-gray-200"
                                  />
                                  <circle
                                    cx="32"
                                    cy="32"
                                    r="28"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 28}`}
                                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - job.match_score / 100)}`}
                                    className={
                                      job.match_score >= 80
                                        ? 'text-emerald-500'
                                        : job.match_score >= 60
                                        ? 'text-amber-500'
                                        : 'text-rose-500'
                                    }
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-700">
                                    {job.match_score}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Description Preview */}
                          <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                            {job.job_description}
                          </p>
                          
                          {/* Skills */}
                          {(job.matching_skills || job.missing_skills) && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {job.matching_skills?.slice(0, 3).map((skill: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs"
                                >
                                  ✓ {skill}
                                </span>
                              ))}
                              {job.missing_skills?.slice(0, 2).map((skill: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs"
                                >
                                  ✗ {skill}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="flex gap-2">
                            <motion.button
                              onClick={() => handleOptimizeResume(job)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                              <Sparkles className="h-4 w-4" />
                              Optimize Resume
                            </motion.button>
                            
                            <motion.a
                              href={job.job_apply_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => isAuthenticated && markApplied({ jobId: job.job_id })}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                            >
                              Apply
                              <ArrowUpRight className="h-4 w-4" />
                            </motion.a>
                            
                            <motion.button
                              onClick={() => handleLike(job.job_id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.85 }}
                              animate={isLiked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                              transition={{ duration: 0.3, type: "spring", stiffness: 500 }}
                              className={`p-2 rounded-lg transition-colors duration-150 ${
                                isLiked
                                  ? 'bg-rose-100 text-rose-600'
                                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <Heart className={`h-4 w-4 transition-all duration-150 ${isLiked ? 'fill-current' : ''}`} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Resume Optimizer Modal */}
      {selectedJobForOptimization && (
        <ResumeOptimizer
          isOpen={isOptimizerOpen}
          onClose={() => {
            setIsOptimizerOpen(false);
            setSelectedJobForOptimization(null);
          }}
          job={selectedJobForOptimization}
          resumeText={resumeText}
        />
      )}
    </div>
  );
};

export default JobSearchConvex;