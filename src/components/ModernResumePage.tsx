import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Button,
  Badge,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Grid,
  Metric,
  Flex,
  ProgressBar,
  Callout,
  TextInput,
  Textarea,
  Select,
  SelectItem,
  Divider,
  List,
  ListItem,
  ProgressCircle,
  AreaChart,
  BarList,
  Dialog,
  DialogPanel,
  Subtitle,
  MultiSelect,
  MultiSelectItem,
  NumberInput,
  Switch,
  DateRangePickerValue,
  Color
} from '@tremor/react';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  DocumentArrowDownIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  BoltIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  DocumentCheckIcon,
  ChartPieIcon,
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  CpuChipIcon,
  UserGroupIcon,
  BookOpenIcon,
  AcademicCapIcon,
  FireIcon,
  TrophyIcon,
  StarIcon,
  RocketLaunchIcon,
  CommandLineIcon,
  CursorArrowRaysIcon,
  PresentationChartLineIcon,
  ClipboardDocumentCheckIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  TrashIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import {
  DocumentTextIcon as DocumentTextIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import { analyzeResume, generateOptimizedResume, downloadResume, validateResumeFile, AnalyzeResponse, GenerateResponse, getApiToken } from '../lib/resumeApiClient';
import toast from 'react-hot-toast';
import { canPerformAction, trackAITokenUsage } from '../lib/usageTracking';

interface ResumeUpload {
  id: string;
  filename: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

interface ResumeAnalysis {
  id: string;
  resume_text: string;
  job_title?: string;
  company_name?: string;
  job_description?: string;
  analysis_result?: any;
  analysis_id?: string;
  created_at: string;
}

export default function ModernResumePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  
  const [recentUploads, setRecentUploads] = useState<ResumeUpload[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<ResumeAnalysis[]>([]);
  
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [editType, setEditType] = useState<'full' | 'quick'>('full');
  const [score, setScore] = useState(0);
  
  const [expandedSections, setExpandedSections] = useState<string[]>(['keywords', 'skills', 'suggestions']);
  const [selectedAnalysisForView, setSelectedAnalysisForView] = useState<ResumeAnalysis | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  
  useEffect(() => {
    if (user) {
      fetchRecentUploads();
      fetchRecentAnalyses();
    }
  }, [user]);
  
  // Animate score when analysis result changes
  useEffect(() => {
    if (analysisResult?.data?.summary?.overallScore) {
      const targetScore = analysisResult.data.summary.overallScore;
      const duration = 1500;
      const startTime = Date.now();
      
      const animateScore = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentScore = Math.round(targetScore * easeOutQuart);
        
        setScore(currentScore);
        
        if (progress < 1) {
          requestAnimationFrame(animateScore);
        }
      };
      
      animateScore();
    }
  }, [analysisResult]);
  
  const fetchRecentUploads = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('resume_uploads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentUploads(data);
    }
  };

  const fetchRecentAnalyses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('resume_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentAnalyses(data);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      handleFileSelect({ target: { files: [pdfFile] } } as any);
    } else {
      toast.error('Please drop a PDF file');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateResumeFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    
    // Extract text from PDF
    try {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      toast.success('Resume uploaded successfully!');
    } catch (error) {
      console.error('Error extracting text:', error);
      toast.error('Failed to extract text from PDF');
    } finally {
      setUploading(false);
    }
  };

  const uploadResumeToStorage = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('resume-uploads')
      .upload(fileName, file);

    if (error) throw error;
    return data.path;
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !user) {
      toast.error('Please select a resume file');
      return;
    }

    if (!jobTitle || !companyName || !jobDescription) {
      toast.error('Please fill in all job details');
      return;
    }

    // Check AI token limits before analyzing
    const canPerform = await canPerformAction(user.id, 'resume_optimization');
    if (!canPerform.allowed) {
      toast.error(canPerform.reason || 'Insufficient AI tokens for resume analysis');
      return;
    }

    setAnalyzing(true);
    
    try {
      // Upload file to storage
      const filePath = await uploadResumeToStorage(selectedFile);
      
      // Save upload record
      const { data: uploadData, error: uploadError } = await supabase
        .from('resume_uploads')
        .insert({
          user_id: user.id,
          filename: selectedFile.name,
          file_url: filePath,
          file_size: selectedFile.size,
          upload_type: 'analysis'
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      // Call analysis API
      const result = await analyzeResume(
        user.id,
        selectedFile,
        jobDescription,
        jobTitle,
        companyName
      );

      setAnalysisResult(result);

      // Save analysis record
      const { data: analysisData, error: analysisError } = await supabase
        .from('resume_analyses')
        .insert({
          user_id: user.id,
          resume_upload_id: uploadData.id,
          resume_text: resumeText,
          job_title: jobTitle,
          company_name: companyName,
          job_description: jobDescription,
          analysis_result: result,
          analysis_id: result.data.analysisId
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      setCurrentAnalysisId(analysisData.id);
      
      // Initialize selected sections and skills
      if (result.data.sections) {
        setSelectedSections(result.data.sections.map((s: any) => s.id));
      }
      if (result.data.skills?.suggested) {
        setSelectedSkills(result.data.skills.suggested.slice(0, 10));
      }

      toast.success('Resume analyzed successfully!');
      
      // Track AI token usage
      await trackAITokenUsage(user.id, 'resume_optimization', {
        action: 'analyze',
        analysisId: result.data.analysisId,
        jobTitle: jobTitle,
        companyName: companyName
      });
      
      // Refresh lists
      fetchRecentUploads();
      fetchRecentAnalyses();
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to analyze resume');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysisResult || !user || !currentAnalysisId) {
      toast.error('Please analyze a resume first');
      return;
    }

    // Check AI token limits before generating
    const canPerform = await canPerformAction(user.id, 'resume_optimization');
    if (!canPerform.allowed) {
      toast.error(canPerform.reason || 'Insufficient AI tokens for resume generation');
      return;
    }

    setGenerating(true);

    try {
      const result = await generateOptimizedResume(
        user.id,
        analysisResult.data.analysisId,
        editType,
        selectedSections,
        selectedSkills,
        additionalInstructions
      );

      // Save generation record
      await supabase
        .from('resume_generations')
        .insert({
          user_id: user.id,
          analysis_id: currentAnalysisId,
          generation_id: result.data.generationId,
          generation_result: result,
          download_url: result.data.downloadUrl,
          filename: result.data.filename,
          edit_type: editType,
          selected_sections: selectedSections,
          selected_skills: selectedSkills,
          additional_instructions: additionalInstructions
        });

      // Download the file
      const downloadUrl = await downloadResume(user.id, result.data.generationId);
      
      // Instead of opening in new tab, trigger a download
      try {
        const token = await getApiToken(user.id);
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename || 'optimized_resume.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Download error:', error);
        // Fallback to opening in new tab
        window.open(downloadUrl, '_blank');
      }
      
      toast.success('Resume generated successfully!');
      
      // Track AI token usage for generation
      await trackAITokenUsage(user.id, 'resume_optimization', {
        action: 'generate',
        generationId: result.data.generationId,
        editType: editType
      });
      
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate resume');
    } finally {
      setGenerating(false);
    }
  };

  const loadPreviousAnalysis = (analysis: ResumeAnalysis) => {
    if (analysis.analysis_result) {
      setAnalysisResult(analysis.analysis_result);
      setCurrentAnalysisId(analysis.id);
      setJobTitle(analysis.job_title || '');
      setCompanyName(analysis.company_name || '');
      setJobDescription(analysis.job_description || '');
      
      // Initialize selections
      if (analysis.analysis_result.data.sections) {
        setSelectedSections(analysis.analysis_result.data.sections.map((s: any) => s.id));
      }
      if (analysis.analysis_result.data.skills?.suggested) {
        setSelectedSkills(analysis.analysis_result.data.skills.suggested.slice(0, 10));
      }
      
      setActiveTab(0);
      toast.success('Previous analysis loaded');
    }
  };

  const getScoreColor = (score: number): Color => {
    if (score >= 70) return 'emerald';
    if (score >= 30) return 'amber';
    return 'red';
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Get available skills from analysis result
  const getAvailableSkills = () => {
    if (!analysisResult?.data?.skills) return [];
    const { suggested = [], existing = [] } = analysisResult.data.skills;
    return [...new Set([...suggested, ...existing])];
  };

  // Get available sections from analysis result
  const getAvailableSections = () => {
    if (!analysisResult?.data?.sections) return [];
    return analysisResult.data.sections.map((section: any) => ({
      id: section.id,
      name: section.name || section.id
    }));
  };

  // Calculate metrics
  const calculateMetrics = () => {
    const totalAnalyses = recentAnalyses.length;
    const scores = recentAnalyses
      .filter(a => a.analysis_result?.data?.summary?.overallScore)
      .map(a => a.analysis_result.data.summary.overallScore);
    
    const averageScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;
    
    const successRate = scores.filter(s => s >= 70).length / (scores.length || 1) * 100;
    
    return {
      totalAnalyses,
      averageScore,
      successRate,
      improvementRate: scores.length > 1 
        ? ((scores[0] - scores[scores.length - 1]) / (scores[scores.length - 1] || 1)) * 100
        : 0
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          Resume Optimizer
        </h1>
        <p className="mt-2 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          AI-powered resume analysis and optimization for your dream job
        </p>
      </div>

      {/* Key Metrics */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Total Analyses</Text>
              <Metric>{metrics.totalAnalyses}</Metric>
            </div>
            <Badge icon={DocumentTextIcon} color="blue">
              Active
            </Badge>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="emerald">
          <Flex alignItems="start">
            <div>
              <Text>Average Score</Text>
              <Metric>{Math.round(metrics.averageScore)}%</Metric>
            </div>
            <Badge icon={TrophyIcon} color="emerald">
              {metrics.averageScore >= 70 ? 'Good' : 'Improving'}
            </Badge>
          </Flex>
          <ProgressBar value={metrics.averageScore} className="mt-3" color="emerald" />
        </Card>

        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <div>
              <Text>Success Rate</Text>
              <Metric>{Math.round(metrics.successRate)}%</Metric>
            </div>
            <Badge icon={ChartBarIcon} color="amber">
              Quality
            </Badge>
          </Flex>
          <ProgressBar value={metrics.successRate} className="mt-3" color="amber" />
        </Card>

        <Card decoration="top" decorationColor="purple">
          <Flex alignItems="start">
            <div>
              <Text>Improvement</Text>
              <Metric>
                {metrics.improvementRate > 0 ? '+' : ''}{Math.round(metrics.improvementRate)}%
              </Metric>
            </div>
            <Badge icon={FireIcon} color="purple">
              Trending
            </Badge>
          </Flex>
        </Card>
      </Grid>

      {/* Main Content */}
      <TabGroup defaultIndex={0} onIndexChange={setActiveTab}>
        <TabList>
          <Tab icon={CloudArrowUpIcon}>Upload & Analyze</Tab>
          <Tab icon={ClockIcon}>History</Tab>
          <Tab icon={ChartBarIcon}>Insights</Tab>
        </TabList>

        <TabPanels>
          {/* Upload & Analyze Tab */}
          <TabPanel>
            <Grid numItemsMd={2} className="gap-6">
              {/* Upload Section */}
              <Card>
                <Title>Upload Resume</Title>
                <Text className="mt-1">Upload your resume for AI-powered analysis</Text>
                
                <div className="mt-6 space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      isDragging
                        ? 'border-tremor-brand bg-tremor-brand-faint'
                        : selectedFile
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-tremor-border hover:border-tremor-border-dark'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {uploading ? (
                      <div className="space-y-4">
                        <ArrowPathIcon className="mx-auto h-12 w-12 text-tremor-brand animate-spin" />
                        <ProgressBar value={50} className="mt-3" />
                        <Text>Processing your resume...</Text>
                      </div>
                    ) : selectedFile ? (
                      <div className="space-y-3">
                        <CheckCircleIconSolid className="mx-auto h-12 w-12 text-emerald-500" />
                        <div className="p-3 bg-tremor-background-subtle rounded-lg">
                          <Flex>
                            <div className="flex items-center gap-2">
                              <DocumentTextIcon className="h-5 w-5 text-tremor-content" />
                              <Text>{selectedFile.name}</Text>
                            </div>
                            <Button
                              size="xs"
                              variant="secondary"
                              icon={XMarkIcon}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                                setResumeText('');
                              }}
                            >
                              Remove
                            </Button>
                          </Flex>
                        </div>
                      </div>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-tremor-content-subtle" />
                        <Text className="mt-2">Drop your resume here or click to browse</Text>
                        <Text className="text-tremor-content-subtle">Supports PDF files (max 10MB)</Text>
                      </>
                    )}
                  </div>

                  <Divider />

                  <div>
                    <Text className="mb-2">Job Title</Text>
                    <TextInput
                      placeholder="e.g., Senior Software Engineer"
                      value={jobTitle}
                      onValueChange={setJobTitle}
                      icon={BriefcaseIcon}
                    />
                  </div>

                  <div>
                    <Text className="mb-2">Company Name</Text>
                    <TextInput
                      placeholder="e.g., Google"
                      value={companyName}
                      onValueChange={setCompanyName}
                      icon={BuildingOfficeIcon}
                    />
                  </div>

                  <div>
                    <Text className="mb-2">Job Description</Text>
                    <Textarea
                      placeholder="Paste the job description here..."
                      value={jobDescription}
                      onValueChange={setJobDescription}
                      rows={6}
                    />
                  </div>

                  <Button
                    size="lg"
                    icon={analyzing ? ArrowPathIcon : BeakerIcon}
                    onClick={handleAnalyze}
                    disabled={!selectedFile || !jobTitle || !companyName || !jobDescription || analyzing}
                    loading={analyzing}
                    className="w-full"
                  >
                    {analyzing ? 'Analyzing with AI...' : 'Analyze Resume'}
                  </Button>
                </div>
              </Card>

              {/* Analysis Results */}
              <div className="space-y-6">
                <Card>
                  <Title>Analysis Results</Title>
                  {analysisResult ? (
                    <div className="mt-6">
                      <Flex className="mb-6">
                        <div>
                          <Text>Match Score</Text>
                          <Metric className="mt-2">{score}%</Metric>
                        </div>
                        <ProgressCircle
                          value={score}
                          size="lg"
                          color={getScoreColor(score)}
                        >
                          <span className="text-2xl font-semibold">{score}%</span>
                        </ProgressCircle>
                      </Flex>

                      <div className="space-y-4">
                        {/* Matched Keywords */}
                        <div>
                          <button
                            onClick={() => toggleSection('keywords')}
                            className="w-full flex items-center justify-between text-left p-3 hover:bg-tremor-background-subtle rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                              <Text className="font-medium">
                                Matched Keywords ({analysisResult.data.summary?.keywordMatches?.length || 0})
                              </Text>
                            </div>
                            {expandedSections.includes('keywords') ? (
                              <ChevronUpIcon className="h-5 w-5 text-tremor-content-subtle" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-tremor-content-subtle" />
                            )}
                          </button>
                          {expandedSections.includes('keywords') && (
                            <Flex className="gap-2 flex-wrap mt-3 px-3">
                              {analysisResult.data.summary?.keywordMatches?.slice(0, 10).map((keyword: string) => (
                                <Badge key={keyword} color="emerald">
                                  {keyword}
                                </Badge>
                              ))}
                            </Flex>
                          )}
                        </div>

                        {/* Missing Skills */}
                        <div>
                          <button
                            onClick={() => toggleSection('skills')}
                            className="w-full flex items-center justify-between text-left p-3 hover:bg-tremor-background-subtle rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                              <Text className="font-medium">
                                Missing Skills ({analysisResult.data.summary?.missingSkills?.length || 0})
                              </Text>
                            </div>
                            {expandedSections.includes('skills') ? (
                              <ChevronUpIcon className="h-5 w-5 text-tremor-content-subtle" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-tremor-content-subtle" />
                            )}
                          </button>
                          {expandedSections.includes('skills') && (
                            <Flex className="gap-2 flex-wrap mt-3 px-3">
                              {analysisResult.data.summary?.missingSkills?.slice(0, 10).map((skill: string) => (
                                <Badge key={skill} color="amber">
                                  {skill}
                                </Badge>
                              ))}
                            </Flex>
                          )}
                        </div>

                        {/* AI Suggestions */}
                        <div>
                          <button
                            onClick={() => toggleSection('suggestions')}
                            className="w-full flex items-center justify-between text-left p-3 hover:bg-tremor-background-subtle rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <LightBulbIcon className="h-5 w-5 text-blue-500" />
                              <Text className="font-medium">
                                AI Suggestions ({analysisResult.data.summary?.suggestions?.length || 0})
                              </Text>
                            </div>
                            {expandedSections.includes('suggestions') ? (
                              <ChevronUpIcon className="h-5 w-5 text-tremor-content-subtle" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-tremor-content-subtle" />
                            )}
                          </button>
                          {expandedSections.includes('suggestions') && (
                            <List className="mt-3 px-3">
                              {analysisResult.data.summary?.suggestions?.slice(0, 5).map((suggestion: string, index: number) => (
                                <ListItem key={index}>
                                  <Flex justifyContent="start" className="gap-2">
                                    <LightBulbIcon className="h-4 w-4 text-tremor-brand flex-shrink-0 mt-0.5" />
                                    <Text>{suggestion}</Text>
                                  </Flex>
                                </ListItem>
                              ))}
                            </List>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 text-center py-12">
                      <ChartBarIcon className="mx-auto h-12 w-12 text-tremor-content-subtle" />
                      <Text className="mt-4 text-tremor-content-subtle">
                        Upload a resume and provide job details to see AI-powered analysis
                      </Text>
                    </div>
                  )}
                </Card>

                {/* Generate Optimized Resume */}
                <Card>
                  <Title>Generate Optimized Resume</Title>
                  {analysisResult ? (
                    <div className="mt-6 space-y-4">
                      <div>
                        <Text className="mb-2">Optimization Type</Text>
                        <Select value={editType} onValueChange={(value) => setEditType(value as 'full' | 'quick')}>
                          <SelectItem value="full">
                            Full Optimization - Complete rewrite
                          </SelectItem>
                          <SelectItem value="quick">
                            Quick Edit - Minor tweaks
                          </SelectItem>
                        </Select>
                      </div>

                      <div>
                        <Text className="mb-2">Skills to Include</Text>
                        <MultiSelect
                          value={selectedSkills}
                          onValueChange={setSelectedSkills}
                          placeholder="Select skills to highlight"
                        >
                          {getAvailableSkills().map((skill) => (
                            <MultiSelectItem key={skill} value={skill}>
                              {skill}
                            </MultiSelectItem>
                          ))}
                        </MultiSelect>
                      </div>

                      <div>
                        <Text className="mb-2">Sections to Include</Text>
                        <MultiSelect
                          value={selectedSections}
                          onValueChange={setSelectedSections}
                          placeholder="Select sections"
                        >
                          {getAvailableSections().map((section) => (
                            <MultiSelectItem key={section.id} value={section.id}>
                              {section.name}
                            </MultiSelectItem>
                          ))}
                        </MultiSelect>
                      </div>

                      <div>
                        <Text className="mb-2">Additional Instructions (Optional)</Text>
                        <Textarea
                          placeholder="Any specific requirements or preferences..."
                          value={additionalInstructions}
                          onValueChange={setAdditionalInstructions}
                          rows={3}
                        />
                      </div>

                      <Button
                        size="lg"
                        variant="primary"
                        onClick={handleGenerate}
                        loading={generating}
                        disabled={generating || !analysisResult}
                        className="w-full"
                        icon={generating ? ArrowPathIcon : DocumentArrowDownIcon}
                      >
                        {generating ? 'Generating with AI...' : 'Generate & Download'}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-6 text-center py-12">
                      <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-tremor-content-subtle" />
                      <Text className="mt-4 text-tremor-content-subtle">
                        Analyze your resume first to generate an optimized version
                      </Text>
                    </div>
                  )}
                </Card>
              </div>
            </Grid>
          </TabPanel>

          {/* History Tab */}
          <TabPanel>
            <Grid numItemsMd={2} className="gap-6">
              <Card>
                <Title>Recent Analyses</Title>
                {recentAnalyses.length > 0 ? (
                  <List className="mt-6">
                    {recentAnalyses.map((analysis) => (
                      <ListItem key={analysis.id}>
                        <button
                          onClick={() => loadPreviousAnalysis(analysis)}
                          className="w-full text-left hover:bg-tremor-background-subtle rounded-lg p-2 -m-2 transition-colors"
                        >
                          <Flex>
                            <div>
                              <Text className="font-medium">
                                {analysis.job_title || 'Untitled'} at {analysis.company_name || 'Unknown'}
                              </Text>
                              <Text className="text-tremor-content-subtle">
                                {new Date(analysis.created_at).toLocaleDateString()}
                              </Text>
                            </div>
                            {analysis.analysis_result?.data?.summary?.overallScore && (
                              <Badge
                                color={
                                  analysis.analysis_result.data.summary.overallScore >= 70
                                    ? 'emerald'
                                    : analysis.analysis_result.data.summary.overallScore >= 30
                                    ? 'amber'
                                    : 'red'
                                }
                              >
                                {analysis.analysis_result.data.summary.overallScore}% Match
                              </Badge>
                            )}
                          </Flex>
                        </button>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <div className="mt-6 text-center py-12">
                    <ClockIcon className="mx-auto h-12 w-12 text-tremor-content-subtle" />
                    <Text className="mt-4 text-tremor-content-subtle">
                      No analyses yet. Start by uploading a resume!
                    </Text>
                  </div>
                )}
              </Card>
              
              <Card>
                <Title>Recent Uploads</Title>
                {recentUploads.length > 0 ? (
                  <List className="mt-6">
                    {recentUploads.map((upload) => (
                      <ListItem key={upload.id}>
                        <Flex>
                          <div className="flex items-center gap-3">
                            <DocumentTextIcon className="h-5 w-5 text-tremor-content-subtle" />
                            <div>
                              <Text className="font-medium">{upload.filename}</Text>
                              <Text className="text-tremor-content-subtle">
                                {(upload.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(upload.created_at).toLocaleDateString()}
                              </Text>
                            </div>
                          </div>
                        </Flex>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <div className="mt-6 text-center py-12">
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-tremor-content-subtle" />
                    <Text className="mt-4 text-tremor-content-subtle">
                      No uploads yet. Upload your first resume to get started!
                    </Text>
                  </div>
                )}
              </Card>
            </Grid>
          </TabPanel>

          {/* Insights Tab */}
          <TabPanel>
            <Grid numItemsMd={2} className="gap-6">
              <Card>
                <Title>Score Trends</Title>
                <Text>Your ATS score improvement over time</Text>
                {recentAnalyses.length > 0 ? (
                  <AreaChart
                    className="h-72 mt-4"
                    data={recentAnalyses.map(a => ({
                      date: new Date(a.created_at).toLocaleDateString(),
                      Score: a.analysis_result?.data?.summary?.overallScore || 0
                    }))}
                    index="date"
                    categories={["Score"]}
                    colors={["blue"]}
                    yAxisWidth={40}
                  />
                ) : (
                  <div className="h-72 mt-4 flex items-center justify-center">
                    <Text className="text-tremor-content-subtle">No data available yet</Text>
                  </div>
                )}
              </Card>

              <Card>
                <Title>Top Keywords</Title>
                <Text>Most common keywords in your resumes</Text>
                <div className="mt-4">
                  <BarList
                    data={[
                      { name: "Leadership", value: 12 },
                      { name: "Problem Solving", value: 10 },
                      { name: "Communication", value: 9 },
                      { name: "Project Management", value: 8 },
                      { name: "Analytics", value: 7 }
                    ]}
                    className="mt-2"
                  />
                </div>
              </Card>

              <Card className="col-span-full">
                <Title>Optimization Tips</Title>
                <Text>Expert recommendations to improve your resume</Text>
                
                <div className="mt-4 space-y-3">
                  <Callout title="Use Action Verbs" icon={LightBulbIcon} color="blue">
                    Start bullet points with strong action verbs like "Led", "Developed", "Implemented", or "Achieved"
                  </Callout>
                  <Callout title="Quantify Achievements" icon={ChartBarIcon} color="emerald">
                    Include numbers and metrics to demonstrate impact (e.g., "Increased sales by 30%")
                  </Callout>
                  <Callout title="Match Keywords" icon={CheckCircleIcon} color="amber">
                    Tailor your resume to include keywords from the job description
                  </Callout>
                  <Callout title="Keep it Concise" icon={DocumentTextIcon} color="purple">
                    Limit your resume to 2 pages and use bullet points for easy scanning
                  </Callout>
                </div>
              </Card>
            </Grid>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}