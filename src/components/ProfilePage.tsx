import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Shield,
  Upload,
  Download,
  Trash2,
  Check,
  X,
  Eye,
  Sparkles,
  Building2,
  DollarSign,
  Globe,
  Star,
  Settings,
  Lock,
  LogOut,
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  FileText,
  Zap,
  Crown,
  TrendingUp,
  BarChart3,
  Hash,
  Linkedin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, uploadResume, uploadAvatar } from '../lib/supabase';
import { getPlanNameByPriceId } from '../stripe-config';
import { extractTextFromPDF } from '../lib/pdfExtractor';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email?: string | null;
  phone: string | null;
  resume_url: string | null;
  avatar_url: string;
  created_at: string;
}

type TabType = 'general' | 'professional' | 'preferences' | 'privacy';

const ProfilePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [resumeAnalysis, setResumeAnalysis] = useState<{
    score: number;
    keySkills: string[];
    lastUpdated: string;
  } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Stats state
  const [profileStats, setProfileStats] = useState({
    totalApplications: 0,
    totalInterviews: 0,
    successRate: 0
  });
  
  // Subscription state
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('Free');

  // Form data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    currentJobTitle: '',
    yearsOfExperience: 0,
    skills: [] as string[],
    desiredRoles: [] as string[],
    salaryMin: 50000,
    salaryMax: 200000,
    workAuthorization: ''
  });

  // Job preferences state
  const [jobPreferences, setJobPreferences] = useState({
    employmentTypes: [] as string[],
    workArrangements: [] as string[],
    emailNotifications: true,
    dataSharing: true,
    profileVisibility: 'public'
  });

  // Profile completion calculation
  const calculateProfileCompletion = () => {
    const fields = [
      formData.fullName,
      formData.email,
      formData.phone,
      formData.location,
      formData.linkedinUrl,
      formData.currentJobTitle,
      formData.yearsOfExperience > 0,
      formData.skills.length > 0,
      profile?.resume_url
    ];
    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  };

  // Handle URL query parameters to set active tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    
    if (tab === 'professional') {
      setActiveTab('professional');
    } else if (tab === 'preferences') {
      setActiveTab('preferences');
    } else if (tab === 'privacy') {
      setActiveTab('privacy');
    } else if (tab === 'general') {
      setActiveTab('general');
    }
  }, [location]);

  useEffect(() => {
    fetchProfile();
    fetchProfileStats();
    fetchSubscription();
    fetchJobPreferences();
    // Set up autosave
    const autosaveInterval = setInterval(() => {
      if (hasUnsavedChanges) {
        handleSave(true);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autosaveInterval);
  }, [hasUnsavedChanges]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [formData]);

  const fetchProfile = async () => {
    try {
      // Handle multiple profiles by getting the most recent one
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      const data = profiles?.[0] || null;

      if (data) {
        setProfile(data);
        setFormData(prev => ({
          ...prev,
          fullName: data.full_name || '',
          email: data.email || user?.email || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedinUrl: data.linkedin_url || '',
          currentJobTitle: data.current_job_title || '',
          yearsOfExperience: data.years_of_experience || 0,
          skills: data.skills || [],
          desiredRoles: data.desired_roles || [],
          salaryMin: data.salary_min || 50000,
          salaryMax: data.salary_max || 200000,
          workAuthorization: data.work_authorization || ''
        }));
        
        // Clear resume analysis - no mock data
        if (data.resume_url) {
          setResumeAnalysis(null);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileStats = async () => {
    if (!user) return;
    
    try {
      // Get total applications
      const { count: totalCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get interview and OA applications
      const { count: interviewCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['INTERVIEW', 'OA']);

      // Calculate success rate
      const successRate = totalCount && totalCount > 0 
        ? Math.round(((interviewCount || 0) / totalCount) * 100)
        : 0;

      setProfileStats({
        totalApplications: totalCount || 0,
        totalInterviews: interviewCount || 0,
        successRate
      });
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    }
  };
  
  const fetchSubscription = async () => {
    if (!user) return;
    
    try {
      // Fetch subscription using the same view as billing page
      const { data: subData, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        setSubscriptionPlan('Free');
        return;
      }

      if (!subData || !subData.price_id || subData.subscription_status !== 'active') {
        setSubscriptionPlan('Free');
        return;
      }

      // Get plan name from price ID
      const planName = getPlanNameByPriceId(subData.price_id);
      setSubscriptionPlan(planName || 'Free');
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscriptionPlan('Free');
    }
  };

  const fetchJobPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('job_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching job preferences:', error);
        return;
      }

      if (data) {
        // Map database fields to our state structure
        setJobPreferences({
          employmentTypes: data.employment_types || [],
          workArrangements: data.work_arrangements || [],
          emailNotifications: true, // These might not be in the table yet
          dataSharing: true,
          profileVisibility: 'public'
        });
      }
    } catch (error) {
      console.error('Error fetching job preferences:', error);
    }
  };

  const handleSave = async (isAutosave = false) => {
    setSaving(true);
    try {
      const updateData: any = {
        full_name: formData.fullName,
        phone: formData.phone,
        location: formData.location,
        linkedin_url: formData.linkedinUrl,
        current_job_title: formData.currentJobTitle,
        years_of_experience: formData.yearsOfExperience,
        skills: formData.skills,
        desired_roles: formData.desiredRoles,
        salary_min: formData.salaryMin,
        salary_max: formData.salaryMax,
        work_authorization: formData.workAuthorization
      };

      // Only add email if it exists in the schema
      if (formData.email) {
        updateData.email = formData.email;
      }

      // First check if profile exists
      if (profile) {
        // Use update to preserve existing fields like resume_url
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', user!.id);
          
        if (error) throw error;
      } else {
        // Create new profile if it doesn't exist
        const { error } = await supabase
          .from('profiles')
          .upsert({
            ...updateData,
            user_id: user!.id
          }, {
            onConflict: 'user_id'
          });
          
        if (error) throw error;
      }

      // Save job preferences
      const jobPrefsData = {
        user_id: user!.id,
        employment_types: jobPreferences.employmentTypes,
        work_arrangements: jobPreferences.workArrangements,
        // If location changed, update job_preferences locations array
        locations: formData.location ? [formData.location] : [],
        updated_at: new Date().toISOString()
      };

      // Try to update existing preferences first
      const { error: prefUpdateError } = await supabase
        .from('job_preferences')
        .update(jobPrefsData)
        .eq('user_id', user!.id);

      // If no rows were updated (preferences don't exist), insert new
      if (prefUpdateError && prefUpdateError.code === 'PGRST116') {
        const { error: prefInsertError } = await supabase
          .from('job_preferences')
          .insert(jobPrefsData);
        
        if (prefInsertError) {
          console.error('Error inserting job preferences:', prefInsertError);
        }
      } else if (prefUpdateError) {
        console.error('Error updating job preferences:', prefUpdateError);
      }

      setHasUnsavedChanges(false);
      if (!isAutosave) {
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please select an image smaller than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    try {
      setSaving(true);
      const avatarUrl = await uploadAvatar(user!.id, file);
      
      if (!avatarUrl) {
        toast.error('Failed to upload avatar');
        return;
      }

      // Update profile with new avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user!.id);

      if (error) {
        console.error('Error updating avatar:', error);
        toast.error('Failed to update profile picture');
      } else {
        setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
        toast.success('Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    console.log('handleResumeUpload called with file:', file?.name, file?.size, file?.type);
    
    if (!file) {
      console.error('No file provided');
      return;
    }

    // Strict PDF validation
    const validTypes = ['application/pdf'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (!validTypes.includes(file.type) || fileExt !== 'pdf') {
      toast.error('Only PDF files are allowed. Please upload a PDF resume.');
      return;
    }
    
    // Additional validation for file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingResume(true);
    try {
      const resumePath = await uploadResume(file, user!.id);
      console.log('Resume uploaded to storage, path:', resumePath);
      
      if (!resumePath) {
        throw new Error('Failed to get resume path from upload');
      }
      
      // Check if profile exists
      if (profile) {
        // Update existing profile
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ resume_url: resumePath })
          .eq('user_id', user!.id)
          .select();

        if (updateError) throw updateError;
        
        const updatedProfile = Array.isArray(updateData) ? updateData[0] : updateData;
        if (updatedProfile) {
          console.log('Profile updated with resume:', updatedProfile);
          setProfile(updatedProfile);
        }
      } else {
        // Create new profile
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user!.id,
            full_name: user?.user_metadata?.full_name || '',
            resume_url: resumePath
          })
          .select();

        if (insertError) throw insertError;
        
        const insertedProfile = Array.isArray(insertData) ? insertData[0] : insertData;
        if (insertedProfile) {
          console.log('Profile created with resume:', insertedProfile);
          setProfile(insertedProfile);
        }
      }
      
      // Clear resume analysis - no mock data
      setResumeAnalysis(null);
      
      toast.success('Resume uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading resume:', error);
      // Provide more specific error messages
      if (error.message?.includes('Failed to get resume path')) {
        toast.error('Failed to upload file to storage. Please try again.');
      } else if (error.message?.includes('row-level security')) {
        toast.error('Permission denied. Please contact support.');
      } else if (error.code === '23505') {
        toast.error('Profile conflict. Please refresh the page and try again.');
      } else {
        toast.error(error.message || 'Failed to upload resume');
      }
    } finally {
      setUploadingResume(false);
    }
  };

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
    if (file) handleResumeUpload(file);
  };

  const downloadResume = async () => {
    if (!profile?.resume_url) return;

    try {
      // The resume_url is already just the path (e.g., "user-id/resume.pdf")
      const filePath = profile.resume_url;
      
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume_${user?.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resume:', error);
      toast.error('Failed to download resume');
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });
      
      if (error) throw error;
      
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.message?.includes('reauthentication')) {
        toast.error('Please log in again to change your password');
      } else {
        toast.error(error.message || 'Failed to update password');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const deleteResume = async () => {
    if (!profile?.resume_url) return;

    try {
      // First, delete the file from storage
      const filePath = profile.resume_url;
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .remove([filePath]);
      
      if (storageError) {
        console.log('Storage deletion error (may be ignored if file doesn\'t exist):', storageError);
      }

      // Then update the database - use .limit(1) instead of .single()
      const { data: profiles, error } = await supabase
        .from('profiles')
        .update({ resume_url: null })
        .eq('user_id', user!.id)
        .select()
        .limit(1);

      if (error) throw error;

      // Directly update the profile state
      const updateData = profiles?.[0] || null;
      if (updateData) {
        setProfile(updateData);
      }
      setResumeAnalysis(null);
      toast.success('Resume deleted successfully. You can now upload a PDF resume.');
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast.error('Failed to delete resume');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'privacy', label: 'Privacy', icon: Shield }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const profileCompletion = calculateProfileCompletion();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-semibold text-gray-900">
                Profile Settings
              </h1>
              <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                <span className="text-lg">🎯</span>
                Complete your profile to improve job matches
              </p>
            </div>
            
            {/* Profile Completion */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Profile strength</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {profileCompletion}% complete
                </p>
              </div>
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - profileCompletion / 100)}`}
                    className="text-teal-600 transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {profileCompletion === 100 ? (
                    <CheckCircle className="h-8 w-8 text-teal-600" />
                  ) : (
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {profileCompletion}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Profile Preview */}
          <div className="lg:w-[30%]">
            <div className="glass-card p-6 sticky top-8">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    )}
                  </div>
                  <button className="absolute inset-0 w-full h-full rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="h-8 w-8 text-white" />
                  </button>
                </div>
                
                <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {formData.fullName || 'Your Name'}
                </h2>
                
                {/* Plan Badge */}
                <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  subscriptionPlan === 'Free' 
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    : subscriptionPlan === 'Pro' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : subscriptionPlan === 'Premium'
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                    : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                }`}>
                  <Crown className="h-3 w-3 mr-1" />
                  {subscriptionPlan} Plan
                </div>
                
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Member since {new Date(profile?.created_at || '').toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Applications</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{profileStats.totalApplications}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Interviews</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{profileStats.totalInterviews}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Success Rate</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{profileStats.successRate}%</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Profile Data
                </button>
                <button 
                  onClick={() => signOut()}
                  className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Settings */}
          <div className="lg:w-[70%]">
            <div className="glass-card">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`
                          flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                          ${activeTab === tab.id
                            ? 'border-teal-600 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'general' && (
                    <motion.div
                      key="general"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {/* Avatar Section */}
                      <div className="mb-8">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                          Profile Picture
                        </h3>
                        <div className="flex items-center space-x-6">
                          <div className="relative">
                            <img
                              src={profile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.id}`}
                              alt="Avatar"
                              className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                            />
                            <button
                              onClick={() => avatarInputRef.current?.click()}
                              className="absolute -bottom-2 -right-2 p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition-colors shadow-lg"
                            >
                              <Camera className="h-4 w-4" />
                            </button>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Upload a professional photo for your profile
                            </p>
                            <button
                              onClick={() => avatarInputRef.current?.click()}
                              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                            >
                              Change Photo
                            </button>
                          </div>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                          Account Information
                        </h3>
                        
                        {/* Email Field */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email Address
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="email"
                              value={formData.email}
                              readOnly
                              className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400"
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Full Name Field */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Full Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="text"
                              value={formData.fullName}
                              onChange={(e) => handleInputChange('fullName', e.target.value)}
                              placeholder="Enter your full name"
                              className="w-full pl-10 pr-20 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                              {formData.fullName.length}/50
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            This is how your name will appear on applications
                          </p>
                        </div>

                        {/* Phone Field */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              placeholder="+1 (555) 123-4567"
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Location Field */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Location
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="text"
                              value={formData.location}
                              onChange={(e) => handleInputChange('location', e.target.value)}
                              placeholder="San Francisco, CA"
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* LinkedIn URL Field */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            LinkedIn Profile
                          </label>
                          <div className="relative">
                            <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="url"
                              value={formData.linkedinUrl}
                              onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                              placeholder="https://linkedin.com/in/yourprofile"
                              className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                            {formData.linkedinUrl && (
                              <a
                                href={formData.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors"
                              >
                                <ExternalLink className="h-5 w-5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'professional' && (
                    <motion.div
                      key="professional"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                          Professional Information
                        </h3>

                        {/* Resume Section */}
                        <div className="mb-8">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                            Resume
                          </label>
                          
                          {!profile?.resume_url ? (
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`
                                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                ${isDragging 
                                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }
                              `}
                            >
                              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Drop your resume here or click to browse
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                PDF format only, max 5MB
                              </p>
                              
                              {uploadingResume && (
                                <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-90 flex items-center justify-center rounded-xl">
                                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">resume.pdf</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      Uploaded {profile?.resume_url ? new Date(profile.created_at).toLocaleDateString() : 'recently'}
                                    </p>
                                  </div>
                                </div>
                                
                              </div>

                              {/* Key Skills */}
                              {resumeAnalysis && resumeAnalysis.keySkills.length > 0 && (
                                <div className="mb-4">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Extracted Skills
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {resumeAnalysis.keySkills.map((skill, index) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-500"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={downloadResume}
                                  className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </button>
                                <button
                                  onClick={() => fileInputRef.current?.click()}
                                  className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Replace
                                </button>
                                <button
                                  onClick={deleteResume}
                                  className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </button>
                                <button
                                  onClick={() => navigate('/resume')}
                                  className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                                >
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Optimize with AI
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Hidden file input for both upload and replace */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleResumeUpload(file);
                                // Reset the input value to allow re-uploading the same file
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                          />
                        </div>

                        {/* Current Job Title */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Current Job Title
                          </label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="text"
                              value={formData.currentJobTitle}
                              onChange={(e) => handleInputChange('currentJobTitle', e.target.value)}
                              placeholder="e.g., Senior Software Engineer"
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Years of Experience */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Years of Experience
                          </label>
                          <div className="relative">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              value={formData.yearsOfExperience}
                              onChange={(e) => handleInputChange('yearsOfExperience', parseInt(e.target.value))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <span>0</span>
                              <span className="font-medium text-teal-600">{formData.yearsOfExperience} years</span>
                              <span>30+</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === 'preferences' && (
                    <motion.div
                      key="preferences"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                          Job Search Preferences
                        </h3>
                        
                        {/* Job Types */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Preferred Employment Types
                          </label>
                          <div className="space-y-3">
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.employmentTypes.includes('FULLTIME')}
                                onChange={(e) => {
                                  const newTypes = e.target.checked 
                                    ? [...jobPreferences.employmentTypes, 'FULLTIME']
                                    : jobPreferences.employmentTypes.filter(t => t !== 'FULLTIME');
                                  setJobPreferences(prev => ({ ...prev, employmentTypes: newTypes }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Full-time</span>
                            </label>
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.employmentTypes.includes('PARTTIME')}
                                onChange={(e) => {
                                  const newTypes = e.target.checked 
                                    ? [...jobPreferences.employmentTypes, 'PARTTIME']
                                    : jobPreferences.employmentTypes.filter(t => t !== 'PARTTIME');
                                  setJobPreferences(prev => ({ ...prev, employmentTypes: newTypes }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Part-time</span>
                            </label>
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.employmentTypes.includes('CONTRACTOR')}
                                onChange={(e) => {
                                  const newTypes = e.target.checked 
                                    ? [...jobPreferences.employmentTypes, 'CONTRACTOR']
                                    : jobPreferences.employmentTypes.filter(t => t !== 'CONTRACTOR');
                                  setJobPreferences(prev => ({ ...prev, employmentTypes: newTypes }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Contract</span>
                            </label>
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.employmentTypes.includes('INTERN')}
                                onChange={(e) => {
                                  const newTypes = e.target.checked 
                                    ? [...jobPreferences.employmentTypes, 'INTERN']
                                    : jobPreferences.employmentTypes.filter(t => t !== 'INTERN');
                                  setJobPreferences(prev => ({ ...prev, employmentTypes: newTypes }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Internship</span>
                            </label>
                          </div>
                        </div>

                        {/* Work Arrangements */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Work Arrangements
                          </label>
                          <div className="space-y-3">
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.workArrangements.includes('remote')}
                                onChange={(e) => {
                                  const newArrangements = e.target.checked 
                                    ? [...jobPreferences.workArrangements, 'remote']
                                    : jobPreferences.workArrangements.filter(a => a !== 'remote');
                                  setJobPreferences(prev => ({ ...prev, workArrangements: newArrangements }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Remote</span>
                            </label>
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.workArrangements.includes('hybrid')}
                                onChange={(e) => {
                                  const newArrangements = e.target.checked 
                                    ? [...jobPreferences.workArrangements, 'hybrid']
                                    : jobPreferences.workArrangements.filter(a => a !== 'hybrid');
                                  setJobPreferences(prev => ({ ...prev, workArrangements: newArrangements }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Hybrid</span>
                            </label>
                            <label className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={jobPreferences.workArrangements.includes('onsite')}
                                onChange={(e) => {
                                  const newArrangements = e.target.checked 
                                    ? [...jobPreferences.workArrangements, 'onsite']
                                    : jobPreferences.workArrangements.filter(a => a !== 'onsite');
                                  setJobPreferences(prev => ({ ...prev, workArrangements: newArrangements }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">On-site</span>
                            </label>
                          </div>
                        </div>

                        {/* Notification Settings */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Email Notifications
                          </label>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                            <label className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Receive email notifications</span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Get notified about new job matches and application updates</p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setJobPreferences(prev => ({ ...prev, emailNotifications: !prev.emailNotifications }));
                                  setHasUnsavedChanges(true);
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  jobPreferences.emailNotifications ? 'bg-teal-600' : 'bg-gray-300'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  jobPreferences.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                            </label>
                          </div>
                        </div>

                        {/* Salary Range */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Expected Salary Range (USD)
                          </label>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <input
                                type="number"
                                value={formData.salaryMin}
                                onChange={(e) => handleInputChange('salaryMin', parseInt(e.target.value) || 0)}
                                placeholder="Min"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                            <span className="text-gray-500">to</span>
                            <div className="flex-1">
                              <input
                                type="number"
                                value={formData.salaryMax}
                                onChange={(e) => handleInputChange('salaryMax', parseInt(e.target.value) || 0)}
                                placeholder="Max"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Privacy Tab */}
                  {activeTab === 'privacy' && (
                    <motion.div
                      key="privacy"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                          Privacy & Security
                        </h3>
                        
                        {/* Profile Visibility */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Profile Visibility
                          </label>
                          <div className="space-y-3">
                            <label className="flex items-center">
                              <input 
                                type="radio" 
                                name="visibility" 
                                checked={jobPreferences.profileVisibility === 'public'}
                                onChange={() => {
                                  setJobPreferences(prev => ({ ...prev, profileVisibility: 'public' }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Public</span> - Visible to all employers
                              </span>
                            </label>
                            <label className="flex items-center">
                              <input 
                                type="radio" 
                                name="visibility" 
                                checked={jobPreferences.profileVisibility === 'private'}
                                onChange={() => {
                                  setJobPreferences(prev => ({ ...prev, profileVisibility: 'private' }));
                                  setHasUnsavedChanges(true);
                                }}
                                className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500" 
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Private</span> - Only visible to you
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Data Sharing */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Data & Privacy
                          </label>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                            <label className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Share data with Jobotic</span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Help us improve our service by sharing anonymous usage data</p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setJobPreferences(prev => ({ ...prev, dataSharing: !prev.dataSharing }));
                                  setHasUnsavedChanges(true);
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  jobPreferences.dataSharing ? 'bg-teal-600' : 'bg-gray-300'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  jobPreferences.dataSharing ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                            </label>
                          </div>
                        </div>

                        {/* Account Security */}
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Account Security
                          </h4>
                          <div className="space-y-3">
                            <button 
                              onClick={() => setShowPasswordModal(true)}
                              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">Change Password</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Update your account password</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">
                            Danger Zone
                          </h4>
                          <button className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Sticky Save Bar */}
            <AnimatePresence>
              {hasUnsavedChanges && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-4 shadow-lg"
                >
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <AlertCircle className="h-4 w-4" />
                      You have unsaved changes
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          fetchProfile();
                          setHasUnsavedChanges(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Discard Changes
                      </button>
                      <button
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Change Password
                </h3>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Must be at least 6 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={passwordLoading || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;