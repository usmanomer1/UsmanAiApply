import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export interface BrowserProfile {
  id: string;
  user_id: string;
  profile_id: string;
  created_at: string;
  last_used_at: string | null;
  last_successful_auth: string | null;
  profile_name: string | null;
  profile_status: 'active' | 'inactive' | 'error';
}

export interface CreateProfileResponse {
  profile_id: string;
  [key: string]: any;
}

export class BrowserProfileManager {
  private supabase: SupabaseClient<Database>;
  private apiKey: string;
  private baseUrl: string;

  constructor(supabase: SupabaseClient<Database>, apiKey: string, baseUrl: string = 'https://api.browser-use.com/api/v1') {
    this.supabase = supabase;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Ensures a user has a browser profile, creating one if needed
   */
  async ensureUserProfile(userId: string): Promise<string> {
    try {
      // Check if user already has a profile
      const { data: existing, error } = await this.supabase
        .from('browser_profiles')
        .select('profile_id, profile_status')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (existing?.profile_id && existing.profile_status === 'active') {
        // Update last used timestamp
        await this.supabase
          .from('browser_profiles')
          .update({ last_used_at: new Date().toISOString() })
          .eq('user_id', userId);

        return existing.profile_id;
      }

      // Create new profile for user
      const profileId = await this.createUserProfile(userId);
      return profileId;
    } catch (error) {
      console.error('Error ensuring user profile:', error);
      throw error;
    }
  }

  /**
   * Creates a new browser profile for a user
   */
  async createUserProfile(userId: string): Promise<string> {
    try {
      // Create profile via Browser Use API
      const response = await fetch(`${this.baseUrl}/browser-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name: `user-${userId.slice(0, 8)}`,
          description: `LinkedIn automation profile for user ${userId}`,
          use_adblock: true,
          use_proxy: true,
          proxy_country_code: 'us',
          browser_viewport_width: 1280,
          browser_viewport_height: 960
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create browser profile: ${errorText}`);
      }

      const profileData: CreateProfileResponse = await response.json();
      
      // Store mapping in Supabase
      const { error: dbError } = await this.supabase
        .from('browser_profiles')
        .insert({
          user_id: userId,
          profile_id: profileData.profile_id,
          profile_name: `user-${userId.slice(0, 8)}`,
          profile_status: 'active'
        });

      if (dbError) {
        // If DB insert fails, try to delete the browser profile
        await this.deleteBrowserProfile(profileData.profile_id).catch(console.error);
        throw dbError;
      }

      return profileData.profile_id;
    } catch (error) {
      console.error('Error creating browser profile:', error);
      throw error;
    }
  }

  /**
   * Gets a user's browser profile
   */
  async getUserProfile(userId: string): Promise<BrowserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('browser_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Marks a successful authentication for a profile
   */
  async markSuccessfulAuth(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('browser_profiles')
        .update({ 
          last_successful_auth: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error marking successful auth:', error);
    }
  }

  /**
   * Deletes a browser profile (both from Browser Use and Supabase)
   */
  async deleteUserProfile(userId: string): Promise<void> {
    try {
      // Get profile ID first
      const profile = await this.getUserProfile(userId);
      if (!profile) return;

      // Delete from Browser Use
      await this.deleteBrowserProfile(profile.profile_id);

      // Delete from Supabase
      await this.supabase
        .from('browser_profiles')
        .delete()
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error deleting user profile:', error);
      throw error;
    }
  }

  /**
   * Deletes a browser profile from Browser Use API
   */
  private async deleteBrowserProfile(profileId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/browser-profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(`Failed to delete browser profile: ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting browser profile from API:', error);
      throw error;
    }
  }

  /**
   * Gets session health status for a user
   */
  async getSessionHealth(userId: string): Promise<{
    hasProfile: boolean;
    sessionAge: number | null;
    sessionHealth: 'fresh' | 'active' | 'expired' | 'unknown';
    expectedLoginRequired: boolean;
  }> {
    const profile = await this.getUserProfile(userId);

    if (!profile) {
      return {
        hasProfile: false,
        sessionAge: null,
        sessionHealth: 'unknown',
        expectedLoginRequired: true
      };
    }

    const hoursSinceAuth = profile.last_successful_auth
      ? (Date.now() - new Date(profile.last_successful_auth).getTime()) / (1000 * 60 * 60)
      : Infinity;

    return {
      hasProfile: true,
      sessionAge: hoursSinceAuth,
      sessionHealth: 
        hoursSinceAuth < 1 ? 'fresh' :
        hoursSinceAuth < 24 ? 'active' :
        'expired',
      expectedLoginRequired: hoursSinceAuth > 24
    };
  }
}