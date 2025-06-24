/*
  # SKIP THIS MIGRATION
  
  This migration tried to modify stripe_user_subscriptions which is actually a VIEW, not a table.
  The error was: "ALTER action ADD COLUMN cannot be performed on relation stripe_user_subscriptions"
  
  Instead, we've created migration 20250615010005 which fixes the security functions
  to work with the actual table structure:
  
  - stripe_customers (has user_id)
  - stripe_subscriptions (has customer_id + subscription data)  
  - subscriptions (has user_id + app status)
  
  This migration file is kept for reference but should NOT be run.
*/

-- DO NOT RUN THIS MIGRATION
-- Use 20250615010005_fix_security_functions_for_real_tables.sql instead

SELECT 'SKIPPED: This migration is not needed' as status; 