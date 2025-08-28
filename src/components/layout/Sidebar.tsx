import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Briefcase,
  FileText,
  User,
  Settings,
  Bell,
  Check,
  LogOut,
  Sparkles,
  Home,
  Mail,
  CreditCard,
  FolderOpen,
  Code
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [notifications, setNotifications] = useState(0);
  const [userProfile, setUserProfile] = useState<{ full_name: string; email: string; resume_url?: string } | null>(null);
  const [hasResume, setHasResume] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
    }
  };

  // Fetch user profile and check for resume
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, resume_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.warn('Sidebar: Error fetching profile:', error);
        // Set email from auth user as fallback
        if (user.email) {
          setUserProfile({ 
            full_name: user.email.split('@')[0], 
            email: user.email,
            resume_url: undefined 
          });
        }
      } else if (data) {
        setUserProfile(data);
        setHasResume(!!data.resume_url);
      }
    };
    
    fetchProfile();
  }, [user]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return;
      
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);
        
        if (!error && count !== null) {
          setNotifications(count);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    fetchNotifications();
    
    // Commented out real-time subscription to avoid WebSocket errors
    // const subscription = supabase
    //   .channel('notifications')
    //   .on(
    //     'postgres_changes',
    //     {
    //       event: '*',
    //       schema: 'public',
    //       table: 'notifications',
    //       filter: `user_id=eq.${user?.id}`
    //     },
    //     () => {
    //       fetchNotifications();
    //     }
    //   )
    //   .subscribe();
    
    // return () => {
    //   subscription.unsubscribe();
    // };
  }, [user]);

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: Home,
      description: 'Overview & stats'
    },
    { 
      path: '/jobs', 
      label: 'Jobs', 
      icon: Briefcase,
      description: 'Find opportunities'
    },
    { 
      path: '/resume', 
      label: 'Resume', 
      icon: FileText,
      description: 'AI optimization',
      showIndicator: hasResume
    },
    { 
      path: '/profile', 
      label: 'Profile', 
      icon: User,
      description: 'Your information'
    },
    { 
      path: '/auto-apply', 
      label: 'Agent', 
      icon: Sparkles,
      description: 'AI Job Applications'
    },
    { 
      path: '/applications', 
      label: 'Applications', 
      icon: FolderOpen,
      description: 'Track progress'
    },
    { 
      path: '/billing', 
      label: 'Billing', 
      icon: CreditCard,
      description: 'Subscription'
    },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-[240px] bg-white/90 backdrop-blur-sm border-r border-gray-100 flex flex-col">
      {/* Logo Area */}
      <div className="h-16 px-5 flex items-center border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <img
            src="/images/logos/light.png"
            alt="Jobotic"
            className="h-7 w-7 rounded-md shadow-sm"
          />
          <span className="text-[15px] font-semibold tracking-tight text-gray-900">Jobotic</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3.5 py-4">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`group nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <div className="relative">
                    <Icon className={`h-5 w-5 ${isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`} />
                    {item.showIndicator && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="h-2 w-2 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {item.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-gray-100">
        {/* Notifications */}
        <div className="px-3.5 py-3">
          <button
            onClick={() => navigate('/notifications')}
            className="group w-full nav-link justify-between"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
              <span className="text-sm font-medium">Notifications</span>
            </div>
            {notifications > 0 && (
              <span className="bg-emerald-500 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                {notifications}
              </span>
            )}
          </button>
        </div>

        {/* Settings */}
        <div className="px-3.5 pb-1.5">
          <Link
            to="/settings"
            className="group nav-link"
          >
            <Settings className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
            <span className="text-sm font-medium">Settings</span>
          </Link>
        </div>

        {/* User Profile */}
        <div className="p-3.5 border-t subtle-divider">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-semibold">
                {userProfile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userProfile?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userProfile?.email || user?.email || ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;