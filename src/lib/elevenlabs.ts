// ElevenLabs API Integration with Smart Credit Management
import { subscriptionService } from './subscriptionService';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description?: string;
  labels?: {
    accent?: string;
    gender?: string;
    age?: string;
    description?: string;
    use_case?: string;
  };
  category: 'generated' | 'cloned' | 'professional' | 'premade';
  preview_url?: string;
  settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

interface VoicePersonality {
  purpose: 'coach' | 'interviewer' | 'assistant';
  preferredGender?: 'male' | 'female';
  preferredAccent?: string;
  preferredAge?: string;
  tone?: string;
}

interface CreditUsage {
  userId: string;
  characters: number;
  timestamp: Date;
  cost: number;
}

interface RateLimitInfo {
  isLimited: boolean;
  waitTime?: number;
  reason?: string;
  globalUsage?: number;
  userUsage?: number;
  dailyLimit?: number;
}

class RateLimitError extends Error {
  public rateLimitInfo: RateLimitInfo;

  constructor(message: string, rateLimitInfo: RateLimitInfo) {
    super(message);
    this.name = 'RateLimitError';
    this.rateLimitInfo = rateLimitInfo;
  }
}

class CreditManager {
  private static readonly TOTAL_CREDITS = 108000;
  private static readonly DURATION_DAYS = 90; // 3 months
  private static readonly DAILY_LIMIT = Math.floor(CreditManager.TOTAL_CREDITS / CreditManager.DURATION_DAYS); // ~1200 per day
  private static readonly USER_DAILY_LIMIT = 150; // Generous per-user limit
  private static readonly USER_BURST_LIMIT = 50; // Allow bursts for smooth UX
  private static readonly CRITICAL_THRESHOLD = 0.1; // When to be more restrictive
  
  private usageHistory: CreditUsage[] = [];
  private dailyUsage: Map<string, number> = new Map(); // date -> total characters
  private userDailyUsage: Map<string, Map<string, number>> = new Map(); // date -> userId -> characters
  private userSessionUsage: Map<string, number> = new Map(); // userId -> characters in last hour

  constructor() {
    this.loadUsageHistory();
    this.cleanupOldData();
  }

  private loadUsageHistory() {
    try {
      const stored = localStorage.getItem('elevenlabs_usage_history');
      if (stored) {
        const data = JSON.parse(stored);
        this.usageHistory = data.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        this.rebuildCaches();
      }
    } catch (error) {
      console.warn('Failed to load usage history:', error);
    }
  }

  private saveUsageHistory() {
    try {
      localStorage.setItem('elevenlabs_usage_history', JSON.stringify(this.usageHistory));
    } catch (error) {
      console.warn('Failed to save usage history:', error);
    }
  }

