# Production Deployment Guide

## Security & Environment Setup

### 1. Environment Variables Configuration

Create a `.env` file with the following variables for production:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Configuration (Required for AI features)
VITE_OPENAI_API_KEY=sk-your-openai-api-key

# Browser Use API Configuration (Required for automation)
VITE_BROWSER_USE_API_KEY=your_browser_use_api_key
```

### 2. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run all migrations in the `supabase/migrations/` directory
3. Set up Stripe webhook endpoints in your Supabase Edge Functions
4. Configure Row Level Security (RLS) policies (already included in migrations)

### 3. Stripe Configuration

1. Set up Stripe products and pricing in your Stripe dashboard
2. Update `src/stripe-config.ts` with your actual Stripe price IDs
3. Configure webhook endpoints for subscription management
4. Set up Stripe environment variables in Supabase Edge Functions

### 4. Security Checklist

✅ **API Keys & Secrets**
- All API keys are stored in environment variables only
- No hardcoded credentials in source code
- Server-side secrets (service keys) never exposed to frontend
- OpenAI API key properly secured and rate-limited

✅ **Authentication & Authorization**
- Row Level Security (RLS) enabled on all database tables
- User authentication required for all protected routes
- Subscription status enforced for AI features
- Proper session management and token validation

✅ **Data Protection**
- User data isolated with RLS policies
- File uploads secured with proper validation
- Resume storage with signed URLs and expiration
- Sensitive user information encrypted

✅ **Error Handling**
- No sensitive information leaked in error messages
- Graceful fallbacks for API failures
- Proper error logging without exposing internals
- User-friendly error messages

✅ **CORS & Security Headers**
- Proper CORS configuration in Edge Functions
- Security headers configured
- Content Security Policy implemented
- XSS and CSRF protection

## Production Build

### 1. Build Process

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### 2. Deployment Options

#### Netlify (Recommended)
1. Connect your repository to Netlify
2. Set environment variables in Netlify dashboard
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`

#### Vercel
1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy with automatic builds

#### Self-hosted
1. Build the application: `npm run build`
2. Serve the `dist` directory with a web server
3. Configure environment variables on your server

### 3. Performance Optimization

- ✅ Code splitting implemented with React.lazy()
- ✅ Image optimization with proper formats
- ✅ Bundle size optimized with tree shaking
- ✅ Caching strategies for static assets
- ✅ CDN configuration for global distribution

## Monitoring & Maintenance

### 1. Error Monitoring

Set up error monitoring with services like:
- Sentry for frontend error tracking
- Supabase logs for backend monitoring
- Stripe dashboard for payment monitoring

### 2. Performance Monitoring

- Monitor Core Web Vitals
- Track API response times
- Monitor database query performance
- Set up uptime monitoring

### 3. Security Monitoring

- Regular security audits
- Dependency vulnerability scanning
- API rate limiting monitoring
- Unusual usage pattern detection

## Post-Deployment Checklist

### Functionality Testing
- [ ] User authentication (sign up, sign in, sign out)
- [ ] Subscription management and billing
- [ ] AI features (resume analysis, cover letter generation)
- [ ] File upload and storage
- [ ] Email notifications
- [ ] Payment processing

### Security Testing
- [ ] API endpoint security
- [ ] Authentication bypass attempts
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting effectiveness

### Performance Testing
- [ ] Page load times
- [ ] API response times
- [ ] Database query performance
- [ ] File upload/download speeds
- [ ] Mobile responsiveness

## Maintenance Schedule

### Daily
- Monitor error rates and performance metrics
- Check payment processing status
- Review user feedback and support tickets

### Weekly
- Review security logs
- Update dependencies if needed
- Backup database and user data
- Performance optimization review

### Monthly
- Security audit and penetration testing
- Dependency vulnerability assessment
- Cost optimization review
- Feature usage analytics review

## Support & Documentation

### User Support
- Comprehensive FAQ section
- In-app help documentation
- Support ticket system
- User onboarding guides

### Developer Documentation
- API documentation
- Database schema documentation
- Deployment procedures
- Troubleshooting guides

## Compliance & Legal

### Data Protection
- GDPR compliance for EU users
- CCPA compliance for California users
- Data retention policies
- User data export/deletion procedures

### Terms & Privacy
- Terms of Service
- Privacy Policy
- Cookie Policy
- Subscription Terms

## Backup & Recovery

### Database Backups
- Automated daily backups via Supabase
- Point-in-time recovery capability
- Cross-region backup replication
- Regular backup restoration testing

### Disaster Recovery
- Infrastructure redundancy
- Failover procedures
- Data recovery protocols
- Business continuity planning

---

**Important Notes:**
1. Never commit `.env` files to version control
2. Use different API keys for development and production
3. Regularly rotate API keys and secrets
4. Monitor usage and costs across all services
5. Keep all dependencies updated for security patches