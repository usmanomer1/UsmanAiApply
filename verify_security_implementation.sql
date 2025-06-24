-- ========================================
-- SECTION 1: VERIFY FUNCTION SEARCH PATHS (Run this first)
-- Should show no "VULNERABLE" results
-- ========================================
SELECT 
  proname as function_name,
  CASE 
    WHEN proconfig IS NULL THEN 'VULNERABLE - NO SEARCH PATH SET'
    ELSE 'PROTECTED - ' || array_to_string(proconfig, ', ')
  END as search_path_status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname NOT LIKE 'pg_%'
  AND proname IN (
    'verify_user_subscription',
    'check_feature_access', 
    'record_feature_usage',
    'can_user_use_voice',
    'record_voice_usage',
    'get_user_usage_summary'
  )
ORDER BY proname;

-- ========================================
-- SECTION 2: GET A TEST USER ID (Run this second)
-- ========================================
SELECT id, email FROM auth.users LIMIT 1;

-- ========================================
-- SECTION 3: VERIFY ALL REQUIRED TABLES EXIST (Run this third)
-- ========================================
SELECT 
  table_name,
  CASE 
    WHEN table_name = ANY(ARRAY[
      'stripe_customers',
      'stripe_subscriptions', 
      'subscriptions',
      'voice_usage',
      'browser_use_logs',
      'ai_usage_logs',
      'access_logs'
    ]) THEN '✅ CRITICAL TABLE'
    ELSE '📝 OTHER TABLE'
  END as importance
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'stripe_customers',
    'stripe_subscriptions', 
    'subscriptions',
    'voice_usage',
    'browser_use_logs',
    'ai_usage_logs',
    'access_logs',
    'applications',
    'profiles'
  )
ORDER BY importance DESC, table_name;

-- ========================================
-- SECTION 4: CHECK TABLE RELATIONSHIPS (Run this fourth)
-- ========================================
SELECT 
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  'Links users to data' as relationship_purpose
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    kcu.column_name = 'user_id' OR 
    ccu.column_name = 'id' AND ccu.table_name = 'users'
  )
ORDER BY tc.table_name;

-- ========================================
-- SECTION 5: TEST SUBSCRIPTION VALIDATION (Run after getting user ID from Section 2)
-- Replace 'YOUR_USER_ID' with an actual user ID from Section 2
-- ========================================
-- SELECT verify_user_subscription('YOUR_USER_ID'::uuid) as subscription_test;

-- ========================================
-- SECTION 6: TEST FEATURE ACCESS (Run after getting user ID from Section 2)  
-- Replace 'YOUR_USER_ID' with an actual user ID from Section 2
-- ========================================
-- SELECT check_feature_access('YOUR_USER_ID'::uuid, 'linkedin_automation', 10) as linkedin_test;
-- SELECT check_feature_access('YOUR_USER_ID'::uuid, 'voice_features', 100) as voice_test;
-- SELECT check_feature_access('YOUR_USER_ID'::uuid, 'ai_tools', 1000) as ai_test;

-- ========================================
-- SECTION 7: RLS VERIFICATION (Already completed ✅)
-- You already ran this and got excellent results!
-- ========================================

-- ========================================
-- FINAL SECURITY FUNCTION TESTS
-- Run these with your actual user ID: 27c01ed9-a739-45fc-a2aa-ac30c2749424
-- ========================================

-- Test 1: Subscription Validation
SELECT verify_user_subscription('27c01ed9-a739-45fc-a2aa-ac30c2749424'::uuid) as subscription_test;

-- Test 2: Feature Access Checks  
SELECT check_feature_access('27c01ed9-a739-45fc-a2aa-ac30c2749424'::uuid, 'linkedin_automation', 10) as linkedin_test;
SELECT check_feature_access('27c01ed9-a739-45fc-a2aa-ac30c2749424'::uuid, 'voice_features', 100) as voice_test;
SELECT check_feature_access('27c01ed9-a739-45fc-a2aa-ac30c2749424'::uuid, 'ai_tools', 1000) as ai_test;

-- Test 3: Usage Summary
SELECT get_user_usage_summary('27c01ed9-a739-45fc-a2aa-ac30c2749424'::uuid) as usage_summary; 