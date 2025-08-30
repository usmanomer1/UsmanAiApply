import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  MapPin,
  Briefcase,
  Home,
  DollarSign,
  Sparkles,
  X,
  Loader2,
  User,
  Mail,
  Phone
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, uploadResume } from '../../lib/supabase';
import { extractTextFromDocument } from '../../lib/documentExtractor';
import { joboticApi } from '../../lib/joboticApi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface OnboardingProps {
  onComplete: () => void;
}

interface JobPreferences {
  roles: string[];
  locations: string[];
  workType: ('remote' | 'hybrid' | 'onsite')[];
  salaryMin: number;
  salaryMax: number;
}

const roleOptions = [
  { value: 'software-engineer', label: 'Software Engineer', icon: '👨‍💻' },
  { value: 'frontend-developer', label: 'Frontend Developer', icon: '🎨' },
  { value: 'backend-developer', label: 'Backend Developer', icon: '⚙️' },
  { value: 'full-stack-developer', label: 'Full Stack Developer', icon: '🚀' },
  { value: 'data-scientist', label: 'Data Scientist', icon: '📊' },
  { value: 'product-manager', label: 'Product Manager', icon: '📱' },
  { value: 'designer', label: 'UI/UX Designer', icon: '🎯' },
  { value: 'devops-engineer', label: 'DevOps Engineer', icon: '🔧' }
];

