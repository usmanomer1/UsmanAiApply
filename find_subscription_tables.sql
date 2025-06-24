-- Find the actual subscription table structure
-- Since stripe_user_subscriptions is a view, let's find the real tables

-- 1. Check what stripe_user_subscriptions view is based on
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE viewname = 'stripe_user_subscriptions';

-- 2. Find all stripe-related tables
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers,
  rowsecurity as has_rls_enabled
FROM pg_tables 
WHERE tablename LIKE '%stripe%' OR tablename LIKE '%subscription%'
ORDER BY schemaname, tablename;

-- 3. Get columns from actual stripe tables
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND (table_name LIKE '%stripe%' OR table_name LIKE '%subscription%')
  AND table_name != 'stripe_user_subscriptions'  -- Exclude the view
ORDER BY table_name, ordinal_position;

-- 4. Check if there's a users table connection
SELECT 
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE '%stripe%' OR tc.table_name LIKE '%subscription%')
  AND tc.table_schema = 'public'
ORDER BY tc.table_name; 