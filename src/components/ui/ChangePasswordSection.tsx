import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, Check, X } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { useAuth } from '../../contexts/AuthContext';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Contains number', test: (p) => /\d/.test(p) },
  { label: 'Contains special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export const ChangePasswordSection: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { changePassword } = useAuth();

  const getPasswordStrength = (password: string) => {
    const metRequirements = passwordRequirements.filter(req => req.test(password)).length;
    if (metRequirements < 2) return { strength: 'weak', color: 'red', width: '25%' };
    if (metRequirements < 4) return { strength: 'medium', color: 'yellow', width: '50%' };
    if (metRequirements < 5) return { strength: 'good', color: 'blue', width: '75%' };
    return { strength: 'strong', color: 'green', width: '100%' };
  };

  const isFormValid = () => {
    return (
      newPassword.length >= 8 &&
      newPassword === confirmPassword &&
      passwordRequirements.every(req => req.test(newPassword))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setLoading(true);
    try {
      await changePassword(newPassword);
      // Reset form on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to change password:', error);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="premium-card p-8 hover-lift"
    >
      <div className="flex items-center mb-6">
        <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Change Password</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <Lock className="w-4 h-4 inline mr-2" />
            Current Password
          </label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="premium-input pr-12"
              placeholder="Enter your current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <Lock className="w-4 h-4 inline mr-2" />
            New Password
          </label>
          <div className="relative">
            <Input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="premium-input pr-12"
              placeholder="Enter your new password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Password Strength Indicator */}
          {newPassword && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Password strength
                </span>
                <span className={`text-xs font-medium capitalize text-${passwordStrength.color}-600 dark:text-${passwordStrength.color}-400`}>
                  {passwordStrength.strength}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-${passwordStrength.color}-500 transition-all duration-300`}
                  style={{ width: passwordStrength.width }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            <Lock className="w-4 h-4 inline mr-2" />
            Confirm New Password
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="premium-input pr-12"
              placeholder="Confirm your new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Password Match Indicator */}
          {confirmPassword && (
            <div className="mt-2 flex items-center">
              {newPassword === confirmPassword ? (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4 mr-1" />
                  <span className="text-sm">Passwords match</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <X className="w-4 h-4 mr-1" />
                  <span className="text-sm">Passwords don't match</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Requirements */}
        {newPassword && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Password Requirements:
            </h4>
            <div className="space-y-2">
              {passwordRequirements.map((requirement, index) => (
                <div key={index} className="flex items-center">
                  {requirement.test(newPassword) ? (
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400 mr-2" />
                  )}
                  <span className={`text-sm ${
                    requirement.test(newPassword) 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {requirement.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={loading || !isFormValid()}
            className="premium-button-primary w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Changing Password...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Shield className="w-4 h-4 mr-2" />
                Change Password
              </div>
            )}
          </Button>
        </div>

        {/* Security Note */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
            <div>
              <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Security Tips</p>
              <ul className="text-blue-600 dark:text-blue-400 text-sm space-y-1">
                <li>• Use a unique password you don't use elsewhere</li>
                <li>• Consider using a password manager</li>
                <li>• You'll remain signed in after changing your password</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
}; 