const locationOptions = [
  { value: 'san-francisco', label: 'San Francisco, CA', icon: '🌉' },
  { value: 'new-york', label: 'New York, NY', icon: '🗽' },
  { value: 'austin', label: 'Austin, TX', icon: '🤠' },
  { value: 'seattle', label: 'Seattle, WA', icon: '☕' },
  { value: 'denver', label: 'Denver, CO', icon: '🏔️' },
  { value: 'boston', label: 'Boston, MA', icon: '🎓' },
  { value: 'chicago', label: 'Chicago, IL', icon: '🌆' },
  { value: 'remote', label: 'Remote', icon: '🌍' },
  { value: 'other', label: 'Other Location', icon: '📍' }
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [preferences, setPreferences] = useState<JobPreferences>({
    roles: [],
    locations: [],
    workType: [],
    salaryMin: 50000,
    salaryMax: 200000
  });
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreCaching, setIsPreCaching] = useState(false);
  
  // Personal details state
  const [personalDetails, setPersonalDetails] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    phone: ''
  });

  const totalSteps = 4; // Added personal details step

  // Pre-cache job results when preferences are set
  const preCacheJobResults = useCallback(async () => {
    if (!resumeText || preferences.roles.length === 0) return;

    // Don't block UI with loading state
    try {
      // Make a search request for the primary role
      const primaryRole = preferences.roles[0]
        .replace('-', ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const primaryLocation = preferences.locations.includes('remote') 
        ? 'Remote' 
        : preferences.locations[0]?.replace('-', ' ').split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || '';

      await joboticApi.searchJobs({
        resumeText: resumeText,
        preferences: {
          jobTitle: primaryRole,
          location: primaryLocation
        },
        page: 1
      });
    } catch (error) {
      console.error('Pre-caching failed:', error);
    }
  }, [resumeText, preferences]);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const validTypes = ['application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF document');
      return;
    }

    setResumeFile(file);
    setIsUploading(true);
    setIsParsing(true);

    try {
      // Extract text from document
      const text = await extractTextFromDocument(file);
      setResumeText(text);

      // Upload to Supabase using the same method as profile page
      const uploadedPath = await uploadResume(file, user!.id);

      if (!uploadedPath) throw new Error('Failed to upload resume');

      // Update user profile with resume path (not full URL)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ resume_url: uploadedPath })
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;
      } else {
        // Create profile if it doesn't exist - use only base fields
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user!.id,
            full_name: user?.user_metadata?.full_name || '',
            resume_url: uploadedPath
          });

        if (insertError) throw insertError;
      }

      setUploadSuccess(true);
      setIsParsing(false);
      
      // Auto-advance after success
      // Cache resume text locally so jobs page can use it immediately
      try {
        localStorage.setItem('resume_text_cache', text);
      } catch (e) {
        console.warn('Could not cache resume text after onboarding upload:', e);
      }
      setTimeout(() => {
        setCurrentStep(3); // Go to personal details step
      }, 1500);
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast.error('Failed to upload resume');
      setIsParsing(false);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Save preferences and complete onboarding
  const completeOnboarding = async () => {
    try {
      // Add custom location if provided
      const finalPreferences = { ...preferences };
      if (showCustomLocation && customLocation.trim()) {
        // Replace 'other' with the actual custom location
        finalPreferences.locations = finalPreferences.locations.filter(loc => loc !== 'other');
        finalPreferences.locations.push(customLocation.trim());
      }

      // Try to save preferences to job_preferences table (if it exists)
      try {
        const { error: prefsError } = await supabase
          .from('job_preferences')
          .upsert({
            user_id: user!.id,
            job_titles: finalPreferences.roles || [],
            locations: finalPreferences.locations || [],
            work_arrangements: finalPreferences.workType || [],
            experience_levels: [],  // Not collected in current onboarding
            employment_types: [],   // Not collected in current onboarding
            industries: [],         // Not collected in current onboarding
            company_sizes: [],      // Not collected in current onboarding
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user!.id);

        if (prefsError && prefsError.code !== '42P01') { // 42P01 = table doesn't exist
          throw prefsError;
        }
      } catch (error: any) {
        // If job_preferences table doesn't exist, continue anyway
        console.log('job_preferences table might not exist, continuing...', error);
      }

      // Then update profile to mark onboarding as completed
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (existingProfile) {
        // Update existing profile - include all the new fields
        const updateData: any = {
          full_name: personalDetails.fullName || user?.user_metadata?.full_name || '',
          phone: personalDetails.phone || '',
          email: personalDetails.email || user?.email || '',
          onboarding_completed: true,
          // Save the first selected role as current job title
          current_job_title: preferences.roles.length > 0 ? preferences.roles[0].replace('-', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '',
          // Save the first location (use finalPreferences which has the custom location)
          location: finalPreferences.locations.length > 0 ? finalPreferences.locations[0] : '',
          // Save desired roles
          desired_roles: preferences.roles
        };
        
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', existingProfile.id);

        if (error) {
          // If error is about unknown columns, try without the new fields
          if (error.message?.includes('column') && error.message?.includes('does not exist')) {
            const { error: retryError } = await supabase
              .from('profiles')
              .update({
                full_name: personalDetails.fullName || user?.user_metadata?.full_name || '',
                phone: personalDetails.phone || ''
              })
              .eq('id', existingProfile.id);
            
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      } else {
        // Create new profile if it doesn't exist
        const insertData: any = {
          user_id: user!.id,
          full_name: personalDetails.fullName || user?.user_metadata?.full_name || '',
          phone: personalDetails.phone || '',
          email: personalDetails.email || user?.email || '',
          onboarding_completed: true,
          // Save the first selected role as current job title
          current_job_title: preferences.roles.length > 0 ? preferences.roles[0].replace('-', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '',
          // Save the first location (use finalPreferences which has the custom location)
          location: finalPreferences.locations.length > 0 ? finalPreferences.locations[0] : '',
          // Save desired roles
          desired_roles: preferences.roles
        };
        
        const { error } = await supabase
          .from('profiles')
          .insert(insertData);

        if (error) {
          // If error is about unknown columns, try without the new fields
          if (error.message?.includes('column') && error.message?.includes('does not exist')) {
            const { error: retryError } = await supabase
              .from('profiles')
              .insert({
                user_id: user!.id,
                full_name: personalDetails.fullName || user?.user_metadata?.full_name || '',
                phone: personalDetails.phone || ''
              });
            
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }

      // Navigate immediately to show loading transition
      toast.success('Welcome aboard! Let\'s find your dream job 🚀');
      onComplete();
      navigate('/jobs', { state: { fromOnboarding: true } });

      // Pre-cache job results in the background (don't await)
      preCacheJobResults().catch(err => {
        console.error('Error pre-caching jobs:', err);
      });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to save preferences');
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Don't wait for pre-caching, just complete immediately
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return uploadSuccess;
      case 3:
        // Personal details step - require name and email
        return personalDetails.fullName.trim().length > 0 && personalDetails.email.trim().length > 0;
      case 4:
        // Ensure at least one role is selected
        // If custom location is shown, ensure it's filled
        const hasValidLocation = showCustomLocation ? customLocation.trim().length > 0 : true;
        return preferences.roles.length > 0 && hasValidLocation;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-white to-teal-50 overflow-y-auto">
      {/* Fixed Header */}
      <div className="sticky top-0 bg-gradient-to-br from-white to-teal-50 z-10 pb-4">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <motion.div
            className="h-full bg-teal-600"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center pt-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <motion.div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep > step
                      ? 'bg-teal-600 text-white'
                      : currentStep === step
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                  animate={{
                    scale: currentStep === step ? 1.1 : 1,
                  }}
                >
                  {currentStep > step ? <Check className="h-4 w-4" /> : step}
                </motion.div>
                {step < 4 && (
                  <div
                    className={`w-12 h-0.5 ${
                      currentStep > step ? 'bg-teal-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Skip Button */}
        {currentStep > 1 && (
          <button
            onClick={completeOnboarding}
            className="absolute top-8 right-8 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center p-4 md:p-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {currentStep === 1 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl w-full text-center"
            >
              {/* Animated Logo */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.8 }}
                className="w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg"
              >
                <Briefcase className="h-12 w-12 text-white" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
              >
                Welcome to Your AI-Powered Job Search
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-xl text-gray-600 mb-12"
              >
                Let's get you hired 10x faster
              </motion.p>

              {/* Animated Illustrations */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-3 gap-8 mb-12"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-20 h-20 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  >
                    <Upload className="h-10 w-10 text-teal-600" />
                  </motion.div>
                  <p className="text-sm text-gray-600">Upload Resume</p>
                </div>
                <div className="text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
                    className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  >
                    <Sparkles className="h-10 w-10 text-blue-600" />
                  </motion.div>
                  <p className="text-sm text-gray-600">AI Matching</p>
                </div>
                <div className="text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.6 }}
                    className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  >
                    <Check className="h-10 w-10 text-green-600" />
                  </motion.div>
                  <p className="text-sm text-gray-600">Get Hired</p>
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={nextStep}
                className="px-8 py-4 bg-teal-600 text-white rounded-xl font-medium text-lg hover:bg-teal-700 transition-colors shadow-lg"
              >
                Get Started
                <ChevronRight className="inline-block ml-2 h-5 w-5" />
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Upload Resume */}
          {currentStep === 2 && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl w-full"
            >
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
                Upload Your Resume
              </h2>

              {!resumeFile ? (
                <label
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`block cursor-pointer`}
                >
                  <motion.div
                    animate={{
                      borderColor: isDragging ? '#14b8a6' : '#e5e7eb',
                      backgroundColor: isDragging ? '#f0fdfa' : '#ffffff'
                    }}
                    className="border-2 border-dashed rounded-2xl p-12 text-center transition-colors"
                  >
                    <motion.div
                      animate={{ y: isDragging ? -5 : 0 }}
                      className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <Upload className="h-10 w-10 text-teal-600" />
                    </motion.div>
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Drag your resume here or click to browse
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports PDF format
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </motion.div>
                </label>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-8">
                  {isParsing ? (
                    <div className="text-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4"
                      />
                      <p className="text-gray-600">Analyzing your resume...</p>
                    </div>
                  ) : uploadSuccess ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="h-10 w-10 text-green-600" />
                      </div>
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        Resume uploaded successfully!
                      </p>
                      <p className="text-sm text-gray-500">
                        {resumeFile.name}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-10 w-10 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {resumeFile.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setResumeFile(null);
                          setUploadSuccess(false);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                    canProceed()
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Continue
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Personal Details */}
          {currentStep === 3 && (
            <motion.div
              key="personal-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl w-full"
            >
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
                Personal Details
              </h2>

              <div className="space-y-6">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={personalDetails.fullName}
                      onChange={(e) => setPersonalDetails({ ...personalDetails, fullName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={personalDetails.email}
                      onChange={(e) => setPersonalDetails({ ...personalDetails, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      value={personalDetails.phone}
                      onChange={(e) => setPersonalDetails({ ...personalDetails, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>

                {/* Privacy Notice */}
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm text-gray-600">
                    Your personal information is securely stored and used only for job applications. 
                    We never share your data without your explicit consent.
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!personalDetails.fullName || !personalDetails.email}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                    personalDetails.fullName && personalDetails.email
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Continue
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Job Preferences */}
          {currentStep === 4 && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl w-full"
            >
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
                What are you looking for?
              </h2>

              {/* Desired Roles */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                  Desired Roles
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {roleOptions.map((role) => (
                    <motion.button
                      key={role.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setPreferences(prev => ({
                          ...prev,
                          roles: prev.roles.includes(role.value)
                            ? prev.roles.filter(r => r !== role.value)
                            : [...prev.roles, role.value]
                        }));
                      }}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        preferences.roles.includes(role.value)
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{role.icon}</div>
                      <p className="text-sm font-medium text-gray-900">
                        {role.label}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Preferred Locations */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  Preferred Locations
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {locationOptions.map((location) => (
                    <motion.button
                      key={location.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (location.value === 'other') {
                          setShowCustomLocation(!showCustomLocation);
                          if (!showCustomLocation) {
                            // Add 'other' to selections when showing custom input
                            setPreferences(prev => ({
                              ...prev,
                              locations: [...prev.locations.filter(l => l !== 'other'), 'other']
                            }));
                          } else {
                            // Remove 'other' and custom location when hiding
                            setPreferences(prev => ({
                              ...prev,
                              locations: prev.locations.filter(l => l !== 'other')
                            }));
                            setCustomLocation('');
                          }
                        } else {
                          setPreferences(prev => ({
                            ...prev,
                            locations: prev.locations.includes(location.value)
                              ? prev.locations.filter(l => l !== location.value)
                              : [...prev.locations, location.value]
                          }));
                        }
                      }}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        preferences.locations.includes(location.value)
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{location.icon}</div>
                      <p className="text-sm font-medium text-gray-900">
                        {location.label}
                      </p>
                    </motion.button>
                  ))}
                </div>
                
                {/* Custom Location Input */}
                {showCustomLocation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4"
                  >
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      placeholder="Enter your preferred location..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      autoFocus
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Enter city, state, or country (e.g., "London, UK" or "Toronto, Canada")
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Work Type */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Home className="h-5 w-5 text-gray-400" />
                  Work Type
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'remote' as const, label: 'Remote', icon: '🌍' },
                    { value: 'hybrid' as const, label: 'Hybrid', icon: '🏢' },
                    { value: 'onsite' as const, label: 'On-site', icon: '🏛️' }
                  ].map((type) => (
                    <motion.button
                      key={type.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setPreferences(prev => ({
                          ...prev,
                          workType: prev.workType.includes(type.value)
                            ? prev.workType.filter(t => t !== type.value)
                            : [...prev.workType, type.value]
                        }));
                      }}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        preferences.workType.includes(type.value)
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{type.icon}</div>
                      <p className="text-sm font-medium text-gray-900">
                        {type.label}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Salary Expectations */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  Salary Expectations
                </h3>
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>${preferences.salaryMin.toLocaleString()}</span>
                    <span>${preferences.salaryMax.toLocaleString()}</span>
                  </div>
                  <div className="relative">
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{
                          width: `${((preferences.salaryMax - 50000) / 150000) * 100}%`
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min="50000"
                      max="200000"
                      step="10000"
                      value={preferences.salaryMax}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setPreferences(prev => ({
                          ...prev,
                          salaryMax: value,
                          salaryMin: Math.min(prev.salaryMin, value - 10000)
                        }));
                      }}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                    canProceed()
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Start Job Search
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;