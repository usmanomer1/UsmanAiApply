import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Building, 
  Calendar, 
  MapPin, 
  Briefcase, 
  Search,
  Filter,
  Download,
  Eye,
  Edit3,
  TrendingUp,
  Clock,
  XCircle,
  CheckCircle,
  Users,
  X,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import ConditionalBackground from '../components/ui/ConditionalBackground';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';

interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: 'SENT' | 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'INTERVIEW' | 'OA';
  applied_at: string;
  details: any;
  created_at: string;
  campaign: {
    job_title: string;
    location: string;
  };
}

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const fetchApplications = async () => {
    try {
      setError(null);
      
      if (!isSupabaseConfigured()) {
        setError('Database not configured. Please set up Supabase to view applications.');
        setApplications([]);
        return;
      }

      if (!user) {
        setError('Please log in to view your applications.');
        setApplications([]);
        return;
      }

      // Fetch applications with campaign details using the correct table structure
      const { data, error: fetchError } = await supabase
        .from('applications')
        .select(`
          *,
          job_campaigns!campaign_id(
            job_title,
            location,
            profiles!inner(
              user_id
            )
          )
        `)
        .eq('job_campaigns.profiles.user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching applications:', fetchError);
        setError(`Failed to fetch applications: ${fetchError.message}`);
        setApplications([]);
        return;
      }

      // Transform data to match our interface
      const transformedApplications: JobApplication[] = (data || []).map(app => ({
        id: app.id,
        company: app.company || 'Unknown Company',
        role: app.role || 'Unknown Role',
        status: (app.status || 'SENT') as JobApplication['status'],
        applied_at: app.applied_at || app.created_at,
        details: app.details || {},
        created_at: app.created_at,
        campaign: {
          job_title: app.job_campaigns?.job_title || app.role || 'Unknown Role',
          location: app.job_campaigns?.location || 'Not specified'
        }
      }));

      setApplications(transformedApplications);
      
    } catch (error) {
      console.error('Unexpected error fetching applications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to fetch applications: ${errorMessage}`);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [user]);

  const handleViewApplication = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsViewDialogOpen(true);
  };

  const handleEditApplication = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsEditDialogOpen(true);
  };

  const handleDeleteApplication = async (application: JobApplication) => {
    if (!isSupabaseConfigured() || !user) {
      toast.error('Database not configured');
      return;
    }

    setDeletingId(application.id);
    
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', application.id);

      if (error) {
        throw error;
      }

      // Remove from local state
      setApplications(prev => prev.filter(app => app.id !== application.id));
      toast.success('Application deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedApplication(null);
    } catch (error) {
      console.error('Error deleting application:', error);
      toast.error('Failed to delete application');
    } finally {
      setDeletingId(null);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: JobApplication['status']) => {
    if (!isSupabaseConfigured() || !user) {
      toast.error('Database not configured');
      return;
    }

    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) {
        throw error;
      }

      // Update local state
      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );
      
      toast.success('Application status updated');
      setIsEditDialogOpen(false);
      setSelectedApplication(null);
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('Failed to update application');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'ACCEPTED': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'INTERVIEW': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'OA': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return <TrendingUp className="w-4 h-4" />;
      case 'PENDING': return <Clock className="w-4 h-4" />;
      case 'REJECTED': return <XCircle className="w-4 h-4" />;
      case 'ACCEPTED': return <CheckCircle className="w-4 h-4" />;
      case 'INTERVIEW': return <Users className="w-4 h-4" />;
      case 'OA': return <Calendar className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = !searchTerm.trim() || 
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.campaign.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.campaign.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-80 mb-4"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConditionalBackground className="fixed inset-0 z-0" animate={false} />
      <div className="relative min-h-screen space-y-8 z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Applications</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {error ? 'Unable to load applications' : `${filteredApplications.length} applications found`}
            </p>
          </div>
        </div>
        
        {!error && (
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 w-4 h-4 pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 w-64 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="INTERVIEW">Interview</SelectItem>
                <SelectItem value="OA">Online Assessment</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="overflow-hidden glass-card">
        {error ? (
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Unable to Load Applications
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {error}
            </p>
            <div className="flex items-center justify-center space-x-3">
              <Button onClick={fetchApplications}>
                Try Again
              </Button>
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="secondary"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {applications.length === 0 ? 'No Applications Yet' : 'No Matching Applications'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {applications.length === 0 
                ? 'Start applying to jobs to see your applications here.' 
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              {applications.length === 0 ? 'Start Applying' : 'Back to Dashboard'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 dark:border-gray-700">
                  <TableHead className="text-base font-bold text-gray-900 dark:text-white py-4">Company & Role</TableHead>
                  <TableHead className="text-base font-bold text-gray-900 dark:text-white py-4">Location</TableHead>
                  <TableHead className="text-base font-bold text-gray-900 dark:text-white py-4">Status</TableHead>
                  <TableHead className="text-base font-bold text-gray-900 dark:text-white py-4">Applied Date</TableHead>
                  <TableHead className="text-base font-bold text-gray-900 dark:text-white py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app, index) => (
                  <TableRow key={app.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <TableCell className="py-5">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-xl flex items-center justify-center mr-4">
                          <Building className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                          <div className="text-base font-bold text-gray-900 dark:text-white">{app.company}</div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{app.role}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        <MapPin className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                        {app.campaign.location}
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <Badge className={getStatusColor(app.status)}>
                        {getStatusIcon(app.status)}
                        <span className="ml-2 font-semibold">{app.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Calendar className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                        {new Date(app.applied_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-5">
                      <div className="flex items-center justify-end space-x-2">
                        {app.details?.url && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => window.open(app.details.url, '_blank')}
                            className="hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewApplication(app)}
                          className="hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditApplication(app)}
                          className="hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-600 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-300"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedApplication(app);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </Card>
      </motion.div>

      {/* View Application Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/25 dark:border-white/15 shadow-2xl rounded-3xl">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center space-x-3 text-2xl font-bold text-gray-900 dark:text-white">
              <Building className="w-7 h-7" />
              <span>Application Details</span>
            </DialogTitle>
            <DialogDescription className="text-base text-gray-700 dark:text-gray-300 mt-2">
              View detailed information about this job application
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Company</label>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{selectedApplication.company}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Role</label>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{selectedApplication.role}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Status</label>
                  <Badge className={`${getStatusColor(selectedApplication.status)} text-base px-4 py-2`}>
                    {getStatusIcon(selectedApplication.status)}
                    <span className="ml-2 font-bold">{selectedApplication.status}</span>
                  </Badge>
                </div>
                <div className="space-y-2">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Applied Date</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(selectedApplication.applied_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Location</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedApplication.campaign.location}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Job Title</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedApplication.campaign.job_title}</p>
                </div>
              </div>
              {selectedApplication.details?.url && (
                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="text-base font-bold text-gray-800 dark:text-gray-200">Job Posting URL</label>
                  <a 
                    href={selectedApplication.details.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Job Posting
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Application Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>Edit Application</span>
            </DialogTitle>
            <DialogDescription>
              Update the status of this job application
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {selectedApplication.company} - {selectedApplication.role}
                </p>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Application Status
                </label>
                <Select 
                  value={selectedApplication.status} 
                  onValueChange={(value) => updateApplicationStatus(selectedApplication.id, value as JobApplication['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="INTERVIEW">Interview</SelectItem>
                    <SelectItem value="OA">Online Assessment</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              <span>Delete Application</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>{selectedApplication.company}</strong> - {selectedApplication.role}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Applied on {new Date(selectedApplication.applied_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={deletingId === selectedApplication.id}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleDeleteApplication(selectedApplication)}
                  disabled={deletingId === selectedApplication.id}
                >
                  {deletingId === selectedApplication.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Application
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};