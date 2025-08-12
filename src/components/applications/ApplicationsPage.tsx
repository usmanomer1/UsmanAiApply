import React, { useState, useEffect } from 'react';
import { PageHeader } from '../ui/PageHeader';
import {
  Briefcase,
  Plus,
  Filter,
  Search,
  Calendar,
  MapPin,
  Building,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  Bot,
  Edit,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Application {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string;
  location: string;
  status: string;
  applied_date: string;
  job_url?: string;
  job_description?: string;
  notes?: string;
  salary_range?: string;
  is_automated: boolean;
  source: string;
  campaign_id?: string;
  created_at: string;
  updated_at: string;
}

export const ApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    job_title: '',
    company_name: '',
    location: '',
    status: 'SENT',
    job_url: '',
    notes: '',
    applied_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchApplications();
  }, [user]);

  useEffect(() => {
    filterApplications();
  }, [applications, searchTerm, statusFilter]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      // Get applications directly by user_id (for both manual and automated applications)
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData = (data || []).map(app => ({
        id: app.id,
        user_id: app.user_id || user?.id,
        job_title: app.job_title || app.role || 'Unknown Position',
        company_name: app.company_name || app.company || 'Unknown Company',
        location: app.location || app.details?.location || 'Remote',
        status: app.status || 'pending',
        applied_date: app.applied_at || app.created_at,
        job_url: app.job_url || app.details?.job_url,
        job_description: app.job_description || app.details?.description,
        notes: app.notes || app.details?.notes,
        salary_range: app.salary_range || app.details?.salary,
        is_automated: app.is_automated !== undefined ? app.is_automated : (app.source === 'automation' || !app.source),
        source: app.source || 'automation',
        campaign_id: app.campaign_id,
        created_at: app.created_at,
        updated_at: app.updated_at || app.created_at
      }));
      
      setApplications(transformedData);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = () => {
    let filtered = applications;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(app =>
        app.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    setFilteredApplications(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get profile and campaign - handle multiple profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const profile = profiles?.[0];
      if (!profile) throw new Error('Profile not found');

      // Get or create campaign
      let { data: campaigns } = await supabase
        .from('job_campaigns')
        .select('id')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      let campaign = campaigns?.[0];

      if (!campaign) {
        // Create a manual campaign
        const { data: newCampaigns, error: campaignError } = await supabase
          .from('job_campaigns')
          .insert({
            profile_id: profile.id,
            job_title: formData.job_title,
            location: formData.location,
            work_type: 'All',
            experience_level: 'All',
            target_count: 0
          })
          .select();

        if (campaignError) throw campaignError;
        campaign = newCampaigns?.[0];
        if (!campaign) throw new Error('Failed to create campaign');
      }

      console.log('Saving application with status:', formData.status);

      if (editingApplication) {
        // Update existing application
        const { error } = await supabase
          .from('applications')
          .update({
            company: formData.company_name,
            company_name: formData.company_name, // Update both fields
            role: formData.job_title,
            job_title: formData.job_title, // Update both fields
            location: formData.location,
            job_url: formData.job_url,
            notes: formData.notes,
            status: formData.status,
            applied_at: formData.applied_date,
            updated_at: new Date().toISOString(),
            details: {
              location: formData.location,
              job_url: formData.job_url,
              notes: formData.notes,
              applied_via: 'manual'
            }
          })
          .eq('id', editingApplication.id);

        if (error) throw error;
        toast.success('Application updated successfully');
      } else {
        // Add new application
        const insertData = {
          campaign_id: campaign.id,
          user_id: user?.id, // Add user_id directly
          company: formData.company_name,
          company_name: formData.company_name, // Add both fields
          role: formData.job_title,
          job_title: formData.job_title, // Add both fields
          location: formData.location,
          job_url: formData.job_url,
          notes: formData.notes,
          applied_at: formData.applied_date,
          status: formData.status || 'SENT',
          is_automated: false,
          source: 'manual',
          details: {
            location: formData.location,
            job_url: formData.job_url,
            notes: formData.notes,
            applied_via: 'manual'
          }
        };
        
        console.log('Inserting application data:', insertData);
        
        const { error } = await supabase
          .from('applications')
          .insert(insertData);

        if (error) throw error;
        toast.success('Application added successfully');
      }

      setShowAddModal(false);
      setEditingApplication(null);
      resetForm();
      fetchApplications();
    } catch (error: any) {
      console.error('Error saving application:', error);
      // Show more specific error message
      if (error.message) {
        toast.error(error.message);
      } else if (error.code === '23505') {
        toast.error('This application already exists');
      } else if (error.code === '23503') {
        toast.error('Invalid reference. Please refresh and try again.');
      } else {
        toast.error('Failed to save application');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Application deleted');
      fetchApplications();
    } catch (error) {
      console.error('Error deleting application:', error);
      toast.error('Failed to delete application');
    }
  };

  const handleEdit = (application: Application) => {
    setEditingApplication(application);
    setFormData({
      job_title: application.job_title,
      company_name: application.company_name,
      location: application.location,
      status: application.status,
      job_url: application.job_url || '',
      notes: application.notes || '',
      applied_date: application.applied_date
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      job_title: '',
      company_name: '',
      location: '',
      status: 'pending',
      job_url: '',
      notes: '',
      applied_date: new Date().toISOString().split('T')[0]
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Applications"
        subtitle="Track and manage all your applications"
        primaryAction={{ label: 'Add Application', icon: Plus, onClick: () => { setEditingApplication(null); resetForm(); setShowAddModal(true); } }}
        actions={[{ label: 'Discover Jobs', icon: Search, href: '/jobs' }]}
      />

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="SENT">Sent</option>
              <option value="PENDING">Pending</option>
              <option value="INTERVIEW">Interview</option>
              <option value="OA">Online Assessment</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading applications...</p>
        </div>
      ) : filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        {application.job_title}
                        {application.source === 'manual' ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            Manual
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                            <Bot className="h-3 w-3 mr-1" />
                            Automated
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {application.company_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {application.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(application.applied_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
                        {getStatusIcon(application.status)}
                        <span className="ml-2 capitalize">{application.status}</span>
                      </span>
                    </div>
                  </div>
                  
                  {application.notes && (
                    <p className="text-sm text-gray-600 mb-3">{application.notes}</p>
                  )}
                  
                  <div className="flex items-center gap-3">
                    {application.job_url && (
                      <a
                        href={application.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Job Posting
                      </a>
                    )}
                    {(application.source === 'manual' || !application.is_automated) && (
                      <>
                        <button
                          onClick={() => handleEdit(application)}
                          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(application.id)}
                          className="inline-flex items-center text-sm text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No applications found</p>
          <p className="text-sm text-gray-400">Applications will appear here when you use the Auto Apply Agent</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingApplication ? 'Edit Application' : 'Add New Application'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    id="job_title"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SENT">Sent</option>
                    <option value="PENDING">Pending</option>
                    <option value="INTERVIEW">Interview</option>
                    <option value="OA">Online Assessment</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="applied_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Applied Date
                  </label>
                  <input
                    type="date"
                    id="applied_date"
                    value={formData.applied_date}
                    onChange={(e) => setFormData({ ...formData, applied_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="job_url" className="block text-sm font-medium text-gray-700 mb-1">
                    Job URL (optional)
                  </label>
                  <input
                    type="url"
                    id="job_url"
                    value={formData.job_url}
                    onChange={(e) => setFormData({ ...formData, job_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingApplication ? 'Update' : 'Add'} Application
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingApplication(null);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApplicationsPage;