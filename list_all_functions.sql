-- Copy this entire query into Supabase SQL Editor and run it
-- This will show you ALL functions with their exact signatures

-- WORKING VERSION - Use this one instead
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as return_type,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type,
  CASE 
    WHEN p.proconfig IS NULL THEN 'NOT SET (VULNERABLE)'
    ELSE array_to_string(p.proconfig, ', ')
  END as search_path_config
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth')
  AND p.prokind = 'f'  -- Only functions, not procedures
  AND p.proname NOT LIKE 'pg_%'  -- Exclude system functions
ORDER BY n.nspname, p.proname;

-- Alternative detailed view with exact CREATE statements
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as return_type,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type,
  CASE 
    WHEN p.proconfig IS NULL THEN 'NOT SET (VULNERABLE)'
    ELSE array_to_string(p.proconfig, ', ')
  END as search_path_config,
  -- Full function signature for ALTER statements
  'ALTER FUNCTION ' || n.nspname || '.' || p.proname || '(' || 
  pg_catalog.pg_get_function_arguments(p.oid) || ') SET search_path = public, auth;' as alter_statement
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth')
  AND p.prokind = 'f'  -- Only functions, not procedures
ORDER BY n.nspname, p.proname; 