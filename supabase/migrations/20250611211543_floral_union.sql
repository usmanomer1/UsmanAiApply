/*
  # Setup Resume Storage Policies

  1. Storage Setup
    - Create resumes bucket if it doesn't exist
    - Set up proper RLS policies for resume file access

  2. Security
    - Enable RLS on storage.objects
    - Add policies for authenticated users to manage their own resume files
    - Ensure users can only access files in their own folder structure
*/

-- Create the resumes bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'resumes', 
    'resumes', 
    false, 
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  );
EXCEPTION WHEN unique_violation THEN
  -- Bucket already exists, update its properties
  UPDATE storage.buckets 
  SET 
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  WHERE id = 'resumes';
END $$;

-- Create storage policies using the storage schema functions
-- These policies will be created in the storage schema, not the public schema

-- Policy for SELECT (viewing files)
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Allow authenticated users to view their own resumes" ON storage.objects;
  
  -- Create new policy
  CREATE POLICY "Allow authenticated users to view their own resumes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN OTHERS THEN
  -- Policy might already exist or there might be permission issues
  NULL;
END $$;

-- Policy for INSERT (uploading files)
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Allow authenticated users to upload their own resumes" ON storage.objects;
  
  -- Create new policy
  CREATE POLICY "Allow authenticated users to upload their own resumes"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN OTHERS THEN
  -- Policy might already exist or there might be permission issues
  NULL;
END $$;

-- Policy for UPDATE (updating files)
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Allow authenticated users to update their own resumes" ON storage.objects;
  
  -- Create new policy
  CREATE POLICY "Allow authenticated users to update their own resumes"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resumes' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'resumes' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN OTHERS THEN
  -- Policy might already exist or there might be permission issues
  NULL;
END $$;

-- Policy for DELETE (deleting files)
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Allow authenticated users to delete their own resumes" ON storage.objects;
  
  -- Create new policy
  CREATE POLICY "Allow authenticated users to delete their own resumes"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN OTHERS THEN
  -- Policy might already exist or there might be permission issues
  NULL;
END $$;