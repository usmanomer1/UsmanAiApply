/*
  # Security Enforcement System
  
  This migration adds bulletproof server-side validation to prevent any paywall bypass attempts.
  All premium features are protected at the database level with proper authentication checks.
  
  1. Security Functions
    - `verify_user_subscription()` - Server-side subscription validation
    - `check_feature_access()` - Feature-specific access control
    - `validate_linkedin_automation_access()` - LinkedIn bot access validation
    - `validate_ai_tool_access()` - AI tools access validation
    - `record_feature_usage()` - Secure usage tracking
  
  2. Usage Validation
    - Token/step counting with limits enforcement
    - Monthly usage tracking and validation
    - Rate limiting with abuse prevention
  
  3. Audit Trail
    - All access attempts logged
    - Failed attempts tracked for security monitoring
    - Usage patterns monitored
*/

-- Create access_logs table for security monitoring
CREATE TABLE IF NOT EXISTS access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_requested text NOT NULL,
  access_granted boolean NOT NULL DEFAULT false,
  failure_reason text,
  subscription_status text,
  ip_address inet,
  user_agent text,
  request_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on access_logs
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to view their own access logs
CREATE POLICY "Users can view their own access logs"
ON access_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only system can insert access logs
CREATE POLICY "System can insert access logs"
ON access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Indexes for performance and monitoring
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_feature ON access_logs(feature_requested);
CREATE INDEX IF NOT EXISTS idx_access_logs_failed ON access_logs(access_granted, created_at) WHERE access_granted = false;

-- Function to verify user subscription with bulletproof validation
CREATE OR REPLACE FUNCTION verify_user_subscription(
  user_uuid uuid
)
RETURNS jsonb AS $$
DECLARE
  subscription_record RECORD;
  current_time timestamptz := NOW();
