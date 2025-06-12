/*
  # Fresh AI Token Tracking System

  1. New Tables
    - Clean `ai_token_usage` table with proper structure
    - Proper indexes for performance
  
  2. Functions
    - `get_user_monthly_ai_tokens` - Get user's monthly token usage
    - `can_user_make_ai_request` - Check if user can make AI requests
    - `calculate_total_tokens` - Auto-calculate total tokens
  
  3. Security
    - Enable RLS on `ai_token_usage` table
    - Add policies for authenticated users
    - Subscription enforcement for all tiers (Pro, Pro Plus, Extreme)
  
  4. Token Limits
    - 150k tokens monthly for all active subscribers
    - Proper subscription status checking
*/

-- Drop existing objects to start fresh
DROP TABLE IF EXISTS ai_token_usage CASCADE;
DROP FUNCTION IF EXISTS get_user_monthly_ai_tokens(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS can_user_make_ai_request(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS calculate_total_tokens() CASCADE;

-- Create fresh ai_token_usage table
CREATE TABLE ai_token_usage (
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
  cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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
CREATE INDEX idx_ai_token_usage_user_id ON ai_token_usage(user_id);
CREATE INDEX idx_ai_token_usage_created_at ON ai_token_usage(created_at);
CREATE INDEX idx_ai_token_usage_operation_type ON ai_token_usage(operation_type);
CREATE INDEX idx_ai_token_usage_user_month ON ai_token_usage(user_id, created_at);

-- Function to calculate total tokens
CREATE OR REPLACE FUNCTION calculate_total_tokens()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_tokens = NEW.prompt_tokens + NEW.completion_tokens;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-calculating total tokens
CREATE TRIGGER calculate_ai_token_totals
  BEFORE INSERT OR UPDATE ON ai_token_usage
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_tokens();

-- Function to get user's monthly AI token usage
CREATE OR REPLACE FUNCTION get_user_monthly_ai_tokens(
  user_uuid uuid, 
  target_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_tokens bigint, 
  operation_counts jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(atu.total_tokens), 0)::bigint as total_tokens,
    COALESCE(
      jsonb_object_agg(
        atu.operation_type, 
        COUNT(*)::integer
      ) FILTER (WHERE atu.operation_type IS NOT NULL),
      '{}'::jsonb
    ) as operation_counts
  FROM ai_token_usage atu
  WHERE atu.user_id = user_uuid
    AND DATE_TRUNC('month', atu.created_at) = DATE_TRUNC('month', target_date::timestamptz);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can make AI request with subscription enforcement
CREATE OR REPLACE FUNCTION can_user_make_ai_request(
  user_uuid uuid, 
  estimated_tokens integer DEFAULT 1000
)
RETURNS boolean AS $$
DECLARE
  current_usage bigint;
  monthly_limit integer := 150000; -- 150k tokens for all active subscribers
  user_subscription_status text;
BEGIN
  -- Check if user has an active subscription
  SELECT s.status INTO user_subscription_status
  FROM stripe_subscriptions s
  JOIN stripe_customers c ON s.customer_id = c.customer_id
  WHERE c.user_id = user_uuid 
    AND s.deleted_at IS NULL 
    AND c.deleted_at IS NULL
  LIMIT 1;
  
  -- Only allow token usage for active subscribers
  IF user_subscription_status IS NULL OR user_subscription_status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Get current month usage
  SELECT total_tokens INTO current_usage
  FROM get_user_monthly_ai_tokens(user_uuid, CURRENT_DATE);
  
  -- Handle null case
  IF current_usage IS NULL THEN
    current_usage := 0;
  END IF;
  
  -- Check if adding estimated tokens would exceed limit
  RETURN (current_usage + estimated_tokens) <= monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_monthly_ai_tokens(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_make_ai_request(uuid, integer) TO authenticated;

-- Insert a test record to verify the setup works
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get a test user ID (first authenticated user)
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Only insert if we found a user
  IF test_user_id IS NOT NULL THEN
    INSERT INTO ai_token_usage (
      user_id, 
      operation_type, 
      prompt_tokens, 
      completion_tokens, 
      cost_usd
    ) VALUES (
      test_user_id, 
      'resume_score', 
      100, 
      50, 
      0.000225
    );
    
    -- Clean up the test record
    DELETE FROM ai_token_usage WHERE user_id = test_user_id AND operation_type = 'resume_score';
  END IF;
END $$;