  private rebuildCaches() {
    this.dailyUsage.clear();
    this.userDailyUsage.clear();
    this.userSessionUsage.clear();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const usage of this.usageHistory) {
      const dateKey = usage.timestamp.toISOString().split('T')[0];
      
      // Daily usage
      this.dailyUsage.set(dateKey, (this.dailyUsage.get(dateKey) || 0) + usage.characters);
      
      // User daily usage
      if (!this.userDailyUsage.has(dateKey)) {
        this.userDailyUsage.set(dateKey, new Map());
      }
      const userMap = this.userDailyUsage.get(dateKey)!;
      userMap.set(usage.userId, (userMap.get(usage.userId) || 0) + usage.characters);
      
      // User session usage (last hour)
      if (usage.timestamp > oneHourAgo) {
        this.userSessionUsage.set(usage.userId, (this.userSessionUsage.get(usage.userId) || 0) + usage.characters);
      }
    }
  }

  private cleanupOldData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    this.usageHistory = this.usageHistory.filter(usage => usage.timestamp > thirtyDaysAgo);
    this.saveUsageHistory();
  }

  private getCurrentUserId(): string {
    // In a real app, this would come from your auth system
    // For now, we'll use a browser fingerprint or anonymous ID
    let userId = localStorage.getItem('anonymous_user_id');
    if (!userId) {
      userId = 'anon_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('anonymous_user_id', userId);
    }
    return userId;
  }

  private getTotalCreditsUsed(): number {
    return this.usageHistory.reduce((total, usage) => total + usage.characters, 0);
  }

  private getRemainingCredits(): number {
    return Math.max(0, CreditManager.TOTAL_CREDITS - this.getTotalCreditsUsed());
  }

  private getTodayUsage(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyUsage.get(today) || 0;
  }

  private getUserTodayUsage(userId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const userMap = this.userDailyUsage.get(today);
    return userMap ? (userMap.get(userId) || 0) : 0;
  }

  private getUserSessionUsage(userId: string): number {
    return this.userSessionUsage.get(userId) || 0;
  }

  // Smart rate limiting that considers global and user usage
  checkRateLimit(textLength: number, userId?: string): RateLimitInfo {
    const user = userId || this.getCurrentUserId();
    const remainingCredits = this.getRemainingCredits();
    const todayUsage = this.getTodayUsage();
    const userTodayUsage = this.getUserTodayUsage(user);
    const userSessionUsage = this.getUserSessionUsage(user);
    
    // Check if we're in critical mode (less than 10% credits remaining)
    const isCritical = remainingCredits < (CreditManager.TOTAL_CREDITS * CreditManager.CRITICAL_THRESHOLD);
    
    // Global daily limit check
    if (todayUsage + textLength > CreditManager.DAILY_LIMIT) {
      const timeUntilMidnight = this.getTimeUntilMidnight();
      return {
        isLimited: true,
        waitTime: timeUntilMidnight,
        reason: 'Daily global limit reached. Voice features will be available tomorrow.',
        globalUsage: todayUsage,
        dailyLimit: CreditManager.DAILY_LIMIT
      };
    }

    // User daily limit (more generous in non-critical mode)
    const userDailyLimit = isCritical ? CreditManager.USER_DAILY_LIMIT * 0.5 : CreditManager.USER_DAILY_LIMIT;
    if (userTodayUsage + textLength > userDailyLimit) {
      const timeUntilMidnight = this.getTimeUntilMidnight();
      return {
        isLimited: true,
        waitTime: timeUntilMidnight,
        reason: `Daily limit reached (${Math.round(userDailyLimit)} characters). Voice features will be available tomorrow.`,
        userUsage: userTodayUsage,
        dailyLimit: userDailyLimit
      };
    }

    // Session burst protection (prevent rapid abuse)
    const sessionLimit = isCritical ? CreditManager.USER_BURST_LIMIT * 0.5 : CreditManager.USER_BURST_LIMIT;
    if (userSessionUsage + textLength > sessionLimit * 100) { // Convert to characters (~100 chars per "burst unit")
      return {
        isLimited: true,
        waitTime: 3600000, // 1 hour
        reason: 'Please take a short break. Voice features will be available in an hour.',
        userUsage: userSessionUsage
      };
    }

    // All checks passed
    return {
      isLimited: false,
      globalUsage: todayUsage,
      userUsage: userTodayUsage,
      dailyLimit: CreditManager.DAILY_LIMIT
    };
  }

  // Record usage after successful API call
  recordUsage(textLength: number, cost: number = textLength, userId?: string) {
    const user = userId || this.getCurrentUserId();
    const usage: CreditUsage = {
      userId: user,
      characters: textLength,
      timestamp: new Date(),
      cost
    };

    this.usageHistory.push(usage);
    
    // Update caches
    const today = new Date().toISOString().split('T')[0];
    this.dailyUsage.set(today, (this.dailyUsage.get(today) || 0) + textLength);
    
    if (!this.userDailyUsage.has(today)) {
      this.userDailyUsage.set(today, new Map());
    }
    const userMap = this.userDailyUsage.get(today)!;
    userMap.set(user, (userMap.get(user) || 0) + textLength);
    
    this.userSessionUsage.set(user, (this.userSessionUsage.get(user) || 0) + textLength);
    
    this.saveUsageHistory();
  }

  private getTimeUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date();
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }

  // Get usage statistics for display
  getUsageStats(): {
    totalUsed: number;
    totalRemaining: number;
    todayUsed: number;
    dailyLimit: number;
    percentageUsed: number;
    daysRemaining: number;
    projectedDuration: number;
  } {
    const totalUsed = this.getTotalCreditsUsed();
    const totalRemaining = this.getRemainingCredits();
    const todayUsed = this.getTodayUsage();
    const percentageUsed = (totalUsed / CreditManager.TOTAL_CREDITS) * 100;
    
    // Calculate projected duration based on current usage rate
    const avgDailyUsage = totalUsed / Math.max(1, this.usageHistory.length / 30); // rough estimate
    const projectedDuration = avgDailyUsage > 0 ? totalRemaining / avgDailyUsage : CreditManager.DURATION_DAYS;
    
    return {
      totalUsed,
      totalRemaining,
      todayUsed,
      dailyLimit: CreditManager.DAILY_LIMIT,
      percentageUsed,
      daysRemaining: CreditManager.DURATION_DAYS,
      projectedDuration: Math.max(0, projectedDuration)
    };
  }
}

class ElevenLabsClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io';
  private cachedVoices: ElevenLabsVoice[] | null = null;
  private voicesPromise: Promise<ElevenLabsVoice[]> | null = null;
  private lastVoicesFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  private creditManager: CreditManager;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.creditManager = new CreditManager();
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        // Handle rate limiting with exponential backoff
        if (response.status === 429 && retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Add jitter
          console.warn(`Rate limited. Retrying in ${Math.round(delay)}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest<T>(endpoint, options, retryCount + 1);
        }
        
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // If it's a network error and we haven't exhausted retries, try again
      if (retryCount < maxRetries && error instanceof TypeError) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.warn(`Network error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest<T>(endpoint, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  // Fetch all available voices with rate limiting and deduplication
  async getVoices(): Promise<ElevenLabsVoice[]> {
    const now = Date.now();
    
    // Return cached voices if they're still fresh
    if (this.cachedVoices && (now - this.lastVoicesFetch) < this.CACHE_DURATION) {
      return this.cachedVoices;
    }

    // If there's already a request in progress, wait for it
    if (this.voicesPromise) {
      return this.voicesPromise;
    }

    // Rate limiting: ensure minimum interval between requests
    const timeSinceLastFetch = now - this.lastVoicesFetch;
    if (timeSinceLastFetch < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastFetch));
    }

    // Create and cache the promise to prevent duplicate requests
    this.voicesPromise = this.fetchVoicesFromAPI();
    
    try {
      const voices = await this.voicesPromise;
      this.cachedVoices = voices;
      this.lastVoicesFetch = Date.now();
      return voices;
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      // Return cached voices if available, otherwise fallback to defaults
      return this.cachedVoices || this.getDefaultVoices();
    } finally {
      // Clear the promise so future requests can be made
      this.voicesPromise = null;
    }
  }

  private async fetchVoicesFromAPI(): Promise<ElevenLabsVoice[]> {
    const response = await this.makeRequest<{ voices: ElevenLabsVoice[] }>('/v2/voices?page_size=100');
    return response.voices;
  }

  // Smart voice selection based on personality
  async selectVoiceForPersonality(personality: VoicePersonality): Promise<ElevenLabsVoice | null> {
    const voices = await this.getVoices();
    
    // Score voices based on personality match
    const scoredVoices = voices.map(voice => ({
      voice,
      score: this.calculatePersonalityScore(voice, personality)
    }));

    // Sort by best match
    scoredVoices.sort((a, b) => b.score - a.score);
    
    return scoredVoices.length > 0 ? scoredVoices[0].voice : null;
  }

  private calculatePersonalityScore(voice: ElevenLabsVoice, personality: VoicePersonality): number {
    let score = 0;
    const labels = voice.labels || {};

    // Gender preference
    if (personality.preferredGender && labels.gender === personality.preferredGender) {
      score += 30;
    }

    // Accent preference
    if (personality.preferredAccent && labels.accent?.toLowerCase().includes(personality.preferredAccent.toLowerCase())) {
      score += 20;
    }

    // Age preference
    if (personality.preferredAge && labels.age === personality.preferredAge) {
      score += 15;
    }

    // Use case alignment
    if (labels.use_case) {
      switch (personality.purpose) {
        case 'coach':
          if (labels.use_case.includes('social') || labels.use_case.includes('conversation')) score += 25;
          break;
        case 'interviewer':
          if (labels.use_case.includes('professional') || labels.use_case.includes('business')) score += 25;
          break;
        case 'assistant':
          if (labels.use_case.includes('assistant') || labels.use_case.includes('help')) score += 25;
          break;
      }
    }

    // Voice category preference
    if (voice.category === 'professional') score += 20;
    else if (voice.category === 'premade') score += 15;

    // Description-based scoring
    const description = (voice.description || '').toLowerCase();
    switch (personality.purpose) {
      case 'coach':
        if (description.includes('warm') || description.includes('friendly') || description.includes('encouraging')) score += 15;
        break;
      case 'interviewer':
        if (description.includes('professional') || description.includes('neutral') || description.includes('clear')) score += 15;
        break;
      case 'assistant':
        if (description.includes('helpful') || description.includes('clear') || description.includes('precise')) score += 15;
        break;
    }

    return score;
  }

  // Convert text to speech with smart credit management
  async textToSpeech(text: string, voiceId: string, options: {
    model?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    outputFormat?: string;
    userId?: string;
    bypassRateLimit?: boolean; // For admin use
  } = {}): Promise<ArrayBuffer> {
    const {
      model = 'eleven_flash_v2_5', // Low latency model
      stability = 0.5,
      similarityBoost = 0.8,
      style = 0.2,
      outputFormat = 'mp3_44100_128',
      userId,
      bypassRateLimit = false
    } = options;

    // Check subscription and database-backed rate limits first unless bypassed
    if (!bypassRateLimit && userId) {
      const voicePermissionCheck = await subscriptionService.canUseVoiceFeatures(userId, text.length);
      if (!voicePermissionCheck.allowed) {
        throw new RateLimitError(voicePermissionCheck.message!, {
          isLimited: true,
          reason: voicePermissionCheck.reason,
          waitTime: voicePermissionCheck.wait_time_minutes ? voicePermissionCheck.wait_time_minutes * 60 : undefined
        });
      }
    }

    // Legacy rate limiting for non-authenticated users
    if (!bypassRateLimit && !userId) {
      const rateLimit = this.creditManager.checkRateLimit(text.length, userId);
      if (rateLimit.isLimited) {
        throw new RateLimitError(rateLimit.reason || 'Rate limit exceeded', rateLimit);
      }
    }

    const requestBody = {
      text,
      model_id: model,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: true
      }
    };

    const response = await fetch(`${this.baseUrl}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`TTS error: ${response.status} ${response.statusText}`);
    }

    // Record successful usage
    if (!bypassRateLimit) {
      if (userId) {
        // Record in database for authenticated users
        const costPerCharacter = 0.0001; // Approximate cost
        const cost = text.length * costPerCharacter;
        await subscriptionService.recordVoiceUsage(
          userId,
          text.length,
          voiceId,
          model,
          cost,
          { requestedAt: new Date().toISOString(), outputFormat }
        );
      } else {
        // Fallback to localStorage for anonymous users
        this.creditManager.recordUsage(text.length, text.length, userId);
      }
    }

    return response.arrayBuffer();
  }

  // Get current usage statistics
  getUsageStats() {
    return this.creditManager.getUsageStats();
  }

  // Check if a request would be rate limited (useful for UI)
  checkRateLimit(textLength: number, userId?: string) {
    return this.creditManager.checkRateLimit(textLength, userId);
  }

  // Get default voices as fallback
  private getDefaultVoices(): ElevenLabsVoice[] {
    return [
      {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        description: 'Warm, professional female voice',
        category: 'premade',
        labels: {
          gender: 'female',
          accent: 'American',
          age: 'middle-aged',
          description: 'expressive',
          use_case: 'professional'
        }
      },
      {
        voice_id: 'N2lVS1w4EtoT3dr4eOWO',
        name: 'Callum',
        description: 'Clear, professional male voice',
        category: 'premade',
        labels: {
          gender: 'male',
          accent: 'American',
          age: 'middle-aged',
          description: 'professional',
          use_case: 'business'
        }
      },
      {
        voice_id: 'pqHfZKP75CvOlQylNhV4',
        name: 'Bill',
        description: 'Friendly, conversational male voice',
        category: 'premade',
        labels: {
          gender: 'male',
          accent: 'American',
          age: 'middle-aged',
          description: 'friendly',
          use_case: 'conversation'
        }
      }
    ];
  }

  // Get optimal voice personalities for different use cases
  static getPersonalities(): Record<string, VoicePersonality> {
    return {
      interviewCoach: {
        purpose: 'coach',
        preferredGender: 'female',
        preferredAccent: 'American',
        preferredAge: 'middle-aged',
        tone: 'warm, encouraging'
      },
      interviewPractitioner: {
        purpose: 'interviewer',
        preferredGender: 'male',
        preferredAccent: 'American',
        preferredAge: 'middle-aged',
        tone: 'professional, neutral'
      },
      technicalAssistant: {
        purpose: 'assistant',
        preferredAccent: 'American',
        tone: 'clear, helpful'
      }
    };
  }
}

// Global singleton instance
let globalElevenLabsClient: ElevenLabsClient | null = null;

// Create and export client instance (singleton)
export const createElevenLabsClient = () => {
  if (globalElevenLabsClient) {
    return globalElevenLabsClient;
  }

  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Please set VITE_ELEVENLABS_API_KEY in your environment.');
  }
  
  globalElevenLabsClient = new ElevenLabsClient(apiKey);
  return globalElevenLabsClient;
};

export type { ElevenLabsVoice, VoicePersonality, RateLimitInfo, CreditUsage };
export { ElevenLabsClient, RateLimitError, CreditManager }; 