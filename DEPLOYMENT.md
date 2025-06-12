# Deployment Guide

## Quick Setup

### 1. Create GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository named `aiapply-dashboard`
2. Don't initialize with README (we already have one)

### 2. Connect Local Repository
```bash
git remote add origin https://github.com/YOUR_USERNAME/aiapply-dashboard.git
git push -u origin main
```

### 3. Set Up Environment Variables
In your GitHub repository settings, add these secrets:

#### Required Secrets
- `NETLIFY_AUTH_TOKEN` - Your Netlify personal access token
- `NETLIFY_SITE_ID` - Your Netlify site ID
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_BROWSER_USE_API_KEY` - Your Browser Use Cloud API key

### 4. Netlify Setup
1. Create account at [Netlify](https://netlify.com)
2. Create new site (can be empty initially)
3. Get your Site ID from Site Settings
4. Generate Personal Access Token from User Settings

### 5. Supabase Setup
1. Create project at [Supabase](https://supabase.com)
2. Run the migrations in `supabase/migrations/`
3. Set up authentication
4. Configure storage bucket for resumes

### 6. Browser Use API
1. Sign up at [Browser Use](https://browser-use.com)
2. Get your API key
3. Add to environment variables

### 7. Stripe Setup (Optional)
1. Create Stripe account
2. Set up products and pricing
3. Configure webhooks
4. Deploy Supabase Edge Functions

## Manual Deployment

### Build Locally
```bash
npm install
npm run build
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

## Environment Variables

Create `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BROWSER_USE_API_KEY=your_browser_use_api_key
```

## Troubleshooting

### Common Issues
1. **Build fails**: Check environment variables are set
2. **Supabase connection**: Verify URL and key are correct
3. **API errors**: Ensure Browser Use API key is valid
4. **Deployment fails**: Check Netlify token and site ID

### Support
- Check the README.md for detailed setup instructions
- Review the code comments for implementation details
- Test in demo mode first before connecting services