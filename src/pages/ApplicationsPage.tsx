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
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

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
    <div className="space-y-8">
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
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
        <Card className="overflow-hidden">
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
                <TableRow>
                  <TableHead>Company & Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app, index) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-lg flex items-center justify-center mr-4">
                          <Building className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{app.company}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{app.role}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="w-4 h-4 mr-1" />
                        {app.campaign.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(app.status)}>
                        {getStatusIcon(app.status)}
                        <span className="ml-2">{app.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(app.applied_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit3 className="w-4 h-4" />
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
    </div>
  );
}; 