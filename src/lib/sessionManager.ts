import { components } from '../../browser-use-api';

export interface LinkedInSessionData {
  cookies: { [key: string]: unknown }[];
  timestamp: number;
  email: string;
}

export interface SessionManagerConfig {
  maxSessionAge: number; // in milliseconds
  storageKey: string;
}

export class SessionManager {
  private config: SessionManagerConfig;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    this.config = {
      maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days by default
      storageKey: 'linkedin_session_data',
      ...config
    };
  }

  /**
   * Store LinkedIn session data in localStorage
   */
  storeSession(sessionData: components['schemas']['TaskBrowserDataResponse'], email: string): void {
    try {
      const sessionInfo: LinkedInSessionData = {
        cookies: sessionData.cookies,
        timestamp: Date.now(),
        email: email.toLowerCase().trim()
      };
      
      localStorage.setItem(this.config.storageKey, JSON.stringify(sessionInfo));
      // console.log('✅ LinkedIn session stored successfully');
    } catch (error) {
      console.warn('Failed to store LinkedIn session:', error);
    }
  }

  /**
   * Retrieve stored LinkedIn session for a specific email
   */
  getStoredSession(email: string): LinkedInSessionData | null {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return null;

      const sessionData: LinkedInSessionData = JSON.parse(stored);
      
      // Check if session is for the right email
      if (sessionData.email !== email.toLowerCase().trim()) {
        // console.log('Session email mismatch, clearing stored session');
        this.clearSession();
        return null;
      }

      // Check if session is still valid (not expired)
      const isValid = Date.now() - sessionData.timestamp < this.config.maxSessionAge;
      if (!isValid) {
        // console.log('Session expired, clearing stored session');
        this.clearSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.warn('Failed to retrieve LinkedIn session:', error);
      this.clearSession(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Check if we have a valid session for the given email
   */
  hasValidSession(email: string): boolean {
    return this.getStoredSession(email) !== null;
  }

  /**
   * Clear stored session data
   */
  clearSession(): void {
    try {
      localStorage.removeItem(this.config.storageKey);
      // console.log('LinkedIn session cleared');
    } catch (error) {
      console.warn('Failed to clear LinkedIn session:', error);
    }
  }

  /**
   * Get session age in hours
   */
  getSessionAge(email: string): number | null {
    const session = this.getStoredSession(email);
    if (!session) return null;
    
    return (Date.now() - session.timestamp) / (1000 * 60 * 60);
  }

  /**
   * Force refresh session (clear current session)
   */
  refreshSession(): void {
    this.clearSession();
  }
} 