-- ========================================
-- COMPLETE DATABASE SCHEMA AUDIT QUERIES
-- Copy each section into Supabase SQL Editor and run separately
-- ========================================

-- 1. ALL TABLES WITH DETAILED INFORMATION
-- ========================================
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers,
  rowsecurity as has_rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- 2. ALL COLUMNS WITH COMPLETE DETAILS
-- ========================================
SELECT 
  t.table_schema,
  t.table_name,
  t.column_name,
  t.ordinal_position,
  t.column_default,
  t.is_nullable,
  t.data_type,
  t.character_maximum_length,
  t.numeric_precision,
  t.numeric_scale,
  CASE 
    WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
    WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY'
    ELSE 'REGULAR'
  END as key_type,
  t.udt_name as underlying_type
FROM information_schema.columns t
LEFT JOIN (
  SELECT ku.table_name, ku.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage ku 
    ON tc.constraint_name = ku.constraint_name
  WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON t.table_name = pk.table_name AND t.column_name = pk.column_name
LEFT JOIN (
  SELECT ku.table_name, ku.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage ku 
    ON tc.constraint_name = ku.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON t.table_name = fk.table_name AND t.column_name = fk.column_name
WHERE t.table_schema IN ('public', 'auth')
ORDER BY t.table_schema, t.table_name, t.ordinal_position;

-- 3. FOREIGN KEY RELATIONSHIPS
-- ========================================
SELECT 
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc 
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. INDEXES (Performance Analysis)
-- ========================================
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef,
  CASE 
    WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
    WHEN indexdef LIKE '%PRIMARY KEY%' THEN 'PRIMARY KEY'
    ELSE 'REGULAR'
  END as index_type
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. ROW LEVEL SECURITY POLICIES
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Alternative RLS query if above fails:
SELECT 
  n.nspname AS schema_name,
  c.relname AS table_name,
  p.polname AS policy_name,
  CASE p.polpermissive 
    WHEN true THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END AS policy_type,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT' 
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE p.polcmd::text
  END AS command,
  pg_get_expr(p.polqual, p.polrelid) AS qual,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY c.relname, p.polname;

-- 6. TABLE TRIGGERS
-- ========================================
SELECT 
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 7. ENUM TYPES (Custom Data Types)
-- ========================================
SELECT 
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- 8. TABLE STORAGE AND STATISTICS
-- ========================================
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 9. SECURITY ANALYSIS - RLS STATUS
-- ========================================
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  CASE 
    WHEN c.relrowsecurity THEN 'SECURE ✅'
    ELSE 'VULNERABLE ❌'
  END as security_status,
  (SELECT COUNT(*) 
   FROM pg_policy p 
   WHERE p.polrelid = c.oid) as policy_count
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'  -- Regular tables only
ORDER BY c.relname;

-- 10. SUBSCRIPTION & PAYMENT TABLES ANALYSIS
-- ========================================
-- This query specifically checks your critical business tables
SELECT 
  'CRITICAL BUSINESS TABLES AUDIT' as audit_type,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN ('user_id', 'customer_id', 'subscription_id') THEN '🔑 KEY FIELD'
    WHEN column_name LIKE '%price%' OR column_name LIKE '%cost%' OR column_name LIKE '%amount%' THEN '💰 MONEY FIELD'
    WHEN column_name LIKE '%status%' THEN '📊 STATUS FIELD'
    WHEN column_name LIKE '%token%' OR column_name LIKE '%usage%' OR column_name LIKE '%limit%' THEN '📈 USAGE FIELD'
    ELSE '📝 DATA FIELD'
  END as field_importance
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name IN (
    'stripe_user_subscriptions',
    'voice_usage',
    'browser_use_logs', 
    'ai_usage_logs',
    'access_logs',
    'applications',
    'profiles',
    'automation_tasks'
  )
ORDER BY 
  CASE table_name
    WHEN 'stripe_user_subscriptions' THEN 1
    WHEN 'access_logs' THEN 2
    WHEN 'voice_usage' THEN 3
    WHEN 'browser_use_logs' THEN 4
    WHEN 'ai_usage_logs' THEN 5
    ELSE 6
  END,
  ordinal_position; 