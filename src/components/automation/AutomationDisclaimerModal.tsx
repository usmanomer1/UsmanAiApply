import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X, Bot, Shield, Eye } from 'lucide-react';

interface AutomationDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  jobCriteria?: {
    jobTitle: string;
    location: string;
    targetCount: number;
  };
}

export const AutomationDisclaimerModal: React.FC<AutomationDisclaimerModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  jobCriteria,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">AI Automation Disclaimer</h2>
                <p className="text-amber-100 text-sm">Important information before starting</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Job Criteria Summary */}
          {jobCriteria && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Automation Settings</h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p><strong>Position:</strong> {jobCriteria.jobTitle}</p>
                <p><strong>Location:</strong> {jobCriteria.location}</p>
                <p><strong>Target Applications:</strong> {jobCriteria.targetCount}</p>
              </div>
            </div>
          )}

          {/* Main Disclaimer */}
          <div className="mb-6">
            <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <Bot className="w-6 h-6 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  AI Automation Accuracy Notice
                </h3>
                <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                  <strong>Important:</strong> The AI agent automatically fills job application forms based on your profile information. 
                  Some dynamic or uncommon fields may be filled with generic or placeholder information. 
                  <strong> Please review your applications carefully before submitting.</strong>
                </p>
              </div>
            </div>
          </div>

          {/* What the AI Does */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              What Our AI Handles Well
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Basic contact information',
                'Work experience details',
                'Education background',
                'Standard application questions',
                'Resume and cover letter upload',
                'Common form fields'
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Limitations */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
              Potential Limitations
            </h3>
            <div className="space-y-3">
              {[
                {
                  title: 'Dynamic Questions',
                  description: 'Company-specific or situational questions may receive generic responses'
                },
                {
                  title: 'Salary Expectations',
                  description: 'May use placeholder values like "Competitive" or "Negotiable"'
                },
                {
                  title: 'Custom Fields',
                  description: 'Unusual or highly specific form fields might be auto-filled with defaults'
                },
                {
                  title: 'File Uploads',
                  description: 'Additional documents beyond resume may not be uploaded automatically'
                }
              ].map((item, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</p>
                    <p className="text-gray-600 dark:text-gray-300 text-xs">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manual Override Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-start space-x-3">
              <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Manual Override Available</h4>
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  When the AI encounters unclear questions, it will pause and ask for your input to ensure accuracy. 
                  You can also stop the automation at any time to review applications manually.
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Shield className="w-5 h-5 text-blue-500 mr-2" />
              Our Recommendations
            </h3>
            <div className="space-y-2">
              {[
                'Review your profile information before starting automation',
                'Monitor the automation process and use manual override when needed',
                'Check submitted applications in your LinkedIn account',
                'Follow up on important applications with personalized messages',
                'Keep your resume and profile information up to date'
              ].map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{recommendation}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                required
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I understand that AI automation may not be 100% accurate for all form fields, and I will review 
                my applications to ensure accuracy. I acknowledge that I am responsible for the content of my job applications.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 premium-button-secondary"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              className="flex-1 premium-button-primary"
            >
              I Understand - Start Automation
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};