import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  analyzeResume as analyzeResumeApi,
  generateOptimizedResume as generateOptimizedResumeApi,
  downloadResume as downloadResumeApi,
  validateResumeFile,
  getErrorMessage,
  type AnalyzeResponse,
  type GenerateResponse
} from '../lib/resumeApiClient';

export function useResumeOptimizer() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);

  const analyzeResume = useCallback(async (
    resumeFile: File,
    jobDescription: string,
    jobTitle: string,
    companyName: string
  ) => {
    console.log('useResumeOptimizer.analyzeResume called');
    console.log('User ID:', user?.id);
    
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Validate file
    const fileError = validateResumeFile(resumeFile);
    if (fileError) {
      setError(fileError);
      throw new Error(fileError);
    }

    console.log('File validation passed, calling API...');
    setLoading(true);
    setError(null);
    
    try {
      const result = await analyzeResumeApi(
        user.id,
        resumeFile,
        jobDescription,
        jobTitle,
        companyName
      );

      console.log('API response received:', result);
      setAnalysisResult(result);
      return result;
    } catch (err) {
      console.error('API call failed:', err);
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generateOptimizedResume = useCallback(async (
    editType: 'quick' | 'full' = 'full',
    selectedSections: string[] = [],
    selectedSkills: string[] = [],
    additionalInstructions: string = ''
  ) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!analysisResult?.data?.analysisId) {
      throw new Error('No analysis result available');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateOptimizedResumeApi(
        user.id,
        analysisResult.data.analysisId,
        editType,
        selectedSections,
        selectedSkills,
        additionalInstructions
      );

      setGenerationResult(result);
      return result;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, analysisResult]);

  const downloadResume = useCallback(async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!generationResult?.data?.generationId) {
      throw new Error('No generated resume available');
    }

    try {
      // For direct download URL approach
      if (generationResult.data.downloadUrl) {
        // Use the direct download URL from the generation response
        window.open(generationResult.data.downloadUrl, '_blank');
      } else {
        // Fallback to API download
        const downloadUrl = await downloadResumeApi(user.id, generationResult.data.generationId);
        window.open(downloadUrl, '_blank');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, [user, generationResult]);

  const reset = useCallback(() => {
    setAnalysisResult(null);
    setGenerationResult(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    analysisResult,
    generationResult,
    analyzeResume,
    generateOptimizedResume,
    downloadResume,
    reset,
  };
}