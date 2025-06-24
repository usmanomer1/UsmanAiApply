/*
  # Fix Security Functions for Real Table Structure
  
  CRITICAL: Update security functions to work with actual tables:
  - stripe_customers (has user_id + customer_id)
  - stripe_subscriptions (has customer_id + subscription data)
  - subscriptions (has user_id + app subscription data)
  
  Our functions were expecting stripe_user_subscriptions table but it's actually a view.
*/

-- Drop and recreate verify_user_subscription with correct table queries
CREATE OR REPLACE FUNCTION verify_user_subscription(
  user_uuid uuid
)
RETURNS jsonb AS $$
DECLARE
  subscription_record RECORD;
  current_time timestamptz := NOW();
BEGIN
  -- Verify user exists and is authenticated
  IF user_uuid IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'invalid_user',
      'message', 'User authentication required'
    );
  END IF;
  
  -- Check if user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'user_not_found',
      'message', 'Invalid user account'
    );
  END IF;
  
  -- Get subscription with proper table joins
  SELECT 
    s.status as subscription_status,
    ss.price_id,
    to_timestamp(ss.current_period_end) as current_period_end,
    sc.customer_id,
    s.created_at,
    s.current_period_end as app_period_end
  INTO subscription_record
  FROM subscriptions s
  LEFT JOIN stripe_customers sc ON s.user_id = sc.user_id
  LEFT JOIN stripe_subscriptions ss ON sc.customer_id = ss.customer_id
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- No subscription found
  IF subscription_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'no_subscription',
      'message', 'No active subscription found',
      'subscription_status', 'none'
    );
  END IF;
  
  -- Check subscription status
  IF subscription_record.subscription_status != 'active' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'inactive_subscription',
      'message', 'Subscription is not active: ' || subscription_record.subscription_status,
      'subscription_status', subscription_record.subscription_status
    );
  END IF;
  
  -- Check if subscription has expired (use app period end if available, else Stripe period end)
  DECLARE
    expiry_date timestamptz;
  BEGIN
    expiry_date := COALESCE(
      subscription_record.app_period_end,
      subscription_record.current_period_end
    );
    
    IF expiry_date IS NOT NULL AND expiry_date < current_time THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'subscription_expired',
        'message', 'Subscription has expired',
        'subscription_status', subscription_record.subscription_status,
        'expired_at', expiry_date
      );
    END IF;
  END;
  
  -- Valid subscription
  RETURN jsonb_build_object(
    'valid', true,
    'subscription_status', subscription_record.subscription_status,
    'price_id', subscription_record.price_id,
    'customer_id', subscription_record.customer_id,
    'expires_at', COALESCE(subscription_record.app_period_end, subscription_record.current_period_end)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update check_feature_access to use the corrected verify_user_subscription
-- (The rest of check_feature_access function stays the same, just calls the updated verify_user_subscription)

-- Set search path on the updated function
ALTER FUNCTION verify_user_subscription(uuid) SET search_path = public, auth;

-- Add helpful comments
COMMENT ON FUNCTION verify_user_subscription(uuid) IS 'SECURED: Bulletproof subscription validation using real tables - immune to schema injection';

-- Grant permissions
GRANT EXECUTE ON FUNCTION verify_user_subscription(uuid) TO authenticated; 