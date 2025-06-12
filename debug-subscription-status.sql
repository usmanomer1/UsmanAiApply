-- Debug subscription status - Run this in Supabase SQL Editor
-- This will help us understand why the subscription check is failing

-- Check current user and their subscription status
SELECT 
  'Current User Info' as section,
  auth.uid() as current_user_id;

-- Check stripe_customers table structure and data
SELECT 
  'stripe_customers table' as section,
  user_id,
  customer_id,
  created_at,
  deleted_at
FROM stripe_customers 
WHERE user_id = auth.uid();

-- Check stripe_user_subscriptions table (if it exists)
SELECT 
  'stripe_user_subscriptions table' as section,
  user_id,
  subscription_id,
  subscription_status,
  product_id,
  created_at
FROM stripe_user_subscriptions 
WHERE user_id = auth.uid();

-- Check stripe_subscriptions table (if it exists)
SELECT 
  'stripe_subscriptions table' as section,
  s.*
FROM stripe_subscriptions s
JOIN stripe_customers c ON s.customer_id = c.customer_id
WHERE c.user_id = auth.uid();

-- Test the function directly
SELECT 
  'Function test' as section,
  can_user_make_ai_request(auth.uid(), 1000) as can_make_request,
  auth.uid() as user_id;

-- Check what tables exist
SELECT 
  'Available stripe tables' as section,
  table_name
FROM information_schema.tables 
WHERE table_name LIKE 'stripe%'; 