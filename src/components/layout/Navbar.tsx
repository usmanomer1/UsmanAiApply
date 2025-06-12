import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  BarChart3, 
  FileText, 
  PenTool, 
  CreditCard, 
  User, 
  Settings, 
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Zap,
  Search,
  Bell,
  Command,
  ChevronDown,
  Crown,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [notifications, setNotifications] = useState(3);
  const [userPlan, setUserPlan] = useState<string>('Free');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [showSupabaseWarning, setShowSupabaseWarning] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3, description: 'Overview & Analytics' },
    { name: 'Auto Apply', href: '/auto-apply', icon: Zap, description: 'AI Job Applications', badge: 'New' },
    { name: 'Cover Letters', href: '/cover-letter', icon: PenTool, description: 'AI-Generated Letters' },
    { name: 'Resume Tools', href: '/resume', icon: FileText, description: 'Resume Optimization' },
    { name: 'CV Generator', href: '/cv-generator', icon: Bot, description: 'AI CV Generation', badge: 'AI' },
    { name: 'Profile', href: '/profile', icon: User, description: 'Personal Information' },
    { name: 'Billing', href: '/billing', icon: CreditCard, description: 'Plans & Usage' },
  ];

  const quickActions = [
    { name: 'Start Auto Apply', href: '/auto-apply', icon: Zap, description: 'Begin automated job applications' },
    { name: 'Generate CV', href: '/cv-generator', icon: Bot, description: 'Create AI-powered CV' },
    { name: 'Generate Cover Letter', href: '/cover-letter', icon: PenTool, description: 'Write personalized cover letters' },
    { name: 'Analyze Resume', href: '/resume', icon: FileText, description: 'Get AI resume feedback' },
    { name: 'View Analytics', href: '/dashboard', icon: BarChart3, description: 'Check your job search progress' },
    { name: 'Manage Profile', href: '/profile', icon: User, description: 'Update personal information' },
    { name: 'Subscription Settings', href: '/billing', icon: CreditCard, description: 'Manage billing and plans' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Escape to close search
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsProfileOpen(false);
        setIsMobileMenuOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchUserSubscription();
    checkSupabaseConnection();
  }, [user]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    // Search through navigation items
    navigation.forEach(item => {
      if (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'navigation',
          ...item
        });
      }
    });

    // Search through quick actions
    quickActions.forEach(action => {
      if (
        action.name.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'action',
          ...action
        });
      }
    });

    // Add some contextual search suggestions
    if (query.includes('job') || query.includes('apply')) {
      results.unshift({
        type: 'suggestion',
        name: 'Start Job Applications',
        href: '/auto-apply',
        icon: Zap,
        description: 'Begin automated job applications with AI'
      });
    }

    if (query.includes('resume') || query.includes('cv')) {
      results.unshift({
        type: 'suggestion',
        name: 'Resume Tools',
        href: '/resume',
        icon: FileText,
        description: 'Analyze and improve your resume'
      });
    }

    if (query.includes('cover') || query.includes('letter')) {
      results.unshift({
        type: 'suggestion',
        name: 'Cover Letter Generator',
        href: '/cover-letter',
        icon: PenTool,
        description: 'Create personalized cover letters'
      });
    }

    setSearchResults(results.slice(0, 8)); // Limit to 8 results
  }, [searchQuery]);

  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(supabaseUrl && supabaseKey && 
      supabaseUrl !== 'your_supabase_url_here' && 
      supabaseKey !== 'your_supabase_anon_key_here' &&
      supabaseUrl.startsWith('https://') &&
      supabaseUrl.includes('.supabase.co') &&
      supabaseKey.length > 50
    );
  };

  const checkSupabaseConnection = () => {
    const configured = isSupabaseConfigured();
    if (!configured && user) {
      setShowSupabaseWarning(true);
      // Auto-hide warning after 10 seconds
      setTimeout(() => setShowSupabaseWarning(false), 10000);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      if (!isSupabaseConfigured() || !user) {
        setUserPlan('Demo');
        setHasActiveSubscription(false);
        return;
      }

      // Fetch subscription using the view
      const { data: subData, error: subError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        setUserPlan('Free');
        setHasActiveSubscription(false);
        return;
      }

      if (subData && subData.subscription_status === 'active') {
        // Determine plan name from price_id
        let planName = 'Pro';
        if (subData.price_id === 'price_1RYvjSQGabzJD80BbbXxTq2S') {
          planName = 'Pro Plus';
        } else if (subData.price_id === 'price_1RYvocQGabzJD80BEVgRcdSa') {
          planName = 'Extreme';
        }
        
        setUserPlan(planName);
        setHasActiveSubscription(true);
      } else {
        setUserPlan('Free');
        setHasActiveSubscription(false);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setUserPlan('Free');
      setHasActiveSubscription(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation even if sign out fails
      navigate('/auth');
    }
  };

  const handleSearchSelect = (result: any) => {
    navigate(result.href);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    }
  };

  return (
    <>
      {/* Supabase Connection Warning */}
      <AnimatePresence>
        {showSupabaseWarning && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="bg-amber-500 text-white px-4 py-3 text-center relative"
          >
            <div className="flex items-center justify-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Supabase not connected - Click "Connect to Supabase" in the top-right corner to enable full functionality
              </span>
              <button
                onClick={() => setShowSupabaseWarning(false)}
                className="ml-4 hover:bg-white/20 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  {hasActiveSubscription && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="hidden sm:block">
                  <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    AIApply
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                    {hasActiveSubscription ? 'Premium' : isSupabaseConfigured() ? 'Free' : 'Demo'}
                  </div>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden md:flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 text-gray-600 dark:text-gray-300"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">Search</span>
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </button>

              {/* Mobile search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              {/* Notifications */}
              <button className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user?.email?.split('@')[0] || 'Demo User'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      {hasActiveSubscription && <Crown className="w-3 h-3 mr-1 text-yellow-500" />}
                      {userPlan} Plan
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user?.email?.split('@')[0] || 'Demo User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user?.email || 'demo@aiapply.com'}
                            </p>
                            <div className="flex items-center mt-1">
                              {hasActiveSubscription && <Crown className="w-3 h-3 mr-1 text-yellow-500" />}
                              <span className={`text-xs font-medium ${
                                hasActiveSubscription 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {userPlan} Plan {hasActiveSubscription ? 'Active' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="py-2">
                        <Link
                          to="/profile"
                          onClick={() => setIsProfileOpen(false)}
                          className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <User className="w-4 h-4 mr-3" />
                          Profile Settings
                        </Link>
                        
                        <Link
                          to="/billing"
                          onClick={() => setIsProfileOpen(false)}
                          className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <CreditCard className="w-4 h-4 mr-3" />
                          {hasActiveSubscription ? 'Manage Subscription' : 'Upgrade Plan'}
                        </Link>
                        
                        <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <Settings className="w-4 h-4 mr-3" />
                          Account Settings
                        </button>
                        
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-4"
              >
                <div className="space-y-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5" />
                          <div>
                            <div>{item.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                          </div>
                        </div>
                        {item.badge && (
                          <span className="px-2 py-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Enhanced Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3 mb-6">
                  <Search className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for features, pages, or actions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-lg bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
                    autoFocus
                  />
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <span>ESC</span>
                  </div>
                </form>

                {searchQuery === '' ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      {quickActions.slice(0, 5).map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.name}
                            onClick={() => handleSearchSelect(action)}
                            className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <Icon className="w-5 h-5 text-gray-400" />
                            <div>
                              <div className="text-gray-900 dark:text-white font-medium">{action.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{action.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    {searchResults.length > 0 ? (
                      <>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Search Results ({searchResults.length})
                        </h3>
                        <div className="space-y-2">
                          {searchResults.map((result, index) => {
                            const Icon = result.icon;
                            return (
                              <button
                                key={`${result.type}-${result.name}-${index}`}
                                onClick={() => handleSearchSelect(result)}
                                className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <Icon className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                  <div className="text-gray-900 dark:text-white font-medium">{result.name}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{result.description}</div>
                                </div>
                                {result.type === 'suggestion' && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                    Suggested
                                  </span>
                                )}
                                {result.badge && (
                                  <span className="px-2 py-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold rounded-full">
                                    {result.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          No results found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Try searching for "resume", "jobs", "cover letter", or "billing"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};