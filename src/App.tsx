import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { BillingPage } from './components/billing/BillingPage';
import { ProfilePage } from './components/ProfilePage';
import { ResumeTools } from './components/ResumeTools';
import { CVGeneration } from './components/CVGeneration';
import { CoverLetterTool } from './components/CoverLetterTool';
import LinkedInAutomationBot from './components/LinkedInAutomationBot';
import { SuccessPage } from './components/SuccessPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import InterviewPractice from './components/InterviewPractice';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors relative overflow-hidden">
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <Routes>
                        <Route path="/dashboard" element={<DashboardHome />} />
                        <Route path="/auto-apply" element={<LinkedInAutomationBot />} />
                        <Route path="/applications" element={<ApplicationsPage />} />
                        <Route path="/interview-practice" element={<InterviewPractice />} />
                        <Route path="/billing" element={<BillingPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/resume" element={<ResumeTools />} />
                        <Route path="/cv-generator" element={<CVGeneration />} />
                        <Route path="/cover-letter" element={<CoverLetterTool />} />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </main>
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-color)',
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;