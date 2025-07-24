import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, Github, Linkedin, Globe, Link, CheckCircle, RefreshCw, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SocialLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

interface AutomationConfig {
  socialLinks: SocialLink[];
  resumeUrl?: string;
  resumeMetadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  externalApplicationConfig: {
    pauseOnAccountCreation: boolean;
    autoCreateAccount: boolean;
    defaultEmail?: string;
    defaultPassword?: string;
  };
}

interface LinkedInConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AutomationConfig) => void;
  initialConfig?: AutomationConfig;
}

const DEFAULT_SOCIAL_PLATFORMS = [
  { id: 'github', title: 'GitHub', icon: Github },
  { id: 'linkedin', title: 'LinkedIn', icon: Linkedin },
  { id: 'portfolio', title: 'Portfolio', icon: Globe },
];

export default function LinkedInConfigModal({ isOpen, onClose, onSave, initialConfig }: LinkedInConfigModalProps) {
  const { user } = useAuth();
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    initialConfig?.socialLinks || []
  );
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState(initialConfig?.resumeUrl || '');
  const [resumeMetadata, setResumeMetadata] = useState(initialConfig?.resumeMetadata);
  const [pauseOnAccountCreation, setPauseOnAccountCreation] = useState(
    initialConfig?.externalApplicationConfig?.pauseOnAccountCreation ?? true
  );
  const [autoCreateAccount, setAutoCreateAccount] = useState(
    initialConfig?.externalApplicationConfig?.autoCreateAccount ?? false
  );
  const [defaultEmail, setDefaultEmail] = useState(
    initialConfig?.externalApplicationConfig?.defaultEmail || user?.email || ''
  );
  const [defaultPassword, setDefaultPassword] = useState(
    initialConfig?.externalApplicationConfig?.defaultPassword || ''
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    // Load saved config from localStorage or database
    const savedConfig = localStorage.getItem(`linkedin-config-${user?.id}`);
    if (savedConfig && !initialConfig) {
      const parsed = JSON.parse(savedConfig);
      setSocialLinks(parsed.socialLinks || []);
      setResumeUrl(parsed.resumeUrl || '');
      setResumeMetadata(parsed.resumeMetadata);
      setPauseOnAccountCreation(parsed.externalApplicationConfig?.pauseOnAccountCreation ?? true);
      setAutoCreateAccount(parsed.externalApplicationConfig?.autoCreateAccount ?? false);
      setDefaultEmail(parsed.externalApplicationConfig?.defaultEmail || user?.email || '');
      setDefaultPassword(parsed.externalApplicationConfig?.defaultPassword || '');
    }
  }, [user, initialConfig]);

  const handleAddSocialLink = (platform?: typeof DEFAULT_SOCIAL_PLATFORMS[0]) => {
    const newLink: SocialLink = {
      id: Date.now().toString(),
      title: platform?.title || 'Custom Link',
      url: '',
      icon: platform?.id
    };
    setSocialLinks([...socialLinks, newLink]);
  };

  const handleUpdateSocialLink = (id: string, field: 'title' | 'url', value: string) => {
    setSocialLinks(socialLinks.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const handleRemoveSocialLink = (id: string) => {
    setSocialLinks(socialLinks.filter(link => link.id !== id));
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a PDF or Word document');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      // Upload to Supabase Storage
      const fileName = `${user?.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      setResumeFile(file);
      setResumeUrl(publicUrl);
      setResumeMetadata({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
    } catch (error) {
      console.error('Resume upload error:', error);
      setUploadError('Failed to upload resume. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    const config: AutomationConfig = {
      socialLinks: socialLinks.filter(link => link.url), // Only include links with URLs
      resumeUrl,
      resumeMetadata,
      externalApplicationConfig: {
        pauseOnAccountCreation,
        autoCreateAccount,
        defaultEmail: autoCreateAccount ? defaultEmail : undefined,
        defaultPassword: autoCreateAccount ? defaultPassword : undefined
      }
    };

    // Save to localStorage
    localStorage.setItem(`linkedin-config-${user?.id}`, JSON.stringify(config));
    
    onSave(config);
    onClose();
  };

  const isValid = resumeUrl && resumeMetadata;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">LinkedIn Automation Setup</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Resume Upload Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume</h3>
            <div className="space-y-4">
              {resumeMetadata ? (
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Upload className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium">{resumeMetadata.fileName}</p>
                      <p className="text-sm text-gray-600">
                        {(resumeMetadata.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setResumeFile(null);
                      setResumeUrl('');
                      setResumeMetadata(undefined);
                    }}
                    className="text-red-600 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <label className="block">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleResumeUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-900 font-medium mb-1">
                      {isUploading ? 'Uploading...' : 'Click to upload resume'}
                    </p>
                    <p className="text-sm text-gray-600">PDF or Word document (max 10MB)</p>
                  </div>
                </label>
              )}
              {uploadError && (
                <p className="text-red-600 text-sm">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Social Links Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Profiles</h3>
            <div className="space-y-3">
              {socialLinks.map((link) => {
                const platform = DEFAULT_SOCIAL_PLATFORMS.find(p => p.id === link.icon);
                const Icon = platform?.icon || Link;
                
                return (
                  <div key={link.id} className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => handleUpdateSocialLink(link.id, 'title', e.target.value)}
                      placeholder="Profile name"
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => handleUpdateSocialLink(link.id, 'url', e.target.value)}
                      placeholder="https://..."
                      className="flex-[2] bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleRemoveSocialLink(link.id)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {DEFAULT_SOCIAL_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleAddSocialLink(platform)}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <platform.icon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{platform.title}</span>
                </button>
              ))}
              <button
                onClick={() => handleAddSocialLink()}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">Custom</span>
              </button>
            </div>
          </div>

          {/* LinkedIn Authentication Status */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">LinkedIn Authentication</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              {localStorage.getItem(`linkedin-context-${user?.id}`) === 'true' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Authenticated with LinkedIn</p>
                        <p className="text-sm text-gray-600">Your sessions will start automatically</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('This will require you to log in again on your next session. Continue?')) {
                          localStorage.removeItem(`linkedin-context-${user?.id}`);
                          localStorage.removeItem('activeSessionId');
                          window.location.reload();
                        }
                      }}
                      className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Reset</span>
                    </button>
                  </div>
                  <div className="bg-blue-50 rounded p-3 flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">
                      Your LinkedIn session is saved securely. You may need to re-authenticate if you change your password or after extended inactivity.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Info className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Not yet authenticated</p>
                    <p className="text-sm text-gray-600">You'll need to log in once during your first automation session</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* External Application Settings */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">External Job Applications</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={pauseOnAccountCreation}
                  onChange={(e) => setPauseOnAccountCreation(e.target.checked)}
                  className="w-4 h-4 bg-white border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Notify me when account creation is needed (recommended)
                </span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={autoCreateAccount}
                  onChange={(e) => setAutoCreateAccount(e.target.checked)}
                  className="w-4 h-4 bg-white border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Automatically create accounts on external job sites
                </span>
              </label>

              {autoCreateAccount && (
                <div className="ml-7 space-y-3 bg-gray-50 rounded-lg p-4">
                  <input
                    type="email"
                    value={defaultEmail}
                    onChange={(e) => setDefaultEmail(e.target.value)}
                    placeholder="Default email for accounts"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Default password for accounts"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-600">
                    These credentials will be used to create accounts on external job sites
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              isValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}