/*
  # Fix stripe_user_subscriptions view to include user_id

  1. View Updates
    - Update `stripe_user_subscriptions` view to include `user_id` column
    - Join with `stripe_customers` table to get the user_id
    - Maintain all existing columns for backward compatibility

  2. Security
    - Maintain existing RLS policies through the view
    - Ensure users can only see their own subscription data
*/

-- Drop and recreate the stripe_user_subscriptions view with user_id included
DROP VIEW IF EXISTS stripe_user_subscriptions;

CREATE VIEW stripe_user_subscriptions AS
SELECT 
  sc.user_id,
  ss.customer_id,
  ss.subscription_id,
  ss.status as subscription_status,
  ss.price_id,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  ss.payment_method_brand,
  ss.payment_method_last4
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.customer_id = sc.customer_id
WHERE ss.deleted_at IS NULL 
  AND sc.deleted_at IS NULL;

-- Enable RLS on the view (inherits from underlying tables)
ALTER VIEW stripe_user_subscriptions SET (security_invoker = true);