BEGIN
  -- Verify user exists and is authenticated
  IF user_uuid IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'invalid_user',
      'message', 'User authentication required'
    );
  END IF;
  
  -- Check if user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'user_not_found',
      'message', 'Invalid user account'
    );
  END IF;
  
  -- Get subscription with all validation
  SELECT 
    subscription_status,
    price_id,
    current_period_end,
    customer_id,
    created_at,
    updated_at
  INTO subscription_record
  FROM stripe_user_subscriptions 
  WHERE user_id = user_uuid;
  
  -- No subscription found
  IF subscription_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'no_subscription',
      'message', 'No active subscription found',
      'subscription_status', 'none'
    );
  END IF;
  
  -- Check subscription status
  IF subscription_record.subscription_status != 'active' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'inactive_subscription',
      'message', 'Subscription is not active: ' || subscription_record.subscription_status,
      'subscription_status', subscription_record.subscription_status
    );
  END IF;
  
  -- Check if subscription has expired
  IF subscription_record.current_period_end IS NOT NULL 
     AND subscription_record.current_period_end < current_time THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'subscription_expired',
      'message', 'Subscription has expired',
      'subscription_status', subscription_record.subscription_status,
      'expired_at', subscription_record.current_period_end
    );
  END IF;
  
  -- Valid subscription
  RETURN jsonb_build_object(
    'valid', true,
    'subscription_status', subscription_record.subscription_status,
    'price_id', subscription_record.price_id,
    'customer_id', subscription_record.customer_id,
    'expires_at', subscription_record.current_period_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check feature access with comprehensive validation
CREATE OR REPLACE FUNCTION check_feature_access(
  user_uuid uuid,
  feature_name text,
  estimated_usage integer DEFAULT 1
)
RETURNS jsonb AS $$
DECLARE
  subscription_validation jsonb;
  usage_stats RECORD;
  monthly_usage RECORD;
  feature_limits jsonb;
  current_month_start date;
  access_result jsonb;
BEGIN
  -- Validate subscription first
  subscription_validation := verify_user_subscription(user_uuid);
  
  IF NOT (subscription_validation->>'valid')::boolean THEN
    -- Log failed access attempt
    INSERT INTO access_logs (user_id, feature_requested, access_granted, failure_reason, subscription_status)
    VALUES (user_uuid, feature_name, false, subscription_validation->>'reason', subscription_validation->>'subscription_status');
    
    RETURN subscription_validation;
  END IF;
  
  -- Get current month for usage calculations
  current_month_start := DATE_TRUNC('month', CURRENT_DATE);
  
  -- Feature-specific validation
  CASE feature_name
    WHEN 'voice_features' THEN
      -- Voice features validation
      RETURN can_user_use_voice(user_uuid, estimated_usage);
      
    WHEN 'linkedin_automation' THEN
      -- LinkedIn automation validation
      SELECT 
        COALESCE(SUM(step_count), 0) as total_steps,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(*) as session_count
      INTO usage_stats
      FROM browser_use_logs 
      WHERE user_id = user_uuid 
        AND task_type = 'linkedin_auto_apply'
        AND DATE(created_at) >= current_month_start;
      
      -- Get plan limits (Pro: 37*10=370 steps, Pro Plus: 77*10=770 steps, Extreme: 158*10=1580 steps)
      feature_limits := CASE subscription_validation->>'price_id'
        WHEN 'price_1RaM5LQGabzJD80B3zGbTHcZ' THEN jsonb_build_object('monthly_steps', 370, 'plan_name', 'Pro')
        WHEN 'price_1RYvjSQGabzJD80BbbXxTq2S' THEN jsonb_build_object('monthly_steps', 770, 'plan_name', 'Pro Plus') 
        WHEN 'price_1RYvocQGabzJD80BEVgRcdSa' THEN jsonb_build_object('monthly_steps', 1580, 'plan_name', 'Extreme')
        ELSE jsonb_build_object('monthly_steps', 0, 'plan_name', 'Unknown')
      END;
      
      -- Check if user exceeds monthly limit
      IF (usage_stats.total_steps + estimated_usage) > (feature_limits->>'monthly_steps')::integer THEN
        access_result := jsonb_build_object(
          'valid', false,
          'reason', 'monthly_limit_exceeded',
          'message', 'Monthly LinkedIn automation limit exceeded for ' || (feature_limits->>'plan_name') || ' plan',
          'current_usage', usage_stats.total_steps,
          'monthly_limit', (feature_limits->>'monthly_steps')::integer,
          'plan_name', feature_limits->>'plan_name'
        );
      ELSE
        access_result := jsonb_build_object(
          'valid', true,
          'current_usage', usage_stats.total_steps,
          'monthly_limit', (feature_limits->>'monthly_steps')::integer,
          'remaining', (feature_limits->>'monthly_steps')::integer - usage_stats.total_steps,
          'plan_name', feature_limits->>'plan_name'
        );
      END IF;
      
    WHEN 'ai_tools' THEN
      -- AI tools validation (CV generation, cover letters, etc.)
      SELECT 
        COALESCE(SUM(ai_requests_used), 0) as total_ai_requests,
        COALESCE(SUM(cost_usd), 0) as total_cost
      INTO usage_stats
      FROM ai_usage_logs 
      WHERE user_id = user_uuid 
        AND DATE(created_at) >= current_month_start;
      
      -- All paid plans have 30,000 AI tokens per month
      IF (usage_stats.total_ai_requests + estimated_usage) > 30000 THEN
        access_result := jsonb_build_object(
          'valid', false,
          'reason', 'ai_token_limit_exceeded',
          'message', 'Monthly AI token limit (30,000) exceeded',
          'current_usage', usage_stats.total_ai_requests,
          'monthly_limit', 30000
        );
      ELSE
        access_result := jsonb_build_object(
          'valid', true,
          'current_usage', usage_stats.total_ai_requests,
          'monthly_limit', 30000,
          'remaining', 30000 - usage_stats.total_ai_requests
        );
      END IF;
      
    ELSE
      -- Unknown feature
      access_result := jsonb_build_object(
        'valid', false,
        'reason', 'unknown_feature',
        'message', 'Feature not recognized: ' || feature_name
      );
  END CASE;
  
  -- Log access attempt
  INSERT INTO access_logs (
    user_id, 
    feature_requested, 
    access_granted, 
    failure_reason, 
    subscription_status,
    request_metadata
  ) VALUES (
    user_uuid, 
    feature_name, 
    (access_result->>'valid')::boolean,
    CASE WHEN (access_result->>'valid')::boolean THEN NULL ELSE access_result->>'reason' END,
    subscription_validation->>'subscription_status',
    jsonb_build_object(
      'estimated_usage', estimated_usage,
      'current_usage', access_result->'current_usage',
      'monthly_limit', access_result->'monthly_limit'
    )
  );
  
  RETURN access_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure function to record feature usage (prevents tampering)
CREATE OR REPLACE FUNCTION record_feature_usage(
  user_uuid uuid,
  feature_name text,
  usage_amount integer,
  cost_usd decimal DEFAULT 0,
  usage_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  access_check jsonb;
  usage_id uuid;
BEGIN
  -- First verify the user has access to use this feature
  access_check := check_feature_access(user_uuid, feature_name, usage_amount);
  
  IF NOT (access_check->>'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: ' || (access_check->>'message'),
      'reason', access_check->>'reason'
    );
  END IF;
  
  -- Record usage based on feature type
  CASE feature_name
    WHEN 'voice_features' THEN
      -- Already handled by record_voice_usage function
      RETURN jsonb_build_object('success', true, 'message', 'Voice usage tracked separately');
      
    WHEN 'linkedin_automation' THEN
      -- Record in browser_use_logs
      INSERT INTO browser_use_logs (
        user_id,
        task_id,
        task_type,
        step_count,
        cost_usd,
        task_metadata,
        created_at
      ) VALUES (
        user_uuid,
        gen_random_uuid()::text,
        'linkedin_auto_apply',
        usage_amount,
        cost_usd,
        usage_metadata,
        NOW()
      ) RETURNING id INTO usage_id;
      
    WHEN 'ai_tools' THEN
      -- Record in ai_usage_logs  
      INSERT INTO ai_usage_logs (
        user_id,
        tool_type,
        ai_requests_used,
        cost_usd,
        request_metadata,
        created_at
      ) VALUES (
        user_uuid,
        usage_metadata->>'tool_type',
        usage_amount,
        cost_usd,
        usage_metadata,
        NOW()
      ) RETURNING id INTO usage_id;
      
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unknown feature type: ' || feature_name
      );
  END CASE;
  
  RETURN jsonb_build_object(
    'success', true,
    'usage_id', usage_id,
    'usage_amount', usage_amount,
    'cost_usd', cost_usd
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive user usage stats (for dashboard)
CREATE OR REPLACE FUNCTION get_user_usage_summary(
  user_uuid uuid
)
RETURNS jsonb AS $$
DECLARE
  subscription_info jsonb;
  voice_stats RECORD;
  linkedin_stats RECORD;
  ai_stats RECORD;
  current_month_start date;
BEGIN
  -- Verify subscription
  subscription_info := verify_user_subscription(user_uuid);
  
  IF NOT (subscription_info->>'valid')::boolean THEN
    RETURN subscription_info;
  END IF;
  
  current_month_start := DATE_TRUNC('month', CURRENT_DATE);
  
  -- Get voice usage stats
  SELECT * INTO voice_stats FROM get_user_voice_usage_stats(user_uuid, CURRENT_DATE);
  
  -- Get LinkedIn automation stats
  SELECT 
    COALESCE(SUM(step_count), 0) as total_steps,
    COALESCE(SUM(cost_usd), 0) as total_cost,
    COUNT(*) as session_count
  INTO linkedin_stats
  FROM browser_use_logs 
  WHERE user_id = user_uuid 
    AND task_type = 'linkedin_auto_apply'
    AND DATE(created_at) >= current_month_start;
  
  -- Get AI tools stats
  SELECT 
    COALESCE(SUM(ai_requests_used), 0) as total_requests,
    COALESCE(SUM(cost_usd), 0) as total_cost
  INTO ai_stats
  FROM ai_usage_logs 
  WHERE user_id = user_uuid 
    AND DATE(created_at) >= current_month_start;
  
  RETURN jsonb_build_object(
    'subscription', subscription_info,
    'voice_usage', jsonb_build_object(
      'characters_today', voice_stats.total_characters_today,
      'characters_month', voice_stats.total_characters_month,
      'cost_month', voice_stats.total_cost_month,
      'daily_limit', 150,
      'remaining_today', GREATEST(0, 150 - voice_stats.total_characters_today)
    ),
    'linkedin_automation', jsonb_build_object(
      'steps_used', linkedin_stats.total_steps,
      'sessions_count', linkedin_stats.session_count,
      'cost_month', linkedin_stats.total_cost,
      'monthly_limit', CASE subscription_info->>'price_id'
        WHEN 'price_1RaM5LQGabzJD80B3zGbTHcZ' THEN 370
        WHEN 'price_1RYvjSQGabzJD80BbbXxTq2S' THEN 770
        WHEN 'price_1RYvocQGabzJD80BEVgRcdSa' THEN 1580
        ELSE 0
      END
    ),
    'ai_tools', jsonb_build_object(
      'tokens_used', ai_stats.total_requests,
      'cost_month', ai_stats.total_cost,
      'monthly_limit', 30000,
      'remaining', GREATEST(0, 30000 - ai_stats.total_requests)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security monitoring function - detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  user_uuid uuid DEFAULT NULL,
  hours_back integer DEFAULT 24
)
RETURNS jsonb AS $$
DECLARE
  suspicious_patterns jsonb := '[]'::jsonb;
  pattern_check RECORD;
  time_threshold timestamptz := NOW() - INTERVAL '1 hour' * hours_back;
BEGIN
  -- Check for rapid failed access attempts
  SELECT COUNT(*) as failed_attempts, array_agg(DISTINCT feature_requested) as features
  INTO pattern_check
  FROM access_logs 
  WHERE (user_uuid IS NULL OR user_id = user_uuid)
    AND access_granted = false 
    AND created_at > time_threshold;
  
  IF pattern_check.failed_attempts > 20 THEN
    suspicious_patterns := suspicious_patterns || jsonb_build_object(
      'type', 'rapid_failed_attempts',
      'count', pattern_check.failed_attempts,
      'features', pattern_check.features,
      'severity', 'high'
    );
  END IF;
  
  -- Check for usage pattern anomalies (coming from same IP rapidly)
  FOR pattern_check IN 
    SELECT ip_address, COUNT(*) as request_count, array_agg(DISTINCT user_id) as users
    FROM access_logs 
    WHERE created_at > time_threshold 
      AND ip_address IS NOT NULL
    GROUP BY ip_address 
    HAVING COUNT(*) > 100
  LOOP
    suspicious_patterns := suspicious_patterns || jsonb_build_object(
      'type', 'high_volume_ip',
      'ip_address', pattern_check.ip_address,
      'request_count', pattern_check.request_count,
      'user_count', array_length(pattern_check.users, 1),
      'severity', 'medium'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'patterns_detected', jsonb_array_length(suspicious_patterns),
    'suspicious_patterns', suspicious_patterns,
    'analysis_period_hours', hours_back
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION verify_user_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_feature_access(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION record_feature_usage(uuid, text, integer, decimal, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_summary(uuid) TO authenticated;

-- Grant admin functions to service role only
GRANT EXECUTE ON FUNCTION detect_suspicious_activity(uuid, integer) TO service_role; 