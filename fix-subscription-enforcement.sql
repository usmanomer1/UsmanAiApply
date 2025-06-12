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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION can_user_make_ai_request(uuid, integer) TO authenticated;

-- Test query to verify the fix
SELECT 'Function updated successfully - subscription enforcement now active' as status; 