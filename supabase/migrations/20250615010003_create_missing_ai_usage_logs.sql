/*
  # Create Missing AI Usage Logs Table
  
  This table is required by our security functions for tracking AI tool usage
  (OpenAI API calls for CV generation, cover letters, etc.)
  
  Our check_feature_access() and record_feature_usage() functions expect this table.
*/

-- Create AI usage logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_type text NOT NULL, -- 'cv_generation', 'cover_letter', 'interview_prep', etc.
  ai_requests_used integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  request_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own data
CREATE POLICY "Users can view their own AI usage logs"
ON ai_usage_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own AI usage logs"
ON ai_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_month ON ai_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tool_type ON ai_usage_logs(tool_type);

-- Add helpful comment
COMMENT ON TABLE ai_usage_logs IS 'Tracks AI tool usage for billing and quota enforcement';
COMMENT ON COLUMN ai_usage_logs.tool_type IS 'Type of AI tool used: cv_generation, cover_letter, interview_prep, etc.';
COMMENT ON COLUMN ai_usage_logs.ai_requests_used IS 'Number of AI tokens/requests consumed';
COMMENT ON COLUMN ai_usage_logs.cost_usd IS 'Cost in USD for this AI usage'; 