/*
  # AI Token Usage Tracking with Subscription Enforcement

  1. New Tables
    - `ai_token_usage`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `operation_type` (text, constrained to specific values)
      - `prompt_tokens`, `completion_tokens`, `total_tokens` (integers)
      - `max_tokens_requested` (integer)
      - `model_used` (text, defaults to 'gpt-4o-mini')
      - `request_data`, `response_data` (jsonb)
      - `cost_usd` (decimal)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `ai_token_usage` table
    - Add policies for users to view their own data and insert new records

  3. Functions
    - `calculate_total_tokens()` - Trigger function to auto-calculate total tokens
    - `get_user_monthly_ai_tokens()` - Get monthly usage stats for a user
    - `can_user_make_ai_request()` - Check if user can make AI request (subscription + token limit)

  4. Changes
    - All plans (Pro, Pro Plus, Extreme) get 150k tokens monthly
    - Subscription enforcement: only active subscribers can use AI features
    - Token tracking for all AI operations with detailed usage stats
*/

-- First, create the AI Token Usage table if it doesn't exist
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own AI token usage" ON ai_token_usage;
DROP POLICY IF EXISTS "System can insert AI token usage" ON ai_token_usage;

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at ON ai_token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_operation_type ON ai_token_usage(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_month ON ai_token_usage(user_id, created_at);

-- Drop trigger first, then function (to avoid dependency issues)
DROP TRIGGER IF EXISTS calculate_ai_token_totals ON ai_token_usage;
DROP FUNCTION IF EXISTS calculate_total_tokens();

-- Create function to calculate total tokens
CREATE OR REPLACE FUNCTION calculate_total_tokens()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_tokens = NEW.prompt_tokens + NEW.completion_tokens;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER calculate_ai_token_totals
  BEFORE INSERT OR UPDATE ON ai_token_usage
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_tokens();

-- Drop and recreate the monthly tokens function
DROP FUNCTION IF EXISTS get_user_monthly_ai_tokens(uuid, date);
CREATE OR REPLACE FUNCTION get_user_monthly_ai_tokens(user_uuid uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(total_tokens bigint, operation_counts jsonb) AS $$
DECLARE
  tokens_sum bigint;
  op_counts jsonb;
BEGIN
  -- Calculate total tokens for the month
  SELECT COALESCE(SUM(atu.total_tokens), 0)
  INTO tokens_sum
  FROM ai_token_usage atu
  WHERE atu.user_id = user_uuid
    AND DATE_TRUNC('month', atu.created_at) = DATE_TRUNC('month', target_date::timestamptz);

  -- Calculate operation counts separately
  SELECT COALESCE(
    jsonb_object_agg(operation_type, operation_count),
    '{}'::jsonb
  )
  INTO op_counts
  FROM (
    SELECT 
      atu.operation_type,
      COUNT(*) as operation_count
    FROM ai_token_usage atu
    WHERE atu.user_id = user_uuid
      AND DATE_TRUNC('month', atu.created_at) = DATE_TRUNC('month', target_date::timestamptz)
    GROUP BY atu.operation_type
  ) grouped_ops;

  -- Return both values
  RETURN QUERY SELECT tokens_sum, COALESCE(op_counts, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the subscription check function
DROP FUNCTION IF EXISTS can_user_make_ai_request(uuid, integer);
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