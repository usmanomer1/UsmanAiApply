# AI Token Tracking Implementation

## Overview
Implemented comprehensive OpenAI API token usage tracking and management system with 150k monthly token limits for all users.

## Key Features Implemented

### 1. Database Schema (`supabase/migrations/20250611212400_ai_token_tracking.sql`)
- **ai_token_usage table**: Tracks detailed token usage per operation
- **Operation types**: resume_score, resume_critique, resume_rewrite, cover_letter, cv_generation, company_research
- **Token tracking**: prompt_tokens, completion_tokens, total_tokens, cost_usd
- **Database functions**: 
  - `get_user_monthly_ai_tokens()`: Get current month usage
  - `can_user_make_ai_request()`: Check if user can make request before API call
  - `calculate_total_tokens()`: Auto-calculate total from prompt + completion tokens

### 2. Enhanced OpenAI Service (`src/lib/openaiWithTokenTracking.ts`)

#### Token Limits per Operation
```typescript
const OPERATION_TOKEN_LIMITS = {
  resume_score: 3000,        // Resume analysis & scoring
  resume_critique: 3000,     // Detailed resume feedback
  resume_rewrite: 6000,      // Full resume rewriting
  cover_letter: 6000,        // Cover letter generation
  cv_generation: 6000,       // CV creation
  company_research: 3000,    // Company research
}
```

#### Monthly Token Limit
- **150,000 tokens** per user per month (all plans)
- Usage resets on 1st of each month
- Hard limit enforcement before API calls

#### Features
- **Pre-request validation**: Checks token limits before making OpenAI API calls
- **Real-time tracking**: Records actual token usage from OpenAI responses
- **Cost calculation**: Tracks estimated costs based on gpt-4o-mini pricing
- **Usage statistics**: Provides comprehensive usage breakdowns
- **Error handling**: Graceful fallbacks when tracking fails

### 3. Component Updates

#### ResumeTools Component
- Added token usage display at the top
- Real-time usage updates after each operation
- Visual progress bars with color-coded warnings
- Token remaining counter

#### CoverLetterTool Component
- Replaced direct OpenAI API calls with tracked service
- Uses `generateCompanyResearch()` and `generateCoverLetter()` methods
- Automatic token tracking and usage updates

#### CVGeneration Component
- Updated to use token tracking service
- Maintains existing functionality with added usage monitoring

### 4. Token Usage Display Component (`src/components/TokenUsageDisplay.tsx`)
- **Comprehensive usage overview**: Current usage vs monthly limit
- **Progress visualization**: Color-coded progress bars (green/yellow/orange/red)
- **Operation breakdown**: Shows usage by operation type
- **Real-time refresh**: Manual refresh capability
- **Usage alerts**: Warnings at 80% and 95% usage
- **Token allocation details**: Shows limits per operation type

## Usage Flow

### 1. User Initiates AI Operation
```typescript
// User clicks "Generate Resume Score"
const score = await openAIService.scoreResume(request);
```

### 2. Pre-request Validation
```typescript
// Check if user can make request (before API call)
const canMakeRequest = await supabase.rpc('can_user_make_ai_request', {
  user_uuid: user.id,
  estimated_tokens: 3000  // resume_score limit
});

if (!canMakeRequest) {
  throw new Error('Monthly token limit exceeded');
}
```

### 3. OpenAI API Call
```typescript
// Make request with specified token limit
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  // ... request configuration
  max_tokens: 3000  // Operation-specific limit
});
```

### 4. Token Usage Tracking
```typescript
// Record actual usage from OpenAI response
await supabase.from('ai_token_usage').insert({
  user_id: user.id,
  operation_type: 'resume_score',
  prompt_tokens: data.usage.prompt_tokens,
  completion_tokens: data.usage.completion_tokens,
  total_tokens: data.usage.total_tokens,
  cost_usd: calculateCost(data.usage.total_tokens)
});
```

### 5. UI Updates
```typescript
// Refresh token usage stats in UI
const stats = await openAIService.getTokenUsageStats();
setTokenUsageStats(stats);
```

## Database Structure

### ai_token_usage Table
```sql
CREATE TABLE ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  operation_type text NOT NULL CHECK (operation_type IN (...)),
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  max_tokens_requested integer NOT NULL DEFAULT 0,
  model_used text NOT NULL DEFAULT 'gpt-4o-mini',
  request_data jsonb DEFAULT '{}'::jsonb,
  response_data jsonb DEFAULT '{}'::jsonb,
  cost_usd decimal(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

## Benefits

### 1. Cost Control
- **Prevent overuse**: Hard limits before API calls
- **Predictable costs**: 150k token monthly cap
- **Usage visibility**: Real-time usage tracking

### 2. User Experience
- **Transparent limits**: Clear usage displays
- **Smart warnings**: Proactive alerts at 80% and 95%
- **Operation-specific limits**: Appropriate token allocation per operation type

### 3. Business Intelligence
- **Usage analytics**: Detailed breakdowns by operation type
- **Cost tracking**: Per-user cost monitoring
- **Operation patterns**: Understanding user behavior

### 4. Technical Robustness
- **Database-level validation**: Server-side limit enforcement
- **Atomic operations**: Consistent token tracking
- **Error resilience**: Graceful handling of tracking failures

## Future Enhancements

### 1. Usage-Based Pricing
- **Overage charges**: Additional tokens beyond 150k limit
- **Tier-based limits**: Different limits for different plans
- **Dynamic pricing**: Adjustable token costs

### 2. Advanced Analytics
- **Usage trends**: Historical usage patterns
- **Efficiency metrics**: Token utilization optimization
- **Predictive alerts**: Forecasting monthly usage

### 3. Optimization Features
- **Token optimization**: Reduce token usage through smarter prompts
- **Caching**: Avoid repeat requests for similar operations
- **Batch processing**: Optimize multiple operations

## Configuration

### Environment Variables
```env
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Token Limits (Adjustable)
- Can be modified in `OPERATION_TOKEN_LIMITS` constant
- Monthly limit adjustable in `MONTHLY_TOKEN_LIMIT` constant
- Database function `can_user_make_ai_request()` enforces limits

## Migration Required
Run the database migration to create the token tracking infrastructure:
```sql
-- File: supabase/migrations/20250611212400_ai_token_tracking.sql
-- Creates ai_token_usage table and supporting functions
```

## Testing
1. **Token tracking**: Make AI requests and verify usage recording
2. **Limit enforcement**: Test behavior at monthly limit
3. **Usage display**: Verify real-time usage updates
4. **Error handling**: Test graceful failures when limits exceeded

## Implementation Status
✅ Database schema created
✅ Enhanced OpenAI service with tracking
✅ Component updates completed
✅ Token usage display component
✅ Pre-request validation
✅ Real-time usage tracking
✅ Cost calculation
✅ Usage statistics and analytics

All users now have 150k monthly token limits with comprehensive tracking and management. 