import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import CustomAuthPage from './components/auth/CustomAuthPage';
import PasswordResetPage from './components/auth/PasswordResetPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import ProfilePage from './components/ProfilePage';
import ModernResumePage from './components/ModernResumePage';
import ModernLinkedInAutomationBot from './components/ModernLinkedInAutomationBot';
import { SuccessPage } from './components/SuccessPage';
import JobSearchPage from './components/JobSearchPage';
import { BillingPage } from './components/billing/BillingPage';
import SettingsPage from './components/SettingsPage';
import Dashboard from './components/dashboard/Dashboard';
import ApplicationsPage from './components/applications/ApplicationsPage';
import NotificationsPage from './components/NotificationsPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/auth" element={<CustomAuthPage />} />
              <Route path="/reset-password" element={<PasswordResetPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <div className="flex">
                      <Sidebar />
                      <main className="flex-1 ml-[240px]">
                        <div className="p-8 relative z-0">
                          <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/jobs" element={<JobSearchPage />} />
                            <Route path="/applications" element={<ApplicationsPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/auto-apply" element={<ModernLinkedInAutomationBot />} />
                            <Route path="/resume" element={<ModernResumePage />} />
                            <Route path="/billing" element={<BillingPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          </Routes>
                        </div>
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#1f2937',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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