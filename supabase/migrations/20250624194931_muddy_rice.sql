-- Fix the search_path security warning for can_user_use_voice function
-- Drop and recreate the function with proper search_path setting

DROP FUNCTION IF EXISTS can_user_use_voice(user_uuid uuid);

CREATE OR REPLACE FUNCTION can_user_use_voice(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscription_status text;
  has_active_subscription boolean := false;
BEGIN
  -- Get the user's subscription status by joining through stripe_customers
  SELECT s.status INTO subscription_status
  FROM stripe_customers c
  JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
  WHERE c.user_id = user_uuid
    AND c.deleted_at IS NULL
    AND s.deleted_at IS NULL
  LIMIT 1;

  -- Check if user has an active subscription
  IF subscription_status IN ('active', 'trialing') THEN
    has_active_subscription := true;
  END IF;

  RETURN has_active_subscription;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION can_user_use_voice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_use_voice(uuid) TO anon;