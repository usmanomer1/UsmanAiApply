/*
  # AI Token Usage Tracking Schema

  1. New Tables
    - `ai_token_usage` - Track OpenAI API token usage per user
      - Tracks prompt tokens, completion tokens, and total tokens
      - Records operation type (resume_rewrite, cover_letter, etc.)
      - Links to user for usage limits and billing

  2. Security
    - Enable RLS on new table
    - Add policies for authenticated users to manage their own data

  3. Functions
    - Add trigger to automatically calculate total tokens
    - Add function to check user token limits
*/

-- AI Token Usage Table
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type text NOT NULL CHECK (operation_type IN (
    'resume_score', 'resume_critique', 'resume_rewrite', 
    'cover_letter', 'cv_generation', 'company_research'
  )),
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  max_tokens_requested integer NOT NULL DEFAULT 0,
  model_used text NOT NULL DEFAULT 'gpt-4o-mini',
  request_data jsonb DEFAULT '{}'::jsonb,
  response_data jsonb DEFAULT '{}'::jsonb,
  cost_usd decimal(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_token_usage
CREATE POLICY "Users can view their own AI token usage"
ON ai_token_usage
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert AI token usage"
ON ai_token_usage
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at ON ai_token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_operation_type ON ai_token_usage(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_month ON ai_token_usage(user_id, created_at);

-- Function to calculate total tokens
CREATE OR REPLACE FUNCTION calculate_total_tokens()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_tokens = NEW.prompt_tokens + NEW.completion_tokens;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically calculate total tokens
CREATE TRIGGER calculate_ai_token_totals
  BEFORE INSERT OR UPDATE ON ai_token_usage
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_tokens();

-- Function to get user's monthly AI token usage
CREATE OR REPLACE FUNCTION get_user_monthly_ai_tokens(user_uuid uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(total_tokens bigint, operation_counts jsonb) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(atu.total_tokens), 0) as total_tokens,
    COALESCE(
      jsonb_object_agg(
        atu.operation_type, 
        COUNT(*)
      ) FILTER (WHERE atu.operation_type IS NOT NULL),
      '{}'::jsonb
    ) as operation_counts
  FROM ai_token_usage atu
  WHERE atu.user_id = user_uuid
    AND DATE_TRUNC('month', atu.created_at) = DATE_TRUNC('month', target_date::timestamptz);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can make AI request (150k monthly limit)
CREATE OR REPLACE FUNCTION can_user_make_ai_request(
  user_uuid uuid, 
  estimated_tokens integer DEFAULT 1000
)
RETURNS boolean AS $$
DECLARE
  current_usage bigint;
  monthly_limit integer := 150000; -- 150k tokens for active subscribers
  user_subscription_status text;
BEGIN
  -- Check if user has an active subscription
  SELECT s.status INTO user_subscription_status
  FROM stripe_subscriptions s
  JOIN stripe_customers c ON s.customer_id = c.customer_id
  WHERE c.user_id = user_uuid 
    AND s.deleted_at IS NULL 
    AND c.deleted_at IS NULL;
  
  -- Only allow token usage for active subscribers
  IF user_subscription_status IS NULL OR user_subscription_status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Get current month usage
  SELECT total_tokens INTO current_usage
  FROM get_user_monthly_ai_tokens(user_uuid);
  
  -- Check if adding estimated tokens would exceed limit
  RETURN (current_usage + estimated_tokens) <= monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_monthly_ai_tokens(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_make_ai_request(uuid, integer) TO authenticated; 