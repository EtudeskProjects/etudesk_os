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
  phone?: string;
  email?: string;
  city?: string;
  region?: string;
  country?: string;
  profileTags?: string[];
  goals?: string[];
  sectors?: string[];
  gender?: string;
  remoteReady?: boolean;
  willingToRelocate?: boolean;
  avatarUrl?: string;
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
  profileTags: { value: string; label: string }[];
  goals: { value: string; label: string }[];
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
    email: data.email,
    city: data.city,
    region: data.region,
    country: data.country,
    profileTags: data.profileTags,
    goals: data.goals,
    sectors: data.sectors,
    gender: data.gender,
    remoteReady: data.remoteReady,
    willingToRelocate: data.willingToRelocate,
    avatarUrl: data.avatarUrl,
  };

  // Remove undefined values
  const cleanedData = Object.fromEntries(
    Object.entries(apiData).filter(([_, v]) => v !== undefined)
  );

  logger.debug(LOG_SOURCE, 'Sending data to API', { fields: Object.keys(cleanedData) });

  const response = await api.post<OnboardingResult>('/api/onboarding/complete', cleanedData);
  const tokens = response.data?.tokens;
  const talent = response.data?.talent;

  if (!talent || !tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Invalid onboarding response');
  }

  await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);

  const existingUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  const user = existingUser ? JSON.parse(existingUser) : {};
  user.talentId = talent.id;
  user.hasTalentProfile = true;
  user.onboardingComplete = true;
  await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  logger.info(LOG_SOURCE, 'User profile updated in storage', { talentId: user.talentId });

  return {
    data: { talent, tokens },
    success: true,
  } as ApiResponse<OnboardingResult>;
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
  } catch (error: any) {
    logger.warn(LOG_SOURCE, 'Unable to determine onboarding status', { error: error?.message });
    const existingUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (existingUser) {
      const user = JSON.parse(existingUser);
      if (typeof user.onboardingComplete === 'boolean') {
        return !user.onboardingComplete;
      }
    }
    return false;
  }
}

export const onboardingService = {
  complete,
  getStatus,
  getOptions,
  needsOnboarding,
};
