/*
  # Fix Stripe User Subscriptions Table
  
  CRITICAL: Add missing user_id column that our security functions require.
  Our verify_user_subscription() function needs to query by user_id.
*/

-- Add user_id column if it doesn't exist
ALTER TABLE stripe_user_subscriptions 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add created_at and updated_at if missing
ALTER TABLE stripe_user_subscriptions 
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE stripe_user_subscriptions 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Convert current_period_end from bigint to timestamptz if needed
-- Note: This assumes the bigint values are Unix timestamps
DO $$
BEGIN
  -- Check if we need to convert the data type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stripe_user_subscriptions' 
    AND column_name = 'current_period_end' 
    AND data_type = 'bigint'
  ) THEN
    -- Add new column with proper type
    ALTER TABLE stripe_user_subscriptions 
    ADD COLUMN IF NOT EXISTS current_period_end_new timestamptz;
    
    -- Convert existing data (if any)
    UPDATE stripe_user_subscriptions 
    SET current_period_end_new = to_timestamp(current_period_end)
    WHERE current_period_end IS NOT NULL;
    
    -- Drop old column and rename new one
    ALTER TABLE stripe_user_subscriptions DROP COLUMN IF EXISTS current_period_end;
    ALTER TABLE stripe_user_subscriptions RENAME COLUMN current_period_end_new TO current_period_end;
  END IF;
END $$;

-- Same for current_period_start
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stripe_user_subscriptions' 
    AND column_name = 'current_period_start' 
    AND data_type = 'bigint'
  ) THEN
    ALTER TABLE stripe_user_subscriptions 
    ADD COLUMN IF NOT EXISTS current_period_start_new timestamptz;
    
    UPDATE stripe_user_subscriptions 
    SET current_period_start_new = to_timestamp(current_period_start)
    WHERE current_period_start IS NOT NULL;
    
    ALTER TABLE stripe_user_subscriptions DROP COLUMN IF EXISTS current_period_start;
    ALTER TABLE stripe_user_subscriptions RENAME COLUMN current_period_start_new TO current_period_start;
  END IF;
END $$;

-- Add primary key if missing
ALTER TABLE stripe_user_subscriptions 
ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid();

-- Create unique index on user_id (one subscription per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_user_subscriptions_user_id 
ON stripe_user_subscriptions(user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_stripe_user_subscriptions_status 
ON stripe_user_subscriptions(subscription_status);

CREATE INDEX IF NOT EXISTS idx_stripe_user_subscriptions_customer 
ON stripe_user_subscriptions(customer_id);

-- Update trigger for updated_at
CREATE OR REPLACE TRIGGER update_stripe_user_subscriptions_updated_at
  BEFORE UPDATE ON stripe_user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE stripe_user_subscriptions IS 'User subscription data from Stripe - critical for paywall enforcement';
COMMENT ON COLUMN stripe_user_subscriptions.user_id IS 'Link to auth.users - required for security functions';
COMMENT ON COLUMN stripe_user_subscriptions.subscription_status IS 'Stripe subscription status - must be active for premium features';
COMMENT ON COLUMN stripe_user_subscriptions.price_id IS 'Stripe price ID - determines user plan and limits'; 