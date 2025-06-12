import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle, Send, HelpCircle, Clock, Building, Info, Bot } from 'lucide-react';
import { ManualOverrideQuestion } from '../../lib/browserUseAPI';

interface ManualOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: ManualOverrideQuestion[];
  onSubmit: (answers: Record<string, any>) => void;
  jobInfo?: { title: string; company: string };
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  onClose,
  questions,
  onSubmit,
  jobInfo,
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate required fields
    const missingRequired = questions.filter(q => q.required && !answers[q.id]);
    if (missingRequired.length > 0) {
      alert(`Please answer all required questions: ${missingRequired.map(q => q.question).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(answers);
      setAnswers({});
    } catch (error) {
      console.error('Error submitting answers:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const renderQuestionInput = (question: ManualOverrideQuestion) => {
    switch (question.type) {
      case 'select':
        return (
          <select
            value={answers[question.id] || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="premium-select"
            required={question.required}
          >
            <option value="">Select an option...</option>
            {question.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name={question.id}
                value="true"
                checked={answers[question.id] === 'true'}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                className="mr-2 text-blue-600"
              />
              Yes
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={question.id}
                value="false"
                checked={answers[question.id] === 'false'}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                className="mr-2 text-blue-600"
              />
              No
            </label>
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={answers[question.id] || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="premium-input"
            required={question.required}
            placeholder={question.placeholder || "Enter a number..."}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="premium-input min-h-24"
            required={question.required}
            placeholder={question.placeholder || "Enter your response..."}
            rows={3}
          />
        );

      default:
        return (
          <input
            type="text"
            value={answers[question.id] || ''}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="premium-input"
            required={question.required}
            placeholder={question.placeholder || "Enter your response..."}
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Manual Input Required</h2>
                {jobInfo && (
                  <div className="flex items-center space-x-2 text-amber-100 text-sm">
                    <Building className="w-4 h-4" />
                    <span>{jobInfo.title} at {jobInfo.company}</span>
                  </div>
                )}
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* AI Explanation */}
          <div className="mb-6">
            <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">AI Automation Paused</p>
                <p>
                  The AI has paused to request your input on this question because it could not determine 
                  the best answer automatically. Please provide your response to ensure accuracy.
                </p>
              </div>
            </div>
          </div>

          {/* Accuracy Notice */}
          <div className="mb-6">
            <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Ensure Application Accuracy</p>
                <p>
                  Your manual input helps ensure this application is filled out correctly. 
                  The automation will continue after you provide these answers.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <span className="inline-flex items-center">
                      Question {index + 1}
                      {question.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </span>
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {question.type}
                  </span>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-gray-900 dark:text-white font-medium mb-3">
                    {question.question}
                  </p>
                  
                  {question.context && (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Context:</strong> {question.context}
                      </p>
                    </div>
                  )}
                  
                  {renderQuestionInput(question)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {questions.filter(q => q.required).length} required questions
              </p>
              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                <span>Automation paused</span>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="premium-button-secondary"
                disabled={submitting}
              >
                Skip Application
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="premium-button-primary"
              >
                {submitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Continue Application
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};