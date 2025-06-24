/*
  # Fix voice permissions RPC function

  1. Problem
    - The `can_user_use_voice` function is trying to access `user_id` column from `stripe_user_subscriptions` view
    - This column doesn't exist in the view, causing the error

  2. Solution
    - Update the RPC function to properly join tables using `customer_id`
    - Link user to their subscription via `stripe_customers` table
    - Check subscription status correctly

  3. Changes
    - Drop and recreate the `can_user_use_voice` function
    - Use proper table joins to connect user_id -> customer_id -> subscription
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS can_user_use_voice(user_uuid uuid);

-- Create the corrected function
CREATE OR REPLACE FUNCTION can_user_use_voice(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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