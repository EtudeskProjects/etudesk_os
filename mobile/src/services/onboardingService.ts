/**
 * Onboarding Service
 * Handles talent profile creation after authentication
 */

import { api, ApiResponse } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logService';
import { STORAGE_KEYS } from '../constants/config';

const LOG_SOURCE = 'Onboarding';

export interface OnboardingData {
  firstName?: string;
  lastName?: string;
  bio?: string;
  phone: string;
  city?: string;
  region?: string;
  country?: string;
  profileTags?: string[];
  goals?: string[];
  sectors?: string[];
  gender?: string;
  remoteReady?: boolean;
  willingToRelocate?: boolean;
}

export interface OnboardingStatus {
  isComplete: boolean;
  email: string;
  talent?: {
    id: string;
    slug: string;
    displayName: string;
  } | null;
}

export interface OnboardingOptions {
  profileTags: Array<{ value: string; label: string }>;
  goals: Array<{ value: string; label: string }>;
}

export interface OnboardingResult {
  talent: {
    id: string;
    slug: string;
    displayName: string;
    email: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

/**
 * Complete the onboarding process by creating a talent profile
 */
async function complete(data: OnboardingData): Promise<ApiResponse<OnboardingResult>> {
  // Send data in camelCase (backend expects camelCase)
  const apiData = {
    firstName: data.firstName,
    lastName: data.lastName,
    bio: data.bio,
    phone: data.phone,
    city: data.city,
    region: data.region,
    country: data.country,
    profileTags: data.profileTags,
    goals: data.goals,
    sectors: data.sectors,
    gender: data.gender,
    remoteReady: data.remoteReady,
    willingToRelocate: data.willingToRelocate,
  };

  // Remove undefined values
  const cleanedData = Object.fromEntries(
    Object.entries(apiData).filter(([_, v]) => v !== undefined)
  );

  logger.debug(LOG_SOURCE, 'Sending data to API', { fields: Object.keys(cleanedData) });

  try {
    // Try the dedicated onboarding endpoint first
    const response = await api.post<OnboardingResult>('/api/onboarding/complete', cleanedData);

    // Backend returns flat structure: { success, talent, tokens }
    // We need to handle both flat and nested structures
    const tokens = (response as any).tokens || response.data?.tokens;
    const talent = (response as any).talent || response.data?.talent;

    // Store new tokens if provided and non-empty
    if (tokens?.accessToken && tokens?.refreshToken) {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }

    // Update user info in storage
    if (talent) {
      const existingUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const user = existingUser ? JSON.parse(existingUser) : {};
      user.talentId = talent.id;
      user.hasTalentProfile = true;
      user.onboardingComplete = true;
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      logger.info(LOG_SOURCE, 'User profile updated in storage', { talentId: user.talentId });
    }

    // Return normalized response
    return {
      data: { talent, tokens },
      success: true,
    } as ApiResponse<OnboardingResult>;
  } catch (error: any) {
    logger.warn(LOG_SOURCE, 'Primary endpoint failed, trying fallback', { status: error.status });

    // If 500 or 404, try the fallback endpoint (direct talent creation)
    if (error.status === 500 || error.status === 404) {
      logger.info(LOG_SOURCE, 'Using fallback endpoint: /api/talents');

      // Fallback endpoint might expect snake_case
      const fallbackData = {
        first_name: data.firstName,
        last_name: data.lastName,
        bio: data.bio,
        phone: data.phone,
        city: data.city,
        region: data.region,
        country: data.country,
        profile_tags: data.profileTags,
        goals: data.goals,
        sectors: data.sectors,
        gender: data.gender,
        remote_ready: data.remoteReady,
        willing_to_relocate: data.willingToRelocate,
      };
      const cleanedFallbackData = Object.fromEntries(
        Object.entries(fallbackData).filter(([_, v]) => v !== undefined)
      );

      const fallbackResponse = await api.post<Talent>('/api/talents', cleanedFallbackData);

      if (fallbackResponse.data) {
        // Update user info in storage
        const existingUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        const user = existingUser ? JSON.parse(existingUser) : {};
        user.talentId = fallbackResponse.data.id;
        user.hasTalentProfile = true;
        user.onboardingComplete = true;
        user.displayName = fallbackResponse.data.display_name;
        user.firstName = fallbackResponse.data.first_name;
        user.lastName = fallbackResponse.data.last_name;
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        logger.info(LOG_SOURCE, 'User profile created via fallback', { talentId: user.talentId });

        // Return in expected format
        return {
          data: {
            talent: {
              id: fallbackResponse.data.id,
              slug: fallbackResponse.data.slug || '',
              displayName: fallbackResponse.data.display_name || '',
              email: fallbackResponse.data.email || '',
            },
            tokens: {
              accessToken: '',
              refreshToken: '',
              expiresIn: 0,
            },
          },
        } as ApiResponse<OnboardingResult>;
      }
    }

    // Re-throw if neither worked
    throw error;
  }
}

/**
 * Get the current onboarding status
 */
async function getStatus(): Promise<ApiResponse<{ onboarding: OnboardingStatus }>> {
  return api.get<{ onboarding: OnboardingStatus }>('/api/onboarding/status');
}

/**
 * Get available options for onboarding form
 */
async function getOptions(): Promise<ApiResponse<{ options: OnboardingOptions }>> {
  return api.get<{ options: OnboardingOptions }>('/api/onboarding/options');
}

/**
 * Check if onboarding is needed
 */
async function needsOnboarding(): Promise<boolean> {
  try {
    const response = await getStatus();
    return !response.data?.onboarding?.isComplete;
  } catch (error) {
    // If we can't check status, assume onboarding is needed
    return true;
  }
}

export const onboardingService = {
  complete,
  getStatus,
  getOptions,
  needsOnboarding,
};
