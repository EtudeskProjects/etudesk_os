/**
 * App Configuration Constants
 */

// API Configuration — source unique /api/v1
export const API_PREFIX = '/api/v1';
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  API_PREFIX,
  TIMEOUT: 30000,
};

/** Build full API URL for fetch calls */
export function getApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${p}`;
}

// AsyncStorage Keys - Centralized to avoid duplication
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  ONBOARDING_SEEN: 'onboarding_seen',
  LANGUAGE: 'app_language',
  THEME: 'app_theme',
  PRIVACY_PREFERENCES: 'app_privacy_preferences',
} as const;
