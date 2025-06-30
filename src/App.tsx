import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import CustomAuthPage from './components/auth/CustomAuthPage';
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

function BoltBadge() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return (
    <a
      href="https://bolt.new"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-2 right-4 z-[100]"
      aria-label="Bolt - Build apps and sites in chat"
      style={{ textDecoration: 'none' }}
    >
      <img
        src={isDark ? '/images/logos/white_circle_360x360.png' : '/images/logos/black_circle_360x360.png'}
        alt="Bolt Badge"
        className="w-16 h-16 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 transition-all hover:scale-105 hover:shadow-xl"
      />
    </a>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors relative overflow-hidden">
            <BoltBadge />
            <Routes>
              <Route path="/auth" element={<CustomAuthPage />} />
              <Route path="/legacy-auth" element={<AuthPage />} />
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