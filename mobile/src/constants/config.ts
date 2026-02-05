/**
 * App Configuration Constants
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  TIMEOUT: 30000,
};

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
