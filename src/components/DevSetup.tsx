import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Database, Loader } from 'lucide-react';

const DevSetup: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (log: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${log}`]);
  };

  const setupTables = async () => {
    setStatus('running');
    setMessage('');
    setLogs([]);
    
    try {
      addLog('Starting database setup...');

      // Create profiles table
      addLog('Creating profiles table...');
      const { error: profilesError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            full_name TEXT,
            phone TEXT,
            resume_url TEXT,
            resume_text TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id)
          );
        `
      }).single();

      if (profilesError && !profilesError.message.includes('already exists')) {
        // Try direct query if RPC doesn't work
        const { error: directError } = await supabase.from('profiles').select('id').limit(1);
        if (directError && directError.code === '42P01') {
          // Table doesn't exist, try to create it differently
          throw new Error('Cannot create tables via RPC. Please run the SQL manually in Supabase dashboard.');
        }
      }

      // Check if table exists by trying to query it
      addLog('Checking if profiles table exists...');
      const { data: profileCheck, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === '42P01') {
        throw new Error('Profiles table does not exist. Please create it manually in Supabase dashboard.');
      }

      addLog('Profiles table verified!');

      // Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('No authenticated user found');
      }

      addLog(`Current user: ${user.email}`);

      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (!existingProfile) {
        // Create profile for current user
        addLog('Creating profile for current user...');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          });

        if (insertError) {
          throw insertError;
        }
        addLog('Profile created successfully!');
      } else {
        addLog('Profile already exists for current user');
      }

      // Check storage bucket
      addLog('Checking storage bucket...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (!bucketsError) {
        const resumesBucket = buckets.find(b => b.id === 'resumes');
        if (resumesBucket) {
          addLog('Resumes storage bucket exists');
        } else {
          addLog('Resumes storage bucket not found - create it in Supabase dashboard');
        }
      }

      setStatus('success');
      setMessage('Database setup completed successfully!');
      addLog('Setup completed!');

    } catch (error) {
      console.error('Setup error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Setup failed');
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testProfileOperations = async () => {
    setStatus('running');
    setLogs([]);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Test read
      addLog('Testing profile read...');
      const { data: profile, error: readError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (readError) throw readError;
      addLog('✓ Profile read successful');

      // Test update
      addLog('Testing profile update...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          full_name: profile.full_name || 'Test User',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      addLog('✓ Profile update successful');

      setStatus('success');
      setMessage('All profile operations working correctly!');
      
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Test failed');
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Database className="w-6 h-6" />
          Development Database Setup
        </h2>

        <div className="space-y-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Current Supabase Instance:</strong><br />
              URL: {import.meta.env.VITE_SUPABASE_URL}<br />
              This tool will help set up the necessary tables for the profile functionality.
            </p>
          </div>

          {message && (
            <div className={`rounded-lg p-4 flex items-start gap-3 ${
              status === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                : status === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : ''
            }`}>
              {status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              ) : null}
              <span className={`text-sm ${
                status === 'success' 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {message}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={setupTables}
            disabled={status === 'running'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {status === 'running' ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Running Setup...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Setup Database
              </>
            )}
          </button>

          <button
            onClick={testProfileOperations}
            disabled={status === 'running'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Test Profile Operations
          </button>
        </div>

        {logs.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Setup Logs:</h3>
            <div className="space-y-1 font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="text-gray-600 dark:text-gray-400">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Manual Setup Required:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-amber-700 dark:text-amber-300">
              <li>Go to your Supabase dashboard</li>
              <li>Navigate to the SQL Editor</li>
              <li>Copy the contents of <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">setup-dev-tables.sql</code></li>
              <li>Run the SQL commands</li>
              <li>Return here and click "Test Profile Operations" to verify</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevSetup;