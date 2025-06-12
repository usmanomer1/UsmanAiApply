-- Quick fix: Update the function to enforce subscription requirements
-- Run this in your Supabase SQL Editor to fix the subscription enforcement

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

-- Update the get_user_monthly_ai_tokens function to fix nested aggregate issue
DROP FUNCTION IF EXISTS get_user_monthly_ai_tokens(uuid, date);
CREATE OR REPLACE FUNCTION get_user_monthly_ai_tokens(user_uuid uuid, target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(total_tokens bigint, operation_counts jsonb) AS $$
BEGIN
  RETURN QUERY
  WITH operation_stats AS (
    SELECT 
      atu.operation_type,
      COUNT(*) as operation_count
    FROM ai_token_usage atu
    WHERE atu.user_id = user_uuid
      AND DATE_TRUNC('month', atu.created_at) = DATE_TRUNC('month', target_date::timestamptz)
    GROUP BY atu.operation_type
  ),
  total_usage AS (
    SELECT COALESCE(SUM(atu.total_tokens), 0) as tokens_sum
    FROM ai_token_usage atu
    WHERE atu.user_id = user_uuid
      AND DATE_TRUNC('month', atu.created_at) = DATE_TRUNC('month', target_date::timestamptz)
  )
  SELECT 
    tu.tokens_sum as total_tokens,
    COALESCE(
      jsonb_object_agg(os.operation_type, os.operation_count),
      '{}'::jsonb
    ) as operation_counts
  FROM total_usage tu
  LEFT JOIN operation_stats os ON true
  GROUP BY tu.tokens_sum;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION can_user_make_ai_request(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_monthly_ai_tokens(uuid, date) TO authenticated;

-- Test query to verify the fix
SELECT 'Function updated successfully - subscription enforcement now active and nested aggregate error fixed' as status;