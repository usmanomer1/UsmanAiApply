# Jobotic - AI-Powered Job Application Platform

A comprehensive job search automation platform with AI-powered LinkedIn Easy Apply functionality.

## 🚀 Features

### Core Functionality
- **LinkedIn Auto Apply**: Automated job applications using Browser Use Cloud API
- **AI Resume & Cover Letter Generation**: Personalized content creation
- **Real-time Browser Preview**: Live screenshots and GIF animations during automation
- **Manual Override System**: Human intervention for complex application questions
- **Usage Tracking & Billing**: Comprehensive usage analytics with Stripe integration

### Live Browser Preview System
The application includes a sophisticated live preview system that provides real-time visual feedback during LinkedIn automation:

#### Key Features:
- **Real-time Screenshots**: Automatically fetches and displays the latest browser screenshots every 3 seconds
- **GIF Animations**: Shows animated previews of the automation process
- **Media Carousel**: Navigate through multiple screenshots with thumbnail navigation
- **Fullscreen Mode**: Expand preview for detailed viewing
- **Download Functionality**: Save screenshots and GIFs locally
- **Error Handling**: Graceful fallbacks when media is unavailable
- **Performance Optimization**: Stops polling when tab is inactive or task is paused

#### Technical Implementation:
- **Polling Strategy**: Efficient 3-second intervals with exponential backoff on errors
- **Memory Management**: Automatic cleanup of intervals and resources
- **Retry Logic**: Smart retry mechanism with maximum attempt limits
- **Responsive Design**: Adapts to different screen sizes and orientations

### Browser Use Cloud Integration
- **Session Management**: Secure LinkedIn session handling with 24-hour expiration
- **Task Monitoring**: Real-time task status updates and progress tracking
- **Error Recovery**: Automatic retry logic for network issues and rate limiting
- **Cost Tracking**: Detailed logging of automation steps and associated costs

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (Database, Auth, Storage, Edge Functions)
- **Automation**: Browser Use Cloud API v1.0
- **Payments**: Stripe with webhook integration
- **Charts**: Recharts for analytics visualization

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Browser Use Cloud API key
- Stripe account (for payments)

## 🔧 Setup Instructions

### 1. Environment Configuration

Create a `.env` file with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BROWSER_USE_API_KEY=your_browser_use_api_key
```

### 2. Database Setup

The application includes comprehensive database migrations in `supabase/migrations/`:

- **User Profiles**: Store user information and resume uploads
- **Job Campaigns**: Track automation campaigns and criteria
- **Applications**: Record submitted job applications
- **LinkedIn Sessions**: Secure session storage with encryption
- **Browser Use Logs**: Detailed usage tracking for billing
- **Stripe Integration**: Customer and subscription management

### 3. Browser Use Cloud API

The application integrates with Browser Use Cloud API for LinkedIn automation:

#### Key Endpoints Used:
- `POST /run-task` - Start automation tasks
- `GET /get-task-status` - Monitor task progress
- `GET /get-task-screenshots` - Fetch live screenshots
- `GET /get-task-gif` - Get animation previews
- `PUT /pause-task` / `PUT /resume-task` - Control task execution

#### Authentication:
All API calls use Bearer token authentication with the `VITE_BROWSER_USE_API_KEY`.

### 4. Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🎯 Usage Guide

### LinkedIn Session Setup
1. Navigate to Auto Apply page
2. Click "Initialize LinkedIn Session"
3. Manually log in to LinkedIn when prompted
4. System automatically detects successful login and saves session

### Job Application Automation
1. Configure job search criteria (title, location, filters)
2. Select your profile with uploaded resume
3. Start automation - system will:
   - Search for jobs matching criteria
   - Apply to positions with Easy Apply
   - Handle dynamic form questions
   - Provide manual override for complex questions
   - Track all applications and costs

### Live Preview Monitoring
- **Real-time Updates**: View live browser screenshots during automation
- **Progress Tracking**: Monitor application progress with detailed metrics
- **Error Handling**: Automatic retry and fallback mechanisms
- **Cost Tracking**: Real-time cost calculation and usage limits

## 🔒 Security & Privacy

- **Row-Level Security**: All database operations use RLS policies
- **Session Encryption**: LinkedIn sessions stored with secure encryption
- **API Key Protection**: Environment variables for sensitive credentials
- **User Data Isolation**: Complete separation of user data

## 📊 Analytics & Billing

### Usage Tracking
- **Job Applications**: Count of automated applications submitted
- **AI Requests**: Resume and cover letter generation usage
- **Browser Steps**: Detailed automation step tracking
- **Cost Calculation**: Real-time cost tracking with billing integration

### Subscription Plans
- **Pro Plan**: 50 applications + 50 AI requests ($40/month)
- **Pro Plus**: 75 applications + 50 AI requests ($60/month)
- **Extreme**: 150 applications + 50 AI requests ($100/month)

## 🚨 Error Handling

### Comprehensive Error Management
- **Session Expiry**: Automatic detection and refresh prompts
- **Rate Limiting**: Exponential backoff with user notifications
- **Network Issues**: Retry logic with progressive delays
- **Manual Intervention**: Seamless pause/resume for user input

### Live Preview Error Handling
- **Media Unavailable**: Graceful fallbacks with retry options
- **API Failures**: Smart retry logic with maximum attempt limits
- **Network Issues**: Automatic recovery with user feedback
- **Resource Cleanup**: Proper cleanup of intervals and resources

## 🔄 API Integration Details

### Browser Use Cloud API Integration
The application implements a comprehensive wrapper around the Browser Use Cloud API:

#### Task Lifecycle Management
```typescript
// Start a new automation task
const { task_id } = await browserUseAPI.runTask({
  task: "LinkedIn job application automation",
  session_id: "linkedin_session_id",
  max_steps: 100,
  include_screenshot: true
});

// Monitor task progress
await TaskMonitor.startMonitoring(
  task_id,
  onUpdate,    // Real-time status updates
  onComplete,  // Task completion handler
  onError      // Error handling
);
```

#### Live Media Fetching
```typescript
// Fetch latest screenshots
const screenshots = await browserUseAPI.getTaskScreenshots(task_id);

// Get GIF animation
const gifUrl = await browserUseAPI.getTaskGif(task_id);

// Enhanced error handling with retries
const screenshots = await browserUseAPI.getTaskScreenshotsWithRetry(task_id, 3);
```

## 📱 Responsive Design

The application is fully responsive with:
- **Mobile-first approach**: Optimized for all screen sizes
- **Touch-friendly controls**: Easy navigation on mobile devices
- **Adaptive layouts**: Dynamic grid systems and flexible components
- **Performance optimization**: Efficient rendering and resource management

## 🧪 Testing & Validation

### End-to-End Testing Checklist
- ✅ Session initialization and management
- ✅ Job search and application automation
- ✅ Live preview updates and media display
- ✅ Manual override system functionality
- ✅ Usage tracking and billing integration
- ✅ Error handling and recovery mechanisms
- ✅ Responsive design across devices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in this README
- Review the Browser Use Cloud API docs
- Contact support through the application

---

**Note**: This application requires active subscriptions to Browser Use Cloud API and Supabase for full functionality. Demo mode is available for testing without these services.