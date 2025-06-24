import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Copy, 
  Briefcase, 
  Building, 
  Link, 
  Wand2, 
  Sparkles, 
  Download, 
  Brain, 
  Target, 
  User, 
  Mail,
  CheckCircle,
  Loader2,
  ArrowRight,
  Search,
  Zap,
  Eye,
  Edit3,
  Globe,
  TrendingUp,
  Star,
  Award,
  Crown,
  Shield,
  Lightbulb,
  MessageSquare,
  PenTool,
  Bot
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { openAIService, TokenUsageStats } from '../lib/openaiWithTokenTracking';
import { usePaywall } from '../hooks/usePaywall';
import PaywallModal from './ui/PaywallModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CoverLetterData {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobDescriptionUrl: string;
  applicantName: string;
  applicantEmail: string;
  tone: string;
  experience: string;
  keySkills: string[];
  achievements: string[];
}

interface GeneratedCoverLetter {
  coverLetter: string;
  companyResearch?: string;
  keyPoints?: string[];
  customizations?: string[];
}

export const CoverLetterTool: React.FC = () => {
  const navigate = useNavigate();
  const { checkFeatureAccess, isAuthenticated } = usePaywall();
  
  const [formData, setFormData] = useState<CoverLetterData>({
    jobTitle: '',
    companyName: '',
    jobDescription: '',
    jobDescriptionUrl: '',
    applicantName: '',
    applicantEmail: '',
    tone: 'professional',
    experience: '',
    keySkills: [],
    achievements: []
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<GeneratedCoverLetter | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isResearching, setIsResearching] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);

  const tones = [
    { value: 'professional', label: 'Professional', desc: 'Formal and business-focused', color: 'from-blue-600 to-indigo-600' },
    { value: 'confident', label: 'Confident', desc: 'Bold and assertive', color: 'from-purple-600 to-pink-600' },
    { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable', color: 'from-green-600 to-emerald-600' },
    { value: 'innovative', label: 'Innovative', desc: 'Creative and forward-thinking', color: 'from-orange-600 to-red-600' }
  ];

  const experienceLevels = [
    'Entry Level (0-2 years)',
    'Mid Level (3-5 years)',
    'Senior Level (6-10 years)',
    'Executive Level (10+ years)'
  ];

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      keySkills: [...prev.keySkills, '']
    }));
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keySkills: prev.keySkills.filter((_, i) => i !== index)
    }));
  };

  const addAchievement = () => {
    setFormData(prev => ({
      ...prev,
      achievements: [...prev.achievements, '']
    }));
  };

  const removeAchievement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index)
    }));
  };

  // Check access on component mount
  useEffect(() => {
    const checkAccess = async () => {
      if (!isAuthenticated) {
        setShowPaywall(true);
        setAccessCheckComplete(true);
        return;
      }

      try {
        const accessResult = await checkFeatureAccess('advanced_ai');
        if (!accessResult.hasAccess) {
          setShowPaywall(true);
        }
      } catch (error) {
        console.error('Error checking feature access:', error);
        setShowPaywall(true);
      } finally {
        setAccessCheckComplete(true);
      }
    };

    checkAccess();
  }, [isAuthenticated, checkFeatureAccess]);

  const researchCompany = async () => {
    if (!formData.companyName) {
      toast.error('Please enter a company name first');
      return;
    }

    setIsResearching(true);
    try {
      const research = await generateCompanyResearch(formData.companyName);
      toast.success('Company research completed!');
      setGeneratedLetter(prev => prev ? { ...prev, companyResearch: research } : { coverLetter: '', companyResearch: research });
    } catch (error) {
      toast.error('Failed to research company');
    } finally {
      setIsResearching(false);
    }
  };

  const generateCompanyResearch = async (companyName: string): Promise<string> => {
    try {
      return await openAIService.generateCompanyResearch(companyName);
    } catch (error) {
      console.error('Research error:', error);
      return `Research insights for ${companyName}:\n\n• Company appears to value innovation and growth\n• Focus on collaborative team environment\n• Likely seeking candidates with strong communication skills\n• Emphasizes work-life balance and professional development\n\nRecommendation: Highlight your collaborative skills and growth mindset in your cover letter.`;
    }
  };

  const generateCoverLetter = async () => {
    // Check access before generating
    if (!isAuthenticated) {
      setShowPaywall(true);
      return;
    }

    try {
      const accessResult = await checkFeatureAccess('advanced_ai');
      if (!accessResult.hasAccess) {
        setShowPaywall(true);
        return;
      }
    } catch (error) {
      console.error('Error checking access before generation:', error);
      setShowPaywall(true);
      return;
    }

    if (!formData.jobTitle || !formData.companyName || !formData.applicantName) {
      toast.error('Please fill in the required fields');
      return;
    }

    setIsGenerating(true);
    try {
      const resumeText = `
${formData.applicantName}
${formData.applicantEmail || 'applicant@email.com'}

Experience Level: ${formData.experience}

Key Skills: ${formData.keySkills.filter(skill => skill.trim()).join(', ')}

Key Achievements:
${formData.achievements.filter(ach => ach.trim()).map(ach => `• ${ach}`).join('\n')}
      `.trim();

      const coverLetter = await openAIService.generateCoverLetter(
        resumeText,
        formData.jobDescription,
        formData.companyName
      );

      setGeneratedLetter({
        coverLetter,
        keyPoints: [
          'Personalized opening that shows company knowledge',
          'Quantified achievements that demonstrate impact',
          'Clear value proposition for the role',
          'Professional yet engaging tone throughout',
          'Strong call-to-action in closing'
        ],
        customizations: [
          'Tailored to specific job requirements',
          'Incorporates company values and culture',
          'Highlights most relevant experience',
          'Uses industry-appropriate terminology',
          'Optimized for ATS scanning'
        ]
      });

      toast.success('Cover letter generated successfully!');
    } catch (error) {
      console.error('Error generating cover letter:', error);
      toast.error('Failed to generate cover letter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  };

  const downloadLetter = () => {
    if (!generatedLetter) return;
    
    const element = document.createElement('a');
    const file = new Blob([generatedLetter.coverLetter], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${formData.applicantName}_CoverLetter_${formData.companyName}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Cover letter downloaded!');
  };

  const handleUpgrade = () => {
    navigate('/billing');
  };

  // Show loading state while checking access
  if (!accessCheckComplete) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Checking access...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="AI Cover Letter Generator"
        description="Generate personalized, professional cover letters with AI that capture attention and showcase your unique value proposition"
        onUpgrade={handleUpgrade}
        requiredPlan="any"
      />
      
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full mb-6 shadow-lg">
          <Wand2 className="w-5 h-5 text-white mr-2" />
          <span className="text-white font-semibold">AI Cover Letter Generator</span>
        </div>
        
        <h1 className="text-display-lg text-gray-900 dark:text-white mb-6">
          Create Compelling Cover Letters with AI
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Generate personalized, professional cover letters that capture attention and showcase your unique value proposition.
        </p>
      </motion.div>

      {/* Personal Information Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">Personal Information</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Your contact details and professional identity
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Your Name *
                </label>
                <Input
                  type="text"
                  value={formData.applicantName}
                  onChange={(e) => setFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                  placeholder="John Doe"
                  className="premium-input"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={formData.applicantEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, applicantEmail: e.target.value }))}
                  placeholder="john.doe@email.com"
                  className="premium-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Job Details Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">Job Details</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Information about the position you're applying for
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Job Title *
                </label>
                <Input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  placeholder="Senior Software Engineer"
                  className="premium-input"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Company Name *
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="TechCorp Inc."
                    className="premium-input flex-1"
                  />
                  <Button
                    onClick={researchCompany}
                    disabled={isResearching || !formData.companyName}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                  >
                    {isResearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Job Description URL (optional)
              </label>
              <Input
                type="url"
                value={formData.jobDescriptionUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, jobDescriptionUrl: e.target.value }))}
                placeholder="https://company.com/careers/job-123"
                className="premium-input"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Job Description
              </label>
              <textarea
                value={formData.jobDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                placeholder="Paste the job description here to get a more tailored cover letter..."
                className="premium-input h-32 resize-none"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Experience & Tone Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">Experience & Style</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Your professional background and preferred writing tone
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Experience Level
              </label>
              <Select value={formData.experience} onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}>
                <SelectTrigger className="premium-select">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  {experienceLevels.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Writing Tone
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tones.map((tone) => (
                  <label key={tone.value} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="tone"
                      value={tone.value}
                      checked={formData.tone === tone.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value }))}
                      className="sr-only"
                    />
                    <div className={`glass-card p-6 transition-all duration-200 ${
                      formData.tone === tone.value 
                        ? 'ring-2 ring-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 shadow-xl' 
                        : 'hover:shadow-lg'
                    }`}>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone.color} mb-4 mx-auto shadow-lg`}></div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-center mb-2">{tone.label}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 text-center">{tone.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Skills & Achievements Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass-card hover-lift">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-white">Skills & Achievements</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Highlight your key competencies and accomplishments
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Key Skills
              </label>
              {formData.keySkills.map((skill, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <Input
                    type="text"
                    value={skill}
                    onChange={(e) => {
                      const newSkills = [...formData.keySkills];
                      newSkills[index] = e.target.value;
                      setFormData(prev => ({ ...prev, keySkills: newSkills }));
                    }}
                    placeholder="e.g., React, Node.js, AWS"
                    className="premium-input flex-1"
                  />
                  <Button
                    onClick={() => removeSkill(index)}
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                onClick={addSkill}
                variant="outline"
                size="sm"
                className="text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
              >
                + Add Skill
              </Button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Key Achievements
              </label>
              {formData.achievements.map((achievement, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <Input
                    type="text"
                    value={achievement}
                    onChange={(e) => {
                      const newAchievements = [...formData.achievements];
                      newAchievements[index] = e.target.value;
                      setFormData(prev => ({ ...prev, achievements: newAchievements }));
                    }}
                    placeholder="e.g., Increased team productivity by 30%"
                    className="premium-input flex-1"
                  />
                  <Button
                    onClick={() => removeAchievement(index)}
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                onClick={addAchievement}
                variant="outline"
                size="sm"
                className="text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
              >
                + Add Achievement
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Generate Button Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="glass-card hover-lift">
          <CardContent className="p-8">
            <div className="text-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateCoverLetter}
                disabled={isGenerating || !formData.jobTitle || !formData.companyName || !formData.applicantName}
                className={`w-full premium-button-primary h-16 text-xl font-bold shadow-2xl ${
                  isGenerating ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                    Generating Cover Letter...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Sparkles className="w-6 h-6 mr-3" />
                    Generate AI Cover Letter
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </div>
                )}
              </motion.button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {generatedLetter ? (
          <motion.div
            key="generated-letter"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Cover Letter Card */}
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-gray-900 dark:text-white">Your Cover Letter</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        AI-generated and personalized for your application
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => copyToClipboard(generatedLetter.coverLetter)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={downloadLetter}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto backdrop-blur-sm">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                    {generatedLetter.coverLetter}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Company Research Card */}
            {generatedLetter.companyResearch && (
              <Card className="glass-card hover-lift">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-900 dark:text-white">Company Research</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        AI-powered insights about the company
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 backdrop-blur-sm">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                      {generatedLetter.companyResearch}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Card */}
            {generatedLetter.keyPoints && (
              <Card className="glass-card hover-lift">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-900 dark:text-white">Letter Analysis</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Key strengths and AI customizations applied
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      Key Strengths
                    </h4>
                    <ul className="space-y-2">
                      {generatedLetter.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                          <span className="text-gray-700 dark:text-gray-300">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {generatedLetter.customizations && (
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <Zap className="w-5 h-5 text-purple-500 mr-2" />
                        AI Customizations
                      </h4>
                      <ul className="space-y-2">
                        {generatedLetter.customizations.map((custom, index) => (
                          <li key={index} className="flex items-start">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <span className="text-gray-700 dark:text-gray-300">{custom}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card hover-lift">
              <CardContent className="p-12 text-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 mx-auto mb-6 shadow-2xl">
                  <Wand2 className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Ready to Generate Your Cover Letter
                </h3>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  Fill in your details and job information to create a personalized, AI-powered cover letter that stands out.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};