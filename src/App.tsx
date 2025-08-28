import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ConvexAuthProvider } from './providers/ConvexAuthProvider';
import CustomAuthPage from './components/auth/CustomAuthPage';
import PasswordResetPage from './components/auth/PasswordResetPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import ProfilePage from './components/ProfilePage';
import { ResumePage } from './components/ResumePage';
import LinkedInAutomationBot from './components/LinkedInAutomationBot';
import { SuccessPage } from './components/SuccessPage';
import JobSearchConvex from './components/JobSearchConvex';
import { BillingPage } from './components/billing/BillingPage';
import SettingsPage from './components/SettingsPage';
import MacOSDashboard from './components/MacOSDashboard';
import ApplicationsPage from './components/applications/ApplicationsPage';
import NotificationsPage from './components/NotificationsPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConvexAuthProvider>
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
                          {/* Subtle global background accents */}
                          <div
                            className="fixed inset-0 -z-10 pointer-events-none opacity-90"
                            style={{
                              background:
                                'radial-gradient(700px 160px at 8% -12%, #14b8a61a 0%, transparent 60%),' +
                                'radial-gradient(560px 130px at 110% 112%, #3b82f61a 0%, transparent 60%)'
                            }}
                          />
                          <div className="p-8 relative z-0">
                            <Routes>
                              <Route path="/dashboard" element={<MacOSDashboard />} />
                              <Route path="/jobs" element={<JobSearchConvex />} />
                              <Route path="/applications" element={<ApplicationsPage />} />
                              <Route path="/profile" element={<ProfilePage />} />
                              <Route path="/auto-apply" element={<LinkedInAutomationBot />} />
                              <Route path="/resume" element={<ResumePage />} />
                              <Route path="/billing" element={<BillingPage />} />
                              {/* Removed legacy settings route to avoid confusing page */}
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
        </ConvexAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;