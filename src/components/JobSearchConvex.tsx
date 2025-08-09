import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, MapPin, Briefcase, Filter, Loader2, Heart, 
  Building2, Star, Bookmark, ArrowUpRight, TrendingUp, 
  ChevronRight, Clock, DollarSign, Users, Sparkles,
  Grid3X3, List, LayoutGrid, SlidersHorizontal,
  CheckCircle2, XCircle, AlertCircle
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
import { resumeApiClient } from '../lib/resumeApi';

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
  job_posted_at_datetime_utc: string;
  job_highlights?: any;
  job_required_experience?: any;
  match_score?: number;
  gaps_analysis?: any;
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

type ViewMode = 'grid' | 'list' | 'compact';
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('match_score');
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [likedJobs, setLikedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  
  // Refs for virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<HTMLDivElement>(null);
  
  // Convex hooks
  const createSession = useMutation(api.jobs.mutations.createSearchSession);
  const searchJobs = useAction(api.jobs.actions.searchJobs);
  const trackInteraction = useMutation(api.jobs.mutations.saveJobInteraction);
  
  // Queries - only run when sessionId and authToken exist
  const session = useQuery(
    api.jobs.queries.getSession,
    sessionId && authToken ? { authToken, sessionId } : "skip"
  );
  
  const jobs = useQuery(
    api.jobs.queries.getSessionJobs,
    sessionId && authToken ? { authToken, sessionId, limit: 100 } : "skip"
  );
  
  const userInteractions = useQuery(
    api.jobs.queries.getUserInteractions,
    jobs && authToken ? { authToken, jobIds: jobs.map(j => j.job_id) } : "skip"
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
    estimateSize: useCallback(() => {
      switch (viewMode) {
        case 'grid': return 320;
        case 'list': return 180;
        case 'compact': return 80;
        default: return 180;
      }
    }, [viewMode]),
    overscan: 5, // Render 5 items outside viewport
  });
  
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
  const handleOptimizeResume = async (job: Job) => {
    if (!authToken) {
      toast.error('Please log in to optimize your resume');
      return;
    }
    
    try {
      // Track optimization
      await trackInteraction({
        authToken,
        jobId: job.job_id,
        interactionType: 'applied', // or create 'optimized' type
      });
      
      // Get resume API token
      const token = await resumeApiClient.getAuthToken(user!.id);
      
      // Prepare optimization request
      const optimizationData = {
        job_description: job.job_description,
        job_title: job.job_title,
        company: job.employer_name,
        required_skills: job.job_required_experience?.required_skills || [],
        missing_skills: job.gaps_analysis?.missing_skills || [],
      };
      
      // Open optimization in new tab
      const optimizationUrl = `${import.meta.env.VITE_RESUME_API_URL}/api/resume/analyze`;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = optimizationUrl;
      form.target = '_blank';
      
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = token;
      
      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'data';
      dataInput.value = JSON.stringify(optimizationData);
      
      form.appendChild(tokenInput);
      form.appendChild(dataInput);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      
      toast.success('Opening resume optimizer...');
    } catch (error) {
      console.error('Optimization error:', error);
      toast.error('Failed to optimize resume');
    }
  };
  
  // Handle interactions
  const handleLike = async (jobId: string) => {
    if (!authToken) {
      toast.error('Please log in to save jobs');
      return;
    }
    
    const isLiked = likedJobs.has(jobId);
    
    try {
      if (isLiked) {
        await trackInteraction({
          authToken,
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
          authToken,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Animated gradient background */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20 animate-gradient" />
      </div>
      
      {/* Search Section */}
      <div className="relative z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Search Inputs */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Job title, keywords, or company"
                className="w-full pl-10 pr-4 py-3 bg-white/90 backdrop-blur border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                className="w-full pl-10 pr-4 py-3 bg-white/90 backdrop-blur border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            
            <motion.button
              onClick={handleSearch}
              disabled={isSearching || !resumeText || !authToken || authLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
          
          {/* Filter Pills */}
          <div className="flex gap-3 items-center">
            <motion.button
              onClick={() => setShowFilters(!showFilters)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-white/90 backdrop-blur border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </motion.button>
            
            <motion.button
              onClick={() => setFilters({ ...filters, remote: !filters.remote })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                filters.remote
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-white/90 backdrop-blur border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Remote Only
            </motion.button>
            
            {/* View Mode Toggle */}
            <div className="ml-auto flex gap-2 bg-white/90 backdrop-blur border border-gray-300 rounded-lg p-1">
              {(['grid', 'list', 'compact'] as ViewMode[]).map((mode) => (
                <motion.button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-2 rounded transition-colors ${
                    viewMode === mode
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {mode === 'grid' && <Grid3X3 className="h-4 w-4" />}
                  {mode === 'list' && <List className="h-4 w-4" />}
                  {mode === 'compact' && <LayoutGrid className="h-4 w-4" />}
                </motion.button>
              ))}
            </div>
            
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-4 py-2 bg-white/90 backdrop-blur border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="match_score">Best Match</option>
              <option value="date">Most Recent</option>
              <option value="salary">Highest Salary</option>
            </select>
          </div>
        </div>
        
        {/* Progress Indicator */}
        {session && session.status !== 'initializing' && (
          <div className="border-t border-gray-200/50 px-4 py-3 bg-white/60 backdrop-blur">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Stage Indicators */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 ${
                    session.status === 'searching' || session.status === 'processing' || session.status === 'completed'
                      ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Searching</span>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  
                  <div className={`flex items-center gap-2 ${
                    session.status === 'processing' || session.status === 'completed'
                      ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    <div className="relative">
                      {session.status === 'processing' && (
                        <div className="absolute inset-0 animate-ping">
                          <div className="h-5 w-5 rounded-full bg-emerald-400 opacity-75" />
                        </div>
                      )}
                      <CheckCircle2 className="h-5 w-5 relative" />
                    </div>
                    <span className="text-sm font-medium">Processing</span>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  
                  <div className={`flex items-center gap-2 ${
                    session.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Complete</span>
                  </div>
                </div>
                
                {/* Job Count */}
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-indigo-600">{session.processedCount}</span>
                  {' of '}
                  <span className="font-semibold">{session.totalFound}</span>
                  {' jobs processed'}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="flex items-center gap-4">
                <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
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
      </div>
      
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
            <AnimatePresence mode="popLayout">
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const job = processedJobs[virtualItem.index];
                if (!job) return null;
                
                const isLiked = likedJobs.has(job.job_id);
                const isApplied = appliedJobs.has(job.job_id);
                
                return (
                  <motion.div
                    key={job._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(virtualItem.index * 0.05, 0.5), // Cap delay
                    }}
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
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6 mx-2 my-2 border-2 ${getMatchScoreColor(job.match_score)}`}
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
                          {job.gaps_analysis && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {job.gaps_analysis.matching_skills?.slice(0, 3).map((skill: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs"
                                >
                                  ✓ {skill}
                                </span>
                              ))}
                              {job.gaps_analysis.missing_skills?.slice(0, 2).map((skill: string, idx: number) => (
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
                              onClick={() => authToken && trackInteraction({
                                authToken,
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
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
    </div>
  );
};

export default JobSearchConvex;