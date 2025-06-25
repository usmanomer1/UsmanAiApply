import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  User, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Code, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Plus, 
  Minus, 
  Download, 
  Eye, 
  Sparkles, 
  Brain, 
  Palette, 
  Layout, 
  CheckCircle, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  Building,
  Languages,
  Target,
  ArrowRight,
  Crown,
  Shield,
  Lightbulb,
  PenTool,
  Zap,
  X,
  Copy,
  Bot
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { openAIService } from '../lib/openaiWithTokenTracking';
import { usePaywall } from '../hooks/usePaywall';
import PaywallModal from './ui/PaywallModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import ConditionalBackground from './ui/ConditionalBackground';

interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedIn: string;
  summary: string;
}

interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrentRole: boolean;
  description: string;
  achievements: string[];
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  graduationDate: string;
  gpa?: string;
  honors?: string;
}

interface Skill {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  category: string;
}

interface CVData {
  personalInfo: PersonalInfo;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  languages: { name: string; proficiency: string }[];
  certifications: { name: string; issuer: string; date: string }[];
  projects: { name: string; description: string; technologies: string[] }[];
  targetRole: string;
  industry: string;
}

type Step = 'personal' | 'experience' | 'education' | 'skills' | 'template' | 'preview';
type Template = 'modern' | 'classic' | 'creative' | 'tech' | 'executive';

const templates = {
  modern: {
    name: 'Modern Professional',
    description: 'Clean, contemporary design perfect for most industries',
    color: 'from-blue-600 to-indigo-600',
    preview: '🎯'
  },
  classic: {
    name: 'Classic Elegance',
    description: 'Traditional, refined layout for conservative fields',
    color: 'from-gray-600 to-slate-600',
    preview: '📋'
  },
  creative: {
    name: 'Creative Edge',
    description: 'Bold, innovative design for creative professionals',
    color: 'from-purple-600 to-pink-600',
    preview: '🎨'
  },
  tech: {
    name: 'Tech Focused',
    description: 'Minimalist, code-inspired layout for tech roles',
    color: 'from-emerald-600 to-teal-600',
    preview: '💻'
  },
  executive: {
    name: 'Executive Suite',
    description: 'Sophisticated, premium design for leadership roles',
    color: 'from-amber-600 to-orange-600',
    preview: '👑'
  }
};

