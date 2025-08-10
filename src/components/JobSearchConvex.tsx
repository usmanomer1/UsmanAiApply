import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  employmentTypes?: string[];
  experienceLevel?: string[];
  radius?: number;
}

type SortBy = 'match_score' | 'date' | 'salary';

const JobSearchConvex: React.FC = () => {
  const { user } = useAuth();
  const { authToken, loading: authLoading, error: authError } = useConvexAuth();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [sessionId, setSessionId] = useState<Id<"jobSearchSessions"> | null>(null);
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
  const [likedJobs, setLikedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  
  // Resume optimizer modal state
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [selectedJobForOptimization, setSelectedJobForOptimization] = useState<Job | null>(null);
  
  // Refs for virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<HTMLDivElement>(null);
  
  // Convex hooks - use auth actions instead of mutations
  const createSession = useAction(api.jobs.authAction.createAuthenticatedSession);
  const searchJobs = useAction(api.jobs.authAction.searchJobsAuthenticated);
  const trackInteraction = useMutation(api.jobs.mutations.saveJobInteraction);
  
  // Queries - only run when sessionId exists
  const session = useQuery(
    api.jobs.queries.getSession,
    sessionId ? { sessionId } : "skip"
  );
  
  const jobs = useQuery(
    api.jobs.queries.getSessionJobs,
    sessionId ? { sessionId, limit: 100 } : "skip"
  );
  
  const userInteractions = useQuery(
    api.jobs.queries.getUserInteractions,
    jobs && user?.id ? { userId: user.id, jobIds: jobs.map(j => j.job_id) } : "skip"
  );
  
  // Process and sort jobs
  const processedJobs = useMemo(() => {
    if (!jobs) return [];
    
    let sortedJobs = [...jobs];
    
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
    
    // Apply filters
    if (filters.remote) {
      sortedJobs = sortedJobs.filter(job => job.job_is_remote);
    }
    
    return sortedJobs;
  }, [jobs, sortBy, filters]);
  
  // Virtual scrolling setup for performance
  const virtualizer = useVirtualizer({
    count: processedJobs.length,
    getScrollElement: () => scrollingRef.current,
    estimateSize: useCallback(() => 140, []), // Fixed height for list view
    overscan: 3, // Render 3 items outside viewport
  });
  
  // Force re-measure when jobs change
  useEffect(() => {
    virtualizer.measure();
  }, [processedJobs.length]);
  
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
      
      Object.entries(userInteractions).forEach(([jobId, interaction]: [string, any]) => {
        if (interaction.interactionType === 'liked') liked.add(jobId);
        if (interaction.interactionType === 'applied') applied.add(jobId);
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
    if (!searchQuery.trim()) {
      toast.error('Please enter a job title or keywords');
      return;
    }
    
    if (!resumeText) {
      toast.error('Please upload your resume first');
      return;
    }
    
    if (!authToken) {
      toast.error('Please log in to search for jobs');
      return;
    }
    
    setIsSearching(true);
    
    try {
      // Create session
      const newSessionId = await createSession({
        authToken,
        query: searchQuery,
        location: location || undefined,
        resumeText,
        filters,
      });
      
      setSessionId(newSessionId);
      
      // Trigger search action
      await searchJobs({
        authToken,
        sessionId: newSessionId,
        query: searchQuery,
        location: location || undefined,
        resumeText,
        filters,
        numJobs: 100, // Get best value
      });
      
      toast.success('Search started! Jobs will appear as they\'re processed.');
    } catch (error) {
      console.error('Search error:', error);
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
  
  // Handle interactions
  const handleLike = async (jobId: string) => {
    if (!user?.id) {
      toast.error('Please log in to save jobs');
      return;
    }
    
    const isLiked = likedJobs.has(jobId);
    
    try {
      if (isLiked) {
        await trackInteraction({
          userId: user.id,
          jobId,
          interactionType: 'hidden',
        });
        setLikedJobs(prev => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      } else {
        await trackInteraction({
          userId: user.id,
          jobId,
          interactionType: 'liked',
        });
        setLikedJobs(prev => new Set([...prev, jobId]));
      }
    } catch (error) {
      console.error('Like error:', error);
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
    if (!session) return 0;
    if (session.status === 'completed') return 100;
    if (session.totalFound === 0) return 0;
    return Math.round((session.processedCount / session.totalFound) * 100);
  }, [session]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Search Section */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
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
              <label className="ml-auto">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] text-white font-medium rounded-lg hover:shadow-md transition-all"
                >
                  Upload Resume
                </motion.button>
              </label>
            </motion.div>
          )}
          
          {/* Search Inputs */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Job title, keywords, or company"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-[#1DE0DD] transition-all"
              />
            </div>
            
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="City, state, or remote"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DE0DD] focus:border-[#1DE0DD] transition-all"
              />
            </div>
            
            <motion.button
              onClick={handleSearch}
              disabled={isSearching || !resumeText || !authToken || authLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-2.5 bg-gradient-to-r from-[#1DE0DD] to-[#00C4CC] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg flex items-center gap-2"
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
        {session && session.status !== 'initializing' && (
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Stage Indicators */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 ${
                    session.status === 'searching' || session.status === 'processing' || session.status === 'completed'
                      ? 'text-[#1DE0DD]' : 'text-gray-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Searching</span>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                  
                  <div className={`flex items-center gap-2 ${
                    session.status === 'processing' || session.status === 'completed'
                      ? 'text-[#1DE0DD]' : 'text-gray-400'
                  }`}>
                    <div className="relative">
                      {session.status === 'processing' && (
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
                    session.status === 'completed' ? 'text-[#1DE0DD]' : 'text-gray-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Complete</span>
                  </div>
                </div>
                
                {/* Job Count */}
                <div className="flex items-center gap-2">
                  <div className="bg-[#1DE0DD] text-white px-3 py-1.5 rounded-full text-sm font-bold min-w-[40px] text-center">
                    {session.processedCount}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">of</span>
                  <div className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-bold min-w-[40px] text-center">
                    {session.totalFound}
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
        <div
          ref={scrollingRef}
          className="relative h-[calc(100vh-280px)] overflow-auto"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const job = processedJobs[virtualItem.index];
              if (!job) return null;
              
              const isLiked = likedJobs.has(job.job_id);
              const isApplied = appliedJobs.has(job.job_id);
              
              return (
                  <div
                    key={job._id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      whileHover={{ y: -2, transition: { duration: 0.2 } }}
                      className={`bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow p-4 mx-2 mb-2 border ${getMatchScoreColor(job.match_score)}`}
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
                              onClick={() => user?.id && trackInteraction({
                                userId: user.id,
                                jobId: job.job_id,
                                interactionType: 'applied',
                              })}
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
                              whileTap={{ scale: 0.95 }}
                              className={`p-2 rounded-lg ${
                                isLiked
                                  ? 'bg-rose-100 text-rose-600'
                                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                            </motion.button>
                            
                            <motion.button
                              onClick={() => setSelectedJob(job)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-2 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                            >
                              <ChevronRight className="h-4 w-4" />
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
        
        {/* Empty State */}
        {!sessionId && !isSearching && (
          <div className="flex flex-col items-center justify-center py-24">
            <Briefcase className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Job Search</h3>
            <p className="text-gray-600 text-center max-w-md">
              Enter a job title and location to find your perfect match. Our AI will analyze your resume and show you the best opportunities.
            </p>
          </div>
        )}
        
        {/* Loading State */}
        {isSearching && processedJobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-16 w-16 text-indigo-600 animate-spin mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Searching for Jobs</h3>
            <p className="text-gray-600">This may take a moment...</p>
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