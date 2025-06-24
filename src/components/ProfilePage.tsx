import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Phone, 
  FileText, 
  Upload, 
  Save, 
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mic
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, uploadResume, getSignedResumeUrl } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import VoiceAdminPanel from './voice/VoiceAdminPanel';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  resume_url: string | null;
  created_at: string;
}



export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [showVoiceAdmin, setShowVoiceAdmin] = useState(false);

  // Simple admin check - you can replace this with your actual admin logic
  const isAdmin = user?.email === 'admin@jobotic.ai' || user?.email === 'usman@jobotic.ai';

  useEffect(() => {
    // Always fetch profile, regardless of user state
    fetchProfile();
  }, [user]);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here');
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);

      if (!isSupabaseConfigured() || !user) {
        setProfile(null);
        setFormData({
          full_name: '',
          phone: '',
        });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        setFormData({
          full_name: '',
          phone: '',
        });
        toast.error('Failed to load profile data');
      } else if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
        });

        // Get signed URL for resume if it exists
        if (data.resume_url) {
          const signedUrl = await getSignedResumeUrl(data.resume_url);
          setResumeUrl(signedUrl);
        }
      } else {
        // No profile found
        setProfile(null);
        setFormData({
          full_name: '',
          phone: '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setFormData({
        full_name: '',
        phone: '',
      });
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      if (isSupabaseConfigured() && user) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone || null,
          })
          .eq('id', profile.id);

        if (error) {
          throw error;
        }
      }

      setProfile(prev => prev ? {
        ...prev,
        full_name: formData.full_name,
        phone: formData.phone || null,
      } : null);

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      if (isSupabaseConfigured() && user) {
        const resumePath = await uploadResume(file, user.id);
        if (!resumePath) {
          throw new Error('Failed to upload resume');
        }

        // Update profile with resume URL
        const { error } = await supabase
          .from('profiles')
          .update({ resume_url: resumePath })
          .eq('id', profile.id);

        if (error) {
          throw error;
        }

        // Get signed URL for the uploaded resume
        const signedUrl = await getSignedResumeUrl(resumePath);
        setResumeUrl(signedUrl);

        setProfile(prev => prev ? {
          ...prev,
          resume_url: resumePath,
        } : null);
      } else {
        toast.error('Resume upload not available - database not configured');
        return;
      }

      setResumeFile(file);
      toast.success('Resume uploaded successfully');
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!profile || !profile.resume_url) return;

    try {
      if (isSupabaseConfigured() && user) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('resumes')
          .remove([profile.resume_url]);

        if (storageError) {
          throw storageError;
        }

        // Update profile
        const { error } = await supabase
          .from('profiles')
          .update({ resume_url: null })
          .eq('id', profile.id);

        if (error) {
          throw error;
        }
      }

      setProfile(prev => prev ? {
        ...prev,
        resume_url: null,
      } : null);
      setResumeUrl(null);
      setResumeFile(null);

      toast.success('Resume deleted successfully');
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast.error('Failed to delete resume');
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mb-4"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl shimmer"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-display-lg text-gray-900 dark:text-white mb-3">Profile Settings</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">Manage your personal information and resume</p>
        {!isSupabaseConfigured() && (
          <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                          Database not configured
          </div>
        )}
      </motion.div>

      {/* Voice Admin Panel Toggle */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Button
            onClick={() => setShowVoiceAdmin(!showVoiceAdmin)}
            variant="outline"
            className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <Mic className="w-4 h-4 mr-2" />
            {showVoiceAdmin ? 'Hide Voice Admin' : 'Show Voice Admin Panel'}
          </Button>
        </motion.div>
      )}

      {/* Voice Admin Panel */}
      {showVoiceAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <VoiceAdminPanel isAdmin={isAdmin} />
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="premium-card p-8 hover-lift"
        >
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Personal Information</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                <User className="w-4 h-4 inline mr-2" />
                Full Name *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter your full name"
                className="premium-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter your phone number"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || 'demo@jobotic.ai'}
                disabled
                className="premium-input opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving || !formData.full_name.trim()}
              className="premium-button-primary w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Resume Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="premium-card p-8 hover-lift"
        >
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Resume</h2>
          
          <div className="space-y-6">
            {profile?.resume_url ? (
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
                  <div className="flex-1">
                    <p className="text-green-700 dark:text-green-300 font-medium">Resume uploaded</p>
                    <p className="text-green-600 dark:text-green-400 text-sm">
                      {resumeFile?.name || 'resume.pdf'}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  {resumeUrl && (
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="premium-button-secondary flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  )}
                  
                  <button
                    onClick={handleDeleteResume}
                    className="premium-button-secondary text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Upload a new resume to replace the current one:
                  </p>
                  <label className="premium-button-secondary cursor-pointer inline-flex">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Replace Resume'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handleResumeUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Upload your resume to get started
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    PDF, DOC, DOCX up to 10MB
                  </p>
                  
                  <label className="premium-button-primary cursor-pointer inline-flex">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Resume'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handleResumeUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>

                <div className="flex items-start p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Why upload a resume?</p>
                    <p className="text-blue-600 dark:text-blue-400 text-sm">
                      Your resume will be used to automatically fill job applications and generate personalized cover letters.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};