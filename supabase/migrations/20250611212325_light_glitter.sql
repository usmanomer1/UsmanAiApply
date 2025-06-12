/*
  # Browser Use Integration Schema

  1. New Tables
    - `linkedin_sessions` - Store LinkedIn session data for automation
    - `browser_use_logs` - Log browser automation usage for billing
    - `automation_tasks` - Track automation task status and results

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data

  3. Changes
    - Add browser automation tracking capabilities
    - Support for LinkedIn session management
    - Usage logging for billing integration
*/

-- LinkedIn Sessions Table
CREATE TABLE IF NOT EXISTS linkedin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  cookies jsonb DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  is_valid boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Browser Use Logs Table
CREATE TABLE IF NOT EXISTS browser_use_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  step_count integer NOT NULL DEFAULT 0,
  cost_usd decimal(10,6) NOT NULL DEFAULT 0,
  task_type text NOT NULL,
  campaign_id uuid REFERENCES job_campaigns(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Automation Tasks Table
CREATE TABLE IF NOT EXISTS automation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES job_campaigns(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  task_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error_message text,
  step_count integer DEFAULT 0,
  cost_usd decimal(10,6) DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE linkedin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_use_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linkedin_sessions
CREATE POLICY "Users can manage their own LinkedIn sessions"
ON linkedin_sessions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for browser_use_logs
CREATE POLICY "Users can view their own browser use logs"
ON browser_use_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert browser use logs"
ON browser_use_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- RLS Policies for automation_tasks
CREATE POLICY "Users can manage their own automation tasks"
ON automation_tasks
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_user_id ON linkedin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_valid ON linkedin_sessions(user_id, is_valid, expires_at);
CREATE INDEX IF NOT EXISTS idx_browser_use_logs_user_id ON browser_use_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_use_logs_created_at ON browser_use_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_tasks_user_id ON automation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_tasks_campaign_id ON automation_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_automation_tasks_status ON automation_tasks(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for linkedin_sessions
CREATE TRIGGER update_linkedin_sessions_updated_at
  BEFORE UPDATE ON linkedin_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();