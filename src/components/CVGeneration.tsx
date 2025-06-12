import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openAIService } from '../lib/openaiWithTokenTracking';

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
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('modern');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCV, setGeneratedCV] = useState<string>('');
  
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

  const generateCV = async () => {
    if (!cvData.personalInfo.fullName || !cvData.targetRole || !cvData.industry) {
      toast.error('Please fill in your name, target role, and industry');
      return;
    }

    setIsGenerating(true);
    try {
      // Create a comprehensive resume text from the CV data
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-emerald-400 to-blue-600 rounded-full opacity-20 blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full mb-6">
            <Brain className="w-5 h-5 text-white mr-2" />
            <span className="text-white font-semibold">AI CV Generation</span>
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6">
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
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg scale-110' 
                          : isCompleted
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <span className={`mt-2 text-sm font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
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
        </motion.div>

        {/* Main Content */}
        <div className="premium-card p-8">
          <AnimatePresence mode="wait">
            {/* Personal Information Step */}
            {currentStep === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    Personal Information
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Let's start with your basic details and professional summary
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Full Name *
                    </label>
                    <input
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Email Address *
                    </label>
                    <input
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Phone Number
                    </label>
                    <input
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Location
                    </label>
                    <input
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Website/Portfolio
                    </label>
                    <input
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      LinkedIn Profile
                    </label>
                    <input
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Target Role *
                    </label>
                    <input
                      type="text"
                      value={cvData.targetRole}
                      onChange={(e) => setCvData(prev => ({ ...prev, targetRole: e.target.value }))}
                      placeholder="Senior Software Engineer"
                      className="premium-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Industry *
                    </label>
                    <select
                      value={cvData.industry}
                      onChange={(e) => setCvData(prev => ({ ...prev, industry: e.target.value }))}
                      className="premium-select"
                    >
                      <option value="">Select Industry</option>
                      <option value="Technology">Technology</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Finance">Finance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="Education">Education</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Retail">Retail</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                  <p className="text-xs text-gray-500 mt-2">
                    Write a compelling 2-3 sentence summary that highlights your expertise and value proposition
                  </p>
                </div>
              </motion.div>
            )}

            {/* Experience Step */}
            {currentStep === 'experience' && (
              <motion.div
                key="experience"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    Work Experience
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Add your professional experience and key achievements
                  </p>
                </div>

                {cvData.experiences.map((experience, index) => (
                  <div key={experience.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 relative">
                    {cvData.experiences.length > 1 && (
                      <button
                        onClick={() => removeExperience(experience.id)}
                        className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Job Title
                        </label>
                        <input
                          type="text"
                          value={experience.position}
                          onChange={(e) => {
                            const updatedExperiences = [...cvData.experiences];
                            updatedExperiences[index].position = e.target.value;
                            setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                          }}
                          placeholder="Software Engineer"
                          className="premium-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Company
                        </label>
                        <input
                          type="text"
                          value={experience.company}
                          onChange={(e) => {
                            const updatedExperiences = [...cvData.experiences];
                            updatedExperiences[index].company = e.target.value;
                            setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                          }}
                          placeholder="Tech Corp Inc."
                          className="premium-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={experience.startDate}
                          onChange={(e) => {
                            const updatedExperiences = [...cvData.experiences];
                            updatedExperiences[index].startDate = e.target.value;
                            setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                          }}
                          className="premium-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          End Date
                        </label>
                        <div className="space-y-3">
                          <input
                            type="date"
                            value={experience.endDate}
                            onChange={(e) => {
                              const updatedExperiences = [...cvData.experiences];
                              updatedExperiences[index].endDate = e.target.value;
                              setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                            }}
                            disabled={experience.isCurrentRole}
                            className="premium-input"
                          />
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={experience.isCurrentRole}
                              onChange={(e) => {
                                const updatedExperiences = [...cvData.experiences];
                                updatedExperiences[index].isCurrentRole = e.target.checked;
                                setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-300">Current Role</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Job Description
                      </label>
                      <textarea
                        value={experience.description}
                        onChange={(e) => {
                          const updatedExperiences = [...cvData.experiences];
                          updatedExperiences[index].description = e.target.value;
                          setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                        }}
                        placeholder="Brief description of your role and responsibilities..."
                        className="premium-input h-24 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Key Achievements
                      </label>
                      {experience.achievements.map((achievement, achIndex) => (
                        <div key={achIndex} className="flex items-center space-x-3 mb-3">
                          <input
                            type="text"
                            value={achievement}
                            onChange={(e) => {
                              const updatedExperiences = [...cvData.experiences];
                              updatedExperiences[index].achievements[achIndex] = e.target.value;
                              setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                            }}
                            placeholder="Increased team productivity by 30%..."
                            className="premium-input flex-1"
                          />
                          {experience.achievements.length > 1 && (
                            <button
                              onClick={() => {
                                const updatedExperiences = [...cvData.experiences];
                                updatedExperiences[index].achievements.splice(achIndex, 1);
                                setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const updatedExperiences = [...cvData.experiences];
                          updatedExperiences[index].achievements.push('');
                          setCvData(prev => ({ ...prev, experiences: updatedExperiences }));
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Achievement
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addExperience}
                  className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Another Experience
                </button>
              </motion.div>
            )}

            {/* Similar sections for education, skills, template selection, and preview would follow... */}
            {/* For brevity, I'll add the navigation and preview sections */}

            {/* Preview Step */}
            {currentStep === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    Generate Your CV
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Ready to create your AI-optimized CV? Click the button below to generate your professional resume.
                  </p>
                </div>

                {!generatedCV ? (
                  <div className="text-center">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={generateCV}
                      disabled={isGenerating}
                      className={`premium-button-primary text-lg px-12 py-4 ${
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
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Your Generated CV
                      </h3>
                      <button
                        onClick={downloadCV}
                        className="premium-button-secondary flex items-center"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download CV
                      </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                        {generatedCV}
                      </pre>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={() => {
                          setGeneratedCV('');
                          setCurrentStep('personal');
                        }}
                        className="premium-button-secondary"
                      >
                        Create Another CV
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
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
        </div>
      </div>
    </div>
  );
}; 