import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Check,
  Trash2,
  Archive,
  Filter,
  Search,
  Loader2,
  Info,
  AlertCircle,
  CheckCircle,
  Star,
  Briefcase,
  FileText,
  MessageSquare,
  Settings,
  ChevronRight,
  Calendar,
  Clock,
  Inbox
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'job_match' | 'application_update';
  icon_name?: string;
  read: boolean;
  data?: any;
  created_at: string;
  updated_at: string;
}

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchNotifications();
    
    // Commented out real-time subscription to avoid WebSocket errors
    // const subscription = supabase
    //   .channel('notifications-page')
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

  const fetchNotifications = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user!.id);
      
      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user!.id)
        .eq('read', false);
      
      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user!.id);
      
      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const deleteAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user!.id)
        .eq('read', true);
      
      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => !n.read));
      toast.success('All read notifications deleted');
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      toast.error('Failed to delete read notifications');
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'job_match':
        return <Briefcase className="h-5 w-5 text-teal-500" />;
      case 'application_update':
        return <FileText className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const filteredNotifications = notifications
    .filter(n => filter === 'all' || !n.read)
    .filter(n => selectedType === 'all' || n.type === selectedType);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Stay updated with your job search activity
              </p>
            </div>
            
            {unreadCount > 0 && (
              <div className="bg-teal-50 dark:bg-teal-900/20 px-4 py-2 rounded-lg">
                <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  {unreadCount} unread
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                  filter === 'all'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                  filter === 'unread'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Unread
              </button>
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <option value="all">All Types</option>
              <option value="job_match">Job Matches</option>
              <option value="application_update">Application Updates</option>
              <option value="info">Information</option>
              <option value="success">Success</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Mark all as read
              </button>
            )}
            {notifications.some(n => n.read) && (
              <button
                onClick={deleteAllRead}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Clear read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center"
          >
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                {filter === 'unread' ? (
                  <Bell className="h-8 w-8 text-gray-400" />
                ) : (
                  <Inbox className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filter === 'unread' 
                  ? "You've read all your notifications. Check back later for new updates."
                  : "We'll notify you when there are new job matches or updates to your applications."
                }
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all ${
                    !notification.read ? 'border-l-4 border-l-teal-500' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`text-sm font-medium ${
                            !notification.read 
                              ? 'text-gray-900 dark:text-white' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {notification.title}
                          </h4>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {notification.data?.action_url && (
                        <button className="mt-3 inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                          View Details
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;