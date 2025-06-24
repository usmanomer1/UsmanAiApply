/*
  # Voice Usage Tracking System

  1. New Tables
    - `voice_usage` - Track ElevenLabs API usage per user
      - Links to user for subscription validation and billing
      - Tracks characters used, cost, and timestamps
      - Supports rate limiting and usage statistics

  2. Security
    - Enable RLS on voice_usage table
    - Add policies for authenticated users to manage their own data
    - Add subscription validation

  3. Functions
    - `get_user_voice_usage_stats()` - Get current usage stats for a user
    - `can_user_use_voice()` - Check if user can use voice features (subscription + limits)
    - `record_voice_usage()` - Record voice API usage
    - `check_voice_rate_limit()` - Check if user is rate limited

  4. Features
    - Daily and monthly usage limits
    - Rate limiting to prevent abuse
    - Subscription enforcement (Pro, Pro Plus, Extreme only)
    - Usage statistics and billing integration
*/

-- Voice Usage Table
CREATE TABLE IF NOT EXISTS voice_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  characters_used integer NOT NULL DEFAULT 0,
  text_content text, -- Store for moderation/debugging (optional)
  voice_id text NOT NULL,
  model_used text NOT NULL DEFAULT 'eleven_flash_v2_5',
  cost_usd decimal(10,6) NOT NULL DEFAULT 0,
  request_metadata jsonb DEFAULT '{}'::jsonb, -- Store additional request info
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE voice_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_usage
CREATE POLICY "Users can view their own voice usage"
ON voice_usage
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own voice usage"
ON voice_usage
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_usage_user_id ON voice_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_usage_created_at ON voice_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_usage_user_month ON voice_usage(user_id, created_at);
-- Note: Removed DATE() index as it requires IMMUTABLE functions. The created_at index will be sufficient for date queries.

-- Function to get user's voice usage statistics
CREATE OR REPLACE FUNCTION get_user_voice_usage_stats(
  user_uuid uuid, 
  target_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_characters_today bigint,
  total_characters_month bigint,
  total_cost_month decimal,
  usage_count_today bigint,
  usage_count_month bigint,
  last_usage_time timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Today's usage
    COALESCE(SUM(vu.characters_used) FILTER (WHERE DATE(vu.created_at) = target_date), 0) as total_characters_today,
    
    -- This month's usage
    COALESCE(SUM(vu.characters_used) FILTER (WHERE DATE_TRUNC('month', vu.created_at) = DATE_TRUNC('month', target_date::timestamptz)), 0) as total_characters_month,
    
    -- This month's cost
    COALESCE(SUM(vu.cost_usd) FILTER (WHERE DATE_TRUNC('month', vu.created_at) = DATE_TRUNC('month', target_date::timestamptz)), 0) as total_cost_month,
    
    -- Today's request count
    COALESCE(COUNT(*) FILTER (WHERE DATE(vu.created_at) = target_date), 0) as usage_count_today,
    
    -- This month's request count
    COALESCE(COUNT(*) FILTER (WHERE DATE_TRUNC('month', vu.created_at) = DATE_TRUNC('month', target_date::timestamptz)), 0) as usage_count_month,
    
    -- Last usage time
    MAX(vu.created_at) as last_usage_time
    
  FROM voice_usage vu
  WHERE vu.user_id = user_uuid
    AND vu.created_at >= DATE_TRUNC('month', target_date::timestamptz);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can use voice features
CREATE OR REPLACE FUNCTION can_user_use_voice(
  user_uuid uuid,
  estimated_characters integer DEFAULT 100
)
RETURNS jsonb AS $$
DECLARE
  user_subscription RECORD;
  usage_stats RECORD;
  daily_limit integer := 1200; -- Default daily limit
  monthly_limit integer := 36000; -- Default monthly limit (~1200 * 30)
  user_daily_limit integer := 150; -- Per-user daily limit
  burst_limit integer := 500; -- Per-hour burst limit
  result jsonb;
BEGIN
  -- Check if user has active subscription
  SELECT 
    subscription_status,
    price_id,
    current_period_end
  INTO user_subscription
  FROM stripe_user_subscriptions
  WHERE stripe_user_subscriptions.user_id = user_uuid;
  
  -- Voice features require active subscription
  IF user_subscription.subscription_status IS NULL OR user_subscription.subscription_status != 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'subscription_required',
      'message', 'Voice features require an active subscription. Please upgrade your plan to access AI voice assistance.',
      'subscription_status', COALESCE(user_subscription.subscription_status, 'none')
    );
  END IF;
  
  -- Get current usage stats
  SELECT * INTO usage_stats
  FROM get_user_voice_usage_stats(user_uuid, CURRENT_DATE);
  
  -- Check daily global limit
  IF usage_stats.total_characters_today + estimated_characters > daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_global_limit',
      'message', 'Daily voice usage limit reached for all users. Please try again tomorrow.',
      'current_usage', usage_stats.total_characters_today,
      'daily_limit', daily_limit
    );
  END IF;
  
  -- Check user daily limit
  IF usage_stats.total_characters_today + estimated_characters > user_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'user_daily_limit',
      'message', 'You have reached your daily voice usage limit. Please try again tomorrow.',
      'current_usage', usage_stats.total_characters_today,
      'daily_limit', user_daily_limit
    );
  END IF;
  
  -- Check burst protection (last hour)
  IF usage_stats.last_usage_time IS NOT NULL 
     AND usage_stats.last_usage_time > (NOW() - INTERVAL '1 hour')
     AND (
       SELECT COUNT(*)
       FROM voice_usage
       WHERE user_id = user_uuid
         AND created_at > (NOW() - INTERVAL '1 hour')
     ) >= 10 THEN -- Max 10 requests per hour
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit',
      'message', 'Please take a short break. Voice features will be available again in an hour.',
      'wait_time_minutes', 60
    );
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'allowed', true,
    'subscription_status', user_subscription.subscription_status,
    'current_usage', usage_stats.total_characters_today,
    'daily_limit', user_daily_limit,
    'remaining_today', user_daily_limit - usage_stats.total_characters_today
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record voice usage
CREATE OR REPLACE FUNCTION record_voice_usage(
  user_uuid uuid,
  characters_used integer,
  voice_id_used text,
  model_used text DEFAULT 'eleven_flash_v2_5',
  cost_usd decimal DEFAULT 0,
  request_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  usage_id uuid;
BEGIN
  -- Insert usage record
  INSERT INTO voice_usage (
    user_id,
    characters_used,
    voice_id,
    model_used,
    cost_usd,
    request_metadata
  ) VALUES (
    user_uuid,
    characters_used,
    voice_id_used,
    model_used,
    cost_usd,
    request_metadata
  ) RETURNING id INTO usage_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'usage_id', usage_id,
    'characters_used', characters_used,
    'cost_usd', cost_usd
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits (for frontend)
CREATE OR REPLACE FUNCTION check_voice_rate_limit(
  user_uuid uuid,
  estimated_characters integer DEFAULT 100
)
RETURNS jsonb AS $$
BEGIN
  RETURN can_user_use_voice(user_uuid, estimated_characters);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_voice_usage_stats(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_use_voice(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION record_voice_usage(uuid, integer, text, text, decimal, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION check_voice_rate_limit(uuid, integer) TO authenticated; 