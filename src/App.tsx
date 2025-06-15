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

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 transition-colors relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent)] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.03),transparent)] pointer-events-none"></div>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
              <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>
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