export const CVGeneration: React.FC = () => {
  const navigate = useNavigate();
  const { checkFeatureAccess, isAuthenticated } = usePaywall();
  
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('modern');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCV, setGeneratedCV] = useState<string>('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  
  const [cvData, setCvData] = useState<CVData>({
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedIn: '',
      summary: ''
    },
    experiences: [{
      id: '1',
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      isCurrentRole: false,
      description: '',
      achievements: ['']
    }],
    education: [{
      id: '1',
      institution: '',
      degree: '',
      field: '',
      graduationDate: '',
      gpa: '',
      honors: ''
    }],
    skills: [{
      id: '1',
      name: '',
      level: 'Intermediate',
      category: 'Technical'
    }],
    languages: [{ name: '', proficiency: 'Native' }],
    certifications: [{ name: '', issuer: '', date: '' }],
    projects: [{ name: '', description: '', technologies: [''] }],
    targetRole: '',
    industry: ''
  });

  const steps = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'skills', label: 'Skills & More', icon: Award },
    { id: 'template', label: 'Template', icon: Palette },
    { id: 'preview', label: 'Generate CV', icon: FileText }
  ];

  const addExperience = () => {
    setCvData(prev => ({
      ...prev,
      experiences: [...prev.experiences, {
        id: Date.now().toString(),
        company: '',
        position: '',
        startDate: '',
        endDate: '',
        isCurrentRole: false,
        description: '',
        achievements: ['']
      }]
    }));
  };

  const removeExperience = (id: string) => {
    setCvData(prev => ({
      ...prev,
      experiences: prev.experiences.filter(exp => exp.id !== id)
    }));
  };

  const addEducation = () => {
    setCvData(prev => ({
      ...prev,
      education: [...prev.education, {
        id: Date.now().toString(),
        institution: '',
        degree: '',
        field: '',
        graduationDate: '',
        gpa: '',
        honors: ''
      }]
    }));
  };

  const addSkill = () => {
    setCvData(prev => ({
      ...prev,
      skills: [...prev.skills, {
        id: Date.now().toString(),
        name: '',
        level: 'Intermediate',
        category: 'Technical'
      }]
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

  const generateCV = async () => {
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

    if (!cvData.personalInfo.fullName || !cvData.targetRole || !cvData.industry) {
      toast.error('Please fill in your name, target role, and industry');
      return;
    }

    setIsGenerating(true);
    try {
      const resumeText = `
${cvData.personalInfo.fullName}
${cvData.personalInfo.email} | ${cvData.personalInfo.phone} | ${cvData.personalInfo.location}
${cvData.personalInfo.website ? 'Website: ' + cvData.personalInfo.website : ''}
${cvData.personalInfo.linkedIn ? 'LinkedIn: ' + cvData.personalInfo.linkedIn : ''}

PROFESSIONAL SUMMARY
${cvData.personalInfo.summary}

PROFESSIONAL EXPERIENCE
${cvData.experiences.map(exp => `
${exp.position} at ${exp.company}
${exp.startDate} - ${exp.isCurrentRole ? 'Present' : exp.endDate}
${exp.description}
Achievements:
${exp.achievements.map(achievement => `• ${achievement}`).join('\n')}
`).join('\n')}

EDUCATION
${cvData.education.map(edu => `
${edu.degree} in ${edu.field}
${edu.institution} - ${edu.graduationDate}
${edu.gpa ? 'GPA: ' + edu.gpa : ''}
${edu.honors ? 'Honors: ' + edu.honors : ''}
`).join('\n')}

SKILLS
${cvData.skills.map(skill => `• ${skill.name} (${skill.level})`).join('\n')}

${cvData.languages.length > 0 ? 'LANGUAGES\n' + cvData.languages.map(lang => `• ${lang.name} (${lang.proficiency})`).join('\n') : ''}

${cvData.certifications.filter(cert => cert.name).length > 0 ? 'CERTIFICATIONS\n' + cvData.certifications.filter(cert => cert.name).map(cert => `• ${cert.name} - ${cert.issuer} (${cert.date})`).join('\n') : ''}

${cvData.projects.filter(proj => proj.name).length > 0 ? 'PROJECTS\n' + cvData.projects.filter(proj => proj.name).map(proj => `• ${proj.name}: ${proj.description}\nTechnologies: ${proj.technologies.join(', ')}`).join('\n') : ''}
      `;

      const result = await openAIService.rewriteResume({
        resumeText,
        industry: cvData.industry,
        experienceLevel: cvData.experiences.length > 0 ? 'Mid Level (3-5 years)' : 'Entry Level (0-2 years)',
        targetRole: cvData.targetRole
      });

      setGeneratedCV(result.improvedResume);
      toast.success('CV generated successfully!');
      setCurrentStep('preview');
    } catch (error) {
      console.error('Error generating CV:', error);
      toast.error('Failed to generate CV. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCV = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedCV], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${cvData.personalInfo.fullName}_CV.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('CV downloaded successfully!');
  };

  const nextStep = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as Step);
    }
  };

  const prevStep = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as Step);
    }
  };

  const handleUpgrade = () => {
    navigate('/billing');
  };

  // Show loading state while checking access
  if (!accessCheckComplete) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Checking access...</span>
        </div>
      </div>
    );
  }

  return (
    <>
              <ConditionalBackground className="fixed inset-0 z-0" animate={false} />
      <div className="relative min-h-screen space-y-8 z-10">
      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="AI CV Generation"
        description="Create professional, ATS-optimized CVs with AI that are tailored to your industry and role"
        onUpgrade={handleUpgrade}
        requiredPlan="any"
      />
      
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full mb-6 shadow-lg">
          <Brain className="w-5 h-5 text-white mr-2" />
          <span className="text-white font-semibold">AI CV Generation</span>
        </div>
        
        <h1 className="text-display-lg text-gray-900 dark:text-white mb-6">
          Create Your Perfect CV with AI
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Build a professional, ATS-optimized CV tailored to your industry and role. 
          Our AI helps you craft compelling content that gets results.
        </p>
      </motion.div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-card hover-lift">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
                
                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div 
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                          isActive 
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white scale-110' 
                            : isCompleted
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                            : 'text-gray-400 backdrop-blur-sm'
                        }`}
                        style={!isActive && !isCompleted ? {
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                          backdropFilter: 'blur(10px) saturate(180%)'
                        } : {}}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>
                      <span className={`mt-2 text-sm font-medium ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 transition-colors ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {/* Personal Information Step */}
        {currentStep === 'personal' && (
          <motion.div
            key="personal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="glass-card hover-lift">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl text-gray-900 dark:text-white">Personal Information</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Let's start with your basic details and professional summary
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Full Name *
                    </label>
                    <Input
                      type="text"
                      value={cvData.personalInfo.fullName}
                      onChange={(e) => setCvData(prev => ({
                        ...prev,
                        personalInfo: { ...prev.personalInfo, fullName: e.target.value }
                      }))}
                      placeholder="John Doe"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Email Address *
                    </label>
                    <Input
                      type="email"
                      value={cvData.personalInfo.email}
                      onChange={(e) => setCvData(prev => ({
                        ...prev,
                        personalInfo: { ...prev.personalInfo, email: e.target.value }
                      }))}
                      placeholder="john.doe@email.com"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={cvData.personalInfo.phone}
                      onChange={(e) => setCvData(prev => ({
                        ...prev,
                        personalInfo: { ...prev.personalInfo, phone: e.target.value }
                      }))}
                      placeholder="(555) 123-4567"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Location
                    </label>
                    <Input
                      type="text"
                      value={cvData.personalInfo.location}
                      onChange={(e) => setCvData(prev => ({
                        ...prev,
                        personalInfo: { ...prev.personalInfo, location: e.target.value }
                      }))}
                      placeholder="San Francisco, CA"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Website/Portfolio
                    </label>
                    <Input
                      type="url"
                      value={cvData.personalInfo.website}
                      onChange={(e) => setCvData(prev => ({
                        ...prev,
                        personalInfo: { ...prev.personalInfo, website: e.target.value }
                      }))}
                      placeholder="https://johndoe.com"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      LinkedIn Profile
                    </label>
                    <Input
                      type="url"
                      value={cvData.personalInfo.linkedIn}
                      onChange={(e) => setCvData(prev => ({
                        ...prev,
                        personalInfo: { ...prev.personalInfo, linkedIn: e.target.value }
                      }))}
                      placeholder="https://linkedin.com/in/johndoe"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Target Role *
                    </label>
                    <Input
                      type="text"
                      value={cvData.targetRole}
                      onChange={(e) => setCvData(prev => ({ ...prev, targetRole: e.target.value }))}
                      placeholder="Senior Software Engineer"
                      className="premium-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Industry *
                    </label>
                    <Select value={cvData.industry} onValueChange={(value) => setCvData(prev => ({ ...prev, industry: value }))}>
                      <SelectTrigger className="premium-select">
                        <SelectValue placeholder="Select Industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="Retail">Retail</SelectItem>
                        <SelectItem value="Consulting">Consulting</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Professional Summary
                  </label>
                  <textarea
                    value={cvData.personalInfo.summary}
                    onChange={(e) => setCvData(prev => ({
                      ...prev,
                      personalInfo: { ...prev.personalInfo, summary: e.target.value }
                    }))}
                    placeholder="A brief summary of your professional experience, key skills, and career objectives..."
                    className="premium-input h-32 resize-none"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Write a compelling 2-3 sentence summary that highlights your expertise and value proposition
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Preview Step */}
        {currentStep === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {!generatedCV ? (
              <Card className="glass-card hover-lift">
                <CardContent className="p-12 text-center">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-6 mx-auto mb-6 shadow-2xl">
                    <Brain className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    Generate Your CV
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto leading-relaxed">
                    Ready to create your AI-optimized CV? Click the button below to generate your professional resume.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={generateCV}
                    disabled={isGenerating}
                    className={`premium-button-primary text-xl px-12 py-4 shadow-2xl ${
                      isGenerating ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {isGenerating ? (
                      <div className="flex items-center">
                        <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                        Generating CV with AI...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Sparkles className="w-6 h-6 mr-3" />
                        Generate AI-Optimized CV
                        <ArrowRight className="w-6 h-6 ml-3" />
                      </div>
                    )}
                  </motion.button>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card hover-lift">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl text-gray-900 dark:text-white">Your Generated CV</CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-300">
                          AI-optimized and ready for download
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={downloadCV}
                      className="premium-button-secondary"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download CV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border border-white/20 dark:border-white/10 rounded-xl p-8 max-h-96 overflow-y-auto backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                    backdropFilter: 'blur(15px) saturate(180%)'
                  }}>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                      {generatedCV}
                    </pre>
                  </div>

                  <div className="text-center mt-8">
                    <Button
                      onClick={() => {
                        setGeneratedCV('');
                        setCurrentStep('personal');
                      }}
                      variant="outline"
                    >
                      Create Another CV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Other steps would be implemented similarly... */}
      </AnimatePresence>

      {/* Navigation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass-card hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={prevStep}
                disabled={currentStep === 'personal'}
                className={`premium-button-secondary flex items-center ${
                  currentStep === 'personal' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </motion.button>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                Step {steps.findIndex(step => step.id === currentStep) + 1} of {steps.length}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={nextStep}
                disabled={currentStep === 'preview'}
                className={`premium-button-primary flex items-center ${
                  currentStep === 'preview' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </motion.button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </>
  );
};