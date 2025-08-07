import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiUploadLine,
  RiFileTextLine,
  RiCheckLine,
  RiAlertLine,
  RiDownloadLine,
  RiRefreshLine,
  RiEyeLine,
  RiEditLine,
  RiShieldCheckLine,
  RiLightbulbLine,
  RiMagicLine,
  RiSparklingLine,
  RiTimeLine,
  RiPercentLine,
  RiBarChartLine,
  RiTrophyLine,
  RiBriefcaseLine,
  RiBuildingLine,
  RiInformationLine,
  RiFileCopyLine,
  RiStarLine,
  RiArrowRightLine,
  RiDashboardLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiLoader2Line,
  RiHistoryLine,
  RiAddLine,
  RiDeleteBinLine
} from '@remixicon/react';
import {
  Card,
  Metric,
  Text,
  Flex,
  ProgressBar,
  Badge,
  Grid,
  Button,
  TextInput,
  Textarea,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  AreaChart,
  BarList,
  List,
  ListItem,
  Callout,
  Divider,
  Title,
  Subtitle,
  Bold,
  Italic,
  Dialog,
  DialogPanel,
  ProgressCircle,
  CategoryBar,
  DonutChart
} from '@tremor/react';
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

const ModernResumePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTab, setSelectedTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedResume, setUploadedResume] = useState<ResumeUpload | null>(null);
  const [resumeText, setResumeText] = useState<string>('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [generatedResume, setGeneratedResume] = useState<GenerateResponse | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<ResumeAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ResumeAnalysis | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

  // Key metrics for display
  const [metrics, setMetrics] = useState({
    totalAnalyses: 0,
    averageScore: 0,
    improvementRate: 0,
    successRate: 0
  });

  useEffect(() => {
    if (user) {
      loadSavedAnalyses();
      calculateMetrics();
    }
  }, [user]);

  const loadSavedAnalyses = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('resume_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedAnalyses(data || []);
    } catch (error) {
      console.error('Error loading analyses:', error);
    }
  };

  const calculateMetrics = async () => {
    if (!user || savedAnalyses.length === 0) return;

    const totalAnalyses = savedAnalyses.length;
    const scores = savedAnalyses
      .filter(a => a.analysis_result?.ats_score)
      .map(a => a.analysis_result.ats_score);
    
    const averageScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;

    const improvementRate = scores.length > 1 
      ? ((scores[0] - scores[scores.length - 1]) / scores[scores.length - 1]) * 100
      : 0;

    const successRate = scores.filter(s => s >= 70).length / scores.length * 100;

    setMetrics({
      totalAnalyses,
      averageScore,
      improvementRate,
      successRate
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateResumeFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Invalid file');
        return;
      }
      setSelectedFile(file);
      handleUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const validation = validateResumeFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Invalid file');
        return;
      }
      setSelectedFile(file);
      handleUpload(file);
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) {
      toast.error('Please sign in to upload resumes');
      return;
    }

    setUploading(true);
    
    try {
      // Extract text from PDF
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `resumes/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resume-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Save to database
      const { data: resumeData, error: dbError } = await supabase
        .from('resume_uploads')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_url: filePath,
          file_size: file.size
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadedResume(resumeData);
      toast.success('Resume uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!user || !resumeText) {
      toast.error('Please upload a resume first');
      return;
    }

    // Check usage limits
    const canProceed = await canPerformAction(user.id, 'resume_optimization');
    if (!canProceed.allowed) {
      toast.error(canProceed.reason || 'Usage limit reached');
      return;
    }

    setAnalyzing(true);
    
    try {
      const apiToken = await getApiToken();
      if (!apiToken) {
        throw new Error('Failed to get API token');
      }

      const result = await analyzeResume(
        resumeText,
        jobTitle || undefined,
        companyName || undefined,
        jobDescription || undefined
      );

      setAnalysisResult(result);

      // Track token usage
      await trackAITokenUsage(user.id, 'resume_optimization', {
        job_title: jobTitle,
        company_name: companyName
      });

      // Save analysis to database
      const { error: saveError } = await supabase
        .from('resume_analyses')
        .insert({
          user_id: user.id,
          resume_text: resumeText,
          job_title: jobTitle,
          company_name: companyName,
          job_description: jobDescription,
          analysis_result: result,
          analysis_id: result.analysis_id
        });

      if (saveError) {
        console.error('Error saving analysis:', saveError);
      }

      await loadSavedAnalyses();
      toast.success('Resume analyzed successfully!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze resume');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysisResult?.analysis_id) {
      toast.error('Please analyze your resume first');
      return;
    }

    setGenerating(true);
    
    try {
      const result = await generateOptimizedResume(analysisResult.analysis_id);
      setGeneratedResume(result);
      toast.success('Optimized resume generated!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate optimized resume');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedResume?.resume_url) {
      toast.error('No resume to download');
      return;
    }

    try {
      await downloadResume(generatedResume.resume_url);
      toast.success('Resume downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download resume');
    }
  };

  return (
    <>
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          Resume Optimization Center
        </h1>
        <p className="mt-2 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          AI-powered resume analysis and optimization to increase your job search success
        </p>
      </div>

      {/* Key Metrics */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-8">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Total Analyses</Text>
              <Metric className="mt-2">{metrics.totalAnalyses}</Metric>
              <Text className="mt-2 text-tremor-default">
                Resume optimizations
              </Text>
            </div>
            <Badge icon={RiFileTextLine} color="blue">
              Active
            </Badge>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="green">
          <Flex alignItems="start">
            <div>
              <Text>Average ATS Score</Text>
              <Metric className="mt-2">{metrics.averageScore.toFixed(0)}%</Metric>
              <Text className="mt-2 text-tremor-default">
                Industry avg: 65%
              </Text>
            </div>
            <Badge icon={RiTrophyLine} color="green">
              {metrics.averageScore > 65 ? 'Above Avg' : 'Below Avg'}
            </Badge>
          </Flex>
          <ProgressBar value={metrics.averageScore} className="mt-3" color="green" />
        </Card>

        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <div>
              <Text>Improvement Rate</Text>
              <Metric className="mt-2">
                {metrics.improvementRate > 0 ? '+' : ''}{metrics.improvementRate.toFixed(1)}%
              </Metric>
              <Text className="mt-2 text-tremor-default">
                Score change
              </Text>
            </div>
            <Badge icon={RiBarChartLine} color="amber">
              {metrics.improvementRate > 0 ? 'Improving' : 'Stable'}
            </Badge>
          </Flex>
          <ProgressBar value={Math.abs(metrics.improvementRate)} className="mt-3" color="amber" />
        </Card>

        <Card decoration="top" decorationColor="purple">
          <Flex alignItems="start">
            <div>
              <Text>Success Rate</Text>
              <Metric className="mt-2">{metrics.successRate.toFixed(0)}%</Metric>
              <Text className="mt-2 text-tremor-default">
                Scores ≥70%
              </Text>
            </div>
            <Badge icon={RiCheckboxCircleLine} color="purple">
              Quality
            </Badge>
          </Flex>
          <ProgressBar value={metrics.successRate} className="mt-3" color="purple" />
        </Card>
      </Grid>

      {/* Main Content Tabs */}
      <TabGroup defaultIndex={0} onIndexChange={setSelectedTab}>
        <TabList className="mb-6">
          <Tab icon={RiUploadLine}>Upload & Analyze</Tab>
          <Tab icon={RiHistoryLine}>History</Tab>
          <Tab icon={RiMagicLine}>Generated Resumes</Tab>
          <Tab icon={RiLightbulbLine}>Insights</Tab>
        </TabList>

        <TabPanels>
          {/* Upload & Analyze Tab */}
          <TabPanel>
            <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
              {/* Upload Section */}
              <Card>
                <div className="mb-4">
                  <Title>Upload Resume</Title>
                  <Text className="mt-1">Upload your resume for AI analysis</Text>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? 'border-tremor-brand bg-tremor-brand/5' 
                      : 'border-tremor-border dark:border-dark-tremor-border'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle rounded-full">
                      <RiUploadLine className="w-8 h-8 text-tremor-content dark:text-dark-tremor-content" />
                    </div>
                    
                    {selectedFile ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <RiFileTextLine className="w-5 h-5 text-green-600" />
                          <Text className="font-medium">{selectedFile.name}</Text>
                        </div>
                        <Text className="text-tremor-label">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text className="font-medium">
                          Drag and drop your resume here
                        </Text>
                        <Text className="text-tremor-label">
                          or click to browse (PDF only, max 5MB)
                        </Text>
                      </>
                    )}
                    
                    <Button
                      icon={RiUploadLine}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Uploading...' : 'Select File'}
                    </Button>
                  </div>
                </div>

                {resumeText && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <RiCheckLine className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <Text className="font-medium text-green-700 dark:text-green-400">
                        Resume uploaded successfully
                      </Text>
                    </div>
                    <Text className="mt-1 text-tremor-label">
                      {resumeText.split(' ').length} words extracted
                    </Text>
                  </div>
                )}
              </Card>

              {/* Job Details Section */}
              <Card>
                <div className="mb-4">
                  <Title>Job Details (Optional)</Title>
                  <Text className="mt-1">Provide job details for targeted optimization</Text>
                </div>

                <div className="space-y-4">
                  <div>
                    <Text className="mb-2">Job Title</Text>
                    <TextInput
                      placeholder="e.g., Senior Software Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      icon={RiBriefcaseLine}
                    />
                  </div>

                  <div>
                    <Text className="mb-2">Company Name</Text>
                    <TextInput
                      placeholder="e.g., Google"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      icon={RiBuildingLine}
                    />
                  </div>

                  <div>
                    <Text className="mb-2">Job Description</Text>
                    <textarea
                      className="w-full px-3 py-2 text-tremor-default border border-tremor-border rounded-tremor-default focus:outline-none focus:ring-2 focus:ring-tremor-brand dark:bg-dark-tremor-background dark:border-dark-tremor-border"
                      rows={6}
                      placeholder="Paste the job description here..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  </div>

                  <Divider />

                  <div className="flex space-x-3">
                    <Button
                      icon={RiSparklingLine}
                      size="lg"
                      onClick={handleAnalyze}
                      disabled={!resumeText || analyzing}
                      className="flex-1"
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Resume'}
                    </Button>
                    
                    {analysisResult && (
                      <Button
                        icon={RiMagicLine}
                        size="lg"
                        variant="secondary"
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex-1"
                      >
                        {generating ? 'Generating...' : 'Generate Optimized'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </Grid>

            {/* Analysis Results */}
            {analysisResult && (
              <Card className="mt-6">
                <div className="mb-4">
                  <Title>Analysis Results</Title>
                  <Text className="mt-1">AI-powered insights and recommendations</Text>
                </div>

                <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-6">
                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <Text>ATS Score</Text>
                        <div className="flex items-center space-x-2 mt-2">
                          <Metric>{analysisResult.ats_score}%</Metric>
                          <Badge color={analysisResult.ats_score >= 70 ? 'green' : 'amber'}>
                            {analysisResult.ats_score >= 70 ? 'Good' : 'Needs Work'}
                          </Badge>
                        </div>
                      </div>
                      <ProgressCircle 
                        value={analysisResult.ats_score} 
                        size="md"
                        color={analysisResult.ats_score >= 70 ? 'green' : 'amber'}
                      />
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <Text>Keywords Found</Text>
                        <Metric className="mt-2">
                          {analysisResult.keywords?.length || 0}
                        </Metric>
                      </div>
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <RiCheckLine className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <Text>Improvements</Text>
                        <Metric className="mt-2">
                          {analysisResult.improvements?.length || 0}
                        </Metric>
                      </div>
                      <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <RiLightbulbLine className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                  </Card>
                </Grid>

                {/* Detailed Feedback */}
                <div className="space-y-4">
                  {analysisResult.improvements && analysisResult.improvements.length > 0 && (
                    <div>
                      <Text className="font-semibold mb-3">Recommended Improvements</Text>
                      <div className="space-y-2">
                        {analysisResult.improvements.map((improvement, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <RiLightbulbLine className="w-4 h-4 text-amber-600 mt-0.5" />
                            <Text className="text-tremor-default">{improvement}</Text>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisResult.keywords && analysisResult.keywords.length > 0 && (
                    <div>
                      <Text className="font-semibold mb-3">Keywords Detected</Text>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.keywords.map((keyword, idx) => (
                          <Badge key={idx} color="blue">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {generatedResume && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <RiCheckLine className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <Text className="font-semibold">Optimized Resume Ready</Text>
                          <Text className="text-tremor-label">Your enhanced resume is ready to download</Text>
                        </div>
                      </div>
                      <Button
                        icon={RiDownloadLine}
                        onClick={handleDownload}
                        color="green"
                      >
                        Download Resume
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </TabPanel>

          {/* History Tab */}
          <TabPanel>
            <Card>
              <div className="mb-4">
                <Title>Analysis History</Title>
                <Text className="mt-1">View and manage your previous resume analyses</Text>
              </div>

              <List>
                {savedAnalyses.map((analysis) => (
                  <ListItem key={analysis.id}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle rounded-lg">
                          <RiFileTextLine className="w-5 h-5 text-tremor-content dark:text-dark-tremor-content" />
                        </div>
                        <div>
                          <Text className="font-medium">
                            {analysis.job_title || 'General Resume Analysis'}
                          </Text>
                          <Text className="text-tremor-label">
                            {new Date(analysis.created_at).toLocaleDateString()} • 
                            {analysis.company_name && ` ${analysis.company_name} • `}
                            Score: {analysis.analysis_result?.ats_score || 'N/A'}%
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge color={
                          analysis.analysis_result?.ats_score >= 70 ? 'green' : 
                          analysis.analysis_result?.ats_score >= 50 ? 'amber' : 
                          'red'
                        }>
                          {analysis.analysis_result?.ats_score || 0}%
                        </Badge>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={RiEyeLine}
                          onClick={() => {
                            setSelectedAnalysis(analysis);
                            setShowAnalysisDialog(true);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </ListItem>
                ))}
                {savedAnalyses.length === 0 && (
                  <div className="text-center py-8">
                    <Text className="text-tremor-content dark:text-dark-tremor-content">
                      No analyses yet. Upload your resume to get started!
                    </Text>
                  </div>
                )}
              </List>
            </Card>
          </TabPanel>

          {/* Generated Resumes Tab */}
          <TabPanel>
            <Card>
              <div className="mb-4">
                <Title>Generated Resumes</Title>
                <Text className="mt-1">Download your AI-optimized resumes</Text>
              </div>

              <Callout title="Coming Soon" icon={RiInformationLine} color="blue">
                Your generated resumes will appear here. Generate your first optimized resume from the Upload & Analyze tab.
              </Callout>
            </Card>
          </TabPanel>

          {/* Insights Tab */}
          <TabPanel>
            <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
              <Card>
                <Title>Score Trends</Title>
                <Text>Your ATS score improvement over time</Text>
                <AreaChart
                  className="h-72 mt-4"
                  data={savedAnalyses.map(a => ({
                    date: new Date(a.created_at).toLocaleDateString(),
                    Score: a.analysis_result?.ats_score || 0
                  }))}
                  index="date"
                  categories={["Score"]}
                  colors={["blue"]}
                  showLegend={false}
                  showGridLines={false}
                  yAxisWidth={40}
                />
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

              <Card className="lg:col-span-2">
                <Title>Optimization Tips</Title>
                <Text>Expert recommendations to improve your resume</Text>
                
                <div className="mt-4 space-y-3">
                  <Callout title="Use Action Verbs" icon={RiLightbulbLine} color="blue">
                    Start bullet points with strong action verbs like "Led", "Developed", "Implemented", or "Achieved"
                  </Callout>
                  <Callout title="Quantify Achievements" icon={RiBarChartLine} color="green">
                    Include numbers and metrics to demonstrate impact (e.g., "Increased sales by 30%")
                  </Callout>
                  <Callout title="Match Keywords" icon={RiCheckLine} color="amber">
                    Tailor your resume to include keywords from the job description
                  </Callout>
                </div>
              </Card>
            </Grid>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Analysis Detail Dialog */}
      <Dialog
        open={showAnalysisDialog}
        onClose={() => setShowAnalysisDialog(false)}
        static={true}
        className="z-[100]"
      >
        <DialogPanel className="max-w-3xl">
          {selectedAnalysis && (
            <>
              <div className="mb-4">
                <Title>Analysis Details</Title>
                <Text>{new Date(selectedAnalysis.created_at).toLocaleString()}</Text>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Text className="font-semibold">Job Details</Text>
                  <div className="mt-2 space-y-1">
                    <Text>Title: {selectedAnalysis.job_title || 'Not specified'}</Text>
                    <Text>Company: {selectedAnalysis.company_name || 'Not specified'}</Text>
                  </div>
                </div>

                {selectedAnalysis.analysis_result && (
                  <>
                    <div>
                      <Text className="font-semibold">ATS Score</Text>
                      <div className="flex items-center space-x-3 mt-2">
                        <Metric>{selectedAnalysis.analysis_result.ats_score}%</Metric>
                        <Badge color={selectedAnalysis.analysis_result.ats_score >= 70 ? 'green' : 'amber'}>
                          {selectedAnalysis.analysis_result.ats_score >= 70 ? 'Good' : 'Needs Improvement'}
                        </Badge>
                      </div>
                    </div>

                    {selectedAnalysis.analysis_result.improvements && (
                      <div>
                        <Text className="font-semibold">Recommendations</Text>
                        <List className="mt-2">
                          {selectedAnalysis.analysis_result.improvements.map((item: string, idx: number) => (
                            <ListItem key={idx}>
                              <Text>{item}</Text>
                            </ListItem>
                          ))}
                        </List>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowAnalysisDialog(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogPanel>
      </Dialog>
    </>
  );
};

export default ModernResumePage;